import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Plus, Check, Bell, ChevronDown, ChevronUp } from "lucide-react";

interface InstallmentPlan {
  id: string;
  customer_id: string;
  repair_job_id: string | null;
  invoice_number: string | null;
  total_amount: number;
  deposit: number;
  remaining_balance: number;
  status: string;
  created_at: string;
}

interface Installment {
  id: string;
  plan_id: string;
  amount: number;
  due_date: string;
  status: string;
  paid_date: string | null;
}

interface InstallmentDraft {
  amount: string;
  dueDate: string;
}

interface Props {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-green-500/20 text-green-400",
  overdue: "bg-red-500/20 text-red-400",
};

const parseMoneyInput = (value: string) => {
  if (!value || typeof value !== "string") return 0;
  const normalized = value.replace(/[^0-9.,\-]/g, "").replace(",", ".").trim();
  const result = Number.parseFloat(normalized);
  return Number.isNaN(result) ? 0 : result;
};

const getSafeStartDate = (startDate: string) => {
  const parsed = new Date(startDate);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
};

const buildDefaultInstallmentDrafts = (count: number, startDate: string, remaining: number): InstallmentDraft[] => {
  if (count <= 0) return [];

  const safeRemaining = Math.max(0, remaining);
  const baseAmount = Math.floor((safeRemaining / count) * 100) / 100;
  const baseDate = getSafeStartDate(startDate);

  return Array.from({ length: count }, (_, index) => {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + index * 7);

    const amount = index === count - 1
      ? Math.round((safeRemaining - baseAmount * (count - 1)) * 100) / 100
      : baseAmount;

    return {
      amount: amount.toFixed(2),
      dueDate: dueDate.toISOString().split("T")[0],
    };
  });
};

