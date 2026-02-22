import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, FileText, CheckCircle, Clock, PoundSterling, Printer, MessageCircle, Mail } from "lucide-react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import InvoiceModal from "@/components/InvoiceModal";

interface RepairJob {
  id: string;
  job_number: string;
  customer_id: string;
  motorcycle_id: string;
  status: string;
  description: string;
  estimated_cost: number | null;
  final_cost: number | null;
  labor_cost: number | null;
  invoice_number: string | null;
  payment_status: string;
  payment_date: string | null;
  received_at: string;
  completed_at: string | null;
}

interface Customer { id: string; name: string; phone: string | null; email: string | null; address: string | null; }
interface Motorcycle { id: string; customer_id: string; registration: string; make: string; model: string; year: number | null; }
interface StockItem { id: string; name: string; sell_price: number; }
interface RepairPart { id: string; repair_job_id: string; stock_item_id: string; quantity: number; unit_price: number; }
interface RepairService { id: string; repair_job_id: string; description: string; price: number; }

const InvoicesPage = () => {
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [repairParts, setRepairParts] = useState<RepairPart[]>([]);
  const [repairServices, setRepairServices] = useState<RepairService[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [invoiceJobId, setInvoiceJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: j }, { data: c }, { data: m }, { data: s }, { data: p }, { data: rs }] = await Promise.all([
      supabase.from("repair_jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, phone, email, address"),
      supabase.from("motorcycles").select("id, customer_id, registration, make, model, year"),
      supabase.from("stock_items").select("id, name, sell_price"),
      supabase.from("repair_parts").select("*"),
      supabase.from("repair_services").select("*"),
    ]);
    setJobs(j || []);
    setCustomers(c || []);
    setMotorcycles(m || []);
    setStockItems(s || []);
    setRepairParts(p || []);
    setRepairServices((rs as RepairService[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Filter jobs that have an invoice number or are paid
  const invoiceJobs = jobs.filter((j) => j.invoice_number || j.payment_status === "paid");

  const filtered = invoiceJobs.filter((j) => {
    const customer = customers.find((c) => c.id === j.customer_id);
    const moto = motorcycles.find((m) => m.id === j.motorcycle_id);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      j.job_number.toLowerCase().includes(q) ||
      j.invoice_number?.toLowerCase().includes(q) ||
      customer?.name.toLowerCase().includes(q) ||
      moto?.registration.toLowerCase().includes(q) ||
      moto?.make.toLowerCase().includes(q) ||
      moto?.model.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" ||
      (filterStatus === "paid" && j.payment_status === "paid") ||
      (filterStatus === "unpaid" && j.payment_status !== "paid");
    return matchSearch && matchStatus;
  });

  const getJobTotal = (job: RepairJob) => {
    const jobParts = repairParts.filter((p) => p.repair_job_id === job.id);
    const partsTotal = jobParts.reduce((s, p) => s + p.quantity * Number(p.unit_price), 0);
    const jobServices = repairServices.filter((s) => s.repair_job_id === job.id);
    const servicesTotal = jobServices.reduce((s, sv) => s + Number(sv.price), 0);
    const labor = Number(job.labor_cost) || 0;
    const calculated = partsTotal + servicesTotal + labor;
    // Use final_cost if set, otherwise calculated total, otherwise estimated_cost
    if (Number(job.final_cost) > 0) return Number(job.final_cost);
    if (calculated > 0) return calculated;
    return Number(job.estimated_cost) || 0;
  };

  const totalPaid = invoiceJobs.filter((j) => j.payment_status === "paid").reduce((sum, j) => sum + getJobTotal(j), 0);
  const totalUnpaid = invoiceJobs.filter((j) => j.payment_status !== "paid").reduce((sum, j) => sum + getJobTotal(j), 0);

  const openInvoice = (jobId: string) => {
    setInvoiceJobId(jobId);
  };

  // Build invoice modal data
  const invoiceJob = invoiceJobId ? jobs.find((j) => j.id === invoiceJobId) : null;
  const invoiceCustomer = invoiceJob ? customers.find((c) => c.id === invoiceJob.customer_id) : null;
  const invoiceMoto = invoiceJob ? motorcycles.find((m) => m.id === invoiceJob.motorcycle_id) : null;
  const invoiceParts = invoiceJob ? repairParts.filter((p) => p.repair_job_id === invoiceJob.id).map((p) => {
    const item = stockItems.find((s) => s.id === p.stock_item_id);
    return { name: item?.name || "Unknown", quantity: p.quantity, unit_price: Number(p.unit_price) };
  }) : [];
  const invoiceServices = invoiceJob ? repairServices.filter((s) => s.repair_job_id === invoiceJob.id).map((s) => ({
    description: s.description, price: Number(s.price),
  })) : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
            <p className="text-sm text-muted-foreground">{invoiceJobs.length} invoices generated</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-green/20 text-chart-green">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-xl font-bold text-foreground">£{totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-amber/20 text-chart-amber">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unpaid</p>
              <p className="text-xl font-bold text-foreground">£{totalUnpaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Invoices</p>
              <p className="text-xl font-bold text-foreground">{invoiceJobs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice #, customer, registration..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {(["all", "paid", "unpaid"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => {
            const customer = customers.find((c) => c.id === job.customer_id);
            const moto = motorcycles.find((m) => m.id === job.motorcycle_id);
            const isPaid = job.payment_status === "paid";

            return (
              <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => openInvoice(job.id)}
                className="rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isPaid ? "bg-chart-green/20 text-chart-green" : "bg-chart-amber/20 text-chart-amber"}`}>
                      {isPaid ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary">{job.invoice_number || job.job_number}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isPaid ? "bg-chart-green/20 text-chart-green" : "bg-chart-amber/20 text-chart-amber"}`}>
                          {isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{customer?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {moto ? `${moto.registration} — ${moto.make} ${moto.model}` : "Unknown"} 
                        {job.payment_date && ` • ${new Date(job.payment_date).toLocaleDateString("en-GB")}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      £{getJobTotal(job).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{job.description.substring(0, 40)}{job.description.length > 40 ? "..." : ""}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceJob && invoiceCustomer && invoiceMoto && (
        <InvoiceModal
          data={{
            job: invoiceJob,
            customer: invoiceCustomer,
            motorcycle: invoiceMoto,
            parts: invoiceParts,
            services: invoiceServices,
          }}
          onClose={() => setInvoiceJobId(null)}
          onPaid={() => { setInvoiceJobId(null); fetchData(); }}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
