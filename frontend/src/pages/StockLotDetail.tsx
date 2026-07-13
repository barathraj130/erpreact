import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

const fmt    = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtNum = (n: any) => Number(n || 0).toLocaleString("en-IN");
const fmtPct = (n: any) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_COLORS: Record<string, string> = {
  received: "#6b7280", inspecting: "#3b82f6", converting: "#f59e0b",
  ready: "#10b981", partial_sold: "#8b5cf6", sold_out: "#14b8a6", closed: "#374151",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Received", inspecting: "Inspecting", converting: "Converting",
  ready: "Ready", partial_sold: "Partial Sold", sold_out: "Sold Out", closed: "Closed",
};

type Tab = "inventory" | "purchases" | "inspections" | "conversions" | "sales" | "profit";

export default function StockLotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lot, setLot] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [profit, setProfit] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("inventory");
  const [loading, setLoading] = useState(true);

  // Purchase form — Fresh/Mistake qty are entered as Bundles x Pcs/Bundle
  // (defaults to 1 bundle, so typing straight into Pcs/Bundle behaves like
  // plain pcs entry); converted to pieces only when submitting.
  const [showPurchase, setShowPurchase] = useState(false);
  const [pForm, setPForm] = useState({
    fresh_bundles: "1", fresh_pcs_per_bundle: "", fresh_rate: "",
    mistake_bundles: "1", mistake_pcs_per_bundle: "", mistake_rate: "",
    transport_cost: "", payment_mode: "cash", paid_amount: "", bill_number: "",
  });
  const [pSaving, setPSaving] = useState(false);
  const [pErr, setPErr] = useState("");
  const pFreshQty = (parseFloat(pForm.fresh_bundles || "1") || 1) * parseFloat(pForm.fresh_pcs_per_bundle || "0");
  const pMistakeQty = (parseFloat(pForm.mistake_bundles || "1") || 1) * parseFloat(pForm.mistake_pcs_per_bundle || "0");

  // Inspection form
  const [showInspect, setShowInspect] = useState(false);
  const [iForm, setIForm] = useState({ inspector_name: "", fresh_qty_inspected: "", fresh_passed: "", fresh_failed: "", mistake_qty_inspected: "", mistake_repairable: "", mistake_rejected: "", notes: "" });
  const [iSaving, setISaving] = useState(false);
  const [iErr, setIErr] = useState("");

  // Conversion form
  const [showConvert, setShowConvert] = useState(false);
  const [cForm, setCForm] = useState({ mistake_qty_in: "", fresh_qty_out: "", rejected_qty: "", repair_cost_per_piece: "", repair_worker: "", payment_mode: "cash", notes: "" });
  const [cSaving, setCSaving] = useState(false);
  const [cErr, setCErr] = useState("");

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [lotData, profitData, purchData, insData, convData, salesData] = await Promise.all([
        apiFetch(`/stock-lots/${id}`),
        apiFetch(`/stock-lots/${id}/profit`),
        apiFetch(`/stock-lots/${id}/purchases`),
        apiFetch(`/stock-lots/${id}/inspections`),
        apiFetch(`/stock-lots/${id}/conversions`),
        apiFetch(`/stock-lots/${id}/sales`),
      ]);
      setLot(lotData); setInventory(lotData?.inventory || []);
      setProfit(profitData);
      setPurchases(Array.isArray(purchData) ? purchData : []);
      setInspections(Array.isArray(insData) ? insData : []);
      setConversions(Array.isArray(convData) ? convData : []);
      setSales(Array.isArray(salesData) ? salesData : []);
    } catch { }
    finally { setLoading(false); }
  }

  async function submitPurchase() {
    setPSaving(true); setPErr("");
    try {
      const submission = {
        fresh_qty: String(pFreshQty),
        mistake_qty: String(pMistakeQty),
        fresh_rate: pForm.fresh_rate,
        mistake_rate: pForm.mistake_rate,
        transport_cost: pForm.transport_cost,
        payment_mode: pForm.payment_mode,
        paid_amount: pForm.paid_amount,
        bill_number: pForm.bill_number,
      };
      const res = await apiFetch(`/stock-lots/${id}/purchase`, { method: "POST", body: JSON.stringify(submission) });
      if (res.success) {
        setShowPurchase(false);
        setPForm({ fresh_bundles: "1", fresh_pcs_per_bundle: "", fresh_rate: "", mistake_bundles: "1", mistake_pcs_per_bundle: "", mistake_rate: "", transport_cost: "", payment_mode: "cash", paid_amount: "", bill_number: "" });
        loadAll();
      }
      else setPErr(res.error || "Failed");
    } catch (e: any) { setPErr(e.message); }
    finally { setPSaving(false); }
  }

  async function submitInspection() {
    setISaving(true); setIErr("");
    try {
      const res = await apiFetch("/stock-inspections", { method: "POST", body: JSON.stringify({ lot_id: id, ...iForm }) });
      if (res.success) { setShowInspect(false); setIForm({ inspector_name: "", fresh_qty_inspected: "", fresh_passed: "", fresh_failed: "", mistake_qty_inspected: "", mistake_repairable: "", mistake_rejected: "", notes: "" }); loadAll(); }
      else setIErr(res.error || "Failed");
    } catch (e: any) { setIErr(e.message); }
    finally { setISaving(false); }
  }

  async function submitConversion() {
    setCSaving(true); setCErr("");
    try {
      const res = await apiFetch("/stock-conversions", { method: "POST", body: JSON.stringify({ lot_id: id, ...cForm }) });
      if (res.success) { setShowConvert(false); setCForm({ mistake_qty_in: "", fresh_qty_out: "", rejected_qty: "", repair_cost_per_piece: "", repair_worker: "", payment_mode: "cash", notes: "" }); loadAll(); }
      else setCErr(res.error || "Failed");
    } catch (e: any) { setCErr(e.message); }
    finally { setCSaving(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading lot details…</div>;
  if (!lot) return <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>Lot not found</div>;

  const invMap: Record<string, any> = {};
  inventory.forEach(r => { invMap[r.stock_type] = r; });
  const freshPurchased = invMap["fresh_purchased"] || {};
  const freshRepaired  = invMap["fresh_repaired"]  || {};
  const mistakeInv     = invMap["mistake"]         || {};
  const rejectedInv    = invMap["rejected"]        || {};
  const totalFreshQty  = (Number(freshPurchased.quantity || 0) + Number(freshRepaired.quantity || 0));
  const totalFreshCost = (Number(freshPurchased.total_cost || 0) + Number(freshRepaired.total_cost || 0));
  const totalFreshAvg  = totalFreshQty > 0 ? totalFreshCost / totalFreshQty : 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: "inventory", label: "Inventory" },
    { key: "purchases", label: `Purchases (${purchases.length})` },
    { key: "inspections", label: `Inspections (${inspections.length})` },
    { key: "conversions", label: `Conversions (${conversions.length})` },
    { key: "sales", label: `Sales (${sales.length})` },
    { key: "profit", label: "Profit Analysis" },
  ];

  const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase" };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate("/stock-lots")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 10 }}>
          ← Back to Lots
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{lot.lot_number}</h1>
              <span style={{ background: STATUS_COLORS[lot.status] + "20", color: STATUS_COLORS[lot.status], borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                {STATUS_LABELS[lot.status] || lot.status}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
              {lot.supplier_name || "No supplier"} · {lot.product_name || "No product"} · {fmtDate(lot.purchase_date)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowPurchase(true)} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              + Purchase
            </button>
            <button onClick={() => setShowInspect(true)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Inspect
            </button>
            <button onClick={() => setShowConvert(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Convert
            </button>
            <button onClick={() => navigate(`/invoices/new?lot_id=${id}`)} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Sell
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Fresh Available", value: `${fmtNum(totalFreshQty)} pcs`, sub: `avg ${fmt(totalFreshAvg)}/pc`, color: "#10b981" },
          { label: "Mistake Available", value: `${fmtNum(mistakeInv.quantity || 0)} pcs`, sub: `avg ${fmt(mistakeInv.avg_cost || 0)}/pc`, color: "#f59e0b" },
          { label: "Total Repair Cost", value: fmt(lot.total_repair_cost), sub: `${fmtNum(lot.repaired_qty)} pcs repaired`, color: "#8b5cf6" },
          { label: "Lot Profit", value: fmt(profit?.gross_profit), sub: `${fmtPct(profit?.profit_margin)} margin`, color: Number(profit?.gross_profit) >= 0 ? "#10b981" : "#ef4444" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.04em" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "12px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tab === t.key ? "#4f46e5" : "#64748b", borderBottom: `2px solid ${tab === t.key ? "#4f46e5" : "transparent"}`, marginBottom: -1, whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {/* INVENTORY TAB */}
          {tab === "inventory" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Stock Type", "Qty Available", "Avg Cost", "Total Value"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: h === "Stock Type" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Fresh Purchased", key: "fresh_purchased", inv: freshPurchased, tag: { bg: "#dcfce7", color: "#15803d" } },
                    { label: "Fresh Repaired", key: "fresh_repaired", inv: freshRepaired, tag: { bg: "#e0e7ff", color: "#4338ca" } },
                    { label: "Mistake", key: "mistake", inv: mistakeInv, tag: { bg: "#fef3c7", color: "#b45309" } },
                    { label: "Rejected", key: "rejected", inv: rejectedInv, tag: { bg: "#fee2e2", color: "#dc2626" } },
                  ].map(row => (
                    <tr key={row.key}>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                        <span style={{ background: row.tag.bg, color: row.tag.color, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{row.label}</span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmtNum(row.inv.quantity || 0)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", borderBottom: "0.5px solid #f1f5f9" }}>{row.key === "rejected" ? "—" : fmt(row.inv.avg_cost || 0)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", borderBottom: "0.5px solid #f1f5f9" }}>{row.key === "rejected" ? "—" : fmt(row.inv.total_cost || 0)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                    <td style={{ padding: "12px 14px" }}>TOTAL FRESH</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>{fmtNum(totalFreshQty)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>{fmt(totalFreshAvg)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>{fmt(totalFreshCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* PURCHASES TAB */}
          {tab === "purchases" && (
            purchases.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No purchases yet. Click "+ Purchase" to record one.</div> :
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Bill No", "Fresh Qty", "Mistake Qty", "Fresh Rate", "Mistake Rate", "Transport", "Total", "Paid", "Balance", "Status"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{p.purchase_number || p.bill_number || "—"}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtNum(p.fresh_qty)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtNum(p.mistake_qty)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmt(p.fresh_rate)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmt(p.mistake_rate)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmt(p.transport_cost)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmt(p.total_amount)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#16a34a" }}>{fmt(p.paid_amount)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#dc2626" }}>{fmt(p.balance_amount)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                        <span style={{ background: p.status === "paid" ? "#dcfce7" : p.status === "partial" ? "#fef3c7" : "#fee2e2", color: p.status === "paid" ? "#15803d" : p.status === "partial" ? "#b45309" : "#dc2626", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                          {p.status || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* INSPECTIONS TAB */}
          {tab === "inspections" && (
            inspections.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No inspections recorded. Click "Inspect" to start.</div> :
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Date", "Inspector", "Fresh Insp.", "Passed", "Failed", "Mistake Insp.", "Repairable", "Rejected", "Notes"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inspections.map(ins => (
                    <tr key={ins.id}>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtDate(ins.inspection_date)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{ins.inspector_name || "—"}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtNum(ins.fresh_qty_inspected)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#16a34a", fontWeight: 700 }}>{fmtNum(ins.fresh_passed)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#dc2626", fontWeight: 700 }}>{fmtNum(ins.fresh_failed)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtNum(ins.mistake_qty_inspected)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#8b5cf6", fontWeight: 700 }}>{fmtNum(ins.mistake_repairable)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#dc2626", fontWeight: 700 }}>{fmtNum(ins.mistake_rejected)}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#64748b", fontSize: 12 }}>{ins.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CONVERSIONS TAB */}
          {tab === "conversions" && (
            <>
              {conversions.length > 0 && (
                <div style={{ display: "flex", gap: 20, marginBottom: 16, padding: "12px 16px", background: "#f8fafc", borderRadius: 10 }}>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total Converted</span><div style={{ fontWeight: 800, color: "#4f46e5" }}>{fmtNum(conversions.reduce((a, c) => a + Number(c.fresh_qty_out || 0), 0))} pcs</div></div>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Conversion Rate</span><div style={{ fontWeight: 800, color: "#10b981" }}>{fmtPct(profit?.conversion_efficiency)}</div></div>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total Repair Cost</span><div style={{ fontWeight: 800, color: "#ef4444" }}>{fmt(lot.total_repair_cost)}</div></div>
                </div>
              )}
              {conversions.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No conversions yet. Click "Convert" to repair mistake stock.</div> :
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Date", "Mistake In", "Fresh Out", "Rejected", "Cost/Pc", "Total Cost", "Worker"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map(c => (
                        <tr key={c.id}>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtDate(c.conversion_date)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#b45309", fontWeight: 700 }}>{fmtNum(c.mistake_qty_in)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#16a34a", fontWeight: 700 }}>{fmtNum(c.fresh_qty_out)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#dc2626" }}>{fmtNum(c.rejected_qty)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmt(c.repair_cost_per_piece)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmt(c.total_repair_cost)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#64748b" }}>{c.repair_worker || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </>
          )}

          {/* SALES TAB */}
          {tab === "sales" && (
            <>
              {sales.length > 0 && (
                <div style={{ display: "flex", gap: 20, marginBottom: 16, padding: "12px 16px", background: "#f8fafc", borderRadius: 10, flexWrap: "wrap" }}>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total Sold</span><div style={{ fontWeight: 800, color: "#4f46e5" }}>{fmtNum(sales.reduce((a, s) => a + Number(s.quantity || 0), 0))} pcs</div></div>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Revenue</span><div style={{ fontWeight: 800, color: "#10b981" }}>{fmt(sales.reduce((a, s) => a + Number(s.revenue || 0), 0))}</div></div>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Profit</span><div style={{ fontWeight: 800, color: Number(profit?.gross_profit) >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(profit?.gross_profit)}</div></div>
                  <div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Margin</span><div style={{ fontWeight: 800 }}>{fmtPct(profit?.profit_margin)}</div></div>
                </div>
              )}
              {sales.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No sales from this lot yet. Click "Sell" to create an invoice.</div> :
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Invoice No", "Date", "Customer", "Stock Type", "Qty", "Rate", "Revenue", "Profit/Pc", "Total Profit"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s, i) => (
                        <tr key={i}>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700, color: "#4f46e5" }}>{s.invoice_number}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtDate(s.invoice_date)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{s.customer_name}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                            <span style={{ background: (s.stock_type || "").includes("fresh") ? "#dcfce7" : "#fef3c7", color: (s.stock_type || "").includes("fresh") ? "#15803d" : "#b45309", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
                              {s.stock_type}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmtNum(s.quantity)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmt(s.unit_price)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmt(s.revenue)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: Number(s.profit_per_piece) >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{fmt(s.profit_per_piece)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: Number(s.total_profit) >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{fmt(s.total_profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </>
          )}

          {/* PROFIT ANALYSIS TAB */}
          {tab === "profit" && profit && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Cost Side */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Cost Breakdown</div>
                  {[
                    { label: `Fresh Purchased: ${fmtNum(lot.fresh_qty_purchased)} pcs × ${fmt(lot.fresh_purchase_rate)}`, value: profit.fresh_purchase_cost, color: "#3b82f6" },
                    { label: `Mistake Purchased: ${fmtNum(lot.mistake_qty_purchased)} pcs × ${fmt(lot.mistake_purchase_rate)}`, value: profit.mistake_purchase_cost, color: "#f59e0b" },
                    { label: "Transport Cost", value: profit.transport_cost, color: "#6b7280" },
                    { label: "TOTAL PURCHASE COST", value: profit.total_purchase_cost, bold: true, color: "#1e293b" },
                    { label: `Repair Cost: ${fmtNum(lot.repaired_qty)} pcs × ${fmt(profit.repair_cost_per_piece)}/pc`, value: profit.total_repair_cost, color: "#8b5cf6" },
                    { label: "TOTAL COST", value: profit.total_cost, bold: true, color: "#1e293b", bg: "#f8fafc" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderBottom: "0.5px solid #f1f5f9", background: row.bg || "transparent", borderRadius: row.bold ? 6 : 0 }}>
                      <span style={{ fontSize: 13, color: row.color, fontWeight: row.bold ? 800 : 500 }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: row.color }}>{fmt(row.value)}</span>
                    </div>
                  ))}
                </div>

                {/* Revenue + Profit Side */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Revenue & Profit</div>
                  {[
                    { label: `Fresh Revenue: ${fmtNum(profit.fresh_qty_sold)} pcs`, value: profit.fresh_revenue, color: "#10b981" },
                    { label: `Mistake Revenue: ${fmtNum(profit.mistake_qty_sold)} pcs`, value: profit.mistake_revenue, color: "#f59e0b" },
                    { label: "TOTAL REVENUE", value: profit.total_revenue, bold: true, color: "#1e293b" },
                    { label: "Total Cost", value: -profit.total_cost, color: "#ef4444" },
                    { label: "GROSS PROFIT", value: profit.gross_profit, bold: true, color: Number(profit.gross_profit) >= 0 ? "#16a34a" : "#dc2626", bg: "#f8fafc" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderBottom: "0.5px solid #f1f5f9", background: row.bg || "transparent", borderRadius: row.bold ? 6 : 0 }}>
                      <span style={{ fontSize: 13, color: row.color || "#374151", fontWeight: row.bold ? 800 : 500 }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: row.color || "#374151" }}>{fmt(Math.abs(Number(row.value)))}</span>
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
                    {[
                      { label: "Profit Margin", value: fmtPct(profit.profit_margin), color: "#4f46e5" },
                      { label: "Conversion Efficiency", value: fmtPct(profit.conversion_efficiency), color: "#8b5cf6" },
                    ].map(k => (
                      <div key={k.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, width: 560, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Record Purchase — {lot.lot_number}</h2>
                <button onClick={() => setShowPurchase(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                {pErr && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{pErr}</div>}

                {([
                  { label: "Fresh", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", bundlesKey: "fresh_bundles", pcsKey: "fresh_pcs_per_bundle", qty: pFreshQty },
                  { label: "Mistake", color: "#92400e", bg: "#fffbeb", border: "#fde68a", bundlesKey: "mistake_bundles", pcsKey: "mistake_pcs_per_bundle", qty: pMistakeQty },
                ] as const).map(g => (
                  <div key={g.label} style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>{g.label} Qty — Bundles x Pcs/Bundle</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <input type="number" min={1} placeholder="1" value={(pForm as any)[g.bundlesKey]}
                        onChange={e => setPForm(p => ({ ...p, [g.bundlesKey]: e.target.value }))}
                        style={{ ...inputStyle, background: g.bg, border: `1px solid ${g.border}` }} />
                      <input type="number" min={0} placeholder="0" value={(pForm as any)[g.pcsKey]}
                        onChange={e => setPForm(p => ({ ...p, [g.pcsKey]: e.target.value }))}
                        style={{ ...inputStyle, background: g.bg, border: `1px solid ${g.border}` }} />
                      <div style={{ padding: "10px 12px", borderRadius: 8, background: g.bg, color: g.color, fontSize: 14, fontWeight: 700 }}>
                        {g.qty.toLocaleString("en-IN")} pcs
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Fresh Rate (₹/pc)", key: "fresh_rate" },
                    { label: "Mistake Rate (₹/pc)", key: "mistake_rate" },
                    { label: "Transport Cost (₹)", key: "transport_cost" }, { label: "Bill Number", key: "bill_number" },
                    { label: "Amount Paid (₹)", key: "paid_amount" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type={f.key.includes("cost") || f.key.includes("rate") || f.key.includes("paid") ? "number" : "text"}
                        value={(pForm as any)[f.key]} onChange={e => setPForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                  <div>
                    <label style={labelStyle}>Payment Mode</label>
                    <select value={pForm.payment_mode} onChange={e => setPForm(p => ({ ...p, payment_mode: e.target.value }))} style={inputStyle}>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                </div>
                {/* Preview */}
                {(pFreshQty > 0 || pMistakeQty > 0) && (
                  <div style={{ marginTop: 16, padding: "12px 16px", background: "#f8fafc", borderRadius: 10 }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Fresh Cost: {fmt(pFreshQty * Number(pForm.fresh_rate || 0))} &nbsp;|&nbsp;
                      Mistake Cost: {fmt(pMistakeQty * Number(pForm.mistake_rate || 0))} &nbsp;|&nbsp;
                      Total: <strong>{fmt(pFreshQty * Number(pForm.fresh_rate || 0) + pMistakeQty * Number(pForm.mistake_rate || 0) + Number(pForm.transport_cost || 0))}</strong>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowPurchase(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                <button onClick={submitPurchase} disabled={pSaving} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {pSaving ? "Saving…" : "Record Purchase"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inspection Modal */}
      <AnimatePresence>
        {showInspect && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, width: 540, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Quality Inspection — {lot.lot_number}</h2>
                <button onClick={() => setShowInspect(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                {iErr && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{iErr}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Inspector Name", key: "inspector_name", type: "text" },
                    { label: "Fresh Qty Inspected", key: "fresh_qty_inspected", type: "number" },
                    { label: "Fresh Passed", key: "fresh_passed", type: "number" },
                    { label: "Fresh Failed", key: "fresh_failed", type: "number" },
                    { label: "Mistake Qty Inspected", key: "mistake_qty_inspected", type: "number" },
                    { label: "Mistake Repairable", key: "mistake_repairable", type: "number" },
                    { label: "Mistake Rejected", key: "mistake_rejected", type: "number" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type={f.type} value={(iForm as any)[f.key]} onChange={e => setIForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={iForm.notes} onChange={e => setIForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowInspect(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                <button onClick={submitInspection} disabled={iSaving} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {iSaving ? "Saving…" : "Save Inspection"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversion Modal */}
      <AnimatePresence>
        {showConvert && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, width: 540, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Stock Conversion — {lot.lot_number}</h2>
                <button onClick={() => setShowConvert(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                {cErr && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{cErr}</div>}
                <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  Available mistake stock: <strong>{fmtNum(invMap["mistake"]?.quantity || 0)} pcs</strong>
                  <br /><span style={{ fontSize: 11, color: "#92400e" }}>mistake_qty_in = fresh_qty_out + rejected_qty</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Mistake Qty In", key: "mistake_qty_in", type: "number" },
                    { label: "Fresh Qty Out", key: "fresh_qty_out", type: "number" },
                    { label: "Rejected Qty", key: "rejected_qty", type: "number" },
                    { label: "Repair Cost/Pc (₹)", key: "repair_cost_per_piece", type: "number" },
                    { label: "Repair Worker", key: "repair_worker", type: "text" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type={f.type} value={(cForm as any)[f.key]} onChange={e => setCForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                  <div>
                    <label style={labelStyle}>Payment Mode</label>
                    <select value={cForm.payment_mode} onChange={e => setCForm(p => ({ ...p, payment_mode: e.target.value }))} style={inputStyle}>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                </div>
                {(cForm.fresh_qty_out && cForm.repair_cost_per_piece) && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, fontSize: 12, color: "#15803d" }}>
                    Total Repair Cost: {fmt(Number(cForm.fresh_qty_out) * Number(cForm.repair_cost_per_piece))}
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={cForm.notes} onChange={e => setCForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowConvert(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                <button onClick={submitConversion} disabled={cSaving} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {cSaving ? "Converting…" : "Convert Stock"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
