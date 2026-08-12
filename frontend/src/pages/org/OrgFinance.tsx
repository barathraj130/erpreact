// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { FaPlus, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Transaction {
  id: number;
  transaction_type: string;
  category: string;
  amount: number;
  direction: "in" | "out";
  description: string;
  transaction_date: string;
}
interface Summary { total_income: number; total_expense: number; net: number; transaction_count: number; }

const fmt = (n: any) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const OrgFinance: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ direction: "in", category: "", amount: "", description: "", transaction_date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sumRes, txRes] = await Promise.all([
        apiFetch("/org/finance/summary").then((r) => r.json()),
        apiFetch("/org/finance/transactions").then((r) => r.json()),
      ]);
      setSummary(sumRes);
      setTransactions(Array.isArray(txRes) ? txRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const submit = async () => {
    if (!form.amount) { setErr("Amount is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await apiFetch("/org/finance/transactions", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setForm({ direction: "in", category: "", amount: "", description: "", transaction_date: new Date().toISOString().split("T")[0] });
        fetchAll();
      } else {
        setErr(data.error || "Failed to record transaction");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Fluxora Finance</h1>
          <p>Fluxora Technology's own income and expenses — separate from any tenant's finance.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn page-btn-primary" onClick={() => setShowModal(true)}><FaPlus /> Add Transaction</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Income", value: summary.total_income, color: "#10B981" },
            { label: "Total Expense", value: summary.total_expense, color: "#EF4444" },
            { label: "Net", value: summary.net, color: summary.net >= 0 ? "#10B981" : "#EF4444" },
            { label: "Transactions", value: summary.transaction_count, color: "#5B4BFF", raw: true },
          ].map((c, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 18, boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.raw ? c.value : `₹${fmt(c.value)}`}</div>
            </div>
          ))}
        </div>
      )}

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="page-empty">No transactions recorded yet.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.transaction_date?.slice(0, 10)}</td>
                  <td style={{ textTransform: "capitalize" }}>{t.category || t.transaction_type}</td>
                  <td>{t.description || "—"}</td>
                  <td className="text-right font-bold" style={{ color: t.direction === "in" ? "#10B981" : "#EF4444" }}>
                    {t.direction === "in" ? <FaArrowUp size={11} /> : <FaArrowDown size={11} />} ₹{fmt(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="page-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Transaction</h2>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}
            <label>Type</label>
            <select value={form.direction} onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))}>
              <option value="in">Income</option>
              <option value="out">Expense</option>
            </select>
            <label>Category</label>
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Rent, Consulting" />
            <label>Amount *</label>
            <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
            <label>Date</label>
            <input type="date" value={form.transaction_date} onChange={(e) => setForm((p) => ({ ...p, transaction_date: e.target.value }))} />
            <label>Description</label>
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgFinance;
