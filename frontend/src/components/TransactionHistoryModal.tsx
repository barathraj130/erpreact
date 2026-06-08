import React, { useEffect, useState } from "react";
import {
    FaCalendarAlt,
    FaCheckCircle,
    FaDownload,
    FaFileInvoiceDollar,
    FaInfoCircle,
    FaPrint,
    FaReceipt,
    FaTimesCircle,
    FaTimes,
    FaUndo,
    FaWallet,
} from "react-icons/fa";
import {
    CustomerLedgerEntry,
    CustomerLedgerResponse,
    fetchCustomerLedger,
} from "../api/userApi";
import { apiFetch } from "../utils/api";

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "supplier" | "customer";
  entityId: number;
  entityName: string;
  /** Called after a round-off is successfully applied, so parent can refresh its list */
  onRoundOffApplied?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function exportCustomerLedgerCsv(
  name: string,
  summary: CustomerLedgerResponse["summary"],
  rows: CustomerLedgerEntry[],
) {
  const csvRows = [
    ["Customer", name],
    ["Opening Balance", summary.opening_balance],
    ["Total Billed", summary.total_billed],
    ["Total Paid", summary.total_paid],
    ["Total Returns", summary.total_returns],
    ["Pending", summary.pending_amount],
    [],
    [
      "Date",
      "Particulars",
      "Type",
      "Invoice",
      "Payment Method",
      "Bank Name",
      "Bank Transaction ID",
      "Debit",
      "Credit",
      "Running Balance",
    ],
    ...rows.map((row) => [
      formatDate(row.date),
      row.description,
      row.type,
      row.invoice_number || "",
      row.payment_method || "",
      row.bank_name || "",
      row.bank_transaction_id || "",
      row.debit,
      row.credit,
      row.running_balance,
    ]),
  ];

  const csv = csvRows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/\s+/g, "_")}_ledger.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

