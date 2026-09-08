import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaWrench, FaSync } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

interface EventConfig { icon: string; color: string; bg: string; label: string; }
const EVENT_CONFIG: Record<string, EventConfig> = {
  purchased: { icon: "📦", color: "#5B4BFF", bg: "rgba(91,75,255,0.08)", label: "Purchased" },
  inventory_added: { icon: "🏭", color: "#3B82F6", bg: "rgba(59,130,246,0.08)", label: "Added to Inventory" },
  fresh_sold: { icon: "💰", color: "#10B981", bg: "rgba(16,185,129,0.08)", label: "Fresh Sale" },
  mistake_sold: { icon: "💸", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", label: "Mistake Sale" },
  customer_return_fresh: { icon: "🔄", color: "#EF4444", bg: "rgba(239,68,68,0.08)", label: "Customer Return — Fresh" },
  customer_return_mistake: { icon: "🔄", color: "#DC2626", bg: "rgba(220,38,38,0.08)", label: "Customer Return — Mistake" },
  fresh_resold: { icon: "♻️", color: "#06B6D4", bg: "rgba(6,182,212,0.08)", label: "Fresh Re-sold" },
  mistake_resold: { icon: "♻️", color: "#F97316", bg: "rgba(249,115,22,0.08)", label: "Mistake Re-sold" },
  mistake_to_fresh: { icon: "🔧", color: "#10B981", bg: "rgba(16,185,129,0.10)", label: "Converted to Fresh" },
  branch_transfer_out: { icon: "🚚", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", label: "Branch Transfer Out" },
  branch_transfer_in: { icon: "📥", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", label: "Branch Transfer In" },
  supplier_return: { icon: "↩️", color: "#64748B", bg: "rgba(100,116,139,0.08)", label: "Returned to Supplier" },
  adjustment: { icon: "⚙️", color: "#475569", bg: "rgba(71,85,105,0.08)", label: "Adjustment" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: "#dcfce7", color: "#15803d" },
  partial: { bg: "#fef3c7", color: "#b45309" },
  exhausted: { bg: "#e2e8f0", color: "#475569" },
  closed: { bg: "#1e293b", color: "#f1f5f9" },
};

const StockCard: React.FC<{ label: string; value: number; color: string; bg: string; border: string }> = ({ label, value, color, bg, border }) => (
  <div style={{ flex: "1 1 150px", padding: 16, borderRadius: 14, background: bg, border: `1px solid ${border}` }}>
    <div style={{ fontSize: 10.5, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 6 }}>{value} <span style={{ fontSize: 12, fontWeight: 600 }}>pcs</span></div>
  </div>
);

const ProductJourneyDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [showConvert, setShowConvert] = useState(false);
  const [convQty, setConvQty] = useState("");
  const [convType, setConvType] = useState("repair");
  const [convReason, setConvReason] = useState("");
  const [convCost, setConvCost] = useState("");
  const [converting, setConverting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/journey/${id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      console.error("Failed to load journey", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = data.journey;
    const qty = Number(convQty);
    if (!qty || qty <= 0) return alert("Enter a quantity greater than zero.");
    if (qty > j.mistake_remaining) return alert(`Only ${j.mistake_remaining} mistake pcs remaining.`);
    if (!convReason.trim() || convReason.trim().length < 3) return alert("Please give a reason for this conversion.");
    setConverting(true);
    try {
      const res = await apiFetch("/journey/convert-mistake-to-fresh", {
        method: "POST",
        body: JSON.stringify({
          journey_id: j.id,
          product_id: j.product_id,
          product_name: j.product_name,
          branch_id: j.branch_id,
          quantity_converted: qty,
          conversion_type: convType,
          reason: convReason,
          conversion_cost: Number(convCost) || 0,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Conversion failed");
      setShowConvert(false);
      setConvQty(""); setConvReason(""); setConvCost(""); setConvType("repair");
      load();
    } catch (err: any) {
      alert(err.message || "Conversion failed.");
    } finally {
      setConverting(false);
    }
  };

  if (loading && !data) {
    return <div className="page-container"><p style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Loading journey…</p></div>;
  }
  if (!data || !data.journey) {
    return (
      <div className="page-container">
        <button className="page-btn-round-sm" onClick={() => navigate("/inventory/journey")} style={{ marginBottom: 16 }}><FaArrowLeft size={11} /> Back</button>
        <p style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Journey not found.</p>
      </div>
    );
  }

  const { journey: j, timeline, customer_summary, conversions } = data;
  const badge = STATUS_STYLE[j.status] || STATUS_STYLE.active;

  return (
    <div className="page-container">
      <button className="page-btn-round-sm" onClick={() => navigate("/inventory/journey")} style={{ marginBottom: 16 }}><FaArrowLeft size={11} /> Back to Journeys</button>

      {/* Section 1 — Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: "#312e81" }}>{j.journey_id}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>{j.product_name} {j.category ? <span style={{ fontWeight: 500, color: "#94a3b8" }}>· {j.category}</span> : null}</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 6 }}>
            Purchased {new Date(j.purchase_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            {" · "}{j.supplier_ref_name || j.supplier_name || "Unknown supplier"}
            {j.branch_name ? ` · ${j.branch_name}` : ""}
            {j.purchase_bill_number ? ` · Bill ${j.purchase_bill_number}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: badge.bg, color: badge.color, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800, textTransform: "capitalize" }}>{j.status}</span>
          <button className="page-btn-round-sm" onClick={load} title="Refresh"><FaSync className={loading ? "fa-spin" : ""} size={12} /></button>
        </div>
      </div>

      {/* Section 2 — Stock status cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StockCard label="Purchased Total" value={j.total_purchased} color="#334155" bg="#f1f5f9" border="#e2e8f0" />
        <StockCard label="Fresh Purchased" value={j.fresh_purchased} color="#15803d" bg="#f0fdf4" border="#bbf7d0" />
        <StockCard label="Mistake Purchased" value={j.mistake_purchased} color="#b45309" bg="#fff7ed" border="#fed7aa" />
        <StockCard label="Fresh Remaining" value={j.fresh_remaining} color={j.fresh_remaining > 0 ? "#15803d" : "#64748b"} bg={j.fresh_remaining > 0 ? "#f0fdf4" : "#f8fafc"} border={j.fresh_remaining > 0 ? "#bbf7d0" : "#e2e8f0"} />
        <StockCard label="Mistake Remaining" value={j.mistake_remaining} color={j.mistake_remaining > 0 ? "#b45309" : "#64748b"} bg={j.mistake_remaining > 0 ? "#fff7ed" : "#f8fafc"} border={j.mistake_remaining > 0 ? "#fed7aa" : "#e2e8f0"} />
        <StockCard label="Converted to Fresh" value={j.total_converted_to_fresh} color="#0f766e" bg="#f0fdfa" border="#99f6e4" />
      </div>

      {/* Section 3 — Profit summary */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", padding: "20px 24px", borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0", marginBottom: 20 }}>
        {[
          { label: "Purchase Cost", value: j.total_purchase_cost },
          { label: "Fresh Revenue", value: j.fresh_revenue },
          { label: "Mistake Revenue", value: j.mistake_revenue },
          { label: "Conversion Cost", value: j.total_conversion_cost },
        ].map((s) => (
          <div key={s.label} style={{ minWidth: 130 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>{fmt(s.value)}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Gross Profit</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: Number(j.gross_profit) >= 0 ? "#15803d" : "#dc2626" }}>{fmt(j.gross_profit)}</div>
        </div>
      </div>

      {/* Section 4 — Convert button */}
      {j.mistake_remaining > 0 && (
        <button
          onClick={() => setShowConvert(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, border: "none", background: "#10B981", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 24 }}
        >
          <FaWrench size={13} /> Convert Mistake to Fresh ({j.mistake_remaining} pcs available)
        </button>
      )}

      {/* Section 5 — Timeline */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Complete Timeline</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {(!timeline || timeline.length === 0) && <p style={{ color: "#94a3b8" }}>No events recorded yet.</p>}
        {timeline?.map((ev: any) => {
          const cfg = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG.adjustment;
          return (
            <div key={ev.id} style={{ display: "flex", gap: 14, padding: 16, borderRadius: 12, background: cfg.bg, borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>{cfg.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontWeight: 800, color: cfg.color, fontSize: 13.5 }}>{cfg.label}</span>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>{new Date(ev.event_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
                <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>
                  {ev.description || (
                    <>
                      {ev.quantity} pcs
                      {ev.rate ? ` @ ₹${ev.rate}` : ""}
                      {ev.total_value ? ` — ${fmt(ev.total_value)}` : ""}
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "#475569" }}>
                  {(ev.customer_ref_name || ev.customer_name) && <span>👤 {ev.customer_ref_name || ev.customer_name}</span>}
                  {(ev.supplier_ref_name || ev.supplier_name) && <span>🏭 {ev.supplier_ref_name || ev.supplier_name}</span>}
                  {ev.reference_number && <span>📄 {ev.reference_number}</span>}
                  {ev.from_branch_name && ev.to_branch_name && <span>{ev.from_branch_name} → {ev.to_branch_name}</span>}
                </div>
                {ev.event_type === "customer_return_fresh" && (
                  <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "2px 8px", borderRadius: 999 }}>→ Back to Fresh Stock</span>
                )}
                {ev.event_type === "customer_return_mistake" && (
                  <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "2px 8px", borderRadius: 999 }}>→ Back to Mistake Stock</span>
                )}
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, borderTop: "1px dashed rgba(0,0,0,0.08)", paddingTop: 6 }}>
                  After this event: Fresh {ev.running_fresh_balance} pcs · Mistake {ev.running_mistake_balance} pcs
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 6 — Customer summary */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Customer Summary</h2>
      <div className="page-table-wrapper" style={{ marginBottom: 32 }}>
        <table className="page-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th className="text-right">Fresh Bought</th>
              <th className="text-right">Mistake Bought</th>
              <th className="text-right">Fresh Returned</th>
              <th className="text-right">Mistake Returned</th>
              <th className="text-right">Net Qty</th>
              <th className="text-right">Total Paid</th>
              <th className="text-right">Invoices</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {(!customer_summary || customer_summary.length === 0) ? (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No customer activity on this batch yet.</td></tr>
            ) : customer_summary.map((c: any) => {
              const netQty = Number(c.fresh_bought || 0) + Number(c.mistake_bought || 0) - Number(c.fresh_returned || 0) - Number(c.mistake_returned || 0);
              return (
                <tr key={c.customer_id}>
                  <td>
                    <button
                      onClick={() => navigate(`/customers/${c.customer_id}/ledger`)}
                      style={{ background: "none", border: "none", padding: 0, color: "#5B4BFF", fontWeight: 700, cursor: "pointer" }}
                    >
                      {c.customer_name || "—"}
                    </button>
                  </td>
                  <td className="text-right">{c.fresh_bought || 0}</td>
                  <td className="text-right">{c.mistake_bought || 0}</td>
                  <td className="text-right">{c.fresh_returned || 0}</td>
                  <td className="text-right">{c.mistake_returned || 0}</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{netQty}</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{fmt(c.total_paid)}</td>
                  <td className="text-right">{c.invoice_count || 0}</td>
                  <td>{c.last_activity ? new Date(c.last_activity).toLocaleDateString("en-IN") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Section 7 — Conversions history */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Conversions History</h2>
      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Qty Converted</th>
              <th>Type</th>
              <th>Reason</th>
              <th className="text-right">Cost</th>
              <th>Before</th>
              <th>After</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {(!conversions || conversions.length === 0) ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No mistake→fresh conversions on this batch yet.</td></tr>
            ) : conversions.map((c: any) => (
              <tr key={c.id}>
                <td>{new Date(c.conversion_date).toLocaleDateString("en-IN")}</td>
                <td className="text-right" style={{ fontWeight: 700 }}>{c.quantity_converted}</td>
                <td style={{ textTransform: "capitalize" }}>{String(c.conversion_type).replace(/_/g, " ")}</td>
                <td style={{ maxWidth: 220 }}>{c.reason}</td>
                <td className="text-right">{fmt(c.conversion_cost)}</td>
                <td>Fresh {c.before_fresh_qty} / Mistake {c.before_mistake_qty}</td>
                <td>Fresh {c.after_fresh_qty} / Mistake {c.after_mistake_qty}</td>
                <td>{c.converted_by_name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conversion modal */}
      {showConvert && (
        <div className="page-modal-overlay" style={{ zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>🔧 Convert Mistake to Fresh</h2>
            <form onSubmit={handleConvert} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>
                  Quantity to Convert (max {j.mistake_remaining})
                </label>
                <input
                  type="number" min="1" max={j.mistake_remaining} value={convQty}
                  onChange={(e) => setConvQty(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Conversion Type</label>
                <select value={convType} onChange={(e) => setConvType(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  <option value="repair">Physical Repair</option>
                  <option value="re_inspection">Re-Inspection</option>
                  <option value="processing">Processing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Reason *</label>
                <textarea value={convReason} onChange={(e) => setConvReason(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", minHeight: 60, resize: "vertical" }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Conversion Cost (₹, optional)</label>
                <input type="number" min="0" step="0.01" value={convCost} onChange={(e) => setConvCost(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              </div>

              {Number(convQty) > 0 && (
                <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px dashed #cbd5e1", fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Preview</div>
                  <div>Before: Fresh {j.fresh_remaining} pcs / Mistake {j.mistake_remaining} pcs</div>
                  <div>After: Fresh {j.fresh_remaining + Number(convQty)} pcs / Mistake {Math.max(0, j.mistake_remaining - Number(convQty))} pcs</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowConvert(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={converting} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: "#10B981", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: converting ? 0.7 : 1 }}>
                  {converting ? "Converting…" : "Confirm Conversion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductJourneyDetail;
