import { useState, useEffect } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface OverdueItem {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
}

export function OverdueBanner() {
  const navigate = useNavigate();
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchOverdue = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: overdue } = await supabase
        .from("installments")
        .select("id, amount, due_date, plan_id")
        .eq("status", "pending")
        .lt("due_date", today);

      if (!overdue || overdue.length === 0) {
        setItems([]);
        return;
      }

      const planIds = [...new Set(overdue.map((i) => i.plan_id))];
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

      const list: OverdueItem[] = overdue.map((i) => {
        const custId = planCustomerMap[i.plan_id];
        return {
          id: i.id,
          customer_id: custId,
          customer_name: customerMap[custId] || "Unknown",
          amount: Number(i.amount),
          due_date: i.due_date,
          days_overdue: Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000),
        };
      });

      list.sort((a, b) => b.days_overdue - a.days_overdue);
      setItems(list);
    };

    fetchOverdue();
    const interval = setInterval(fetchOverdue, 60000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed || items.length === 0) return null;

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="border-b-2 border-red-500 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg"
      >
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="shrink-0"
              >
                <AlertTriangle className="h-5 w-5" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">
                  ⚠️ {items.length} overdue payment{items.length > 1 ? "s" : ""} — £{totalAmount.toFixed(2)}
                </p>
                <p className="text-[11px] opacity-90 truncate">
                  Tap to {expanded ? "hide" : "view details"}
                </p>
              </div>
              {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-full p-1.5 hover:bg-white/20"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate("/customers")}
                      className="w-full rounded-lg bg-white/15 hover:bg-white/25 px-3 py-2 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{item.customer_name}</p>
                          <p className="text-[11px] opacity-90">
                            Due {new Date(item.due_date).toLocaleDateString("en-GB")} • {item.days_overdue}d late
                          </p>
                        </div>
                        <p className="text-sm font-bold shrink-0">£{item.amount.toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