interface RoundOffForm {
  amount: string;
  date: string;
  notes: string;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  onRoundOffApplied,
}) => {
  const [supplierLedger, setSupplierLedger] = useState<any>(null);
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ start_date: "", end_date: "", payment_method: "" });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showRoundOff, setShowRoundOff] = useState(false);
  const [roundOffForm, setRoundOffForm] = useState<RoundOffForm>({ amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [roundOffLoading, setRoundOffLoading] = useState(false);
  const [roundOffMsg, setRoundOffMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const loadData = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      if (entityType === "customer") {
        const ledger = await fetchCustomerLedger(entityId, {
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          payment_method: filters.payment_method || undefined,
        });
        setCustomerLedger(ledger);
      } else {
        const response = await apiFetch(`/ledger/supplier/${entityId}?start_date=${filters.start_date || ""}&end_date=${filters.end_date || ""}`);
        const data = await response.json();
        setSupplierLedger(data);
      }
    } catch (error) {
      console.error("Failed to fetch ledger data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [isOpen, entityId, entityType, filters.start_date, filters.end_date, filters.payment_method]);
  
  useEffect(() => {
    if (!isOpen || entityType !== "customer") return;
    const interval = window.setInterval(loadData, 15000);
    return () => window.clearInterval(interval);
  }, [isOpen, entityType, entityId, filters.start_date, filters.end_date, filters.payment_method]);

  const supplierTransactions = supplierLedger?.transactions || [];
  const customerRows = customerLedger?.transactions || [];
  const customerSummary = customerLedger?.summary;
  const initials = entityName ? entityName.charAt(0).toUpperCase() : "?";
  const hasFilters = filters.start_date || filters.end_date || filters.payment_method;

  const pendingAmount = customerSummary?.pending_amount || 0;
  const isAdvance = pendingAmount < 0;

  const handleRoundOffSubmit = async () => {
    const amt = parseFloat(roundOffForm.amount);
    if (!amt || amt <= 0) { setRoundOffMsg({ type: "error", text: "Enter a valid positive amount" }); return; }
    if (amt > pendingAmount) { setRoundOffMsg({ type: "error", text: `Cannot exceed pending balance of ${fmt(pendingAmount)}` }); return; }
    setRoundOffLoading(true);
    setRoundOffMsg(null);
    try {
      const res = await apiFetch("/payments/round-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: entityId, amount: amt, date: roundOffForm.date, notes: roundOffForm.notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRoundOffMsg({ type: "success", text: `Round off of ${fmt(amt)} applied! New pending: ${fmt(data.new_pending ?? 0)}` });
      setRoundOffForm({ amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
      await loadData();            // refresh ledger entries inside modal
      onRoundOffApplied?.();       // tell parent to refresh customer list
    } catch (e: any) {
      setRoundOffMsg({ type: "error", text: e.message });
    } finally {
      setRoundOffLoading(false);
    }
  };

  const summaryCards = entityType === "customer" ? [
    { label: "Total Billed", value: customerSummary?.total_billed || 0, color: "#0f766e", bg: "#f0fdfa", icon: <FaFileInvoiceDollar size={14} /> },
    { label: "Total Paid", value: customerSummary?.total_paid || 0, color: "#2563eb", bg: "#eff6ff", icon: <FaCheckCircle size={14} /> },
    { label: "Total Returns", value: customerSummary?.total_returns || 0, color: "#d97706", bg: "#fffbeb", icon: <FaUndo size={14} /> },
    {
      label: isAdvance ? "Advance Balance" : "Pending Amount",
      value: Math.abs(pendingAmount),
      color: isAdvance ? "#059669" : "#dc2626",
      bg: isAdvance ? "#f0fdf4" : "#fef2f2",
      icon: <FaWallet size={14} />,
    },
  ] : [
    { label: "Total Bills", value: supplierLedger?.summary?.total_billed || 0, color: "#dc2626", bg: "#fef2f2", icon: <FaFileInvoiceDollar size={14} /> },
    { label: "Total Paid", value: supplierLedger?.summary?.total_paid || 0, color: "#0f766e", bg: "#f0fdfa", icon: <FaCheckCircle size={14} /> },
    { label: "Opening Bal", value: supplierLedger?.summary?.opening_balance || 0, color: "#94a3b8", bg: "#f8fafc", icon: <FaInfoCircle size={14} /> },
    { label: "Current Payable", value: supplierLedger?.summary?.pending_amount || 0, color: "#dc2626", bg: "#fff1f1", icon: <FaWallet size={14} /> },
  ];

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .thm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: ${isMobile ? "0" : "24px"};
        }
        .thm-modal {
          width: ${isMobile ? "100%" : "min(1120px, calc(100vw - 48px))"};
          max-height: ${isMobile ? "100dvh" : "calc(100vh - 48px)"};
          background: #ffffff;
          border-radius: ${isMobile ? "0" : "20px"};
          border: 1px solid #e2e8f0;
          box-shadow: 0 32px 96px rgba(15, 23, 42, 0.22);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .thm-header {
          padding: 16px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .thm-avatar {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: #dbeafe;
          color: #2563eb;
          display: grid; place-items: center;
          font-weight: 800;
        }
        .thm-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
        .thm-meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
        .thm-badge { font-size: 10px; font-weight: 700; background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
        
        .thm-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .thm-info-bar { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 13px; }
        .thm-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .thm-stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; }
        .thm-stat-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .thm-stat-value { font-size: 22px; font-weight: 900; margin-top: 4px; }
        
        .thm-content-grid { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }
        .thm-card { border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; overflow: hidden; }
        .thm-filters-row { padding: 16px; border-bottom: 1px solid #f1f5f9; background: #fafafa; display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
        .thm-input { width: 100%; height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: 13px; }
        .thm-reset-btn { height: 38px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-weight: 700; font-size: 12px; padding: 0 12px; cursor: pointer; }
        
        .thm-table-wrap { overflow-x: auto; }
        .thm-table { width: 100%; border-collapse: collapse; }
        .thm-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase; }
        .thm-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .thm-table th.right, .thm-table td.right { text-align: right; }
        
        .thm-sidebar { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; height: fit-content; }
        .thm-sidebar-header { padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .thm-sidebar-desc { padding: 16px; font-size: 12px; color: #64748b; line-height: 1.6; border-bottom: 1px solid #f1f5f9; }
        .thm-info-items { padding: 16px; display: grid; gap: 12px; }
        .thm-info-item { background: #fafafa; border: 1px solid #f1f5f9; border-radius: 10px; padding: 12px; }
        .thm-info-item-title { font-weight: 800; font-size: 12px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
        .thm-info-item-text { font-size: 11.5px; color: #64748b; }
        .thm-opening-bal { padding: 16px; border-top: 1px solid #f1f5f9; background: #f0fdf4; }
        
        .thm-footer { padding: 16px 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .thm-btn-done { height: 40px; padding: 0 24px; border-radius: 8px; background: #0f172a; color: #fff; font-weight: 700; border: none; cursor: pointer; }
        .thm-btn-close { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #94a3b8; cursor: pointer; display: grid; place-items: center; }
        .thm-btn-roundoff { height: 40px; padding: 0 18px; border-radius: 8px; background: #fff7ed; color: #c2410c; font-weight: 700; border: 1px solid #fed7aa; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; }
        .thm-btn-roundoff:hover { background: #ffedd5; }
        .thm-roundoff-panel { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 18px 20px; margin: 0 24px 0 24px; display: flex; flex-direction: column; gap: 14px; }
        .thm-roundoff-title { font-weight: 800; font-size: 14px; color: #7c2d12; display: flex; align-items: center; gap: 8px; }
        .thm-roundoff-grid { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px; align-items: end; }
        .thm-roundoff-label { font-size: 11px; font-weight: 700; color: #9a3412; margin-bottom: 4px; text-transform: uppercase; }
        .thm-roundoff-input { width: 100%; height: 38px; border: 1px solid #fdba74; border-radius: 8px; padding: 0 10px; font-size: 13px; background: #fff; box-sizing: border-box; }
        .thm-roundoff-input:focus { outline: none; border-color: #f97316; }
        .thm-btn-apply { height: 38px; padding: 0 20px; border-radius: 8px; background: #ea580c; color: #fff; font-weight: 700; border: none; cursor: pointer; font-size: 13px; white-space: nowrap; }
        .thm-btn-apply:disabled { opacity: 0.6; cursor: not-allowed; }
        .thm-roundoff-info { font-size: 12px; color: #9a3412; background: #ffedd5; border-radius: 8px; padding: 8px 12px; }
        @media (max-width: 768px) { .thm-roundoff-grid { grid-template-columns: 1fr 1fr; } }
        
        .thm-row-type-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-right: 6px; }
        .thm-skeleton { height: 40px; background: #f1f5f9; border-radius: 8px; animation: thmPulse 1.5s infinite; }
        @keyframes thmPulse { 0% { opacity: 0.6 } 50% { opacity: 1 } 100% { opacity: 0.6 } }

        @media (max-width: 768px) {
          .thm-content-grid { grid-template-columns: 1fr; }
          .thm-summary-grid { grid-template-columns: 1fr 1fr; }
          .thm-filters-row { grid-template-columns: 1fr 1fr; }
          .thm-modal { border-radius: 0; max-height: 100dvh; }
        }
      `}</style>

      <div className="thm-overlay" onClick={onClose}>
        <div className="thm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="thm-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="thm-avatar">{initials}</div>
              <div>
                <h2 className="thm-title">Account Ledger</h2>
                <div className="thm-meta">
                  <span style={{ fontWeight: 700 }}>{entityName}</span>
                  <span className="thm-badge">{entityType}</span>
                </div>
              </div>
            </div>
            <button className="thm-btn-close" onClick={onClose}><FaTimes /></button>
          </div>

          <div className="thm-body">
            <div className="thm-info-bar">
              <FaInfoCircle color="#0ea5e9" size={14} />
              <div>
                {entityType === "customer" ? (
                  <span>Formula: <strong>Opening + Bills − Payments − Returns − Round Offs</strong></span>
                ) : (
                  <span>Formula: <strong>Opening + Bills − Payments</strong></span>
                )}
              </div>
            </div>

            <div className="thm-summary-grid">
              {summaryCards.map((card) => (
                <div key={card.label} className="thm-stat-card" style={{ borderLeft: `3px solid ${card.color}` }}>
                  <div className="thm-stat-label">{card.label}</div>
                  <div className="thm-stat-value" style={{ color: card.color }}>{fmt(card.value)}</div>
                </div>
              ))}
            </div>

            <div className="thm-content-grid">
              <div className="thm-card">
                <div className="thm-filters-row">
                  <div className="thm-filter-group">
                    <label>From</label>
                    <input type="date" className="thm-input" value={filters.start_date} onChange={e => setFilters(f => ({...f, start_date: e.target.value}))} />
                  </div>
                  <div className="thm-filter-group">
                    <label>To</label>
                    <input type="date" className="thm-input" value={filters.end_date} onChange={e => setFilters(f => ({...f, end_date: e.target.value}))} />
                  </div>
                  <div className="thm-filter-group">
                    <label>Method</label>
                    <select className="thm-input" value={filters.payment_method} onChange={e => setFilters(f => ({...f, payment_method: e.target.value}))}>
                      <option value="">All</option>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank</option>
                    </select>
                  </div>
                  <button className="thm-reset-btn" onClick={() => setFilters({start_date: '', end_date: '', payment_method: ''})}>Reset</button>
                </div>

                <div className="thm-table-wrap">
                  {loading ? (
                    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                      {[1, 2, 3, 4].map(n => <div key={n} className="thm-skeleton" />)}
                    </div>
                  ) : (entityType === "customer" ? customerRows : supplierTransactions).length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No entries found.</div>
                  ) : (
                    <table className="thm-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Particulars</th>
                          <th>Ref</th>
                          <th className="right">Debit</th>
                          <th className="right">Credit</th>
                          <th className="right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(entityType === "customer" ? customerRows : supplierTransactions).map((row: any) => (
                          <tr key={row.id}>
                            <td style={{ whiteSpace: 'nowrap' }}><FaCalendarAlt size={10} style={{marginRight: 6, color: '#cbd5e1'}} />{formatDate(row.date)}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{row.description}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                <span className="thm-row-type-badge" style={{
                                  background: row.type === 'ROUND_OFF' ? '#fff7ed' : (row.type === 'BILL' || row.type === 'INVOICE') ? '#eff6ff' : '#f0fdf4',
                                  color: row.type === 'ROUND_OFF' ? '#c2410c' : (row.type === 'BILL' || row.type === 'INVOICE') ? '#2563eb' : '#16a34a'
                                }}>{row.type === 'ROUND_OFF' ? 'ROUND OFF' : row.type}</span>
                                {row.category === 'ROUND_OFF' ? 'Discount/Write-off' : row.category}
                              </div>
                            </td>
                            <td>{row.invoice_number || row.reference_number || "—"}</td>
                            <td className="right" style={{ color: row.debit > 0 ? (entityType === 'customer' ? '#dc2626' : '#059669') : '#cbd5e1' }}>
                              {row.debit > 0 ? fmt(row.debit) : "—"}
                            </td>
                            <td className="right" style={{ color: row.credit > 0 ? (entityType === 'customer' ? '#059669' : '#dc2626') : '#cbd5e1' }}>
                              {row.credit > 0 ? fmt(row.credit) : "—"}
                            </td>
                            <td className="right" style={{ fontWeight: 800 }}>
                              {row.running_balance < 0 ? (
                                <span style={{ color: "#059669" }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, background: "#dcfce7", color: "#059669", borderRadius: 4, padding: "1px 5px", marginRight: 4 }}>ADV</span>
                                  {fmt(Math.abs(row.running_balance))}
                                </span>
                              ) : fmt(row.running_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {!isMobile && (
                <div className="thm-sidebar">
                  <div className="thm-sidebar-header"><FaReceipt /> <span>Ledger Guide</span></div>
                  <div className="thm-sidebar-desc">
                    This statement tracks all {entityType === 'customer' ? 'sales and receipts' : 'purchases and payments'} for this account.
                  </div>
                  <div className="thm-info-items">
                    <div className="thm-info-item">
                      <div className="thm-info-item-title"><FaFileInvoiceDollar color="#2563eb" /> {entityType === 'customer' ? 'Invoices' : 'Bills'}</div>
                      <div className="thm-info-item-text">Entries that increase the outstanding balance.</div>
                    </div>
                    <div className="thm-info-item">
                      <div className="thm-info-item-title"><FaCheckCircle color="#16a34a" /> Payments</div>
                      <div className="thm-info-item-text">Cash or bank transfers that reduce the balance.</div>
                    </div>
                    {entityType === 'customer' && (
                      <div className="thm-info-item" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                        <div className="thm-info-item-title"><FaWallet color="#059669" /> Advance</div>
                        <div className="thm-info-item-text">When balance goes negative, the customer has overpaid — shown as Advance credit.</div>
                      </div>
                    )}
                    {entityType === 'customer' && (
                      <div className="thm-info-item" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
                        <div className="thm-info-item-title"><span>⚖️</span> Round Off</div>
                        <div className="thm-info-item-text">Small balance write-offs agreed with the customer. Reduces pending without cash receipt.</div>
                      </div>
                    )}
                  </div>
                  <div className="thm-opening-bal">
                    <div className="thm-stat-label">Opening Balance</div>
                    <div className="thm-stat-value">{fmt(entityType === 'customer' ? (customerSummary?.opening_balance || 0) : (supplierLedger?.summary?.opening_balance || 0))}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Round-Off Panel */}
          {showRoundOff && entityType === "customer" && pendingAmount > 0 && (
            <div className="thm-roundoff-panel">
              <div className="thm-roundoff-title">
                <span>⚖️</span> Round Off Pending Balance
              </div>
              <div className="thm-roundoff-info">
                Current pending: <strong>{fmt(pendingAmount)}</strong> — enter the amount to write off/discount. The difference will be settled.
              </div>
              <div className="thm-roundoff-grid">
                <div>
                  <div className="thm-roundoff-label">Amount to Write Off (₹)</div>
                  <input
                    type="number"
                    className="thm-roundoff-input"
                    placeholder="e.g. 995"
                    min="0.01"
                    step="0.01"
                    value={roundOffForm.amount}
                    onChange={e => {
                      setRoundOffForm(f => ({ ...f, amount: e.target.value }));
                      setRoundOffMsg(null);
                    }}
                  />
                  {roundOffForm.amount && parseFloat(roundOffForm.amount) > 0 && parseFloat(roundOffForm.amount) <= pendingAmount && (
                    <div style={{ fontSize: 11, color: "#15803d", marginTop: 3 }}>
                      After: <strong>{fmt(pendingAmount - parseFloat(roundOffForm.amount))}</strong>
                    </div>
                  )}
                </div>
                <div>
                  <div className="thm-roundoff-label">Date</div>
                  <input
                    type="date"
                    className="thm-roundoff-input"
                    value={roundOffForm.date}
                    onChange={e => setRoundOffForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="thm-roundoff-label">Reason / Notes</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      className="thm-roundoff-input"
                      placeholder="e.g. Round off agreed with customer"
                      value={roundOffForm.notes}
                      onChange={e => setRoundOffForm(f => ({ ...f, notes: e.target.value }))}
                    />
                    <button className="thm-btn-apply" disabled={roundOffLoading} onClick={handleRoundOffSubmit}>
                      {roundOffLoading ? "…" : "Apply"}
                    </button>
                  </div>
                </div>
              </div>
              {roundOffMsg && (
                <div style={{
                  fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 8,
                  background: roundOffMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
                  color: roundOffMsg.type === "success" ? "#15803d" : "#dc2626",
                  border: `1px solid ${roundOffMsg.type === "success" ? "#bbf7d0" : "#fca5a5"}`
                }}>
                  {roundOffMsg.type === "success" ? "✓ " : "✗ "}{roundOffMsg.text}
                </div>
              )}
            </div>
          )}

          <div className="thm-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="thm-footer-info">
                {entityType === 'customer' ? customerRows.length : supplierTransactions.length} entries recorded
              </div>
              {entityType === "customer" && pendingAmount > 0 && (
                <button
                  className="thm-btn-roundoff"
                  onClick={() => { setShowRoundOff(v => !v); setRoundOffMsg(null); }}
                >
                  <span>⚖️</span>
                  {showRoundOff ? "Cancel Round Off" : "Round Off"}
                </button>
              )}
            </div>
            <button className="thm-btn-done" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionHistoryModal;
