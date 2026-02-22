import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Bike, X, TrendingUp, Package, CheckCircle, DollarSign, Edit, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  registration: string | null;
  vin: string | null;
  mileage: number;
  condition: string;
  cost_price: number;
  sell_price: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface SaleRecord {
  id: string;
  inventory_id: string | null;
  customer_id: string | null;
  sale_price: number;
  cost_price: number;
  sale_date: string;
  payment_method: string | null;
  notes: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

const CONDITIONS = ["new", "used", "refurbished"];
const STATUSES = ["available", "reserved", "sold"];
const PAYMENT_METHODS = ["cash", "transfer", "finance", "card"];

const MotorcycleSalesPage = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "sales">("inventory");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    make: "", model: "", year: "", color: "", registration: "", vin: "",
    mileage: "0", condition: "used", cost_price: "", sell_price: "", notes: "",
  });

  const [saleForm, setSaleForm] = useState({
    customer_id: "", sale_price: "", payment_method: "cash", notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: inv }, { data: sal }, { data: cust }] = await Promise.all([
      supabase.from("motorcycle_inventory").select("*").order("created_at", { ascending: false }),
      supabase.from("motorcycle_sales").select("*").order("sale_date", { ascending: false }),
      supabase.from("customers").select("id, name, phone").order("name"),
    ]);
    setInventory(inv || []);
    setSales(sal || []);
    setCustomers(cust || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setForm({ make: "", model: "", year: "", color: "", registration: "", vin: "", mileage: "0", condition: "used", cost_price: "", sell_price: "", notes: "" });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim()) {
      toast({ title: "Make and model are required", variant: "destructive" }); return;
    }
    const data = {
      make: form.make, model: form.model,
      year: form.year ? parseInt(form.year) : null,
      color: form.color || null,
      registration: form.registration || null,
      vin: form.vin || null,
      mileage: parseInt(form.mileage) || 0,
      condition: form.condition,
      cost_price: parseFloat(form.cost_price) || 0,
      sell_price: parseFloat(form.sell_price) || 0,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("motorcycle_inventory").update(data).eq("id", editingId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Motorcycle updated" });
    } else {
      const { error } = await supabase.from("motorcycle_inventory").insert(data);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Motorcycle added to inventory" });
    }
    setShowForm(false); resetForm(); fetchData();
  };

  const handleEdit = (item: InventoryItem) => {
    setForm({
      make: item.make, model: item.model, year: item.year?.toString() || "",
      color: item.color || "", registration: item.registration || "", vin: item.vin || "",
      mileage: item.mileage.toString(), condition: item.condition,
      cost_price: item.cost_price.toString(), sell_price: item.sell_price.toString(),
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this motorcycle from inventory?")) return;
    await supabase.from("motorcycle_inventory").delete().eq("id", id);
    toast({ title: "Motorcycle removed" }); fetchData();
  };

  const handleSell = async () => {
    if (!showSaleForm) return;
    const item = inventory.find((i) => i.id === showSaleForm);
    if (!item) return;

    const salePrice = parseFloat(saleForm.sale_price) || item.sell_price;

    const { error: saleErr } = await supabase.from("motorcycle_sales").insert({
      inventory_id: item.id,
      customer_id: saleForm.customer_id || null,
      sale_price: salePrice,
      cost_price: item.cost_price,
      payment_method: saleForm.payment_method,
      notes: saleForm.notes || null,
    });
    if (saleErr) { toast({ title: "Error", description: saleErr.message, variant: "destructive" }); return; }

    await supabase.from("motorcycle_inventory").update({ status: "sold" }).eq("id", item.id);
    toast({ title: "Sale registered successfully!" });
    setShowSaleForm(null);
    setSaleForm({ customer_id: "", sale_price: "", payment_method: "cash", notes: "" });
    fetchData();
  };

  const filteredInventory = inventory.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.make.toLowerCase().includes(q) ||
      item.model.toLowerCase().includes(q) ||
      item.registration?.toLowerCase().includes(q) ||
      item.color?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const availableCount = inventory.filter((i) => i.status === "available").length;
  const soldCount = inventory.filter((i) => i.status === "sold").length;
  const totalSalesValue = sales.reduce((s, r) => s + Number(r.sale_price), 0);
  const totalProfit = sales.reduce((s, r) => s + (Number(r.sale_price) - Number(r.cost_price)), 0);
  const margin = totalSalesValue > 0 ? (totalProfit / totalSalesValue * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Motorcycle Sales</h1>
            <p className="text-sm text-muted-foreground">{inventory.length} motorcycles • {availableCount} available</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
          <Plus className="h-4 w-4" /> Add Motorcycle
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-chart-blue mb-2">
            <Package className="h-5 w-5" />
            <span className="text-xs text-muted-foreground">Available</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{availableCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-chart-green mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="text-xs text-muted-foreground">Sold</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{soldCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <DollarSign className="h-5 w-5" />
            <span className="text-xs text-muted-foreground">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-foreground">£{totalSalesValue.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-chart-amber mb-2">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs text-muted-foreground">Profit Margin</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{margin.toFixed(1)}%</p>
          <p className="text-xs text-chart-green">£{totalProfit.toFixed(2)} profit</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "inventory" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          Inventory
        </button>
        <button onClick={() => setActiveTab("sales")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "sales" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          Sales History
        </button>
      </div>

      {activeTab === "inventory" && (
        <>
          {/* Search & Filter */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by make, model, registration..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <div className="flex gap-2">
              {["all", ...STATUSES].map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory List */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bike className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">No motorcycles found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInventory.map((item) => {
                const profitMargin = item.sell_price > 0 ? ((item.sell_price - item.cost_price) / item.sell_price * 100) : 0;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                          item.status === "available" ? "bg-chart-green/20 text-chart-green" :
                          item.status === "reserved" ? "bg-chart-amber/20 text-chart-amber" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <Bike className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{item.make} {item.model} {item.year || ""}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {item.registration && <span>{item.registration}</span>}
                            {item.color && <span>• {item.color}</span>}
                            <span>• {item.mileage.toLocaleString()} km</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              item.status === "available" ? "bg-chart-green/20 text-chart-green" :
                              item.status === "reserved" ? "bg-chart-amber/20 text-chart-amber" :
                              "bg-muted text-muted-foreground"
                            }`}>{item.status}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                              item.condition === "new" ? "bg-chart-blue/20 text-chart-blue" : "bg-secondary text-muted-foreground"
                            }`}>{item.condition}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">£{Number(item.sell_price).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Cost: £{Number(item.cost_price).toFixed(2)}</p>
                          <p className={`text-xs font-medium ${profitMargin > 0 ? "text-chart-green" : "text-primary"}`}>
                            Margin: {profitMargin.toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {item.status === "available" && (
                            <button onClick={() => { setSaleForm({ ...saleForm, sale_price: item.sell_price.toString() }); setShowSaleForm(item.id); }}
                              className="rounded-lg bg-chart-green/20 px-3 py-1.5 text-xs font-medium text-chart-green hover:bg-chart-green/30">
                              Sell
                            </button>
                          )}
                          <button onClick={() => handleEdit(item)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/80">
                            <Edit className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "sales" && (
        <div className="space-y-3">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <DollarSign className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">No sales recorded yet</p>
            </div>
          ) : (
            sales.map((sale) => {
              const item = inventory.find((i) => i.id === sale.inventory_id);
              const customer = customers.find((c) => c.id === sale.customer_id);
              const profit = Number(sale.sale_price) - Number(sale.cost_price);
              return (
                <motion.div key={sale.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {item ? `${item.make} ${item.model} ${item.year || ""}` : "Unknown Motorcycle"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer ? customer.name : "Walk-in"} • {new Date(sale.sale_date).toLocaleDateString("en-GB")}
                        {sale.payment_method && ` • ${sale.payment_method}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">£{Number(sale.sale_price).toFixed(2)}</p>
                      <p className={`text-xs font-medium ${profit > 0 ? "text-chart-green" : "text-primary"}`}>
                        Profit: £{profit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit Motorcycle" : "Add Motorcycle"}</h2>
                <button onClick={() => { setShowForm(false); resetForm(); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Make *"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model *"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Year" type="number"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Color"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                  <input value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder="Mileage" type="number"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="Registration"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                  <input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} placeholder="VIN"
                    className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                </div>
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground capitalize focus:outline-none">
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Cost Price (£)</label>
                    <input value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} type="number" step="0.01"
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Sell Price (£)</label>
                    <input value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} type="number" step="0.01"
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                  </div>
                </div>
                {form.cost_price && form.sell_price && (
                  <div className="rounded-lg bg-secondary/50 p-3 text-center">
                    <span className="text-xs text-muted-foreground">Margin: </span>
                    <span className={`text-sm font-bold ${(parseFloat(form.sell_price) - parseFloat(form.cost_price)) > 0 ? "text-chart-green" : "text-primary"}`}>
                      £{(parseFloat(form.sell_price) - parseFloat(form.cost_price)).toFixed(2)}
                      {" "}({((parseFloat(form.sell_price) - parseFloat(form.cost_price)) / parseFloat(form.sell_price) * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" rows={2} />
                <button onClick={handleSave}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                  {editingId ? "Update Motorcycle" : "Add to Inventory"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Form Modal */}
      <AnimatePresence>
        {showSaleForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Register Sale</h2>
                <button onClick={() => setShowSaleForm(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {(() => {
                const item = inventory.find((i) => i.id === showSaleForm);
                if (!item) return null;
                return (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="font-semibold text-foreground">{item.make} {item.model} {item.year || ""}</p>
                      <p className="text-xs text-muted-foreground">{item.registration} • Cost: £{Number(item.cost_price).toFixed(2)}</p>
                    </div>
                    <select value={saleForm.customer_id} onChange={(e) => setSaleForm({ ...saleForm, customer_id: e.target.value })}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none">
                      <option value="">Walk-in Customer</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Sale Price (£)</label>
                      <input value={saleForm.sale_price} onChange={(e) => setSaleForm({ ...saleForm, sale_price: e.target.value })} type="number" step="0.01"
                        className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" />
                    </div>
                    <select value={saleForm.payment_method} onChange={(e) => setSaleForm({ ...saleForm, payment_method: e.target.value })}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm capitalize text-foreground focus:outline-none">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {saleForm.sale_price && (
                      <div className="rounded-lg bg-secondary/50 p-3 text-center">
                        <span className="text-xs text-muted-foreground">Profit: </span>
                        <span className={`text-sm font-bold ${(parseFloat(saleForm.sale_price) - item.cost_price) > 0 ? "text-chart-green" : "text-primary"}`}>
                          £{(parseFloat(saleForm.sale_price) - item.cost_price).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <textarea value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder="Notes"
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none" rows={2} />
                    <button onClick={handleSell}
                      className="w-full rounded-lg bg-chart-green py-2.5 text-sm font-semibold text-white hover:brightness-110">
                      Confirm Sale
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MotorcycleSalesPage;
