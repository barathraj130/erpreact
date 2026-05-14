import React, { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserCircle, FaPlus, FaArrowDown, FaArrowUp, FaSync, FaTimes } from "react-icons/fa";
import "../PageShared.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n || 0));

const ProprietorAccount: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState<"WITHDRAWAL" | "INVESTMENT">("WITHDRAWAL");
  const [form, setForm] = useState({
    amount: 0,
    payment_mode: "CASH",
    transaction_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/proprietor-transactions");
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch { setTransactions([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/proprietor-transactions", {
        method: "POST",
        body: JSON.stringify({ ...form, transaction_type: txType }),
      });
      setShowModal(false);
      setForm({ amount: 0, payment_mode: "CASH", transaction_date: new Date().toISOString().split("T")[0], notes: "" });
      load();
    } catch { alert("Failed to record transaction"); }
  };

  const totalInvestments = transactions.filter(t => t.transaction_type === "INVESTMENT").reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawals = transactions.filter(t => t.transaction_type === "WITHDRAWAL").reduce((s, t) => s + Number(t.amount), 0);
  const netCapital = totalInvestments - totalWithdrawals;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Proprietor Account</h1>
          <p>Track owner investments and withdrawals from the business.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load}><FaSync className={loading ? "fa-spin" : ""} size={12} /></button>
          <button className="page-btn-round" style={{ background: "#ecfdf5", color: "#16a34a", border: "1px solid #bbf7d0" }}
            onClick={() => { setTxType("INVESTMENT"); setShowModal(true); }}>
            <FaArrowDown size={11} /> Record Investment
          </button>
          <button className="page-btn-round page-btn-round-primary"
            onClick={() => { setTxType("WITHDRAWAL"); setShowModal(true); }}>
            <FaArrowUp size={11} /> Record Withdrawal
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "32px" }}>
        <div style={{ flex: "1 1 200px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "1px" }}>Total Invested</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#064e3b", marginTop: "8px" }}>{fmt(totalInvestments)}</div>
        </div>
        <div style={{ flex: "1 1 200px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "1px solid #fca5a5" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "1px" }}>Total Withdrawn</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#7f1d1d", marginTop: "8px" }}>{fmt(totalWithdrawals)}</div>
        </div>
        <div style={{ flex: "1 1 200px", padding: "24px", borderRadius: "20px", background: netCapital >= 0 ? "linear-gradient(135deg,#eff6ff,#dbeafe)" : "linear-gradient(135deg,#fff7ed,#ffedd5)", border: `1px solid ${netCapital >= 0 ? "#bfdbfe" : "#fed7aa"}` }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: netCapital >= 0 ? "#1e40af" : "#9a3412", textTransform: "uppercase", letterSpacing: "1px" }}>Net Capital</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: netCapital >= 0 ? "#1e3a8a" : "#7c2d12", marginTop: "8px" }}>{fmt(netCapital)}</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
              <th>Mode</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>No transactions recorded yet.</td></tr>
            ) : transactions.map((t: any) => (
              <tr key={t.id}>
                <td>{new Date(t.transaction_date).toLocaleDateString("en-IN")}</td>
                <td>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 700,
                    background: t.transaction_type === "INVESTMENT" ? "#ecfdf5" : "#fef2f2",
                    color: t.transaction_type === "INVESTMENT" ? "#16a34a" : "#dc2626"
                  }}>
                    {t.transaction_type === "INVESTMENT" ? <FaArrowDown size={10} /> : <FaArrowUp size={10} />}
                    {t.transaction_type}
                  </span>
                </td>
                <td className="text-right font-mono" style={{ fontWeight: 700, color: t.transaction_type === "INVESTMENT" ? "#16a34a" : "#dc2626" }}>
                  {t.transaction_type === "INVESTMENT" ? "+" : "-"}{fmt(t.amount)}
                </td>
                <td><span className="type-badge type-badge-blue">{t.payment_mode}</span></td>
                <td style={{ color: "#64748b", fontSize: "13px" }}>{t.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0 }}>
                  {txType === "INVESTMENT" ? "Record Investment" : "Record Withdrawal"}
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid-2">
                  <div>
                    <label>Amount (₹)</label>
                    <input type="number" required min="0.01" step="0.01" value={form.amount}
                      onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Date</label>
                    <input type="date" required value={form.transaction_date}
                      onChange={e => setForm({ ...form, transaction_date: e.target.value })} />
                  </div>
                </div>
                <label>Payment Mode</label>
                <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
                <label>Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Monthly personal withdrawal" />
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary">Save</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProprietorAccount;
