import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUndo, FaPlus, FaSync, FaTimes, FaTrash, FaFileInvoice, FaExternalLinkAlt,
  FaCheckCircle,
} from "react-icons/fa";
import "./PageShared.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 0,
  }).format(Number(n || 0));

const REFUND_TYPES = [
  { value: "CREDIT_NOTE", label: "📄 Credit Note (no cash movement)" },
  { value: "CASH_REFUND", label: "💵 Cash Refund (cash out)" },
  { value: "BANK_REFUND", label: "🏦 Bank Refund (bank out)" },
];

interface ReturnItem {
  product_id: number | null;
  description: string;
  qty: number;
  rate: number;
  max_qty?: number;
}

interface InvoiceLineItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_id: number | null;
  gst_rate: number;
  hsn_code: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  customer_name: string;
  customer_id: number;
  line_items: InvoiceLineItem[];
}

interface SalesReturn {
  id: number;
  return_number: string;
  return_date: string;
  customer_name: string;
  customer_display: string;
  original_invoice_id: number | null;
  original_invoice_number: string;
  total_amount: number;
  refund_type: string;
  notes: string;
  items: ReturnItem[];
}

interface CustomerHistory {
  invoices: {
    id: number;
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
    return_amount: number;
    status: string;
    paid_amount: number;
  }[];
  totalInvoiced: number;
  totalReturned: number;
  netBalance: number;
}

interface ClearDialog {
  returnNumber: string;
  invoiceId: number;
  invoiceNumber: string;
}

const EMPTY_ITEM: ReturnItem = { product_id: null, description: "", qty: 1, rate: 0 };

