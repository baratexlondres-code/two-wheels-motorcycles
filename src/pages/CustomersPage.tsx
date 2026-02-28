import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Users, Phone, Mail, MapPin, Bike, Edit2, Trash2, X, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CustomerDetailView from "@/components/CustomerDetailView";
import PlateScanner from "@/components/PlateScanner";
import BackButton from "@/components/BackButton";

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

const emptyCustomer = { name: "", phone: "", email: "", address: "", notes: "" };
const emptyVehicle = { registration: "", make: "", model: "", color: "" };

const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("motorcycles").select("*"),
    ]);
    setCustomers(c || []);
    setMotorcycles(m || []);
    setLoading(false);
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);

  // Auto-select customer from URL param (e.g. /customers?id=xxx)
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && customers.length > 0 && !selectedCustomer) {
      const c = customers.find((c) => c.id === id);
      if (c) {
        setSelectedCustomer(c);
        setSearchParams({}, { replace: true });
      }
    }
  }, [customers, searchParams]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    let customerId = editingId;
    if (editingId) {
      await supabase.from("customers").update(form).eq("id", editingId);
      toast({ title: "Customer updated" });
    } else {
      const { data, error } = await supabase.from("customers").insert(form).select("id").single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      customerId = data.id;
      toast({ title: "Customer added" });
    }
    // Create motorcycle if registration was filled (new customer or editing)
    let newMotorcycleId: string | null = null;
    if (vehicleForm.registration.trim() && customerId) {
      const { data: newMoto } = await supabase.from("motorcycles").insert({
        customer_id: customerId,
        registration: vehicleForm.registration.toUpperCase().trim(),
        make: vehicleForm.make.trim() || "Unknown",
        model: vehicleForm.model.trim() || "Unknown",
        color: vehicleForm.color.trim() || null,
      }).select("id").single();
      newMotorcycleId = newMoto?.id || null;
    }
    const wasNew = !editingId;
    const savedCustomerId = customerId;
    setShowForm(false); setEditingId(null); setForm(emptyCustomer); setVehicleForm(emptyVehicle); fetchData();
    // After creating a NEW customer, navigate to New Repair Job with pre-filled data
    if (wasNew && savedCustomerId) {
      const params = new URLSearchParams({ customer_id: savedCustomerId });
      if (newMotorcycleId) params.set("motorcycle_id", newMotorcycleId);
      navigate(`/repairs?${params.toString()}`);
    }
  };

  const handleDelete = async (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (!window.confirm(`Are you sure you want to delete "${customer?.name}"? This will also remove all their motorcycles and repair history.`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting customer", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Customer deleted" });
    fetchData();
  };

  const handleEdit = (c: Customer) => {
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", notes: c.notes || "" });
    setEditingId(c.id); setShowForm(true); setSelectedCustomer(null);
  };

  const handlePlateResult = async (result: { registration: string; make?: string | null; model?: string | null; color?: string | null }) => {
    const reg = result.registration.toUpperCase().trim();
    const existingMoto = motorcycles.find((m) => m.registration.toUpperCase().replace(/\s/g, "") === reg.replace(/\s/g, ""));
    if (existingMoto) {
      const customer = customers.find((c) => c.id === existingMoto.customer_id);
      if (customer) {
        setSelectedCustomer(customer);
        toast({ title: `Found: ${customer.name}`, description: `${existingMoto.make} ${existingMoto.model} — ${existingMoto.registration}` });
      }
    } else {
      // No existing motorcycle — open add customer form with plate data in vehicle fields
      toast({ title: `Plate: ${reg}`, description: `Not registered. Fill in the customer details.` });
      setVehicleForm({
        registration: reg,
        make: result.make || "",
        model: result.model || "",
        color: result.color || "",
      });
      setForm(emptyCustomer);
      setEditingId(null);
      setShowForm(true);
    }
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const motos = motorcycles.filter((m) => m.customer_id === c.id);
    return c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      motos.some((m) => m.make.toLowerCase().includes(q) || m.model.toLowerCase().includes(q) || m.registration.toLowerCase().includes(q));
  });

  // Detail view
  if (selectedCustomer) {
    return (
      <CustomerDetailView
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
        onEdit={handleEdit}
        onRefresh={fetchData}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-sm text-muted-foreground">{customers.length} registered customers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <PlateScanner onResult={handlePlateResult} />
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyCustomer); setVehicleForm(emptyVehicle); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit Customer" : "New Customer"}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" />
              
              {/* Vehicle section */}
              {!editingId && (
                <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Bike className="h-3 w-3" /> Vehicle (optional)
                  </p>
                  <div className="flex items-center gap-2">
                    <input placeholder="Registration / Plate" value={vehicleForm.registration}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value.toUpperCase() })}
                      className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none font-mono tracking-wider" />
                    <PlateScanner onResult={(result) => {
                      setVehicleForm({
                        ...vehicleForm,
                        registration: result.registration.toUpperCase(),
                        make: result.make || vehicleForm.make,
                        model: result.model || vehicleForm.model,
                      });
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Make (e.g. Honda)" value={vehicleForm.make}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                      className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                    <input placeholder="Model (e.g. CB500F)" value={vehicleForm.model}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                      className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                  </div>
                </div>
              )}

              <button onClick={handleSave} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                {editingId ? "Update" : "Add Customer"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Customers List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No customers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const motos = motorcycles.filter((m) => m.customer_id === c.id);
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedCustomer(c)}
                className="rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      <Bike className="mr-1 inline h-3 w-3" />{motos.length}
                    </span>
                    <button onClick={() => handleEdit(c)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
