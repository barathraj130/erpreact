import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaPlus, FaSync, FaBoxOpen } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Journey {
  id: number;
  journey_id: string;
  product_name: string;
  supplier_ref_name?: string;
  supplier_name?: string;
  purchase_date: string;
  total_purchased: number;
  fresh_remaining: number;
  mistake_remaining: number;
  total_converted_to_fresh: number;
  total_sold: number;
  total_revenue: number;
  gross_profit: number;
  status: "active" | "partial" | "exhausted" | "closed";
}

interface DashboardSummary {
  total_batches?: number;
  active_batches?: number;
  total_gross_profit?: number;
  total_fresh_remaining?: number;
  total_mistake_remaining?: number;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: "#dcfce7", color: "#15803d" },
  partial: { bg: "#fef3c7", color: "#b45309" },
  exhausted: { bg: "#e2e8f0", color: "#475569" },
  closed: { bg: "#1e293b", color: "#f1f5f9" },
};

const fmt = (n: number | undefined) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const ProductJourneyList: React.FC = () => {
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "active" | "partial" | "exhausted">("all");
  const [showModal, setShowModal] = useState(false);

  // Manual "New Journey" form data + dropdown sources
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [form, setForm] = useState({
    product_id: "", product_name: "", product_code: "",
    purchase_bill_id: "", supplier_id: "", supplier_name: "",
    purchase_date: new Date().toISOString().split("T")[0],
    total_purchased: "", fresh_purchased: "", mistake_purchased: "",
    purchase_rate: "", branch_id: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [jRes, sRes] = await Promise.all([
        apiFetch("/journey"),
        apiFetch("/journey/summary/dashboard"),
      ]);
      setJourneys(jRes.ok ? await jRes.json() : []);
      setSummary(sRes.ok ? await sRes.json() : {});
    } catch (err) {
      console.error("Failed to load product journeys", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = async () => {
    setShowModal(true);
    try {
      const [pRes, sRes, bRes, pbRes] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/suppliers"),
        apiFetch("/branches"),
        apiFetch("/purchase-bills"),
      ]);
      setProducts(pRes.ok ? await pRes.json() : []);
      setSuppliers(sRes.ok ? await sRes.json() : []);
      setBranches(bRes.ok ? await bRes.json() : []);
      const pbData = pbRes.ok ? await pbRes.json() : [];
      setPurchaseBills(Array.isArray(pbData) ? pbData : pbData.bills || []);
    } catch (err) {
      console.error("Failed to load dropdown data", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_name.trim() || !form.purchase_bill_id) {
      alert("Product name and purchase bill are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/journey/create", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          product_id: form.product_id || null,
          supplier_id: form.supplier_id || null,
          branch_id: form.branch_id || null,
          total_purchased: Number(form.total_purchased) || 0,
          fresh_purchased: Number(form.fresh_purchased) || 0,
          mistake_purchased: Number(form.mistake_purchased) || 0,
          purchase_rate: Number(form.purchase_rate) || 0,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create journey");
      setShowModal(false);
      load();
      navigate(`/inventory/journey/${data.journey_db_id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create journey.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = journeys.filter((j) => {
    if (statusTab !== "all" && j.status !== statusTab) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!j.journey_id.toLowerCase().includes(q) && !j.product_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1><FaBoxOpen style={{ marginRight: 8, color: "#5B4BFF" }} />Product Journey Tracker</h1>
          <p>Every purchase batch, traced end to end — purchase, fresh/mistake split, conversions, sales, returns, re-sales.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load} title="Refresh">
            <FaSync className={loading ? "fa-spin" : ""} size={12} />
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={openModal}>
            <FaPlus size={11} /> New Journey
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ flex: "1 1 200px", padding: 22, borderRadius: 16, background: "linear-gradient(135deg,#eef2ff,#e0e7ff)", border: "1px solid #c7d2fe" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#4338ca", textTransform: "uppercase", letterSpacing: 1 }}>Total Batches</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#312e81", marginTop: 6 }}>{summary.total_batches ?? 0}</div>
        </div>
        <div style={{ flex: "1 1 200px", padding: 22, borderRadius: 16, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: 1 }}>Active Batches</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#166534", marginTop: 6 }}>{summary.active_batches ?? 0}</div>
        </div>
        <div style={{ flex: "1 1 200px", padding: 22, borderRadius: 16, background: Number(summary.total_gross_profit) >= 0 ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "linear-gradient(135deg,#fef2f2,#fee2e2)", border: `1px solid ${Number(summary.total_gross_profit) >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: Number(summary.total_gross_profit) >= 0 ? "#15803d" : "#991b1b", textTransform: "uppercase", letterSpacing: 1 }}>Total Gross Profit</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: Number(summary.total_gross_profit) >= 0 ? "#166534" : "#7f1d1d", marginTop: 6 }}>{fmt(summary.total_gross_profit)}</div>
        </div>
        <div style={{ flex: "1 1 200px", padding: 22, borderRadius: 16, background: "linear-gradient(135deg,#fff7ed,#fed7aa)", border: "1px solid #fdba74" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#9a3412", textTransform: "uppercase", letterSpacing: 1 }}>Fresh + Mistake Remaining</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#7c2d12", marginTop: 6 }}>
            {Number(summary.total_fresh_remaining || 0) + Number(summary.total_mistake_remaining || 0)} pcs
          </div>
          <div style={{ fontSize: 11, color: "#9a3412", marginTop: 2 }}>
            {summary.total_fresh_remaining ?? 0} fresh · {summary.total_mistake_remaining ?? 0} mistake
          </div>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: "1 1 280px" }}>
          <FaSearch style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} size={13} />
          <input
            type="text"
            placeholder="Search by Journey ID or product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "active", "partial", "exhausted"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize",
                border: statusTab === tab ? "2px solid #5B4BFF" : "1px solid #e2e8f0",
                background: statusTab === tab ? "#eef2ff" : "#fff",
                color: statusTab === tab ? "#4338ca" : "#64748b",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Journey ID</th>
              <th>Product</th>
              <th>Supplier</th>
              <th>Purchase Date</th>
              <th className="text-right">Purchased</th>
              <th className="text-right">Fresh Left</th>
              <th className="text-right">Mistake Left</th>
              <th className="text-right">Converted</th>
              <th className="text-right">Total Sold</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Gross Profit</th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>View</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", color: "#94a3b8", padding: 48 }}>
                  {loading ? "Loading…" : "No product journeys yet. Click New Journey to start tracking a batch."}
                </td>
              </tr>
            ) : filtered.map((j) => {
              const badge = STATUS_STYLE[j.status] || STATUS_STYLE.active;
              return (
                <tr key={j.id}>
                  <td>
                    <button
                      onClick={() => navigate(`/inventory/journey/${j.id}`)}
                      style={{ background: "none", border: "none", padding: 0, color: "#5B4BFF", fontWeight: 800, cursor: "pointer", fontFamily: "monospace", fontSize: 13 }}
                    >
                      {j.journey_id}
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>{j.product_name}</td>
                  <td>{j.supplier_ref_name || j.supplier_name || "—"}</td>
                  <td>{new Date(j.purchase_date).toLocaleDateString("en-IN")}</td>
                  <td className="text-right">{j.total_purchased}</td>
                  <td className="text-right" style={{ color: j.fresh_remaining > 0 ? "#15803d" : "#94a3b8", fontWeight: 700 }}>{j.fresh_remaining}</td>
                  <td className="text-right" style={{ color: j.mistake_remaining > 0 ? "#b45309" : "#94a3b8", fontWeight: 700 }}>{j.mistake_remaining}</td>
                  <td className="text-right">{j.total_converted_to_fresh}</td>
                  <td className="text-right">{j.total_sold}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{fmt(j.total_revenue)}</td>
                  <td className="text-right" style={{ fontWeight: 800, color: Number(j.gross_profit) >= 0 ? "#15803d" : "#dc2626" }}>{fmt(j.gross_profit)}</td>
                  <td>
                    <span style={{ background: badge.bg, color: badge.color, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                      {j.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="page-btn-round-sm"
                      onClick={() => navigate(`/inventory/journey/${j.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manual Journey Entry modal */}
      {showModal && (
        <div className="page-modal-overlay" style={{ zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>New Product Journey</h2>
            <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 20 }}>Manually register a purchase batch — for a past bill that predates this tracker, or one placed elsewhere.</p>
            <form onSubmit={handleCreate} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Product *</label>
                <select
                  value={form.product_id}
                  onChange={(e) => {
                    const p = products.find((x) => String(x.id) === e.target.value);
                    setForm({ ...form, product_id: e.target.value, product_name: p ? p.name : form.product_name, product_code: p?.sku || form.product_code });
                  }}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  <option value="">-- Select from products, or type below --</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</option>)}
                </select>
                <input
                  type="text" placeholder="Or type product name manually"
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 8 }}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Purchase Bill *</label>
                <select
                  value={form.purchase_bill_id}
                  onChange={(e) => setForm({ ...form, purchase_bill_id: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  required
                >
                  <option value="">-- Select purchase bill --</option>
                  {purchaseBills.map((b) => <option key={b.id} value={b.id}>{b.bill_number} — {b.supplier_name || ""}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Supplier</label>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => {
                      const s = suppliers.find((x) => String(x.id) === e.target.value);
                      setForm({ ...form, supplier_id: e.target.value, supplier_name: s ? s.name : form.supplier_name });
                    }}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="">-- Select --</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Branch</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="">-- Select --</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Purchase Rate / pc (₹)</label>
                  <input type="number" min="0" step="0.01" value={form.purchase_rate} onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Total Purchased *</label>
                  <input type="number" min="0" value={form.total_purchased} onChange={(e) => setForm({ ...form, total_purchased: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }} required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 4, textTransform: "uppercase" }}>Fresh Pcs</label>
                  <input type="number" min="0" value={form.fresh_purchased} onChange={(e) => setForm({ ...form, fresh_purchased: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#b45309", marginBottom: 4, textTransform: "uppercase" }}>Mistake Pcs</label>
                  <input type="number" min="0" value={form.mistake_purchased} onChange={(e) => setForm({ ...form, mistake_purchased: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #fed7aa", background: "#fff7ed" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", minHeight: 60, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: "#5B4BFF", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Creating…" : "Create Journey"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductJourneyList;