const SalesReturns: React.FC = () => {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [refundType, setRefundType] = useState("CREDIT_NOTE");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([{ ...EMPTY_ITEM }]);
  const [submitting, setSubmitting] = useState(false);

  // Customer history (shown in modal after invoice selection)
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Post-submit "bill cleared?" dialog
  const [clearDialog, setClearDialog] = useState<ClearDialog | null>(null);
  const [markingCleared, setMarkingCleared] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [retRes, invRes] = await Promise.all([
        apiFetch("/sales-returns").then(r => r.json()),
        apiFetch("/sales-returns/invoices-for-return").then(r => r.json()).catch(() => []),
      ]);
      setReturns(Array.isArray(retRes) ? retRes : []);
      setInvoices(Array.isArray(invRes) ? invRes : []);
    } catch {
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchCustomerHistory = async (customerId: number) => {
    setHistoryLoading(true);
    setCustomerHistory(null);
    try {
      const res = await apiFetch(`/sales-returns/customer-history?customer_id=${customerId}`);
      const data = await res.json();
      setCustomerHistory(data);
    } catch {
      setCustomerHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    if (inv.line_items && inv.line_items.length > 0) {
      setItems(inv.line_items.map(li => ({
        product_id: li.product_id,
        description: li.description || "Item",
        qty: 0,
        rate: Number(li.unit_price) || 0,
        max_qty: Number(li.quantity) || 0,
      })));
    } else {
      setItems([{ ...EMPTY_ITEM }]);
    }
    if (inv.customer_id) {
      fetchCustomerHistory(inv.customer_id);
    }
  };

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ReturnItem, value: string | number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const totalReturn = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeItems = items.filter(i => Number(i.qty) > 0 && i.description.trim());
    if (activeItems.length === 0) {
      alert("Please enter a return quantity (> 0) for at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        original_invoice_id: selectedInvoice?.id || null,
        customer_id: selectedInvoice?.customer_id || null,
        customer_name: selectedInvoice?.customer_name || null,
        return_date: returnDate,
        items: activeItems,
        refund_type: refundType,
        notes,
      };
      const res = await apiFetch("/sales-returns", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const record = await res.json();
      const origInv = selectedInvoice;
      setShowModal(false);
      resetForm();
      load();
      if (origInv) {
        setClearDialog({
          returnNumber: record.return_number,
          invoiceId: origInv.id,
          invoiceNumber: origInv.invoice_number,
        });
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCleared = async () => {
    if (!clearDialog) return;
    setMarkingCleared(true);
    try {
      const res = await apiFetch(`/sales-returns/mark-invoice-cleared/${clearDialog.invoiceId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark cleared");
      setClearDialog(null);
      load();
    } catch (err: any) {
      alert("Could not mark invoice as cleared: " + err.message);
    } finally {
      setMarkingCleared(false);
    }
  };

  const resetForm = () => {
    setSelectedInvoice(null);
    setInvoiceSearch("");
    setReturnDate(new Date().toISOString().split("T")[0]);
    setRefundType("CREDIT_NOTE");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
    setCustomerHistory(null);
  };

  const filteredInvoices = invoices.filter(inv =>
    !invoiceSearch ||
    inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
    (inv.customer_name || "").toLowerCase().includes(invoiceSearch.toLowerCase())
  );

  const totalReturnsAmt = returns.reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1><FaUndo style={{ marginRight: 8, color: "#ef4444" }} />Sales Returns</h1>
          <p>Record returned goods, issue credit notes or process refunds.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load}>
            <FaSync className={loading ? "fa-spin" : ""} size={12} />
          </button>
          <button
            className="page-btn-round page-btn-round-primary"
            onClick={() => { resetForm(); setShowModal(true); }}
          >
            <FaPlus size={11} /> New Return
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "32px" }}>
        <div style={{ flex: "1 1 180px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "1px solid #fecaca" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "1px" }}>Total Returns</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#7f1d1d", marginTop: "8px" }}>{returns.length}</div>
        </div>
        <div style={{ flex: "1 1 180px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#fff7ed,#fed7aa)", border: "1px solid #fdba74" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#9a3412", textTransform: "uppercase", letterSpacing: "1px" }}>Total Value Returned</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#7c2d12", marginTop: "8px" }}>{fmt(totalReturnsAmt)}</div>
        </div>
        <div style={{ flex: "1 1 180px", padding: "24px", borderRadius: "20px", background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "1px" }}>Cash Refunds</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#064e3b", marginTop: "8px" }}>
            {fmt(returns.filter(r => r.refund_type === "CASH_REFUND").reduce((s, r) => s + Number(r.total_amount), 0))}
          </div>
        </div>
      </div>

      {/* Returns table */}
      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Return No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Original Invoice</th>
              <th>Refund Type</th>
              <th className="text-right">Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "48px" }}>
                  No sales returns recorded yet. Click <strong>New Return</strong> to add one.
                </td>
              </tr>
            ) : returns.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700, color: "#ef4444" }}>{r.return_number}</td>
                <td>{new Date(r.return_date).toLocaleDateString("en-IN")}</td>
                <td style={{ fontWeight: 600 }}>{r.customer_name || r.customer_display || "—"}</td>
                <td>
                  {r.original_invoice_number ? (
                    <button
                      onClick={() => navigate(`/invoices/edit/${r.original_invoice_id}`)}
                      title="View original invoice"
                      style={{
                        background: "#eff6ff", color: "#1d4ed8",
                        padding: "3px 8px", borderRadius: "6px", fontSize: "12px",
                        fontWeight: 600, border: "1px solid #bfdbfe", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <FaFileInvoice size={10} />{r.original_invoice_number}
                      <FaExternalLinkAlt size={9} style={{ opacity: 0.6 }} />
                    </button>
                  ) : "—"}
                </td>
                <td>
                  <span style={{
                    background: r.refund_type === "CASH_REFUND" ? "#dcfce7" : r.refund_type === "BANK_REFUND" ? "#dbeafe" : "#fef3c7",
                    color: r.refund_type === "CASH_REFUND" ? "#065f46" : r.refund_type === "BANK_REFUND" ? "#1e40af" : "#92400e",
                    padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                  }}>
                    {REFUND_TYPES.find(t => t.value === r.refund_type)?.label.replace(/^[^ ]+ /, "") || r.refund_type}
                  </span>
                </td>
                <td className="text-right" style={{ fontWeight: 700, color: "#ef4444" }}>{fmt(r.total_amount)}</td>
                <td style={{ color: "#64748b", fontSize: "13px" }}>{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── New Return Modal ── */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div
              className="page-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              style={{ maxWidth: 720, width: "100%" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0 }}>Record Sales Return</h2>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Invoice selector */}
                <label style={{ fontWeight: 600 }}>Search & Select Invoice (optional)</label>
                <input
                  placeholder="Type invoice number or customer name…"
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                {invoiceSearch && filteredInvoices.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, maxHeight: 180, overflowY: "auto", marginBottom: 12, background: "#fff" }}>
                    {filteredInvoices.slice(0, 10).map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => { handleSelectInvoice(inv); setInvoiceSearch(""); }}
                        style={{
                          padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                          background: selectedInvoice?.id === inv.id ? "#eff6ff" : undefined,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{inv.invoice_number}</span>
                        <span style={{ color: "#64748b", fontSize: 13 }}>{inv.customer_name} — {fmt(inv.total_amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedInvoice && (
                  <>
                    <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        <strong>{selectedInvoice.invoice_number}</strong>
                        <span style={{ color: "#64748b", marginLeft: 8, fontSize: 13 }}>{selectedInvoice.customer_name} — {fmt(selectedInvoice.total_amount)}</span>
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/edit/${selectedInvoice.id}`)}
                          title="View original invoice"
                          style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <FaFileInvoice size={10} /> View Bill <FaExternalLinkAlt size={9} />
                        </button>
                        <button type="button" onClick={() => { setSelectedInvoice(null); setItems([{ ...EMPTY_ITEM }]); setCustomerHistory(null); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                          <FaTimes size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Customer purchase history */}
                    {selectedInvoice.customer_id && (
                      <div style={{ border: "1px solid #e0e7ff", borderRadius: 10, marginBottom: 14, overflow: "hidden", background: "#fafafa" }}>
                        <div style={{ padding: "8px 14px", background: "#eef2ff", borderBottom: "1px solid #e0e7ff", fontSize: 12, fontWeight: 700, color: "#4338ca", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>Customer Purchase History</span>
                          {historyLoading && <span style={{ fontWeight: 400, color: "#6b7280" }}>Loading…</span>}
                        </div>
                        {customerHistory && (
                          <>
                            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e0e7ff" }}>
                              {[
                                { label: "Total Invoiced", val: customerHistory.totalInvoiced, color: "#1e40af" },
                                { label: "Total Returned", val: customerHistory.totalReturned, color: "#b91c1c" },
                                { label: "Net Balance", val: customerHistory.netBalance, color: "#065f46" },
                              ].map((kpi, i) => (
                                <div key={i} style={{ flex: 1, padding: "10px 14px", borderRight: i < 2 ? "1px solid #e0e7ff" : undefined, textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, marginTop: 3 }}>{fmt(kpi.val)}</div>
                                </div>
                              ))}
                            </div>
                            {customerHistory.invoices.length > 0 && (
                              <div style={{ maxHeight: 160, overflowY: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: "#f1f5f9" }}>
                                      <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Invoice</th>
                                      <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Date</th>
                                      <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>Amount</th>
                                      <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>Returned</th>
                                      <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 600, color: "#374151" }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {customerHistory.invoices.map((inv, i) => (
                                      <tr key={inv.id} style={{ borderTop: "0.5px solid #f1f5f9", background: inv.id === selectedInvoice?.id ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa" }}>
                                        <td style={{ padding: "5px 12px", fontWeight: inv.id === selectedInvoice?.id ? 700 : 400, color: "#1d4ed8" }}>{inv.invoice_number}</td>
                                        <td style={{ padding: "5px 12px", color: "#6b7280" }}>{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
                                        <td style={{ padding: "5px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                                        <td style={{ padding: "5px 12px", textAlign: "right", color: Number(inv.return_amount) > 0 ? "#b91c1c" : "#9ca3af" }}>
                                          {Number(inv.return_amount) > 0 ? fmt(inv.return_amount) : "—"}
                                        </td>
                                        <td style={{ padding: "5px 12px", textAlign: "center" }}>
                                          <span style={{
                                            padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                                            background: inv.status === "PAID" ? "#dcfce7" : inv.status === "PARTIAL" ? "#fef9c3" : "#fee2e2",
                                            color: inv.status === "PAID" ? "#065f46" : inv.status === "PARTIAL" ? "#854d0e" : "#991b1b",
                                          }}>{inv.status || "PENDING"}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}
                        {!customerHistory && !historyLoading && (
                          <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No history available</div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="form-grid-2">
                  <div>
                    <label>Return Date</label>
                    <input type="date" required value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                  </div>
                  <div>
                    <label>Refund Type</label>
                    <select value={refundType} onChange={e => setRefundType(e.target.value)}>
                      {REFUND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Return items */}
                <div style={{ margin: "16px 0 8px", fontWeight: 700, fontSize: 14, color: "#374151" }}>
                  Return Items
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700 }}>Description</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, width: 70 }}>Qty</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, width: 100 }}>Rate (₹)</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, width: 100 }}>Total</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              required
                              value={item.description}
                              onChange={e => updateItem(idx, "description", e.target.value)}
                              placeholder="Item description"
                              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px" }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="number" min="0" step="1" required
                              value={item.qty}
                              onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }}
                              max={item.max_qty || undefined}
                              onChange={e => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                if (item.max_qty && val > item.max_qty) return;
                                updateItem(idx, "qty", val);
                              }}
                              style={{
                                width: "100%", borderRadius: 6, padding: "6px 8px", textAlign: "center",
                                fontWeight: 700, fontSize: 14,
                                color: item.qty === 0 ? "#94a3b8" : "#1e293b",
                                background: item.qty === 0 ? "#f8fafc" : "#fff",
                                border: item.qty === 0 ? "1.5px dashed #cbd5e1" : "1.5px solid #6366f1",
                                outline: "none",
                              }}
                            />
                            {item.max_qty ? (
                              <div style={{ fontSize: 10, color: "#6366f1", textAlign: "center", marginTop: 2, fontWeight: 600 }}>
                                / {item.max_qty} max
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="number" min="0" step="0.01" required
                              value={item.rate}
                              onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>
                            {fmt(item.qty * item.rate)}
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            {items.length > 1 && (
                              <button type="button" onClick={() => removeItem(idx)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                                <FaTrash size={11} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
                        <td colSpan={3} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>Total Return Amount</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#ef4444", fontSize: 15 }}>{fmt(totalReturn)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <button type="button" onClick={addItem}
                  style={{ background: "none", border: "1px dashed #94a3b8", color: "#64748b", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
                  + Add Item
                </button>

                <label>Notes (optional)</label>
                <input value={notes} placeholder="Reason for return…" onChange={e => setNotes(e.target.value)} />

                {refundType === "CASH_REFUND" && (
                  <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 8 }}>
                    ⚠️ <strong>Cash Refund:</strong> {fmt(totalReturn)} will be deducted from Cash balance.
                  </div>
                )}
                {refundType === "BANK_REFUND" && (
                  <div style={{ padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13, color: "#1e40af", marginBottom: 8 }}>
                    🏦 <strong>Bank Refund:</strong> {fmt(totalReturn)} will be deducted from Bank balance.
                  </div>
                )}

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={submitting || totalReturn <= 0}>
                    {submitting ? "Recording…" : "Record Return"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Bill Cleared? Dialog ── */}
      <AnimatePresence>
        {clearDialog && (
          <div className="page-modal-overlay" style={{ zIndex: 1100 }}>
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              style={{
                background: "#fff", borderRadius: 20, padding: "32px 28px",
                maxWidth: 440, width: "100%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center",
              }}
            >
              <FaCheckCircle size={40} color="#16a34a" style={{ marginBottom: 14 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
                Return {clearDialog.returnNumber} Recorded
              </h3>
              <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
                Is the original bill{" "}
                <strong style={{ color: "#1d4ed8" }}>{clearDialog.invoiceNumber}</strong>{" "}
                now fully cleared / settled?
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  onClick={() => setClearDialog(null)}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                >
                  No — Keep Balance
                </button>
                <button
                  onClick={handleMarkCleared}
                  disabled={markingCleared}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  {markingCleared ? "Marking…" : "Yes — Mark Cleared"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SalesReturns;
