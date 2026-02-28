import { useState } from "react";
import { X, Search, ChevronDown, ChevronUp, User, Wrench, Package, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";

interface RepairJob {
  id: string; job_number: string; status: string; description: string;
  final_cost: number | null; estimated_cost: number | null; labor_cost: number | null;
  payment_status: string; payment_date: string | null; received_at: string; completed_at: string | null;
  customer_id: string; motorcycle_id: string; invoice_number: string | null;
}
interface Customer { id: string; name: string; phone: string | null; email: string | null; }
interface Motorcycle { id: string; customer_id: string; registration: string; make: string; model: string; }
interface RepairPart { id: string; repair_job_id: string; stock_item_id: string; quantity: number; unit_price: number; }
interface RepairService { id: string; repair_job_id: string; description: string; price: number; }
interface StockItem { id: string; name: string; cost_price: number; sell_price: number; }
interface MotorcycleSale { id: string; sale_price: number; cost_price: number; sale_date: string; customer_id?: string | null; }
interface AccessorySale { id: string; total: number; created_at: string; customer_id?: string | null; }

type DetailType = "total" | "repairs" | "motos" | "accessories" | "motosSold" | null;

interface Props {
  type: DetailType;
  onClose: () => void;
  jobs: RepairJob[];
  parts: RepairPart[];
  services: RepairService[];
  stockItems: StockItem[];
  customers: Customer[];
  motorcycles: Motorcycle[];
  motoSales: MotorcycleSale[];
  accSales: AccessorySale[];
  getJobTotal: (job: RepairJob) => number;
}

const STATUS_LABELS: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", waiting_parts: "Waiting Parts",
  in_repair: "In Repair", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-purple-500/20 text-purple-400", diagnosing: "bg-blue-500/20 text-blue-400",
  waiting_parts: "bg-amber-500/20 text-amber-400", in_repair: "bg-red-500/20 text-red-400",
  ready: "bg-green-500/20 text-green-400", delivered: "bg-teal-500/20 text-teal-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};

const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-green-500/20 text-green-400",
  unpaid: "bg-red-500/20 text-red-400",
  partial: "bg-amber-500/20 text-amber-400",
};

