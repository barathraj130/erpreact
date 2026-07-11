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
  FaMoneyBillWave,
  FaWhatsapp,
  FaTrash
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
  user_name?: string;
  party_name?: string;
  // Populated when this ledger row was recorded via the strict expense form
  // (linked through expense_entries.cash_ledger_ref / bank_ledger_ref)
  expense_reference?: string;
  expense_sub_category?: string;
  expense_paid_to?: string;
  expense_contact_phone?: string;
  expense_description?: string;
  expense_receipt_number?: string;
  expense_recorded_by_name?: string;
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [search, setSearch] = useState("");
  // Financial summary — sourced from cash+bank ledger (same as Ledgers page)
  const [summary, setSummary] = useState({ total_inflow: 0, total_outflow: 0, net_balance: 0 });

  const [formData, setFormData] = useState<any>({
    type: "CUSTOMER_PAYMENT",
    amount: "",
    mode: "CASH",
    date: new Date().toISOString().split('T')[0],
    description: "",
    reference_id: "",
    expense_category: "Rent",
    // Strict expense fields — used only when type === 'EXPENSE_PAYMENT'
    category: "",
    sub_category: "",
    paid_to: "",
    contact_phone: "",
    receipt_number: "",
  });

  // Grouped expense categories for the strict expense form, loaded from the
  // same backend used by the (now-folded-in) dedicated expense recording flow.
  const [expenseCategoryGroups, setExpenseCategoryGroups] = useState<{ group: string; items: { key: string; label: string; icon: string }[] }[]>([]);
  const [expenseTouched, setExpenseTouched] = useState<Record<string, boolean>>({});
  const BLOCKED_PAID_TO = new Set(["person", "someone", "misc", "other", "unknown", "na", "n/a", "nobody"]);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  // WhatsApp send state per transaction id
  const [waSending, setWaSending] = useState<Record<string, 'idle'|'sending'|'sent'|'error'>>({});
  // Backdated confirmation modal
  const [showBackdateModal, setShowBackdateModal] = useState(false);
  const [pendingTxData, setPendingTxData] = useState<FormData | null>(null);

  useEffect(() => {
    fetchData();
    loadReferences();
    apiFetch("/expense-entries/categories")
      .then(r => r.json())
      .then(d => setExpenseCategoryGroups(d.groups || []))
      .catch(() => setExpenseCategoryGroups([]));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Fetch audit trail + financial summary in parallel
      const [txRes, sumRes] = await Promise.all([
        apiFetch("/transactions"),
        apiFetch("/transactions/financial-summary"),
      ]);
      if (!txRes.ok) {
        const errBody = await txRes.json().catch(() => ({}));
        throw new Error(errBody?.error || `Failed to load transactions (${txRes.status})`);
      }
      const data = await txRes.json();
      setTransactions(Array.isArray(data) ? data : []);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (sumData && !sumData.error) setSummary(sumData);
      }
    } catch (err: any) {
      console.error("Failed to fetch transactions", err);
      setFetchError(err.message || "Failed to load transactions.");
      setTransactions([]);
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

  const buildTxFormData = () => {
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === "reference_id" && !formData[key]) return;
      data.append(key, formData[key]);
    });
    let refType = "general";
    if (formData.type.includes("CUSTOMER")) refType = "CUSTOMER_PAYMENT";
    if (formData.type.includes("SUPPLIER")) refType = "SUPPLIER_PAYMENT";
    if (formData.type.includes("SALARY") || formData.type.includes("ADVANCE")) refType = "employee";
    data.set("reference_type", refType);
    if (proofFile) data.append("proof", proofFile);
    return data;
  };

  // Strict validation for the Expense Payment fields — mirrors the backend's
  // own validateExpense() so the user sees errors before submitting.
  const expenseErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!formData.category) errors.category = "Select a category";
    if (!formData.sub_category || formData.sub_category.trim().length < 3) errors.sub_category = "Minimum 3 characters required";
    const paidToNorm = (formData.paid_to || "").trim().toLowerCase();
    if (!formData.paid_to || formData.paid_to.trim().length < 3) errors.paid_to = "Minimum 3 characters required";
    else if (BLOCKED_PAID_TO.has(paidToNorm)) errors.paid_to = "Please enter the actual name of the person or business";
    if (!formData.description || formData.description.trim().length < 20)
      errors.description = `Minimum 20 characters required (${formData.description.trim().length}/20)`;
    return errors;
  };

  const postExpenseEntry = async () => {
    try {
      const paymentModeMap: Record<string, string> = { CASH: "cash", BANK: "bank", PROPRIETOR: "personal" };
      const res = await apiFetch("/expense-entries", {
        method: "POST",
        body: {
          expense_date: formData.date,
          category: formData.category,
          sub_category: formData.sub_category,
          amount: parseFloat(formData.amount),
          payment_mode: paymentModeMap[formData.mode] || "cash",
          paid_to: formData.paid_to,
          contact_phone: formData.contact_phone,
          description: formData.description,
          receipt_number: formData.receipt_number,
        },
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to record expense.");
        return;
      }
      setShowNewTxModal(false);
      setExpenseTouched({});
      fetchData();
      const msg = json.data.status === 'pending'
        ? `Expense submitted for approval — ${json.data.reference_number}. It will not affect the ledger until approved.`
        : `Expense recorded — ${json.data.reference_number}`;
      alert(msg);
    } catch (err: any) {
      alert("Failed to record expense: " + (err?.message || "Unknown error"));
    }
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.type === "EXPENSE_PAYMENT") {
      const errors = expenseErrors();
      if (Object.keys(errors).length > 0) {
        setExpenseTouched({ category: true, sub_category: true, paid_to: true, description: true });
        return;
      }
      await postExpenseEntry();
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const isBackdated = formData.date < today;
    const data = buildTxFormData();

    if (isBackdated) {
      // Pause and ask user whether to adjust opening balance
      setPendingTxData(data);
      setShowBackdateModal(true);
      return;
    }
    await postTransaction(data, false);
  };

  const postTransaction = async (data: FormData, adjustOpeningBalance: boolean) => {
    try {
      // If adjusting opening balance: capture current balance before posting
      const ledgerType: "CASH" | "BANK" = formData.mode === "BANK" ? "BANK" : "CASH";
      let balanceBefore = 0;
      if (adjustOpeningBalance) {
        const balRes = await apiFetch("/ledger/balance/current");
        const balData = await balRes.json();
        balanceBefore = ledgerType === "BANK" ? Number(balData.bank || 0) : Number(balData.cash || 0);
      }

      const res = await apiFetch("/transactions", { method: "POST", body: data }, false);
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to record transaction.");
        return;
      }

      // If user wants to keep current balance same → re-set opening balance to pre-tx value
      if (adjustOpeningBalance && balanceBefore !== 0) {
        await apiFetch("/ledger/set-opening-balance", {
          method: "POST",
          body: { ledger_type: ledgerType, amount: balanceBefore, date: "2024-04-01" },
        });
      }

      setShowNewTxModal(false);
      setShowBackdateModal(false);
      setPendingTxData(null);
      setProofFile(null);
      fetchData();
      alert("Transaction recorded.");
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

    // Detail rows — if this row was recorded through the strict expense form
    // (linked via expense_entries), show its full audit detail instead of the
    // generic ledger source label.
    doc.setFontSize(10);
    const isStrictExpense = !!tx.expense_reference;
    const expenseCategoryLabel = expenseCategoryGroups
      .flatMap((g) => g.items)
      .find((c) => c.key === (tx as any).expense_category)?.label;
    const details: [string, string][] = isStrictExpense ? [
      ['Reference',      tx.expense_reference || '-'],
      ['Date',           dateStr],
      ['Category',       expenseCategoryLabel || category],
      ['Specific Type',  tx.expense_sub_category || '-'],
      ['Paid To',        tx.expense_paid_to || partyLabel],
      ['Phone',          tx.expense_contact_phone || '-'],
      ['Description',    tx.expense_description || tx.description || '-'],
      ['Receipt No',     tx.expense_receipt_number || '-'],
      ['Mode',           modeLabel],
      ['Type',           flowLabel],
      ['Amount',         amountStr],
      ['Recorded By',    tx.expense_recorded_by_name || '-'],
    ] : [
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

  const handleDeleteTransaction = async (tx: Transaction) => {
    const label = tx.display_party || tx.description || String(tx.id);
    if (!window.confirm(`Delete "${label}" (₹${Number(tx.amount).toLocaleString('en-IN')})? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/transactions/${tx.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Failed to delete'); return; }
      fetchData();
    } catch {
      alert('Failed to delete transaction');
    }
  };

  const handleSendWhatsApp = async (tx: Transaction) => {
    const id = String(tx.id);
    setWaSending(prev => ({ ...prev, [id]: 'sending' }));
    try {
      const res = await apiFetch(`/transactions/${id}/send-whatsapp`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setWaSending(prev => ({ ...prev, [id]: 'sent' }));
        setTimeout(() => setWaSending(prev => ({ ...prev, [id]: 'idle' })), 5000);
      } else {
        setWaSending(prev => ({ ...prev, [id]: 'error' }));
        setTimeout(() => setWaSending(prev => ({ ...prev, [id]: 'idle' })), 4000);
      }
    } catch {
      setWaSending(prev => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setWaSending(prev => ({ ...prev, [id]: 'idle' })), 4000);
    }
  };

  return (
    <div className="finance-container page-container">
      <header className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Transaction History</h1>
          <p className="text-body">Monitor and audit every financial movement across your organization.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn btn-secondary"
            title="Rebuild ledger from invoices, payments, salary, loans etc."
            onClick={async () => {
              if (!window.confirm("Rebuild ledger from all source records? This restores missing entries without deleting existing ones.")) return;
              const res = await apiFetch("/company/rebuild-ledger", { method: "POST" });
              const data = await res.json();
              alert(data.message || (data.error ? `Error: ${data.error}` : "Done"));
              fetchData();
            }}
          >
            🔁 Rebuild Ledger
          </button>
          <button className="btn btn-primary" onClick={() => setShowNewTxModal(true)}>
            <FaPlus size={12} /> Record Transaction
          </button>
        </div>
      </header>

      {/* Stats sourced from cash+bank ledger (single source of truth = same as Ledgers page) */}
      <div className="stats-grid">
        <div className="stat-card card-emerald">
          <FaWallet className="stat-icon" />
          <span className="label">Total Inflow</span>
          <span className="value">
            {loading ? '...' : `₹ ${summary.total_inflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          </span>
          <span className="stat-sub">Cash + Bank In</span>
        </div>
        <div className="stat-card card-rose">
          <FaMoneyBillWave className="stat-icon" />
          <span className="label">Total Outflow</span>
          <span className="value">
            {loading ? '...' : `₹ ${summary.total_outflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          </span>
          <span className="stat-sub">Cash + Bank Out</span>
        </div>
        <div className="stat-card card-indigo">
          <FaHistory className="stat-icon" />
          <span className="label">Net Balance</span>
          <span className="value">
            {loading ? '...' : `₹ ${summary.net_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          </span>
          <span className="stat-sub">Live Liquidity</span>
        </div>
      </div>

      {fetchError && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626",
          padding: "12px 16px", borderRadius: "10px", marginBottom: "16px",
          fontSize: "0.875rem", fontWeight: 500, display: "flex",
          alignItems: "center", gap: "8px",
        }}>
          ⚠️ {fetchError}
          <button
            onClick={fetchData}
            style={{ marginLeft: "auto", background: "none", border: "1px solid #fca5a5",
              color: "#dc2626", borderRadius: "6px", padding: "2px 10px",
              cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

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
                  const INFLOW_TYPES = [
                    'CUSTOMER_PAYMENT','RECEIPT','INVOICE','GIFT_CONTRIBUTION',
                    'LOAN_DISBURSEMENT','LOAN_RECEIVED','CHIT_AUCTION',
                  ];
                  const OUTFLOW_TYPES = [
                    'SUPPLIER_PAYMENT','EXPENSE_PAYMENT','SALARY_PAYMENT',
                    'ADVANCE_PAYMENT','LOAN_REPAYMENT','EB_UTILITY_BILL',
                    'FESTIVAL_EXPENSE','DONATION','CHIT_INVESTMENT','MISC_EXPENSE',
                    'CHIT_INSTALLMENT',
                  ];

                  const filtered = transactions.filter(t => {
                    const haystack = [
                      t.description, t.type, t.reference_type,
                      t.display_party, t.party_name, t.lender_name, t.user_name
                    ].filter(Boolean).join(' ').toLowerCase();
                    return haystack.includes(search.toLowerCase());
                  });

                  if (filtered.length === 0 && !loading) {
                    return (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--erp-text-secondary)' }}>
                          No transactions found. Record a transaction or check back after activity.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map(tx => {
                    const ledgerDir = (tx as any).ledger_direction;
                    const isInflow = ledgerDir
                      ? ledgerDir === 'in'
                      : (INFLOW_TYPES.includes(tx.type) || INFLOW_TYPES.includes(tx.reference_type || ''));
                    const partyLabel = tx.display_party || tx.party_name || tx.lender_name || tx.user_name || null;
                    const typeLabel  = (tx.type || tx.reference_type || 'GENERAL').replace(/_/g, ' ');
                    const txRef      = String(tx.id).startsWith('CL-') || String(tx.id).startsWith('BL-')
                      ? tx.id : 'TXN-' + tx.id;
                    return (
                      <tr key={tx.id}>
                        <td className="timestamp-cell">
                          <span className="primary">{new Date(tx.date).toLocaleDateString('en-IN')}</span>
                          <span className="secondary">{txRef}</span>
                        </td>
                        <td>
                          <span className={`status-badge status-${isInflow ? 'success' : 'error'}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="text-body">
                          {partyLabel && <div style={{ fontWeight: 500 }}>{partyLabel}</div>}
                          <div style={{ fontSize: partyLabel ? '0.78rem' : '0.9rem', color: partyLabel ? 'var(--erp-text-secondary)' : 'inherit', fontWeight: partyLabel ? 400 : 500 }}>
                            {tx.description}
                          </div>
                        </td>
                        <td className="text-center">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--erp-text-secondary)" }}>
                            {(tx.mode || '').toUpperCase() === 'BANK' ? <FaUniversity size={14} /> : <FaWallet size={14} />}
                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{tx.mode || '-'}</span>
                          </div>
                        </td>
                        <td className={`currency-cell ${isInflow ? 'positive' : 'negative'}`}>
                          {isInflow ? '(+) ' : '(-) '}
                          Rs {Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button
                              title="Delete transaction permanently"
                              onClick={() => handleDeleteTransaction(tx)}
                              style={{ padding: "6px 8px", border: "none", borderRadius: "6px", cursor: "pointer", background: "#fee2e2", color: "#dc2626", fontSize: "13px", display: "flex", alignItems: "center" }}
                            >
                              <FaTrash />
                            </button>
                            <button className="btn btn-secondary" style={{ padding: "6px" }} title="Download Voucher" onClick={() => downloadTransactionPDF(tx)}><FaFileDownload /></button>
                            <button
                              title="Send Voucher via WhatsApp"
                              disabled={waSending[String(tx.id)] === 'sending'}
                              onClick={() => handleSendWhatsApp(tx)}
                              style={{
                                padding: "6px 10px", border: "none", borderRadius: "6px", cursor: waSending[String(tx.id)] === 'sending' ? 'not-allowed' : 'pointer',
                                background: waSending[String(tx.id)] === 'sent' ? '#16a34a' : waSending[String(tx.id)] === 'error' ? '#dc2626' : '#25D366',
                                color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px',
                                opacity: waSending[String(tx.id)] === 'sending' ? 0.6 : 1
                              }}
                            >
                              <FaWhatsapp />
                              {waSending[String(tx.id)] === 'sending' ? '' : waSending[String(tx.id)] === 'sent' ? '✓' : waSending[String(tx.id)] === 'error' ? '✗' : ''}
                            </button>
                            {tx.proof_url && (
                              <button className="btn btn-secondary" style={{ padding: "6px" }} title="Evidence"
                                onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}${tx.proof_url}`, '_blank')}>
                                <FaEye />
                              </button>
                            )}
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

                  {/* Strict expense fields — every rupee logged here needs a real
                      category, specific type, and the actual name of who was paid. */}
                  {formData.type === 'EXPENSE_PAYMENT' && (
                    <>
                      <div className="form-group form-item-full">
                        <label>Category</label>
                        <select className="form-input" style={{ borderRadius: "10px" }}
                          value={formData.category}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          onBlur={() => setExpenseTouched(t => ({ ...t, category: true }))}>
                          <option value="">Select category...</option>
                          {expenseCategoryGroups.map(g => (
                            <optgroup key={g.group} label={g.group}>
                              {g.items.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        {expenseTouched.category && expenseErrors().category && (
                          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>{expenseErrors().category}</div>
                        )}
                      </div>

                      <div className="form-group form-item-full">
                        <label>Sub Category / Specific Type</label>
                        <input type="text" className="form-input" style={{ borderRadius: "10px" }}
                          placeholder="Be specific — e.g. June rent, Morning shift wages, ICICI EMI #5"
                          value={formData.sub_category}
                          onChange={e => setFormData({ ...formData, sub_category: e.target.value })}
                          onBlur={() => setExpenseTouched(t => ({ ...t, sub_category: true }))} />
                        {expenseTouched.sub_category && expenseErrors().sub_category && (
                          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>{expenseErrors().sub_category}</div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Paid To (who received this money)</label>
                        <input type="text" className="form-input" style={{ borderRadius: "10px" }}
                          placeholder="e.g. Kumar Electricals, Rajan (driver)"
                          value={formData.paid_to}
                          onChange={e => setFormData({ ...formData, paid_to: e.target.value })}
                          onBlur={() => setExpenseTouched(t => ({ ...t, paid_to: true }))} />
                        {expenseTouched.paid_to && expenseErrors().paid_to && (
                          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>{expenseErrors().paid_to}</div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Phone / Contact (optional)</label>
                        <input type="text" className="form-input" style={{ borderRadius: "10px" }}
                          placeholder="Vendor phone number if available"
                          value={formData.contact_phone}
                          onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} />
                      </div>

                      <div className="form-group form-item-full">
                        <label>Receipt Number (optional)</label>
                        <input type="text" className="form-input" style={{ borderRadius: "10px" }}
                          placeholder="Bill number, voucher number, receipt number if you have it"
                          value={formData.receipt_number}
                          onChange={e => setFormData({ ...formData, receipt_number: e.target.value })} />
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label>Payment Channel</label>
                    <select className="form-input" style={{ borderRadius: "10px" }} value={formData.mode} onChange={e => setFormData({...formData, mode: e.target.value})}>
                      <option value="CASH">Liquid Cash</option>
                      <option value="BANK">Bank Digital Transfer</option>
                      <option value="PROPRIETOR">{formData.type === 'EXPENSE_PAYMENT' ? 'Personal (no ledger impact)' : 'Proprietor Personal Account'}</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Effective Date</label>
                    <input type="date" className="form-input" style={{ borderRadius: "10px" }} max={new Date().toISOString().split('T')[0]} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                  </div>

                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" className="form-input" style={{ borderRadius: "10px" }} placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                  </div>

                  {formData.type !== 'EXPENSE_PAYMENT' && (
                    <div className="form-group">
                       <label>Verification Proof</label>
                       <input type="file" className="form-input" style={{ borderRadius: "10px" }} onChange={handleFileChange} />
                    </div>
                  )}

                  <div className="form-group form-item-full">
                    <label>{formData.type === 'EXPENSE_PAYMENT' ? 'Description (what exactly was this for)' : 'Transaction Remark / Memo'}</label>
                    <textarea className="form-input" style={{ borderRadius: "10px" }} rows={2}
                      placeholder={formData.type === 'EXPENSE_PAYMENT'
                        ? 'Write full detail — e.g. Electricity bill for main showroom for June 2026, bill number EB-2847.'
                        : 'Explain the purpose of this transaction...'}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      onBlur={() => setExpenseTouched(t => ({ ...t, description: true }))} />
                    {formData.type === 'EXPENSE_PAYMENT' && (
                      <div style={{ fontSize: 11, color: formData.description.trim().length >= 20 ? "#16a34a" : "#94a3b8", marginTop: 4, fontWeight: 600 }}>
                        {formData.description.trim().length} / 20 minimum
                      </div>
                    )}
                    {formData.type === 'EXPENSE_PAYMENT' && expenseTouched.description && expenseErrors().description && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>{expenseErrors().description}</div>
                    )}
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

      {/* ── Backdated Transaction Confirmation Modal ── */}
      {showBackdateModal && pendingTxData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "460px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "24px 28px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>📅</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b" }}>Backdated Transaction</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Date: {formData.date}</div>
                </div>
              </div>
              <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.6, marginBottom: "8px" }}>
                This transaction is dated <strong>before today</strong>. Should it adjust the opening balance so your <strong>current balance stays the same</strong>?
              </p>
              <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                <button
                  onClick={() => postTransaction(pendingTxData, true)}
                  style={{ padding: "14px 18px", borderRadius: "12px", border: "2px solid #6366f1", background: "#eef2ff", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontWeight: 700, color: "#4338ca", fontSize: "0.92rem" }}>✅ Add &amp; adjust opening balance</div>
                  <div style={{ fontSize: "0.78rem", color: "#6366f1", marginTop: "3px" }}>Transaction appears in ledger — current balance stays the same</div>
                </button>
                <button
                  onClick={() => postTransaction(pendingTxData, false)}
                  style={{ padding: "14px 18px", borderRadius: "12px", border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.92rem" }}>➕ Add to ledger normally</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "3px" }}>Transaction appears in ledger — current balance will increase</div>
                </button>
              </div>
            </div>
            <div style={{ padding: "14px 28px", borderTop: "1px solid #f1f5f9", background: "#fafafa", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowBackdateModal(false); setPendingTxData(null); }}
                style={{ padding: "8px 20px", borderRadius: "8px", border: "2px solid #ef4444", background: "#fff", color: "#ef4444", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
                ✕ Cancel — don't add this transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
