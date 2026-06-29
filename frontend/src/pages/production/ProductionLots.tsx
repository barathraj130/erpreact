import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";

interface Lot {
  id: number;
  lot_number: string;
  status: string;
  product_name: string;
  supplier_name: string;
  purchase_date: string;
  fresh_available: number;
  mistake_available: number;
  converted_available: number;
  total_fresh_available: number;
  total_purchase_cost: number;
}

interface Supplier { id: number; name: string; }
interface Product  { id: number; name: string; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  received:     { bg: "#f3f4f6", color: "#374151" },
  inspecting:   { bg: "#dbeafe", color: "#1d4ed8" },
  converting:   { bg: "#fef3c7", color: "#b45309" },
  ready:        { bg: "#d1fae5", color: "#065f46" },
  partial_sold: { bg: "#ede9fe", color: "#5b21b6" },
  sold_out:     { bg: "#ccfbf1", color: "#0f766e" },
  closed:       { bg: "#e5e7eb", color: "#1f2937" },
};

const STATUS_TABS = ["", "received", "inspecting", "converting", "ready", "sold_out"];
const STATUS_LABELS: Record<string, string> = {
  "": "All", received: "Received", inspecting: "Inspecting",
  converting: "Converting", ready: "Ready", sold_out: "Sold Out",
};

const fmt   = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtD  = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const MODAL_INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};
const MODAL_LABEL: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 6 };

export default function ProductionLots() {
  const nav = useNavigate();
  const [lots, setLots]         = useState<Lot[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("");
  const [search, setSearch]     = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);

  // Modal states
  const [showNew, setShowNew]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [newLot, setNewLot]     = useState({ supplier_id: "", product_id: "", purchase_date: today(), notes: "" });

  function today() { return new Date().toISOString().slice(0, 10); }

  useEffect(() => { load(); }, [status]);
  useEffect(() => { loadMeta(); }, []);

  async function load() {
    setLoading(true);
    try {
      const q = status ? `?status=${status}` : "";
      const res = await apiFetch(`/production/lots${q}`);
      const data = await res.json();
      setLots(Array.isArray(data) ? data : []);
    } catch { setLots([]); }
    finally { setLoading(false); }
  }

  async function loadMeta() {
    try {
      const [sr, pr] = await Promise.all([apiFetch("/suppliers"), apiFetch("/products")]);
      const sd = await sr.json(); const pd = await pr.json();
      setSuppliers(Array.isArray(sd) ? sd : (sd?.suppliers || []));
      setProducts(Array.isArray(pd) ? pd : (pd?.products || []));
    } catch {}
  }

  async function createLot() {
    setSaving(true); setErr("");
    try {
      const res = await apiFetch("/production/lots", { method: "POST", body: newLot });
      const data = await res.json();
      if (data.success) {
        setShowNew(false);
        setNewLot({ supplier_id: "", product_id: "", purchase_date: today(), notes: "" });
        nav(`/production/lots/${data.lot.id}`);
      } else setErr(data.error || "Failed to create lot");
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  const filtered = lots.filter(l =>
    !search ||
    l.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const badge = (s: string) => {
    const c = STATUS_COLOR[s] || { bg: "#f3f4f6", color: "#374151" };
    return (
      <span style={{ padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: c.bg, color: c.color }}>
        {s?.replace("_", " ").replace(/\b\w/g, x => x.toUpperCase())}
      </span>
    );
  };

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", margin: 0 }}>Production Lots</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 4, marginBottom: 0 }}>
            Track Fresh & Mistake stock across purchase → inspection → conversion → sale
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          background: "#1e293b", color: "#fff", border: "none", borderRadius: 10,
          padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>+ New Lot</button>
      </div>

      {/* Filter tabs + Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: status === s ? "#1e293b" : "transparent",
              color: status === s ? "#fff" : "#64748b",
            }}>{STATUS_LABELS[s]}</button>
          ))}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search lot, product, supplier…"
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", minWidth: 220 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["LOT NO", "PRODUCT", "SUPPLIER", "DATE", "FRESH", "MISTAKE", "CONVERTED", "STATUS", "ACTIONS"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No lots found</td></tr>
            ) : filtered.map(lot => (
              <tr key={lot.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{lot.lot_number}</span>
                </td>
                <td style={{ padding: "14px 16px", color: "#374151", fontSize: 13 }}>{lot.product_name || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>{lot.supplier_name || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>{fmtD(lot.purchase_date)}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontWeight: 700, color: "#059669" }}>{lot.total_fresh_available || 0}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>{lot.mistake_available || 0}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontWeight: 700, color: "#8b5cf6" }}>{lot.converted_available || 0}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                </td>
                <td style={{ padding: "14px 16px" }}>{badge(lot.status)}</td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => nav(`/production/lots/${lot.id}`)} style={actionBtn("#1e293b", "#fff")}>View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Lot Modal */}
      {showNew && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>New Production Lot</h2>
              <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={MODAL_LABEL}>Supplier</label>
                <select value={newLot.supplier_id} onChange={e => setNewLot(p => ({ ...p, supplier_id: e.target.value }))} style={MODAL_INPUT as any}>
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={MODAL_LABEL}>Product</label>
                <select value={newLot.product_id} onChange={e => setNewLot(p => ({ ...p, product_id: e.target.value }))} style={MODAL_INPUT as any}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={MODAL_LABEL}>Purchase Date</label>
                <input type="date" value={newLot.purchase_date} onChange={e => setNewLot(p => ({ ...p, purchase_date: e.target.value }))} style={MODAL_INPUT} />
              </div>
              <div>
                <label style={MODAL_LABEL}>Notes</label>
                <input value={newLot.notes} onChange={e => setNewLot(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" style={MODAL_INPUT} />
              </div>
            </div>

            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNew(false)} style={actionBtn("#f1f5f9", "#374151")}>Cancel</button>
              <button onClick={createLot} disabled={saving} style={actionBtn("#1e293b", "#fff")}>
                {saving ? "Creating…" : "Create Lot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const modal: React.CSSProperties = {
  background: "#fff", borderRadius: 20, padding: 32, width: 540, maxWidth: "95vw",
  maxHeight: "90vh", overflowY: "auto",
};
const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, border: "none", borderRadius: 8,
  padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer",
});
