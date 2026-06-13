import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

interface StockLot {
  id: number; lot_number: string; status: string;
  supplier_name: string; product_name: string;
  purchase_date: string; fresh_purchased_qty: number;
  total_fresh_qty: number; mistake_qty_available: number;
  repaired_qty: number; rejected_qty_available: number;
  total_purchase_cost: number;
}

interface Supplier { id: number; name: string; }
interface Product { id: number; name: string; }

const STATUS_COLORS: Record<string, string> = {
  received: "#6b7280",
  inspecting: "#3b82f6",
  converting: "#f59e0b",
  ready: "#10b981",
  partial_sold: "#8b5cf6",
  sold_out: "#14b8a6",
  closed: "#374151",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Received", inspecting: "Inspecting", converting: "Converting",
  ready: "Ready", partial_sold: "Partial Sold", sold_out: "Sold Out", closed: "Closed",
};

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function StockLots() {
  const navigate = useNavigate();
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showNewLot, setShowNewLot] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newLot, setNewLot] = useState({ supplier_id: "", product_id: "", purchase_date: new Date().toISOString().slice(0, 10), notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { load(); loadMeta(); }, [filterStatus]);

  async function load() {
    setLoading(true);
    try {
      const q = filterStatus ? `?status=${filterStatus}` : "";
      const data = await apiFetch(`/stock-lots${q}`);
      setLots(Array.isArray(data) ? data : []);
    } catch { setLots([]); }
    finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [sup, prod] = await Promise.all([
        apiFetch("/suppliers"),
        apiFetch("/products"),
      ]);
      setSuppliers(Array.isArray(sup) ? sup : sup?.suppliers || []);
      setProducts(Array.isArray(prod) ? prod : prod?.products || []);
    } catch { }
  }

  async function createLot() {
    setSaving(true); setErr("");
    try {
      const res = await apiFetch("/stock-lots", { method: "POST", body: JSON.stringify(newLot) });
      if (res.success) {
        setShowNewLot(false);
        setNewLot({ supplier_id: "", product_id: "", purchase_date: new Date().toISOString().slice(0, 10), notes: "" });
        navigate(`/stock-lots/${res.lot.id}`);
      } else {
        setErr(res.error || "Failed to create lot");
      }
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const filtered = lots.filter(l =>
    !search ||
    l.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusOptions = ["", "received", "inspecting", "converting", "ready", "partial_sold", "sold_out", "closed"];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Stock Lots</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>Surplus T-shirt lot management for JBS Knit Wear</p>
        </div>
        <button onClick={() => setShowNewLot(true)} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          + New Lot
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lot no, supplier, product…"
          style={{ flex: "1 1 220px", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}>
          {statusOptions.map(s => <option key={s} value={s}>{s ? STATUS_LABELS[s] : "All Statuses"}</option>)}
        </select>
        {filterStatus && (
          <button onClick={() => setFilterStatus("")} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
            Clear ×
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>Loading lots…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <p style={{ fontWeight: 700, color: "#374151", margin: 0 }}>No lots found</p>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 16px" }}>Create your first lot to get started</p>
            <button onClick={() => setShowNewLot(true)} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              + New Lot
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Lot No", "Date", "Supplier", "Product", "Fresh", "Mistake", "Repaired", "Rejected", "Cost", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lot => (
                  <tr key={lot.id} style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/stock-lots/${lot.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#4f46e5", borderBottom: "0.5px solid #f1f5f9" }}>{lot.lot_number}</td>
                    <td style={{ padding: "12px 14px", color: "#374151", borderBottom: "0.5px solid #f1f5f9" }}>{fmtDate(lot.purchase_date)}</td>
                    <td style={{ padding: "12px 14px", color: "#374151", borderBottom: "0.5px solid #f1f5f9" }}>{lot.supplier_name || "—"}</td>
                    <td style={{ padding: "12px 14px", color: "#374151", borderBottom: "0.5px solid #f1f5f9" }}>{lot.product_name || "—"}</td>
                    <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{Number(lot.total_fresh_qty || 0)}</span>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                      <span style={{ background: "#fef3c7", color: "#b45309", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{Number(lot.mistake_qty_available || 0)}</span>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                      <span style={{ background: "#e0e7ff", color: "#4338ca", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{Number(lot.repaired_qty || 0)}</span>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                      <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{Number(lot.rejected_qty_available || 0)}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#374151", borderBottom: "0.5px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmt(lot.total_purchase_cost)}</td>
                    <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                      <span style={{ background: STATUS_COLORS[lot.status] + "20", color: STATUS_COLORS[lot.status], borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                        {STATUS_LABELS[lot.status] || lot.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/stock-lots/${lot.id}`)}
                        style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Lot Modal */}
      <AnimatePresence>
        {showNewLot && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, width: 480, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Create New Lot</h2>
                <button onClick={() => setShowNewLot(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{err}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Supplier</label>
                    <select value={newLot.supplier_id} onChange={e => setNewLot(p => ({ ...p, supplier_id: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                      <option value="">Select supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Product</label>
                    <select value={newLot.product_id} onChange={e => setNewLot(p => ({ ...p, product_id: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                      <option value="">Select product</option>
                      {products.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Purchase Date</label>
                    <input type="date" value={newLot.purchase_date} onChange={e => setNewLot(p => ({ ...p, purchase_date: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Notes</label>
                  <textarea value={newLot.notes} onChange={e => setNewLot(p => ({ ...p, notes: e.target.value }))} rows={2}
                    style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowNewLot(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                <button onClick={createLot} disabled={saving} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Creating…" : "Create Lot"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