export default function ReportDetailModal({ type, onClose, jobs, parts, services, stockItems, customers, motorcycles, motoSales, accSales, getJobTotal }: Props) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!type) return null;

  const titles: Record<string, string> = {
    total: "Total Revenue — Full Breakdown",
    repairs: "Repairs Revenue — Detailed",
    motos: "Motorcycle Sales — Detailed",
    accessories: "Accessories Sales — Detailed",
    motosSold: "Motorcycles Sold — Detailed",
  };

  const getCust = (id: string) => customers.find(c => c.id === id);
  const getMoto = (id: string) => motorcycles.find(m => m.id === id);

  const filterText = search.toLowerCase();

  // Repairs detail
  const renderRepairs = () => {
    const paidJobs = jobs.filter(j => j.payment_status === "paid");
    const filtered = paidJobs.filter(j => {
      const c = getCust(j.customer_id);
      const m = getMoto(j.motorcycle_id);
      return !filterText || 
        j.job_number.toLowerCase().includes(filterText) ||
        (c?.name || "").toLowerCase().includes(filterText) ||
        (c?.phone || "").includes(filterText) ||
        (m?.registration || "").toLowerCase().includes(filterText) ||
        j.description.toLowerCase().includes(filterText);
    });

    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">{filtered.length} paid jobs</p>
        {filtered.map(job => {
          const cust = getCust(job.customer_id);
          const moto = getMoto(job.motorcycle_id);
          const jobParts = parts.filter(p => p.repair_job_id === job.id);
          const jobServices = services.filter(s => s.repair_job_id === job.id);
          const total = getJobTotal(job);
          const expanded = expandedId === job.id;

          return (
            <div key={job.id} className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
              <button onClick={() => setExpandedId(expanded ? null : job.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary">{job.job_number}</span>
                    {job.invoice_number && <span className="text-[10px] text-muted-foreground">INV: {job.invoice_number}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[job.status] || ""}`}>
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PAYMENT_COLORS[job.payment_status] || ""}`}>
                      {job.payment_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="font-medium text-foreground">{cust?.name || "Unknown"}</span>
                    {cust?.phone && <span>• {cust.phone}</span>}
                    {moto && <span>• {moto.registration} ({moto.make} {moto.model})</span>}
                  </div>
                </div>
                <span className="text-sm font-bold text-foreground whitespace-nowrap">£{total.toFixed(2)}</span>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border">
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-muted-foreground"><strong>Description:</strong> {job.description}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>Received: {format(parseISO(job.received_at), "dd/MM/yyyy")}</span>
                        {job.completed_at && <span>Completed: {format(parseISO(job.completed_at), "dd/MM/yyyy")}</span>}
                        {job.payment_date && <span>Paid: {format(parseISO(job.payment_date), "dd/MM/yyyy")}</span>}
                      </div>
                      {cust?.email && <p className="text-xs text-muted-foreground">Email: {cust.email}</p>}

                      {/* Services */}
                      {jobServices.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1"><Wrench className="h-3 w-3" /> Services ({jobServices.length})</p>
                          <div className="space-y-1">
                            {jobServices.map(s => (
                              <div key={s.id} className="flex justify-between text-xs px-2 py-1 rounded bg-secondary/30">
                                <span className="text-muted-foreground">{s.description}</span>
                                <span className="font-medium text-foreground">£{Number(s.price).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parts */}
                      {jobParts.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Parts ({jobParts.length})</p>
                          <div className="space-y-1">
                            {jobParts.map(p => {
                              const item = stockItems.find(s => s.id === p.stock_item_id);
                              return (
                                <div key={p.id} className="flex justify-between text-xs px-2 py-1 rounded bg-secondary/30">
                                  <span className="text-muted-foreground">{item?.name || "Unknown"} × {p.quantity}</span>
                                  <span className="font-medium text-foreground">£{(p.quantity * Number(p.unit_price)).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {Number(job.labor_cost) > 0 && (
                        <div className="flex justify-between text-xs px-2 py-1 rounded bg-secondary/30">
                          <span className="text-muted-foreground">Labour</span>
                          <span className="font-medium text-foreground">£{Number(job.labor_cost).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">No results found</p>}
      </div>
    );
  };

  // All jobs (for total revenue view)
  const renderAllJobs = () => {
    const filtered = jobs.filter(j => {
      const c = getCust(j.customer_id);
      const m = getMoto(j.motorcycle_id);
      return !filterText ||
        j.job_number.toLowerCase().includes(filterText) ||
        (c?.name || "").toLowerCase().includes(filterText) ||
        (m?.registration || "").toLowerCase().includes(filterText);
    });

    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">{filtered.length} total jobs in period</p>
        {filtered.map(job => {
          const cust = getCust(job.customer_id);
          const moto = getMoto(job.motorcycle_id);
          const total = getJobTotal(job);

          return (
            <div key={job.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-primary">{job.job_number}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[job.status] || ""}`}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PAYMENT_COLORS[job.payment_status] || ""}`}>
                    {job.payment_status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{cust?.name || "Unknown"}</span>
                  {moto && <span>• {moto.registration}</span>}
                </div>
              </div>
              <span className="text-sm font-bold text-foreground">£{total.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Motorcycle sales detail
  const renderMotoSales = () => {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">{motoSales.length} motorcycle sales</p>
        {motoSales.map(sale => (
          <div key={sale.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/20">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">
                {format(parseISO(sale.sale_date), "dd/MM/yyyy")}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">£{Number(sale.sale_price).toFixed(2)}</p>
              <p className="text-[10px] text-green-400">Profit: £{(Number(sale.sale_price) - Number(sale.cost_price)).toFixed(2)}</p>
            </div>
          </div>
        ))}
        {motoSales.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">No motorcycle sales in this period</p>}
      </div>
    );
  };

  // Accessory sales detail
  const renderAccSales = () => {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">{accSales.length} accessory sales</p>
        {accSales.map(sale => (
          <div key={sale.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/20">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">
                {format(parseISO(sale.created_at), "dd/MM/yyyy HH:mm")}
              </div>
            </div>
            <span className="text-sm font-bold text-foreground">£{Number(sale.total).toFixed(2)}</span>
          </div>
        ))}
        {accSales.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">No accessory sales in this period</p>}
      </div>
    );
  };

  const renderContent = () => {
    switch (type) {
      case "repairs": return renderRepairs();
      case "total": return renderAllJobs();
      case "motos":
      case "motosSold": return renderMotoSales();
      case "accessories": return renderAccSales();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl rounded-2xl border border-border bg-card mt-8 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{titles[type]}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        {(type === "repairs" || type === "total") && (
          <div className="px-5 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, registration, job #..."
                className="w-full rounded-lg border border-border bg-secondary/30 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {renderContent()}
        </div>
      </motion.div>
    </div>
  );
}
