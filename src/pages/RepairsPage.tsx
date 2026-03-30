import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Wrench, X, ChevronDown, ChevronUp, Clock, CheckCircle, AlertTriangle, Truck, Eye, Settings2, Package, FileText, PoundSterling, Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PlateScanner from "@/components/PlateScanner";
import InvoiceModal from "@/components/InvoiceModal";
import WorkOrderModal from "@/components/WorkOrderModal";
import BackButton from "@/components/BackButton";
import { useRole } from "@/contexts/RoleContext";
import { rankStockItems } from "@/lib/stockSearch";

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
  service_order_number: number | null;
  estimated_completion_date: string | null;
  locked: boolean;
  parts_cost: number | null;
  services_cost: number | null;
}

interface CustomerFull { id: string; name: string; phone: string | null; email: string | null; address: string | null; }
interface Customer { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null; }
interface Motorcycle { id: string; customer_id: string; registration: string; make: string; model: string; year: number | null; }
interface RepairPart { id: string; repair_job_id: string; stock_item_id: string | null; quantity: number; unit_price: number; notes?: string | null; }
interface RepairService { id: string; repair_job_id: string; description: string; price: number; mechanic_id: string | null; commission_percentage: number; commission_value: number; service_type: string; }
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
  const { isOwner } = useRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [customers, setCustomers] = useState<CustomerFull[]>([]);
  const [invoiceJobId, setInvoiceJobId] = useState<string | null>(null);
  const [workOrderJobId, setWorkOrderJobId] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<"services" | "parts" | "summary">("services");
  const [form, setForm] = useState({
    customer_id: "", motorcycle_id: "", description: "", estimated_cost: "", notes: "",
    brand_id: "", model_id: "", registration: "", engine_cc: "", category: "", vehicle_type: "Motorcycle",
    manual_make: "", manual_model: "", estimated_completion_date: "",
  });
  const [pendingParts, setPendingParts] = useState<{ stock_item_id: string; quantity: number; unit_price?: number; name?: string }[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [showAddPart, setShowAddPart] = useState<string | null>(null);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [pendingServices, setPendingServices] = useState<{ description: string; price: number; service_type: string }[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [showAddService, setShowAddService] = useState<string | null>(null);
  const [showNewModelForm, setShowNewModelForm] = useState(false);
  const [newModel, setNewModel] = useState({ model_name: "", category: "Naked", engine_cc: "125cc", vehicle_type: "Motorcycle" });
  const [loading, setLoading] = useState(true);
  const [formServices, setFormServices] = useState<string[]>([]);
  const [formServiceSearch, setFormServiceSearch] = useState("");
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
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "44", email: "", address: "", notes: "" });

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
    setJobs((j as any[]) || []);
    setCustomers(c || []);
    setMotorcycles(m || []);
    setStockItems(s || []);
    setRepairParts(p || []);
    setBrands(b || []);
    setModels((md as Model[]) || []);
    setRepairServices((rs as RepairService[]) || []);
    setServiceCatalog((sc as ServiceCatalogItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const cid = searchParams.get("customer_id");
    const mid = searchParams.get("motorcycle_id");
    if (cid && customers.length > 0 && !showForm) {
      const moto = mid ? motorcycles.find((m) => m.id === mid) : null;
      setForm((prev) => ({ ...prev, customer_id: cid, motorcycle_id: moto?.id || "", registration: moto?.registration || "" }));
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [customers, searchParams]);

  useEffect(() => {
    const jobId = searchParams.get("job_id");
    if (jobId && jobs.length > 0) {
      setExpandedId(jobId);
      setSearchParams({}, { replace: true });
      setTimeout(() => { document.getElementById(`job-${jobId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 200);
    }
  }, [jobs, searchParams]);

  const customerMotos = motorcycles.filter((m) => m.customer_id === form.customer_id);
  const brandModels = models.filter((m) => m.brand_id === form.brand_id);
  

  const handleBrandChange = (brandId: string) => {
    setForm({ ...form, brand_id: brandId, model_id: "", engine_cc: "", category: "", vehicle_type: "Motorcycle" });
  };

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
      toast({ title: `Plate: ${reg}`, description: `${result.make || ""} ${result.model || ""} detected`.trim() });
    }
    setShowForm(true);
  };

  const handleQuickCreateCustomer = async () => {
    if (!newCustomerForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const { data, error } = await supabase.from("customers").insert({
      name: newCustomerForm.name.trim(), phone: newCustomerForm.phone.trim() || null,
      email: newCustomerForm.email.trim() || null, address: newCustomerForm.address.trim() || null,
      notes: newCustomerForm.notes.trim() || null,
    }).select("id, name, phone, email, address").single();
    if (error) { toast({ title: "Error creating customer", description: error.message, variant: "destructive" }); return; }
    setCustomers((prev) => [...prev, data as CustomerFull].sort((a, b) => a.name.localeCompare(b.name)));
    setForm({ ...form, customer_id: data.id, motorcycle_id: "" });
    setShowNewCustomer(false);
    setNewCustomerForm({ name: "", phone: "44", email: "", address: "", notes: "" });
    setCustomerSearch("");
    toast({ title: `Customer "${data.name}" created` });
  };

  const handleCreate = async () => {
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
    if (!motorcycleId && form.registration) {
      const brand = brands.find((b) => b.id === form.brand_id);
      const model = models.find((m) => m.id === form.model_id);
      const makeName = brand?.brand_name || form.manual_make.trim() || "Unknown";
      const modelName = model?.model_name || form.manual_model.trim() || "Unknown";
      const { data: newMoto, error: motoErr } = await supabase.from("motorcycles").insert({
        customer_id: form.customer_id, registration: form.registration.toUpperCase(),
        make: makeName, model: modelName,
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
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      notes: form.notes || null,
      estimated_completion_date: form.estimated_completion_date || null,
      job_number: "TEMP",
    } as any).select("id").single();
    if (error) { toast({ title: "Error creating job", description: error.message, variant: "destructive" }); return; }

    const estimatedPrice = form.estimated_cost ? parseFloat(form.estimated_cost) : 0;
    for (let i = 0; i < validServices.length; i++) {
      await supabase.from("repair_services").insert({
        repair_job_id: newJob.id, description: validServices[i].trim(),
        price: i === 0 ? estimatedPrice : 0,
      } as any);
    }

    addToServiceHistory(validServices);
    toast({ title: "Service order created" });
    setShowForm(false);
    setForm({ customer_id: "", motorcycle_id: "", description: "", estimated_cost: "", notes: "", brand_id: "", model_id: "", registration: "", engine_cc: "", category: "", vehicle_type: "Motorcycle", manual_make: "", manual_model: "", estimated_completion_date: "" });
    setFormServices([]); setFormServiceSearch(""); setCustomerSearch("");
    fetchData();
  };

  const handleCreateModel = async () => {
    if (!form.brand_id || !newModel.model_name.trim()) {
      toast({ title: "Brand and model name required", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.from("motorcycle_models").insert({
      brand_id: form.brand_id, model_name: newModel.model_name,
      category: newModel.category, engine_cc: newModel.engine_cc, vehicle_type: newModel.vehicle_type,
    }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Model created successfully" });
    setShowNewModelForm(false);
    setNewModel({ model_name: "", category: "Naked", engine_cc: "125cc", vehicle_type: "Motorcycle" });
    const { data: md } = await supabase.from("motorcycle_models").select("*").eq("active_status", true).order("model_name");
    setModels((md as Model[]) || []);
    if (data) handleModelSelect(data.id);
  };

  const updateStatus = async (jobId: string, newStatus: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    
    // Check if trying to complete without services
    if (newStatus === "ready" || newStatus === "delivered") {
      const jobServices = repairServices.filter((s) => s.repair_job_id === jobId && !s.description.startsWith("[PART]"));
      if (jobServices.length === 0) {
        toast({ title: "Cannot complete without at least 1 service", variant: "destructive" });
        return;
      }
    }

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "ready") {
      updates.completed_at = new Date().toISOString();
      updates.locked = true;
    }
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
    await supabase.from("repair_jobs").update(updates as any).eq("id", jobId);
    toast({ title: `Status updated to ${getStatusInfo(newStatus).label}` });
    fetchData();
  };

  const updateField = async (jobId: string, field: string, value: string) => {
    await supabase.from("repair_jobs").update({ [field]: value || null } as any).eq("id", jobId);
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
      if (pp.stock_item_id === "__manual__") continue;
      const item = stockItems.find((s) => s.id === pp.stock_item_id);
      await supabase.from("repair_parts").insert({
        repair_job_id: jobId, stock_item_id: pp.stock_item_id, quantity: pp.quantity, unit_price: item?.sell_price || 0,
      });
      await supabase.from("stock_movements").insert({
        stock_item_id: pp.stock_item_id, type: "out", quantity: pp.quantity, reference: "Repair job", notes: "Used in repair",
      });
      // Actually deduct stock quantity
      if (item) {
        const newQty = Math.max(0, item.quantity - pp.quantity);
        await supabase.from("stock_items").update({ quantity: newQty }).eq("id", pp.stock_item_id);
      }
    }
    toast({ title: `${pendingParts.length} part(s) added` });
    setShowAddPart(null); setPendingParts([]); setPartSearch(""); fetchData();
  };

  const handleRemovePart = async (part: RepairPart) => {
    if (!window.confirm("Remove this part? Stock will be returned.")) return;
    await supabase.from("repair_parts").delete().eq("id", part.id);
    if (part.stock_item_id) {
      await supabase.from("stock_movements").insert({
        stock_item_id: part.stock_item_id, type: "in", quantity: part.quantity, notes: "Returned from repair",
      });
      // Return stock quantity
      const item = stockItems.find(s => s.id === part.stock_item_id);
      if (item) {
        await supabase.from("stock_items").update({ quantity: item.quantity + part.quantity }).eq("id", part.stock_item_id);
      }
    }
    toast({ title: "Part removed" }); fetchData();
  };

  const togglePendingService = (svc: ServiceCatalogItem) => {
    setPendingServices((prev) => {
      const exists = prev.find((p) => p.description === svc.name);
      if (exists) return prev.filter((p) => p.description !== svc.name);
      return [...prev, { description: svc.name, price: Number(svc.default_price), service_type: "standard" }];
    });
  };

  const handleAddServices = async (jobId: string) => {
    const valid = pendingServices.filter((s) => s.description.trim() && s.price > 0);
    if (valid.length === 0) { toast({ title: "Add at least one service with description and price", variant: "destructive" }); return; }
    const customDescs = valid.map((s) => s.description.trim()).filter(Boolean);
    addToServiceHistory(customDescs);
    for (const svc of valid) {
      await supabase.from("repair_services").insert({
        repair_job_id: jobId, description: svc.description.trim(), price: svc.price,
        service_type: svc.service_type,
      } as any);
    }
    toast({ title: `${valid.length} service(s) added` });
    setShowAddService(null); setPendingServices([]); setServiceSearch(""); fetchData();
  };

  const handleRemoveService = async (serviceId: string) => {
    if (!window.confirm("Are you sure you want to remove this service?")) return;
    await supabase.from("repair_services").delete().eq("id", serviceId);
    toast({ title: "Service removed" }); fetchData();
  };


  const filtered = jobs.filter((j) => {
    const customer = customers.find((c) => c.id === j.customer_id);
    const moto = motorcycles.find((m) => m.id === j.motorcycle_id);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      j.job_number.toLowerCase().includes(q) ||
      (j.service_order_number && `so-${j.service_order_number}`.includes(q)) ||
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
            <h1 className="text-2xl font-bold text-foreground">Service Orders</h1>
            <p className="text-sm text-muted-foreground">{jobs.length} total • {jobs.filter((j) => !["delivered", "cancelled", "ready"].includes(j.status)).length} active</p>
          </div>
        </div>
        <div className="flex gap-2">
          <PlateScanner onResult={handlePlateResult} />
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" /> New Service Order
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by SO#, job #, customer, registration..."
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
              <h2 className="text-lg font-bold text-foreground">New Service Order</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              {/* Customer searchable */}
              <div className="space-y-1">
                {form.customer_id ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary/50 bg-primary/10 px-3 py-2.5">
                    <span className="text-sm font-medium text-foreground">{customers.find((c) => c.id === form.customer_id)?.name || "Selected"}</span>
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
                        .filter((c) => { if (!customerSearch) return true; const q = customerSearch.toLowerCase(); return c.name.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q); })
                        .map((c) => (
                          <button key={c.id} type="button" onClick={() => { setForm({ ...form, customer_id: c.id, motorcycle_id: "" }); setCustomerSearch(""); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-secondary text-foreground">
                            <span className="font-medium">{c.name}</span>
                            {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                          </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => { setShowNewCustomer(true); setNewCustomerForm({ ...newCustomerForm, name: customerSearch }); }}
                      className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10">
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
                          <button type="button" onClick={() => setShowNewCustomer(false)} className="flex-1 rounded bg-secondary py-2 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                          <button type="button" onClick={handleQuickCreateCustomer} className="flex-1 rounded bg-primary py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">Create</button>
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
                  } else { setForm({ ...form, motorcycle_id: e.target.value }); }
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
                  const historyMatches = savedServiceHistory
                    .filter((h) => h.toLowerCase().includes(q) && !formServices.includes(h))
                    .map((h) => ({ key: `h:${h}`, label: h, isHistory: true }));
                  const catalogMatches = serviceCatalog
                    .filter((s) => (s.name.toLowerCase().includes(q) || s.service_code.toLowerCase().includes(q)) && !formServices.includes(s.name))
                    .map((s) => ({ key: `c:${s.id}`, label: s.name, isHistory: false }));
                  const historyLabels = new Set(historyMatches.map((h) => h.label.toLowerCase()));
                  const combined = [...historyMatches, ...catalogMatches.filter((c) => !historyLabels.has(c.label.toLowerCase()))];
                  if (combined.length === 0) return null;
                  return (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg space-y-0.5 p-1">
                      {combined.map((item) => (
                        <button key={item.key} type="button" onClick={() => { setFormServices((prev) => [...prev, item.label]); setFormServiceSearch(""); }}
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
                {formServices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formServices.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                        {name}
                        <button type="button" onClick={() => setFormServices((prev) => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <input type="number" step="0.01" placeholder="Estimated Cost (£)" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />

              <input type="date" value={form.estimated_completion_date} onChange={(e) => setForm({ ...form, estimated_completion_date: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none [color-scheme:dark]" />

              {/* Motorcycle fields */}
              {!form.motorcycle_id && (
                <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motorcycle Details</p>
                  <input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })}
                    placeholder="Registration *" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                  <select value={form.brand_id} onChange={(e) => handleBrandChange(e.target.value)}
                    className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">Select Brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
                  </select>
                  {form.brand_id && (
                    <>
                      <select value={form.model_id} onChange={(e) => handleModelSelect(e.target.value)}
                        className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none">
                        <option value="">Select Model</option>
                        {brandModels.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowNewModelForm(!showNewModelForm)}
                        className="text-xs text-primary hover:underline"><Plus className="inline h-3 w-3" /> New Model</button>
                      {showNewModelForm && (
                        <div className="space-y-2 rounded-lg border border-primary/30 bg-card p-3">
                          <input value={newModel.model_name} onChange={(e) => setNewModel({ ...newModel, model_name: e.target.value })}
                            placeholder="Model Name" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                          <div className="flex gap-2">
                            <select value={newModel.category} onChange={(e) => setNewModel({ ...newModel, category: e.target.value })}
                              className="flex-1 rounded border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                              {categories.map((c) => <option key={c}>{c}</option>)}
                            </select>
                            <select value={newModel.engine_cc} onChange={(e) => setNewModel({ ...newModel, engine_cc: e.target.value })}
                              className="flex-1 rounded border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                              {engineCcOptions.map((cc) => <option key={cc}>{cc}</option>)}
                            </select>
                          </div>
                          <button type="button" onClick={handleCreateModel}
                            className="w-full rounded bg-primary py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">Create Model</button>
                        </div>
                      )}
                    </>
                  )}
                  {!form.brand_id && (
                    <>
                      <input value={form.manual_make} onChange={(e) => setForm({ ...form, manual_make: e.target.value })}
                        placeholder="Or type Make manually" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                      <input value={form.manual_model} onChange={(e) => setForm({ ...form, manual_model: e.target.value })}
                        placeholder="Model name" className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                    </>
                  )}
                </div>
              )}

              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none" />

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg bg-secondary py-2.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
                <button onClick={handleCreate} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">Create Service Order</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Jobs List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No service orders found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => {
            const customer = customers.find((c) => c.id === job.customer_id);
            const moto = motorcycles.find((m) => m.id === job.motorcycle_id);
            const statusInfo = getStatusInfo(job.status);
            const isExpanded = expandedId === job.id;
            const parts = repairParts.filter((p) => p.repair_job_id === job.id);
            const allJobServices = repairServices.filter((s) => s.repair_job_id === job.id);
            const manualParts = allJobServices.filter((s) => s.description.startsWith("[PART]"));
            const services = allJobServices.filter((s) => !s.description.startsWith("[PART]"));
            const stockPartsTotal = parts.reduce((s, p) => s + p.quantity * Number(p.unit_price), 0);
            const manualPartsTotal = manualParts.reduce((s, sv) => s + Number(sv.price), 0);
            const partsTotal = stockPartsTotal + manualPartsTotal;
            const servicesTotal = services.reduce((s, sv) => s + Number(sv.price), 0);
            const effectiveParts = Number(job.parts_cost) || partsTotal;
            const effectiveSvcs = Number(job.services_cost) || servicesTotal;
            const labor = Number(job.labor_cost) || 0;
            const calculated = effectiveParts + effectiveSvcs + labor;
            const displayVal = Number(job.final_cost) > 0 ? Number(job.final_cost) : calculated > 0 ? calculated : Number(job.estimated_cost) || 0;
            
            const isLocked = job.locked;

            return (
              <motion.div key={job.id} id={`job-${job.id}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border bg-card overflow-hidden ${isLocked ? "border-chart-amber/30" : "border-border"}`}>
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => { setExpandedId(isExpanded ? null : job.id); setActiveTab("services"); }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{job.job_number}</span>
                      {job.service_order_number && <span className="text-xs font-mono text-primary">SO-{String(job.service_order_number).padStart(5, "0")}</span>}
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
                        <statusInfo.icon className="h-2.5 w-2.5" /> {statusInfo.label}
                      </span>
                      {isLocked && <Lock className="h-3 w-3 text-chart-amber" />}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mt-0.5">{customer?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{moto?.registration} — {moto?.make} {moto?.model} · {job.description}</p>
                  </div>
                  {displayVal > 0 && <span className="text-sm font-medium text-foreground hidden sm:inline">£{displayVal.toFixed(2)}</span>}
                  <button onPointerDown={() => setExpandedId(isExpanded ? null : job.id)} className="rounded p-2 text-muted-foreground hover:bg-secondary" style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-secondary/30 p-4 space-y-4">
                    {/* Status buttons */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update Status</label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {statuses.map((s) => (
                          <button key={s.value} onClick={() => !isLocked || s.value === "delivered" ? updateStatus(job.id, s.value) : null}
                            disabled={isLocked && s.value !== "delivered"}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${job.status === s.value ? `${s.color} ring-1 ring-primary` : "bg-secondary text-muted-foreground hover:bg-secondary/80"} ${isLocked && s.value !== "delivered" ? "opacity-40 cursor-not-allowed" : ""}`}>
                            <s.icon className="h-3 w-3" /> {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-border">
                      {(["services", "parts", "summary"] as const).map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                          {tab === "services" ? "Services" : tab === "parts" ? "Parts" : "Summary"}
                        </button>
                      ))}
                    </div>

                    {/* TAB: Services */}
                    {activeTab === "services" && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <Settings2 className="inline h-3 w-3 mr-1" />Services {services.length > 0 && `(£${servicesTotal.toFixed(2)})`}
                          </label>
                          <div className="flex items-center gap-2">
                            {!isLocked && (
                              <>
                                <button onClick={() => { setShowAddPart(showAddPart === job.id ? null : job.id); setShowAddService(null); }}
                                  className="text-xs font-semibold text-primary hover:brightness-125 flex items-center gap-1">
                                  <Package className="h-3 w-3" /> Add Parts
                                </button>
                                <button onClick={() => { setShowAddService(showAddService === job.id ? null : job.id); setShowAddPart(null); }}
                                  className="text-xs font-semibold text-primary hover:brightness-125 flex items-center gap-1">
                                  <Plus className="h-3 w-3" /> Add Service
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Inline Parts Search (from Services tab) */}
                        {showAddPart === job.id && !isLocked && (
                          <div className="mt-2 space-y-2 mb-4 rounded-lg border border-border/50 bg-secondary/20 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Package className="h-3 w-3" /> Add Stock Parts (deducts from inventory)
                            </p>
                            <div className="relative">
                              <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                                <input value={partSearch} onChange={(e) => setPartSearch(e.target.value)}
                                  placeholder="Search stock parts..."
                                  onKeyDown={(e) => { if (e.key === "Escape") setPartSearch(""); }}
                                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                                {partSearch.trim() && (
                                  <button onClick={() => setPartSearch("")} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3 w-3" /></button>
                                )}
                              </div>
                              {partSearch.trim().length > 0 && (() => {
                                const stockMatches = rankStockItems<StockItem>(stockItems, partSearch);
                                if (stockMatches.length === 0) return <p className="text-[10px] text-muted-foreground mt-1">No stock items found for "{partSearch}"</p>;
                                return (
                                  <div className="rounded border border-border bg-card shadow-lg mt-0.5 max-h-60 overflow-y-auto">
                                    {stockMatches.map((s) => {
                                      const alreadyAdded = parts.some((p) => p.stock_item_id === s.id);
                                      return (
                                        <div key={`s-${s.id}`} onClick={async () => {
                                          if (alreadyAdded || s.quantity <= 0) return;
                                          // Directly add part to repair
                                          await supabase.from("repair_parts").insert({
                                            repair_job_id: job.id, stock_item_id: s.id, quantity: 1, unit_price: s.sell_price || 0,
                                          });
                                          await supabase.from("stock_movements").insert({
                                            stock_item_id: s.id, type: "out", quantity: 1, reference: "Repair job", notes: "Used in repair",
                                          });
                                          await supabase.from("stock_items").update({ quantity: Math.max(0, s.quantity - 1) }).eq("id", s.id);
                                          toast({ title: `"${s.name}" added to repair` });
                                          setPartSearch("");
                                          fetchData();
                                        }}
                                          className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer border-b border-border/30 last:border-0 ${alreadyAdded ? "opacity-40 cursor-not-allowed bg-secondary/30" : "hover:bg-secondary/50"} ${s.quantity <= 0 ? "opacity-30 cursor-not-allowed" : ""}`}>
                                          <div className="flex items-center gap-2">
                                            {alreadyAdded && <CheckCircle className="h-3 w-3 text-chart-green" />}
                                            <span className="text-foreground">{s.name}</span>
                                            {s.sku && <span className="text-muted-foreground">({s.sku})</span>}
                                            {alreadyAdded && <span className="text-[10px] text-chart-green">already added</span>}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className={`text-muted-foreground text-[10px] ${s.quantity <= 0 ? "text-destructive font-bold" : ""}`}>qty: {s.quantity}</span>
                                            <span className="rounded bg-chart-blue/10 px-1.5 py-0.5 text-chart-blue text-[10px]">£{Number(s.sell_price).toFixed(2)}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {showAddService === job.id && !isLocked && (
                          <div className="mt-2 space-y-2 mb-4">
                            <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                              <Search className="h-3 w-3 text-muted-foreground" />
                              <input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)}
                                placeholder="Search services..."
                                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                            </div>
                            <div className="max-h-40 overflow-y-auto rounded border border-border bg-card">
                              {serviceSearch.trim() && (() => {
                                const q = serviceSearch.toLowerCase();
                                const catalogNames = serviceCatalog.map((s) => s.name.toLowerCase());
                                const histMatches = savedServiceHistory.filter((h) =>
                                  h.toLowerCase().includes(q) && !catalogNames.includes(h.toLowerCase())
                                );
                                return histMatches.slice(0, 5).map((h) => {
                                  const selected = pendingServices.find((p) => p.description.toLowerCase() === h.toLowerCase());
                                  return (
                                    <div key={`hist-${h}`} onClick={() => {
                                      if (selected) {
                                        setPendingServices((prev) => prev.filter((p) => p.description.toLowerCase() !== h.toLowerCase()));
                                      } else {
                                        setPendingServices((prev) => [...prev, { description: h, price: 0, service_type: "standard" }]);
                                      }
                                    }}
                                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border/30 last:border-0 ${selected ? "bg-primary/10" : ""}`}>
                                      <div className="flex items-center gap-2">
                                        <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-border"}`}>
                                          {selected && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                                        </div>
                                        <span className="text-foreground">{h}</span>
                                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-[10px]">saved</span>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
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
                                        <span className="text-foreground">{s.name}</span>
                                        <span className="text-muted-foreground">({s.category})</span>
                                      </div>
                                      <span className="text-muted-foreground">£{Number(s.default_price).toFixed(2)}</span>
                                    </div>
                                  );
                                })}
                            </div>

                            <button onClick={() => setPendingServices((prev) => [...prev, { description: "", price: 0, service_type: "standard" }])}
                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <Plus className="h-3 w-3" /> Custom Service
                            </button>

                            {pendingServices.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-foreground">{pendingServices.length} selected:</p>
                                {pendingServices.map((ps, idx) => (
                                  <div key={idx} className="rounded bg-primary/5 px-3 py-2 space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs">
                                      <input value={ps.description} onChange={(e) => setPendingServices((prev) => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                                        placeholder="Description" className="flex-1 bg-transparent text-foreground focus:outline-none" />
                                      <span className="text-muted-foreground">£</span>
                                      <input type="number" step="0.01" value={ps.price || ""} onChange={(e) => setPendingServices((prev) => prev.map((p, i) => i === idx ? { ...p, price: parseFloat(e.target.value) || 0 } : p))}
                                        className="w-16 bg-transparent text-foreground text-right focus:outline-none" />
                                      <button onClick={() => setPendingServices((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <select value={ps.service_type} onChange={(e) => setPendingServices((prev) => prev.map((p, i) => i === idx ? { ...p, service_type: e.target.value } : p))}
                                        className="rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground">
                                        <option value="standard">Standard</option>
                                        <option value="extra">Extra</option>
                                      </select>
                                    </div>
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

                        {/* Existing Parts (shown in services tab) */}
                        {parts.length > 0 && (
                          <div className="mb-2">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                              <Package className="inline h-3 w-3 mr-1" />Parts Used (£{partsTotal.toFixed(2)})
                            </label>
                            <div className="space-y-1">
                              {parts.map((p) => {
                                const item = stockItems.find((s) => s.id === p.stock_item_id);
                                return (
                                  <div key={p.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                                    <span className="text-foreground">{item?.name || "Unknown"} × {p.quantity}</span>
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-muted-foreground">£{(Number(p.unit_price) * p.quantity).toFixed(2)}</span>
                                      {!isLocked && (
                                        <button onClick={(e) => { e.stopPropagation(); handleRemovePart(p); }} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {manualParts.map((s) => (
                                <div key={s.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                                  <span className="text-foreground">{s.description.replace(/^\[PART\]\s*/, "")}</span>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-muted-foreground">£{Number(s.price).toFixed(2)}</span>
                                    {!isLocked && (
                                      <button onClick={(e) => { e.stopPropagation(); handleRemoveService(s.id); }} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {services.length > 0 && (
                          <div className="space-y-1">
                            {services.map((s) => {
                              return (
                                <div key={s.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                      <input type="text" defaultValue={s.description} disabled={isLocked}
                                        onBlur={async (e) => {
                                          const newDesc = e.target.value.trim();
                                          if (newDesc && newDesc !== s.description) {
                                            await supabase.from("repair_services").update({ description: newDesc } as any).eq("id", s.id);
                                            fetchData();
                                          }
                                        }}
                                        className="bg-transparent text-foreground focus:outline-none border-b border-transparent focus:border-primary w-full disabled:opacity-80" />
                                      {s.service_type === "extra" && (
                                        <span className="rounded bg-chart-amber/20 px-1.5 py-0.5 text-[10px] font-medium text-chart-amber shrink-0">Extra</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                                    <span className="text-muted-foreground">£</span>
                                    <input type="number" inputMode="decimal" step="0.01" defaultValue={Number(s.price) || ""}
                                      placeholder="0.00" disabled={isLocked}
                                      onBlur={async (e) => {
                                        const newPrice = parseFloat(e.target.value) || 0;
                                        if (newPrice !== Number(s.price)) {
                                          await supabase.from("repair_services").update({ price: newPrice } as any).eq("id", s.id);
                                          fetchData();
                                        }
                                      }}
                                      className="w-20 bg-transparent text-foreground text-right focus:outline-none border-b border-border/50 focus:border-primary min-h-[36px] disabled:opacity-50" />
                                    {!isLocked && (
                                      <button onClick={(e) => { e.stopPropagation(); handleRemoveService(s.id); }} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: Parts */}
                    {activeTab === "parts" && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <Package className="inline h-3 w-3 mr-1" />Parts {(parts.length + manualParts.length) > 0 && `(£${partsTotal.toFixed(2)})`}
                          </label>
                          {!isLocked && (
                            <button onClick={() => setShowAddPart(showAddPart === job.id ? null : job.id)}
                              className="text-xs font-semibold text-primary hover:brightness-125 flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Add Parts
                            </button>
                          )}
                        </div>

                        {showAddPart === job.id && !isLocked && (
                          <div className="mt-2 space-y-2 mb-4">
                            <div className="relative">
                              <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                                <input value={partSearch} onChange={(e) => setPartSearch(e.target.value)}
                                  placeholder="Part name..."
                                  onKeyDown={(e) => { if (e.key === "Escape") setPartSearch(""); }}
                                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                                {partSearch.trim() && (
                                  <button onClick={() => setPartSearch("")} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3 w-3" /></button>
                                )}
                              </div>
                          {partSearch.trim().length > 0 && (() => {
                                const savedParts: string[] = (() => { try { return JSON.parse(localStorage.getItem("tw_parts_history") || "[]"); } catch { return []; } })();
                                const q = partSearch.toLowerCase();
                                const historyMatches = savedParts.filter((p) => p.toLowerCase().includes(q) && p.toLowerCase() !== q);
                                const stockMatches = rankStockItems<StockItem>(stockItems, partSearch);
                                if (historyMatches.length === 0 && stockMatches.length === 0) return null;
                                return (
                                  <div className="rounded border border-border bg-card shadow-lg mt-0.5 max-h-60 overflow-y-auto">
                                    {stockMatches.map((s) => {
                                      const alreadyAdded = parts.some((p) => p.stock_item_id === s.id);
                                      return (
                                        <div key={`s-${s.id}`} onClick={async () => {
                                          if (alreadyAdded || s.quantity <= 0) return;
                                          await supabase.from("repair_parts").insert({
                                            repair_job_id: job.id, stock_item_id: s.id, quantity: 1, unit_price: s.sell_price || 0,
                                          });
                                          await supabase.from("stock_movements").insert({
                                            stock_item_id: s.id, type: "out", quantity: 1, reference: "Repair job", notes: "Used in repair",
                                          });
                                          await supabase.from("stock_items").update({ quantity: Math.max(0, s.quantity - 1) }).eq("id", s.id);
                                          toast({ title: `"${s.name}" added to repair` });
                                          setPartSearch("");
                                          fetchData();
                                        }}
                                          className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer border-b border-border/30 last:border-0 ${alreadyAdded ? "opacity-40 cursor-not-allowed bg-secondary/30" : "hover:bg-secondary/50"} ${s.quantity <= 0 ? "opacity-30 cursor-not-allowed" : ""}`}>
                                          <div className="flex items-center gap-2">
                                            {alreadyAdded && <CheckCircle className="h-3 w-3 text-chart-green" />}
                                            <span className="text-foreground">{s.name}</span>
                                            {s.sku && <span className="text-muted-foreground">({s.sku})</span>}
                                            {alreadyAdded && <span className="text-[10px] text-chart-green">already added</span>}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className={`text-muted-foreground text-[10px] ${s.quantity <= 0 ? "text-destructive font-bold" : ""}`}>qty: {s.quantity}</span>
                                            <span className="rounded bg-chart-blue/10 px-1.5 py-0.5 text-chart-blue text-[10px]">£{Number(s.sell_price).toFixed(2)}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {historyMatches.slice(0, 4).map((p) => (
                                      <div key={`h-${p}`} onClick={() => setPartSearch(p)}
                                        className="flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border/30 last:border-0">
                                        <span className="text-foreground">{p}</span>
                                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-[10px]">saved</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Manual part entry */}
                            <div className="border-t border-border/50 pt-2 mt-2">
                              <p className="text-[10px] text-muted-foreground mb-1">Or add a manual part (won't deduct stock):</p>
                              <div className="flex gap-2">
                                <input value={pendingParts.find((p) => p.stock_item_id === "__manual__")?.name || partSearch}
                                  onChange={(e) => {
                                    setPartSearch(e.target.value);
                                    setPendingParts((prev) => {
                                      const exists = prev.find((p) => p.stock_item_id === "__manual__");
                                      if (exists) return prev.map((p) => p.stock_item_id === "__manual__" ? { ...p, name: e.target.value } : p);
                                      return prev;
                                    });
                                  }}
                                  placeholder="Part name" className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                                <input value={pendingParts.find((p) => p.stock_item_id === "__manual__")?.unit_price?.toString() || ""}
                                  onChange={(e) => {
                                    const price = e.target.value;
                                    setPendingParts((prev) => {
                                      const exists = prev.find((p) => p.stock_item_id === "__manual__");
                                      if (exists) return prev.map((p) => p.stock_item_id === "__manual__" ? { ...p, unit_price: parseFloat(price) || 0 } : p);
                                      return [...prev, { stock_item_id: "__manual__", quantity: 1, unit_price: parseFloat(price) || 0, name: partSearch.trim() }];
                                    });
                                  }}
                                  placeholder="£" type="number" min="0" step="0.01"
                                  className="w-20 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
                                <button
                                  onClick={async () => {
                                    const manualEntry = pendingParts.find((p) => p.stock_item_id === "__manual__");
                                    const name = manualEntry?.name?.trim() || partSearch.trim();
                                    if (!name) { toast({ title: "Enter a part name", variant: "destructive" }); return; }
                                    const price = manualEntry?.unit_price || 0;
                                    const qty = manualEntry?.quantity || 1;
                                    await supabase.from("repair_services").insert({
                                      repair_job_id: job.id, description: `[PART] ${name}`, price: price * qty,
                                    } as any);
                                    const saved: string[] = (() => { try { return JSON.parse(localStorage.getItem("tw_parts_history") || "[]"); } catch { return []; } })();
                                    if (!saved.includes(name)) { localStorage.setItem("tw_parts_history", JSON.stringify([...saved, name])); }
                                    toast({ title: `"${name}" added (manual)` });
                                    setShowAddPart(null); setPendingParts([]); setPartSearch(""); fetchData();
                                  }}
                                  className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80">
                                  + Manual
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {(parts.length > 0 || manualParts.length > 0) && (
                          <div className="space-y-1">
                            {parts.map((p) => {
                              const item = stockItems.find((s) => s.id === p.stock_item_id);
                              return (
                                <div key={p.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                                  <span className="text-foreground">{item?.name || "Unknown"} × {p.quantity}</span>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-muted-foreground">£</span>
                                    <input type="number" inputMode="decimal" step="0.01" defaultValue={Number(p.unit_price) || ""}
                                      placeholder="0.00" disabled={isLocked}
                                      onBlur={async (e) => {
                                        const newPrice = parseFloat(e.target.value) || 0;
                                        if (newPrice !== Number(p.unit_price)) {
                                          await supabase.from("repair_parts").update({ unit_price: newPrice }).eq("id", p.id);
                                          fetchData();
                                        }
                                      }}
                                      className="w-20 bg-transparent text-foreground text-right focus:outline-none border-b border-border/50 focus:border-primary min-h-[36px] disabled:opacity-50" />
                                    {!isLocked && (
                                      <button onClick={(e) => { e.stopPropagation(); handleRemovePart(p); }} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {manualParts.map((s) => (
                              <div key={s.id} className="flex items-center justify-between rounded bg-card px-3 py-2 text-xs">
                                <span className="text-foreground">{s.description.replace(/^\[PART\]\s*/, "")}</span>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-muted-foreground">£</span>
                                  <input type="number" inputMode="decimal" step="0.01" defaultValue={Number(s.price) || ""}
                                    placeholder="0.00" disabled={isLocked}
                                    onBlur={async (e) => {
                                      const newPrice = parseFloat(e.target.value) || 0;
                                      if (newPrice !== Number(s.price)) {
                                        await supabase.from("repair_services").update({ price: newPrice } as any).eq("id", s.id);
                                        fetchData();
                                      }
                                    }}
                                    className="w-20 bg-transparent text-foreground text-right focus:outline-none border-b border-border/50 focus:border-primary min-h-[36px] disabled:opacity-50" />
                                  {!isLocked && (
                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveService(s.id); }} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: Summary */}
                    {activeTab === "summary" && (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Costs Summary</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-muted-foreground">Parts</span>
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground">£</span>
                                <input key={`parts-${job.id}-${job.parts_cost}`} type="number" step="0.01"
                                  defaultValue={job.parts_cost != null && Number(job.parts_cost) !== 0 ? Number(job.parts_cost) : ""}
                                  placeholder={partsTotal.toFixed(2)} disabled={isLocked}
                                  onBlur={async (e) => {
                                    const raw = e.target.value.trim();
                                    const val = raw === "" ? null : parseFloat(raw) || null;
                                    await supabase.from("repair_jobs").update({ parts_cost: val } as any).eq("id", job.id);
                                    fetchData();
                                  }}
                                  className="w-20 bg-transparent text-foreground font-medium focus:outline-none border-b border-border/50 focus:border-primary disabled:opacity-50" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-muted-foreground">Services</span>
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground">£</span>
                                <input key={`svcs-${job.id}-${job.services_cost}`} type="number" step="0.01"
                                  defaultValue={job.services_cost != null && Number(job.services_cost) !== 0 ? Number(job.services_cost) : ""}
                                  placeholder={servicesTotal.toFixed(2)} disabled={isLocked}
                                  onBlur={async (e) => {
                                    const raw = e.target.value.trim();
                                    const val = raw === "" ? null : parseFloat(raw) || null;
                                    await supabase.from("repair_jobs").update({ services_cost: val } as any).eq("id", job.id);
                                    fetchData();
                                  }}
                                  className="w-20 bg-transparent text-foreground font-medium focus:outline-none border-b border-border/50 focus:border-primary disabled:opacity-50" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-muted-foreground">Labour</span>
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground">£</span>
                                <input key={`labor-${job.id}-${job.labor_cost}`} type="number" step="0.01"
                                  defaultValue={Number(job.labor_cost) || ""} placeholder="0.00" disabled={isLocked}
                                  onBlur={async (e) => {
                                    const raw = e.target.value.trim();
                                    const val = raw === "" ? 0 : parseFloat(raw) || 0;
                                    if (val !== Number(job.labor_cost)) {
                                      await supabase.from("repair_jobs").update({ labor_cost: val }).eq("id", job.id);
                                      fetchData();
                                    }
                                  }}
                                  className="w-20 bg-transparent text-foreground font-medium focus:outline-none border-b border-border/50 focus:border-primary disabled:opacity-50" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-muted-foreground">Final Cost</span>
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground">£</span>
                                <input key={`final-${job.id}-${job.final_cost}`} type="number" step="0.01"
                                  defaultValue={job.final_cost != null && Number(job.final_cost) !== 0 ? Number(job.final_cost) : ""}
                                  placeholder={calculated.toFixed(2)} disabled={isLocked}
                                  onBlur={async (e) => {
                                    const raw = e.target.value.trim();
                                    const val = raw === "" ? null : parseFloat(raw) || null;
                                    await supabase.from("repair_jobs").update({ final_cost: val }).eq("id", job.id);
                                    fetchData();
                                  }}
                                  className="w-20 bg-transparent text-foreground font-semibold focus:outline-none border-b border-border/50 focus:border-primary disabled:opacity-50" />
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* Notes & Footer - always visible */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
                      <textarea defaultValue={job.notes || ""} onBlur={(e) => updateField(job.id, "notes", e.target.value)} rows={2}
                        disabled={isLocked}
                        className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none disabled:opacity-50"
                        placeholder="Internal notes..." />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground">
                        <span>Received: {new Date(job.received_at).toLocaleDateString("en-GB")}</span>
                        {job.estimated_completion_date && <span>Est. Completion: {new Date(job.estimated_completion_date).toLocaleDateString("en-GB")}</span>}
                        {job.completed_at && <span>Completed: {new Date(job.completed_at).toLocaleDateString("en-GB")}</span>}
                        {job.delivered_at && <span>Delivered: {new Date(job.delivered_at).toLocaleDateString("en-GB")}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLocked && isOwner && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            const msg = job.payment_status === "paid"
                              ? "This SO is already paid. Reopen anyway for editing?"
                              : "Reopen this Service Order? It will be unlocked for editing.";
                            if (!window.confirm(msg)) return;
                            await supabase.from("repair_jobs").update({ locked: false, status: "in_repair", completed_at: null } as any).eq("id", job.id);
                            await fetchData();
                            toast({ title: "Service Order reopened" });
                          }}
                            className="flex items-center gap-1.5 rounded-lg bg-chart-amber px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                            <Unlock className="h-3.5 w-3.5" /> Reopen
                          </button>
                        )}
                        {!isLocked && (
                          <button onClick={() => updateStatus(job.id, "ready")}
                            className="flex items-center gap-1.5 rounded-lg bg-chart-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                            <CheckCircle className="h-3.5 w-3.5" /> Mark Completed
                          </button>
                        )}
                        {job.payment_status === "paid" ? (
                          <span className="flex items-center gap-1 rounded-full bg-chart-green/20 px-3 py-1 text-xs font-semibold text-chart-green">
                            <CheckCircle className="h-3 w-3" /> Paid {job.invoice_number && `(${job.invoice_number})`}
                          </span>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm("Mark this job as paid?")) return;
                              await supabase.from("repair_jobs").update({ payment_status: "paid", payment_date: new Date().toISOString() }).eq("id", job.id);
                              await fetchData();
                              toast({ title: "Payment recorded" });
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-chart-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                            <PoundSterling className="h-3.5 w-3.5" /> Mark as Paid
                          </button>
                        )}
                        <button onClick={() => setWorkOrderJobId(job.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:brightness-110 border border-border">
                          <Wrench className="h-3.5 w-3.5" /> Work Order
                        </button>
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
          return { name: item?.name || "Unknown", quantity: p.quantity, unit_price: Number(p.unit_price) };
        });
        const manualInvoiceParts = allInvoiceServices
          .filter((s) => s.description.startsWith("[PART]"))
          .map((s) => ({ name: s.description.replace(/^\[PART\]\s*/, ""), quantity: 1, unit_price: Number(s.price) }));
        const iParts = [...stockParts, ...manualInvoiceParts];
        const iServices = allInvoiceServices
          .filter((s) => !s.description.startsWith("[PART]"))
          .map((s) => ({ description: s.description, price: Number(s.price) }));
        if (!job || !customer || !moto) return null;
        return (
          <InvoiceModal
            data={{
              job: {
                id: job.id, job_number: job.service_order_number ? `SO-${String(job.service_order_number).padStart(5, "0")}` : job.job_number,
                customer_id: job.customer_id, description: job.description,
                estimated_cost: job.estimated_cost, final_cost: job.final_cost,
                labor_cost: job.labor_cost, invoice_number: job.invoice_number,
                payment_status: job.payment_status, received_at: job.received_at,
                completed_at: job.completed_at,
              },
              customer: { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address },
              motorcycle: { registration: moto.registration, make: moto.make, model: moto.model, year: moto.year },
              parts: iParts,
              services: iServices,
            }}
            onClose={() => setInvoiceJobId(null)}
            onPaid={() => { setInvoiceJobId(null); fetchData(); toast({ title: "Payment recorded & invoice generated" }); }}
          />
        );
      })()}

      {/* Work Order Modal */}
      {workOrderJobId && (() => {
        const job = jobs.find((j) => j.id === workOrderJobId);
        const customer = customers.find((c) => c.id === job?.customer_id);
        const moto = motorcycles.find((m) => m.id === job?.motorcycle_id);
        if (!job || !customer || !moto) return null;
        const allSvcs = repairServices.filter((s) => s.repair_job_id === workOrderJobId);
        const woServices = allSvcs
          .filter((s) => !s.description.startsWith("[PART]"))
          .map((s) => {
            return { description: s.description, mechanic_name: null, service_type: s.service_type };
          });
        const stockParts = repairParts.filter((p) => p.repair_job_id === workOrderJobId).map((p) => {
          const item = stockItems.find((s) => s.id === p.stock_item_id);
          return { name: item?.name || "Unknown", quantity: p.quantity };
        });
        const manualParts = allSvcs
          .filter((s) => s.description.startsWith("[PART]"))
          .map((s) => ({ name: s.description.replace(/^\[PART\]\s*/, ""), quantity: 1 }));
        return (
          <WorkOrderModal
            data={{
              job: {
                id: job.id,
                job_number: job.job_number,
                service_order_number: job.service_order_number,
                description: job.description,
                received_at: job.received_at,
                estimated_completion_date: job.estimated_completion_date,
                notes: job.notes,
              },
              customer: { name: customer.name, phone: customer.phone },
              motorcycle: { registration: moto.registration, make: moto.make, model: moto.model, year: moto.year },
              services: woServices,
              parts: [...stockParts, ...manualParts],
            }}
            onClose={() => setWorkOrderJobId(null)}
          />
        );
      })()}
    </div>
  );
};

export default RepairsPage;
