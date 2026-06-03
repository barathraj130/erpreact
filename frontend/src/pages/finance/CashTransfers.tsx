import React, { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { FaExchangeAlt, FaPlus, FaSync, FaTimes, FaArrowRight } from "react-icons/fa";
import "../PageShared.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n || 0));

const TRANSFER_TYPES = [
  { value: "BANK_TO_CASH", label: "🏦 Bank → Cash (Withdraw from Bank)" },
  { value: "CASH_TO_BANK", label: "💵 Cash → Bank (Deposit to Bank)" },
  { value: "BRANCH_TO_MAIN", label: "Branch → Main Branch" },
  { value: "MAIN_TO_BRANCH", label: "Main → Branch" },
  { value: "BRANCH_TO_BRANCH", label: "Branch → Branch" },
];

const CashTransfers: React.FC = () => {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    transfer_type: "BANK_TO_CASH",
    from_branch_id: "",
    to_branch_id: "",
    amount: 0,
    payment_mode: "CASH",
    transfer_date: new Date().toISOString().split("T")[0],
    reference_no: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [trRes, brRes] = await Promise.all([
        apiFetch("/cash-transfers").then(r => r.json()),
        apiFetch("/branches").then(r => r.json()).catch(() => []),
      ]);
      setTransfers(Array.isArray(trRes) ? trRes : []);
      setBranches(Array.isArray(brRes) ? brRes : []);
    } catch { setTransfers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/cash-transfers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({ transfer_type: "BANK_TO_CASH", from_branch_id: "", to_branch_id: "", amount: 0, payment_mode: "CASH", transfer_date: new Date().toISOString().split("T")[0], reference_no: "", notes: "" });
      load();
    } catch { alert("Failed to record transfer"); }
  };

  const totalOut = transfers.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Cash Transfers</h1>
          <p>Record inter-branch handovers and fund movements between accounts.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load}><FaSync className={loading ? "fa-spin" : ""} size={12} /></button>
          <button className="page-btn-round page-btn-round-primary" onClick={() => setShowModal(true)}>
            <FaPlus size={11} /> New Transfer
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "32px" }}>
        <div style={{ flex: "1 1 200px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e40af", textTransform: "uppercase", letterSpacing: "1px" }}>Total Transfers</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#1e3a8a", marginTop: "8px" }}>{transfers.length}</div>
        </div>
        <div style={{ flex: "1 1 200px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "1px" }}>Total Amount Moved</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#064e3b", marginTop: "8px" }}>{fmt(totalOut)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>From</th>
              <th></th>
              <th>To</th>
              <th className="text-right">Amount</th>
              <th>Mode</th>
              <th>Ref No.</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>No transfers recorded yet.</td></tr>
            ) : transfers.map((t: any) => (
              <tr key={t.id}>
                <td>{new Date(t.transfer_date).toLocaleDateString("en-IN")}</td>
                <td>
                  <span className="type-badge type-badge-blue">
                    {TRANSFER_TYPES.find(x => x.value === t.transfer_type)?.label || t.transfer_type}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{t.from_branch_name || `Branch #${t.from_branch_id}`}</td>
                <td style={{ color: "#94a3b8" }}><FaArrowRight size={12} /></td>
                <td style={{ fontWeight: 600 }}>{t.to_branch_name || `Branch #${t.to_branch_id}`}</td>
                <td className="text-right font-mono" style={{ fontWeight: 700 }}>{fmt(t.amount)}</td>
                <td><span className="type-badge type-badge-green">{t.payment_mode}</span></td>
                <td style={{ color: "#64748b", fontSize: "13px" }}>{t.reference_no || "—"}</td>
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
                <h2 style={{ margin: 0 }}>Record Cash Transfer</h2>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <label>Transfer Type</label>
                <select value={form.transfer_type} onChange={e => setForm({ ...form, transfer_type: e.target.value })}>
                  {TRANSFER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <div className="form-grid-2">
                  <div>
                    <label>From Branch</label>
                    {branches.length > 0 ? (
                      <select value={form.from_branch_id} onChange={e => setForm({ ...form, from_branch_id: e.target.value })}>
                        <option value="">Select Branch</option>
                        {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      <input placeholder="Branch ID or name" value={form.from_branch_id}
                        onChange={e => setForm({ ...form, from_branch_id: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <label>To Branch</label>
                    {branches.length > 0 ? (
                      <select value={form.to_branch_id} onChange={e => setForm({ ...form, to_branch_id: e.target.value })}>
                        <option value="">Select Branch</option>
                        {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      <input placeholder="Branch ID or name" value={form.to_branch_id}
                        onChange={e => setForm({ ...form, to_branch_id: e.target.value })} />
                    )}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Amount (₹)</label>
                    <input type="number" required min="0.01" step="0.01" value={form.amount}
                      onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Date</label>
                    <input type="date" required value={form.transfer_date}
                      onChange={e => setForm({ ...form, transfer_date: e.target.value })} />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Payment Mode</label>
                    <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label>Reference No. (optional)</label>
                    <input value={form.reference_no} placeholder="e.g. CHQ-1234"
                      onChange={e => setForm({ ...form, reference_no: e.target.value })} />
                  </div>
                </div>

                <label>Notes (optional)</label>
                <input value={form.notes} placeholder="e.g. End-of-day branch handover"
                  onChange={e => setForm({ ...form, notes: e.target.value })} />

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary">Record Transfer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CashTransfers;
