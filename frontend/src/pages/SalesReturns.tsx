import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUndo, FaPlus, FaSync, FaTimes, FaTrash, FaFileInvoice,
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
  max_qty?: number; // original invoice qty — for validation display
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
  original_invoice_number: string;
  total_amount: number;
  refund_type: string;
  notes: string;
  items: ReturnItem[];
}

const EMPTY_ITEM: ReturnItem = { product_id: null, description: "", qty: 1, rate: 0 };

const SalesReturns: React.FC = () => {
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

  // When an invoice is selected, prefill items from its line items
  // Pre-fill qty=0 so user explicitly enters the return qty (with max_qty shown as hint)
  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    if (inv.line_items && inv.line_items.length > 0) {
      setItems(inv.line_items.map(li => ({
        product_id: li.product_id,
        description: li.description || "Item",
        qty: 0,                              // start at 0 — user enters actual return qty
        rate: Number(li.unit_price) || 0,
        max_qty: Number(li.quantity) || 0,   // original qty for reference / validation
      })));
    } else {
      setItems([{ ...EMPTY_ITEM }]);
    }
  };

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof ReturnItem, value: string | number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const totalReturn = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only submit items that actually have a qty > 0
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
      setShowModal(false);
      resetForm();
      load();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedInvoice(null);
    setInvoiceSearch("");
    setReturnDate(new Date().toISOString().split("T")[0]);
    setRefundType("CREDIT_NOTE");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
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
                    <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                      <FaFileInvoice size={10} style={{ marginRight: 4 }} />{r.original_invoice_number}
                    </span>
                  ) : "—"}
                </td>
                <td>
                  <span style={{
                    background: r.refund_type === "CASH_REFUND" ? "#dcfce7" : r.refund_type === "BANK_REFUND" ? "#dbeafe" : "#fef3c7",
                    color: r.refund_type === "CASH_REFUND" ? "#065f46" : r.refund_type === "BANK_REFUND" ? "#1e40af" : "#92400e",
                    padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600
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
              style={{ maxWidth: 700, width: "100%" }}
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
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{inv.invoice_number}</span>
                        <span style={{ color: "#64748b", fontSize: 13 }}>{inv.customer_name} — {fmt(inv.total_amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedInvoice && (
                  <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>
                      <strong>{selectedInvoice.invoice_number}</strong>
                      <span style={{ color: "#64748b", marginLeft: 8, fontSize: 13 }}>{selectedInvoice.customer_name} — {fmt(selectedInvoice.total_amount)}</span>
                    </span>
                    <button type="button" onClick={() => { setSelectedInvoice(null); setItems([{ ...EMPTY_ITEM }]); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                      <FaTimes size={12} />
                    </button>
                  </div>
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
                                border: item.qty === 0
                                  ? "1.5px dashed #cbd5e1"
                                  : "1.5px solid #6366f1",
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
    </div>
  );
};

export default SalesReturns;
