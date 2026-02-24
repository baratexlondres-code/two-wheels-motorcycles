import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Building2, Lock, Clock, Percent, Save, Eye, EyeOff } from "lucide-react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/RoleContext";

const SettingsPage = () => {
  const { isOwner } = useRole();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOwnerPw, setShowOwnerPw] = useState(false);
  const [showStaffPw, setShowStaffPw] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from("workshop_settings").select("*");
    const map: Record<string, string> = {};
    data?.forEach((row: any) => { map[row.key] = row.value; });
    setSettings(map);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const promises = Object.entries(settings).map(([key, value]) =>
      supabase.from("workshop_settings").upsert({ key, value, updated_at: new Date().toISOString() } as any)
    );
    await Promise.all(promises);
    toast({ title: "Settings saved" });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Loading settings...</div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Workshop configuration and preferences</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      {/* Workshop Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Workshop Information</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workshop Name</label>
            <input value={settings.workshop_name || ""} onChange={(e) => updateSetting("workshop_name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</label>
            <input value={settings.workshop_phone || ""} onChange={(e) => updateSetting("workshop_phone", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
            <input value={settings.workshop_email || ""} onChange={(e) => updateSetting("workshop_email", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</label>
            <input value={settings.workshop_address || ""} onChange={(e) => updateSetting("workshop_address", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
        </div>
      </motion.div>

      {/* Security - Owner only */}
      {isOwner && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Security</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner Password</label>
              <div className="relative mt-1">
                <input type={showOwnerPw ? "text" : "password"} value={settings.owner_password || ""}
                  onChange={(e) => updateSetting("owner_password", e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-foreground focus:border-primary focus:outline-none" />
                <button type="button" onClick={() => setShowOwnerPw(!showOwnerPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showOwnerPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Access Password (Workshop)</label>
              <div className="relative mt-1">
                <input type={showStaffPw ? "text" : "password"} value={settings.access_password || ""}
                  onChange={(e) => updateSetting("access_password", e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-foreground focus:border-primary focus:outline-none" />
                <button type="button" onClick={() => setShowStaffPw(!showStaffPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showStaffPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Changing passwords here will take effect after saving. Make sure to remember the new passwords.
          </p>
        </motion.div>
      )}

      {/* System Preferences */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">System Preferences</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auto-Lock (minutes)</label>
            <input type="number" min="1" max="120" value={settings.auto_lock_minutes || "10"}
              onChange={(e) => updateSetting("auto_lock_minutes", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency Symbol</label>
            <input value={settings.currency || "£"} onChange={(e) => updateSetting("currency", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">VAT Rate (%)</label>
            <input type="number" min="0" max="100" value={settings.vat_rate || "20"}
              onChange={(e) => updateSetting("vat_rate", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
        </div>
      </motion.div>

      {/* Repair Status Labels */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Repair Pipeline</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Received", "Diagnosing", "Waiting Parts", "In Repair", "Ready", "Delivered"].map((status) => (
            <span key={status} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
              {status}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">These are the default repair status stages used in your workflow.</p>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground mb-2">About</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Two Wheels Motorcycles — Workshop Management System</p>
          <p>Version 1.0.0</p>
          <p className="text-xs mt-2">Private system for internal use only. All activity is logged.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
