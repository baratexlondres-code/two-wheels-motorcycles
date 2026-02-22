import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

interface AccessGateProps {
  onUnlock: () => void;
}

const AccessGate = ({ onUnlock }: AccessGateProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [accessPw, setAccessPw] = useState("twowheels2024");

  useEffect(() => {
    supabase.from("workshop_settings").select("value").eq("key", "access_password").single()
      .then(({ data }) => { if (data?.value) setAccessPw(data.value); });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === accessPw) {
      setError("");
      sessionStorage.setItem("tw_access", "granted");
      onUnlock();
    } else {
      setError("Incorrect password");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
      setPassword("");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--primary)) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, hsl(var(--primary)) 0%, transparent 50%)`,
        }} />
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md px-6">
        <motion.div
          animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-2xl"
        >
          <div className="mb-6 flex flex-col items-center">
            <img src={logo} alt="Two Wheels Motorcycles" className="mb-4 h-24 w-auto" />
            <h1 className="font-display text-xl font-bold tracking-wider text-foreground">TWO WHEELS</h1>
            <p className="mt-1 text-sm text-muted-foreground">Workshop Management System</p>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 animate-pulse-glow">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter workshop password"
                autoFocus
                className="w-full rounded-lg border border-border bg-secondary px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-sm text-primary">{error}</motion.p>
              )}
            </AnimatePresence>

            <button type="submit"
              className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-all hover:brightness-110 glow-red">
              Enter Workshop
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Private system • Authorised access only
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AccessGate;
