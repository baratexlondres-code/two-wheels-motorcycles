import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, MapPin, Bike, Trash2, Edit2, StickyNote, Wrench, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

interface Motorcycle {
  id: string;
  customer_id: string;
  registration: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  vin: string | null;
  notes: string | null;
}

interface RepairJob {
  id: string;
  job_number: string;
  description: string;
  status: string;
  created_at: string;
  motorcycle_id: string;
  estimated_cost: number | null;
  final_cost: number | null;
  payment_status: string;
}

interface CustomerDetailViewProps {
  customer: Customer;
  onBack: () => void;
  onEdit: (customer: Customer) => void;
  onRefresh: () => void;
}

const CustomerDetailView = ({ customer, onBack, onEdit, onRefresh }: CustomerDetailViewProps) => {
  const navigate = useNavigate();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [repairs, setRepairs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    setLoading(true);
    const [{ data: motos }, { data: jobs }] = await Promise.all([
      supabase.from("motorcycles").select("*").eq("customer_id", customer.id),
      supabase.from("repair_jobs").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
    ]);
    setMotorcycles(motos || []);
    setRepairs(jobs || []);
    setLoading(false);
  };

  useEffect(() => { fetchDetails(); }, [customer.id]);

  const getMotoName = (motoId: string) => {
    const m = motorcycles.find((x) => x.id === motoId);
    return m ? `${m.make} ${m.model} (${m.registration})` : "Unknown";
  };

  const statusColors: Record<string, string> = {
    received: "bg-blue-500/20 text-blue-400",
    diagnosed: "bg-yellow-500/20 text-yellow-400",
    "in-progress": "bg-orange-500/20 text-orange-400",
    completed: "bg-green-500/20 text-green-400",
    delivered: "bg-muted text-muted-foreground",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={() => onEdit(customer)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors sm:hidden">
            <Edit2 className="h-4 w-4" /> Edit
          </button>
        </div>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold shrink-0">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{customer.name}</h1>
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-muted-foreground">
              {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
              {customer.address && <span className="flex items-center gap-1 hidden sm:flex"><MapPin className="h-3.5 w-3.5" />{customer.address}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
              const moto = motorcycles[0]; // pre-select first motorcycle if available
              const params = new URLSearchParams({ customer_id: customer.id });
              if (moto) params.set("motorcycle_id", moto.id);
              navigate(`/repairs?${params.toString()}`);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" /> New Repair
          </button>
          <button onClick={() => onEdit(customer)} className="hidden sm:flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <Edit2 className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <StickyNote className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{customer.notes}</p>
        </div>
      )}

      {/* Motorcycles Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Bike className="h-5 w-5 text-primary" /> Motorcycles ({motorcycles.length})
          </h2>
        </div>

        <div className="divide-y divide-border">
          {motorcycles.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No motorcycles registered</p>
          ) : motorcycles.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-foreground">{m.make} {m.model} {m.year && `(${m.year})`}</p>
                <p className="text-xs text-muted-foreground">Reg: {m.registration} {m.color && `• ${m.color}`} {m.vin && `• VIN: ${m.vin}`}</p>
                {m.notes && <p className="mt-1 text-xs text-muted-foreground italic">{m.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Repair History */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Wrench className="h-5 w-5 text-primary" /> Repair History ({repairs.length})
          </h2>
        </div>
        <div className="divide-y divide-border">
          {repairs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No repair history</p>
          ) : repairs.map((r) => (
          <button key={r.id} type="button" onClick={() => navigate(`/repairs?job_id=${r.id}`)} className="flex w-full items-center justify-between p-4 cursor-pointer hover:bg-secondary/50 active:bg-secondary/70 transition-colors text-left">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-primary hover:underline">#{r.job_number}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || "bg-muted text-muted-foreground"}`}>
                    {r.status}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {r.payment_status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{r.description}</p>
                <p className="text-xs text-muted-foreground">{getMotoName(r.motorcycle_id)} • {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right text-sm">
                {r.final_cost != null ? (
                  <p className="font-semibold text-foreground">£{r.final_cost.toFixed(2)}</p>
                ) : r.estimated_cost != null ? (
                  <p className="text-muted-foreground">£{r.estimated_cost.toFixed(2)}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default CustomerDetailView;
