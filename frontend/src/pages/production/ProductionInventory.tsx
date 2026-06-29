import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";

interface Summary {
  total_fresh: number;
  total_converted: number;
  total_fresh_available: number;
  total_mistake: number;
  total_rejected: number;
  total_inventory_value: number;
  active_lots: number;
}

interface InventoryRow {
  lot_id: number;
  lot_number: string;
  purchase_date: string;
  status: string;
  product_name: string;
  supplier_name: string;
  fresh_qty: number;
  converted_qty: number;
  total_fresh: number;
  mistake_qty: number;
  rejected_qty: number;
  inventory_value: number;
  days_old: number;
}

const fmt  = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtD = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  received:     { bg: "#f3f4f6", color: "#374151" },
  inspecting:   { bg: "#dbeafe", color: "#1d4ed8" },
  converting:   { bg: "#fef3c7", color: "#b45309" },
  ready:        { bg: "#d1fae5", color: "#065f46" },
  partial_sold: { bg: "#ede9fe", color: "#5b21b6" },
  sold_out:     { bg: "#ccfbf1", color: "#0f766e" },
  closed:       { bg: "#e5e7eb", color: "#1f2937" },
};

function ageBadge(days: number) {
  const n = parseInt(String(days || 0));
  const [bg, color] = n <= 30 ? ["#d1fae5", "#065f46"] : n <= 60 ? ["#fef3c7", "#92400e"] : ["#fef2f2", "#991b1b"];
  return <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: bg, color }}>{n}d</span>;
}

export default function ProductionInventory() {
  const nav = useNavigate();
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [rows, setRows]         = useState<InventoryRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [sr, rr] = await Promise.all([
        apiFetch("/production/inventory/summary"),
        apiFetch("/production/inventory"),
      ]);
      const sd = await sr.json();
      const rd = await rr.json();
      setSummary(sd || null);
      setRows(Array.isArray(rd) ? rd : []);
    } catch { setSummary(null); setRows([]); }
    finally { setLoading(false); }
  }

  const filtered = rows.filter(r =>
    !search ||
    r.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totals = {
    fresh:   filtered.reduce((a, r) => a + Number(r.total_fresh || 0), 0),
    mistake: filtered.reduce((a, r) => a + Number(r.mistake_qty || 0), 0),
    conv:    filtered.reduce((a, r) => a + Number(r.converted_qty || 0), 0),
    rej:     filtered.reduce((a, r) => a + Number(r.rejected_qty || 0), 0),
    val:     filtered.reduce((a, r) => a + Number(r.inventory_value || 0), 0),
  };

  const kpis = summary ? [
    { label: "Total Fresh Available", val: `${Number(summary.total_fresh_available).toLocaleString()} pcs`, color: "#059669", bg: "#d1fae5" },
    { label: "Total Mistake",         val: `${Number(summary.total_mistake).toLocaleString()} pcs`,         color: "#b45309", bg: "#fef3c7" },
    { label: "Converted to Fresh",    val: `${Number(summary.total_converted).toLocaleString()} pcs`,      color: "#5b21b6", bg: "#ede9fe" },
    { label: "Rejected",              val: `${Number(summary.total_rejected).toLocaleString()} pcs`,       color: "#b91c1c", bg: "#fef2f2" },
    { label: "Total Inventory Value", val: fmt(Number(summary.total_inventory_value)),                     color: "#1d4ed8", bg: "#dbeafe" },
    { label: "Active Lots",           val: `${summary.active_lots}`,                                       color: "#374151", bg: "#f3f4f6" },
  ] : [];

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", margin: 0 }}>Production Inventory</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 4, marginBottom: 0 }}>
            Live stock levels across all production lots
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} style={{ background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            ↻ Refresh
          </button>
          <button onClick={() => nav("/production/lots")} style={{ background: "#1e293b", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Manage Lots
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {!loading && summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search lot, product, supplier…"
          style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", width: 280 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["LOT NO", "PRODUCT", "SUPPLIER", "FRESH", "MISTAKE", "CONVERTED", "REJECTED", "VALUE", "AGE", "STATUS"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No inventory data. Purchase stock to get started.</td></tr>
            ) : (
              <>
                {filtered.map(r => {
                  const sc = STATUS_COLOR[r.status] || { bg: "#f3f4f6", color: "#374151" };
                  return (
                    <tr key={r.lot_id}
                      onClick={() => nav(`/production/lots/${r.lot_id}`)}
                      style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{r.lot_number}</td>
                      <td style={{ padding: "14px 16px", color: "#374151", fontSize: 13 }}>{r.product_name}</td>
                      <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>{r.supplier_name || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 700, color: "#059669" }}>{Number(r.total_fresh || 0).toLocaleString()}</span>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 700, color: "#f59e0b" }}>{Number(r.mistake_qty || 0).toLocaleString()}</span>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 700, color: "#8b5cf6" }}>{Number(r.converted_qty || 0).toLocaleString()}</span>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 700, color: r.rejected_qty > 0 ? "#ef4444" : "#94a3b8" }}>
                          {Number(r.rejected_qty || 0).toLocaleString()}
                        </span>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}> pcs</span>
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#1e293b" }}>{fmt(r.inventory_value)}</td>
                      <td style={{ padding: "14px 16px" }}>{ageBadge(r.days_old)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                          {r.status?.replace("_", " ").replace(/\b\w/g, x => x.toUpperCase())}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#1e293b", fontSize: 13 }} colSpan={3}>TOTAL ({filtered.length} lots)</td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#059669" }}>{totals.fresh.toLocaleString()} pcs</td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#f59e0b" }}>{totals.mistake.toLocaleString()} pcs</td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#8b5cf6" }}>{totals.conv.toLocaleString()} pcs</td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#ef4444" }}>{totals.rej.toLocaleString()} pcs</td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#1e293b" }}>{fmt(totals.val)}</td>
                  <td colSpan={2} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 20, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Age:</div>
        {[["≤30 days", "#d1fae5", "#065f46"], ["31–60 days", "#fef3c7", "#92400e"], [">60 days", "#fef2f2", "#991b1b"]].map(([label, bg, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: bg, border: `1px solid ${color}` }} />
            <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
