import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PoundSterling, Wrench, Bike, ShoppingCart,
  Package, AlertTriangle, Clock, CheckCircle, TrendingUp,
} from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { useRole } from "@/contexts/RoleContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface VehicleStats {
  topBrand: string;
  topModel: string;
  topCategory: string;
  brandCounts: { name: string; count: number }[];
}

const statusColors: Record<string, string> = {
  "In Progress": "bg-chart-blue/20 text-chart-blue",
  "Waiting Parts": "bg-chart-amber/20 text-chart-amber",
  "Completed": "bg-chart-green/20 text-chart-green",
  "Ready": "bg-chart-green/20 text-chart-green",
  "Received": "bg-muted text-muted-foreground",
};

const Dashboard = () => {
  const { isOwner } = useRole();
  const navigate = useNavigate();
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [jobCounts, setJobCounts] = useState({ active: 0, waitingParts: 0, completedToday: 0, lowStock: 0, total: 0 });
  const [vehicleStats, setVehicleStats] = useState<VehicleStats>({ topBrand: "—", topModel: "—", topCategory: "—", brandCounts: [] });
  const [financials, setFinancials] = useState({ todayRevenue: 0, monthRevenue: 0, unpaidTotal: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";

      const [{ data: jobs }, { data: stock }, { data: motorcycles }, { data: repairParts }, { data: repairServices }, { data: motoSales }, { data: accSales }] = await Promise.all([
        supabase.from("repair_jobs").select("*, customers(name), motorcycles(registration, make, model)").order("created_at", { ascending: false }).limit(100),
        supabase.from("stock_items").select("name, quantity, min_quantity").lt("quantity", 10).order("quantity"),
        supabase.from("motorcycles").select("make, model"),
        supabase.from("repair_parts").select("repair_job_id, quantity, unit_price"),
        supabase.from("repair_services").select("repair_job_id, price"),
        supabase.from("motorcycle_sales").select("sale_price, cost_price, sale_date").gte("sale_date", monthStart),
        supabase.from("accessory_sales").select("total, created_at").gte("created_at", monthStart),
      ]);

      // Recent jobs
      const mapped = (jobs || []).slice(0, 5).map((j: any) => ({
        id: j.job_number, customer: j.customers?.name || "Unknown",
        vehicle: `${j.motorcycles?.make || ""} ${j.motorcycles?.model || ""}`,
        registration: j.motorcycles?.registration || "", status: j.status,
      }));
      setRecentJobs(mapped);

      // Low stock
      const low = (stock || []).filter((s: any) => s.quantity <= s.min_quantity).slice(0, 5);
      setLowStockItems(low.map((s: any) => ({ name: s.name, qty: s.quantity, min: s.min_quantity })));

      // Counts
      const allJobs = jobs || [];
      setJobCounts({
        total: allJobs.length,
        active: allJobs.filter((j: any) => !["delivered", "cancelled"].includes(j.status)).length,
        waitingParts: allJobs.filter((j: any) => j.status === "waiting_parts").length,
        completedToday: allJobs.filter((j: any) => j.completed_at?.startsWith(today)).length,
        lowStock: low.length,
      });

      // Vehicle stats
      const motos = motorcycles || [];
      const brandMap: Record<string, number> = {};
      const modelMap: Record<string, number> = {};
      motos.forEach((m: any) => {
        brandMap[m.make] = (brandMap[m.make] || 0) + 1;
        modelMap[`${m.make} ${m.model}`] = (modelMap[`${m.make} ${m.model}`] || 0) + 1;
      });
      const sortedBrands = Object.entries(brandMap).sort((a, b) => b[1] - a[1]);
      const sortedModels = Object.entries(modelMap).sort((a, b) => b[1] - a[1]);
      setVehicleStats({
        topBrand: sortedBrands[0]?.[0] || "—", topModel: sortedModels[0]?.[0] || "—",
        topCategory: "—", brandCounts: sortedBrands.slice(0, 5).map(([name, count]) => ({ name, count })),
      });

      // Financials (owner only data)
      const allParts = repairParts || [];
      const allServices = repairServices || [];
      const getJobTotal = (j: any) => {
        const jp = allParts.filter((p: any) => p.repair_job_id === j.id);
        const pt = jp.reduce((s: number, p: any) => s + p.quantity * Number(p.unit_price), 0);
        const js = allServices.filter((sv: any) => sv.repair_job_id === j.id);
        const st = js.reduce((s: number, sv: any) => s + Number(sv.price), 0);
        const labor = Number(j.labor_cost) || 0;
        const calc = pt + st + labor;
        if (Number(j.final_cost) > 0) return Number(j.final_cost);
        if (calc > 0) return calc;
        return Number(j.estimated_cost) || 0;
      };

      // Today's repair revenue
      const todayPaidRepairs = allJobs.filter((j: any) => j.payment_status === "paid" && j.payment_date?.startsWith(today));
      const todayRepairRev = todayPaidRepairs.reduce((s: number, j: any) => s + getJobTotal(j), 0);
      const todayMotoRev = (motoSales || []).filter((s: any) => s.sale_date?.startsWith(today)).reduce((s: number, m: any) => s + Number(m.sale_price), 0);
      const todayAccRev = (accSales || []).filter((s: any) => s.created_at?.startsWith(today)).reduce((s: number, a: any) => s + Number(a.total), 0);

      // Month revenue
      const monthPaidRepairs = allJobs.filter((j: any) => j.payment_status === "paid" && j.payment_date && j.payment_date >= monthStart);
      const monthRepairRev = monthPaidRepairs.reduce((s: number, j: any) => s + getJobTotal(j), 0);
      const monthMotoRev = (motoSales || []).reduce((s: number, m: any) => s + Number(m.sale_price), 0);
      const monthAccRev = (accSales || []).reduce((s: number, a: any) => s + Number(a.total), 0);

      // Unpaid
      const unpaid = allJobs.filter((j: any) => j.payment_status !== "paid" && !["cancelled"].includes(j.status))
        .reduce((s: number, j: any) => s + getJobTotal(j), 0);

      setFinancials({
        todayRevenue: todayRepairRev + todayMotoRev + todayAccRev,
        monthRevenue: monthRepairRev + monthMotoRev + monthAccRev,
        unpaidTotal: unpaid,
      });

      setLoading(false);
    };
    fetchDashboard();
  }, []);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      received: "Received", diagnosing: "Diagnosing", waiting_parts: "Waiting Parts",
      in_repair: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isOwner ? "Owner Dashboard" : "Workshop Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isOwner ? "Welcome back — here's your business overview" : "Welcome back — here are your active jobs"}
        </p>
      </div>

      {/* Owner Financial KPIs */}
      {isOwner && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-chart-green/30 bg-chart-green/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <PoundSterling className="h-5 w-5 text-chart-green" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Today's Revenue</span>
            </div>
            <p className="text-2xl font-bold text-foreground">£{financials.todayRevenue.toFixed(2)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl border border-chart-blue/30 bg-chart-blue/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-chart-blue" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">This Month</span>
            </div>
            <p className="text-2xl font-bold text-foreground">£{financials.monthRevenue.toFixed(2)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-xl border border-chart-amber/30 bg-chart-amber/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-chart-amber" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Unpaid Jobs</span>
            </div>
            <p className="text-2xl font-bold text-foreground">£{financials.unpaidTotal.toFixed(2)}</p>
          </motion.div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Active Jobs" value={String(jobCounts.active)} icon={Wrench} delay={0} accent link="/repairs" />
        <KPICard title="Waiting Parts" value={String(jobCounts.waitingParts)} icon={Clock} delay={0.05} link="/repairs" />
        <KPICard title="Completed Today" value={String(jobCounts.completedToday)} icon={CheckCircle} delay={0.1} link="/repairs" />
        <KPICard title="Low Stock Items" value={String(jobCounts.lowStock)} icon={AlertTriangle} delay={0.15} link="/stock" />
      </div>

      {/* Vehicle Stats (owner only) */}
      {isOwner && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Most Repaired Brand</p>
            <p className="text-xl font-bold text-foreground">{vehicleStats.topBrand}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Most Repaired Model</p>
            <p className="text-xl font-bold text-foreground">{vehicleStats.topModel}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Top Brands</p>
            <div className="space-y-1 mt-1">
              {vehicleStats.brandCounts.map((b) => (
                <div key={b.name} className="flex justify-between text-sm">
                  <span className="text-foreground">{b.name}</span>
                  <span className="text-muted-foreground">{b.count}</span>
                </div>
              ))}
              {vehicleStats.brandCounts.length === 0 && <p className="text-xs text-muted-foreground">No data yet</p>}
            </div>
          </motion.div>
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Jobs</h2>
            <span className="text-xs text-muted-foreground">{jobCounts.active} active jobs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4">Job ID</th><th className="pb-3 pr-4">Customer</th>
                  <th className="pb-3 pr-4">Vehicle</th><th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} onClick={() => navigate("/repairs")}
                    className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs text-primary">{job.id}</td>
                    <td className="py-3 pr-4 text-foreground">{job.customer}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{job.vehicle}</td>
                    <td className="py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[statusLabel(job.status)] || "bg-muted text-muted-foreground"}`}>
                        {statusLabel(job.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentJobs.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">No jobs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-xl border border-primary/20 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Low Stock Alerts</h2>
          </div>
          <div className="space-y-3">
            {lowStockItems.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Min level: {item.min}</p>
                </div>
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {item.qty} left
                </span>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">All stock levels OK</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "New Repair Job", icon: Wrench, path: "/repairs" },
          { label: "Add Motorcycle", icon: Bike, path: "/sales", ownerOnly: true },
          { label: "POS Sale", icon: ShoppingCart, path: "/accessories" },
          { label: "Quick Invoice", icon: CheckCircle, path: "/invoices", ownerOnly: true },
        ].filter((a) => !a.ownerOnly || isOwner).map((action) => (
          <button key={action.label} onClick={() => navigate(action.path)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/5">
            <action.icon className="h-5 w-5 text-primary" />
            {action.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default Dashboard;
