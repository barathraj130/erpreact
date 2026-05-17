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
import jsPDF from "jspdf";
import { apiFetch } from "../utils/api";
import "./finance/Finance.css"; // Shared ERP system
import "./Transactions.css";

interface Transaction {
  id: number;
  date: string;
  type: string;
  reference_type?: string;
  amount: number;
  mode: string;
  description: string;
  expense_category?: string;
  proof_url?: string;
  status?: string;
  created_at?: string;
  display_party?: string;
  lender_name?: string;
  supplier_name?: string;
  user_name?: string;
  party_name?: string;
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
        apiFetch("/users"),
        apiFetch("/employees"),
        apiFetch("/suppliers")
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
    Object.keys(formData).forEach(key => {
      // skip empty reference_id — DB column is integer, can't accept ""
      if (key === "reference_id" && !formData[key]) return;
      data.append(key, formData[key]);
    });

    let refType = "general";
    if (formData.type.includes("CUSTOMER")) refType = "customer";
    if (formData.type.includes("SUPPLIER")) refType = "supplier";
    if (formData.type.includes("SALARY") || formData.type.includes("ADVANCE")) refType = "employee";
    data.set("reference_type", refType);

    if (proofFile) data.append("proof", proofFile);

    try {
      const res = await apiFetch("/transactions", {
        method: "POST",
        body: data
      }, false); // false = not JSON, it's FormData
      if (res.ok) {
        setShowNewTxModal(false);
        setProofFile(null);
        fetchData();
        alert("Transaction recorded.");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to record transaction.");
      }
    } catch (err: any) {
      alert("Failed to record transaction: " + (err?.message || "Unknown error"));
    }
  };

  const downloadTransactionPDF = (tx: Transaction) => {
    const INFLOW_TYPES = ['CUSTOMER_PAYMENT', 'RECEIPT', 'INVOICE', 'GIFT_CONTRIBUTION', 'LOAN_DISBURSEMENT', 'LOAN_RECEIVED'];
    const isInflow = INFLOW_TYPES.includes(tx.type) || INFLOW_TYPES.includes(tx.reference_type || '');

    // ASCII-only strings -- jsPDF built-in fonts do not support Unicode arrows/dashes
    const flowLabel  = isInflow ? 'Inflow (Credit)' : 'Outflow (Debit)';
    const modeLabel  = tx.mode === 'BANK' ? 'Bank Transfer'
                     : tx.mode === 'UPI'  ? 'UPI'
                     : tx.mode === 'CASH' ? 'Cash'
                     : (tx.mode || 'N/A');
    const partyLabel = tx.display_party || tx.party_name || tx.lender_name || tx.user_name || '-';
    const category   = (tx.type || tx.reference_type || 'GENERAL').replace(/_/g, ' ');
    const txnId      = 'TXN-' + tx.id;
    const dateStr    = new Date(tx.date || tx.created_at || '').toLocaleDateString('en-IN');
    const amountStr  = 'Rs.' + Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('JBS KNIT WEAR', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('3/2B Nesavalar Colony, TNK Puram, Tiruppur 641602', 105, 27, { align: 'center' });
    doc.text('Ph: 8148232205', 105, 33, { align: 'center' });

    doc.line(15, 37, 195, 37);

    // Title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSACTION VOUCHER', 105, 45, { align: 'center' });
    doc.line(15, 48, 195, 48);

    // Detail rows
    doc.setFontSize(10);
    const details: [string, string][] = [
      ['Transaction ID', txnId],
      ['Date',           dateStr],
      ['Category',       category],
      ['Party',          partyLabel],
      ['Description',    tx.description || '-'],
      ['Mode',           modeLabel],
      ['Type',           flowLabel],
      ['Amount',         amountStr],
    ];

    let y = 58;
    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value ?? '-').substring(0, 60), 80, y);
      y += 10;
    });

    doc.line(15, y + 5, 195, y + 5);
    doc.setFontSize(9);
    doc.text('System generated voucher - Fluxora ERP', 105, y + 12, { align: 'center' });
    doc.text('Generated: ' + new Date().toLocaleString('en-IN'), 105, y + 18, { align: 'center' });

    doc.save('TXN_' + tx.id + '.pdf');
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

      {/* Inflow = credit types (customer receipts, loans received) */}
      {/* Outflow = debit types (payments out, repayments) */}
      {(() => {
        const INFLOW_TYPES = ['CUSTOMER_PAYMENT', 'RECEIPT', 'INVOICE', 'GIFT_CONTRIBUTION', 'LOAN_DISBURSEMENT', 'LOAN_RECEIVED'];
        const OUTFLOW_TYPES = ['SUPPLIER_PAYMENT', 'EXPENSE_PAYMENT', 'SALARY_PAYMENT', 'ADVANCE_PAYMENT', 'LOAN_REPAYMENT', 'EB_UTILITY_BILL', 'FESTIVAL_EXPENSE', 'DONATION', 'CHIT_INVESTMENT', 'MISC_EXPENSE', 'CHIT_INSTALLMENT'];
        const inflow = transactions.filter(t => INFLOW_TYPES.includes(t.type) || INFLOW_TYPES.includes(t.reference_type || '')).reduce((a, c) => a + Number(c.amount), 0);
        const outflow = transactions.filter(t => OUTFLOW_TYPES.includes(t.type) || OUTFLOW_TYPES.includes(t.reference_type || '')).reduce((a, c) => a + Number(c.amount), 0);
        return (
          <div className="stats-grid">
            <div className="stat-card card-emerald">
              <FaWallet className="stat-icon" />
              <span className="label">Total Inflow</span>
              <span className="value">₹ {inflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className="stat-sub">Account Credit</span>
            </div>
            <div className="stat-card card-rose">
              <FaMoneyBillWave className="stat-icon" />
              <span className="label">Total Outflow</span>
              <span className="value">₹ {outflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className="stat-sub">Account Debit</span>
            </div>
            <div className="stat-card card-indigo">
              <FaHistory className="stat-icon" />
              <span className="label">Net Balance</span>
              <span className="value">₹ {(inflow - outflow).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className="stat-sub">Current Liquidity</span>
            </div>
          </div>
        );
      })()}

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
                   <th>Date</th>
                   <th>Category</th>
                   <th>Party / Description</th>
                   <th className="text-center">Mode</th>
                   <th className="text-right">Amount (₹)</th>
                   <th className="text-center">Actions</th>
                </tr>
             </thead>
             <tbody>
                {(() => {
                  const INFLOW_TYPES = ['CUSTOMER_PAYMENT', 'RECEIPT', 'INVOICE', 'GIFT_CONTRIBUTION', 'LOAN_DISBURSEMENT', 'LOAN_RECEIVED'];
                  return transactions
                    .filter(t =>
                      t.description?.toLowerCase().includes(search.toLowerCase()) ||
                      t.type?.toLowerCase().includes(search.toLowerCase()) ||
                      (t.display_party || t.party_name || t.lender_name || t.user_name || '').toLowerCase().includes(search.toLowerCase())
                    )
                    .map(tx => {
                      const isInflow = INFLOW_TYPES.includes(tx.type) || INFLOW_TYPES.includes(tx.reference_type || '');
                      const partyLabel = tx.display_party || tx.party_name || tx.lender_name || tx.user_name || null;
                      const typeLabel = (tx.type || tx.reference_type || 'GENERAL').replace(/_/g, ' ');
                      return (
                        <tr key={tx.id}>
                          <td className="timestamp-cell">
                            <span className="primary">{new Date(tx.date).toLocaleDateString('en-IN')}</span>
                            <span className="secondary">TXN-{tx.id}</span>
                          </td>
                          <td>
                            <span className={`status-badge status-${isInflow ? 'success' : 'error'}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="text-body">
                            {partyLabel && <div style={{ fontWeight: 500 }}>{partyLabel}</div>}
                            <div style={{ fontSize: partyLabel ? '0.78rem' : '0.9rem', color: partyLabel ? 'var(--erp-text-secondary)' : 'inherit', fontWeight: partyLabel ? 400 : 500 }}>{tx.description}</div>
                          </td>
                          <td className="text-center">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--erp-text-secondary)" }}>
                              {(tx.mode || '').toUpperCase() === 'BANK' ? <FaUniversity size={14} /> : <FaWallet size={14} />}
                              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{tx.mode || '—'}</span>
                            </div>
                          </td>
                          <td className={`currency-cell ${isInflow ? 'positive' : 'negative'}`}>
                            {isInflow ? '↑ ' : '↓ '} ₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-center">
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                              <button className="btn btn-secondary" style={{ padding: "6px" }} title="Download Voucher" onClick={() => downloadTransactionPDF(tx)}><FaFileDownload /></button>
                              {tx.proof_url && <button className="btn btn-secondary" style={{ padding: "6px" }} title="Evidence" onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}${tx.proof_url}`, '_blank')}><FaEye /></button>}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                })()}
             </tbody>
          </table>
        </div>
      </div>

      {showNewTxModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "650px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <span className="text-header">Record Financial Transaction</span>
              <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setShowNewTxModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateTx} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
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
                    <select className="form-input" style={{ borderRadius: "10px" }} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, reference_id: ""})}>
                      <option value="CUSTOMER_PAYMENT">Customer Payment (Credit)</option>
                      <option value="GIFT_CONTRIBUTION">Gift Contribution (Credit)</option>
                      <option value="RECEIPT">General Receipt (Credit)</option>
                      <option disabled>──────────</option>
                      <option value="SUPPLIER_PAYMENT">Supplier Payment (Debit)</option>
                      <option value="EXPENSE_PAYMENT">Expense Payment (Debit)</option>
                      <option value="SALARY_PAYMENT">Staff Salary (Debit)</option>
                      <option value="ADVANCE_PAYMENT">Employee Advance (Debit)</option>
                      <option value="EB_UTILITY_BILL">EB / Utility Bills (Debit)</option>
                      <option value="FESTIVAL_EXPENSE">Festival / Decoration Expense (Debit)</option>
                      <option value="DONATION">Donation (Debit)</option>
                      <option value="CHIT_INVESTMENT">Chit / Investment (Debit)</option>
                      <option value="MISC_EXPENSE">Misc Expense (Debit)</option>
                    </select>
                  </div>

                  {formData.type === 'CUSTOMER_PAYMENT' && (
                    <div className="form-group form-item-full">
                      <label>Select Customer</label>
                      <select className="form-input" style={{ borderRadius: "10px" }} value={formData.reference_id} onChange={e => setFormData({...formData, reference_id: e.target.value})} required>
                        <option value="">-- Select Customer --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.username}{c.nickname ? ` (${c.nickname})` : ''}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                      </select>
                    </div>
                  )}

                  {formData.type === 'SUPPLIER_PAYMENT' && (
                    <div className="form-group form-item-full">
                      <label>Select Supplier</label>
                      <select className="form-input" style={{ borderRadius: "10px" }} value={formData.reference_id} onChange={e => setFormData({...formData, reference_id: e.target.value})} required>
                        <option value="">-- Select Supplier --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name || s.supplier_name}</option>)}
                      </select>
                    </div>
                  )}

                  {(formData.type === 'SALARY_PAYMENT' || formData.type === 'ADVANCE_PAYMENT') && (
                    <div className="form-group form-item-full">
                      <label>Select Employee</label>
                      <select className="form-input" style={{ borderRadius: "10px" }} value={formData.reference_id} onChange={e => setFormData({...formData, reference_id: e.target.value})} required>
                        <option value="">-- Select Employee --</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>)}
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
