import { useState } from "react";
import { X, Printer, User, Wrench, Package, FileText, List, AlignLeft } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
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
interface RepairService { id: string; repair_job_id: string; description: string; price: number; mechanic_id?: string | null; }
interface StockItem { id: string; name: string; cost_price: number; sell_price: number; }
interface MotorcycleSale { id: string; sale_price: number; cost_price: number; sale_date: string; }
interface AccessorySale { id: string; total: number; created_at: string; }
interface MonthlyRevenue { month: string; repairs: number; motos: number; accessories: number; total: number; }

interface Props {
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  jobs: RepairJob[];
  parts: RepairPart[];
  services: RepairService[];
  stockItems: StockItem[];
  customers: Customer[];
  motorcycles: Motorcycle[];
  motoSales: MotorcycleSale[];
  accSales: AccessorySale[];
  monthlyRevenue: MonthlyRevenue[];
  getJobTotal: (job: RepairJob) => number;
  totalRevenue: number;
  repairRevenue: number;
  motoRevenue: number;
  motoProfit: number;
  accRevenue: number;
  onExportPDF: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", waiting_parts: "Waiting Parts",
  in_repair: "In Repair", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};

export default function ReportPreviewModal({
  onClose, dateFrom, dateTo, jobs, parts, services, stockItems, customers, motorcycles,
  motoSales, accSales, monthlyRevenue, getJobTotal, totalRevenue, repairRevenue, motoRevenue,
  motoProfit, accRevenue, onExportPDF,
}: Props) {
  const [detailed, setDetailed] = useState(true);
  const getCust = (id: string) => customers.find(c => c.id === id);
  const getMoto = (id: string) => motorcycles.find(m => m.id === id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Toolbar - hidden on print */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-card border-b border-border px-5 py-3 print:hidden">
        <h2 className="text-sm font-bold text-foreground">Report Preview</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden mr-2">
            <button onClick={() => setDetailed(false)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${!detailed ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              <List className="h-3.5 w-3.5" /> Summary
            </button>
            <button onClick={() => setDetailed(true)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${detailed ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              <AlignLeft className="h-3.5 w-3.5" /> Detailed
            </button>
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={() => { onExportPDF(); onClose(); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors">
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </button>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Report content */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-card rounded-2xl border border-border mt-16 mb-8 mx-4 print:mt-0 print:mx-0 print:border-0 print:rounded-none print:shadow-none print:max-w-none print:bg-white">
        
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-border print:border-b-2 print:border-gray-300">
          <img src={logoSrc} alt="Logo" className="h-12 w-12 object-contain" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground print:text-black">Two Wheels Motorcycles</h1>
            <p className="text-sm text-muted-foreground print:text-gray-600">Financial Report</p>
          </div>
          <div className="text-right text-xs text-muted-foreground print:text-gray-500">
            <p>Period: {dateFrom} to {dateTo}</p>
            <p>Generated: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground mb-3 print:text-black">Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Total Revenue", value: `£${totalRevenue.toFixed(2)}` },
              { label: "Repairs", value: `£${repairRevenue.toFixed(2)}` },
              { label: "Motorcycle Sales", value: `£${motoRevenue.toFixed(2)}` },
              { label: "Moto Profit", value: `£${motoProfit.toFixed(2)}` },
              { label: "Accessories", value: `£${accRevenue.toFixed(2)}` },
              { label: "Total Jobs", value: `${jobs.length}` },
            ].map(k => (
              <div key={k.label} className="rounded-lg border border-border p-3 print:border-gray-200">
                <p className="text-[10px] uppercase text-muted-foreground print:text-gray-500">{k.label}</p>
                <p className="text-lg font-bold text-foreground print:text-black">{k.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Period */}
        {monthlyRevenue.length > 0 && (
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground mb-3 print:text-black">Revenue by Period</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Period</th>
                  <th className="pb-2 pr-3 text-right">Repairs</th>
                  <th className="pb-2 pr-3 text-right">Motorcycles</th>
                  <th className="pb-2 pr-3 text-right">Accessories</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRevenue.map((r, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-2 pr-3 font-medium text-foreground print:text-black">{r.month}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">£{r.repairs.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">£{r.motos.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">£{r.accessories.toFixed(2)}</td>
                    <td className="py-2 text-right font-bold text-foreground print:text-black">£{r.total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-2 pr-3 text-foreground print:text-black">Total</td>
                  <td className="py-2 pr-3 text-right text-foreground">£{monthlyRevenue.reduce((s, r) => s + r.repairs, 0).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right text-foreground">£{monthlyRevenue.reduce((s, r) => s + r.motos, 0).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right text-foreground">£{monthlyRevenue.reduce((s, r) => s + r.accessories, 0).toFixed(2)}</td>
                  <td className="py-2 text-right text-foreground">£{totalRevenue.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Repair Jobs */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground mb-3 print:text-black">
            Repair Jobs {detailed ? "Detail" : "Summary"} ({jobs.length} jobs)
          </h2>

          {detailed ? (
            /* DETAILED VIEW */
            <div className="space-y-3">
              {jobs.map(job => {
                const cust = getCust(job.customer_id);
                const moto = getMoto(job.motorcycle_id);
                const jobParts = parts.filter(p => p.repair_job_id === job.id);
                const jobServices = services.filter(s => s.repair_job_id === job.id);
                const partsTotal = jobParts.reduce((s, p) => s + p.quantity * Number(p.unit_price), 0);
                const svcsTotal = jobServices.reduce((s, sv) => s + Number(sv.price), 0);
                const laborCost = Number(job.labor_cost) || 0;
                const total = getJobTotal(job);

                return (
                  <div key={job.id} className="rounded-lg border border-border p-3 print:border-gray-200 print:break-inside-avoid">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-primary print:text-red-600">{job.job_number}</span>
                          {job.invoice_number && <span className="text-[10px] text-muted-foreground">INV: {job.invoice_number}</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground print:bg-gray-100">
                            {STATUS_LABELS[job.status] || job.status}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${job.payment_status === "paid" ? "bg-green-500/20 text-green-400 print:bg-green-50 print:text-green-700" : "bg-red-500/20 text-red-400 print:bg-red-50 print:text-red-700"}`}>
                            {job.payment_status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{job.description}</p>
                      </div>
                      <span className="text-sm font-bold text-foreground print:text-black whitespace-nowrap">£{total.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 flex-wrap">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> <strong className="text-foreground print:text-black">{cust?.name || "Unknown"}</strong></span>
                      {cust?.phone && <span>📱 {cust.phone}</span>}
                      {cust?.email && <span>✉ {cust.email}</span>}
                      {moto && <span>🏍 {moto.registration} — {moto.make} {moto.model}</span>}
                    </div>

                    <div className="flex gap-3 text-[10px] text-muted-foreground mb-2 flex-wrap">
                      <span>Received: {format(parseISO(job.received_at), "dd/MM/yyyy")}</span>
                      {job.completed_at && <span>Completed: {format(parseISO(job.completed_at), "dd/MM/yyyy")}</span>}
                      {job.payment_date && <span>Paid: {format(parseISO(job.payment_date), "dd/MM/yyyy")}</span>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {jobServices.length > 0 && (
                        <div className="rounded bg-secondary/30 p-2 print:bg-gray-50">
                          <p className="text-[10px] font-semibold text-foreground mb-1 flex items-center gap-1 print:text-black">
                            <Wrench className="h-3 w-3" /> Services ({jobServices.length})
                          </p>
                          {jobServices.map(s => (
                            <div key={s.id} className="flex justify-between text-[10px] py-0.5">
                              <span className="text-muted-foreground truncate mr-2">{s.description}</span>
                              <span className="text-foreground font-medium print:text-black">£{Number(s.price).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-[10px] font-bold border-t border-border/50 pt-1 mt-1">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="text-foreground print:text-black">£{svcsTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {jobParts.length > 0 && (
                        <div className="rounded bg-secondary/30 p-2 print:bg-gray-50">
                          <p className="text-[10px] font-semibold text-foreground mb-1 flex items-center gap-1 print:text-black">
                            <Package className="h-3 w-3" /> Parts ({jobParts.length})
                          </p>
                          {jobParts.map(p => {
                            const item = stockItems.find(s => s.id === p.stock_item_id);
                            return (
                              <div key={p.id} className="flex justify-between text-[10px] py-0.5">
                                <span className="text-muted-foreground truncate mr-2">{item?.name || "Unknown"} × {p.quantity}</span>
                                <span className="text-foreground font-medium print:text-black">£{(p.quantity * Number(p.unit_price)).toFixed(2)}</span>
                              </div>
                            );
                          })}
                          <div className="flex justify-between text-[10px] font-bold border-t border-border/50 pt-1 mt-1">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="text-foreground print:text-black">£{partsTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {laborCost > 0 && (
                      <div className="flex justify-between text-[10px] mt-1 px-2">
                        <span className="text-muted-foreground">Labour</span>
                        <span className="font-medium text-foreground print:text-black">£{laborCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* SUMMARY VIEW - simple table */
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  <th className="pb-2 pr-2">Job #</th>
                  <th className="pb-2 pr-2">Customer</th>
                  <th className="pb-2 pr-2">Vehicle</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2">Payment</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const cust = getCust(job.customer_id);
                  const moto = getMoto(job.motorcycle_id);
                  const total = getJobTotal(job);
                  return (
                    <tr key={job.id} className="border-b border-border/30">
                      <td className="py-2 pr-2 font-bold text-primary print:text-red-600 text-[11px]">{job.job_number}</td>
                      <td className="py-2 pr-2 text-foreground print:text-black">{cust?.name || "Unknown"}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{moto?.registration || "—"}</td>
                      <td className="py-2 pr-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${job.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {job.payment_status}
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold text-foreground print:text-black">£{total.toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border font-bold">
                  <td colSpan={5} className="py-2 text-foreground print:text-black">Total</td>
                  <td className="py-2 text-right text-foreground print:text-black">£{jobs.reduce((s, j) => s + getJobTotal(j), 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Motorcycle Sales */}
        {motoSales.length > 0 && (
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground mb-3 print:text-black">Motorcycle Sales ({motoSales.length})</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3 text-right">Sale Price</th>
                  <th className="pb-2 pr-3 text-right">Cost</th>
                  <th className="pb-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {motoSales.map(s => (
                  <tr key={s.id} className="border-b border-border/30">
                    <td className="py-2 pr-3 text-foreground print:text-black">{format(parseISO(s.sale_date), "dd/MM/yyyy")}</td>
                    <td className="py-2 pr-3 text-right text-foreground print:text-black">£{Number(s.sale_price).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">£{Number(s.cost_price).toFixed(2)}</td>
                    <td className="py-2 text-right font-bold text-green-400 print:text-green-700">£{(Number(s.sale_price) - Number(s.cost_price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Accessory Sales */}
        {accSales.length > 0 && (
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground mb-3 print:text-black">Accessory Sales ({accSales.length})</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {accSales.map(s => (
                  <tr key={s.id} className="border-b border-border/30">
                    <td className="py-2 pr-3 text-foreground print:text-black">{format(parseISO(s.created_at), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-2 text-right font-bold text-foreground print:text-black">£{Number(s.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 text-center text-[10px] text-muted-foreground print:text-gray-400">
          Two Wheels Motorcycles — Generated {format(new Date(), "dd/MM/yyyy HH:mm")}
        </div>
      </motion.div>
    </div>
  );
}
