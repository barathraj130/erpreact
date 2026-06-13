import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

const fmt    = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtNum = (n: any) => Number(n || 0).toLocaleString("en-IN");
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const AGING_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  low:      { bg: "#dcfce7", color: "#15803d", label: "Fresh (0-30d)" },
  medium:   { bg: "#fef3c7", color: "#b45309", label: "Aging (31-60d)" },
  high:     { bg: "#fed7aa", color: "#c2410c", label: "Risk (61-90d)" },
  critical: { bg: "#fee2e2", color: "#dc2626", label: "Critical (90d+)" },
};

const STATUS_COLORS: Record<string, string> = {
  received: "#6b7280", inspecting: "#3b82f6", converting: "#f59e0b",
  ready: "#10b981", partial_sold: "#8b5cf6", sold_out: "#14b8a6",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Received", inspecting: "Inspecting", converting: "Converting",
  ready: "Ready", partial_sold: "Partial Sold", sold_out: "Sold Out",
};

type View = "by-lot" | "aging" | "valuation";

export default function StockInventory() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("by-lot");
  const [summary, setSummary] = useState<any>(null);
  const [byLot, setByLot] = useState<any[]>([]);
  const [valuation, setValuation] = useState<any[]>([]);
  const [aging, setAging] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [sumData, lotData, valData, ageData] = await Promise.all([
        apiFetch("/stock-inventory/summary"),
        apiFetch("/stock-inventory/by-lot"),
        apiFetch("/stock-inventory/valuation"),
        apiFetch("/stock-inventory/aging"),
      ]);
      setSummary(sumData);
      setByLot(Array.isArray(lotData) ? lotData : []);
      setValuation(Array.isArray(valData) ? valData : []);
      setAging(Array.isArray(ageData) ? ageData : []);
    } catch { }
    finally { setLoading(false); }
  }

  const VIEWS: { key: View; label: string }[] = [
    { key: "by-lot", label: "By Lot" },
    { key: "aging", label: "Aging Report" },
    { key: "valuation", label: "Valuation" },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Stock Inventory</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>Real-time surplus T-shirt stock levels across all lots</p>
        </div>
        <button onClick={() => navigate("/stock-lots")} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          View Lots →
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Fresh Available", value: `${fmtNum(summary?.total_fresh || 0)} pcs`, color: "#10b981" },
          { label: "Total Mistake Available", value: `${fmtNum(summary?.total_mistake || 0)} pcs`, color: "#f59e0b" },
          { label: "Total Inventory Value", value: fmt(summary?.total_inventory_value || 0), color: "#4f46e5" },
          { label: "Active Lots", value: String(summary?.active_lots || 0), color: "#8b5cf6" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* View Tabs + Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              style={{ padding: "12px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: view === v.key ? "#4f46e5" : "#64748b", borderBottom: `2px solid ${view === v.key ? "#4f46e5" : "transparent"}`, marginBottom: -1 }}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ padding: loading ? 40 : 0 }}>
          {loading && <div style={{ textAlign: "center", color: "#64748b" }}>Loading inventory…</div>}
        </div>

        {/* BY LOT VIEW */}
        {!loading && view === "by-lot" && (
          <div style={{ overflowX: "auto" }}>
            {byLot.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>No active inventory. Purchase stock lots to see inventory here.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Lot No", "Product", "Supplier", "Fresh Purch.", "Fresh Rep.", "Total Fresh", "Mistake", "Total Value", "Days Old", "Status"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byLot.map(row => {
                    const days = Number(row.days_old || 0);
                    const aging = days > 90 ? "critical" : days > 60 ? "high" : days > 30 ? "medium" : "low";
                    const daysColor = AGING_COLORS[aging];
                    return (
                      <tr key={row.lot_id} style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/stock-lots/${row.lot_id}`)}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#4f46e5", borderBottom: "0.5px solid #f1f5f9" }}>{row.lot_number}</td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{row.product_name || "—"}</td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", color: "#64748b" }}>{row.supplier_name || "—"}</td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", textAlign: "right" }}>
                          <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{fmtNum(row.fresh_purchased)}</span>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", textAlign: "right" }}>
                          <span style={{ background: "#e0e7ff", color: "#4338ca", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{fmtNum(row.fresh_repaired)}</span>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>{fmtNum(row.total_fresh)}</td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", textAlign: "right" }}>
                          <span style={{ background: "#fef3c7", color: "#b45309", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{fmtNum(row.mistake)}</span>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", textAlign: "right", fontWeight: 700 }}>{fmt(row.total_value)}</td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", textAlign: "right" }}>
                          <span style={{ background: daysColor.bg, color: daysColor.color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{days}d</span>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                          <span style={{ background: (STATUS_COLORS[row.status] || "#6b7280") + "20", color: STATUS_COLORS[row.status] || "#6b7280", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                            {STATUS_LABELS[row.status] || row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* AGING VIEW */}
        {!loading && view === "aging" && (
          <div>
            {/* Aging Legend */}
            <div style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "0.5px solid #f1f5f9", flexWrap: "wrap" }}>
              {Object.entries(AGING_COLORS).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1px solid ${v.color}` }} />
                  <span style={{ fontSize: 12, color: "#374151" }}>{v.label}</span>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              {aging.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>No active lots</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Lot No", "Product", "Purchase Date", "Days Old", "Current Stock", "Value at Risk", "Risk Level"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((row, i) => {
                      const c = AGING_COLORS[row.aging_flag] || AGING_COLORS.low;
                      return (
                        <tr key={i} style={{ background: row.aging_flag === "critical" ? "#fff5f5" : row.aging_flag === "high" ? "#fffbf0" : "" }}>
                          <td style={{ padding: "12px 14px", fontWeight: 700, color: "#4f46e5", borderBottom: "0.5px solid #f1f5f9" }}>{row.lot_number}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{row.product_name || "—"}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>{fmtDate(row.purchase_date)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 800, color: c.color }}>{row.days_old}d</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmtNum(row.total_stock)} pcs</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmt(row.value_at_risk)}</td>
                          <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                            <span style={{ background: c.bg, color: c.color, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* VALUATION VIEW */}
        {!loading && view === "valuation" && (
          <div style={{ padding: 24 }}>
            <div style={{ overflowX: "auto", marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Stock Type", "Total Qty", "Weighted Avg Cost", "Total Value"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: h === "Stock Type" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valuation.map(row => (
                    <tr key={row.stock_type}>
                      <td style={{ padding: "12px 14px", borderBottom: "0.5px solid #f1f5f9" }}>
                        <span style={{
                          background: row.stock_type === "fresh_purchased" ? "#dcfce7" : row.stock_type === "fresh_repaired" ? "#e0e7ff" : row.stock_type === "mistake" ? "#fef3c7" : "#fee2e2",
                          color: row.stock_type === "fresh_purchased" ? "#15803d" : row.stock_type === "fresh_repaired" ? "#4338ca" : row.stock_type === "mistake" ? "#b45309" : "#dc2626",
                          borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700
                        }}>
                          {row.stock_type}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmtNum(row.total_qty)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", borderBottom: "0.5px solid #f1f5f9" }}>{fmt(row.weighted_avg_cost)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", borderBottom: "0.5px solid #f1f5f9", fontWeight: 700 }}>{fmt(row.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Valuation Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { label: "Fresh Stock Value", value: fmt(valuation.filter(v => v.stock_type.includes("fresh")).reduce((a, v) => a + Number(v.total_value || 0), 0)), color: "#10b981" },
                { label: "Mistake Stock Value", value: fmt(valuation.find(v => v.stock_type === "mistake")?.total_value || 0), color: "#f59e0b" },
                { label: "Total Inventory Value", value: fmt(valuation.reduce((a, v) => a + Number(v.total_value || 0), 0)), color: "#4f46e5" },
              ].map(k => (
                <div key={k.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: `2px solid ${k.color}20` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
