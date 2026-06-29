
import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import { apiFetch } from "../../utils/api";
import { FaPlus, FaHandHoldingUsd, FaPercentage, FaExclamationCircle, FaSearch, FaSync, FaHistory, FaTimes, FaListAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import "../PageShared.css";
import LoanRepaymentIdeas from "./LoanRepaymentIdeas";

const LoanManagement: React.FC = () => {
  const [pageTab, setPageTab] = useState<"loans" | "ai-ideas">("loans");
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
  const [paymentType, setPaymentType] = useState<'emi' | 'interest' | 'principal'>('emi');

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getLoans();
      // handleResponse wraps as { data: [...] }
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      console.log('Loans API →', list.length, 'records', list[0] ?? '(empty)');
      setLoans(list);
    } catch (err: any) {
      console.error("Failed to fetch loans:", err?.message || err);
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
    is_existing_loan: false,
    notes: "",
    duration_months: 12,
    loan_type: "BANK",
    // Existing loan extras
    down_payment: 0,
    outstanding_interest: 0,
  });
  const [receiptRows, setReceiptRows] = useState<{ mode: string; amount: number }[]>([
    { mode: "CASH", amount: 0 },
  ]);

  const [repayData, setRepayData] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    total_amount: 0,
    interest_component: 0,
    principal_component: 0,
    payment_mode: "CASH",
    notes: "",
    cash_amount: 0,
    bank_amount: 0,
  });
  const [splitPayment, setSplitPayment] = useState(false);

  const calcMonthlyInterest = (loan: any): number => {
    if (!loan) return 0;
    const remaining = Number(loan.remaining_principal ?? loan.principal_amount ?? 0);
    const annualRate = Number(loan.interest_rate || 0);
    return Math.round(remaining * annualRate / 12 / 100 * 100) / 100;
  };

  const calcEMIDisplay = () => {
    if (formData.loan_type !== 'BANK' || !formData.principal_amount || !formData.duration_months) return null;
    return calcEMI(formData.principal_amount, formData.interest_rate, formData.duration_months);
  };

  const monthlyInterestDisplay = () => {
    if (!formData.principal_amount || !formData.interest_rate) return 0;
    return Math.round(formData.principal_amount * formData.interest_rate / 12 / 100 * 100) / 100;
  };

  const totalAllocated = receiptRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const allocationMatched = Math.round(totalAllocated) === Math.round(formData.principal_amount) && formData.principal_amount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lender_id && !(formData as any).lender_name) {
      alert("Please select a lender or type a lender name.");
      return;
    }
    if (!formData.is_existing_loan && !allocationMatched) {
      alert(`Total allocated ₹${totalAllocated.toLocaleString('en-IN')} must equal Principal ₹${formData.principal_amount.toLocaleString('en-IN')}`);
      return;
    }
    setLoading(true);
    try {
      await financeApi.createLoan({
        ...formData,
        payments: receiptRows.filter(r => Number(r.amount) > 0).map(r => ({ method: r.mode, amount: r.amount })),
      });
      setShowModal(false);
      fetchLoans();
      setFormData({
        lender_id: "",
        principal_amount: 0,
        interest_rate: 12,
        start_date: new Date().toISOString().split("T")[0],
        repayment_cycle: "MONTHLY",
        is_existing_loan: false,
        notes: "",
        duration_months: 12,
        loan_type: "BANK",
        down_payment: 0,
        outstanding_interest: 0,
      });
      setReceiptRows([{ mode: "CASH", amount: 0 }]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      alert("Failed to create loan record.\n\n" + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setLoading(true);
    try {
      const payload: any = {
        ...repayData,
        loan_id: selectedLoan.id,
        payment_type: paymentType,
      };
      if (splitPayment) {
        payload.cash_amount = repayData.cash_amount;
        payload.bank_amount = repayData.bank_amount;
        payload.total_amount = (repayData.cash_amount || 0) + (repayData.bank_amount || 0);
      }
      await financeApi.recordLoanRepayment(payload);
      setShowRepayModal(false);
      setSplitPayment(false);
      fetchLoans();
      setRepayData({
        payment_date: new Date().toISOString().split("T")[0],
        total_amount: 0,
        interest_component: 0,
        principal_component: 0,
        payment_mode: "CASH",
        notes: "",
        cash_amount: 0,
        bank_amount: 0,
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

  // FIX 3: Stats use only ACTIVE loans (not filtered by search)
  const activeLoans = loans.filter(l => l.status === 'ACTIVE');
  const stats = {
    totalLiability: activeLoans
      .reduce((acc, curr) => acc + (Number(curr.remaining_principal ?? curr.principal_amount) || 0), 0),
    avgRate: activeLoans.length > 0
      ? activeLoans.reduce((acc, curr) => acc + (Number(curr.interest_rate) || 0), 0) / activeLoans.length
      : 0,
    activeCount: activeLoans.length,
  };

  // Calculate EMI for bank loans (reducing balance)
  const calcEMI = (P: number, annualRate: number, n: number) => {
    const r = annualRate / 12 / 100;
    if (r === 0 || n === 0) return P / (n || 1);
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  // Generate amortization schedule starting from actual remaining principal
  const generateSchedule = (loan: any, paidCount: number = 0) => {
    const totalN = Number(loan.duration_months || 12);
    const origP = Number(loan.principal_amount || 0);
    // Use remaining_principal so schedule reflects actual state after payments
    const startingP = Number(loan.remaining_principal ?? origP);
    const annualRate = Number(loan.interest_rate || 0);
    const r = annualRate / 12 / 100;
    const start = new Date(loan.start_date || new Date());
    const loanType = (loan.loan_type || loan.party_type || 'BANK').toUpperCase();
    const isBank = loanType === 'BANK';
    const schedule = [];
    const today = new Date();
    // Remaining installments = total - already paid
    const remainingN = Math.max(1, totalN - paidCount);

    if (isBank) {
      // Recalculate EMI on remaining balance and remaining months (reducing balance)
      const emi = calcEMI(startingP, annualRate, remainingN);
      let balance = startingP;
      for (let i = 1; i <= remainingN; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + paidCount + i);
        const interest = Math.round(balance * r * 100) / 100;
        const principal = Math.min(Math.round((emi - interest) * 100) / 100, balance);
        balance = Math.max(0, Math.round((balance - principal) * 100) / 100);
        const isPast = due < today;
        const isCurrent = due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
        schedule.push({ month: paidCount + i, due, emi: principal + interest, principal, interest, balance, isPast, isCurrent });
      }
    } else {
      // PRIVATE: interest-only on remaining principal, lump sum at end
      const monthlyInterest = Math.round(startingP * r * 100) / 100;
      for (let i = 1; i <= remainingN; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + paidCount + i);
        const isLast = i === remainingN;
        const interest = monthlyInterest;
        const principal = isLast ? startingP : 0;
        const emi = interest + principal;
        const rowBalance = isLast ? 0 : startingP;
        const isPast = due < today;
        const isCurrent = due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
        schedule.push({ month: paidCount + i, due, emi, principal, interest, balance: rowBalance, isPast, isCurrent });
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
          <button className="page-btn-round-sm" onClick={fetchLoans} title="Refresh">
            <FaSync className={loading ? "fa-spin" : ""} size={12} />
          </button>
          <button
            className="page-btn-round-sm"
            title="Sync lender opening balances → create loan records"
            style={{ fontSize: '11px', padding: '6px 12px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
            onClick={async () => {
              try {
                const res = await apiFetch('/loans/sync-from-lenders', { method: 'POST' });
                const data = await res.json();
                if (data.synced > 0) {
                  alert(`✅ Synced ${data.synced} lender(s) → loan records created:\n${data.loans.map((l: any) => `• ${l.lender} ₹${Number(l.amount).toLocaleString('en-IN')}`).join('\n')}`);
                } else {
                  alert('All lenders already have loan records.');
                }
                fetchLoans();
              } catch (e) {
                alert('Sync failed');
              }
            }}
          >
            ⚡ Sync Lenders
          </button>
          {pageTab === "loans" && (
            <button className="page-btn-round page-btn-round-primary" onClick={() => setShowModal(true)}>
              <FaPlus size={11} /> New Loan
            </button>
          )}
        </div>
      </div>

      {/* Page-level tab toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "#f1f5f9", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {([
          { key: "loans",    label: "📋 Loans" },
          { key: "ai-ideas", label: "✨ AI Repayment Ideas" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setPageTab(t.key)} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            background: pageTab === t.key ? "#4f46e5" : "transparent",
            color:      pageTab === t.key ? "#fff"    : "#64748b",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* AI Ideas tab */}
      {pageTab === "ai-ideas" && <LoanRepaymentIdeas />}

      {/* Loans tab — existing content */}
      {pageTab === "loans" && <>

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
              <th>Type</th>
              <th className="text-right">Principal</th>
              <th className="text-right">Outstanding</th>
              <th className="text-right">Rate</th>
              <th>Start Date</th>
              <th>Cycle</th>
              <th className="text-center">Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLoans.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                No loans found. Click <strong>+ New Loan</strong> to add one.
              </td></tr>
            )}
            {filteredLoans.map((loan) => {
              const loanType = (loan.loan_type || loan.party_type || 'BANK').toUpperCase();
              const isPrivate = loanType === 'PRIVATE';
              const outstanding = Number(loan.remaining_principal ?? loan.principal_amount);
              const cycleLabel = isPrivate ? 'No Fixed Cycle' : (loan.repayment_cycle || 'Monthly');
              return (
              <tr key={loan.id}>
                <td>
                  <div className="font-bold">{loan.lender_name}</div>
                  {loan.lender_phone && <div style={{ fontSize: '11px', color: '#6b7280' }}>📞 {loan.lender_phone}</div>}
                </td>
                <td>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                    background: isPrivate ? '#f5f3ff' : '#eff6ff',
                    color: isPrivate ? '#7c3aed' : '#1d4ed8',
                    border: `1px solid ${isPrivate ? '#ddd6fe' : '#bfdbfe'}`
                  }}>
                    {isPrivate ? '👤 Private' : '🏛️ Bank'}
                  </span>
                </td>
                <td className="text-right font-mono">₹{Number(loan.principal_amount).toLocaleString('en-IN')}</td>
                <td className="text-right font-mono">
                  <div style={{ fontWeight: 700, color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                    ₹{outstanding.toLocaleString('en-IN')}
                  </div>
                  {isPrivate && Number(loan.total_interest_paid || 0) > 0 && (
                    <div style={{ fontSize: '11px', color: '#f59e0b' }}>
                      ₹{Number(loan.total_interest_paid).toLocaleString('en-IN')} int. paid
                    </div>
                  )}
                  {!isPrivate && Number(loan.paid_principal || 0) > 0 && (
                    <div style={{ fontSize: '11px', color: '#16a34a' }}>
                      ₹{Number(loan.paid_principal).toLocaleString('en-IN')} repaid
                    </div>
                  )}
                </td>
                <td className="text-right">{loan.interest_rate}%</td>
                <td>{loan.start_date ? new Date(loan.start_date).toLocaleDateString('en-IN') : '-'}</td>
                <td style={{ fontSize: '12px', color: isPrivate ? '#7c3aed' : '#374151' }}>{cycleLabel}</td>
                <td className="text-center">
                  <span className={`type-badge ${loan.status === 'ACTIVE' ? 'type-badge-green' : 'type-badge-blue'}`}>
                    {loan.status}
                  </span>
                </td>
                <td className="text-center">
                  {(() => {
                    const isPrivate = (loan.loan_type || loan.party_type || 'BANK').toUpperCase() === 'PRIVATE';
                    const interest = calcMonthlyInterest(loan);
                    const outstanding = Number(loan.remaining_principal ?? loan.principal_amount);
                    return (
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        {isPrivate ? (
                          <>
                            <button
                              className="page-btn-round-sm"
                              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", fontSize: "10px", padding: "4px 8px" }}
                              title="Pay Interest"
                              onClick={() => {
                                setPaymentType('interest');
                                setSelectedLoan(loan);
                                setRepayData({ payment_date: new Date().toISOString().split("T")[0], total_amount: interest, interest_component: interest, principal_component: 0, payment_mode: "CASH", notes: "", cash_amount: 0, bank_amount: 0 });
                                setShowRepayModal(true);
                              }}
                            >
                              Interest
                            </button>
                            <button
                              className="page-btn-round-sm"
                              style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", fontSize: "10px", padding: "4px 8px" }}
                              title="Repay Principal"
                              onClick={() => {
                                setPaymentType('principal');
                                setSelectedLoan(loan);
                                setRepayData({ payment_date: new Date().toISOString().split("T")[0], total_amount: outstanding, interest_component: 0, principal_component: outstanding, payment_mode: "CASH", notes: "", cash_amount: 0, bank_amount: 0 });
                                setShowRepayModal(true);
                              }}
                            >
                              Principal
                            </button>
                          </>
                        ) : (
                          <button
                            className="page-btn-round-sm"
                            onClick={() => {
                              setPaymentType('emi');
                              setSelectedLoan(loan);
                              setRepayData({ payment_date: new Date().toISOString().split("T")[0], total_amount: interest, interest_component: interest, principal_component: 0, payment_mode: "BANK", notes: "", cash_amount: 0, bank_amount: 0 });
                              setShowRepayModal(true);
                            }}
                            title="Record Repayment"
                          >
                            <FaPlus size={10} />
                          </button>
                        )}
                        <button
                          className="page-btn-round-sm"
                          onClick={async () => {
                            const tab = isPrivate ? 'history' : 'history';
                            setLedgerLoan(loan);
                            setScheduleTab(tab);
                            await loadRepaymentHistory(loan.id);
                          }}
                          title="View History"
                          style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}
                        >
                          <FaListAlt size={10} />
                        </button>
                      </div>
                    );
                  })()}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Repayment History / Schedule Panel */}
      <AnimatePresence>
        {ledgerLoan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ margin: "24px 0", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>

            {/* FIX 5 — Loan Detail Header */}
            {(() => {
              const lt = (ledgerLoan.loan_type || ledgerLoan.party_type || 'BANK').toUpperCase();
              const isP = lt === 'PRIVATE';
              const outstanding = Number(ledgerLoan.remaining_principal ?? ledgerLoan.principal_amount);
              const monthlyInterest = Math.round(outstanding * Number(ledgerLoan.interest_rate || 0) / 12 / 100 * 100) / 100;
              const since = ledgerLoan.start_date ? new Date(ledgerLoan.start_date).toLocaleDateString('en-IN') : '-';
              return (
                <div style={{ padding: '20px 24px', background: isP ? '#faf5ff' : '#eff6ff', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>{ledgerLoan.lender_name}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                        {isP ? '👤 Private Person' : '🏛️ Bank / Institution'}
                        {ledgerLoan.lender_phone && <> &nbsp;·&nbsp; 📞 {ledgerLoan.lender_phone}</>}
                      </div>
                    </div>
                    <button onClick={() => setLedgerLoan(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><FaTimes size={16} /></button>
                  </div>
                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                    {[
                      { label: 'Principal Borrowed', value: `₹${Number(ledgerLoan.principal_amount).toLocaleString('en-IN')}` },
                      { label: 'Outstanding', value: `₹${outstanding.toLocaleString('en-IN')}`, highlight: outstanding > 0 },
                      { label: 'Interest Paid', value: `₹${Number(ledgerLoan.total_interest_paid || 0).toLocaleString('en-IN')}` },
                      { label: 'Interest Rate', value: `${ledgerLoan.interest_rate}% p.a.` },
                      { label: isP ? 'Monthly Interest' : 'EMI', value: `₹${isP ? monthlyInterest.toLocaleString('en-IN') : Number(ledgerLoan.emi_amount || monthlyInterest).toLocaleString('en-IN')}` },
                      { label: 'Running Since', value: since },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} style={{ background: '#fff', borderRadius: '8px', padding: '10px 14px', border: `1px solid ${isP ? '#ddd6fe' : '#bfdbfe'}` }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: highlight ? '#dc2626' : '#0f172a' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Quick pay buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    {isP ? (
                      <>
                        <button style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                          onClick={() => { setPaymentType('interest'); setSelectedLoan(ledgerLoan); setRepayData({ payment_date: new Date().toISOString().split("T")[0], total_amount: monthlyInterest, interest_component: monthlyInterest, principal_component: 0, payment_mode: 'CASH', notes: '', cash_amount: 0, bank_amount: 0 }); setShowRepayModal(true); }}>
                          💰 Pay Interest ₹{monthlyInterest.toLocaleString('en-IN')}
                        </button>
                        <button style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                          onClick={() => { setPaymentType('principal'); setSelectedLoan(ledgerLoan); setRepayData({ payment_date: new Date().toISOString().split("T")[0], total_amount: outstanding, interest_component: 0, principal_component: outstanding, payment_mode: 'CASH', notes: '', cash_amount: 0, bank_amount: 0 }); setShowRepayModal(true); }}>
                          🏦 Repay Principal
                        </button>
                      </>
                    ) : (
                      <button style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                        onClick={() => { setPaymentType('emi'); setSelectedLoan(ledgerLoan); setRepayData({ payment_date: new Date().toISOString().split("T")[0], total_amount: Number(ledgerLoan.emi_amount || 0), interest_component: 0, principal_component: 0, payment_mode: 'BANK', notes: '', cash_amount: 0, bank_amount: 0 }); setShowRepayModal(true); }}>
                        + Record Repayment
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                    Status: <span style={{ fontWeight: 700, color: ledgerLoan.status === 'ACTIVE' ? '#16a34a' : '#6b7280' }}>{ledgerLoan.status}</span>
                    {isP && <> &nbsp;·&nbsp; No Fixed Cycle — runs indefinitely</>}
                  </div>
                </div>
              );
            })()}
            {/* Tab Toggle — hide Schedule for PRIVATE loans */}
            {(() => {
              const isPrivateLoan = (ledgerLoan.loan_type || ledgerLoan.party_type || 'BANK').toUpperCase() === 'PRIVATE';
              const tabs = isPrivateLoan ? (['history'] as const) : (['history', 'schedule'] as const);
              return (
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {tabs.map(tab => (
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
                      {tab === 'history' ? '📋 Payment History' : '📅 Schedule'}
                    </button>
                  ))}
                </div>
              );
            })()}

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
              const schedule = generateSchedule(ledgerLoan, repaymentHistory.length);
              const isPrivate = (ledgerLoan.loan_type || ledgerLoan.party_type || 'BANK').toUpperCase() !== 'BANK';
              return (
                <div style={{ overflowX: 'auto' }}>
                  {isPrivate && (
                    <div style={{ padding: '10px 16px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', margin: '0 0 12px', fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>
                      💡 Private Loan — Pay interest only every month (₹{Math.round(Number(ledgerLoan.remaining_principal ?? (ledgerLoan.principal_amount || 0)) * Number(ledgerLoan.interest_rate || 0) / 12 / 100).toLocaleString()}/mo). Remaining principal ₹{Number(ledgerLoan.remaining_principal ?? (ledgerLoan.principal_amount || 0)).toLocaleString()} is returned in the last month.
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

      {/* New Loan Modal — redesigned */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '32px', overflowY: 'auto' }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff', borderRadius: '20px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
                width: '100%', maxWidth: '560px',
                padding: '32px', margin: '0 auto 40px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>🏦 Record New Loan</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Track borrowed capital and liability</div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#64748b', fontSize: '16px', lineHeight: 1 }}>✕</button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* New / Existing toggle */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                  {[
                    { val: false, label: '✅ New Loan', sub: 'Cash Received' },
                    { val: true,  label: '📋 Existing Loan', sub: 'No Cash Entry' },
                  ].map(opt => (
                    <button key={String(opt.val)} type="button"
                      onClick={() => setFormData({ ...formData, is_existing_loan: opt.val })}
                      style={{
                        flex: 1, padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                        border: `2px solid ${formData.is_existing_loan === opt.val ? '#6366f1' : '#e5e7eb'}`,
                        background: formData.is_existing_loan === opt.val ? '#eef2ff' : '#fff',
                        textAlign: 'left', transition: 'all .15s',
                      }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: formData.is_existing_loan === opt.val ? '#4338ca' : '#374151' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Loan Type */}
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Loan Type</div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
                  {[
                    { val: 'BANK',    icon: '🏛️', label: 'BANK',    sub: 'Reducing Balance EMI', activeColor: '#3b82f6', activeBg: '#eff6ff' },
                    { val: 'PRIVATE', icon: '👤', label: 'PRIVATE', sub: 'Flat Interest / Month', activeColor: '#8b5cf6', activeBg: '#f5f3ff' },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setFormData({ ...formData, loan_type: opt.val })}
                      style={{
                        flex: 1, padding: '16px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${formData.loan_type === opt.val ? opt.activeColor : '#e5e7eb'}`,
                        background: formData.loan_type === opt.val ? opt.activeBg : '#fff',
                        textAlign: 'left', transition: 'all .15s',
                      }}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{opt.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: formData.loan_type === opt.val ? opt.activeColor : '#374151' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Lender */}
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>👤 Lender</div>
                {lenders.length > 0 ? (
                  <select value={formData.lender_id} onChange={e => setFormData({ ...formData, lender_id: e.target.value, lender_name: '' } as any)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: `1.5px solid ${!formData.lender_id ? '#f59e0b' : '#e5e7eb'}`, fontSize: '14px', marginBottom: '6px', background: '#fff' }}>
                    <option value="">— Select Lender —</option>
                    {lenders.map(l => <option key={l.id} value={l.id}>{l.lender_name}</option>)}
                  </select>
                ) : null}
                {(!formData.lender_id) && (
                  <input
                    type="text"
                    placeholder={lenders.length > 0 ? "Or type new lender name..." : "Type lender name (e.g. Ravi Kumar)"}
                    value={(formData as any).lender_name || ''}
                    onChange={e => setFormData({ ...formData, lender_id: '', lender_name: e.target.value } as any)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1.5px solid #6366f1', fontSize: '14px', marginBottom: '6px', boxSizing: 'border-box' }}
                  />
                )}
                <div style={{ marginBottom: '12px' }} />

                {/* Principal + Interest */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>💰 Principal Amount</div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontWeight: 700 }}>₹</span>
                      <input type="number" required min={1} value={formData.principal_amount || ''}
                        onChange={e => setFormData({ ...formData, principal_amount: Number(e.target.value) })}
                        style={{ width: '100%', padding: '12px 12px 12px 28px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box' }}
                        placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>📊 Interest Rate</div>
                    <div style={{ position: 'relative' }}>
                      <input type="number" step="0.1" required min={0} value={formData.interest_rate}
                        onChange={e => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                        style={{ width: '100%', padding: '12px 32px 12px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box' }} />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>% p.a.</span>
                    </div>
                    {formData.principal_amount > 0 && (
                      <div style={{ fontSize: '11px', color: '#6366f1', marginTop: '4px', fontWeight: 600 }}>
                        → ₹{monthlyInterestDisplay().toLocaleString('en-IN')}/month flat
                      </div>
                    )}
                  </div>
                </div>

                {/* Start Date + Duration */}
                <div style={{ display: 'grid', gridTemplateColumns: formData.loan_type === 'PRIVATE' ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>📅 Start Date</div>
                    <input type="date" required value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  {formData.loan_type !== 'PRIVATE' && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>⏱️ Duration</div>
                      <div style={{ position: 'relative' }}>
                        <input type="number" required min={1} value={formData.duration_months}
                          onChange={e => setFormData({ ...formData, duration_months: Number(e.target.value) })}
                          style={{ width: '100%', padding: '12px 56px 12px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box' }} />
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>months</span>
                      </div>
                      {calcEMIDisplay() !== null && (
                        <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px', fontWeight: 600 }}>
                          EMI: ₹{Math.round(calcEMIDisplay()!).toLocaleString('en-IN')}/month
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bank: Repayment Cycle */}
                {formData.loan_type !== 'PRIVATE' && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>🔄 Repayment Cycle</div>
                    <select value={formData.repayment_cycle} onChange={e => setFormData({ ...formData, repayment_cycle: e.target.value })}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', background: '#fff' }}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                )}

                {/* Private: info box */}
                {formData.loan_type === 'PRIVATE' && (
                  <div style={{ padding: '12px 16px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', fontSize: '13px', color: '#6d28d9', marginBottom: '18px', lineHeight: 1.5 }}>
                    ℹ️ <strong>Runs indefinitely</strong> — no fixed duration or EMI schedule.<br />
                    Pay interest monthly, repay principal whenever.
                  </div>
                )}

                {/* Received Via — split rows */}
                {!formData.is_existing_loan && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>💳 Received Via</div>
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {receiptRows.map((row, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <select value={row.mode}
                            onChange={e => { const r = [...receiptRows]; r[i].mode = e.target.value; setReceiptRows(r); }}
                            style={{ padding: '9px 12px', borderRadius: '7px', border: '1.5px solid #e5e7eb', fontSize: '13px', background: '#fff', flex: '0 0 110px' }}>
                            <option value="CASH">💵 Cash</option>
                            <option value="BANK">🏦 Bank</option>
                            <option value="UPI">📱 UPI</option>
                          </select>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '13px' }}>₹</span>
                            <input type="number" min={0} value={row.amount || ''}
                              placeholder="0"
                              onChange={e => { const r = [...receiptRows]; r[i].amount = Number(e.target.value); setReceiptRows(r); }}
                              style={{ width: '100%', padding: '9px 12px 9px 26px', borderRadius: '7px', border: '1.5px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box' }} />
                          </div>
                          {receiptRows.length > 1 && (
                            <button type="button" onClick={() => setReceiptRows(receiptRows.filter((_, j) => j !== i))}
                              style={{ background: '#fee2e2', border: 'none', borderRadius: '7px', padding: '9px 11px', cursor: 'pointer', color: '#dc2626', fontSize: '13px' }}>🗑</button>
                          )}
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => setReceiptRows([...receiptRows, { mode: 'CASH', amount: 0 }])}
                        style={{ padding: '8px', borderRadius: '7px', border: '1.5px dashed #d1d5db', background: 'transparent', color: '#6b7280', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        + Add Payment Mode
                      </button>
                      {/* Allocation status */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderRadius: '7px',
                        background: allocationMatched ? '#f0fdf4' : totalAllocated > 0 ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${allocationMatched ? '#86efac' : totalAllocated > 0 ? '#fca5a5' : '#e5e7eb'}`,
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                          Total Allocated: <strong>₹{totalAllocated.toLocaleString('en-IN')}</strong>
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: allocationMatched ? '#16a34a' : totalAllocated > formData.principal_amount ? '#dc2626' : '#6b7280' }}>
                          {allocationMatched ? '✅ Matched' : formData.principal_amount > 0 ? `${totalAllocated > formData.principal_amount ? '⚠️ Over by' : '⚠️ Short by'} ₹${Math.abs(formData.principal_amount - totalAllocated).toLocaleString('en-IN')}` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Existing Loan Details (shown only when is_existing_loan) ── */}
                {formData.is_existing_loan && (
                  <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📋 Existing Loan Details
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#b45309' }}>— fill in what you know</span>
                    </div>

                    {/* Down Payment */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>
                        💵 Amount Already Paid (Down Payment / Part Repayment)
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 700, fontSize: '13px' }}>₹</span>
                        <input
                          type="number" min={0} value={formData.down_payment || ''}
                          placeholder="0"
                          onChange={e => setFormData({ ...formData, down_payment: Number(e.target.value) })}
                          style={{ width: '100%', padding: '10px 12px 10px 26px', borderRadius: '8px', border: '1.5px solid #fcd34d', fontSize: '14px', boxSizing: 'border-box', background: '#fff' }}
                        />
                      </div>
                      {formData.down_payment > 0 && formData.principal_amount > 0 && (
                        <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px', fontWeight: 600, background: '#d1fae5', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                          Remaining Principal: ₹{Math.max(0, formData.principal_amount - formData.down_payment).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>

                    {/* Outstanding Interest */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>
                        📈 Outstanding / Unpaid Interest (Accumulated)
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 700, fontSize: '13px' }}>₹</span>
                        <input
                          type="number" min={0} value={formData.outstanding_interest || ''}
                          placeholder="0 — if interest is fully paid"
                          onChange={e => setFormData({ ...formData, outstanding_interest: Number(e.target.value) })}
                          style={{ width: '100%', padding: '10px 12px 10px 26px', borderRadius: '8px', border: '1.5px solid #fcd34d', fontSize: '14px', boxSizing: 'border-box', background: '#fff' }}
                        />
                      </div>
                      <div style={{ fontSize: '11px', color: '#b45309', marginTop: '3px' }}>
                        Total interest that has accrued but not yet been paid to the lender
                      </div>
                    </div>

                  </div>
                )}

                {/* Notes */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>📝 Notes (Optional)</div>
                  <input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. for business expansion"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#374151' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    style={{
                      flex: 2, padding: '14px 32px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer',
                      opacity: loading ? 0.7 : 1, transition: 'all .15s',
                    }}>
                    {loading ? 'Creating…' : '🏦 Create Loan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Repayment Modal */}
      <AnimatePresence>
        {showRepayModal && selectedLoan && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>
                {paymentType === 'interest' ? 'Pay Interest' : paymentType === 'principal' ? 'Repay Principal' : 'Record Repayment'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '12px' }}>
                {selectedLoan.lender_name} — Outstanding: ₹{Number(selectedLoan.remaining_principal ?? selectedLoan.principal_amount).toLocaleString('en-IN')}
              </p>

              {paymentType === 'interest' && (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                  <strong>Interest payment — principal will NOT be reduced.</strong><br />
                  Monthly interest at {selectedLoan.interest_rate}% p.a.: ₹{calcMonthlyInterest(selectedLoan).toLocaleString('en-IN')}
                </div>
              )}

              {paymentType === 'principal' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#1e40af' }}>
                  <strong>Principal repayment — reduces outstanding balance.</strong><br />
                  {repayData.total_amount >= Number(selectedLoan.remaining_principal ?? selectedLoan.principal_amount)
                    ? '⚠️ This will CLOSE the loan.' : ''}
                </div>
              )}

              {paymentType === 'emi' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
                  Monthly interest: ₹{calcMonthlyInterest(selectedLoan).toLocaleString('en-IN')}&nbsp;
                  ({selectedLoan.interest_rate}% p.a.)
                </div>
              )}

              <form onSubmit={handleRepaySubmit}>
                <div className="form-grid-2">
                  <div>
                    <label>Payment Date</label>
                    <input type="date" required value={repayData.payment_date} onChange={e => setRepayData({ ...repayData, payment_date: e.target.value })} />
                  </div>
                  <div>
                    <label>Amount (₹)</label>
                    <input
                      type="number" required value={repayData.total_amount}
                      onChange={e => {
                        const total = Number(e.target.value);
                        if (paymentType === 'interest') {
                          setRepayData({ ...repayData, total_amount: total, interest_component: total, principal_component: 0 });
                        } else if (paymentType === 'principal') {
                          setRepayData({ ...repayData, total_amount: total, principal_component: total, interest_component: 0 });
                        } else {
                          const interest = repayData.interest_component;
                          setRepayData({ ...repayData, total_amount: total, principal_component: Math.max(0, total - interest) });
                        }
                      }}
                    />
                  </div>
                </div>

                {paymentType === 'emi' && (
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
                        setRepayData({ ...repayData, interest_component: i, total_amount: repayData.principal_component + i });
                      }} />
                    </div>
                  </div>
                )}

                {/* Split Payment Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0 8px' }}>
                  <button
                    type="button"
                    onClick={() => setSplitPayment(!splitPayment)}
                    style={{
                      padding: '5px 14px', borderRadius: '20px', border: '1px solid #e2e8f0',
                      background: splitPayment ? '#0f172a' : '#f8fafc',
                      color: splitPayment ? '#fff' : '#64748b',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    {splitPayment ? '✓ Split: Cash + Bank' : 'Split Payment (Cash + Bank)?'}
                  </button>
                </div>

                {splitPayment ? (
                  <div className="form-grid-2">
                    <div>
                      <label>Cash Amount (₹)</label>
                      <input
                        type="number"
                        value={repayData.cash_amount}
                        min={0}
                        onChange={e => {
                          const c = Number(e.target.value);
                          setRepayData({ ...repayData, cash_amount: c, total_amount: c + (repayData.bank_amount || 0) });
                        }}
                      />
                    </div>
                    <div>
                      <label>Bank / UPI Amount (₹)</label>
                      <input
                        type="number"
                        value={repayData.bank_amount}
                        min={0}
                        onChange={e => {
                          const b = Number(e.target.value);
                          setRepayData({ ...repayData, bank_amount: b, total_amount: (repayData.cash_amount || 0) + b });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <label>Payment Mode</label>
                    <select value={repayData.payment_mode} onChange={e => setRepayData({ ...repayData, payment_mode: e.target.value })}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </>
                )}

                {splitPayment && (
                  <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                    Total: ₹{((repayData.cash_amount || 0) + (repayData.bank_amount || 0)).toLocaleString('en-IN')}
                    &nbsp;(Cash ₹{(repayData.cash_amount || 0).toLocaleString('en-IN')} + Bank ₹{(repayData.bank_amount || 0).toLocaleString('en-IN')})
                  </div>
                )}

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => { setShowRepayModal(false); setSplitPayment(false); }}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={loading}>
                    {paymentType === 'interest' ? 'Confirm Interest Payment' : paymentType === 'principal' ? 'Confirm Principal Repayment' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </> /* end pageTab === "loans" */}
    </div>
  );
};

export default LoanManagement;
