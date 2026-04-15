import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import "./Finance.css";
import CustomSelect from "../../components/CustomSelect";
import { FaUniversity, FaRegCheckCircle, FaSearch, FaHistory } from "react-icons/fa";

const BankReconciliation: React.FC = () => {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const companyId = 1;

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await financeApi.getBankAccounts(companyId);
        setBankAccounts(res.data);
        if (res.data && res.data.length > 0)
          setSelectedBank((res.data[0] as any).id);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBanks();
  }, [companyId]);

  const fetchTransactions = async () => {
    if (!selectedBank) return;
    setLoading(true);
    try {
      const res = await financeApi.getBankTransactions(companyId, selectedBank);
      setTransactions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedBank]);

  const handleAutoReconcile = async () => {
    if (!selectedBank) return;
    setLoading(true);
    try {
      const res = await financeApi.reconcileBank(companyId, selectedBank);
      alert(
        `Auto-reconciliation complete! Matched ${res.data.matched_count} records.`,
      );
      fetchTransactions();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-container page-container">
      <header className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Bank Reconciliation</h1>
          <p className="text-body">Sync bank statement entries with internal ledger totals.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
           <button className="btn btn-secondary" disabled={loading}>Import Statement (CSV)</button>
           <button className="btn btn-primary" onClick={handleAutoReconcile} disabled={loading}>
             {loading ? "Matching..." : "Run Auto-Matching"}
           </button>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ marginBottom: "16px" }}>
          <div className="card-icon"><FaUniversity size={14} /></div>
          Account Selection
        </div>
        <div className="form-group" style={{ maxWidth: "400px" }}>
          <label>Select Financial Institution Account</label>
          <CustomSelect
            value={selectedBank || ""}
            onChange={(e) => setSelectedBank(Number(e.target.value))}
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bank_name} - {b.account_number} (₹ {b.balance.toLocaleString()})
              </option>
            ))}
          </CustomSelect>
        </div>
      </div>

      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div className="card-header" style={{ padding: "24px 32px", marginBottom: "0" }}>
           <div className="card-icon"><FaRegCheckCircle size={14} /></div>
           Statement Comparison Ledger
        </div>
        <div className="table-container" style={{ border: "none", borderRadius: "0", boxShadow: "none" }}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Entry Date</th>
                <th>Transaction Details</th>
                <th className="text-right">Value (₹)</th>
                <th className="text-center">Flow</th>
                <th className="text-center">Verification</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-body">{tx.date}</td>
                  <td className="text-body">{tx.description}</td>
                  <td className="currency-cell">₹ {tx.amount.toLocaleString()}</td>
                  <td className="text-center">
                    <span className={`status-badge status-${tx.type === 'CR' ? 'success' : 'error'}`}>
                      {tx.type === 'CR' ? 'CREDIT' : 'DEBIT'}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`status-badge ${tx.reconciled ? 'status-success' : 'status-warning'}`}>
                      {tx.reconciled ? 'MATCHED' : 'UNMATCHED'}
                    </span>
                  </td>
                  <td className="text-right">
                    {!tx.reconciled && (
                      <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.75rem" }}>
                        Manual Match
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px" }} className="text-muted">
                    No records found for this account period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BankReconciliation;
