import React, { useState, useEffect } from "react";
import { 
  FaPlus, 
  FaSearch, 
  FaSync,
  FaFileDownload,
  FaEye,
  FaUniversity,
  FaWallet,
  FaCloudUploadAlt,
  FaCheck,
  FaHistory,
  FaMoneyBillWave
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./finance/Finance.css"; // Shared ERP system
import "./Transactions.css";

interface Transaction {
  id: number;
  date: string;
  type: string;
  amount: number;
  mode: string;
  description: string;
  expense_category?: string;
  proof_url?: string;
  status?: string;
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [search, setSearch] = useState("");
  
  const [formData, setFormData] = useState<any>({
    type: "CUSTOMER_PAYMENT",
    amount: "",
    mode: "CASH",
    date: new Date().toISOString().split('T')[0],
    description: "",
    reference_id: "",
    expense_category: "Rent"
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    loadReferences();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/transactions");
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const [custRes, empRes, supRes] = await Promise.all([
        apiFetch("/customers"),
        apiFetch("/employees"),
        apiFetch("/lenders")
      ]);
      setCustomers(await custRes.json());
      setEmployees(await empRes.json());
      setSuppliers(await supRes.json());
    } catch (err) {
      console.error("Error loading references", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setProofFile(e.target.files[0]);
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    
    let refType = "general";
    if (formData.type.includes("CUSTOMER")) refType = "customer";
    if (formData.type.includes("SUPPLIER")) refType = "supplier";
    if (formData.type.includes("SALARY") || formData.type.includes("ADVANCE")) refType = "employee";
    data.set("reference_type", refType);

    if (proofFile) data.append("proof", proofFile);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/transactions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: data
      });
      if (res.ok) {
        setShowNewTxModal(false);
        setProofFile(null);
        fetchData();
        alert("Transaction recorded.");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to record transaction.");
      }
    } catch (err) {
      alert("Network error occurred.");
    }
  };

  const downloadReceipt = (id: number) => {
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/transactions/${id}/pdf`, '_blank');
  };

  return (
    <div className="finance-container page-container">
      <header className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Transaction History</h1>
          <p className="text-body">Monitor and audit every financial movement across your organization.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewTxModal(true)}>
             <FaPlus size={12} /> Record Transaction
        </button>
      </header>

      <div className="stats-grid">
         <div className="stat-card card-emerald">
           <FaWallet className="stat-icon" />
           <span className="label">Total Inflow</span>
           <span className="value">₹ {transactions.filter(t => ['CUSTOMER_PAYMENT', 'RECEIPT'].includes(t.type)).reduce((a, c) => a + Number(c.amount), 0).toLocaleString()}</span>
           <span className="stat-sub">Account Credit</span>
         </div>
         <div className="stat-card card-rose">
           <FaMoneyBillWave className="stat-icon" />
           <span className="label">Total Outflow</span>
           <span className="value">₹ {transactions.filter(t => !['CUSTOMER_PAYMENT', 'RECEIPT'].includes(t.type)).reduce((a, c) => a + Number(c.amount), 0).toLocaleString()}</span>
           <span className="stat-sub">Account Debit</span>
         </div>
         <div className="stat-card card-indigo">
           <FaHistory className="stat-icon" />
           <span className="label">Net Balance</span>
           <span className="value">₹ {(transactions.filter(t => ['CUSTOMER_PAYMENT', 'RECEIPT'].includes(t.type)).reduce((a, c) => a + Number(c.amount), 0) - transactions.filter(t => !['CUSTOMER_PAYMENT', 'RECEIPT'].includes(t.type)).reduce((a, c) => a + Number(c.amount), 0)).toLocaleString()}</span>
           <span className="stat-sub">Current Liquidity</span>
         </div>
      </div>

      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--erp-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="card-icon"><FaHistory size={14} /></div>
            <span className="text-header" style={{ marginBottom: 0 }}>Financial Audit Trail</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ position: "relative", width: "280px" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", zIndex: 2 }} size={13} />
              <input 
                placeholder="Search remark or category..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 38px",
                  borderRadius: "10px",
                  border: "1.5px solid #e2e8f0",
                  background: "#fff",
                  fontSize: "0.82rem",
                  fontFamily: "inherit",
                  color: "#1e293b",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button className="btn btn-secondary" onClick={fetchData}><FaSync size={12} /></button>
          </div>
        </div>

        <div className="table-container" style={{ border: "none", borderRadius: "0", boxShadow: "none" }}>
          <table className="erp-table">
             <thead>
                <tr>
                   <th>Date & Reference</th>
                   <th>Category</th>
                   <th className="text-center">Mode</th>
                   <th>Description</th>
                   <th className="text-right">Amount (₹)</th>
                   <th className="text-center">Actions</th>
                </tr>
             </thead>
             <tbody>
                {transactions.filter(t => t.description?.toLowerCase().includes(search.toLowerCase()) || t.type?.toLowerCase().includes(search.toLowerCase())).map(tx => (
                   <tr key={tx.id}>
                      <td className="timestamp-cell">
                         <span className="primary">{new Date(tx.date).toLocaleDateString()}</span>
                         <span className="secondary">TXN-{tx.id}</span>
                      </td>
                      <td>
                        <span className={`status-badge status-${['CUSTOMER_PAYMENT', 'RECEIPT'].includes(tx.type) ? 'success' : 'error'}`}>
                          {tx.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-center">
                         <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--erp-text-secondary)" }}>
                            {tx.mode === 'BANK' ? <FaUniversity size={14} /> : <FaWallet size={14} />}
                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{tx.mode}</span>
                         </div>
                      </td>
                      <td className="text-body">{tx.description}</td>
                      <td className={`currency-cell ${['CUSTOMER_PAYMENT', 'RECEIPT'].includes(tx.type) ? 'positive' : 'negative'}`}>
                         {['CUSTOMER_PAYMENT', 'RECEIPT'].includes(tx.type) ? '+ ' : '- '} {Number(tx.amount).toLocaleString()}
                      </td>
                      <td className="text-center">
                         <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button className="btn btn-secondary" style={{ padding: "6px" }} title="Receipt" onClick={() => downloadReceipt(tx.id)}><FaFileDownload /></button>
                            {tx.proof_url && <button className="btn btn-secondary" style={{ padding: "6px" }} title="Evidence" onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${tx.proof_url}`, '_blank')}><FaEye /></button>}
                         </div>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>

      {showNewTxModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "650px" }}>
            <div className="modal-header">
              <span className="text-header">Record Financial Transaction</span>
              <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setShowNewTxModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateTx}>
              <div className="modal-body">
                <div className="tx-modal-scan-box" style={{ borderRadius: "16px" }}>
                  <div className="tx-modal-scan-info">
                    <h4>SYNC BANK RECORD</h4>
                    <p>Upload screenshot for automatic UTR extraction.</p>
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ borderRadius: "8px" }}><FaCloudUploadAlt /> Select File</button>
                </div>

                <div className="form-grid">
                  <div className="form-group form-item-full">
                    <label>Transaction Category</label>
                    <select className="form-input" style={{ borderRadius: "10px" }} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                      <option value="CUSTOMER_PAYMENT">Customer Payment (Credit)</option>
                      <option value="SUPPLIER_PAYMENT">Supplier Payment (Debit)</option>
                      <option value="RECEIPT">General Receipt (Credit)</option>
                      <option value="EXPENSE_PAYMENT">Expense Payment (Debit)</option>
                      <option value="SALARY_PAYMENT">Staff Salary (Debit)</option>
                      <option value="ADVANCE_PAYMENT">Employee Advance (Debit)</option>
                    </select>
                  </div>

                  {formData.type === 'SUPPLIER_PAYMENT' && (
                    <div className="form-group form-item-full">
                      <label>Select Supplier</label>
                      <select className="form-input" style={{ borderRadius: "10px" }} value={formData.reference_id} onChange={e => setFormData({...formData, reference_id: e.target.value})} required>
                        <option value="">-- Select --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.lender_name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Payment Channel</label>
                    <select className="form-input" style={{ borderRadius: "10px" }} value={formData.mode} onChange={e => setFormData({...formData, mode: e.target.value})}>
                      <option value="CASH">Liquid Cash</option>
                      <option value="BANK">Bank Digital Transfer</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Effective Date</label>
                    <input type="date" className="form-input" style={{ borderRadius: "10px" }} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                  </div>

                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" className="form-input" style={{ borderRadius: "10px" }} placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                  </div>

                  <div className="form-group">
                     <label>Verification Proof</label>
                     <input type="file" className="form-input" style={{ borderRadius: "10px" }} onChange={handleFileChange} />
                  </div>

                  <div className="form-group form-item-full">
                    <label>Transaction Remark / Memo</label>
                    <textarea className="form-input" style={{ borderRadius: "10px" }} rows={2} placeholder="Explain the purpose of this transaction..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewTxModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: "10px" }} disabled={loading}><FaCheck size={12} /> Post Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
