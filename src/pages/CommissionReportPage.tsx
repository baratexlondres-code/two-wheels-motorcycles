import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";
import { BarChart3, Users, PoundSterling, Calendar, Download } from "lucide-react";

interface MechanicReport {
  mechanic_id: string;
  mechanic_name: string;
  total_services: number;
  total_labour: number;
  total_commission: number;
}

const CommissionReportPage = () => {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<MechanicReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    // Get completed jobs in range
    const { data: jobs } = await supabase
      .from("repair_jobs")
      .select("id, completed_at")
      .in("status", ["ready", "delivered", "completed"])
      .gte("completed_at", dateFrom)
      .lte("completed_at", dateTo + "T23:59:59");

    if (!jobs || jobs.length === 0) {
      setReport([]);
      setLoading(false);
      return;
    }

    const jobIds = jobs.map((j) => j.id);

    // Get services with mechanics for those jobs
    const { data: services } = await supabase
      .from("repair_services")
      .select("*, mechanic_id")
      .in("repair_job_id", jobIds)
      .not("mechanic_id", "is", null);

    // Get mechanics
    const { data: mechanics } = await supabase.from("mechanics").select("id, full_name");

    if (!services || !mechanics) {
      setReport([]);
      setLoading(false);
      return;
    }

    const mechanicMap = new Map(mechanics.map((m) => [m.id, m.full_name]));
    const grouped = new Map<string, MechanicReport>();

    for (const svc of services) {
      const mid = svc.mechanic_id;
      if (!mid) continue;
      const existing = grouped.get(mid) || {
        mechanic_id: mid,
        mechanic_name: mechanicMap.get(mid) || "Unknown",
        total_services: 0,
        total_labour: 0,
        total_commission: 0,
      };
      existing.total_services += 1;
      existing.total_labour += Number(svc.price) || 0;
      existing.total_commission += Number((svc as any).commission_value) || 0;
      grouped.set(mid, existing);
    }

    setReport(Array.from(grouped.values()).sort((a, b) => b.total_commission - a.total_commission));
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [dateFrom, dateTo]);

  const grandTotalLabour = report.reduce((s, r) => s + r.total_labour, 0);
  const grandTotalCommission = report.reduce((s, r) => s + r.total_commission, 0);
  const totalServices = report.reduce((s, r) => s + r.total_services, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Commission Report</h1>
            <p className="text-sm text-muted-foreground">Mechanic commissions from completed jobs</p>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground [color-scheme:dark]" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground [color-scheme:dark]" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Users className="h-4 w-4" /> Total Services
          </div>
          <p className="text-2xl font-bold text-foreground">{totalServices}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <PoundSterling className="h-4 w-4" /> Total Labour
          </div>
          <p className="text-2xl font-bold text-foreground">£{grandTotalLabour.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <BarChart3 className="h-4 w-4" /> Total Commission
          </div>
          <p className="text-2xl font-bold text-primary">£{grandTotalCommission.toFixed(2)}</p>
        </div>
      </div>

      {/* Report Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : report.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No completed jobs with assigned mechanics in this period.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Mechanic</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Services</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Labour (£)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Commission (£)</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <motion.tr key={r.mechanic_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-t border-border/50 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium text-foreground">{r.mechanic_name}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{r.total_services}</td>
                    <td className="px-4 py-3 text-right text-foreground">£{r.total_labour.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">£{r.total_commission.toFixed(2)}</td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/30">
                  <td className="px-4 py-3 font-bold text-foreground">Total</td>
                  <td className="px-4 py-3 text-center font-bold text-foreground">{totalServices}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">£{grandTotalLabour.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">£{grandTotalCommission.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionReportPage;