export default function InstallmentPlansSection({ customerId, customerName, customerPhone }: Props) {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({});
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create form
  const [totalAmount, setTotalAmount] = useState("");
  const [deposit, setDeposit] = useState("");
  const [numInstallments, setNumInstallments] = useState("2");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [installmentDrafts, setInstallmentDrafts] = useState<InstallmentDraft[]>([]);

  const fetchPlans = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("installment_plans")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    setPlans(data || []);

    // Fetch installments for all plans
    if (data && data.length > 0) {
      const planIds = data.map((p) => p.id);
      const { data: inst } = await supabase
        .from("installments")
        .select("*")
        .in("plan_id", planIds)
        .order("due_date");
      const grouped: Record<string, Installment[]> = {};
      (inst || []).forEach((i) => {
        if (!grouped[i.plan_id]) grouped[i.plan_id] = [];
        grouped[i.plan_id].push(i);
      });
      setInstallments(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, [customerId]);

  useEffect(() => {
    const num = Math.min(12, Math.max(1, parseInt(numInstallments) || 1));
    const total = parseMoneyInput(totalAmount) || 0;
    const dep = parseMoneyInput(deposit) || 0;
    const remaining = total - dep;

    setInstallmentDrafts(buildDefaultInstallmentDrafts(num, startDate, remaining));
  }, [numInstallments, startDate, totalAmount, deposit]);

  const updateInstallmentDraft = (index: number, field: keyof InstallmentDraft, value: string) => {
    setInstallmentDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, [field]: value } : draft)));
  };

  const handleCreate = async () => {
    const total = parseMoneyInput(totalAmount);
    const dep = parseMoneyInput(deposit);
    const num = Math.min(12, Math.max(1, parseInt(numInstallments) || 1));

    if (total <= 0) {
      toast({ title: "Invalid total amount", description: `Please enter a value greater than 0. Current: "${totalAmount}"` });
      return;
    }

    if (dep >= total) {
      toast({ title: "Deposit must be less than total" });
      return;
    }

    if (installmentDrafts.length !== num) {
      toast({ title: "Please review installment breakdown" });
      return;
    }

    const remaining = total - dep;

    const parsedInstallments = installmentDrafts.map((draft, index) => ({
      index,
      amount: parseMoneyInput(draft.amount),
      due_date: draft.dueDate,
    }));

    const hasInvalidInstallment = parsedInstallments.some(
      (row) => !row.amount || Number.isNaN(row.amount) || row.amount <= 0 || !row.due_date,
    );

    if (hasInvalidInstallment) {
      toast({ title: "Each installment needs a valid amount and due date" });
      return;
    }

    const scheduleTotal = parsedInstallments.reduce((sum, row) => sum + row.amount, 0);
    if (Math.abs(scheduleTotal - remaining) > 0.01) {
      toast({
        title: "Installments must match remaining balance",
        description: `Remaining £${remaining.toFixed(2)} vs installments £${scheduleTotal.toFixed(2)}`,
      });
      return;
    }

    // Create plan
    const { data: plan, error } = await supabase
      .from("installment_plans")
      .insert({
        customer_id: customerId,
        total_amount: total,
        deposit: dep,
        remaining_balance: remaining,
        invoice_number: invoiceNumber || null,
        status: "active",
      })
      .select()
      .single();

    if (error || !plan) {
      toast({ title: "Error creating plan", description: error?.message });
      return;
    }

    // Create installments
    const installmentRows = parsedInstallments.map((row) => ({
      plan_id: plan.id,
      amount: Math.round(row.amount * 100) / 100,
      due_date: row.due_date,
      status: "pending",
    }));

    const { error: installmentsError } = await supabase.from("installments").insert(installmentRows);

    if (installmentsError) {
      toast({ title: "Error creating installments", description: installmentsError.message });
      return;
    }

    toast({ title: "Installment plan created" });
    setShowCreate(false);
    setTotalAmount("");
    setDeposit("");
    setNumInstallments("2");
    setInvoiceNumber("");
    fetchPlans();
  };

  const markAsPaid = async (installment: Installment, plan: InstallmentPlan) => {
    await supabase
      .from("installments")
      .update({ status: "paid", paid_date: new Date().toISOString() })
      .eq("id", installment.id);

    const newBalance = Math.max(0, plan.remaining_balance - installment.amount);
    const updateData: { remaining_balance: number; status?: string } = { remaining_balance: newBalance };
    if (newBalance <= 0) updateData.status = "completed";

    await supabase.from("installment_plans").update(updateData).eq("id", plan.id);

    toast({ title: `Payment of £${installment.amount.toFixed(2)} recorded` });
    fetchPlans();
  };

  const sendReminder = async (installment: Installment) => {
    const message = `Hello ${customerName}\n\nReminder from Two Wheels Motorcycles.\nYou have a payment of £${installment.amount.toFixed(2)} due on ${new Date(installment.due_date).toLocaleDateString("en-GB")}.\n\nThank you.`;

    // Create notification record
    await supabase.from("notifications").insert({
      customer_id: customerId,
      type: "installment_reminder",
      message,
      status: "sent",
      sent_date: new Date().toISOString(),
      reference_id: installment.id,
    });

    // Try WhatsApp if phone available
    if (customerPhone) {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: customerPhone, message }),
        });
        toast({ title: "Reminder sent via WhatsApp" });
      } catch {
        toast({ title: "Reminder saved (WhatsApp unavailable)" });
      }
    } else {
      toast({ title: "Reminder saved (no phone number)" });
    }
  };

  if (loading) return null;

  const totalPreview = parseMoneyInput(totalAmount) || 0;
  const depositPreview = parseMoneyInput(deposit) || 0;
  const remainingPreview = Math.max(0, totalPreview - depositPreview);
  const schedulePreviewTotal = installmentDrafts.reduce((sum, row) => sum + (parseMoneyInput(row.amount) || 0), 0);
  const hasScheduleMismatch = Math.abs(schedulePreviewTotal - remainingPreview) > 0.01;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CreditCard className="h-5 w-5 text-primary" /> Installment Plans ({plans.length})
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Create Plan
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="border-b border-border p-4 space-y-3 bg-secondary/30">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Total Amount (£)</label>
              <input
                type="text"
                inputMode="decimal"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="250.00"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Deposit (£)</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="100.00"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Number of Installments</label>
              <input
                type="number"
                value={numInstallments}
                onChange={(e) => setNumInstallments(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                min="1"
                max="12"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">First Payment Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Invoice Number (optional)</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="INV-00001"
              />
            </div>
          </div>

          {installmentDrafts.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Set each installment amount and date:</p>
              </div>

              <div className="space-y-2">
                {installmentDrafts.map((draft, index) => (
                  <div key={`installment-draft-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Installment {index + 1} Amount (£)</label>
                      <input
                        type="number"
                        value={draft.amount}
                        onChange={(e) => updateInstallmentDraft(index, "amount", e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Installment {index + 1} Due Date</label>
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(e) => updateInstallmentDraft(index, "dueDate", e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-foreground">Total: <strong>£{totalPreview.toFixed(2)}</strong></p>
                <p className="text-foreground">Deposit: <strong>£{depositPreview.toFixed(2)}</strong></p>
                <p className="text-foreground">Remaining: <strong>£{remainingPreview.toFixed(2)}</strong></p>
                <p className="text-foreground">Installments sum: <strong>£{schedulePreviewTotal.toFixed(2)}</strong></p>
                {hasScheduleMismatch && (
                  <p className="text-xs text-destructive">Installments must equal the remaining balance.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
              Create Plan
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plans list */}
      <div className="divide-y divide-border">
        {plans.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No installment plans</p>
        ) : plans.map((plan) => {
          const planInstallments = installments[plan.id] || [];
          const isExpanded = expandedPlan === plan.id;

          return (
            <div key={plan.id}>
              <button
                onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      £{plan.total_amount.toFixed(2)}
                      {plan.invoice_number && <span className="text-muted-foreground ml-2 text-xs">({plan.invoice_number})</span>}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      plan.status === "completed" ? "bg-green-500/20 text-green-400" :
                        plan.status === "active" ? "bg-blue-500/20 text-blue-400" :
                          "bg-muted text-muted-foreground"
                    }`}>
                      {plan.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deposit: £{plan.deposit.toFixed(2)} • Remaining: £{plan.remaining_balance.toFixed(2)} • {new Date(plan.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {planInstallments.map((inst, idx) => (
                    <div key={inst.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">£{inst.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(inst.due_date).toLocaleDateString("en-GB")}
                            {inst.paid_date && ` • Paid: ${new Date(inst.paid_date).toLocaleDateString("en-GB")}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[inst.status] || "bg-muted text-muted-foreground"}`}>
                          {inst.status}
                        </span>
                        {inst.status !== "paid" && (
                          <>
                            <button
                              onClick={() => markAsPaid(inst, plan)}
                              className="flex items-center gap-1 rounded-md bg-green-600/20 px-2 py-1 text-xs text-green-400 hover:bg-green-600/30"
                            >
                              <Check className="h-3 w-3" /> Paid
                            </button>
                            <button
                              onClick={() => sendReminder(inst)}
                              className="flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-xs text-primary hover:bg-primary/30"
                            >
                              <Bell className="h-3 w-3" /> Remind
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
