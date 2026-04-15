import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import { FaPlus, FaHandHoldingUsd, FaPercentage, FaExclamationCircle, FaFileInvoice, FaSearch, FaSync, FaChartLine } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "../../components/CustomSelect";
import "../PageShared.css";

const LoanManagement: React.FC = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const companyId = 1; // Assuming static for now or linked to context

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getLoans(companyId);
      setLoans(res.data || []);
    } catch (err) {
      console.error("Failed to fetch loans", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [companyId]);

  const [formData, setFormData] = useState({
    party_name: "",
    party_type: "EMPLOYEE",
    loan_direction: "GIVEN",
    principal_amount: 0,
    interest_rate: 12,
    interest_type: "EMI",
    start_date: new Date().toISOString().split("T")[0],
    duration_months: 12,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await financeApi.createLoan({ ...formData, company_id: companyId });
      setShowModal(false);
      fetchLoans();
      // Reset form
      setFormData({
        party_name: "",
        party_type: "EMPLOYEE",
        loan_direction: "GIVEN",
        principal_amount: 0,
        interest_rate: 12,
        interest_type: "EMI",
        start_date: new Date().toISOString().split("T")[0],
        duration_months: 12,
      });
    } catch (err) {
      alert("Failed to create loan record.");
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = loans.filter(l => 
    l.party_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalGiven: filteredLoans
      .filter((l) => l.loan_direction === "GIVEN")
      .reduce((acc, curr) => acc + (Number(curr.principal_amount) || 0), 0),
    interestAccrued:
      filteredLoans.reduce(
        (acc, curr) => acc + ((Number(curr.principal_amount) || 0) * (Number(curr.interest_rate) || 0)) / 100,
        0,
      ) / 12,
    overdue: filteredLoans
      .filter((l) => l.status === "OVERDUE")
      .reduce((acc, curr) => acc + (Number(curr.outstanding_amount) || 0), 0),
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Loan Management</h1>
          <p>Track business loans and employee advances effectively.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={fetchLoans} aria-label="Refresh loans">
            <FaSync className={loading ? "fa-spin" : ""} size={12} />
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={() => setShowModal(true)}>
            <FaPlus size={11} /> New Loan
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="premium-stats-grid">
        <div className="stat-card card-indigo">
          <FaHandHoldingUsd className="stat-icon" />
          <div className="label">Distributed</div>
          <div className="value">₹{stats.totalGiven.toLocaleString()}</div>
          <div className="stat-sub">Active disbursements</div>
        </div>

        <div className="stat-card card-amber">
          <FaChartLine className="stat-icon" />
          <div className="label">Est. Interest/mo</div>
          <div className="value">₹{stats.interestAccrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="stat-sub">Projected yield</div>
        </div>

        <div className="stat-card card-rose">
          <FaExclamationCircle className="stat-icon" />
          <div className="label">Total Overdue</div>
          <div className="value">₹{stats.overdue.toLocaleString()}</div>
          <div className="stat-sub">Pending collection</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="page-search-bar" style={{ width: isMobile ? "100%" : "360px", marginBottom: "12px" }}>
        <FaSearch className="page-search-icon" size={13} />
        <input 
          placeholder="Search Active Portfolio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table / Cards */}
      {loading && loans.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : filteredLoans.length > 0 ? (
        isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredLoans.map((loan, idx) => (
              <motion.div
                key={loan.id}
                className="tx-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "14.5px" }}>{loan.party_name}</div>
                  <span className={`type-badge ${loan.status.toLowerCase() === 'active' ? 'type-badge-green' : 'type-badge-red'}`}>
                    {loan.status}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>
                  {loan.party_type} · {loan.interest_rate}% Interest
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-soft)" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase" }}>Principal</div>
                    <div style={{ fontWeight: 600 }}>₹{loan.principal_amount?.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase" }}>Outstanding</div>
                    <div style={{ fontWeight: 700, color: "var(--accent)" }}>₹{loan.outstanding_amount?.toLocaleString()}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead>
                <tr>
                  <th>Entity / Party</th>
                  <th>Classification</th>
                  <th className="text-right">Principal</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan, idx) => (
                  <motion.tr key={loan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}>
                    <td><div className="font-bold">{loan.party_name}</div></td>
                    <td>
                      <span className={`type-badge ${loan.party_type === 'BANK' ? 'type-badge-blue' : 'type-badge-amber'}`}>
                        {loan.party_type}
                      </span>
                    </td>
                    <td className="text-right font-mono">₹{loan.principal_amount?.toLocaleString()}</td>
                    <td className="text-right">{loan.interest_rate}%</td>
                    <td className="text-right font-bold" style={{ color: "var(--accent)" }}>₹{loan.outstanding_amount?.toLocaleString()}</td>
                    <td className="text-center">
                      <span className={`type-badge ${loan.status.toLowerCase() === 'active' ? 'type-badge-green' : 'type-badge-red'}`}>
                        {loan.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="page-empty">
          <FaHandHoldingUsd size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div>No active loans found in portfolio</div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div 
              className="page-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h2>Register New Loan</h2>
              <form onSubmit={handleSubmit}>
                <label>Entity Name</label>
                <input 
                  placeholder="Enter employee or bank name"
                  required
                  value={formData.party_name}
                  onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                />
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label>Amount (₹)</label>
                    <input 
                      type="number"
                      required
                      value={formData.principal_amount}
                      onChange={(e) => setFormData({ ...formData, principal_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label>Interest (%)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={formData.interest_rate}
                      onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label>Type</label>
                    <select value={formData.party_type} onChange={e => setFormData({...formData, party_type: e.target.value})}>
                      <option value="EMPLOYEE">Employee</option>
                      <option value="BANK">Bank</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label>Months</label>
                    <input 
                      type="number"
                      value={formData.duration_months}
                      onChange={(e) => setFormData({ ...formData, duration_months: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <label>Start Date</label>
                <input 
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={loading} style={{ flex: 1 }}>
                    {loading ? "Processing..." : "Create Record"}
                  </button>
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
