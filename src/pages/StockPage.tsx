import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Package, AlertTriangle, ArrowDown, ArrowUp, Settings2, X, Trash2, Edit2, FileText, Table2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import ProductScanner, { type ProductScanResult } from "@/components/ProductScanner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import logoSrc from "@/assets/logo.png";
import { format } from "date-fns";

interface StockItem {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  quantity: number;
  min_quantity: number;
  cost_price: number;
  sell_price: number;
  supplier: string | null;
  location: string | null;
  is_accessory: boolean;
}

interface StockMovement {
  id: string;
  stock_item_id: string;
  type: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

const emptyItem = { name: "", category: "General", sku: "", quantity: "0", min_quantity: "0", cost_price: "0", sell_price: "0", supplier: "", location: "", is_accessory: false };
const categories = ["General", "Engine Parts", "Brakes", "Electrical", "Tyres", "Suspension", "Body Parts", "Oils & Fluids", "Filters", "Chains & Sprockets", "Accessories"];

const StockPage = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [showMovement, setShowMovement] = useState<string | null>(null);
  const [movementForm, setMovementForm] = useState({ type: "in", quantity: "1", notes: "" });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: i }, { data: m }] = await Promise.all([
      supabase.from("stock_items").select("*").order("name"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setItems(i || []);
    setMovements(m || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const data = {
      name: form.name, category: form.category, sku: form.sku || null,
      quantity: parseInt(form.quantity) || 0, min_quantity: parseInt(form.min_quantity) || 0,
      cost_price: parseFloat(form.cost_price) || 0, sell_price: parseFloat(form.sell_price) || 0,
      supplier: form.supplier || null, location: form.location || null, is_accessory: form.is_accessory,
    };
    if (editingId) {
      await supabase.from("stock_items").update(data).eq("id", editingId);
      toast({ title: "Item updated" });
    } else {
      await supabase.from("stock_items").insert(data);
      toast({ title: "Item added" });
    }
    setShowForm(false); setEditingId(null); setForm(emptyItem); fetchData();
  };

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!window.confirm(`Tem certeza que deseja deletar "${item?.name}"?`)) return;
    await supabase.from("stock_items").delete().eq("id", id);
    toast({ title: "Item deleted" });
    fetchData();
  };

  const handleEdit = (item: StockItem) => {
    setForm({
      name: item.name, category: item.category, sku: item.sku || "", quantity: String(item.quantity),
      min_quantity: String(item.min_quantity), cost_price: String(item.cost_price), sell_price: String(item.sell_price),
      supplier: item.supplier || "", location: item.location || "", is_accessory: item.is_accessory,
    });
    setEditingId(item.id); setShowForm(true);
  };

  const handleMovement = async (itemId: string) => {
    const qty = parseInt(movementForm.quantity);
    if (!qty || qty <= 0) { toast({ title: "Invalid quantity", variant: "destructive" }); return; }
    await supabase.from("stock_movements").insert({
      stock_item_id: itemId, type: movementForm.type, quantity: qty, notes: movementForm.notes || null,
    });
    toast({ title: `Stock ${movementForm.type === "in" ? "added" : "removed"}` });
    setShowMovement(null); setMovementForm({ type: "in", quantity: "1", notes: "" }); fetchData();
  };

  const lowStockItems = items.filter((i) => i.quantity <= i.min_quantity && i.min_quantity > 0);

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "All" || i.category === filterCategory;
    const matchLow = !showLowOnly || (i.quantity <= i.min_quantity && i.min_quantity > 0);
    return matchSearch && matchCategory && matchLow;
  });

  const usedCategories = ["All", ...new Set(items.map((i) => i.category))];

  const exportCSV = () => {
    const headers = ["Name", "Category", "SKU", "Quantity", "Min Qty", "Cost Price", "Sell Price", "Supplier", "Location", "Accessory"];
    const rows = filtered.map(i => [i.name, i.category, i.sku || "", i.quantity, i.min_quantity, i.cost_price.toFixed(2), i.sell_price.toFixed(2), i.supplier || "", i.location || "", i.is_accessory ? "Yes" : "No"]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `TwoWheels_Stock_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
      const atModule = await import("jspdf-autotable");
      const autoTable = atModule.default || atModule.autoTable;
      const doc = new jsPDF();

      const loadImage = (src: string): Promise<string> => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { try { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d")!.drawImage(img, 0, 0); resolve(c.toDataURL("image/png")); } catch { resolve(""); } };
        img.onerror = () => resolve("");
        img.src = src;
      });

      let logoData = "";
      try { logoData = await loadImage(logoSrc); } catch { /* skip */ }

      if (logoData) doc.addImage(logoData, "PNG", 14, 10, 18, 18);
      const textX = logoData ? 36 : 14;
      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text("Two Wheels Motorcycles", textX, 20);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Stock Report — ${format(new Date(), "dd/MM/yyyy")}`, textX, 27);
      doc.setDrawColor(225, 6, 0); doc.setLineWidth(0.5); doc.line(14, 32, 196, 32);

      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, 40);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      const totalValue = filtered.reduce((s, i) => s + i.quantity * i.cost_price, 0);
      const totalSellValue = filtered.reduce((s, i) => s + i.quantity * i.sell_price, 0);
      doc.text(`Total Items: ${filtered.length}`, 14, 46);
      doc.text(`Low Stock Alerts: ${lowStockItems.length}`, 110, 46);
      doc.text(`Stock Value (Cost): £${totalValue.toFixed(2)}`, 14, 52);
      doc.text(`Stock Value (Sell): £${totalSellValue.toFixed(2)}`, 110, 52);

      autoTable(doc, {
        startY: 60,
        head: [["Name", "Category", "Qty", "Min", "Cost (£)", "Sell (£)", "Supplier"]],
        body: filtered.map(i => [i.name, i.category, i.quantity, i.min_quantity, i.cost_price.toFixed(2), i.sell_price.toFixed(2), i.supplier || "-"]),
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [225, 6, 0], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      if (lowStockItems.length > 0) {
        const y2 = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("Low Stock Items", 14, y2);
        autoTable(doc, {
          startY: y2 + 4,
          head: [["Name", "Current Qty", "Min Qty", "Deficit"]],
          body: lowStockItems.map(i => [i.name, i.quantity, i.min_quantity, i.min_quantity - i.quantity]),
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [225, 6, 0], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(`Two Wheels Motorcycles — Generated ${format(new Date(), "dd/MM/yyyy HH:mm")} — Page ${i}/${pageCount}`, 14, 290);
      }

      doc.save(`TwoWheels_Stock_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      sonnerToast.success("PDF exported!");
    } catch (err) {
      console.error("PDF export error:", err);
      sonnerToast.error("Failed to export PDF.");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Stock Control</h1>
            <p className="text-sm text-muted-foreground">{items.length} items • {lowStockItems.length} low stock alerts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} title="Export PDF"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={exportCSV} title="Export CSV"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
            <Table2 className="h-3.5 w-3.5" /> CSV
          </button>
          <ProductScanner onResult={(result: ProductScanResult) => {
            setForm({
              name: result.product_name || "",
              category: result.category || "General",
              sku: result.sku || result.barcode || "",
              quantity: "1",
              min_quantity: "0",
              cost_price: "0",
              sell_price: "0",
              supplier: result.brand || "",
              location: "",
              is_accessory: false,
            });
            setEditingId(null);
            setShowForm(true);
          }} buttonLabel="Scan Product" />
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyItem); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <p className="text-sm text-foreground"><strong>{lowStockItems.length}</strong> items below minimum stock level</p>
          <button onClick={() => setShowLowOnly(!showLowOnly)}
            className="ml-auto text-xs text-primary hover:underline">{showLowOnly ? "Show All" : "Show Low Only"}</button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none">
          {usedCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit Item" : "New Stock Item"}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Item Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none">
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                <input type="number" placeholder="Min Quantity" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" placeholder="Cost Price (£)" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                <input type="number" step="0.01" placeholder="Sell Price (£)" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_accessory} onChange={(e) => setForm({ ...form, is_accessory: e.target.checked })}
                  className="rounded border-border" />
                This is an accessory (available for sale)
              </label>
              <button onClick={handleSave} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                {editingId ? "Update" : "Add Item"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Package className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No stock items found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-center">Min</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Sell</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isLow = item.quantity <= item.min_quantity && item.min_quantity > 0;
                  return (
                    <tr key={item.id} className={`border-b border-border/50 last:border-0 ${isLow ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku && `SKU: ${item.sku}`} {item.supplier && `• ${item.supplier}`}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${isLow ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{item.min_quantity}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">£{Number(item.cost_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">£{Number(item.sell_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setShowMovement(item.id)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Stock In/Out">
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleEdit(item)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="sm:hidden divide-y divide-border">
            {filtered.map((item) => {
              const isLow = item.quantity <= item.min_quantity && item.min_quantity > 0;
              return (
                <div key={item.id} className={`p-4 ${isLow ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category} {item.sku && `• ${item.sku}`}</p>
                    </div>
                    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${isLow ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"}`}>
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Cost: £{Number(item.cost_price).toFixed(2)}</span>
                      <span className="text-foreground font-medium">Sell: £{Number(item.sell_price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowMovement(item.id)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                        <Settings2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEdit(item)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Stock Movement</h2>
              <button onClick={() => setShowMovement(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setMovementForm({ ...movementForm, type: "in" })}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${movementForm.type === "in" ? "bg-chart-green/20 text-chart-green border border-chart-green/30" : "bg-secondary text-muted-foreground"}`}>
                  <ArrowDown className="h-4 w-4" /> Stock In
                </button>
                <button onClick={() => setMovementForm({ ...movementForm, type: "out" })}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${movementForm.type === "out" ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"}`}>
                  <ArrowUp className="h-4 w-4" /> Stock Out
                </button>
              </div>
              <input type="number" min="1" placeholder="Quantity" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <input placeholder="Notes (optional)" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <button onClick={() => handleMovement(showMovement)} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                Confirm Movement
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StockPage;
