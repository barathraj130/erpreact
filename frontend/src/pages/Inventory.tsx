import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaBox,
  FaBoxOpen,
  FaEdit,
  FaExchangeAlt,
  FaPlus,
  FaSearch,
  FaSync,
  FaTools,
  FaTrash,
} from "react-icons/fa";
import { deleteProduct } from "../api/productApi";
import { useProducts } from "../hooks/useProducts";
import AddProductModal from "./AddProductModal";
import "./finance/Finance.css";
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

  const handleEdit = (product: any) => { setSelectedProduct(product); setIsModalOpen(true); };
  const handleAdd  = () => { setSelectedProduct(null); setIsModalOpen(true); };

  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

  return (
    <div className="finance-container">
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
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                            <div style={{ fontWeight: 700, color: "var(--erp-text-main)", fontSize: "0.95rem" }}>{p.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--erp-text-muted)" }}>{p.description || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontSize: "0.85rem", background: "#eff6ff", color: "#3b82f6", padding: "4px 10px", borderRadius: "100px", fontWeight: 700 }}>{p.category || "Other"}</span></td>
                      <td><span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>{p.location || "---"}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "var(--erp-primary)" }}>₹{(Number(p.selling_price) || 0).toLocaleString()}</div>
                        <div style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>Cost: ₹{(Number(p.cost_price) || 0).toFixed(2)}</div>
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
    </div>
  );
};

export default Inventory;
