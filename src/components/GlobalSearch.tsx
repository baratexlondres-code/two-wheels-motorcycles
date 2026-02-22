import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Wrench, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

interface SearchResult {
  id: string;
  type: "customer" | "job" | "stock";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const term = `%${q}%`;
    const items: SearchResult[] = [];

    const [customers, jobs, stock] = await Promise.all([
      supabase.from("customers").select("id, name, phone, email").or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`).limit(5),
      supabase.from("repair_jobs").select("id, job_number, description, status, customers(name), motorcycles(registration, make, model)").or(`job_number.ilike.${term},description.ilike.${term}`).limit(5),
      supabase.from("stock_items").select("id, name, sku, category").or(`name.ilike.${term},sku.ilike.${term},category.ilike.${term}`).limit(5),
    ]);

    customers.data?.forEach(c => items.push({
      id: c.id, type: "customer",
      title: c.name,
      subtitle: [c.phone, c.email].filter(Boolean).join(" · "),
      icon: <User className="h-4 w-4" />,
      route: "/customers",
    }));

    jobs.data?.forEach(j => {
      const cust = j.customers as any;
      const moto = j.motorcycles as any;
      items.push({
        id: j.id, type: "job",
        title: `${j.job_number} — ${cust?.name || ""}`,
        subtitle: `${moto?.make || ""} ${moto?.model || ""} · ${j.status}`,
        icon: <Wrench className="h-4 w-4" />,
        route: "/repairs",
      });
    });

    stock.data?.forEach(s => items.push({
      id: s.id, type: "stock",
      title: s.name,
      subtitle: [s.sku, s.category].filter(Boolean).join(" · "),
      icon: <Package className="h-4 w-4" />,
      route: "/stock",
    }));

    setResults(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (r: SearchResult) => {
    navigate(r.route);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="hidden sm:flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search jobs, customers, stock..."
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-48"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
          >
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No results for "{query}"</div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onMouseDown={() => handleSelect(r)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left border-b border-border/50 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                      {r.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
