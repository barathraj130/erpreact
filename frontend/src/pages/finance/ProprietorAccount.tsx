import React, { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserCircle, FaPlus, FaArrowDown, FaArrowUp, FaSync, FaTimes, FaMobileAlt, FaHandHoldingUsd, FaExternalLinkAlt } from "react-icons/fa";
import "../PageShared.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n || 0));

const today = () => new Date().toISOString().split("T")[0];

interface PersonalAccount { id: number; account_name: string; account_type: string; upi_id?: string; }

type TxType = "DRAWINGS" | "CAPITAL_INTRO" | "PERSONAL_RECEIPT" | "PERSONAL_PAYMENT";

const TX_META: Record<TxType, { label: string; color: string; bg: string; endpoint: string }> = {
  DRAWINGS:         { label: "Drawings (Withdrawal)",      color: "#dc2626", bg: "#fef2f2", endpoint: "/proprietor-transactions/drawings" },
  CAPITAL_INTRO:    { label: "Capital Introduction",       color: "#16a34a", bg: "#ecfdf5", endpoint: "/proprietor-transactions/capital" },
  PERSONAL_RECEIPT: { label: "Personal Receipt (Customer)", color: "#7c3aed", bg: "#f3e8ff", endpoint: "/proprietor-transactions/personal-receipt" },
  PERSONAL_PAYMENT: { label: "Personal Payment (Supplier)", color: "#d97706", bg: "#fffbeb", endpoint: "/proprietor-transactions/personal-payment" },
};

const ALL_FILTERS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAWINGS", label: "Drawings" },
  { key: "CAPITAL_INTRO", label: "Capital Intro" },
  { key: "PERSONAL_RECEIPT", label: "Personal Receipts" },
  { key: "PERSONAL_PAYMENT", label: "Personal Payments" },
];

