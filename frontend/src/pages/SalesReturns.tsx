import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUndo, FaPlus, FaSync, FaTimes, FaTrash, FaFileInvoice,
  FaExternalLinkAlt, FaCheckCircle, FaEye, FaEdit, FaPrint,
} from "react-icons/fa";
import "./PageShared.css";
import ReturnInspectionModal from "./ReturnInspectionModal";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 0,
  }).format(Number(n || 0));

const REFUND_TYPES = [
  { value: "CREDIT_NOTE", label: "📄 Credit Note (no cash movement)" },
  { value: "CASH_REFUND",  label: "💵 Cash Refund (cash out)" },
  { value: "BANK_REFUND",  label: "🏦 Bank Refund (bank out)" },
];

interface ReturnItem {
  product_id: number | null;
  description: string;
  qty: number;
  rate: number;
  max_qty?: number;
  line_total?: number;
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
    id: number; invoice_number: string; invoice_date: string;
    total_amount: number; return_amount: number; status: string; paid_amount: number;
  }[];
  totalInvoiced: number; totalReturned: number; netBalance: number;
}

interface ClearDialog {
  returnNumber: string; invoiceId: number; invoiceNumber: string;
}

interface CompanyProfile {
  company_name: string; gstin: string; address_line1: string;
  city_pincode: string; state: string; phone: string; email: string;
}

const EMPTY_ITEM: ReturnItem = { product_id: null, description: "", qty: 1, rate: 0 };

