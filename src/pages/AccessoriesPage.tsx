import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, ShoppingCart, X, AlertTriangle, Tag, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import ProductScanner, { type ProductScanResult } from "@/components/ProductScanner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/RoleContext";

interface StockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  sell_price: number;
  is_accessory: boolean;
}

interface Customer { id: string; name: string; }

interface SaleItem { stock_item_id: string; quantity: number; unit_price: number; name: string; }

const AccessoriesPage = () => {
  const { isOwner } = useRole();
  const [accessories, setAccessories] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleNotes, setSaleNotes] = useState("");
  const [loading, setLoading] = useState(true);

  // Sales history
  const [sales, setSales] = useState<Array<{ id: string; customer_id: string | null; total: number; notes: string | null; created_at: string }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: items }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("stock_items").select("*").eq("is_accessory", true).order("name"),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("accessory_sales").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setAccessories(items || []);
    setCustomers(c || []);
    setSales(s || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addToSale = (item: StockItem) => {
    const existing = saleItems.find((s) => s.stock_item_id === item.id);
    if (existing) {
      setSaleItems(saleItems.map((s) => s.stock_item_id === item.id ? { ...s, quantity: s.quantity + 1 } : s));
    } else {
      setSaleItems([...saleItems, { stock_item_id: item.id, quantity: 1, unit_price: Number(item.sell_price), name: item.name }]);
    }
    if (!showSaleForm) setShowSaleForm(true);
  };

  const removeFromSale = (stockItemId: string) => {
    setSaleItems(saleItems.filter((s) => s.stock_item_id !== stockItemId));
  };

  const saleTotal = saleItems.reduce((sum, s) => sum + s.quantity * s.unit_price, 0);

  const handleCompleteSale = async () => {
    if (saleItems.length === 0) { toast({ title: "Add items to sale", variant: "destructive" }); return; }

    const { data: sale, error } = await supabase.from("accessory_sales").insert({
      customer_id: saleCustomerId || null, total: saleTotal, notes: saleNotes || null,
    }).select().single();

    if (error || !sale) { toast({ title: "Error creating sale", variant: "destructive" }); return; }

    // Add sale items
    await supabase.from("accessory_sale_items").insert(
      saleItems.map((s) => ({ sale_id: sale.id, stock_item_id: s.stock_item_id, quantity: s.quantity, unit_price: s.unit_price }))
    );

    // Deduct stock
    for (const item of saleItems) {
      await supabase.from("stock_movements").insert({
        stock_item_id: item.stock_item_id, type: "out", quantity: item.quantity, reference: "Accessory sale", notes: `Sale #${sale.id.slice(0, 8)}`,
      });
    }

    toast({ title: `Sale completed — £${saleTotal.toFixed(2)}` });
    setShowSaleForm(false); setSaleItems([]); setSaleCustomerId(""); setSaleNotes(""); fetchData();
  };

  const lowStock = accessories.filter((a) => a.quantity <= a.min_quantity && a.min_quantity > 0);

  const usedCategories = ["All", ...new Set(accessories.map((a) => a.category))];
  const filtered = accessories.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "All" || a.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accessories</h1>
            <p className="text-sm text-muted-foreground">{accessories.length} products available</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ProductScanner onResult={(result: ProductScanResult) => {
            // Try to find existing product by barcode/SKU or name
            const match = accessories.find((a) =>
              (result.barcode && a.name.toLowerCase().includes(result.barcode.toLowerCase())) ||
              (result.sku && a.name.toLowerCase().includes(result.sku.toLowerCase())) ||
              (result.product_name && a.name.toLowerCase().includes(result.product_name.toLowerCase()))
            );
            if (match) {
              addToSale(match);
              toast({ title: `"${match.name}" adicionado à venda` });
            } else {
              toast({ title: "Produto não encontrado no stock", description: result.product_name || result.barcode || "Adicione primeiro no Stock Control", variant: "destructive" });
            }
          }} buttonLabel="Scan to Sale" />
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary">
            <ShoppingCart className="h-4 w-4" /> Sales History
          </button>
        </div>
      </div>

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <p className="text-sm text-foreground"><strong>{lowStock.length}</strong> accessories below minimum stock</p>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accessories..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none">
          {usedCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Sale Cart (floating) */}
      {showSaleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">New Sale</h2>
              <button onClick={() => setShowSaleForm(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <select value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)}
              className="mb-3 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none">
              <option value="">Walk-in Customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {saleItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No items added yet. Click "Add to Sale" on products below.</p>
            ) : (
              <div className="space-y-2">
                {saleItems.map((s) => (
                  <div key={s.stock_item_id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => setSaleItems(saleItems.map((si) => si.stock_item_id === s.stock_item_id ? { ...si, quantity: Math.max(1, si.quantity - 1) } : si))}
                          className="rounded bg-card px-2 py-0.5 text-xs text-foreground">-</button>
                        <span className="text-xs text-foreground">{s.quantity}</span>
                        <button onClick={() => setSaleItems(saleItems.map((si) => si.stock_item_id === s.stock_item_id ? { ...si, quantity: si.quantity + 1 } : si))}
                          className="rounded bg-card px-2 py-0.5 text-xs text-foreground">+</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">£{(s.quantity * s.unit_price).toFixed(2)}</span>
                      <button onClick={() => { if (window.confirm("Tem certeza que deseja remover este item da venda?")) removeFromSale(s.stock_item_id); }} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <textarea placeholder="Notes (optional)" value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} rows={2}
              className="mt-3 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" />

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-lg font-bold text-foreground">Total: £{saleTotal.toFixed(2)}</span>
              <button onClick={handleCompleteSale} disabled={saleItems.length === 0}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                Complete Sale
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : showHistory ? (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Recent Sales</h2>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet</p>
          ) : (
            sales.map((sale) => {
              const customer = customers.find((c) => c.id === sale.customer_id);
              return (
                <div key={sale.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{customer?.name || "Walk-in Customer"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    {sale.notes && <p className="text-xs text-muted-foreground mt-1">{sale.notes}</p>}
                  </div>
                  <span className="text-lg font-bold text-foreground">£{Number(sale.total).toFixed(2)}</span>
                </div>
              );
            })
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No accessories found</p>
          <p className="text-xs mt-1">Mark items as "accessory" in Stock Control to see them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const isLow = item.quantity <= item.min_quantity && item.min_quantity > 0;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-4 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    <Tag className="inline h-3 w-3 mr-1" />{item.category}
                  </span>
                  {isLow && <AlertTriangle className="h-4 w-4 text-primary" />}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{item.name}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs ${isLow ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {item.quantity} in stock
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-lg font-bold text-foreground">£{Number(item.sell_price).toFixed(2)}</span>
                  <button onClick={() => addToSale(item)} disabled={item.quantity <= 0}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                    <Plus className="h-3 w-3" /> Add to Sale
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccessoriesPage;