const ProprietorAccount: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccount[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState<TxType>("DRAWINGS");
  const [form, setForm] = useState({ amount: "", payment_mode: "CASH", transaction_date: today(), notes: "", personal_account_id: "", party_id: "", party_name: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [txRes, paRes, custRes, suppRes] = await Promise.all([
        apiFetch("/proprietor-transactions").then(r => r.json()),
        apiFetch("/personal-accounts").then(r => r.json()),
        apiFetch("/users").then(r => r.json()).catch(() => []),
        apiFetch("/suppliers").then(r => r.json()).catch(() => []),
      ]);
      setTransactions(Array.isArray(txRes) ? txRes : []);
      setPersonalAccounts(Array.isArray(paRes) ? paRes.filter((a: any) => a.is_active) : []);
      setCustomers(Array.isArray(custRes) ? custRes : []);
      setSuppliers(Array.isArray(suppRes) ? suppRes : []);
    } catch { setTransactions([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openModal = (type: TxType) => {
    setTxType(type);
    setForm({ amount: "", payment_mode: "CASH", transaction_date: today(), notes: "", personal_account_id: "", party_id: "", party_name: "" });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const isPersonal = txType === "PERSONAL_RECEIPT" || txType === "PERSONAL_PAYMENT";
      const payload: any = { amount: parseFloat(form.amount), transaction_date: form.transaction_date, notes: form.notes };
      if (isPersonal) {
        payload.personal_account_id = parseInt(form.personal_account_id);
        payload.party_id   = form.party_id   ? parseInt(form.party_id)   : null;
        payload.party_name = form.party_name;
        payload.reference_id   = form.party_id ? parseInt(form.party_id) : null;
        payload.reference_type = txType === "PERSONAL_RECEIPT" ? "customer" : "supplier";
      } else {
        payload.payment_mode = form.payment_mode;
      }
      await apiFetch(TX_META[txType].endpoint, { method: "POST", body: JSON.stringify(payload) });
      setShowModal(false);
      load();
    } catch { alert("Failed to record transaction"); }
    finally { setSaving(false); }
  };

  const filtered = filter === "ALL" ? transactions : transactions.filter(t => t.transaction_type === filter);

  const totalCapital   = transactions.filter(t => t.transaction_type === "CAPITAL_INTRO").reduce((s, t) => s + Number(t.amount), 0);
  const totalDrawings  = transactions.filter(t => t.transaction_type === "DRAWINGS").reduce((s, t) => s + Number(t.amount), 0);
  const totalPReceipts = transactions.filter(t => t.transaction_type === "PERSONAL_RECEIPT").reduce((s, t) => s + Number(t.amount), 0);
  const totalPPayments = transactions.filter(t => t.transaction_type === "PERSONAL_PAYMENT").reduce((s, t) => s + Number(t.amount), 0);
  const netCapital     = totalCapital - totalDrawings;

  const isPersonalType = txType === "PERSONAL_RECEIPT" || txType === "PERSONAL_PAYMENT";

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Proprietor Account</h1>
          <p>Track drawings, capital, and personal account transactions.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load}><FaSync className={loading ? "fa-spin" : ""} size={12} /></button>
          <button className="page-btn-round" style={{ background: "#ecfdf5", color: "#16a34a", border: "1px solid #bbf7d0" }} onClick={() => openModal("CAPITAL_INTRO")}>
            <FaArrowDown size={11} /> Capital Intro
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={() => openModal("DRAWINGS")}>
            <FaArrowUp size={11} /> Drawings
          </button>
          <button className="page-btn-round" style={{ background: "#f3e8ff", color: "#7c3aed", border: "1px solid #d8b4fe" }} onClick={() => openModal("PERSONAL_RECEIPT")}>
            <FaMobileAlt size={11} /> Personal Receipt
          </button>
          <button className="page-btn-round" style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }} onClick={() => openModal("PERSONAL_PAYMENT")}>
            <FaHandHoldingUsd size={11} /> Personal Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
        <div style={{ flex: "1 1 160px", padding: "20px", borderRadius: "16px", background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.8px" }}>Capital Invested</div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#064e3b", marginTop: "6px" }}>{fmt(totalCapital)}</div>
        </div>
        <div style={{ flex: "1 1 160px", padding: "20px", borderRadius: "16px", background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "1px solid #fca5a5" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.8px" }}>Drawings Taken</div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#7f1d1d", marginTop: "6px" }}>{fmt(totalDrawings)}</div>
        </div>
        <div style={{ flex: "1 1 160px", padding: "20px", borderRadius: "16px", background: netCapital >= 0 ? "linear-gradient(135deg,#eff6ff,#dbeafe)" : "linear-gradient(135deg,#fff7ed,#ffedd5)", border: `1px solid ${netCapital >= 0 ? "#bfdbfe" : "#fed7aa"}` }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: netCapital >= 0 ? "#1e40af" : "#9a3412", textTransform: "uppercase", letterSpacing: "0.8px" }}>Net Capital</div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: netCapital >= 0 ? "#1e3a8a" : "#7c2d12", marginTop: "6px" }}>{fmt(netCapital)}</div>
        </div>
        <div style={{ flex: "1 1 160px", padding: "20px", borderRadius: "16px", background: "linear-gradient(135deg,#faf5ff,#f3e8ff)", border: "1px solid #d8b4fe" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.8px" }}>Personal Receipts</div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#6d28d9", marginTop: "6px" }}>{fmt(totalPReceipts)}</div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>Not in business ledger</div>
        </div>
        <div style={{ flex: "1 1 160px", padding: "20px", borderRadius: "16px", background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.8px" }}>Personal Payments</div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#b45309", marginTop: "6px" }}>{fmt(totalPPayments)}</div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>Not in business ledger</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {ALL_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="page-btn-round-sm"
            style={{ background: filter === f.key ? "#0f172a" : "#f1f5f9", color: filter === f.key ? "white" : "#475569", fontWeight: 700 }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Party / Account</th>
              <th className="text-right">Amount</th>
              <th>Mode</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>No transactions recorded yet.</td></tr>
            ) : filtered.map((t: any) => {
              const meta = TX_META[t.transaction_type as TxType] || { color: "#64748b", bg: "#f1f5f9", label: t.transaction_type };
              return (
                <tr key={t.id}>
                  <td>{new Date(t.transaction_date).toLocaleDateString("en-IN")}</td>
                  <td>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ fontSize: "13px", color: "#475569" }}>
                    {t.party_name || t.personal_account_name || "—"}
                  </td>
                  <td className="text-right font-mono" style={{ fontWeight: 700, color: meta.color }}>
                    {fmt(t.amount)}
                  </td>
                  <td>
                    {t.affects_ledger === false ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", background: "#f3e8ff", padding: "2px 8px", borderRadius: "20px" }}>PERSONAL</span>
                    ) : (
                      <span className="type-badge type-badge-blue">{t.payment_mode}</span>
                    )}
                  </td>
                  <td style={{ color: "#64748b", fontSize: "13px" }}>{t.notes || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px" }}>{TX_META[txType].label}</h2>
                  {isPersonalType && (
                    <div style={{ fontSize: "12px", color: "#7c3aed", marginTop: "4px", fontWeight: 600 }}>
                      Personal account only — does not affect business cash/bank ledger
                    </div>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes size={18} /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid-2">
                  <div>
                    <label>Amount (₹) *</label>
                    <input type="number" required min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <label>Date *</label>
                    <input type="date" required value={form.transaction_date}
                      onChange={e => setForm({ ...form, transaction_date: e.target.value })} />
                  </div>

                  {isPersonalType ? (
                    <>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label>Personal Account *</label>
                        <select required value={form.personal_account_id}
                          onChange={e => setForm({ ...form, personal_account_id: e.target.value })}>
                          <option value="">-- Select Account --</option>
                          {personalAccounts.map(pa => (
                            <option key={pa.id} value={pa.id}>{pa.account_name} ({pa.account_type})</option>
                          ))}
                        </select>
                        {personalAccounts.length === 0 && (
                          <div style={{ fontSize: "12px", color: "#f97316", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "8px 12px" }}>
                            <span>No personal accounts found.</span>
                            <button
                              type="button"
                              onClick={() => { setShowModal(false); navigate("/settings/personal-accounts"); }}
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f97316", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                            >
                              <FaExternalLinkAlt size={9} /> Add Personal Account
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label>{txType === "PERSONAL_RECEIPT" ? "Customer *" : "Supplier *"}</label>
                        <select
                          required
                          value={form.party_id}
                          onChange={e => {
                            const list = txType === "PERSONAL_RECEIPT" ? customers : suppliers;
                            const selected = list.find((x: any) => String(x.id) === e.target.value);
                            setForm({
                              ...form,
                              party_id: e.target.value,
                              party_name: selected ? (selected.username || selected.nickname || selected.name || "") : "",
                            });
                          }}
                        >
                          <option value="">-- Select {txType === "PERSONAL_RECEIPT" ? "Customer" : "Supplier"} --</option>
                          {(txType === "PERSONAL_RECEIPT" ? customers : suppliers).map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.username || p.nickname || p.name}
                            </option>
                          ))}
                        </select>
                        {(txType === "PERSONAL_RECEIPT" ? customers : suppliers).length === 0 && (
                          <div style={{ fontSize: "12px", color: "#f97316", marginTop: 4 }}>
                            No {txType === "PERSONAL_RECEIPT" ? "customers" : "suppliers"} found.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label>Payment Mode</label>
                      <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                        <option value="CASH">Cash</option>
                        <option value="BANK">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="CHEQUE">Cheque</option>
                      </select>
                    </div>
                  )}

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Notes (optional)</label>
                    <input type="text" placeholder="e.g. Monthly withdrawal" value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
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
