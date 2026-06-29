import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../utils/api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Lot {
  id: number; lot_number: string; status: string;
  product_name: string; supplier_name: string; supplier_phone?: string;
  purchase_date: string; total_purchase_cost: number; total_repair_cost: number;
  fresh_qty_purchased: number; mistake_qty_purchased: number;
  fresh_purchase_rate: number; mistake_purchase_rate: number;
  transport_cost: number; converted_qty: number; rejected_qty: number;
}
interface InvRow  { stock_type: string; quantity: number; avg_cost: number; total_cost: number; }
interface Inspection { id: number; inspection_date: string; inspector_name: string; source_type: string; qty_inspected: number; qty_ok: number; qty_rejected: number; notes: string; }
interface Conversion { id: number; conversion_date: string; qty_in: number; qty_out: number; rejected_qty: number; repair_cost_per_piece: number; total_repair_cost: number; converted_avg_cost: number; repair_worker: string; payment_mode: string; source_type: string; notes: string; }
interface Return { id: number; return_date: string; customer_name: string; total_returned: number; returned_ok: number; returned_mistake: number; return_reason: string; }
interface Txn { id: number; created_at: string; transaction_type: string; stock_type_from: string; stock_type_to: string; quantity: number; rate: number; amount: number; notes: string; }

// ─── Styles ───────────────────────────────────────────────────────────────────
const MODAL_INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};
const MODAL_LABEL: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 6 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" };
const btnPrimary: React.CSSProperties = { background: "#1e293b", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnGhost: React.CSSProperties  = { background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnGreen: React.CSSProperties  = { background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnAmber: React.CSSProperties  = { background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnPurple: React.CSSProperties = { background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" };

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  received:     { bg: "#f3f4f6", color: "#374151" },
  inspecting:   { bg: "#dbeafe", color: "#1d4ed8" },
  converting:   { bg: "#fef3c7", color: "#b45309" },
  ready:        { bg: "#d1fae5", color: "#065f46" },
  partial_sold: { bg: "#ede9fe", color: "#5b21b6" },
  sold_out:     { bg: "#ccfbf1", color: "#0f766e" },
  closed:       { bg: "#e5e7eb", color: "#1f2937" },
};

const fmt    = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtD   = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const today  = () => new Date().toISOString().slice(0, 10);

const STOCK_TYPE_LABEL: Record<string, string> = {
  fresh: "Fresh", fresh_converted: "Converted Fresh", mistake: "Mistake", rejected: "Rejected",
};

const TABS = ["INVENTORY", "PURCHASES", "INSPECTIONS", "CONVERSIONS", "RETURNS", "TRANSACTIONS"];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProductionLotDetail() {
  const { id }   = useParams<{ id: string }>();
  const nav      = useNavigate();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("INVENTORY");
  const [err, setErr]         = useState("");
  const [saving, setSaving]   = useState(false);

  // Purchase modal
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchase, setPurchase] = useState({
    fresh_qty: "", fresh_rate: "", mistake_qty: "", mistake_rate: "",
    transport_cost: "", payment_mode: "cash", paid_amount: "",
  });

  // Inspect modal
  const [showInspect, setShowInspect] = useState(false);
  const [inspect, setInspect] = useState({
    source_type: "mistake", inspector_name: "", qty_inspected: "", qty_ok: "", qty_rejected: "", notes: "",
  });

  // Convert modal
  const [showConvert, setShowConvert] = useState(false);
  const [convert, setConvert] = useState({
    source_type: "mistake", qty_in: "", qty_out: "", rejected_qty: "",
    repair_cost_per_piece: "", repair_worker: "", payment_mode: "cash", notes: "",
  });

  // Return modal
  const [showReturn, setShowReturn] = useState(false);
  const [ret, setRet] = useState({
    invoice_id: "", customer_id: "", return_qty: "", returned_ok: "", returned_mistake: "",
    return_reason: "", notes: "",
  });

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res  = await apiFetch(`/production/lots/${id}`);
      const json = await res.json();
      if (json.success) setData(json);
      else setErr(json.error || "Failed to load lot");
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  }

  const lot: Lot | null = data?.lot || null;
  const inventory: InvRow[]    = data?.inventory  || [];
  const inspections: Inspection[] = data?.inspections || [];
  const conversions: Conversion[] = data?.conversions || [];
  const returns: Return[]      = data?.returns     || [];
  const transactions: Txn[]   = data?.transactions || [];

  // Auto-compute for purchase modal
  const freshAmt   = (parseFloat(purchase.fresh_qty   || "0") * parseFloat(purchase.fresh_rate   || "0")).toFixed(2);
  const mistakeAmt = (parseFloat(purchase.mistake_qty || "0") * parseFloat(purchase.mistake_rate || "0")).toFixed(2);
  const purchaseTotal = (parseFloat(freshAmt) + parseFloat(mistakeAmt) + parseFloat(purchase.transport_cost || "0")).toFixed(2);

  // Auto-compute for convert modal
  const mistakeStock = inventory.find(r => r.stock_type === convert.source_type);
  const mistakeAvgCost = parseFloat(String(mistakeStock?.avg_cost || 0));
  const totalRepairCost = (parseFloat(convert.qty_out || "0") * parseFloat(convert.repair_cost_per_piece || "0")).toFixed(2);
  const qIn  = parseFloat(convert.qty_in  || "0");
  const qOut = parseFloat(convert.qty_out || "0");
  const newAvgCost = qOut > 0
    ? ((qIn * mistakeAvgCost + parseFloat(totalRepairCost)) / qOut).toFixed(2)
    : "0.00";

  // Available mistake qty
  const mistakeAvail = parseInt(String(mistakeStock?.quantity || 0));

  async function savePurchase() {
    setSaving(true); setErr("");
    try {
      const res  = await apiFetch(`/production/lots/${id}/purchase`, { method: "POST", body: purchase });
      const json = await res.json();
      if (json.success) { setShowPurchase(false); setPurchase({ fresh_qty: "", fresh_rate: "", mistake_qty: "", mistake_rate: "", transport_cost: "", payment_mode: "cash", paid_amount: "" }); load(); }
      else setErr(json.error || "Purchase failed");
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  async function saveInspect() {
    setSaving(true); setErr("");
    try {
      const res  = await apiFetch(`/production/lots/${id}/inspect`, { method: "POST", body: inspect });
      const json = await res.json();
      if (json.success) { setShowInspect(false); setInspect({ source_type: "mistake", inspector_name: "", qty_inspected: "", qty_ok: "", qty_rejected: "", notes: "" }); load(); }
      else setErr(json.error || "Inspection failed");
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  async function saveConvert() {
    setSaving(true); setErr("");
    try {
      const res  = await apiFetch(`/production/lots/${id}/convert`, { method: "POST", body: convert });
      const json = await res.json();
      if (json.success) { setShowConvert(false); setConvert({ source_type: "mistake", qty_in: "", qty_out: "", rejected_qty: "", repair_cost_per_piece: "", repair_worker: "", payment_mode: "cash", notes: "" }); load(); }
      else setErr(json.error || "Conversion failed");
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  async function saveReturn() {
    setSaving(true); setErr("");
    try {
      const res  = await apiFetch(`/production/lots/${id}/return`, { method: "POST", body: ret });
      const json = await res.json();
      if (json.success) { setShowReturn(false); setRet({ invoice_id: "", customer_id: "", return_qty: "", returned_ok: "", returned_mistake: "", return_reason: "", notes: "" }); load(); }
      else setErr(json.error || "Return failed");
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Loading lot details…</div>;
  if (!lot)    return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{ color: "#ef4444", marginBottom: 12 }}>{err || "Lot not found"}</div>
      <button onClick={() => nav("/production/lots")} style={btnGhost}>← Back to Lots</button>
    </div>
  );

  const sc = STATUS_COLOR[lot.status] || { bg: "#f3f4f6", color: "#374151" };

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button onClick={() => nav("/production/lots")} style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}>← Lots</button>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b" }}>{lot.lot_number}</h1>
            <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>
              {lot.status?.replace("_", " ").replace(/\b\w/g, x => x.toUpperCase())}
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            {lot.product_name} &nbsp;·&nbsp; {lot.supplier_name || "No supplier"} &nbsp;·&nbsp; {fmtD(lot.purchase_date)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowPurchase(true)} style={btnPrimary}>+ Purchase</button>
          <button onClick={() => setShowInspect(true)}  style={btnAmber}>Inspect</button>
          <button onClick={() => setShowConvert(true)}  style={btnPurple} disabled={mistakeAvail === 0}>
            Convert to Fresh {mistakeAvail > 0 ? `(${mistakeAvail})` : ""}
          </button>
          <button onClick={() => setShowReturn(true)}   style={btnGreen}>Process Return</button>
        </div>
      </div>

      {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{err}</div>}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Fresh Available",    val: `${(inventory.find(r => r.stock_type === "fresh")?.quantity || 0) + (inventory.find(r => r.stock_type === "fresh_converted")?.quantity || 0)} pcs`, color: "#059669" },
          { label: "Mistake Available",  val: `${inventory.find(r => r.stock_type === "mistake")?.quantity || 0} pcs`, color: "#f59e0b" },
          { label: "Total Repair Cost",  val: fmt(lot.total_repair_cost), color: "#8b5cf6" },
          { label: "Rejected",           val: `${inventory.find(r => r.stock_type === "rejected")?.quantity || 0} pcs`, color: "#ef4444" },
          { label: "Total Purchase Cost",val: fmt(lot.total_purchase_cost), color: "#1d4ed8" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: tab === t ? "#1e293b" : "transparent",
            color: tab === t ? "#fff" : "#64748b",
          }}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {tab === "INVENTORY" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["STOCK TYPE", "QTY", "AVG COST", "TOTAL VALUE"].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No stock entries yet</td></tr>
              ) : inventory.map(r => (
                <tr key={r.stock_type} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#1e293b" }}>
                    {STOCK_TYPE_LABEL[r.stock_type] || r.stock_type}
                  </td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: r.quantity > 0 ? "#059669" : "#94a3b8" }}>{r.quantity} pcs</td>
                  <td style={{ padding: "14px 20px", color: "#374151" }}>{fmt(r.avg_cost)}/pc</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#1e293b" }}>{fmt(r.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "PURCHASES" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["FRESH QTY", "FRESH RATE", "MISTAKE QTY", "MISTAKE RATE", "TRANSPORT", "TOTAL"].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "14px 20px", fontWeight: 700, color: "#059669" }}>{lot.fresh_qty_purchased} pcs</td>
                <td style={{ padding: "14px 20px", color: "#374151" }}>{fmt(lot.fresh_purchase_rate)}/pc</td>
                <td style={{ padding: "14px 20px", fontWeight: 700, color: "#f59e0b" }}>{lot.mistake_qty_purchased} pcs</td>
                <td style={{ padding: "14px 20px", color: "#374151" }}>{fmt(lot.mistake_purchase_rate)}/pc</td>
                <td style={{ padding: "14px 20px", color: "#374151" }}>{fmt(lot.transport_cost)}</td>
                <td style={{ padding: "14px 20px", fontWeight: 800, color: "#1e293b" }}>{fmt(lot.total_purchase_cost)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === "INSPECTIONS" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["DATE", "INSPECTOR", "SOURCE", "INSPECTED", "OK", "REJECTED", "NOTES"].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No inspections recorded</td></tr>
              ) : inspections.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 20px", color: "#374151", fontSize: 13 }}>{fmtD(r.inspection_date)}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 600, color: "#1e293b" }}>{r.inspector_name || "—"}</td>
                  <td style={{ padding: "14px 20px", color: "#64748b" }}>{r.source_type}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700 }}>{r.qty_inspected}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#059669" }}>{r.qty_ok}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#ef4444" }}>{r.qty_rejected}</td>
                  <td style={{ padding: "14px 20px", color: "#64748b", fontSize: 13 }}>{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "CONVERSIONS" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["DATE", "QTY IN", "QTY OUT", "REJECTED", "COST/PC", "TOTAL COST", "NEW AVG COST", "WORKER"].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {conversions.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No conversions recorded</td></tr>
              ) : conversions.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 20px", color: "#374151", fontSize: 13 }}>{fmtD(r.conversion_date)}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#f59e0b" }}>{r.qty_in}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#059669" }}>{r.qty_out}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#ef4444" }}>{r.rejected_qty || 0}</td>
                  <td style={{ padding: "14px 20px", color: "#374151" }}>{fmt(r.repair_cost_per_piece)}/pc</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700 }}>{fmt(r.total_repair_cost)}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 800, color: "#059669" }}>{fmt(r.converted_avg_cost)}/pc</td>
                  <td style={{ padding: "14px 20px", color: "#64748b" }}>{r.repair_worker || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "RETURNS" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["DATE", "CUSTOMER", "TOTAL", "OK → FRESH", "MISTAKE", "REASON"].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {returns.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No returns recorded</td></tr>
              ) : returns.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 20px", color: "#374151", fontSize: 13 }}>{fmtD(r.return_date)}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>{r.customer_name || "—"}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700 }}>{r.total_returned}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#059669" }}>{r.returned_ok}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#f59e0b" }}>{r.returned_mistake}</td>
                  <td style={{ padding: "14px 20px", color: "#64748b" }}>{r.return_reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "TRANSACTIONS" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["DATE", "TYPE", "FROM", "TO", "QTY", "RATE", "AMOUNT", "NOTES"].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No transactions yet</td></tr>
              ) : transactions.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 20px", color: "#374151", fontSize: 12 }}>{fmtD(r.created_at)}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: "#f1f5f9", color: "#374151" }}>
                      {r.transaction_type}
                    </span>
                  </td>
                  <td style={{ padding: "12px 20px", color: "#64748b", fontSize: 12 }}>{STOCK_TYPE_LABEL[r.stock_type_from] || r.stock_type_from || "—"}</td>
                  <td style={{ padding: "12px 20px", color: "#64748b", fontSize: 12 }}>{STOCK_TYPE_LABEL[r.stock_type_to] || r.stock_type_to || "—"}</td>
                  <td style={{ padding: "12px 20px", fontWeight: 700 }}>{r.quantity}</td>
                  <td style={{ padding: "12px 20px", color: "#374151" }}>{r.rate ? fmt(r.rate) : "—"}</td>
                  <td style={{ padding: "12px 20px", fontWeight: 700 }}>{r.amount ? fmt(r.amount) : "—"}</td>
                  <td style={{ padding: "12px 20px", color: "#94a3b8", fontSize: 12 }}>{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Purchase Modal ─── */}
      {showPurchase && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Record Purchase — {lot.lot_number}</h2>
              <button onClick={() => setShowPurchase(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Fresh Qty", key: "fresh_qty", type: "number" },
                { label: "Fresh Rate (₹/pc)", key: "fresh_rate", type: "number" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={MODAL_LABEL}>{label}</label>
                  <input type={type} value={(purchase as any)[key]} onChange={e => setPurchase(p => ({ ...p, [key]: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
                </div>
              ))}
              <div style={{ background: "#f0fdf4", padding: "12px 16px", borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Fresh Amount</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#059669" }}>₹{freshAmt}</div>
              </div>
              <div />
              {[
                { label: "Mistake Qty", key: "mistake_qty", type: "number" },
                { label: "Mistake Rate (₹/pc)", key: "mistake_rate", type: "number" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={MODAL_LABEL}>{label}</label>
                  <input type={type} value={(purchase as any)[key]} onChange={e => setPurchase(p => ({ ...p, [key]: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
                </div>
              ))}
              <div style={{ background: "#fffbeb", padding: "12px 16px", borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Mistake Amount</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>₹{mistakeAmt}</div>
              </div>
              <div />
              <div>
                <label style={MODAL_LABEL}>Transport Cost</label>
                <input type="number" value={purchase.transport_cost} onChange={e => setPurchase(p => ({ ...p, transport_cost: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
              </div>
              <div style={{ background: "#f0f9ff", padding: "12px 16px", borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Total Purchase Cost</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1d4ed8" }}>₹{purchaseTotal}</div>
              </div>
              <div>
                <label style={MODAL_LABEL}>Payment Mode</label>
                <select value={purchase.payment_mode} onChange={e => setPurchase(p => ({ ...p, payment_mode: e.target.value }))} style={MODAL_INPUT as any}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                  <option value="credit">Credit</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div>
                <label style={MODAL_LABEL}>Paid Amount</label>
                <input type="number" value={purchase.paid_amount} onChange={e => setPurchase(p => ({ ...p, paid_amount: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
              </div>
            </div>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginTop: 14 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowPurchase(false)} style={btnGhost}>Cancel</button>
              <button onClick={savePurchase} disabled={saving} style={btnPrimary}>{saving ? "Saving…" : "Save Purchase"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Inspect Modal ─── */}
      {showInspect && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Record Inspection</h2>
              <button onClick={() => setShowInspect(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={MODAL_LABEL}>Source Type</label>
                <select value={inspect.source_type} onChange={e => setInspect(p => ({ ...p, source_type: e.target.value }))} style={MODAL_INPUT as any}>
                  <option value="mistake">Mistake</option>
                  <option value="fresh">Customer Return Mistake</option>
                </select>
              </div>
              <div>
                <label style={MODAL_LABEL}>Inspector Name</label>
                <input value={inspect.inspector_name} onChange={e => setInspect(p => ({ ...p, inspector_name: e.target.value }))} style={MODAL_INPUT} placeholder="Inspector name" />
              </div>
              {[
                { label: "Qty Inspected", key: "qty_inspected" },
                { label: "Qty OK", key: "qty_ok" },
                { label: "Qty Rejected", key: "qty_rejected" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={MODAL_LABEL}>{label}</label>
                  <input type="number" value={(inspect as any)[key]} onChange={e => setInspect(p => ({ ...p, [key]: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={MODAL_LABEL}>Notes</label>
                <textarea value={inspect.notes} onChange={e => setInspect(p => ({ ...p, notes: e.target.value }))} style={{ ...MODAL_INPUT, height: 70, resize: "none" } as any} placeholder="Optional notes" />
              </div>
            </div>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginTop: 14 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowInspect(false)} style={btnGhost}>Cancel</button>
              <button onClick={saveInspect} disabled={saving} style={btnAmber}>{saving ? "Saving…" : "Save Inspection"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Convert Modal ─── */}
      {showConvert && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Convert to Fresh</h2>
              <button onClick={() => setShowConvert(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
              Available in {convert.source_type}: <strong>{mistakeAvail} pcs</strong>  · Avg cost: <strong>{fmt(mistakeAvgCost)}/pc</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={MODAL_LABEL}>Source Type</label>
                <select value={convert.source_type} onChange={e => setConvert(p => ({ ...p, source_type: e.target.value }))} style={MODAL_INPUT as any}>
                  <option value="mistake">Mistake</option>
                  <option value="fresh_converted">Previously Converted</option>
                </select>
              </div>
              {[
                { label: "Qty In (from mistake)", key: "qty_in" },
                { label: "Fresh Qty Out", key: "qty_out" },
                { label: "Rejected Qty", key: "rejected_qty" },
                { label: "Repair Cost/Piece (₹)", key: "repair_cost_per_piece" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={MODAL_LABEL}>{label}</label>
                  <input type="number" value={(convert as any)[key]} onChange={e => setConvert(p => ({ ...p, [key]: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
                </div>
              ))}
              <div style={{ background: "#d1fae5", padding: "14px 16px", borderRadius: 10, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 11, color: "#065f46", fontWeight: 600 }}>Total Repair Cost</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>₹{totalRepairCost}</div>
              </div>
              <div style={{ background: "#f0fdf4", padding: "14px 16px", borderRadius: 10, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 11, color: "#065f46", fontWeight: 600 }}>New Avg Cost/Piece</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#059669" }}>₹{newAvgCost}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>(mistake cost + repair) ÷ qty out</div>
              </div>
              <div>
                <label style={MODAL_LABEL}>Repair Worker</label>
                <input value={convert.repair_worker} onChange={e => setConvert(p => ({ ...p, repair_worker: e.target.value }))} style={MODAL_INPUT} placeholder="Worker name" />
              </div>
              <div>
                <label style={MODAL_LABEL}>Payment Mode</label>
                <select value={convert.payment_mode} onChange={e => setConvert(p => ({ ...p, payment_mode: e.target.value }))} style={MODAL_INPUT as any}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={MODAL_LABEL}>Notes</label>
                <textarea value={convert.notes} onChange={e => setConvert(p => ({ ...p, notes: e.target.value }))} style={{ ...MODAL_INPUT, height: 60, resize: "none" } as any} placeholder="Optional notes" />
              </div>
            </div>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginTop: 14 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowConvert(false)} style={btnGhost}>Cancel</button>
              <button onClick={saveConvert} disabled={saving} style={btnPurple}>{saving ? "Saving…" : "Convert to Fresh"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Return Modal ─── */}
      {showReturn && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Process Customer Return</h2>
              <button onClick={() => setShowReturn(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#065f46" }}>
              OK pieces → back to Fresh stock. Mistake pieces → back to Mistake stock (can be converted again)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={MODAL_LABEL}>Invoice ID (optional)</label>
                <input type="number" value={ret.invoice_id} onChange={e => setRet(p => ({ ...p, invoice_id: e.target.value }))} style={MODAL_INPUT} placeholder="Invoice ID" />
              </div>
              <div>
                <label style={MODAL_LABEL}>Customer ID (optional)</label>
                <input type="number" value={ret.customer_id} onChange={e => setRet(p => ({ ...p, customer_id: e.target.value }))} style={MODAL_INPUT} placeholder="Customer ID" />
              </div>
              {[
                { label: "Total Returned", key: "return_qty" },
                { label: "OK Pieces → Fresh", key: "returned_ok" },
                { label: "Mistake Pieces", key: "returned_mistake" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={MODAL_LABEL}>{label}</label>
                  <input type="number" value={(ret as any)[key]} onChange={e => setRet(p => ({ ...p, [key]: e.target.value }))} style={MODAL_INPUT} placeholder="0" />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={MODAL_LABEL}>Return Reason</label>
                <input value={ret.return_reason} onChange={e => setRet(p => ({ ...p, return_reason: e.target.value }))} style={MODAL_INPUT} placeholder="Reason for return" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={MODAL_LABEL}>Notes</label>
                <textarea value={ret.notes} onChange={e => setRet(p => ({ ...p, notes: e.target.value }))} style={{ ...MODAL_INPUT, height: 60, resize: "none" } as any} placeholder="Optional notes" />
              </div>
            </div>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginTop: 14 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowReturn(false)} style={btnGhost}>Cancel</button>
              <button onClick={saveReturn} disabled={saving} style={btnGreen}>{saving ? "Saving…" : "Process Return"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
