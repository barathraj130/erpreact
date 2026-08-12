// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
//
// Master-only platform revenue dashboard. Standalone page (does not modify
// MasterPanel.tsx) — reachable at /master/platform-finance, using the same
// master_token auth pattern as the existing Master Panel.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { masterFetch } from "./masterApi";

interface RevenueSummary {
  revenue: { total_revenue: number; total_payments: number; last_30_days: number };
  tenants: { total: number; active: number; trial: number; suspended: number; new_this_month: number };
  mrr: number;
  arr: number;
}
interface RevenueRow {
  id: number;
  company_name?: string;
  revenue_type: string;
  plan_name?: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
}

const fmt = (n: any) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const PlatformFinance: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ revenue_type: "subscription", plan_name: "", amount: "", payment_mode: "bank", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sumRes, rowRes] = await Promise.all([
        masterFetch("/org/platform/revenue-summary").then((r) => r.json()),
        masterFetch("/org/platform/revenue").then((r) => r.json()),
      ]);
      setSummary(sumRes);
      setRows(Array.isArray(rowRes) ? rowRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("master_token")) { window.location.href = "/fluxora-master"; return; }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!form.amount) return;
    setSaving(true);
    try {
      const res = await masterFetch("/org/platform/revenue", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) { setShowModal(false); setForm({ revenue_type: "subscription", plan_name: "", amount: "", payment_mode: "bank", notes: "" }); fetchAll(); }
      else alert(data.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", fontFamily: "'Inter', system-ui, sans-serif", color: "#111827" }}>
      <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "0.5px solid rgba(15,23,42,0.07)", padding: "0 24px", height: 62, display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate("/master")} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#5B4BFF", fontWeight: 700 }}>← Master Panel</button>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Platform Finance</span>
      </div>

      <div style={{ padding: 24 }}>
        {loading ? (
          <div style={{ color: "#64748b" }}>Loading…</div>
        ) : (
          <>
            {summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "MRR", value: `₹${fmt(summary.mrr)}`, color: "#10B981" },
                  { label: "ARR", value: `₹${fmt(summary.arr)}`, color: "#5B4BFF" },
                  { label: "Total Revenue", value: `₹${fmt(summary.revenue.total_revenue)}`, color: "#8B5CF6" },
                  { label: "Last 30 Days", value: `₹${fmt(summary.revenue.last_30_days)}`, color: "#F59E0B" },
                  { label: "Active Tenants", value: summary.tenants.active, color: "#10B981", raw: true },
                  { label: "New This Month", value: summary.tenants.new_this_month, color: "#5B4BFF", raw: true },
                ].map((c: any, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 14, border: "0.5px solid rgba(15,23,42,0.07)", padding: 18, boxShadow: "6px 6px 16px rgba(148,163,184,0.15), -4px -4px 12px rgba(255,255,255,0.8)" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{c.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.raw ? c.value : c.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Revenue History</div>
              <button onClick={() => setShowModal(true)} style={{ padding: "8px 16px", background: "linear-gradient(135deg,#5B4BFF,#7C6CFF)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Record Payment</button>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, border: "0.5px solid rgba(15,23,42,0.07)", overflow: "hidden", boxShadow: "6px 6px 16px rgba(148,163,184,0.15), -4px -4px 12px rgba(255,255,255,0.8)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(15,23,42,0.03)" }}>
                    {["Company", "Type", "Plan", "Amount", "Date", "Mode"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>No revenue recorded yet.</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "0.5px solid rgba(15,23,42,0.04)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.company_name || "—"}</td>
                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{r.revenue_type}</td>
                      <td style={{ padding: "12px 16px" }}>{r.plan_name || "—"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#10B981" }}>₹{fmt(r.amount)}</td>
                      <td style={{ padding: "12px 16px" }}>{r.payment_date?.slice(0, 10)}</td>
                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{r.payment_mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Record Platform Payment</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>TYPE</label>
              <select value={form.revenue_type} onChange={(e) => setForm((p) => ({ ...p, revenue_type: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                {["subscription", "setup_fee", "addon", "renewal", "upgrade", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>PLAN NAME</label>
              <input value={form.plan_name} onChange={(e) => setForm((p) => ({ ...p, plan_name: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>AMOUNT (₹) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, border: "1px solid #e2e8f0", background: "transparent", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              <button onClick={submit} disabled={saving} style={{ flex: 1, padding: 10, background: "#5B4BFF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformFinance;
