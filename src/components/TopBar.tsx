import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Wrench, Package, FileText, X } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

interface Notification {
  id: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  type: "warning" | "info" | "success";
  link?: string;
}

export function TopBar() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications from real data
  useEffect(() => {
    const fetchNotifications = async () => {
      const notifs: Notification[] = [];

      // Low stock items
      const { data: lowStock } = await supabase
        .from("stock_items")
        .select("id, name, quantity, min_quantity")
        .filter("quantity", "lte", "min_quantity" as any);

      // We need to do this client-side since we can't compare columns directly
      const { data: allStock } = await supabase.from("stock_items").select("id, name, quantity, min_quantity");
      if (allStock) {
        allStock.filter(s => s.quantity <= s.min_quantity && s.min_quantity > 0).forEach(s => {
          notifs.push({
            id: `stock-${s.id}`,
            icon: <Package className="h-4 w-4" />,
            title: "Low Stock",
            message: `${s.name} — only ${s.quantity} left (min: ${s.min_quantity})`,
            type: "warning",
            link: "/stock",
          });
        });
      }

      // Pending repair jobs (received/diagnosing)
      const { data: pendingJobs } = await supabase
        .from("repair_jobs")
        .select("id, job_number, status, description")
        .in("status", ["received", "diagnosing"])
        .limit(5);

      pendingJobs?.forEach(j => {
        notifs.push({
          id: `job-${j.id}`,
          icon: <Wrench className="h-4 w-4" />,
          title: `Job ${j.job_number}`,
          message: `Status: ${j.status} — ${j.description.substring(0, 40)}`,
          type: "info",
          link: "/repairs",
        });
      });

      // Unpaid invoices
      const { data: unpaid } = await supabase
        .from("repair_jobs")
        .select("id, job_number, invoice_number, estimated_cost")
        .eq("payment_status", "unpaid")
        .not("invoice_number", "is", null)
        .limit(5);

      unpaid?.forEach(j => {
        notifs.push({
          id: `inv-${j.id}`,
          icon: <FileText className="h-4 w-4" />,
          title: `Unpaid: ${j.invoice_number}`,
          message: `Job ${j.job_number} — £${(Number(j.estimated_cost) || 0).toFixed(2)}`,
          type: "warning",
          link: "/invoices",
        });
      });

      setNotifications(notifs);
    };

    fetchNotifications();
    // Refresh notifications every 30 seconds to catch new changes
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const visible = notifications.filter(n => !dismissed.has(n.id));
  const count = visible.length;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative" ref={ref}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="relative text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  {count > 0 && (
                    <span className="text-xs text-muted-foreground">{count} active</span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Bell className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">All caught up!</p>
                    </div>
                  ) : (
                    visible.map((n) => (
                      <div key={n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (n.link) {
                            navigate(n.link);
                            setOpen(false);
                          }
                        }}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${n.link ? "cursor-pointer" : ""}`}>
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          n.type === "warning" ? "bg-chart-amber/20 text-chart-amber" :
                          n.type === "success" ? "bg-chart-green/20 text-chart-green" :
                          "bg-primary/20 text-primary"
                        }`}>
                          {n.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-right">
          <p className="font-display text-sm font-semibold tracking-wider text-foreground">
            {time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {time.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          TW
        </div>
      </div>
    </header>
  );
}
