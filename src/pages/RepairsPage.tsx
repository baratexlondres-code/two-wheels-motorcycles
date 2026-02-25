import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Wrench, X, ChevronDown, ChevronUp, Clock, CheckCircle, AlertTriangle, Truck, Eye, Settings2, Package, FileText, PoundSterling } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PlateScanner from "@/components/PlateScanner";
import InvoiceModal from "@/components/InvoiceModal";
import BackButton from "@/components/BackButton";

interface RepairJob {
  id: string;
  job_number: string;
  customer_id: string;
  motorcycle_id: string;
  status: string;
  description: string;
  diagnosis: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  labor_cost: number | null;
  notes: string | null;
  received_at: string;
  completed_at: string | null;
  delivered_at: string | null;
  payment_status: string;
  payment_date: string | null;
  invoice_number: string | null;
}

interface CustomerFull { id: string; name: string; phone: string | null; email: string | null; address: string | null; }

interface Customer { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null; }
interface Motorcycle { id: string; customer_id: string; registration: string; make: string; model: string; year: number | null; }
interface RepairPart { id: string; repair_job_id: string; stock_item_id: string | null; quantity: number; unit_price: number; notes?: string | null; }
interface RepairService { id: string; repair_job_id: string; description: string; price: number; }
interface StockItem { id: string; name: string; sell_price: number; quantity: number; sku: string | null; }
interface ServiceCatalogItem { id: string; service_code: string; name: string; category: string; description: string | null; default_price: number; }
interface Brand { id: string; brand_name: string; }
interface Model { id: string; brand_id: string; model_name: string; category: string; engine_cc: string; vehicle_type: string; }

const statuses = [
  { value: "received", label: "Received", icon: Clock, color: "bg-muted text-muted-foreground" },
  { value: "diagnosing", label: "Diagnosing", icon: Eye, color: "bg-chart-blue/20 text-chart-blue" },
  { value: "waiting_parts", label: "Waiting Parts", icon: AlertTriangle, color: "bg-chart-amber/20 text-chart-amber" },
  { value: "in_repair", label: "In Repair", icon: Wrench, color: "bg-primary/20 text-primary" },
  { value: "ready", label: "Ready", icon: CheckCircle, color: "bg-chart-green/20 text-chart-green" },
  { value: "delivered", label: "Delivered", icon: Truck, color: "bg-chart-green/30 text-chart-green" },
  { value: "cancelled", label: "Cancelled", icon: X, color: "bg-destructive/20 text-destructive" },
];

const categories = ["Sport","Super Sport","Naked","Adventure","Touring","Cruiser","Bobber","Cafe Racer","Retro Classic","Off Road","Motocross","Enduro","Supermoto","Scooter","Maxi Scooter","Electric"];
const engineCcOptions = ["50cc","110cc","125cc","250cc","300cc","400cc","500cc","600cc","650cc","700cc","750cc","800cc","900cc","1000cc","1100cc","1200cc","1300cc","Electric"];

const getStatusInfo = (s: string) => statuses.find((st) => st.value === s) || statuses[0];

const RepairsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [customers, setCustomers] = useState<CustomerFull[]>([]);
  const [invoiceJobId, setInvoiceJobId] = useState<string | null>(null);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [repairParts, setRepairParts] = useState<RepairPart[]>([]);
  const [repairServices, setRepairServices] = useState<RepairService[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "", motorcycle_id: "", description: "", estimated_cost: "", notes: "",
    brand_id: "", model_id: "", registration: "", engine_cc: "", category: "", vehicle_type: "Motorcycle",
    manual_make: "", manual_model: "",
  });
  const [pendingParts, setPendingParts] = useState<{ stock_item_id: string; quantity: number; unit_price?: number; name?: string }[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [showAddPart, setShowAddPart] = useState<string | null>(null);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [pendingServices, setPendingServices] = useState<{ description: string; price: number }[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [showAddService, setShowAddService] = useState<string | null>(null);
  const [showNewModelForm, setShowNewModelForm] = useState(false);
  const [newModel, setNewModel] = useState({ model_name: "", category: "Naked", engine_cc: "125cc", vehicle_type: "Motorcycle" });
  const [loading, setLoading] = useState(true);
  const [formServices, setFormServices] = useState<string[]>([]);
  const [formServiceSearch, setFormServiceSearch] = useState("");
  // Saved service history from localStorage — persists across sessions
  const [savedServiceHistory, setSavedServiceHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tw_service_history") || "[]"); } catch { return []; }
  });
  const addToServiceHistory = (services: string[]) => {
    setSavedServiceHistory((prev) => {
      const merged = [...new Set([...prev, ...services.map((s) => s.trim()).filter(Boolean)])];
      localStorage.setItem("tw_service_history", JSON.stringify(merged));
      return merged;
    });
  };
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: j }, { data: c }, { data: m }, { data: s }, { data: p }, { data: b }, { data: md }, { data: rs }, { data: sc }] = await Promise.all([
      supabase.from("repair_jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, phone, email, address").order("name"),
      supabase.from("motorcycles").select("id, customer_id, registration, make, model, year"),
      supabase.from("stock_items").select("id, name, sell_price, quantity, sku"),
      supabase.from("repair_parts").select("*"),
      supabase.from("motorcycle_brands").select("id, brand_name").eq("active_status", true).order("brand_name"),
      supabase.from("motorcycle_models").select("*").eq("active_status", true).order("model_name"),
      supabase.from("repair_services").select("*"),
      supabase.from("service_catalog").select("*").eq("active", true).order("category, name"),
    ]);
    setJobs(j || []); setCustomers(c || []); setMotorcycles(m || []); setStockItems(s || []); setRepairParts(p || []);
    setBrands(b || []); setModels((md as Model[]) || []); setRepairServices((rs as RepairService[]) || []);
    setServiceCatalog((sc as ServiceCatalogItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-open form with pre-filled customer/motorcycle from URL params
  useEffect(() => {
    const cid = searchParams.get("customer_id");
    const mid = searchParams.get("motorcycle_id");
    if (cid && customers.length > 0 && !showForm) {
      const moto = mid ? motorcycles.find((m) => m.id === mid) : null;
      setForm((prev) => ({
        ...prev,
        customer_id: cid,
        motorcycle_id: moto?.id || "",
        registration: moto?.registration || "",
      }));
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [customers, searchParams]);

  // Auto-expand job from URL param (e.g. /repairs?job_id=xxx)
  useEffect(() => {
    const jobId = searchParams.get("job_id");
    if (jobId && jobs.length > 0) {
      setExpandedId(jobId);
      setSearchParams({}, { replace: true });
      // Scroll to the job after a short delay
      setTimeout(() => {
        document.getElementById(`job-${jobId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [jobs, searchParams]);

  const customerMotos = motorcycles.filter((m) => m.customer_id === form.customer_id);
  const brandModels = models.filter((m) => m.brand_id === form.brand_id);

  // When brand changes, reset model selection
  const handleBrandChange = (brandId: string) => {
    setForm({ ...form, brand_id: brandId, model_id: "", engine_cc: "", category: "", vehicle_type: "Motorcycle" });
  };

  // When model is selected, auto-fill engine_cc, category, vehicle_type
  const handleModelSelect = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (model) {
      setForm({ ...form, model_id: modelId, engine_cc: model.engine_cc, category: model.category, vehicle_type: model.vehicle_type });
    } else {
      setForm({ ...form, model_id: modelId });
    }
  };

  const handlePlateResult = (result: { registration: string; make?: string | null; model?: string | null; color?: string | null }) => {
    const reg = result.registration.toUpperCase().trim();
    const existingMoto = motorcycles.find((m) => m.registration.toUpperCase().replace(/\s/g, "") === reg.replace(/\s/g, ""));
    if (existingMoto) {
      setForm({ ...form, customer_id: existingMoto.customer_id, motorcycle_id: existingMoto.id, registration: existingMoto.registration });
      const customer = customers.find((c) => c.id === existingMoto.customer_id);
      toast({ title: `Found: ${customer?.name || "Customer"}`, description: `${existingMoto.make} ${existingMoto.model} — ${existingMoto.registration}` });
    } else {
      // Try to match brand and model from scan, fallback to manual fields
      let newForm = { ...form, registration: reg, manual_make: result.make || "", manual_model: result.model || "" };
      if (result.make) {
        const brand = brands.find((b) => b.brand_name.toLowerCase() === result.make!.toLowerCase());
        if (brand) {
          newForm = { ...newForm, brand_id: brand.id, manual_make: "", manual_model: "" };
          if (result.model) {
            const model = models.find((m) => m.brand_id === brand.id && m.model_name.toLowerCase() === result.model!.toLowerCase());
            if (model) {
              newForm = { ...newForm, model_id: model.id, engine_cc: model.engine_cc, category: model.category, vehicle_type: model.vehicle_type, manual_model: "" };
            }
          }
        }
      }
      setForm(newForm);
      toast({ title: `Plate: ${reg}`, description: `${result.make || ""} ${result.model || ""} detected — select customer to continue.`.trim() });
    }
    setShowForm(true);
  };

  const handleQuickCreateCustomer = async () => {
    if (!newCustomerForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const { data, error } = await supabase.from("customers").insert({
      name: newCustomerForm.name.trim(),
      phone: newCustomerForm.phone.trim() || null,
      email: newCustomerForm.email.trim() || null,
      address: newCustomerForm.address.trim() || null,
      notes: newCustomerForm.notes.trim() || null,
    }).select("id, name, phone, email, address").single();
    if (error) { toast({ title: "Error creating customer", description: error.message, variant: "destructive" }); return; }
    setCustomers((prev) => [...prev, data as CustomerFull].sort((a, b) => a.name.localeCompare(b.name)));
    setForm({ ...form, customer_id: data.id, motorcycle_id: "" });
    setShowNewCustomer(false);
    setNewCustomerForm({ name: "", phone: "", email: "", address: "", notes: "" });
    setCustomerSearch("");
    toast({ title: `Customer "${data.name}" created` });
  };

  const handleCreate = async () => {
    // Auto-add service search text if user typed something but didn't press Enter
    let allServices = [...formServices];
    if (formServiceSearch.trim() && !allServices.includes(formServiceSearch.trim())) {
      allServices.push(formServiceSearch.trim());
    }
    const validServices = allServices.filter((s) => s.trim());
    if (!form.customer_id || validServices.length === 0) {
      toast({ title: "Customer and at least one service are required", variant: "destructive" }); return;
    }
    setFormServices(validServices);
    setFormServiceSearch("");

    let motorcycleId = form.motorcycle_id;

    // If no motorcycle selected but registration filled, create new motorcycle
    if (!motorcycleId && form.registration) {
      const brand = brands.find((b) => b.id === form.brand_id);
      const model = models.find((m) => m.id === form.model_id);
      const makeName = brand?.brand_name || form.manual_make.trim() || "Unknown";
      const modelName = model?.model_name || form.manual_model.trim() || "Unknown";
      const { data: newMoto, error: motoErr } = await supabase.from("motorcycles").insert({
        customer_id: form.customer_id,
        registration: form.registration.toUpperCase(),
        make: makeName,
        model: modelName,
      }).select("id").single();
      if (motoErr) { toast({ title: "Error creating motorcycle", description: motoErr.message, variant: "destructive" }); return; }
      motorcycleId = newMoto.id;
    }

    if (!motorcycleId) {
      toast({ title: "Please select or create a motorcycle (registration required)", variant: "destructive" }); return;
    }

    const description = validServices.join(", ");

    const { data: newJob, error } = await supabase.from("repair_jobs").insert({
      customer_id: form.customer_id, motorcycle_id: motorcycleId, description,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null, notes: form.notes || null,
      job_number: "TEMP",
    } as any).select("id").single();
    if (error) { toast({ title: "Error creating job", description: error.message, variant: "destructive" }); return; }

    // Save services — the estimated_cost is the price of the first/main service
    const estimatedPrice = form.estimated_cost ? parseFloat(form.estimated_cost) : 0;
    for (let i = 0; i < validServices.length; i++) {
      await supabase.from("repair_services").insert({
        repair_job_id: newJob.id,
        description: validServices[i].trim(),
        // Assign the full estimated cost to the first service; additional services start at £0
        price: i === 0 ? estimatedPrice : 0,
      });
    }

    // Save all manually typed services to history for future autocomplete
    addToServiceHistory(validServices);
    toast({ title: "Repair job created" });
    setShowForm(false);
    setForm({ customer_id: "", motorcycle_id: "", description: "", estimated_cost: "", notes: "", brand_id: "", model_id: "", registration: "", engine_cc: "", category: "", vehicle_type: "Motorcycle", manual_make: "", manual_model: "" });
    setFormServices([]); setFormServiceSearch(""); setCustomerSearch("");
    fetchData();
  };

  const handleCreateModel = async () => {
    if (!form.brand_id || !newModel.model_name.trim()) {
      toast({ title: "Brand and model name required", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.from("motorcycle_models").insert({
      brand_id: form.brand_id,
      model_name: newModel.model_name,
      category: newModel.category,
      engine_cc: newModel.engine_cc,
      vehicle_type: newModel.vehicle_type,
    }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Model created successfully" });
    setShowNewModelForm(false);
    setNewModel({ model_name: "", category: "Naked", engine_cc: "125cc", vehicle_type: "Motorcycle" });
    // Refresh and select new model
    const { data: md } = await supabase.from("motorcycle_models").select("*").eq("active_status", true).order("model_name");
    setModels((md as Model[]) || []);
    if (data) handleModelSelect(data.id);
  };

  const updateStatus = async (jobId: string, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "ready") updates.completed_at = new Date().toISOString();
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
    await supabase.from("repair_jobs").update(updates).eq("id", jobId);
    toast({ title: `Status updated to ${getStatusInfo(newStatus).label}` });
    fetchData();
  };

  const updateField = async (jobId: string, field: string, value: string) => {
    await supabase.from("repair_jobs").update({ [field]: value || null }).eq("id", jobId);
    // Update local state without full refetch to avoid losing focus
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, [field]: value || null } : j));
  };

  const togglePendingPart = (itemId: string) => {
    setPendingParts((prev) => {
      const exists = prev.find((p) => p.stock_item_id === itemId);
      if (exists) return prev.filter((p) => p.stock_item_id !== itemId);
      return [...prev, { stock_item_id: itemId, quantity: 1 }];
    });
  };

  const updatePendingPartQty = (itemId: string, qty: number) => {
    setPendingParts((prev) => prev.map((p) => p.stock_item_id === itemId ? { ...p, quantity: Math.max(1, qty) } : p));
  };

  const handleAddParts = async (jobId: string) => {
    if (pendingParts.length === 0) { toast({ title: "Select at least one part", variant: "destructive" }); return; }
    for (const pp of pendingParts) {
      const item = stockItems.find((s) => s.id === pp.stock_item_id);
      await supabase.from("repair_parts").insert({
        repair_job_id: jobId, stock_item_id: pp.stock_item_id, quantity: pp.quantity, unit_price: item?.sell_price || 0,
      });
      await supabase.from("stock_movements").insert({
        stock_item_id: pp.stock_item_id, type: "out", quantity: pp.quantity, reference: "Repair job", notes: "Used in repair",
      });
    }
    toast({ title: `${pendingParts.length} part(s) added` });
    setShowAddPart(null); setPendingParts([]); setPartSearch(""); fetchData();
  };

  const handleRemovePart = async (part: RepairPart) => {
    if (!window.confirm("Tem certeza que deseja remover esta peça? O stock será devolvido.")) return;
    await supabase.from("repair_parts").delete().eq("id", part.id);
    await supabase.from("stock_movements").insert({
      stock_item_id: part.stock_item_id, type: "in", quantity: part.quantity, notes: "Returned from repair",
    });
    toast({ title: "Part removed" }); fetchData();
  };

  const togglePendingService = (svc: ServiceCatalogItem) => {
    setPendingServices((prev) => {
      const exists = prev.find((p) => p.description === svc.name);
      if (exists) return prev.filter((p) => p.description !== svc.name);
      return [...prev, { description: svc.name, price: Number(svc.default_price) }];
    });
  };

  const updatePendingServicePrice = (desc: string, price: number) => {
    setPendingServices((prev) => prev.map((p) => p.description === desc ? { ...p, price } : p));
  };

  const addCustomService = () => {
    setPendingServices((prev) => [...prev, { description: "", price: 0 }]);
  };

  const updatePendingServiceDesc = (index: number, desc: string) => {
    setPendingServices((prev) => prev.map((p, i) => i === index ? { ...p, description: desc } : p));
  };

  const removePendingService = (index: number) => {
    setPendingServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddServices = async (jobId: string) => {
    const valid = pendingServices.filter((s) => s.description.trim() && s.price > 0);
    if (valid.length === 0) { toast({ title: "Add at least one service with description and price", variant: "destructive" }); return; }
    for (const svc of valid) {
      await supabase.from("repair_services").insert({
        repair_job_id: jobId, description: svc.description.trim(), price: svc.price,
      });
    }
    toast({ title: `${valid.length} service(s) added` });
    setShowAddService(null); setPendingServices([]); setServiceSearch(""); fetchData();
  };

  const handleRemoveService = async (serviceId: string) => {
    await supabase.from("repair_services").delete().eq("id", serviceId);
    toast({ title: "Service removed" }); fetchData();
  };

  const filtered = jobs.filter((j) => {
    const customer = customers.find((c) => c.id === j.customer_id);
    const moto = motorcycles.find((m) => m.id === j.motorcycle_id);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      j.job_number.toLowerCase().includes(q) ||
      customer?.name.toLowerCase().includes(q) ||
      customer?.phone?.toLowerCase().includes(q) ||
      customer?.email?.toLowerCase().includes(q) ||
      moto?.registration.toLowerCase().includes(q) ||
      moto?.make.toLowerCase().includes(q) ||
      moto?.model.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Repairs</h1>
            <p className="text-sm text-muted-foreground">{jobs.length} total jobs • {jobs.filter((j) => !["delivered", "cancelled"].includes(j.status)).length} active</p>
          </div>
        </div>
        <div className="flex gap-2">
          <PlateScanner onResult={handlePlateResult} />
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" /> New Repair Job
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by job #, customer, registration..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="all">All Status</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Status quick counts */}
      <div className="flex flex-wrap gap-2">
        {statuses.filter((s) => !["cancelled"].includes(s.value)).map((s) => {
          const count = jobs.filter((j) => j.status === s.value).length;
          if (count === 0) return null;
          return (
            <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.color} ${filterStatus === s.value ? "ring-1 ring-primary" : ""}`}>
              <s.icon className="h-3 w-3" /> {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* New Job Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">New Repair Job</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              {/* Customer searchable */}
              <div className="space-y-1">
                {form.customer_id ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary/50 bg-primary/10 px-3 py-2.5">
                    <span className="text-sm font-medium text-foreground">
                      {customers.find((c) => c.id === form.customer_id)?.name || "Selected"}
                    </span>
                    <button type="button" onClick={() => { setForm({ ...form, customer_id: "", motorcycle_id: "" }); setCustomerSearch(""); }}
                      className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search customer by name, phone, email..."
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-border bg-card">
                      {customers
                        .filter((c) => {
                          if (!customerSearch) return true;
                          const q = customerSearch.toLowerCase();
                          return c.name.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
                        })
                        .map((c) => (
                          <button key={c.id} type="button" onClick={() => { setForm({ ...form, customer_id: c.id, motorcycle_id: "" }); setCustomerSearch(""); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-secondary text-foreground">
                            <span className="font-medium">{c.name}</span>
                            {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                          </button>
                        ))}
                      {customers.filter((c) => {
                        if (!customerSearch) return true;
                        const q = customerSearch.toLowerCase();
                        return c.name.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No customers found</p>
                      )}
                    </div>
                    <button type="button" onClick={() => { setShowNewCustomer(true); setNewCustomerForm({ ...newCustomerForm, name: customerSearch }); }}
                      className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                      <Plus className="inline h-3 w-3 mr-1" /> New Customer
                    </button>
                    {showNewCustomer && (
                      <div className="space-y-2 rounded-lg border border-primary/30 bg-card p-3">
                        <p className="text-xs font-semibold text-primary">Quick Add Customer</p>
                        <input value={newCustomerForm.name} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                          placeholder="Name *" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        <input value={newCustomerForm.phone} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                          placeholder="Phone" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        <input value={newCustomerForm.email} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                          placeholder="Email" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowNewCustomer(false)}
                            className="flex-1 rounded bg-secondary py-2 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                          <button type="button" onClick={handleQuickCreateCustomer}
                            className="flex-1 rounded bg-primary py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">Create</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Existing motorcycle or new */}
              {customerMotos.length > 0 && (
                <select value={form.motorcycle_id} onChange={(e) => {
                  const moto = motorcycles.find((m) => m.id === e.target.value);
                  if (moto) {
                    const brand = brands.find((b) => b.brand_name.toLowerCase() === moto.make.toLowerCase());
                    setForm({ ...form, motorcycle_id: e.target.value, registration: moto.registration, brand_id: brand?.id || "" });
                  } else {
                    setForm({ ...form, motorcycle_id: e.target.value });
                  }
                }}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none">
                  <option value="">Select Existing Motorcycle or leave blank for new</option>
                  {customerMotos.map((m) => <option key={m.id} value={m.id}>{m.registration} — {m.make} {m.model}</option>)}
                </select>
              )}

              {/* Services from catalog */}
               <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 className="h-3 w-3" /> Services / Description *
                </p>
                <div className="flex items-center gap-2 rounded border border-border bg-secondary px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input value={formServiceSearch} onChange={(e) => setFormServiceSearch(e.target.value)}
                    placeholder="Search or type service name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && formServiceSearch.trim()) {
                        e.preventDefault();
                        if (!formServices.includes(formServiceSearch.trim())) {
                          setFormServices((prev) => [...prev, formServiceSearch.trim()]);
                        }
                        setFormServiceSearch("");
                      }
                    }}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                  {formServiceSearch.trim() && (
                    <button type="button" onClick={() => {
                      if (!formServices.includes(formServiceSearch.trim())) {
                        setFormServices((prev) => [...prev, formServiceSearch.trim()]);
                      }
                      setFormServiceSearch("");
                    }}
                      className="shrink-0 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110">
                      Add
                    </button>
                  )}
                </div>
                {formServiceSearch && (() => {
                  const q = formServiceSearch.toLowerCase();
                  // Merge history + catalog, deduplicate, filter by query
                  const historyMatches = savedServiceHistory
                    .filter((h) => h.toLowerCase().includes(q) && !formServices.includes(h))
                    .map((h) => ({ key: `h:${h}`, label: h, isHistory: true }));
                  const catalogMatches = serviceCatalog
                    .filter((s) => (s.name.toLowerCase().includes(q) || s.service_code.toLowerCase().includes(q)) && !formServices.includes(s.name))
                    .map((s) => ({ key: `c:${s.id}`, label: s.name, isHistory: false }));
                  // Combine: history first, then catalog (no duplicates)
                  const historyLabels = new Set(historyMatches.map((h) => h.label.toLowerCase()));
                  const combined = [
                    ...historyMatches,
                    ...catalogMatches.filter((c) => !historyLabels.has(c.label.toLowerCase())),
                  ];
                  if (combined.length === 0) return null;
                  return (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg space-y-0.5 p-1">
                      {combined.map((item) => (
                        <button key={item.key} type="button" onClick={() => {
                          setFormServices((prev) => [...prev, item.label]);
                          setFormServiceSearch("");
                        }}
                          className="w-full flex items-center gap-2 rounded px-2.5 py-2 text-xs text-left hover:bg-secondary text-foreground">
                          {item.isHistory ? (
                            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">saved</span>
                          ) : (
                            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">catalog</span>
                          )}
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {/* Selected services */}
                {formServices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formServices.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                        {typeof name === 'string' ? name : String(name)}
                        <button type="button" onClick={() => setFormServices((prev) => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <input type="number" step="0.01" placeholder="Estimated Cost (£)" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" />
              <button onClick={handleCreate} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                Create Job
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Wrench className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No repair jobs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => {
            const customer = customers.find((c) => c.id === job.customer_id);
            const moto = motorcycles.find((m) => m.id === job.motorcycle_id);
            const statusInfo = getStatusInfo(job.status);
            const isExpanded = expandedId === job.id;
            const parts = repairParts.filter((p) => p.repair_job_id === job.id);
            // Separate manual parts (stored in repair_services with [PART] prefix) from real services
            const allJobServices = repairServices.filter((s) => s.repair_job_id === job.id);
            const manualParts = allJobServices.filter((s) => s.description.startsWith("[PART]"));
            const services = allJobServices.filter((s) => !s.description.startsWith("[PART]"));
            const partsTotal = parts.reduce((sum, p) => sum + p.quantity * Number(p.unit_price), 0)
              + manualParts.reduce((sum, s) => sum + Number(s.price), 0);
            const servicesTotal = services.reduce((sum, s) => sum + Number(s.price), 0);

            return (
              <motion.div key={job.id} id={`job-${job.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${statusInfo.color}`}>
                      <statusInfo.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-primary">{job.job_number}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <a
                        href={`/customers?id=${job.customer_id}`}
                        className="block text-sm font-medium text-primary hover:underline text-left py-1"
                        style={{ minHeight: 44, display: "flex", alignItems: "center" }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/customers?id=${job.customer_id}`);
                        }}
                      >
                        {customer?.name || "Unknown"}
                      </a>
                      <p className="text-xs text-muted-foreground truncate">{moto ? `${moto.registration} — ${moto.make} ${moto.model}` : "Unknown"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const jobParts = repairParts.filter((p) => p.repair_job_id === job.id);
                      const stockPartsTotal = jobParts.reduce((s, p) => s + p.quantity * Number(p.unit_price), 0);
                      const jobSvcs = repairServices.filter((s) => s.repair_job_id === job.id);
                      // [PART] entries are manual parts stored in repair_services
                      const manualPartsTotal = jobSvcs.filter((s) => s.description.startsWith("[PART]")).reduce((s, sv) => s + Number(sv.price), 0);
                      const svcsTotal = jobSvcs.filter((s) => !s.description.startsWith("[PART]")).reduce((s, sv) => s + Number(sv.price), 0);
                      const partsTotal = stockPartsTotal + manualPartsTotal;
                      const labor = Number(job.labor_cost) || 0;
                      const calculated = partsTotal + svcsTotal + labor;
                      const displayVal = Number(job.final_cost) > 0 ? Number(job.final_cost) : calculated > 0 ? calculated : Number(job.estimated_cost) || 0;
                      return displayVal > 0 ? (
                        <span className="text-sm font-medium text-foreground hidden sm:inline">£{displayVal.toFixed(2)}</span>
                      ) : null;
                    })()}
                    <button onClick={() => setExpandedId(isExpanded ? null : job.id)} className="rounded p-2 text-muted-foreground hover:bg-secondary" style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-secondary/30 p-4 space-y-4">




                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update Status</label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {statuses.map((s) => (
                          <button key={s.value} onClick={() => updateStatus(job.id, s.value)}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${job.status === s.value ? `${s.color} ring-1 ring-primary` : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                            <s.icon className="h-3 w-3" /> {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Package className="inline h-3 w-3 mr-1" />Parts Used {(parts.length + manualParts.length) > 0 && `(£${partsTotal.toFixed(2)})`}
                        </label>
                        <button onClick={() => setShowAddPart(showAddPart === job.id ? null : job.id)}
                          className="text-xs font-semibold text-primary hover:brightness-125 flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add Parts
                        </button>
                      </div>

                      {showAddPart === job.id && (
                        <div className="mt-2 space-y-2">
                          {/* Manual part name with autocomplete from saved history */}
                          <div className="relative">
                            <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                              <input value={partSearch} onChange={(e) => setPartSearch(e.target.value)}
                                placeholder="Part name (e.g. Pastilha de freio)..."
                                onKeyDown={(e) => { if (e.key === "Escape") setPartSearch(""); }}
                                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                              {partSearch.trim() && (
                                <button onClick={() => setPartSearch("")} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3 w-3" /></button>
                              )}
                            </div>
                            {/* Autocomplete dropdown from saved parts history */}
                            {partSearch.trim().length > 0 && (() => {
                              const savedParts: string[] = (() => { try { return JSON.parse(localStorage.getItem("tw_parts_history") || "[]"); } catch { return []; } })();
                              const matches = savedParts.filter((p) => p.toLowerCase().includes(partSearch.toLowerCase()) && p.toLowerCase() !== partSearch.toLowerCase());
                              if (matches.length === 0) return null;
                              return (
                                <div className="absolute z-10 w-full rounded border border-border bg-card shadow-lg mt-0.5">
                                  {matches.slice(0, 6).map((p) => (
                                    <div key={p} onClick={() => setPartSearch(p)}
                                      className="flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border/30 last:border-0">
                                      <span className="text-foreground">{p}</span>
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-[10px]">saved</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          {/* Price and quantity row */}
                          <div className="flex gap-2">
                            <input value={pendingParts.find((p) => p.stock_item_id === "__manual__")?.unit_price?.toString() || ""}
                              onChange={(e) => {
                                const price = e.target.value;
                                setPendingParts((prev) => {
                                  const exists = prev.find((p) => p.stock_item_id === "__manual__");
                                  if (exists) return prev.map((p) => p.stock_item_id === "__manual__" ? { ...p, unit_price: parseFloat(price) || 0 } : p);
                                  return [...prev, { stock_item_id: "__manual__", quantity: 1, unit_price: parseFloat(price) || 0, name: partSearch.trim() }];
                                });
                              }}
                              placeholder="Price (£)"
                              type="number" min="0" step="0.01"
                              className="w-28 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                            <input value={pendingParts.find((p) => p.stock_item_id === "__manual__")?.quantity?.toString() || "1"}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value) || 1;
                                setPendingParts((prev) => {
                                  const exists = prev.find((p) => p.stock_item_id === "__manual__");
                                  if (exists) return prev.map((p) => p.stock_item_id === "__manual__" ? { ...p, quantity: Math.max(1, qty) } : p);
                                  return [...prev, { stock_item_id: "__manual__", quantity: Math.max(1, qty), unit_price: 0, name: partSearch.trim() }];
                                });
                              }}
                              placeholder="Qty"
                              type="number" min="1"
                              className="w-16 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                            <button
                              onClick={async () => {
                                const name = partSearch.trim();
                                if (!name) { toast({ title: "Enter a part name", variant: "destructive" }); return; }
                                const manualEntry = pendingParts.find((p) => p.stock_item_id === "__manual__");
                                const price = manualEntry?.unit_price || 0;
                                const qty = manualEntry?.quantity || 1;
                                // Save manual part to repair_services with [PART] prefix
                                // (repair_parts requires stock_item_id NOT NULL)
                                await supabase.from("repair_services").insert({
                                  repair_job_id: job.id,
                                  description: `[PART] ${name}`,
                                  price: price * qty,
                                });
                                // Save part name to localStorage history
                                const saved: string[] = (() => { try { return JSON.parse(localStorage.getItem("tw_parts_history") || "[]"); } catch { return []; } })();
                                if (!saved.includes(name)) {
                                  const updated = [...saved, name];
                                  localStorage.setItem("tw_parts_history", JSON.stringify(updated));
                                }
                                toast({ title: `"${name}" added to job` });
                                setShowAddPart(null);
                                setPendingParts([]);
                                setPartSearch("");
                                fetchData();
                              }}
                              className="flex-1 rounded bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
                              + Add Part
                            </button>
                          </div>
                        </div>
                      )}
                                            {(parts.length > 0 || manualParts.length > 0) && (
                        <div className="mt-2 space-y-1">
                          {parts.map((p) => {
                            const item = stockItems.find((s) => s.id === p.stock_item_id);
                            return (
                              <div key={p.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                                <span className="text-foreground">{item?.name || p.notes || "Unknown"} × {p.quantity}</span>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-muted-foreground">£</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    defaultValue={Number(p.unit_price) || ""}
                                    placeholder="0.00"
                                    onBlur={async (e) => {
                                      const newPrice = parseFloat(e.target.value) || 0;
                                      if (newPrice !== Number(p.unit_price)) {
                                        await supabase.from("repair_parts").update({ unit_price: newPrice }).eq("id", p.id);
                                        fetchData();
                                      }
                                    }}
                                    className="w-20 bg-transparent text-foreground text-right focus:outline-none border-b border-border/50 focus:border-primary"
                                  />
                                  <button onClick={() => handleRemovePart(p)} className="text-muted-foreground hover:text-destructive">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {manualParts.map((s) => (
                            <div key={s.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                              <span className="text-foreground">{s.description.replace(/^\[PART\]\s*/, "")}</span>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <span className="text-muted-foreground">£</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={Number(s.price) || ""}
                                  placeholder="0.00"
                                  onBlur={async (e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    if (newPrice !== Number(s.price)) {
                                      await supabase.from("repair_services").update({ price: newPrice }).eq("id", s.id);
                                      fetchData();
                                    }
                                  }}
                                  className="w-20 bg-transparent text-foreground text-right focus:outline-none border-b border-border/50 focus:border-primary"
                                />
                                <button onClick={() => handleRemoveService(s.id)} className="text-muted-foreground hover:text-destructive">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Services */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Settings2 className="inline h-3 w-3 mr-1" />Services {services.length > 0 && `(£${servicesTotal.toFixed(2)})`}
                        </label>
                        <button onClick={() => setShowAddService(showAddService === job.id ? null : job.id)}
                          className="text-xs font-semibold text-primary hover:brightness-125 flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add Service
                        </button>
                      </div>

                      {showAddService === job.id && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                            <Search className="h-3 w-3 text-muted-foreground" />
                            <input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)}
                              placeholder="Search services..."
                              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                          </div>
                          <div className="max-h-40 overflow-y-auto rounded border border-border bg-card">
                            {serviceCatalog
                              .filter((s) => serviceSearch === "" || s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || s.category.toLowerCase().includes(serviceSearch.toLowerCase()))
                              .map((s) => {
                                const selected = pendingServices.find((p) => p.description === s.name);
                                return (
                                  <div key={s.id} onClick={() => togglePendingService(s)}
                                    className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border/30 last:border-0 ${selected ? "bg-primary/10" : ""}`}>
                                    <div className="flex items-center gap-2">
                                      <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-border"}`}>
                                        {selected && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                                      </div>
                                      <div>
                                        <span className="text-foreground">{s.name}</span>
                                        <span className="text-muted-foreground ml-1.5">({s.category})</span>
                                      </div>
                                    </div>
                                    <span className="text-muted-foreground">£{Number(s.default_price).toFixed(2)}</span>
                                  </div>
                                );
                              })}
                          </div>

                          <button onClick={addCustomService} className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Plus className="h-3 w-3" /> Custom Service
                          </button>

                          {pendingServices.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-foreground">{pendingServices.length} selected:</p>
                              {pendingServices.map((ps, idx) => (
                                <div key={idx} className="flex items-center gap-2 rounded bg-primary/5 px-3 py-1.5 text-xs">
                                  <input value={ps.description} onChange={(e) => updatePendingServiceDesc(idx, e.target.value)}
                                    placeholder="Description"
                                    className="flex-1 bg-transparent text-foreground focus:outline-none" />
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">£</span>
                                    <input type="number" step="0.01" value={ps.price || ""} onChange={(e) => updatePendingServicePrice(ps.description, parseFloat(e.target.value) || 0)}
                                      className="w-16 bg-transparent text-foreground text-right focus:outline-none" />
                                  </div>
                                  <button onClick={() => removePendingService(idx)} className="text-muted-foreground hover:text-destructive">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button onClick={() => handleAddServices(job.id)} disabled={pendingServices.length === 0}
                            className="w-full rounded bg-primary py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                            Add {pendingServices.length} Service{pendingServices.length !== 1 ? "s" : ""}
                          </button>
                        </div>
                      )}

                      {services.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {services.map((s) => (
                            <div key={s.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                              <span className="text-foreground">{s.description}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">£</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={Number(s.price) || ""}
                                  placeholder="0.00"
                                  onBlur={async (e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    if (newPrice !== Number(s.price)) {
                                      await supabase.from("repair_services").update({ price: newPrice }).eq("id", s.id);
                                      fetchData();
                                    }
                                  }}
                                  className="w-20 bg-transparent text-foreground text-right focus:outline-none border-b border-border/50 focus:border-primary"
                                />
                                <button onClick={() => handleRemoveService(s.id)} className="text-muted-foreground hover:text-destructive">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Costs Summary */}
                    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Costs Summary</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground">Parts</span>
                          <span className="text-foreground font-medium">£{partsTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground">Services</span>
                          <span className="text-foreground font-medium">£{servicesTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <span className="text-muted-foreground">Labour</span>
                          <div className="flex items-center gap-0.5">
                            <span className="text-muted-foreground">£</span>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={Number(job.labor_cost) || ""}
                              placeholder="0.00"
                              onBlur={async (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== Number(job.labor_cost)) {
                                  await supabase.from("repair_jobs").update({ labor_cost: val }).eq("id", job.id);
                                  fetchData();
                                }
                              }}
                              className="w-20 bg-transparent text-foreground font-medium focus:outline-none border-b border-border/50 focus:border-primary"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <span className="text-muted-foreground">Final Cost</span>
                          <div className="flex items-center gap-0.5">
                            <span className="text-muted-foreground">£</span>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={Number(job.final_cost) || ""}
                              placeholder={(partsTotal + servicesTotal + (Number(job.labor_cost) || 0)).toFixed(2)}
                              onBlur={async (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== Number(job.final_cost)) {
                                  await supabase.from("repair_jobs").update({ final_cost: val }).eq("id", job.id);
                                  fetchData();
                                }
                              }}
                              className="w-20 bg-transparent text-foreground font-semibold focus:outline-none border-b border-border/50 focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
                      <textarea defaultValue={job.notes || ""} onBlur={(e) => updateField(job.id, "notes", e.target.value)} rows={2}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                        placeholder="Internal notes..." />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground">
                        <span>Received: {new Date(job.received_at).toLocaleDateString("en-GB")}</span>
                        {job.completed_at && <span>Completed: {new Date(job.completed_at).toLocaleDateString("en-GB")}</span>}
                        {job.delivered_at && <span>Delivered: {new Date(job.delivered_at).toLocaleDateString("en-GB")}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {job.payment_status === "paid" ? (
                          <span className="flex items-center gap-1 rounded-full bg-chart-green/20 px-3 py-1 text-xs font-semibold text-chart-green">
                            <CheckCircle className="h-3 w-3" /> Paid {job.invoice_number && `(${job.invoice_number})`}
                          </span>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm("Mark this job as paid? This will generate an invoice number.")) return;
                              await supabase.from("repair_jobs").update({
                                payment_status: "paid",
                                payment_date: new Date().toISOString(),
                              }).eq("id", job.id);
                              await fetchData();
                              toast({ title: "Payment recorded" });
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-chart-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 transition-colors"
                          >
                            <PoundSterling className="h-3.5 w-3.5" /> Mark as Paid
                          </button>
                        )}
                        <button onClick={() => setInvoiceJobId(job.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
                          <FileText className="h-3.5 w-3.5" /> Invoice
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceJobId && (() => {
        const job = jobs.find((j) => j.id === invoiceJobId);
        const customer = customers.find((c) => c.id === job?.customer_id);
        const moto = motorcycles.find((m) => m.id === job?.motorcycle_id);
        const allInvoiceServices = repairServices.filter((s) => s.repair_job_id === invoiceJobId);
        const stockParts = repairParts.filter((p) => p.repair_job_id === invoiceJobId).map((p) => {
          const item = stockItems.find((s) => s.id === p.stock_item_id);
          return { name: item?.name || p.notes || "Unknown", quantity: p.quantity, unit_price: Number(p.unit_price) };
        });
        const manualInvoiceParts = allInvoiceServices
          .filter((s) => s.description.startsWith("[PART]"))
          .map((s) => ({ name: s.description.replace(/^\[PART\]\s*/, ""), quantity: 1, unit_price: Number(s.price) }));
        const parts = [...stockParts, ...manualInvoiceParts];
        const services = allInvoiceServices
          .filter((s) => !s.description.startsWith("[PART]"))
          .map((s) => ({ description: s.description, price: Number(s.price) }));
        if (!job || !customer || !moto) return null;
        return (
          <InvoiceModal
            data={{
              job: {
                id: job.id, job_number: job.job_number, customer_id: job.customer_id, description: job.description,
                estimated_cost: job.estimated_cost, final_cost: job.final_cost,
                labor_cost: job.labor_cost, invoice_number: job.invoice_number,
                payment_status: job.payment_status, received_at: job.received_at,
                completed_at: job.completed_at,
              },
              customer: { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address },
              motorcycle: { registration: moto.registration, make: moto.make, model: moto.model, year: moto.year },
              parts,
              services,
            }}
            onClose={() => setInvoiceJobId(null)}
            onPaid={() => { setInvoiceJobId(null); fetchData(); toast({ title: "Payment recorded & invoice generated" }); }}
          />
        );
      })()}
    </div>
  );
};

export default RepairsPage;
