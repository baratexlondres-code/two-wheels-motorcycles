import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, AlertTriangle, Bell, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InstallmentRow {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  plan_id: string;
  customer_name: string;
  customer_id: string;
}

export function OutstandingInstallmentsWidget() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InstallmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAhead = new Date();
      weekAhead.setDate(weekAhead.getDate() + 7);
      const weekEnd = weekAhead.toISOString().split("T")[0];

      const { data: installments } = await supabase
        .from("installments")
        .select("id, amount, due_date, status, plan_id")
        .in("status", ["pending", "overdue"])
        .lte("due_date", weekEnd)
        .order("due_date");

      if (!installments || installments.length === 0) { setItems([]); setLoading(false); return; }

      const planIds = [...new Set(installments.map((i) => i.plan_id))];
      const { data: plans } = await supabase
        .from("installment_plans")
        .select("id, customer_id")
        .in("id", planIds);

      const customerIds = [...new Set((plans || []).map((p) => p.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      const customerMap = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));
      const planCustomerMap = Object.fromEntries((plans || []).map((p) => [p.id, p.customer_id]));

      const rows: InstallmentRow[] = installments.map((i) => ({
        ...i,
        customer_id: planCustomerMap[i.plan_id] || "",
        customer_name: customerMap[planCustomerMap[i.plan_id] || ""] || "Unknown",
      }));

      setItems(rows);
      setLoading(false);
    };
    fetch();
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const overdue = items.filter((i) => i.status === "overdue" || i.due_date < today);
  const dueToday = items.filter((i) => i.due_date === today && i.status !== "overdue");
  const dueTomorrow = items.filter((i) => i.due_date === tomorrowStr && i.status !== "overdue");
  const dueThisWeek = items.filter((i) => i.due_date > tomorrowStr && i.status !== "overdue");

  if (loading || items.length === 0) return null;

  const Section = ({ title, rows, color }: { title: string; rows: InstallmentRow[]; color: string }) => {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</p>
        {rows.map((r) => (
          <button key={r.id} onClick={() => navigate(`/customers?id=${r.customer_id}`)}
            className="flex w-full items-center justify-between rounded-lg bg-secondary/50 p-2.5 text-left hover:bg-secondary transition-colors">
            <span className="text-sm text-foreground">{r.customer_name}</span>
            <span className="text-sm font-semibold text-foreground">£{r.amount.toFixed(2)}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
      className="rounded-xl border border-chart-amber/20 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-chart-amber" />
        <h2 className="text-lg font-semibold text-foreground">Outstanding Installments</h2>
        <span className="ml-auto text-xs text-muted-foreground">{items.length} payments</span>
      </div>
      <div className="space-y-3">
        <Section title="Overdue" rows={overdue} color="text-red-400" />
        <Section title="Due Today" rows={dueToday} color="text-chart-amber" />
        <Section title="Due Tomorrow" rows={dueTomorrow} color="text-chart-blue" />
        <Section title="Due This Week" rows={dueThisWeek} color="text-muted-foreground" />
      </div>
    </motion.div>
  );
}

export function CustomerDebtWidget() {
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<{ customer_id: string; name: string; total_due: number; next_date: string; status: string }[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data: plans } = await supabase
        .from("installment_plans")
        .select("id, customer_id, remaining_balance")
        .eq("status", "active");

      if (!plans || plans.length === 0) return;

      const customerIds = [...new Set(plans.map((p) => p.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      const planIds = plans.map((p) => p.id);
      const { data: installments } = await supabase
        .from("installments")
        .select("plan_id, due_date, status")
        .in("plan_id", planIds)
        .in("status", ["pending", "overdue"])
        .order("due_date");

      const customerMap = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));

      // Group by customer
      const customerDebts: Record<string, { total: number; nextDate: string; hasOverdue: boolean }> = {};
      plans.forEach((p) => {
        if (!customerDebts[p.customer_id]) {
          customerDebts[p.customer_id] = { total: 0, nextDate: "9999-12-31", hasOverdue: false };
        }
        customerDebts[p.customer_id].total += p.remaining_balance;
      });

      (installments || []).forEach((i) => {
        const plan = plans.find((p) => p.id === i.plan_id);
        if (plan && customerDebts[plan.customer_id]) {
          if (i.due_date < customerDebts[plan.customer_id].nextDate) {
            customerDebts[plan.customer_id].nextDate = i.due_date;
          }
          if (i.status === "overdue") customerDebts[plan.customer_id].hasOverdue = true;
        }
      });

      const today = new Date().toISOString().split("T")[0];
      const rows = Object.entries(customerDebts).map(([cid, d]) => ({
        customer_id: cid,
        name: customerMap[cid] || "Unknown",
        total_due: d.total,
        next_date: d.nextDate === "9999-12-31" ? "-" : d.nextDate,
        status: d.hasOverdue ? "overdue" : d.nextDate <= today ? "due" : "pending",
      })).sort((a, b) => {
        if (a.status === "overdue" && b.status !== "overdue") return -1;
        if (b.status === "overdue" && a.status !== "overdue") return 1;
        return b.total_due - a.total_due;
      });

      setDebtors(rows);
      setTotalOutstanding(rows.reduce((s, r) => s + r.total_due, 0));
    };
    fetch();
  }, []);

  if (debtors.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
      className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Outstanding Payments</h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{debtors.length} customers</p>
          <p className="text-sm font-bold text-foreground">£{totalOutstanding.toFixed(2)}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Amount Due</th>
              <th className="pb-2 pr-3">Next Payment</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {debtors.slice(0, 5).map((d) => (
              <tr key={d.customer_id} onClick={() => navigate(`/customers?id=${d.customer_id}`)}
                className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors">
                <td className="py-2.5 pr-3 text-foreground">{d.name}</td>
                <td className="py-2.5 pr-3 font-semibold text-foreground">£{d.total_due.toFixed(2)}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {d.next_date !== "-" ? new Date(d.next_date).toLocaleDateString("en-GB") : "-"}
                </td>
                <td className="py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.status === "overdue" ? "bg-red-500/20 text-red-400" :
                    d.status === "due" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-green-500/20 text-green-400"
                  }`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
