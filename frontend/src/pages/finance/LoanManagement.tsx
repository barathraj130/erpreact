
import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import { apiFetch } from "../../utils/api";
import { FaPlus, FaHandHoldingUsd, FaPercentage, FaExclamationCircle, FaFileInvoice, FaSearch, FaSync, FaChartLine, FaHistory } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import "../PageShared.css";

const LoanManagement: React.FC = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
    notes: "",
  });

  const [repayData, setRepayData] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    total_amount: 0,
    interest_component: 0,
    principal_component: 0,
    payment_mode: "BANK",
    notes: "",
  });

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
        notes: "",
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
            {filteredLoans.map((loan, idx) => (
              <tr key={loan.id}>
                <td><div className="font-bold">{loan.lender_name}</div></td>
                <td className="text-right font-mono">₹{loan.principal_amount?.toLocaleString()}</td>
                <td className="text-right">{loan.interest_rate}%</td>
                <td>{loan.start_date}</td>
                <td>{loan.repayment_cycle}</td>
                <td className="text-center">
                  <span className={`type-badge ${loan.status === 'ACTIVE' ? 'type-badge-green' : 'type-badge-blue'}`}>
                    {loan.status}
                  </span>
                </td>
                <td className="text-center">
                  <button 
                    className="page-btn-round-sm" 
                    onClick={() => { setSelectedLoan(loan); setShowRepayModal(true); }}
                    title="Record Repayment"
                  >
                    <FaHistory size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Loan Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>Record New Loan</h2>
              <form onSubmit={handleSubmit}>
                <label>Lender</label>
                <select 
                  required 
                  value={formData.lender_id} 
                  onChange={e => setFormData({...formData, lender_id: e.target.value})}
                >
                  <option value="">Select Lender</option>
                  {lenders.map(l => <option key={l.id} value={l.id}>{l.lender_name}</option>)}
                </select>

                <div className="form-grid-2">
                  <div>
                    <label>Principal Amount (₹)</label>
                    <input type="number" required value={formData.principal_amount} onChange={e => setFormData({...formData, principal_amount: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label>Interest Rate (% p.a.)</label>
                    <input type="number" step="0.1" required value={formData.interest_rate} onChange={e => setFormData({...formData, interest_rate: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Start Date</label>
                    <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div>
                    <label>Repayment Cycle</label>
                    <select value={formData.repayment_cycle} onChange={e => setFormData({...formData, repayment_cycle: e.target.value})}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                </div>

                <label>Notes</label>
                <input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />

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
              <form onSubmit={handleRepaySubmit}>
                <div className="form-grid-2">
                  <div>
                    <label>Payment Date</label>
                    <input type="date" required value={repayData.payment_date} onChange={e => setRepayData({...repayData, payment_date: e.target.value})} />
                  </div>
                  <div>
                    <label>Total Amount Paid (₹)</label>
                    <input type="number" required value={repayData.total_amount} onChange={e => setRepayData({...repayData, total_amount: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label>Principal Component (₹)</label>
                    <input type="number" value={repayData.principal_component} onChange={e => setRepayData({...repayData, principal_component: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label>Interest Component (₹)</label>
                    <input type="number" value={repayData.interest_component} onChange={e => setRepayData({...repayData, interest_component: Number(e.target.value)})} />
                  </div>
                </div>

                <label>Payment Mode</label>
                <select value={repayData.payment_mode} onChange={e => setRepayData({...repayData, payment_mode: e.target.value})}>
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
