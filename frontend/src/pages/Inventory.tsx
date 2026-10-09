import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaBox,
  FaBoxOpen,
  FaCheckCircle,
  FaEdit,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaPlus,
  FaSearch,
  FaSync,
  FaTools,
  FaTrash,
} from "react-icons/fa";
import { confirmPendingProduct, createSet, deleteProduct, flagProductForReview } from "../api/productApi";
import { useProducts } from "../hooks/useProducts";
import AddProductModal from "./AddProductModal";
import "./finance/Finance.css";
import "./finance/Finance.neo.css";
import CustomSelect from "../components/CustomSelect";
import { apiFetch } from "../utils/api";

const STOCK_TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  fresh:          { bg: "#d1fae5", color: "#065f46", label: "Fresh" },
  mistake:        { bg: "#fee2e2", color: "#991b1b", label: "Mistake" },
  fresh_repaired: { bg: "#dbeafe", color: "#1e40af", label: "Repaired" },
};

const StockTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const cfg = STOCK_TYPE_COLORS[type] || { bg: "#f1f5f9", color: "#475569", label: type };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: "100px", fontSize: "0.78rem", fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
};

interface StockSummary {
  fresh_qty: number;
  mistake_qty: number;
  repaired_qty: number;
  total_value: number;
  active_lots: number;
}

interface BreakdownRow {
  stock_type: string;
  lot_id: number | null;
  lot_number: string | null;
  quantity: number;
  avg_cost: number;
  total_cost: number;
}

interface ConvertForm {
  product_id: number;
  product_name: string;
  lot_id: string;
  mistake_qty: number;
  repair_cost_per_piece: number;
  notes: string;
}

