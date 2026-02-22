import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  icon: LucideIcon;
  delay?: number;
  accent?: boolean;
  link?: string;
}

export function KPICard({ title, value, change, trend, icon: Icon, delay = 0, accent, link }: KPICardProps) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      onClick={() => link && navigate(link)}
      className={`rounded-xl border p-5 transition-all hover:scale-[1.02] ${
        link ? "cursor-pointer" : ""
      } ${
        accent
          ? "border-primary/30 bg-primary/5 glow-red"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          {change && (
            <div className="mt-2 flex items-center gap-1">
              {trend === "up" ? (
                <TrendingUp className="h-3.5 w-3.5 text-chart-green" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-primary" />
              )}
              <span className={`text-xs font-medium ${trend === "up" ? "text-chart-green" : "text-primary"}`}>
                {change}
              </span>
            </div>
          )}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${
          accent ? "bg-primary/20" : "bg-secondary"
        }`}>
          <Icon className={`h-5 w-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </div>
    </motion.div>
  );
}
