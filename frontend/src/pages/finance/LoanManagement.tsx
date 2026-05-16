
import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import { apiFetch } from "../../utils/api";
import { FaPlus, FaHandHoldingUsd, FaPercentage, FaExclamationCircle, FaSearch, FaSync, FaHistory, FaTimes, FaListAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import "../PageShared.css";

const LoanManagement: React.FC = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [ledgerLoan, setLedgerLoan] = useState<any>(null);
  const [repaymentHistory, setRepaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scheduleTab, setScheduleTab] = useState<'history' | 'schedule'>('history');

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getLoans();
      setLoans(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to fetch loans", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLenders = async () => {
    try {
      const res = await apiFetch("/lenders");
      const data = await res.json();
      setLenders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch lenders", err);
    }
  };

  useEffect(() => {
    fetchLoans();
    fetchLenders();
  }, []);

  const [formData, setFormData] = useState({
    lender_id: "",
    principal_amount: 0,
    interest_rate: 12,
    start_date: new Date().toISOString().split("T")[0],
    repayment_cycle: "MONTHLY",
    payment_mode: "BANK",
    is_existing_loan: false,
    notes: "",
    duration_months: 12,
    loan_type: "BANK",
  });

  const [repayData, setRepayData] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    total_amount: 0,
    interest_component: 0,
    principal_component: 0,
    payment_mode: "BANK",
    notes: "",
  });

  const calcMonthlyInterest = (loan: any): number => {
    if (!loan) return 0;
    const principal = Number(loan.principal_amount || 0);
    const annualRate = Number(loan.interest_rate || 0);
    return Math.round(principal * annualRate / 12 / 100 * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await financeApi.createLoan(formData);
      setShowModal(false);
      fetchLoans();
      setFormData({
        lender_id: "",
        principal_amount: 0,
        interest_rate: 12,
        start_date: new Date().toISOString().split("T")[0],
        repayment_cycle: "MONTHLY",
        payment_mode: "BANK",
        is_existing_loan: false,
        notes: "",
        duration_months: 12,
        loan_type: "BANK",
      });
    } catch (err) {
      alert("Failed to create loan record.");
    } finally {
      setLoading(false);
    }
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setLoading(true);
    try {
      await financeApi.recordLoanRepayment({
        ...repayData,
        loan_id: selectedLoan.id,
      });
      setShowRepayModal(false);
      fetchLoans();
      setRepayData({
        payment_date: new Date().toISOString().split("T")[0],
        total_amount: 0,
        interest_component: 0,
        principal_component: 0,
        payment_mode: "BANK",
        notes: "",
      });
    } catch (err) {
      alert("Failed to record repayment.");
    } finally {
      setLoading(false);
    }
  };

  const loadRepaymentHistory = async (loanId: number) => {
    try {
      const res = await apiFetch(`/loans/${loanId}/repayments`);
      const data = await res.json();
      setRepaymentHistory(Array.isArray(data) ? data : []);
    } catch { setRepaymentHistory([]); }
  };

  const filteredLoans = loans.filter(l =>
    l.lender_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalLiability: filteredLoans
      .reduce((acc, curr) => acc + (Number(curr.principal_amount) || 0), 0),
    avgRate: filteredLoans.length > 0
      ? filteredLoans.reduce((acc, curr) => acc + (Number(curr.interest_rate) || 0), 0) / filteredLoans.length
      : 0,
    activeCount: filteredLoans.filter(l => l.status === 'ACTIVE').length
  };

  // Calculate EMI for bank loans (reducing balance)
  const calcEMI = (P: number, annualRate: number, n: number) => {
    const r = annualRate / 12 / 100;
    if (r === 0 || n === 0) return P / (n || 1);
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  // Generate amortization schedule
  const generateSchedule = (loan: any) => {
    const n = Number(loan.duration_months || 12);
    const P = Number(loan.principal_amount || 0);
    const annualRate = Number(loan.interest_rate || 0);
    const r = annualRate / 12 / 100;
    const start = new Date(loan.start_date || new Date());
    const loanType = (loan.loan_type || loan.party_type || 'BANK').toUpperCase();
    const isBank = loanType === 'BANK';
    const schedule = [];
    let balance = P;
    const today = new Date();

    if (isBank) {
      // ── BANK: Reducing balance EMI ──
      // Fixed EMI every month. Interest = remaining balance × monthly rate.
      // Principal portion = EMI − interest. Balance reduces each month.
      const emi = calcEMI(P, annualRate, n);
      for (let i = 1; i <= n; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + i);
        const interest = Math.round(balance * r * 100) / 100;
        const principal = Math.min(Math.round((emi - interest) * 100) / 100, balance);
        balance = Math.max(0, Math.round((balance - principal) * 100) / 100);
        const isPast = due < today;
        const isCurrent = due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
        schedule.push({ month: i, due, emi: principal + interest, principal, interest, balance, isPast, isCurrent });
      }
    } else {
      // ── PRIVATE LENDER: Interest-only every month ──
      // Pay ONLY interest each month — principal never reduces.
      // Monthly interest = Principal × monthly rate (fixed every month).
      // Last month: pay interest + full principal lump sum.
      const monthlyInterest = Math.round(P * r * 100) / 100;
      for (let i = 1; i <= n; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + i);
        const isLast = i === n;
        const interest = monthlyInterest;
        const principal = isLast ? P : 0;        // Principal returned only at end
        const emi = interest + principal;
        const rowBalance = isLast ? 0 : P;       // Balance stays P until final month
        const isPast = due < today;
        const isCurrent = due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
        schedule.push({ month: i, due, emi, principal, interest, balance: rowBalance, isPast, isCurrent });
      }
    }
    return schedule;
  };

  const getScheduleStatus = (row: any) => {
    const paid = repaymentHistory.some(r => {
      const d = new Date(r.payment_date);
      return d.getMonth() === row.due.getMonth() && d.getFullYear() === row.due.getFullYear();
    });
    if (paid) return { label: 'PAID', color: '#16a34a', bg: '#dcfce7' };
    if (row.isCurrent) return { label: 'DUE', color: '#d97706', bg: '#fef3c7' };
    if (row.isPast) return { label: 'OVERDUE', color: '#dc2626', bg: '#fee2e2' };
    return { label: 'UPCOMING', color: '#64748b', bg: '#f1f5f9' };
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Loans & Liability</h1>
          <p>Manage borrowed capital and repayment schedules.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={fetchLoans}>
            <FaSync className={loading ? "fa-spin" : ""} size={12} />
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={() => setShowModal(true)}>
            <FaPlus size={11} /> New Loan
          </button>
        </div>
      </div>

      <div className="premium-stats-grid">
        <div className="stat-card card-rose">
          <FaHandHoldingUsd className="stat-icon" />
          <div className="label">Total Liability</div>
          <div className="value">₹{stats.totalLiability.toLocaleString()}</div>
          <div className="stat-sub">Outstanding Principal</div>
        </div>
        <div className="stat-card card-amber">
          <FaPercentage className="stat-icon" />
          <div className="label">Avg. Interest Rate</div>
          <div className="value">{stats.avgRate.toFixed(1)}%</div>
          <div className="stat-sub">Per Annum</div>
        </div>
        <div className="stat-card card-indigo">
          <FaExclamationCircle className="stat-icon" />
          <div className="label">Active Loans</div>
          <div className="value">{stats.activeCount}</div>
          <div className="stat-sub">Ongoing commitments</div>
        </div>
      </div>

      <div className="page-search-bar" style={{ width: "360px", marginBottom: "12px" }}>
        <FaSearch className="page-search-icon" size={13} />
        <input
          placeholder="Search by lender name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Lender</th>
              <th className="text-right">Principal</th>
              <th className="text-right">Rate</th>
              <th>Start Date</th>
              <th>Cycle</th>
              <th className="text-center">Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLoans.map((loan) => (
              <tr key={loan.id}>
                <td><div className="font-bold">{loan.lender_name}</div></td>
                <td className="text-right font-mono">₹{loan.principal_amount?.toLocaleString()}</td>
                <td className="text-right">{loan.interest_rate}%</td>
                <td>{loan.start_date ? new Date(loan.start_date).toLocaleDateString('en-IN') : '-'}</td>
                <td>{loan.repayment_cycle}</td>
                <td className="text-center">
                  <span className={`type-badge ${loan.status === 'ACTIVE' ? 'type-badge-green' : 'type-badge-blue'}`}>
                    {loan.status}
                  </span>
                </td>
                <td className="text-center" style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                  <button
                    className="page-btn-round-sm"
                    onClick={() => {
                      const interest = calcMonthlyInterest(loan);
                      setSelectedLoan(loan);
                      setRepayData({
                        payment_date: new Date().toISOString().split("T")[0],
                        total_amount: interest,
                        interest_component: interest,
                        principal_component: 0,
                        payment_mode: "BANK",
                        notes: "",
                      });
                      setShowRepayModal(true);
                    }}
                    title="Record Repayment"
                  >
                    <FaPlus size={10} />
                  </button>
                  <button
                    className="page-btn-round-sm"
                    onClick={() => { setLedgerLoan(loan); setScheduleTab('history'); loadRepaymentHistory(loan.id); }}
                    title="View Repayment History"
                    style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}
                  >
                    <FaListAlt size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Repayment History / Schedule Panel */}
      <AnimatePresence>
        {ledgerLoan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ margin: "24px 0", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "16px", color: "#0f172a" }}>Repayment History</div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{ledgerLoan.lender_name} · Principal ₹{Number(ledgerLoan.principal_amount).toLocaleString()}</div>
              </div>
              <button onClick={() => setLedgerLoan(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes size={16} /></button>
            </div>

            {/* Tab Toggle */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {(['history', 'schedule'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setScheduleTab(tab)}
                  style={{
                    padding: '10px 24px',
                    border: 'none',
                    borderBottom: scheduleTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'none',
                    fontWeight: scheduleTab === tab ? 700 : 500,
                    color: scheduleTab === tab ? '#2563eb' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'history' ? 'History' : 'Schedule'}
                </button>
              ))}
            </div>

            {scheduleTab === 'history' && (
              repaymentHistory.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>No repayments recorded yet.</div>
              ) : (
                <table className="page-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-right">Principal</th>
                      <th className="text-right">Interest</th>
                      <th>Mode</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repaymentHistory.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.payment_date}</td>
                        <td className="text-right font-mono">₹{Number(r.total_amount).toLocaleString()}</td>
                        <td className="text-right font-mono" style={{ color: "#2563eb" }}>₹{Number(r.principal_component).toLocaleString()}</td>
                        <td className="text-right font-mono" style={{ color: "#f59e0b" }}>₹{Number(r.interest_component).toLocaleString()}</td>
                        <td><span className="type-badge type-badge-blue">{r.payment_mode}</span></td>
                        <td style={{ color: "#64748b", fontSize: "13px" }}>{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {scheduleTab === 'schedule' && (() => {
              const schedule = generateSchedule(ledgerLoan);
              const isPrivate = (ledgerLoan.loan_type || ledgerLoan.party_type || 'BANK').toUpperCase() !== 'BANK';
              return (
                <div style={{ overflowX: 'auto' }}>
                  {isPrivate && (
                    <div style={{ padding: '10px 16px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', margin: '0 0 12px', fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>
                      💡 Private Loan — Pay interest only every month (₹{Math.round(Number(ledgerLoan.principal_amount || 0) * Number(ledgerLoan.interest_rate || 0) / 12 / 100).toLocaleString()}/mo). Full principal of ₹{Number(ledgerLoan.principal_amount || 0).toLocaleString()} is returned in the last month.
                    </div>
                  )}
                  <table className="page-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Due Date</th>
                        <th className="text-right">{isPrivate ? 'Payment' : 'EMI'}</th>
                        <th className="text-right">Principal</th>
                        <th className="text-right">Interest</th>
                        <th className="text-right">Balance</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map(row => {
                        const status = getScheduleStatus(row);
                        const isLastPrivate = isPrivate && row.month === schedule.length;
                        return (
                          <tr key={row.month} style={isLastPrivate ? { background: '#faf5ff' } : {}}>
                            <td style={{ color: '#94a3b8', fontSize: '12px' }}>{row.month}</td>
                            <td>{new Date(row.due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="text-right font-mono">
                              ₹{Math.round(row.emi).toLocaleString()}
                              {isLastPrivate && <span style={{ fontSize: '10px', color: '#7c3aed', marginLeft: 4 }}>(+Principal)</span>}
                            </td>
                            <td className="text-right font-mono" style={{ color: row.principal > 0 ? '#7c3aed' : '#cbd5e1' }}>
                              {row.principal > 0 ? `₹${Math.round(row.principal).toLocaleString()}` : '—'}
                            </td>
                            <td className="text-right font-mono" style={{ color: '#f59e0b' }}>₹{Math.round(row.interest).toLocaleString()}</td>
                            <td className="text-right font-mono" style={{ color: '#64748b' }}>₹{Math.round(row.balance).toLocaleString()}</td>
                            <td className="text-center">
                              <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: status.bg, color: status.color }}>
                                {status.label}
                              </span>
                            </td>
                            <td className="text-center">
                              {status.label !== 'PAID' && (
                                <button
                                  className="page-btn-round-sm"
                                  style={{ fontSize: '11px', padding: '3px 10px' }}
                                  onClick={() => {
                                    setSelectedLoan(ledgerLoan);
                                    setRepayData(prev => ({
                                      ...prev,
                                      principal_component: Math.round(row.principal),
                                      interest_component: Math.round(row.interest),
                                      total_amount: Math.round(row.emi),
                                      payment_date: row.due.toISOString().split('T')[0],
                                    }));
                                    setShowRepayModal(true);
                                  }}
                                >
                                  Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Loan Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>Record New Loan</h2>
              <form onSubmit={handleSubmit}>
                {/* Existing vs New toggle */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                  <button type="button"
                    onClick={() => setFormData({ ...formData, is_existing_loan: false })}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      background: !formData.is_existing_loan ? '#2563eb' : 'transparent',
                      color: !formData.is_existing_loan ? '#fff' : '#64748b'
                    }}>
                    New Loan (Cash Received)
                  </button>
                  <button type="button"
                    onClick={() => setFormData({ ...formData, is_existing_loan: true })}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      background: formData.is_existing_loan ? '#64748b' : 'transparent',
                      color: formData.is_existing_loan ? '#fff' : '#64748b'
                    }}>
                    Existing Loan (No Cash Entry)
                  </button>
                </div>

                {/* Loan Type toggle */}
                <label>Loan Type</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                  <button type="button"
                    onClick={() => setFormData({ ...formData, loan_type: 'BANK' })}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      background: formData.loan_type === 'BANK' ? '#2563eb' : 'transparent',
                      color: formData.loan_type === 'BANK' ? '#fff' : '#64748b'
                    }}>
                    BANK (Reducing Balance EMI)
                  </button>
                  <button type="button"
                    onClick={() => setFormData({ ...formData, loan_type: 'PRIVATE' })}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      background: formData.loan_type === 'PRIVATE' ? '#7c3aed' : 'transparent',
                      color: formData.loan_type === 'PRIVATE' ? '#fff' : '#64748b'
                    }}>
                    PRIVATE (Flat Interest/Month)
                  </button>
                </div>

                <label>Lender</label>
                <select
                  required
                  value={formData.lender_id}
                  onChange={e => setFormData({ ...formData, lender_id: e.target.value })}
                >
                  <option value="">Select Lender</option>
                  {lenders.map(l => <option key={l.id} value={l.id}>{l.lender_name}</option>)}
                </select>

                <div className="form-grid-2">
                  <div>
                    <label>Principal Amount (₹)</label>
                    <input type="number" required value={formData.principal_amount} onChange={e => setFormData({ ...formData, principal_amount: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Interest Rate (% p.a.)</label>
                    <input type="number" step="0.1" required value={formData.interest_rate} onChange={e => setFormData({ ...formData, interest_rate: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Start Date</label>
                    <input type="date" required value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label>Duration (Months)</label>
                    <input type="number" required min={1} value={formData.duration_months} onChange={e => setFormData({ ...formData, duration_months: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Repayment Cycle</label>
                    <select value={formData.repayment_cycle} onChange={e => setFormData({ ...formData, repayment_cycle: e.target.value })}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                  {!formData.is_existing_loan && (
                    <div>
                      <label>Received Via</label>
                      <select value={formData.payment_mode} onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}>
                        <option value="BANK">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </div>
                  )}
                </div>

                <label>Notes</label>
                <input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={loading}>Create Loan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Repayment Modal */}
      <AnimatePresence>
        {showRepayModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>Record Repayment</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loan: {selectedLoan?.lender_name} (₹{selectedLoan?.principal_amount})</p>
              {selectedLoan && (() => {
                const monthlyInterest = calcMonthlyInterest(selectedLoan);
                return (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
                    Expected monthly interest: <strong>₹{monthlyInterest.toLocaleString('en-IN')}</strong>
                    &nbsp;({selectedLoan.interest_rate}% p.a. on ₹{Number(selectedLoan.principal_amount).toLocaleString('en-IN')})
                  </div>
                );
              })()}
              <form onSubmit={handleRepaySubmit}>
                <div className="form-grid-2">
                  <div>
                    <label>Payment Date</label>
                    <input type="date" required value={repayData.payment_date} onChange={e => setRepayData({ ...repayData, payment_date: e.target.value })} />
                  </div>
                  <div>
                    <label>Total Amount Paid (₹)</label>
                    <input
                      type="number" required value={repayData.total_amount}
                      onChange={e => {
                        const total = Number(e.target.value);
                        const interest = repayData.interest_component;
                        setRepayData({ ...repayData, total_amount: total, principal_component: Math.max(0, total - interest) });
                      }}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Principal Component (₹)</label>
                    <input type="number" value={repayData.principal_component} onChange={e => {
                      const p = Number(e.target.value);
                      setRepayData({ ...repayData, principal_component: p, total_amount: p + repayData.interest_component });
                    }} />
                  </div>
                  <div>
                    <label>Interest Component (₹)</label>
                    <input type="number" value={repayData.interest_component} onChange={e => {
                      const i = Number(e.target.value);
                      setRepayData({ ...repayData, interest_component: i, principal_component: Math.max(0, repayData.total_amount - i), total_amount: repayData.principal_component + i });
                    }} />
                  </div>
                </div>

                <label>Payment Mode</label>
                <select value={repayData.payment_mode} onChange={e => setRepayData({ ...repayData, payment_mode: e.target.value })}>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                </select>

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowRepayModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={loading}>Record Payment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoanManagement;