const Inventory: React.FC = () => {
  const { products, loading, error, refresh } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "fresh" | "mistake" | "fresh_repaired">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [breakdownCache, setBreakdownCache] = useState<Record<number, BreakdownRow[]>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertForm>({ product_id: 0, product_name: "", lot_id: "", mistake_qty: 0, repair_cost_per_piece: 0, notes: "" });
  const [converting, setConverting] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockForm, setAddStockForm] = useState<{ product_id: number; stock_type: "fresh" | "mistake"; qty: number; notes: string }>({ product_id: 0, stock_type: "fresh", qty: 0, notes: "" });
  const [addingStock, setAddingStock] = useState(false);

  // Create Set: defines a Set's recipe (which real products + how many of
  // each make up one Set). A Set has no stock of its own — selling it
  // deducts each component's stock directly at the moment of sale. This
  // modal only saves the recipe, nothing is pre-assembled or deducted here.
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);
  const [setForm, setSetForm] = useState<{
    mode: "new" | "existing";
    set_product_id: string;
    set_name: string;
    components: { product_id: string; qty_per_set: string }[];
  }>({ mode: "new", set_product_id: "", set_name: "", components: [{ product_id: "", qty_per_set: "" }, { product_id: "", qty_per_set: "" }] });

  const resetSetForm = () => setSetForm({ mode: "new", set_product_id: "", set_name: "", components: [{ product_id: "", qty_per_set: "" }, { product_id: "", qty_per_set: "" }] });

  const handleCreateSet = async () => {
    const components = setForm.components
      .filter(c => c.product_id && Number(c.qty_per_set) > 0)
      .map(c => ({ product_id: Number(c.product_id), qty_per_set: Number(c.qty_per_set) }));
    if (components.length === 0) return alert("Add at least one component with a quantity.");
    if (setForm.mode === "existing" && !setForm.set_product_id) return alert("Select the existing set product.");
    if (setForm.mode === "new" && !setForm.set_name.trim()) return alert("Enter a name for the new set product.");

    setCreatingSet(true);
    try {
      const data = await createSet({
        set_product_id: setForm.mode === "existing" ? Number(setForm.set_product_id) : null,
        set_name: setForm.mode === "new" ? setForm.set_name.trim() : undefined,
        components,
      });
      if (!data.success) { alert(data.error || "Save failed"); return; }
      alert(data.message || "Set saved");
      setShowCreateSetModal(false);
      resetSetForm();
      refresh();
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setCreatingSet(false);
    }
  };

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    apiFetch("/inventory/stock-summary").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setStockSummary(d);
    }).catch(() => {});
  }, []);

  const loadBreakdown = async (productId: number) => {
    if (breakdownCache[productId]) {
      setExpandedProductId(expandedProductId === productId ? null : productId);
      return;
    }
    if (expandedProductId === productId) { setExpandedProductId(null); return; }
    setLoadingBreakdown(true);
    try {
      const res = await apiFetch(`/inventory/product/${productId}/breakdown`);
      if (res.ok) {
        const rows: BreakdownRow[] = await res.json();
        setBreakdownCache(prev => ({ ...prev, [productId]: rows }));
        setExpandedProductId(productId);
      }
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleConvert = async () => {
    if (!convertForm.product_id || convertForm.mistake_qty <= 0) return alert("Select product and enter mistake qty.");
    setConverting(true);
    try {
      const res = await apiFetch("/inventory/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: convertForm.product_id,
          lot_id: convertForm.lot_id || undefined,
          mistake_qty: convertForm.mistake_qty,
          repair_cost_per_piece: convertForm.repair_cost_per_piece,
          notes: convertForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Conversion failed.");
      alert(`Converted ${data.converted_qty} pcs to Fresh Repaired. Repair cost: ₹${data.repair_cost.toFixed(2)}`);
      setShowConvertModal(false);
      setBreakdownCache({});
      refresh();
    } finally {
      setConverting(false);
    }
  };

  const handleAddStock = async () => {
    if (!addStockForm.product_id || addStockForm.qty <= 0) return alert("Select a product and enter a quantity.");
    setAddingStock(true);
    try {
      const res = await apiFetch("/inventory/add-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: addStockForm.product_id,
          stock_type: addStockForm.stock_type,
          qty: addStockForm.qty,
          notes: addStockForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Failed to add stock.");
      alert(`Added ${addStockForm.qty} ${addStockForm.stock_type} pcs.`);
      setShowAddStockModal(false);
      setBreakdownCache({});
      refresh();
    } finally {
      setAddingStock(false);
    }
  };

  const filteredProducts = (products || []).filter((p) => {
    if (!p) return false;
    const matchesSearch =
      (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStock = true;
    const currentStock = Number(p.current_stock) || 0;
    const minStock = Number(p.min_stock || 5);
    if (stockFilter === "low") matchesStock = currentStock <= minStock && currentStock > 0;
    if (stockFilter === "out") matchesStock = currentStock === 0;

    return matchesSearch && matchesStock;
  });

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this product? This action cannot be undone.")) {
      await deleteProduct(id);
      refresh();
    }
  };

  // Merge a duplicate product (e.g. accidentally created with a slightly
  // different name via the quick-add combobox, which matches by exact name
  // only) into the real/canonical one — moves its stock across and re-points
  // its purchase/invoice/movement history, instead of leaving stock stranded
  // under a product nothing else ever sells from.
  const [mergeFromProduct, setMergeFromProduct] = useState<any>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    if (!mergeFromProduct || !mergeTargetId) return;
    setMerging(true);
    try {
      const res = await apiFetch("/products/merge-duplicate", {
        method: "POST",
        body: { from_product_id: mergeFromProduct.id, into_product_id: Number(mergeTargetId) },
      });
      const data = await res.json();
      if (!res.ok || !data.success) { alert(data.error || "Merge failed"); return; }
      alert(data.message);
      setMergeFromProduct(null);
      setMergeTargetId("");
      refresh();
    } catch {
      alert("Merge failed");
    } finally {
      setMerging(false);
    }
  };

  // Products created via quick-add during a purchase with no exact-name match
  // land here as pending_review=true (see productRoutes.js /quick) so they
  // never show up for sale until an admin confirms them. useProducts() already
  // loads them (includePending: true), so we just filter the same list.
  const pendingProducts = products.filter((p: any) => p.pending_review);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  // Per-row draft rename text in the Pending Review modal — lets the admin
  // correct the name in the same step as confirming, instead of a separate
  // Edit Product trip. Keyed by product id; falls back to the product's
  // current name until the admin types something else.
  const [renameDrafts, setRenameDrafts] = useState<Record<number, string>>({});
  const [flaggingId, setFlaggingId] = useState<number | null>(null);

  const handleConfirmPending = async (productId: number, currentName: string) => {
    setConfirmingId(productId);
    try {
      const draft = (renameDrafts[productId] ?? "").trim();
      const nameToSave = draft && draft !== currentName ? draft : undefined;
      const data = await confirmPendingProduct(productId, nameToSave);
      if (!data.success) { alert(data.error || "Confirm failed"); return; }
      setRenameDrafts(prev => { const next = { ...prev }; delete next[productId]; return next; });
      refresh();
    } catch (e: any) {
      alert(e.message || "Confirm failed");
    } finally {
      setConfirmingId(null);
    }
  };

  // Pulls a pre-existing product (created before Pending Review existed) into
  // the same review queue — e.g. a legacy duplicate spotted later. Doesn't
  // touch stock/name, only the flag, so nothing changes until confirmed/merged.
  const handleFlagForReview = async (productId: number) => {
    if (!window.confirm("Flag this product for review? It'll be hidden from Sales until confirmed or merged.")) return;
    setFlaggingId(productId);
    try {
      const data = await flagProductForReview(productId);
      if (!data.success) { alert(data.error || "Flag failed"); return; }
      refresh();
    } catch (e: any) {
      alert(e.message || "Flag failed");
    } finally {
      setFlaggingId(null);
    }
  };

  const handleEdit = (product: any) => { setSelectedProduct(product); setIsModalOpen(true); };
  const handleAdd  = () => { setSelectedProduct(null); setIsModalOpen(true); };

  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  // Plain-text label for <option> elements (styled spans don't render inside
  // native <option>s) — appends the supplier so "MEN'S TOP" bought from two
  // different suppliers doesn't look like the same product in a picker.
  const withSupplier = (p: any) => p.name + (p.supplier_name ? ` — ${p.supplier_name}` : "");

  return (
    <div className="finance-container neo-page-skin">
      {isModalOpen && (
        <AddProductModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { refresh(); setIsModalOpen(false); }}
          productToEdit={selectedProduct}
        />
      )}

      {/* Convert Modal */}
      <AnimatePresence>
        {showConvertModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowConvertModal(false); }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Convert Mistake → Fresh Repaired</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Product</label>
                  <CustomSelect value={String(convertForm.product_id)} onChange={(e: any) => {
                    const p = products.find(pr => String(pr.id) === e.target.value);
                    setConvertForm(f => ({ ...f, product_id: Number(e.target.value), product_name: p?.name || "" }));
                  }}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                  </CustomSelect>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Lot Number (optional)</label>
                  <input value={convertForm.lot_id} onChange={e => setConvertForm(f => ({ ...f, lot_id: e.target.value }))}
                    placeholder="Leave blank for general stock" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Mistake Qty *</label>
                    <input type="number" min="1" value={convertForm.mistake_qty || ""}
                      onChange={e => setConvertForm(f => ({ ...f, mistake_qty: Number(e.target.value) }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Repair Cost/pc (₹)</label>
                    <input type="number" min="0" value={convertForm.repair_cost_per_piece || ""}
                      onChange={e => setConvertForm(f => ({ ...f, repair_cost_per_piece: Number(e.target.value) }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                  </div>
                </div>
                {convertForm.mistake_qty > 0 && convertForm.repair_cost_per_piece > 0 && (
                  <div style={{ background: "#eff6ff", borderRadius: "10px", padding: "12px 16px", fontSize: "0.85rem", color: "#1e40af", fontWeight: 600 }}>
                    Total repair cost: ₹{(convertForm.mistake_qty * convertForm.repair_cost_per_piece).toLocaleString("en-IN")}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Notes</label>
                  <input value={convertForm.notes} onChange={e => setConvertForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Repaired by Raju" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleConvert} disabled={converting} style={{ flex: 1 }}>
                  {converting ? "Converting..." : "Convert"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Stock Modal — Fresh or Mistake, replaces the old Stock Management pages */}
      <AnimatePresence>
        {showAddStockModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddStockModal(false); }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Add Stock</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Product</label>
                  <CustomSelect value={String(addStockForm.product_id)} onChange={(e: any) => {
                    setAddStockForm(f => ({ ...f, product_id: Number(e.target.value) }));
                  }}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                  </CustomSelect>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Stock Quality</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button type="button" onClick={() => setAddStockForm(f => ({ ...f, stock_type: "fresh" }))}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, border: addStockForm.stock_type === "fresh" ? "2px solid #16a34a" : "1.5px solid #e2e8f0", background: addStockForm.stock_type === "fresh" ? "#f0fdf4" : "#fff", color: addStockForm.stock_type === "fresh" ? "#16a34a" : "#64748b" }}>
                      Fresh
                    </button>
                    <button type="button" onClick={() => setAddStockForm(f => ({ ...f, stock_type: "mistake" }))}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, border: addStockForm.stock_type === "mistake" ? "2px solid #f59e0b" : "1.5px solid #e2e8f0", background: addStockForm.stock_type === "mistake" ? "#fffbeb" : "#fff", color: addStockForm.stock_type === "mistake" ? "#b45309" : "#64748b" }}>
                      Mistake
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Quantity (pcs) *</label>
                  <input type="number" min="1" value={addStockForm.qty || ""}
                    onChange={e => setAddStockForm(f => ({ ...f, qty: Number(e.target.value) }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Notes</label>
                  <input value={addStockForm.notes} onChange={e => setAddStockForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Physical count adjustment" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button className="btn btn-secondary" onClick={() => setShowAddStockModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddStock} disabled={addingStock} style={{ flex: 1 }}>
                  {addingStock ? "Adding..." : "Add Stock"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Inventory Management</h1>
          <p className="text-muted">Track products, stock levels, and surplus stock types</p>
        </div>
        <div className="finance-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={() => refresh()} style={{ width: "42px", height: "42px", padding: 0 }} title="Refresh">
            <FaSync className={loading ? "fa-spin" : ""} />
          </button>
          {pendingProducts.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowPendingModal(true)}
              style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", color: "#b45309", borderColor: "#f59e0b", background: "#fffbeb", position: "relative" }}
              title="Products created during a purchase that still need review"
            >
              <FaExclamationTriangle size={13} /> Pending Review ({pendingProducts.length})
            </button>
          )}
          <button
            className="btn btn-secondary"
            title="Repair stock: re-run deductions for invoices missing stock movements"
            style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", color: "#f59e0b", borderColor: "#f59e0b" }}
            onClick={async () => {
              if (!window.confirm("This will re-deduct stock for all invoices that are missing stock movements. Proceed?")) return;
              try {
                const res = await apiFetch("/invoice/repair-stock", { method: "POST" });
                const data = await res.json();
                alert(data.message || "Stock repair complete");
                refresh();
              } catch (e: any) { alert("Repair failed: " + (e.message || "Unknown error")); }
            }}
          >
            <FaTools size={13} /> Repair Stock
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setConvertForm({ product_id: 0, product_name: "", lot_id: "", mistake_qty: 0, repair_cost_per_piece: 0, notes: "" }); setShowConvertModal(true); }}
            style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", color: "#3b82f6", borderColor: "#3b82f6" }}
          >
            <FaExchangeAlt size={13} /> Convert Mistake
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setAddStockForm({ product_id: 0, stock_type: "fresh", qty: 0, notes: "" }); setShowAddStockModal(true); }}
            style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", color: "#16a34a", borderColor: "#16a34a" }}
          >
            <FaBoxOpen size={13} /> Add Stock
          </button>
          <button
            className="btn btn-secondary"
            title="Define a Set — a sales-side grouping of 2+ products with no stock of its own (e.g. top + pant sold as one line)"
            onClick={() => { resetSetForm(); setShowCreateSetModal(true); }}
            style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", color: "#7c3aed", borderColor: "#7c3aed" }}
          >
            <FaBox size={13} /> Create Set
          </button>
          <button className="btn btn-primary" onClick={handleAdd} style={{ height: "42px", padding: "0 24px" }}>
            <FaPlus /> Add New Product
          </button>
        </div>
      </div>

      {/* Surplus Stock Summary Cards */}
      {stockSummary && (Number(stockSummary.fresh_qty) + Number(stockSummary.mistake_qty) + Number(stockSummary.repaired_qty)) > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "14px", marginBottom: "24px" }}>
          {[
            { label: "Fresh Stock", value: stockSummary.fresh_qty, unit: "pcs", color: "#059669", bg: "#d1fae5", filter: "fresh" as const },
            { label: "Mistake Stock", value: stockSummary.mistake_qty, unit: "pcs", color: "#dc2626", bg: "#fee2e2", filter: "mistake" as const },
            { label: "Repaired Stock", value: stockSummary.repaired_qty, unit: "pcs", color: "#2563eb", bg: "#dbeafe", filter: "fresh_repaired" as const },
            { label: "Total Value", value: fmt(Number(stockSummary.total_value)), unit: "", color: "#7c3aed", bg: "#ede9fe", filter: null },
          ].map(card => (
            <div
              key={card.label}
              onClick={() => card.filter && setTypeFilter(typeFilter === card.filter ? "all" : card.filter)}
              style={{
                background: typeFilter === card.filter ? card.bg : "#fff",
                border: `2px solid ${typeFilter === card.filter ? card.color : "#e2e8f0"}`,
                borderRadius: "12px", padding: "16px", cursor: card.filter ? "pointer" : "default",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: card.color, textTransform: "uppercase", marginBottom: "6px" }}>{card.label}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" }}>{typeof card.value === "number" ? card.value.toLocaleString("en-IN") : card.value}</div>
              {card.unit && <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>{card.unit}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Stock Type Tabs */}
      {stockSummary && (Number(stockSummary.fresh_qty) + Number(stockSummary.mistake_qty) + Number(stockSummary.repaired_qty)) > 0 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {(["all", "fresh", "mistake", "fresh_repaired"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{
                border: "1px solid",
                borderColor: typeFilter === t ? (t === "fresh" ? "#059669" : t === "mistake" ? "#dc2626" : t === "fresh_repaired" ? "#2563eb" : "#4f46e5") : "#e2e8f0",
                background: typeFilter === t ? (t === "fresh" ? "#d1fae5" : t === "mistake" ? "#fee2e2" : t === "fresh_repaired" ? "#dbeafe" : "#ede9fe") : "#fff",
                color: typeFilter === t ? (t === "fresh" ? "#065f46" : t === "mistake" ? "#991b1b" : t === "fresh_repaired" ? "#1e40af" : "#4f46e5") : "#64748b",
                borderRadius: "8px", padding: "7px 16px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              }}>
              {t === "all" ? "All Types" : t === "fresh" ? "Fresh" : t === "mistake" ? "Mistake" : "Repaired"}
            </button>
          ))}
        </div>
      )}

      <div className="inventory-controls" style={{ display: "flex", gap: "16px", marginBottom: "24px", flexDirection: isMobile ? "column" : "row", alignItems: "center" }}>
        <div className="search-container" style={{ flex: 1 }}>
          <FaSearch className="search-icon" />
          <input className="search-input" placeholder="Search products by name or SKU..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ width: isMobile ? "100%" : "220px" }}>
          <CustomSelect value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} style={{ height: "42px" }} disableSearch>
            <option value="all">View All Products</option>
            <option value="low">Low Stock Alerts</option>
            <option value="out">Out of Stock</option>
          </CustomSelect>
        </div>
      </div>

      {error && !loading && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "12px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "0.875rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
          ⚠️ {error}
          <button onClick={refresh} style={{ marginLeft: "auto", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "6px", padding: "2px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Retry</button>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "16px", marginBottom: "16px" }}></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state" style={{ padding: "100px 20px", textAlign: "center" }}>
            <FaBoxOpen size={56} style={{ color: "#cbd5e1", marginBottom: "20px" }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: "var(--erp-text-main)", fontSize: "1.25rem" }}>
              {products.length === 0 ? "No products yet" : "No products found"}
            </h3>
            <p style={{ color: "var(--erp-text-secondary)", marginTop: "8px", maxWidth: "420px", margin: "8px auto 0" }}>
              {products.length === 0
                ? "Products are created automatically when you save a Purchase Bill. You can also add them manually."
                : "Try adjusting your filters or search term."}
            </p>
          </div>
        ) : isMobile ? (
          <div className="inventory-cards-list" style={{ padding: "0 0 20px" }}>
            {filteredProducts.map((p, idx) => {
              const isLow = p.current_stock <= (p.min_stock || 5) && p.current_stock > 0;
              const isOut = p.current_stock === 0;
              return (
                <motion.div key={p.id} className="card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "12px", overflow: "hidden", background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                      {p.image_url ? <img src={p.image_url.startsWith("http") ? p.image_url : `http://${window.location.hostname}:3000${p.image_url}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}><FaBox size={24} /></div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{p.name}</h3>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--erp-text-muted)" }}>SKU: {p.sku || `#${p.id}`}</p>
                      {p.supplier_name && (
                        <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#7c3aed", fontWeight: 600 }}>{p.supplier_name}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                    <div>
                      <span className={`status-badge ${isOut ? "status-error" : isLow ? "status-warning" : "status-success"}`}>
                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                      </span>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "4px" }}>{p.current_stock} Items</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--erp-text-muted)" }}>Selling Price</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--erp-primary)" }}>₹{(Number(p.selling_price) || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                    <button className="btn btn-secondary" onClick={() => handleEdit(p)} style={{ flex: 1 }}><FaEdit /> Edit</button>
                    <button className="btn btn-secondary" onClick={() => setMergeFromProduct(p)} title="Merge into another product (duplicate cleanup)"><FaExchangeAlt /></button>
                    {!p.pending_review && (
                      <button className="btn btn-secondary" onClick={() => handleFlagForReview(p.id)} disabled={flaggingId === p.id} style={{ color: "#b45309", opacity: flaggingId === p.id ? 0.6 : 1 }} title="Pull into Pending Review (legacy duplicate spotted later)"><FaExclamationTriangle /></button>
                    )}
                    <button className="btn btn-secondary" onClick={() => handleDelete(p.id)} style={{ color: "var(--erp-error)", borderColor: "rgba(244,63,94,0.2)" }}><FaTrash /></button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: "24px" }}>Product Detail</th>
                <th>Category</th>
                <th>Location</th>
                <th style={{ textAlign: "right" }}>WAC / Selling</th>
                <th style={{ textAlign: "center" }}>Stock Level</th>
                <th style={{ textAlign: "center" }}>Stock Types</th>
                <th style={{ textAlign: "center", paddingRight: "24px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => {
                const isLow = p.current_stock <= (p.min_stock || 5) && p.current_stock > 0;
                const isOut = p.current_stock === 0;
                const breakdown = breakdownCache[p.id] || [];
                const matchesType = typeFilter === "all" || breakdown.some(r => r.stock_type === typeFilter);
                if (typeFilter !== "all" && !matchesType && !loading) return null;

                return (
                  <React.Fragment key={p.id}>
                    <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                      <td style={{ paddingLeft: "24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            {p.image_url ? <img src={p.image_url.startsWith("http") ? p.image_url : `http://${window.location.hostname}:3000${p.image_url}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}><FaBox size={20} /></div>}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 700, color: "var(--erp-text-main)", fontSize: "0.95rem" }}>{p.name}</span>
                              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#5B4BFF", background: "#eef2ff", padding: "1px 6px", borderRadius: "100px" }}>#{p.id}</span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--erp-text-muted)" }}>{p.description || "N/A"}</div>
                            {p.supplier_name && (
                              <div style={{ fontSize: "0.72rem", color: "#7c3aed", fontWeight: 600 }}>{p.supplier_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontSize: "0.85rem", background: "#eff6ff", color: "#3b82f6", padding: "4px 10px", borderRadius: "100px", fontWeight: 700 }}>{p.category || "Other"}</span></td>
                      <td><span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>{p.location || "---"}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "var(--erp-primary)" }}>₹{(Number(p.selling_price) || 0).toLocaleString()}</div>
                        <div style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>Cost: ₹{(Number(p.cost_price) || 0).toFixed(2)}</div>
                        {p.cost_price_pending && (
                          <div
                            title="Auto-created from a sale typed straight into an invoice — real purchase cost not entered yet"
                            style={{ fontSize: "0.65rem", color: "#b45309", background: "#fef3c7", padding: "2px 7px", borderRadius: "100px", fontWeight: 700, marginTop: "3px", display: "inline-block" }}
                          >
                            ⏳ Cost pending
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`status-badge ${isOut ? "status-error" : isLow ? "status-warning" : "status-success"}`}>
                          {isOut ? "Empty" : isLow ? "Low" : "Full"}
                        </span>
                        <div style={{ fontWeight: 700, marginTop: "4px", fontSize: "0.9rem" }}>{p.current_stock} <span style={{ fontSize: "0.7rem", color: "var(--erp-text-muted)" }}>{p.unit}</span></div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => loadBreakdown(p.id)}
                          style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "5px 12px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}
                        >
                          {loadingBreakdown && expandedProductId === p.id ? "..." : expandedProductId === p.id ? "▲ Hide" : "▼ Types"}
                        </button>
                      </td>
                      <td style={{ textAlign: "center", paddingRight: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                          <button className="btn btn-secondary" onClick={() => handleEdit(p)} style={{ padding: "6px" }} title="Edit"><FaEdit size={14} /></button>
                          <button className="btn btn-secondary" onClick={() => setMergeFromProduct(p)} style={{ padding: "6px" }} title="Merge into another product (duplicate cleanup)"><FaExchangeAlt size={14} /></button>
                          {!p.pending_review && (
                            <button className="btn btn-secondary" onClick={() => handleFlagForReview(p.id)} disabled={flaggingId === p.id} style={{ padding: "6px", color: "#b45309", opacity: flaggingId === p.id ? 0.6 : 1 }} title="Pull into Pending Review (legacy duplicate spotted later)"><FaExclamationTriangle size={14} /></button>
                          )}
                          <button className="btn btn-secondary" onClick={() => handleDelete(p.id)} style={{ padding: "6px", color: "var(--erp-error)" }} title="Delete"><FaTrash size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                    {/* Stock type breakdown row */}
                    <AnimatePresence>
                      {expandedProductId === p.id && breakdown.length > 0 && (
                        <motion.tr key={`breakdown-${p.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <td colSpan={7} style={{ paddingLeft: "24px", paddingBottom: "16px", background: "#f8fafc" }}>
                            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", paddingTop: "8px" }}>
                              {breakdown.map((row, ri) => (
                                <div key={ri} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 16px", minWidth: "160px" }}>
                                  <StockTypeBadge type={row.stock_type} />
                                  {row.lot_number && <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px" }}>Lot: {row.lot_number}</div>}
                                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a", marginTop: "6px" }}>{Number(row.quantity).toLocaleString()} pcs</div>
                                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Avg ₹{Number(row.avg_cost).toFixed(2)} | Val ₹{Number(row.total_cost).toLocaleString("en-IN")}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                      {expandedProductId === p.id && breakdown.length === 0 && (
                        <motion.tr key={`no-breakdown-${p.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <td colSpan={7} style={{ paddingLeft: "24px", paddingBottom: "12px", background: "#f8fafc", fontSize: "0.85rem", color: "#94a3b8" }}>
                            No surplus stock type breakdown available for this product.
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Set Modal — defines a Set's recipe. No stock of its own;
          selling a Set deducts each component's stock at sale time. */}
      <AnimatePresence>
        {showCreateSetModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowCreateSetModal(false); }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Create Set</h2>
              <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6 }}>
                A Set has no stock of its own — it's a sales-side grouping. Define which products (and how many of
                each) make up one Set here; selling a Set deducts straight from each component's real stock.
              </p>

              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <button type="button" onClick={() => setSetForm(f => ({ ...f, mode: "new" }))}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, border: setForm.mode === "new" ? "2px solid #7c3aed" : "1.5px solid #e2e8f0", background: setForm.mode === "new" ? "#f5f3ff" : "#fff", color: setForm.mode === "new" ? "#7c3aed" : "#64748b" }}>
                  New Set Product
                </button>
                <button type="button" onClick={() => setSetForm(f => ({ ...f, mode: "existing" }))}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, border: setForm.mode === "existing" ? "2px solid #7c3aed" : "1.5px solid #e2e8f0", background: setForm.mode === "existing" ? "#f5f3ff" : "#fff", color: setForm.mode === "existing" ? "#7c3aed" : "#64748b" }}>
                  Edit Existing Set
                </button>
              </div>

              {setForm.mode === "new" ? (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Set Name *</label>
                  <input value={setForm.set_name} onChange={e => setSetForm(f => ({ ...f, set_name: e.target.value }))}
                    placeholder="e.g. Men's Top + Pant Set" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
              ) : (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Existing Set Product *</label>
                  <CustomSelect value={setForm.set_product_id} onChange={(e: any) => setSetForm(f => ({ ...f, set_product_id: e.target.value }))} placeholder="Search products…">
                    {(products || []).filter((p: any) => p.is_set).map((p: any) => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                  </CustomSelect>
                </div>
              )}

              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Components (qty needed per 1 set)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                {setForm.components.map((c, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect value={c.product_id} onChange={(e: any) => setSetForm(f => ({ ...f, components: f.components.map((row, i) => i === idx ? { ...row, product_id: e.target.value } : row) }))} placeholder="Search products…">
                        {(products || []).filter((p: any) => !p.is_set).map((p: any) => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                      </CustomSelect>
                    </div>
                    <input type="number" min="0.01" step="0.01" placeholder="Qty/set" value={c.qty_per_set}
                      onChange={e => setSetForm(f => ({ ...f, components: f.components.map((row, i) => i === idx ? { ...row, qty_per_set: e.target.value } : row) }))}
                      style={{ width: "90px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                    <button type="button" className="btn btn-secondary" style={{ padding: "8px 10px" }}
                      onClick={() => setSetForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))}
                      disabled={setForm.components.length <= 1}>
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: "0.8rem", marginBottom: "20px" }}
                onClick={() => setSetForm(f => ({ ...f, components: [...f.components, { product_id: "", qty_per_set: "" }] }))}>
                <FaPlus size={11} /> Add Component
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateSetModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, opacity: creatingSet ? 0.6 : 1 }} disabled={creatingSet} onClick={handleCreateSet}>
                  {creatingSet ? "Saving…" : "Save Set"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Review Modal — products created via purchase quick-add with no
          exact name match; admin must confirm each as new or merge it. */}
      <AnimatePresence>
        {showPendingModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowPendingModal(false); }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "560px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Pending Review</h2>
              <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6 }}>
                These were created during a purchase because no product matched that exact name.
                Confirm as new if it genuinely is, or merge it into an existing product if it's a duplicate.
                Until confirmed, they won't show up for sale.
              </p>
              {pendingProducts.length === 0 ? (
                <p style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>Nothing pending.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {pendingProducts.map((p: any) => (
                    <div key={p.id} style={{ border: "1.5px solid #fde68a", background: "#fffbeb", borderRadius: "12px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                            {p.name}
                            {p.supplier_name && <span style={{ marginLeft: 6, fontSize: "0.72rem", color: "#92400e", fontWeight: 600 }}>· {p.supplier_name}</span>}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#92400e" }}>Stock: {p.current_stock ?? 0} {p.unit || ""}</div>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                          Rename before confirming (optional)
                        </label>
                        <input
                          value={renameDrafts[p.id] ?? p.name}
                          onChange={e => setRenameDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fde68a", background: "#fff", fontSize: "0.85rem", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                          title="Merge into another product (it's a duplicate)"
                          onClick={() => { setShowPendingModal(false); setMergeFromProduct(p); }}
                        >
                          <FaExchangeAlt size={12} /> Merge
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ padding: "6px 10px", fontSize: "0.78rem", opacity: confirmingId === p.id ? 0.6 : 1 }}
                          disabled={confirmingId === p.id}
                          title="Confirm this is genuinely a new product (saves the rename above if changed)"
                          onClick={() => handleConfirmPending(p.id, p.name)}
                        >
                          <FaCheckCircle size={12} /> {confirmingId === p.id ? "Confirming…" : "Confirm New"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", marginTop: "20px" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPendingModal(false)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Merge Duplicate Product Modal */}
      <AnimatePresence>
        {mergeFromProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) { setMergeFromProduct(null); setMergeTargetId(""); } }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "460px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Merge Duplicate Product</h2>
              <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6 }}>
                Moves <strong>"{mergeFromProduct.name}"</strong>'s stock and purchase/invoice history into the
                product you pick below, then marks "{mergeFromProduct.name}" as merged so it can't be sold from again.
                This cannot be undone.
              </p>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                Merge into
              </label>
              <CustomSelect value={mergeTargetId} onChange={(e: any) => setMergeTargetId(e.target.value)} placeholder="Search products…">
                {(products || [])
                  .filter((p: any) => p.id !== mergeFromProduct.id)
                  .map((p: any) => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
              </CustomSelect>
              <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setMergeFromProduct(null); setMergeTargetId(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, opacity: (!mergeTargetId || merging) ? 0.5 : 1 }}
                  disabled={!mergeTargetId || merging}
                  onClick={handleMerge}
                >
                  {merging ? "Merging…" : "Merge"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
