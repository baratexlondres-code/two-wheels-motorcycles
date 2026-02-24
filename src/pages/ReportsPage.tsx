import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, Wrench, Package, Calendar, Bike, ShoppingCart, Download, FileText, Table2 } from "lucide-react";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { format, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import logoSrc from "@/assets/logo.png";

interface RepairJob {
  id: string; job_number: string; status: string; description: string;
  final_cost: number | null; estimated_cost: number | null; labor_cost: number | null;
  payment_status: string; payment_date: string | null; received_at: string; completed_at: string | null;
  customer_id: string; motorcycle_id: string; invoice_number: string | null;
}
interface Customer { id: string; name: string; phone: string | null; email: string | null; }
interface Motorcycle { id: string; customer_id: string; registration: string; make: string; model: string; }
interface RepairPart { id: string; repair_job_id: string; stock_item_id: string; quantity: number; unit_price: number; }
interface RepairService { id: string; repair_job_id: string; description: string; price: number; }
interface StockItem { id: string; name: string; cost_price: number; sell_price: number; }
interface MotorcycleSale { id: string; sale_price: number; cost_price: number; sale_date: string; }
interface AccessorySale { id: string; total: number; created_at: string; }

const STATUS_COLORS: Record<string, string> = {
  received: "hsl(270, 70%, 60%)", diagnosing: "hsl(217, 91%, 60%)",
  waiting_parts: "hsl(38, 92%, 55%)", in_repair: "hsl(1, 100%, 50%)",
  ready: "hsl(142, 71%, 50%)", delivered: "hsl(172, 66%, 45%)", cancelled: "hsl(0, 84%, 55%)",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", waiting_parts: "Waiting Parts",
  in_repair: "In Repair", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};

const CustomTooltipStyle = {
  background: "hsl(0, 0%, 11%)",
  border: "1px solid hsl(0, 0%, 20%)",
  borderRadius: 10,
  color: "hsl(0, 0%, 100%)",
  padding: "10px 14px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

const renderCustomPieLabel = ({ name, percent }: { name: string; percent: number }) => {
  if (percent < 0.05) return null;
  return `${name} (${(percent * 100).toFixed(0)}%)`;
};

const ReportsPage = () => {
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [parts, setParts] = useState<RepairPart[]>([]);
  const [services, setServices] = useState<RepairService[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [motoSales, setMotoSales] = useState<MotorcycleSale[]>([]);
  const [accSales, setAccSales] = useState<AccessorySale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    return format(d, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: j }, { data: p }, { data: rs }, { data: s }, { data: ms }, { data: as }, { data: cu }, { data: mo }] = await Promise.all([
        supabase.from("repair_jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("repair_parts").select("*"),
        supabase.from("repair_services").select("*"),
        supabase.from("stock_items").select("id, name, cost_price, sell_price"),
        supabase.from("motorcycle_sales").select("id, sale_price, cost_price, sale_date").order("sale_date", { ascending: false }),
        supabase.from("accessory_sales").select("id, total, created_at").order("created_at", { ascending: false }),
        supabase.from("customers").select("id, name, phone, email"),
        supabase.from("motorcycles").select("id, customer_id, registration, make, model"),
      ]);
      setJobs(j || []); setParts(p || []); setServices((rs as RepairService[]) || []);
      setStockItems(s || []); setMotoSales(ms || []); setAccSales(as || []);
      setCustomers(cu || []); setMotorcycles(mo || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const inRange = (dateStr: string) => {
    try {
      return isWithinInterval(parseISO(dateStr), { start: parseISO(dateFrom), end: endOfMonth(parseISO(dateTo)) });
    } catch { return false; }
  };

  const filteredJobs = useMemo(() => jobs.filter((j) => inRange(j.received_at)), [jobs, dateFrom, dateTo]);
  const filteredMotoSales = useMemo(() => motoSales.filter((s) => inRange(s.sale_date)), [motoSales, dateFrom, dateTo]);
  const filteredAccSales = useMemo(() => accSales.filter((s) => inRange(s.created_at)), [accSales, dateFrom, dateTo]);

  const getJobTotal = (job: RepairJob) => {
    const jobParts = parts.filter((p) => p.repair_job_id === job.id);
    const partsTotal = jobParts.reduce((s, p) => s + p.quantity * Number(p.unit_price), 0);
    const jobSvcs = services.filter((s) => s.repair_job_id === job.id);
    const svcsTotal = jobSvcs.reduce((s, sv) => s + Number(sv.price), 0);
    const labor = Number(job.labor_cost) || 0;
    const calculated = partsTotal + svcsTotal + labor;
    if (Number(job.final_cost) > 0) return Number(job.final_cost);
    if (calculated > 0) return calculated;
    return Number(job.estimated_cost) || 0;
  };

  // Monthly combined revenue
  const monthlyRevenue = useMemo(() => {
    const data: Record<string, { month: string; repairs: number; motos: number; accessories: number; total: number }> = {};
    const addToMonth = (dateStr: string, field: "repairs" | "motos" | "accessories", amount: number) => {
      try {
        const monthKey = format(parseISO(dateStr), "yyyy-MM");
        const label = format(parseISO(dateStr), "MMM yy");
        if (!data[monthKey]) data[monthKey] = { month: label, repairs: 0, motos: 0, accessories: 0, total: 0 };
        data[monthKey][field] += amount;
        data[monthKey].total += amount;
      } catch {}
    };
    filteredJobs.filter((j) => j.payment_status === "paid").forEach((job) => {
      addToMonth(job.payment_date || job.completed_at || job.received_at, "repairs", getJobTotal(job));
    });
    filteredMotoSales.forEach((s) => addToMonth(s.sale_date, "motos", Number(s.sale_price)));
    filteredAccSales.forEach((s) => addToMonth(s.created_at, "accessories", Number(s.total)));
    return Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredJobs, filteredMotoSales, filteredAccSales, parts, services]);

  // Jobs by status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach((j) => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([status, count]) => ({ name: STATUS_LABELS[status] || status, value: count, color: STATUS_COLORS[status] || "hsl(0, 0%, 50%)" }))
      .sort((a, b) => b.value - a.value);
  }, [filteredJobs]);

  // Top parts
  const topParts = useMemo(() => {
    const partCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    const filteredJobIds = new Set(filteredJobs.map((j) => j.id));
    parts.filter((p) => filteredJobIds.has(p.repair_job_id)).forEach((p) => {
      const item = stockItems.find((s) => s.id === p.stock_item_id);
      const name = item?.name || "Unknown";
      if (!partCounts[p.stock_item_id]) partCounts[p.stock_item_id] = { name, quantity: 0, revenue: 0 };
      partCounts[p.stock_item_id].quantity += p.quantity;
      partCounts[p.stock_item_id].revenue += p.quantity * p.unit_price;
    });
    return Object.values(partCounts).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [filteredJobs, parts, stockItems]);

  // KPIs
  const repairRevenue = filteredJobs.filter((j) => j.payment_status === "paid").reduce((s, j) => s + getJobTotal(j), 0);
  const motoRevenue = filteredMotoSales.reduce((s, m) => s + Number(m.sale_price), 0);
  const motoProfit = filteredMotoSales.reduce((s, m) => s + (Number(m.sale_price) - Number(m.cost_price)), 0);
  const accRevenue = filteredAccSales.reduce((s, a) => s + Number(a.total), 0);
  const totalRevenue = repairRevenue + motoRevenue + accRevenue;
  const totalJobs = filteredJobs.length;

  const exportCSV = () => {
    const escCSV = (val: string) => val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    const lines: string[] = [];

    // Section 1: Summary
    lines.push("=== SUMMARY ===");
    lines.push("Metric,Value");
    lines.push(`Total Revenue,${totalRevenue.toFixed(2)}`);
    lines.push(`Repairs Revenue,${repairRevenue.toFixed(2)}`);
    lines.push(`Motorcycle Sales,${motoRevenue.toFixed(2)}`);
    lines.push(`Motorcycle Profit,${motoProfit.toFixed(2)}`);
    lines.push(`Accessories Revenue,${accRevenue.toFixed(2)}`);
    lines.push(`Total Jobs,${totalJobs}`);
    lines.push("");

    // Section 2: Revenue by Period
    lines.push("=== REVENUE BY PERIOD ===");
    lines.push("Period,Repairs (£),Motorcycles (£),Accessories (£),Total (£)");
    monthlyRevenue.forEach(r => lines.push(`${r.month},${r.repairs.toFixed(2)},${r.motos.toFixed(2)},${r.accessories.toFixed(2)},${r.total.toFixed(2)}`));
    lines.push(`TOTAL,${monthlyRevenue.reduce((s, r) => s + r.repairs, 0).toFixed(2)},${monthlyRevenue.reduce((s, r) => s + r.motos, 0).toFixed(2)},${monthlyRevenue.reduce((s, r) => s + r.accessories, 0).toFixed(2)},${totalRevenue.toFixed(2)}`);
    lines.push("");

    // Section 3: Detailed Repair Jobs
    lines.push("=== REPAIR JOBS DETAIL ===");
    lines.push("Job #,Invoice #,Customer,Phone,Vehicle,Registration,Description,Status,Payment,Date,Parts (£),Services (£),Labour (£),Total (£)");
    filteredJobs.forEach(job => {
      const cust = customers.find(c => c.id === job.customer_id);
      const moto = motorcycles.find(m => m.id === job.motorcycle_id);
      const jobParts = parts.filter(p => p.repair_job_id === job.id);
      const partsT = jobParts.reduce((s, p) => s + p.quantity * Number(p.unit_price), 0);
      const jobSvcs = services.filter(s => s.repair_job_id === job.id);
      const svcsT = jobSvcs.reduce((s, sv) => s + Number(sv.price), 0);
      const laborT = Number(job.labor_cost) || 0;
      const total = getJobTotal(job);
      const dateStr = job.payment_date || job.received_at;
      lines.push([
        job.job_number, job.invoice_number || "", escCSV(cust?.name || "Unknown"), cust?.phone || "",
        escCSV(moto ? `${moto.make} ${moto.model}` : "Unknown"), moto?.registration || "",
        escCSV(job.description), job.status, job.payment_status,
        dateStr ? format(parseISO(dateStr), "dd/MM/yyyy") : "",
        partsT.toFixed(2), svcsT.toFixed(2), laborT.toFixed(2), total.toFixed(2),
      ].join(","));
    });
    lines.push("");

    // Section 4: Parts & Services breakdown
    lines.push("=== PARTS & SERVICES USED ===");
    lines.push("Job #,Type,Description,Qty,Unit Price (£),Total (£)");
    const filteredJobIds = new Set(filteredJobs.map(j => j.id));
    parts.filter(p => filteredJobIds.has(p.repair_job_id)).forEach(p => {
      const job = jobs.find(j => j.id === p.repair_job_id);
      const item = stockItems.find(s => s.id === p.stock_item_id);
      lines.push([job?.job_number || "", "Part", escCSV(item?.name || "Unknown"), p.quantity, Number(p.unit_price).toFixed(2), (p.quantity * Number(p.unit_price)).toFixed(2)].join(","));
    });
    services.filter(s => filteredJobIds.has(s.repair_job_id)).forEach(s => {
      const job = jobs.find(j => j.id === s.repair_job_id);
      lines.push([job?.job_number || "", "Service", escCSV(s.description), 1, Number(s.price).toFixed(2), Number(s.price).toFixed(2)].join(","));
    });
    lines.push("");

    // Section 5: Top Parts
    if (topParts.length > 0) {
      lines.push("=== TOP PARTS ===");
      lines.push("#,Part Name,Qty Used,Revenue (£)");
      topParts.forEach((p, i) => lines.push(`${i + 1},${escCSV(p.name)},${p.quantity},${p.revenue.toFixed(2)}`));
      lines.push("");
    }

    // Section 6: Jobs by Status
    if (statusData.length > 0) {
      lines.push("=== JOBS BY STATUS ===");
      lines.push("Status,Count");
      statusData.forEach(s => lines.push(`${s.name},${s.value}`));
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TwoWheels_Report_${dateFrom}_to_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
      const atModule = await import("jspdf-autotable");
      const autoTable = atModule.default || atModule.autoTable;
      const doc = new jsPDF();

      // Load logo as base64
      const loadImage = (src: string): Promise<string> => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } catch { resolve(""); }
        };
        img.onerror = () => resolve("");
        img.src = src;
      });

      let logoData = "";
      try { logoData = await loadImage(logoSrc); } catch { /* skip logo */ }

      // Header with logo
      if (logoData) {
        doc.addImage(logoData, "PNG", 14, 10, 18, 18);
      }
      const textX = logoData ? 36 : 14;
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Two Wheels Motorcycles", textX, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Financial Report: ${dateFrom} to ${dateTo}`, textX, 27);
      doc.setDrawColor(225, 6, 0); doc.setLineWidth(0.5); doc.line(14, 32, 196, 32);

      // KPIs
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, 40);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      const kpis = [
        [`Total Revenue: £${totalRevenue.toFixed(2)}`, `Total Jobs: ${totalJobs}`],
        [`Repairs: £${repairRevenue.toFixed(2)}`, `Motorcycle Sales: £${motoRevenue.toFixed(2)}`],
        [`Accessories: £${accRevenue.toFixed(2)}`, `Moto Profit: £${motoProfit.toFixed(2)}`],
      ];
      let y = 46;
      kpis.forEach(row => { doc.text(row[0], 14, y); doc.text(row[1], 110, y); y += 6; });

      // Revenue table
      y += 4;
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Revenue by Period", 14, y);
      y += 4;

      const tableData = monthlyRevenue.map(r => [r.month, `£${r.repairs.toFixed(2)}`, `£${r.motos.toFixed(2)}`, `£${r.accessories.toFixed(2)}`, `£${r.total.toFixed(2)}`]);
      tableData.push(["TOTAL", `£${monthlyRevenue.reduce((s, r) => s + r.repairs, 0).toFixed(2)}`, `£${monthlyRevenue.reduce((s, r) => s + r.motos, 0).toFixed(2)}`, `£${monthlyRevenue.reduce((s, r) => s + r.accessories, 0).toFixed(2)}`, `£${totalRevenue.toFixed(2)}`]);

      autoTable(doc, {
        startY: y,
        head: [["Period", "Repairs", "Motorcycles", "Accessories", "Total"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [225, 6, 0], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        foot: [],
      });

      // Top parts table
      if (topParts.length > 0) {
        const partsY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("Top Parts Used", 14, partsY);

        autoTable(doc, {
          startY: partsY + 4,
          head: [["#", "Part Name", "Qty Used", "Revenue"]],
          body: topParts.map((p, i) => [i + 1, p.name, p.quantity, `£${p.revenue.toFixed(2)}`]),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [225, 6, 0], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      // Jobs by status
      if (statusData.length > 0) {
        const statusY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("Jobs by Status", 14, statusY);

        autoTable(doc, {
          startY: statusY + 4,
          head: [["Status", "Count"]],
          body: statusData.map(s => [s.name, s.value]),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [225, 6, 0], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(`Two Wheels Motorcycles — Generated ${format(new Date(), "dd/MM/yyyy HH:mm")} — Page ${i}/${pageCount}`, 14, 290);
      }

      doc.save(`TwoWheels_Report_${dateFrom}_to_${dateTo}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF. Please try again.");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading reports...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">Financial overview — all revenue streams</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-sm text-foreground focus:outline-none w-[130px] cursor-pointer [color-scheme:dark]" />
            <span className="text-muted-foreground text-xs">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-sm text-foreground focus:outline-none w-[130px] cursor-pointer [color-scheme:dark]" />
          </div>
          <div className="flex gap-1">
            <button onClick={exportPDF} title="Export PDF"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={exportCSV} title="Export CSV"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
              <Table2 className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { icon: TrendingUp, label: "Total Revenue", value: `£${totalRevenue.toFixed(2)}`, sub: `${totalJobs} total jobs`, colorClass: "text-green-500" },
          { icon: Wrench, label: "Repairs", value: `£${repairRevenue.toFixed(2)}`, sub: `${filteredJobs.filter(j => j.payment_status === "paid").length} paid`, colorClass: "text-primary" },
          { icon: Bike, label: "Motorcycle Sales", value: `£${motoRevenue.toFixed(2)}`, sub: `Profit: £${motoProfit.toFixed(2)}`, colorClass: "text-blue-400" },
          { icon: ShoppingCart, label: "Accessories", value: `£${accRevenue.toFixed(2)}`, sub: `${filteredAccSales.length} sales`, colorClass: "text-amber-400" },
          { icon: BarChart3, label: "Motos Sold", value: `${filteredMotoSales.length}`, sub: "motorcycles", colorClass: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.colorClass}`} />
            </div>
            <p className="text-xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Revenue Chart - takes 3 cols */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-foreground">Monthly Revenue</h3>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary inline-block" /> Repairs</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400 inline-block" /> Motorcycles</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400 inline-block" /> Accessories</span>
            </div>
          </div>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "hsl(0, 0%, 64%)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(0, 0%, 16%)" }}
                />
                <YAxis
                  tick={{ fill: "hsl(0, 0%, 64%)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  contentStyle={CustomTooltipStyle}
                  cursor={{ fill: "hsla(0, 0%, 100%, 0.03)" }}
                  formatter={(value: number, name: string) => [`£${value.toFixed(2)}`, name]}
                />
                <Bar dataKey="repairs" name="Repairs" fill="hsl(1, 100%, 44%)" radius={[3, 3, 0, 0]} stackId="revenue" />
                <Bar dataKey="motos" name="Motorcycles" fill="hsl(217, 91%, 60%)" radius={[0, 0, 0, 0]} stackId="revenue" />
                <Bar dataKey="accessories" name="Accessories" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} stackId="revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No revenue data for this period</div>
          )}
        </div>

        {/* Jobs by Status - takes 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-5">Jobs by Status</h3>
          {statusData.length > 0 ? (
            <div>
              {/* If only one status, show a simple stat card instead of an unreadable donut */}
              {statusData.length === 1 ? (
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <div className="w-28 h-28 rounded-full flex items-center justify-center border-4" style={{ borderColor: statusData[0].color }}>
                    <span className="text-3xl font-bold text-foreground">{statusData[0].value}</span>
                  </div>
                  <span className="mt-3 text-sm font-medium" style={{ color: statusData[0].color }}>{statusData[0].name}</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={0}
                      label={({ name, percent }) => percent >= 0.1 ? `${(percent * 100).toFixed(0)}%` : ""}
                      labelLine={false}
                    >
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={CustomTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {/* Custom legend */}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {statusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-[11px] text-muted-foreground truncate">{entry.name}</span>
                    <span className="text-[11px] font-semibold text-foreground ml-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No data</div>
          )}
        </div>
      </div>

      {/* Revenue Trend Area Chart */}
      {monthlyRevenue.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-5">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(0, 0%, 64%)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(0, 0%, 16%)" }} />
              <YAxis tick={{ fill: "hsl(0, 0%, 64%)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={CustomTooltipStyle} formatter={(value: number) => [`£${value.toFixed(2)}`, "Total"]} />
              <Area type="monotone" dataKey="total" stroke="hsl(142, 71%, 45%)" fill="url(#gradientTotal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Parts */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Top Parts Used</h3>
        {topParts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wider">
                  <th className="pb-3 pr-4 w-8">#</th><th className="pb-3 pr-4">Part Name</th>
                  <th className="pb-3 pr-4 text-right">Qty Used</th><th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topParts.map((part, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pr-4 text-muted-foreground font-medium">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-foreground">{part.name}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{part.quantity}</span>
                    </td>
                    <td className="py-3 text-right font-semibold text-foreground">£{part.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No parts used in this period</p>
        )}
      </div>

      {/* Revenue Summary Table */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Period</h3>
        {monthlyRevenue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wider">
                  <th className="pb-3 pr-4">Period</th><th className="pb-3 pr-4 text-right">Repairs</th>
                  <th className="pb-3 pr-4 text-right">Motorcycles</th><th className="pb-3 pr-4 text-right">Accessories</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRevenue.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground">{row.month}</td>
                    <td className="py-3 pr-4 text-right text-primary font-medium">£{row.repairs.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-right text-blue-400 font-medium">£{row.motos.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-right text-amber-400 font-medium">£{row.accessories.toFixed(2)}</td>
                    <td className="py-3 text-right font-bold text-foreground">£{row.total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t border-border">
                  <td className="py-3 pr-4 text-foreground">Total</td>
                  <td className="py-3 pr-4 text-right text-primary">£{monthlyRevenue.reduce((s, r) => s + r.repairs, 0).toFixed(2)}</td>
                  <td className="py-3 pr-4 text-right text-blue-400">£{monthlyRevenue.reduce((s, r) => s + r.motos, 0).toFixed(2)}</td>
                  <td className="py-3 pr-4 text-right text-amber-400">£{monthlyRevenue.reduce((s, r) => s + r.accessories, 0).toFixed(2)}</td>
                  <td className="py-3 text-right text-green-400">£{monthlyRevenue.reduce((s, r) => s + r.total, 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No revenue data for this period</p>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
