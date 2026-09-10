import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../../../utils/api";
import "../../../styles/neo-neu-motion.css";

interface Loan {
  id: number;
  employee_id: number;
  employee_name: string;
  loan_amount: number;
  approved_amount: number | null;
  monthly_emi: number | null;
  purpose: string;
  repayment_months: number;
  total_repaid: number;
  balance_due: number | null;
  status: "pending" | "approved" | "rejected" | "active" | "closed";
  guarantor_name?: string | null;
  approved_by_name?: string | null;
  created_at: string;
}
interface Repayment { id: number; amount: number; repayment_date: string; repayment_mode: string; recorded_by_name?: string; notes?: string | null; }
interface HubUser { id: number; name: string; role: string; }

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fef3c7", color: "#b45309" },
  approved: { bg: "#dbeafe", color: "#1d4ed8" },
  active: { bg: "#dcfce7", color: "#15803d" },
  closed: { bg: "#e2e8f0", color: "#475569" },
  rejected: { bg: "#fee2e2", color: "#dc2626" },
};

const LoanManagement: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [tab, setTab] = useState<"all" | "active" | "pending" | "closed">("active");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);

  const [showNew, setShowNew] = useState(false);
  const [users, setUsers] = useState<HubUser[]>([]);
  const [nf, setNf] = useState<Record<string, any>>({});

  const [repayFor, setRepayFor] = useState<Loan | null>(null);
  const [rf, setRf] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    try {
      const q = tab === "all" ? "" : `?status=${tab}`;
      const res = await apiFetch(`/loan-chit/loans${q}`);
      setLoans(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tab]);

  const openNew = async () => {
    setShowNew(true);
    setNf({});
    const res = await apiFetch("/hub/users");
    setUsers(res.ok ? await res.json() : []);
  };

  const createLoan = async () => {
    if (!nf.employee_id || !nf.loan_amount || !nf.purpose || !nf.repayment_months) return alert("Employee, amount, purpose and months are required.");
    const res = await apiFetch("/loan-chit/loans", { method: "POST", body: JSON.stringify(nf) });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    setShowNew(false);
    load();
  };

  const setStatus = async (loan: Loan, status: string, approved_amount?: number) => {
    const res = await apiFetch(`/loan-chit/loans/${loan.id}`, { method: "PUT", body: JSON.stringify({ status, approved_amount }) });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    load();
  };

  const openRepay = (loan: Loan) => { setRepayFor(loan); setRf({ amount: loan.monthly_emi || "" }); };
  const recordRepay = async () => {
    if (!repayFor || !rf.amount || Number(rf.amount) <= 0) return alert("Enter a repayment amount.");
    const res = await apiFetch(`/loan-chit/loans/${repayFor.id}/repayment`, { method: "POST", body: JSON.stringify(rf) });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    setRepayFor(null);
    load();
    if (expanded === repayFor.id) toggleExpand(repayFor.id, true);
  };

  const toggleExpand = async (id: number, force = false) => {
    if (expanded === id && !force) { setExpanded(null); return; }
    setExpanded(id);
    const res = await apiFetch(`/loan-chit/loans/${id}/repayments`);
    setRepayments(res.ok ? await res.json() : []);
  };

  const totalOutstanding = loans.reduce((s, l) => s + Number(l.balance_due ?? l.approved_amount ?? l.loan_amount), 0);
  const activeCount = loans.filter((l) => l.status === "active" || l.status === "approved").length;

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">🏦 Loan Management</h1>
          <p className="neo-page-sub">Employee company loans — approvals, EMI repayments, and running balance.</p>
        </div>
        <div className="neo-page-actions">
          <button className="neo-btn-primary" onClick={openNew}>+ New Loan</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="neo-kpi-card"><div className="neo-kpi-label">Loans Shown</div><div className="neo-kpi-value">{loans.length}</div></div>
        <div className="neo-kpi-card"><div className="neo-kpi-label">Active / Approved</div><div className="neo-kpi-value" style={{ color: "#15803d" }}>{activeCount}</div></div>
        <div className="neo-kpi-card"><div className="neo-kpi-label">Total Outstanding</div><div className="neo-kpi-value" style={{ color: "#dc2626" }}>{fmt(totalOutstanding)}</div></div>
      </div>

      <div className="neo-tabs">
        {(["active", "pending", "closed", "all"] as const).map((t) => (
          <button key={t} className={`neo-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="neo-table-wrap">
        <div className="neo-table-scroll">
          <table className="neo-table">
            <thead>
              <tr>
                <th>Employee</th><th className="text-right">Requested</th><th className="text-right">Approved</th>
                <th className="text-right">EMI</th><th className="text-right">Repaid</th><th className="text-right">Balance</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--neu-text-muted)", padding: 32 }}>{loading ? "Loading…" : "No loans."}</td></tr>
              ) : loans.map((l) => {
                const badge = STATUS_STYLE[l.status] || STATUS_STYLE.pending;
                return (
                  <React.Fragment key={l.id}>
                    <tr>
                      <td>
                        <button onClick={() => toggleExpand(l.id)} style={{ background: "none", border: "none", padding: 0, color: "#5B4BFF", fontWeight: 700, cursor: "pointer" }}>
                          {l.employee_name}
                        </button>
                        <div style={{ fontSize: 10.5, color: "var(--neu-text-muted)" }}>{l.purpose} · {l.repayment_months} mo</div>
                      </td>
                      <td className="text-right">{fmt(l.loan_amount)}</td>
                      <td className="text-right">{l.approved_amount != null ? fmt(l.approved_amount) : "—"}</td>
                      <td className="text-right">{l.monthly_emi != null ? fmt(l.monthly_emi) : "—"}</td>
                      <td className="text-right">{fmt(l.total_repaid)}</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>{fmt(l.balance_due ?? l.approved_amount ?? l.loan_amount)}</td>
                      <td><span style={{ background: badge.bg, color: badge.color, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{l.status}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {l.status === "pending" && (
                            <>
                              <button className="neo-btn-success neo-btn-sm" onClick={() => { const a = prompt("Approved amount (₹):", String(l.loan_amount)); if (a) setStatus(l, "approved", Number(a)); }}>Approve</button>
                              <button className="neo-btn-danger neo-btn-sm" onClick={() => setStatus(l, "rejected")}>Reject</button>
                            </>
                          )}
                          {(l.status === "approved" || l.status === "active") && (
                            <button className="neo-btn-primary neo-btn-sm" onClick={() => openRepay(l)}>Record Repayment</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === l.id && (
                      <tr>
                        <td colSpan={8} style={{ background: "rgba(91,75,255,0.03)", padding: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--neu-text-muted)", marginBottom: 8 }}>REPAYMENT LEDGER — {l.employee_name}</div>
                          {repayments.length === 0 ? <div style={{ fontSize: 12, color: "var(--neu-text-muted)" }}>No repayments recorded.</div> : (
                            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                              <thead><tr style={{ textAlign: "left", color: "var(--neu-text-muted)" }}><th style={{ padding: "4px 8px" }}>Date</th><th style={{ padding: "4px 8px" }}>Amount</th><th style={{ padding: "4px 8px" }}>Mode</th><th style={{ padding: "4px 8px" }}>By</th></tr></thead>
                              <tbody>
                                {repayments.map((r) => (
                                  <tr key={r.id}><td style={{ padding: "4px 8px" }}>{new Date(r.repayment_date).toLocaleDateString("en-IN")}</td><td style={{ padding: "4px 8px", fontWeight: 700 }}>{fmt(r.amount)}</td><td style={{ padding: "4px 8px" }}>{r.repayment_mode.replace(/_/g, " ")}</td><td style={{ padding: "4px 8px" }}>{r.recorded_by_name || "—"}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && createPortal(
        <div className="neo-modal-overlay" onClick={() => setShowNew(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header"><h3 className="neo-modal-title">New Employee Loan</h3><button className="neo-modal-close" onClick={() => setShowNew(false)}>×</button></div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 12 }}>
              <select className="neu-select" value={nf.employee_id || ""} onChange={(e) => setNf({ ...nf, employee_id: Number(e.target.value) })}>
                <option value="">Select employee…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <input className="neu-input" type="number" placeholder="Loan amount ₹" value={nf.loan_amount || ""} onChange={(e) => setNf({ ...nf, loan_amount: Number(e.target.value) })} />
                <input className="neu-input" type="number" placeholder="Months" value={nf.repayment_months || ""} onChange={(e) => setNf({ ...nf, repayment_months: Number(e.target.value) })} />
                <input className="neu-input" type="number" placeholder="Monthly EMI ₹" value={nf.monthly_emi || ""} onChange={(e) => setNf({ ...nf, monthly_emi: Number(e.target.value) })} />
              </div>
              <input className="neu-input" placeholder="Purpose (Medical, House Repair…)" value={nf.purpose || ""} onChange={(e) => setNf({ ...nf, purpose: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="neu-input" placeholder="Guarantor name" value={nf.guarantor_name || ""} onChange={(e) => setNf({ ...nf, guarantor_name: e.target.value })} />
                <input className="neu-input" placeholder="Guarantor phone" value={nf.guarantor_phone || ""} onChange={(e) => setNf({ ...nf, guarantor_phone: e.target.value })} />
              </div>
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="neo-btn-primary" onClick={createLoan}>Create Loan</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {repayFor && createPortal(
        <div className="neo-modal-overlay" onClick={() => setRepayFor(null)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header"><h3 className="neo-modal-title">Record Repayment — {repayFor.employee_name}</h3><button className="neo-modal-close" onClick={() => setRepayFor(null)}>×</button></div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 12 }}>
              <input className="neu-input" type="number" placeholder="Amount ₹" value={rf.amount || ""} onChange={(e) => setRf({ ...rf, amount: Number(e.target.value) })} />
              <input className="neu-input" type="date" value={rf.repayment_date || ""} onChange={(e) => setRf({ ...rf, repayment_date: e.target.value })} />
              <select className="neu-select" value={rf.repayment_mode || "salary_deduction"} onChange={(e) => setRf({ ...rf, repayment_mode: e.target.value })}>
                <option value="salary_deduction">Salary Deduction</option><option value="cash">Cash</option><option value="bank">Bank</option>
              </select>
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setRepayFor(null)}>Cancel</button>
              <button className="neo-btn-primary" onClick={recordRepay}>Record</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LoanManagement;
