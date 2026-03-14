import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Send, Zap, Users, BarChart3, Clock,
  Play, Settings, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Loader2, Trash2
} from "lucide-react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Tab = "dashboard" | "messages" | "templates" | "campaigns" | "settings";

const WhatsAppPage = () => {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState({ total_sent: 0, delivered: 0, read: 0, failed: 0 });
  const [messages, setMessages] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [waSettings, setWaSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", message_body: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [msgRes, tplRes, campRes, settRes] = await Promise.all([
      supabase.from("whatsapp_messages").select("*, customers(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("whatsapp_templates").select("*").order("name"),
      supabase.from("whatsapp_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("whatsapp_settings").select("*"),
    ]);
    setMessages(msgRes.data || []);
    setTemplates(tplRes.data || []);
    setCampaigns(campRes.data || []);
    const sMap: Record<string, string> = {};
    settRes.data?.forEach((r: any) => { sMap[r.key] = r.value; });
    setWaSettings(sMap);

    // Compute stats from messages
    const last30 = (msgRes.data || []).filter((m: any) => {
      const d = new Date(m.created_at);
      return d > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    });
    setStats({
      total_sent: last30.filter((m: any) => m.status !== "pending").length,
      delivered: last30.filter((m: any) => m.status === "delivered").length,
      read: last30.filter((m: any) => m.status === "read").length,
      failed: last30.filter((m: any) => m.status === "failed").length,
    });
    setLoading(false);
  };

  const runTriggers = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-automation", {
        body: { action: "run_triggers" },
      });
      if (error) throw error;
      toast({ title: "Triggers executed", description: `MOT 30d: ${data.results?.mot_30 || 0}, MOT 7d: ${data.results?.mot_7 || 0}, Oil: ${data.results?.oil_change || 0}, Inactive: ${(data.results?.inactive_6m || 0) + (data.results?.inactive_12m || 0)}` });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRunning(false);
  };

  const runPromotion = async () => {
    setRunning(true);
    try {
      // Create campaign
      const { data: camp } = await supabase.from("whatsapp_campaigns").insert({
        name: `Weekly Promo - ${format(new Date(), "dd/MM/yyyy")}`,
        campaign_type: "weekly_promotion",
        status: "sending",
      }).select().single();

      const { data, error } = await supabase.functions.invoke("whatsapp-automation", {
        body: { action: "run_promotion", campaign_id: camp?.id },
      });
      if (error) throw error;
      toast({ title: "Promotion sent", description: `${data.sent} messages sent using "${data.template_used}"` });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRunning(false);
  };

  const toggleTemplate = async (id: string, active: boolean) => {
    await supabase.from("whatsapp_templates").update({ active: !active }).eq("id", id);
    loadData();
  };

  const startEditTemplate = (t: any) => {
    setEditingTemplate(t.id);
    setEditForm({ name: t.name, category: t.category, message_body: t.message_body });
  };

  const saveTemplate = async (id: string) => {
    const name = editForm.name.trim();
    const category = editForm.category.trim();
    const messageBody = editForm.message_body.trim();

    if (!name || !category || !messageBody) {
      toast({ title: "Error", description: "Please fill all template fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("whatsapp_templates").update({
      name,
      category,
      message_body: messageBody,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setEditingTemplate(null);
    toast({ title: "Template updated" });
    loadData();
  };

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return;
    await supabase.from("whatsapp_campaigns").delete().eq("id", id);
    toast({ title: "Campaign deleted" });
    loadData();
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
  };

  const updateSetting = (key: string, value: string) => {
    setWaSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    const promises = Object.entries(waSettings).map(([key, value]) =>
      supabase.from("whatsapp_settings").upsert({ key, value, updated_at: new Date().toISOString() } as any)
    );
    await Promise.all(promises);
    toast({ title: "Settings saved" });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": case "delivered": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "read": return <CheckCircle2 className="h-4 w-4 text-blue-400" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "queued": case "pending": return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "templates", label: "Templates", icon: Settings },
    { id: "campaigns", label: "Campaigns", icon: Send },
    { id: "settings", label: "Settings", icon: Zap },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading WhatsApp data...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-green-500" /> WhatsApp Marketing
            </h1>
            <p className="text-sm text-muted-foreground">Automated messaging & campaign management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={runTriggers} disabled={running}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 disabled:opacity-50 border border-border">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Run Triggers
          </button>
          <button onClick={runPromotion} disabled={running}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-700 disabled:opacity-50">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Send Promotion
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Sent (30d)", value: stats.total_sent, color: "text-foreground" },
              { label: "Delivered", value: stats.delivered, color: "text-green-500" },
              { label: "Read", value: stats.read, color: "text-blue-400" },
              { label: "Failed", value: stats.failed, color: "text-destructive" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Recent messages preview */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Recent Messages</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {messages.slice(0, 10).map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2">
                  {statusIcon(m.status)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{m.customers?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.message_body?.substring(0, 60)}...</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(m.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet</p>}
            </div>
          </div>
        </motion.div>
      )}

      {/* Messages Tab */}
      {tab === "messages" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m: any) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3">{statusIcon(m.status)}</td>
                    <td className="px-4 py-3 text-foreground">{m.customers?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.phone_number}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">{m.trigger_type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{m.message_body}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(m.created_at), "dd/MM/yy HH:mm")}</td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No messages sent yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {templates.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-4">
              {editingTemplate === t.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Name</label>
                      <input type="text" value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
                      <select value={editForm.category}
                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                        <option value="mot_reminder_30">MOT Reminder 30d</option>
                        <option value="mot_reminder_7">MOT Reminder 7d</option>
                        <option value="oil_change">Oil Change / Service</option>
                        <option value="inactive_6m">Inactive 6 months</option>
                        <option value="inactive_12m">Inactive 12 months</option>
                        <option value="promotion_free_check">Promo: Free Check</option>
                        <option value="promotion_oil">Promo: Oil Change</option>
                        <option value="promotion_brake">Promo: Brake Service</option>
                        <option value="seasonal">Seasonal</option>
                        <option value="pass_by">Pass By</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Message Body</label>
                    <textarea value={editForm.message_body}
                      onChange={e => setEditForm(f => ({ ...f, message_body: e.target.value }))}
                      rows={5}
                      className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-y" />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Variables: {"{{FirstName}}"}, {"{{FullName}}"}, {"{{VehicleModel}}"}, {"{{LicensePlate}}"}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">
                      Cancel
                    </button>
                    <button onClick={() => saveTemplate(t.id)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:brightness-110">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="mb-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`h-2 w-2 rounded-full ${t.active ? "bg-green-500" : "bg-muted-foreground"}`} />
                      <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground uppercase">{t.category}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => startEditTemplate(t)}
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:brightness-110">
                        Edit Template
                      </button>
                      <button onClick={() => toggleTemplate(t.id, t.active)}
                        className={`rounded-lg px-3 py-1 text-xs font-medium ${
                          t.active ? "bg-green-600/20 text-green-400 hover:bg-green-600/30" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}>
                        {t.active ? "Active" : "Inactive"}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{t.message_body}</p>
                  {t.variables?.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {t.variables.map((v: string) => (
                        <span key={v} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-mono">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Campaigns Tab */}
      {tab === "campaigns" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {campaigns.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No campaigns yet. Click "Send Promotion" to create one.
            </div>
          )}
          {campaigns.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.campaign_type} · {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    c.status === "sent" ? "bg-green-600/20 text-green-400" :
                    c.status === "sending" ? "bg-yellow-600/20 text-yellow-400" :
                    "bg-secondary text-muted-foreground"
                  }`}>{c.status}</span>
                  <button onClick={() => deleteCampaign(c.id, c.name)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete campaign">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {c.total_recipients != null && (
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>Recipients: {c.total_recipients}</span>
                  <span>Sent: {c.total_sent || 0}</span>
                  <span>Delivered: {c.total_delivered || 0}</span>
                  <span>Read: {c.total_read || 0}</span>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Frequency Limits</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Promo/Week</label>
                <input type="number" min="1" max="5" value={waSettings.max_promo_per_week || "1"}
                  onChange={e => updateSetting("max_promo_per_week", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Messages/Month</label>
                <input type="number" min="1" max="10" value={waSettings.max_messages_per_month || "2"}
                  onChange={e => updateSetting("max_messages_per_month", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">High Value Threshold (£)</label>
                <input type="number" min="100" value={waSettings.high_value_threshold || "500"}
                  onChange={e => updateSetting("high_value_threshold", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">WhatsApp Cloud API</h3>
            <p className="text-xs text-muted-foreground">
              Credentials are securely stored as backend secrets. Messages will be queued until credentials are configured.
            </p>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${waSettings.api_configured === "true" ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm text-muted-foreground">
                {waSettings.api_configured === "true" ? "API Connected" : "API Not Connected — messages will be queued"}
              </span>
            </div>
          </div>

          <button onClick={saveSettings}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            Save Settings
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default WhatsAppPage;
