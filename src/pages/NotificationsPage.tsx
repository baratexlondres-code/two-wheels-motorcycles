import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Send, Trash2, Filter, CreditCard, Wrench, Bike, Megaphone, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  customer_id: string | null;
  type: string;
  message: string;
  status: string;
  sent_date: string | null;
  created_at: string;
  customer_name?: string;
}

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  installment_reminder: { icon: CreditCard, label: "Installment Reminder", color: "text-chart-amber" },
  overdue_payment: { icon: CreditCard, label: "Overdue Payment", color: "text-red-400" },
  marketing: { icon: Megaphone, label: "Marketing", color: "text-chart-blue" },
  service_reminder: { icon: Wrench, label: "Service Reminder", color: "text-green-400" },
  mot_reminder: { icon: Bike, label: "MOT Reminder", color: "text-chart-amber" },
  inactive_customer: { icon: UserX, label: "Inactive Customer", color: "text-muted-foreground" },
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("type", filter);
    }

    const { data } = await query;

    // Fetch customer names
    const customerIds = [...new Set((data || []).filter((n) => n.customer_id).map((n) => n.customer_id!))];
    let customerMap: Record<string, string> = {};
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);
      customerMap = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));
    }

    setNotifications(
      (data || []).map((n) => ({
        ...n,
        customer_name: n.customer_id ? customerMap[n.customer_id] || "Unknown" : undefined,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [filter]);

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast({ title: "Notification deleted" });
  };

  const resend = async (notif: Notification) => {
    if (!notif.customer_id) return;

    // Get customer phone
    const { data: customer } = await supabase
      .from("customers")
      .select("phone")
      .eq("id", notif.customer_id)
      .single();

    if (customer?.phone) {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: customer.phone, message: notif.message }),
        });
        await supabase.from("notifications").update({ status: "sent", sent_date: new Date().toISOString() }).eq("id", notif.id);
        toast({ title: "Message resent via WhatsApp" });
        fetchNotifications();
      } catch {
        toast({ title: "Failed to send WhatsApp message" });
      }
    } else {
      toast({ title: "No phone number available" });
    }
  };

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "installment_reminder", label: "Installments" },
    { value: "overdue_payment", label: "Overdue" },
    { value: "mot_reminder", label: "MOT" },
    { value: "service_reminder", label: "Service" },
    { value: "marketing", label: "Marketing" },
    { value: "inactive_customer", label: "Inactive" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notification Center</h1>
        <p className="text-sm text-muted-foreground">Manage all customer notifications and reminders</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((opt) => (
          <button key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === opt.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No notifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notif) => {
              const config = typeConfig[notif.type] || { icon: Bell, label: notif.type, color: "text-muted-foreground" };
              const Icon = config.icon;

              return (
                <motion.div key={notif.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-primary">{config.label}</span>
                      {notif.customer_name && (
                        <span className="text-xs text-muted-foreground">• {notif.customer_name}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        notif.status === "sent" ? "bg-green-500/20 text-green-400" :
                        notif.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                        notif.status === "failed" ? "bg-red-500/20 text-red-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {notif.status}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-line line-clamp-3">{notif.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(notif.created_at).toLocaleString("en-GB")}
                      {notif.sent_date && ` • Sent: ${new Date(notif.sent_date).toLocaleString("en-GB")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {notif.customer_id && (
                      <button onClick={() => resend(notif)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Resend">
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notif.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