/* ─────────────────────────────────────────────────────────────────────────────
   Return Bill Print View Component
───────────────────────────────────────────────────────────────────────────── */
const ReturnBillView: React.FC<{
  ret: SalesReturn; company: CompanyProfile | null; onClose: () => void;
}> = ({ ret, company, onClose }) => {
  const items: ReturnItem[] = Array.isArray(ret.items)
    ? ret.items
    : (typeof ret.items === "string" ? JSON.parse(ret.items) : []);

  const refundLabel = REFUND_TYPES.find(t => t.value === ret.refund_type)?.label.replace(/^[^ ]+ /, "") || ret.refund_type;

  return (
    <div className="page-modal-overlay" style={{ zIndex: 1100 }}>
      {/* Print-specific style: hide overlay, show only #return-bill-doc */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #return-bill-doc { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        style={{ background: "#fff", borderRadius: 16, maxWidth: 680, width: "100%", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
      >
        {/* Toolbar */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Return Bill / Credit Note</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            >
              <FaPrint size={12} /> Print
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div id="return-bill-doc" style={{ padding: "32px 36px", fontFamily: "Arial, sans-serif" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 20, borderBottom: "2px solid #ef4444" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", letterSpacing: "-0.5px" }}>
                {company?.company_name || "Company Name"}
              </div>
              {company?.address_line1 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{company.address_line1}</div>
              )}
              {(company?.city_pincode || company?.state) && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>{[company?.city_pincode, company?.state].filter(Boolean).join(", ")}</div>
              )}
              {company?.phone && <div style={{ fontSize: 12, color: "#6b7280" }}>Ph: {company.phone}</div>}
              {company?.gstin && <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginTop: 4 }}>GSTIN: {company.gstin}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#ef4444", textTransform: "uppercase", letterSpacing: "1px" }}>
                Credit Note
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Sales Return</div>
            </div>
          </div>

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <table style={{ fontSize: 13, borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "#6b7280", paddingRight: 12, paddingBottom: 6, whiteSpace: "nowrap" }}>Return No.</td>
                    <td style={{ fontWeight: 700, color: "#1e293b", paddingBottom: 6 }}>{ret.return_number}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#6b7280", paddingRight: 12, paddingBottom: 6 }}>Return Date</td>
                    <td style={{ fontWeight: 600, paddingBottom: 6 }}>{new Date(ret.return_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  </tr>
                  {ret.original_invoice_number && (
                    <tr>
                      <td style={{ color: "#6b7280", paddingRight: 12, paddingBottom: 6, whiteSpace: "nowrap" }}>Orig. Invoice</td>
                      <td style={{ fontWeight: 600, color: "#1d4ed8", paddingBottom: 6 }}>{ret.original_invoice_number}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ color: "#6b7280", paddingRight: 12 }}>Refund Type</td>
                    <td style={{ fontWeight: 600 }}>{refundLabel}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ background: "#fef2f2", borderRadius: 10, padding: "14px 16px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Customer</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                {ret.customer_name || ret.customer_display || "Walk-in Customer"}
              </div>
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#ef4444" }}>
                <th style={{ padding: "9px 12px", textAlign: "left", color: "#fff", fontWeight: 700 }}>#</th>
                <th style={{ padding: "9px 12px", textAlign: "left", color: "#fff", fontWeight: 700 }}>Description</th>
                <th style={{ padding: "9px 12px", textAlign: "right", color: "#fff", fontWeight: 700 }}>Qty</th>
                <th style={{ padding: "9px 12px", textAlign: "right", color: "#fff", fontWeight: 700 }}>Rate (₹)</th>
                <th style={{ padding: "9px 12px", textAlign: "right", color: "#fff", fontWeight: 700 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "9px 12px", color: "#6b7280" }}>{i + 1}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 500 }}>{item.description}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>{item.qty}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>{Number(item.rate).toLocaleString("en-IN")}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>
                    {(item.line_total ?? item.qty * item.rate).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#fef2f2", borderTop: "2px solid #ef4444" }}>
                <td colSpan={4} style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>Total Return Amount</td>
                <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 900, fontSize: 16, color: "#ef4444" }}>
                  {fmt(ret.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Notes */}
          {ret.notes && (
            <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#6b7280", marginBottom: 24 }}>
              <strong>Notes:</strong> {ret.notes}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              This is a computer-generated document.
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 32 }}>Authorized Signatory</div>
              <div style={{ borderTop: "1px solid #374151", width: 140, fontSize: 11, color: "#374151", paddingTop: 4 }}>
                {company?.company_name || ""}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────────────────────── */
const SalesReturns: React.FC = () => {
  const navigate = useNavigate();

  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // ── Create modal ──
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [refundType, setRefundType] = useState("CREDIT_NOTE");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([{ ...EMPTY_ITEM }]);
  const [submitting, setSubmitting] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Edit modal ──
  const [editReturn, setEditReturn] = useState<SalesReturn | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editRefundType, setEditRefundType] = useState("CREDIT_NOTE");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<ReturnItem[]>([{ ...EMPTY_ITEM }]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── View bill ──
  const [viewReturn, setViewReturn] = useState<SalesReturn | null>(null);

  // ── Inspect / grade return items (Good / Mistake / Rejected) ──
  const [inspectReturn, setInspectReturn] = useState<SalesReturn | null>(null);

  // ── Delete confirm ──
  const [deleteConfirm, setDeleteConfirm] = useState<SalesReturn | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Post-submit clear prompt ──
  const [clearDialog, setClearDialog] = useState<ClearDialog | null>(null);
  const [markingCleared, setMarkingCleared] = useState(false);

  /* ── Data fetch ── */
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

  useEffect(() => {
    apiFetch("/company/profile").then(r => r.json()).then(d => setCompanyProfile(d)).catch(() => {});
  }, []);

  /* ── Customer history ── */
  const fetchCustomerHistory = async (customerId: number) => {
    setHistoryLoading(true);
    setCustomerHistory(null);
    try {
      const res = await apiFetch(`/sales-returns/customer-history?customer_id=${customerId}`);
      setCustomerHistory(await res.json());
    } catch {
      setCustomerHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ── Create modal helpers ── */
  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    if (inv.line_items?.length) {
      setItems(inv.line_items.map(li => ({
        product_id: li.product_id, description: li.description || "Item",
        qty: 0, rate: Number(li.unit_price) || 0, max_qty: Number(li.quantity) || 0,
      })));
    } else {
      setItems([{ ...EMPTY_ITEM }]);
    }
    if (inv.customer_id) fetchCustomerHistory(inv.customer_id);
  };

  const totalReturn = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeItems = items.filter(i => Number(i.qty) > 0 && i.description.trim());
    if (!activeItems.length) { alert("Please enter a return quantity (> 0) for at least one item."); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch("/sales-returns", {
        method: "POST",
        body: JSON.stringify({
          original_invoice_id: selectedInvoice?.id || null,
          customer_id: selectedInvoice?.customer_id || null,
          customer_name: selectedInvoice?.customer_name || null,
          return_date: returnDate, items: activeItems, refund_type: refundType, notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const record = await res.json();
      const origInv = selectedInvoice;
      setShowModal(false); resetForm(); load();
      if (origInv) {
        setClearDialog({ returnNumber: record.return_number, invoiceId: origInv.id, invoiceNumber: origInv.invoice_number });
      }
    } catch (err: any) { alert("Error: " + err.message); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setSelectedInvoice(null); setInvoiceSearch(""); setReturnDate(new Date().toISOString().split("T")[0]);
    setRefundType("CREDIT_NOTE"); setNotes(""); setItems([{ ...EMPTY_ITEM }]); setCustomerHistory(null);
  };

  /* ── Edit modal helpers ── */
  const openEdit = (r: SalesReturn) => {
    const storedItems: ReturnItem[] = Array.isArray(r.items) ? r.items
      : (typeof r.items === "string" ? JSON.parse(r.items) : []);
    setEditReturn(r);
    setEditDate(r.return_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
    setEditRefundType(r.refund_type || "CREDIT_NOTE");
    setEditNotes(r.notes || "");
    setEditItems(storedItems.length ? storedItems : [{ ...EMPTY_ITEM }]);
  };

  const editTotal = editItems.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReturn) return;
    const activeItems = editItems.filter(i => Number(i.qty) > 0 && i.description.trim());
    if (!activeItems.length) { alert("Please enter a return quantity (> 0) for at least one item."); return; }
    setEditSubmitting(true);
    try {
      const res = await apiFetch(`/sales-returns/${editReturn.id}`, {
        method: "PUT",
        body: JSON.stringify({ return_date: editDate, items: activeItems, refund_type: editRefundType, notes: editNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setEditReturn(null); load();
    } catch (err: any) { alert("Error: " + err.message); }
    finally { setEditSubmitting(false); }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/sales-returns/${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setDeleteConfirm(null); load();
    } catch (err: any) { alert("Error: " + err.message); }
    finally { setDeleting(false); }
  };

  /* ── Mark invoice cleared ── */
  const handleMarkCleared = async () => {
    if (!clearDialog) return;
    setMarkingCleared(true);
    try {
      await apiFetch(`/sales-returns/mark-invoice-cleared/${clearDialog.invoiceId}`, { method: "POST" });
      setClearDialog(null); load();
    } catch (err: any) { alert("Could not mark invoice as cleared: " + err.message); }
    finally { setMarkingCleared(false); }
  };

  const filteredInvoices = invoices.filter(inv =>
    !invoiceSearch ||
    inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
    (inv.customer_name || "").toLowerCase().includes(invoiceSearch.toLowerCase())
  );

  const totalReturnsAmt = returns.reduce((s, r) => s + Number(r.total_amount), 0);

  /* ── Shared item row renderer ── */
  const renderItemRows = (
    rowItems: ReturnItem[],
    onUpdate: (idx: number, field: keyof ReturnItem, val: string | number) => void,
    onRemove: (idx: number) => void,
    onAdd: () => void,
    rowTotal: number,
  ) => (
    <>
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
            {rowItems.map((item, idx) => (
              <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    required value={item.description}
                    onChange={e => onUpdate(idx, "description", e.target.value)}
                    placeholder="Item description"
                    style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px" }}
                  />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="number" min="0" step="1" required value={item.qty}
                    onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }}
                    max={item.max_qty || undefined}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      if (item.max_qty && val > item.max_qty) return;
                      onUpdate(idx, "qty", val);
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
                    type="number" min="0" step="0.01" required value={item.rate}
                    onChange={e => onUpdate(idx, "rate", Number(e.target.value))}
                    style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", textAlign: "right" }}
                  />
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>
                  {fmt(item.qty * item.rate)}
                </td>
                <td style={{ padding: "6px 4px" }}>
                  {rowItems.length > 1 && (
                    <button type="button" onClick={() => onRemove(idx)}
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
              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#ef4444", fontSize: 15 }}>{fmt(rowTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" onClick={onAdd}
        style={{ background: "none", border: "1px dashed #94a3b8", color: "#64748b", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
        + Add Item
      </button>
    </>
  );

  /* ── Customer history panel ── */
  const renderHistoryPanel = () => (
    <div style={{ border: "1px solid #e0e7ff", borderRadius: 10, marginBottom: 14, overflow: "hidden", background: "#fafafa" }}>
      <div style={{ padding: "8px 14px", background: "#eef2ff", borderBottom: "1px solid #e0e7ff", fontSize: 12, fontWeight: 700, color: "#4338ca", display: "flex", justifyContent: "space-between" }}>
        <span>Customer Purchase History</span>
        {historyLoading && <span style={{ fontWeight: 400, color: "#6b7280" }}>Loading…</span>}
      </div>
      {customerHistory && (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #e0e7ff" }}>
            {[
              { label: "Total Invoiced", val: customerHistory.totalInvoiced, color: "#1e40af" },
              { label: "Total Returned", val: customerHistory.totalReturned, color: "#b91c1c" },
              { label: "Net Balance",    val: customerHistory.netBalance,    color: "#065f46" },
            ].map((kpi, i) => (
              <div key={i} style={{ flex: 1, padding: "10px 14px", borderRight: i < 2 ? "1px solid #e0e7ff" : undefined, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, marginTop: 3 }}>{fmt(kpi.val)}</div>
              </div>
            ))}
          </div>
          {customerHistory.invoices.length > 0 && (
            <div style={{ maxHeight: 150, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["Invoice", "Date", "Amount", "Returned", "Status"].map(h => (
                      <th key={h} style={{ padding: "5px 10px", textAlign: h === "Status" ? "center" : h === "Amount" || h === "Returned" ? "right" : "left", fontWeight: 600, color: "#374151" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerHistory.invoices.map((inv, i) => (
                    <tr key={inv.id} style={{ borderTop: "0.5px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "5px 10px", color: "#1d4ed8", fontWeight: 500 }}>{inv.invoice_number}</td>
                      <td style={{ padding: "5px 10px", color: "#6b7280" }}>{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", color: Number(inv.return_amount) > 0 ? "#b91c1c" : "#9ca3af" }}>
                        {Number(inv.return_amount) > 0 ? fmt(inv.return_amount) : "—"}
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>
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
        <div style={{ padding: "14px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No history available</div>
      )}
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════════ */
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
          <button className="page-btn-round page-btn-round-primary" onClick={() => { resetForm(); setShowModal(true); }}>
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
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: "48px" }}>
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
                      style={{ background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, border: "1px solid #bfdbfe", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
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
                <td style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <button
                      onClick={() => setViewReturn(r)}
                      title="View Return Bill"
                      style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <FaEye size={11} /> View
                    </button>
                    <button
                      onClick={() => setInspectReturn(r)}
                      title="Grade returned items (Good / Mistake / Rejected)"
                      style={{ background: "#fefce8", border: "1px solid #fde68a", color: "#a16207", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <FaCheckCircle size={11} /> Inspect
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      title="Edit Return"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <FaEdit size={11} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(r)}
                      title="Delete Return"
                      style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <FaTrash size={11} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── View Bill Modal ── */}
      <AnimatePresence>
        {viewReturn && (
          <ReturnBillView ret={viewReturn} company={companyProfile} onClose={() => setViewReturn(null)} />
        )}
      </AnimatePresence>

      {/* ── Inspect / Grade Return Modal ── */}
      <AnimatePresence>
        {inspectReturn && (
          <ReturnInspectionModal ret={inspectReturn} onClose={() => setInspectReturn(null)} />
        )}
      </AnimatePresence>

      {/* ── New Return Modal ── */}
      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div
              className="page-modal"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              style={{ maxWidth: 720, width: "100%" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0 }}>Record Sales Return</h2>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <label style={{ fontWeight: 600 }}>Search & Select Invoice (optional)</label>
                <input
                  placeholder="Type invoice number or customer name…"
                  value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                {invoiceSearch && filteredInvoices.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, maxHeight: 180, overflowY: "auto", marginBottom: 12, background: "#fff" }}>
                    {filteredInvoices.slice(0, 10).map(inv => (
                      <div key={inv.id} onClick={() => { handleSelectInvoice(inv); setInvoiceSearch(""); }}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: selectedInvoice?.id === inv.id ? "#eff6ff" : undefined, display: "flex", justifyContent: "space-between" }}>
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
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => navigate(`/invoices/edit/${selectedInvoice.id}`)}
                          style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <FaFileInvoice size={10} /> View Bill <FaExternalLinkAlt size={9} />
                        </button>
                        <button type="button" onClick={() => { setSelectedInvoice(null); setItems([{ ...EMPTY_ITEM }]); setCustomerHistory(null); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><FaTimes size={12} /></button>
                      </div>
                    </div>
                    {selectedInvoice.customer_id && renderHistoryPanel()}
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
                <div style={{ margin: "16px 0 8px", fontWeight: 700, fontSize: 14, color: "#374151" }}>Return Items</div>
                {renderItemRows(
                  items,
                  (idx, field, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it)),
                  (idx) => setItems(prev => prev.filter((_, i) => i !== idx)),
                  () => setItems(prev => [...prev, { ...EMPTY_ITEM }]),
                  totalReturn,
                )}
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

      {/* ── Edit Return Modal ── */}
      <AnimatePresence>
        {editReturn && (
          <div className="page-modal-overlay" style={{ zIndex: 1050 }}>
            <motion.div
              className="page-modal"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              style={{ maxWidth: 700, width: "100%" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0 }}>Edit Return</h2>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{editReturn.return_number}</div>
                </div>
                <button onClick={() => setEditReturn(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes /></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                {/* Original invoice reference (read-only) */}
                {editReturn.original_invoice_number && (
                  <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13 }}>
                      Original Invoice: <strong style={{ color: "#1d4ed8" }}>{editReturn.original_invoice_number}</strong>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>{editReturn.customer_name || editReturn.customer_display}</span>
                    </span>
                    <button type="button" onClick={() => navigate(`/invoices/edit/${editReturn.original_invoice_id}`)}
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <FaFileInvoice size={10} /> View <FaExternalLinkAlt size={9} />
                    </button>
                  </div>
                )}
                <div className="form-grid-2">
                  <div>
                    <label>Return Date</label>
                    <input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label>Refund Type</label>
                    <select value={editRefundType} onChange={e => setEditRefundType(e.target.value)}>
                      {REFUND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ margin: "16px 0 8px", fontWeight: 700, fontSize: 14, color: "#374151" }}>Return Items</div>
                {renderItemRows(
                  editItems,
                  (idx, field, val) => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it)),
                  (idx) => setEditItems(prev => prev.filter((_, i) => i !== idx)),
                  () => setEditItems(prev => [...prev, { ...EMPTY_ITEM }]),
                  editTotal,
                )}
                <label>Notes (optional)</label>
                <input value={editNotes} placeholder="Reason for return…" onChange={e => setEditNotes(e.target.value)} />
                {editRefundType === "CASH_REFUND" && (
                  <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 8 }}>
                    ⚠️ <strong>Cash Refund:</strong> {fmt(editTotal)} will be deducted from Cash balance.
                  </div>
                )}
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setEditReturn(null)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={editSubmitting || editTotal <= 0}>
                    {editSubmitting ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm Dialog ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="page-modal-overlay" style={{ zIndex: 1100 }}>
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}
            >
              <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#111827" }}>Delete Return?</h3>
              <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: 14 }}>
                <strong>{deleteConfirm.return_number}</strong> — {fmt(deleteConfirm.total_amount)}
              </p>
              <p style={{ margin: "0 0 24px", color: "#9ca3af", fontSize: 13 }}>
                This will reverse all ledger entries and restore the original invoice's return amount.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setDeleteConfirm(null)}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  {deleting ? "Deleting…" : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Bill Cleared? Dialog ── */}
      <AnimatePresence>
        {clearDialog && (
          <div className="page-modal-overlay" style={{ zIndex: 1100 }}>
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center" }}
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
                <button onClick={() => setClearDialog(null)}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                  No — Keep Balance
                </button>
                <button onClick={handleMarkCleared} disabled={markingCleared}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
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
