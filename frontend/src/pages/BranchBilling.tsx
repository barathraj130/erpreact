import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "../utils/api";
import { useTenant } from "../context/TenantContext";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBolt, FaBox, FaCalendarCheck, FaInbox, FaPrint, FaWhatsapp,
  FaTrash, FaPlus, FaTimes, FaCheckCircle, FaSearch, FaHistory,
  FaMoneyBillWave, FaUndo, FaListAlt, FaChevronDown,
} from "react-icons/fa";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const inr = (n: any) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const today = () => new Date().toISOString().split("T")[0];

const emptyItem = () => ({
  product_id: null as number | null,
  description: "",
  stock_type: "fresh" as "fresh" | "mistake",
  quantity: 1,
  rate: 0,
  gst_percent: 5,
  taxable_amount: 0,
  gst_amount: 0,
  total: 0,
});

const BILL_TYPES = [
  { key: "non_tax", label: "NON-TAX",    color: "#0891b2" },
  { key: "tax",     label: "TAX INVOICE", color: "#4f46e5" },
  { key: "nsb",     label: "NSB",         color: "#d97706" },
  { key: "retail",  label: "RETAIL",      color: "#059669" },
  { key: "gift",    label: "GIFT",        color: "#7c3aed" },
];

const PAY_MODES = ["cash", "bank", "upi", "credit", "split"];

/* ─── sub-components ───────────────────────────────────────────────────────── */

/* New Customer Modal */
const NewCustomerModal: React.FC<{
  initialName: string;
  onCreated: (c: any) => void;
  onClose: () => void;
}> = ({ initialName, onCreated, onClose }) => {
  const [form, setForm] = useState({
    username: initialName,
    phone: "",
    email: "",
    gstin: "",
    address_line1: "",
    state: "Tamil Nadu",
    state_code: "33",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => {
    const next: any = { ...form, [k]: v };
    if (k === "gstin" && v.length >= 2) {
      const code = v.slice(0, 2);
      next.state_code = code;
    }
    setForm(next);
  };

  const handleCreate = async () => {
    if (!form.username || !form.phone) return alert("Name and phone are required");
    setSaving(true);
    try {
      const res = await apiFetch("/users/create-customer", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        onCreated({ ...data, name: data.name || form.username, phone: form.phone, outstanding_balance: 0 });
        onClose();
      } else if (res.status === 409 && data.id) {
        // duplicate phone — just select existing customer
        onCreated({ id: data.id, name: form.username, phone: form.phone, outstanding_balance: 0 });
        onClose();
      } else {
        alert(data.error || "Failed to create customer");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={OVERLAY}>
      <div style={{ ...MODAL, width: 480 }}>
        <div style={MODAL_HEADER}>
          <span style={{ fontWeight: 800, fontSize: 17 }}>New Customer</span>
          <button onClick={onClose} style={ICON_BTN}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "Name *", key: "username", span: 2 },
            { label: "Phone *", key: "phone" },
            { label: "Email", key: "email" },
            { label: "GSTIN", key: "gstin" },
            { label: "State Code", key: "state_code" },
            { label: "Address", key: "address_line1", span: 2 },
          ].map(({ label, key, span }: any) => (
            <div key={key} style={{ gridColumn: span === 2 ? "1/-1" : undefined }}>
              <label style={FIELD_LABEL}>{label}</label>
              <input
                value={(form as any)[key]}
                onChange={e => set(key, e.target.value)}
                style={FIELD_INPUT}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={BTN_GHOST}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={BTN_PRIMARY}>
            {saving ? "Creating…" : "Create & Select"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* Customer Ledger Modal */
const CustomerLedgerModal: React.FC<{ customer: any; onClose: () => void }> = ({ customer, onClose }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [period, setPeriod] = useState<"month" | "3m" | "all">("month");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = period === "all" ? "2000-01-01"
        : period === "3m" ? new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0]
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const res = await apiFetch(`/users/${customer.id}/ledger?start_date=${from}&end_date=${today()}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } finally { setLoading(false); }
  }, [customer.id, period]);

  useEffect(() => { load(); }, [load]);

  const balance = entries.reduce((s, e) => s + (e.debit || 0) - (e.credit || 0), 0);

  return (
    <div style={OVERLAY}>
      <div style={{ ...MODAL, width: 700, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={MODAL_HEADER}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{customer.name} — Ledger</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{customer.phone}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(["month", "3m", "all"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ ...BTN_GHOST, padding: "4px 12px", fontSize: 12,
                  background: period === p ? "#4f46e5" : "transparent",
                  color: period === p ? "#fff" : "#94a3b8",
                  border: `1px solid ${period === p ? "#4f46e5" : "#475569"}` }}>
                {p === "month" ? "This Month" : p === "3m" ? "3 Months" : "All Time"}
              </button>
            ))}
            <button onClick={onClose} style={ICON_BTN}>×</button>
          </div>
        </div>

        <div style={{ padding: "12px 24px", background: balance > 0 ? "#fee2e2" : "#d1fae5", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>Outstanding Balance</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: balance > 0 ? "#dc2626" : "#059669" }}>₹{inr(Math.abs(balance))}</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading…</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f172a", color: "#94a3b8", fontSize: 11 }}>
                  {["Date", "Type", "Reference", "Debit (₹)", "Credit (₹)", "Balance"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h.includes("₹") ? "right" : "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const runBalance = entries.slice(0, i + 1).reduce((s, x) => s + (x.debit || 0) - (x.credit || 0), 0);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #1e293b", background: i % 2 ? "#0f172a" : "#1a2535" }}>
                      <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{e.date ? new Date(e.date).toLocaleDateString("en-IN") : "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: e.type === "invoice" ? "#1e3a5f" : "#14532d",
                          color: e.type === "invoice" ? "#60a5fa" : "#4ade80" }}>
                          {e.type === "invoice" ? "INVOICE" : "PAYMENT"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#f1f5f9", fontWeight: 600 }}>{e.ref || "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#f87171" }}>{e.debit > 0 ? inr(e.debit) : "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#4ade80" }}>{e.credit > 0 ? inr(e.credit) : "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: runBalance > 0 ? "#f87171" : "#4ade80" }}>₹{inr(Math.abs(runBalance))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

/* Print Modal */
const PrintModal: React.FC<{ bill: any; customer: any; branchName: string; onClose: () => void }> = ({ bill, customer, branchName, onClose }) => {
  const isTax = bill?.bill_type === "tax";

  const printContent = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice ${bill?.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 13px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .header h2 { margin: 0; font-size: 18px; } .header p { margin: 2px 0; color: #555; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
        th { background: #f0f0f0; }
        .total-row { font-weight: bold; background: #f9f9f9; }
        .net-total { font-size: 15px; font-weight: 900; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #777; border-top: 1px solid #ccc; padding-top: 10px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="header">
        <h2>JBS KNIT WEAR</h2>
        <p>Tiruppur, Tamil Nadu | GSTIN: 33XXXXXXXXXXXXX</p>
        <p><b>${isTax ? "TAX INVOICE" : bill?.bill_type?.toUpperCase() || "INVOICE"}</b> — ${branchName}</p>
      </div>
      <table><tr><td><b>Invoice #:</b> ${bill?.invoice_number || "—"}</td><td><b>Date:</b> ${bill?.invoice_date || today()}</td></tr>
      <tr><td><b>Customer:</b> ${customer?.name || "—"}</td><td><b>Phone:</b> ${customer?.phone || "—"}</td></tr>
      ${customer?.gstin ? `<tr><td colspan="2"><b>GSTIN:</b> ${customer.gstin}</td></tr>` : ""}</table>
      <table><thead><tr><th>#</th><th>Item</th><th>Stock</th><th>Qty</th><th>Rate</th>${isTax ? "<th>GST%</th><th>GST ₹</th>" : ""}<th>Amount</th></tr></thead>
      <tbody>${(bill?.items || []).map((item: any, i: number) => `
        <tr><td>${i + 1}</td><td>${item.description}</td><td>${item.stock_type || "Fresh"}</td>
        <td>${item.quantity}</td><td>₹${inr(item.rate)}</td>
        ${isTax ? `<td>${item.gst_percent}%</td><td>₹${inr(item.gst_amount)}</td>` : ""}
        <td>₹${inr(item.total)}</td></tr>`).join("")}
      </tbody></table>
      <table>
        <tr><td>Taxable Amount</td><td style="text-align:right">₹${inr(bill?.taxable_total)}</td></tr>
        ${isTax ? `<tr><td>GST</td><td style="text-align:right">₹${inr(bill?.gst_total)}</td></tr>` : ""}
        ${bill?.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-₹${inr(bill?.discount)}</td></tr>` : ""}
        <tr class="net-total total-row"><td>NET TOTAL</td><td style="text-align:right">₹${inr(bill?.net_total)}</td></tr>
        <tr><td>Paid</td><td style="text-align:right">₹${inr(bill?.paid_amount)}</td></tr>
        <tr><td>Balance Due</td><td style="text-align:right; color:${bill?.balance > 0 ? "red" : "green"}">₹${inr(bill?.balance)}</td></tr>
      </table>
      <div class="footer">Thank you for your business!<br/>JBS Knit Wear — ${branchName}</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div style={OVERLAY}>
      <div style={{ ...MODAL, width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <FaCheckCircle size={40} color="#10b981" />
          <div style={{ fontWeight: 900, fontSize: 20, marginTop: 10, color: "#f1f5f9" }}>Bill Saved!</div>
          <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
            {bill?.invoice_number} — ₹{inr(bill?.net_total)}
          </div>
          {bill?.balance > 0 && (
            <div style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>
              Balance Due: ₹{inr(bill?.balance)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={printContent}
            style={{ flex: 1, ...BTN_PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FaPrint /> Print
          </button>
          <button
            onClick={() => {
              const msg = `Hello ${customer?.name || ""}! Bill ${bill?.invoice_number} — ₹${inr(bill?.net_total)}. Balance: ₹${inr(bill?.balance)}. JBS Knit Wear`;
              window.open(`https://wa.me/${(customer?.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
            }}
            style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: "#25d366", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FaWhatsapp /> WhatsApp
          </button>
        </div>
        <button onClick={onClose}
          style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: "#94a3b8", fontWeight: 600, cursor: "pointer" }}>
          New Bill (Esc)
        </button>
      </div>
    </div>
  );
};

/* ─── style constants ──────────────────────────────────────────────────────── */
const BG    = "#0f172a";
const PANEL = "#1e293b";
const BORDER = "1px solid #334155";
const TEXT  = "#f1f5f9";
const MUTED = "#94a3b8";

const OVERLAY: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16,
};
const MODAL: React.CSSProperties = {
  background: "#1e293b", borderRadius: 14, padding: "24px 28px",
  boxShadow: "0 32px 80px rgba(0,0,0,0.5)", color: TEXT, width: 480, overflow: "auto",
};
const MODAL_HEADER: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
};
const FIELD_LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: MUTED,
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5,
};
const FIELD_INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #475569",
  background: "#0f172a", color: TEXT, fontSize: 14, outline: "none", boxSizing: "border-box",
};
const BTN_PRIMARY: React.CSSProperties = {
  flex: 1, padding: "12px", borderRadius: 8, border: "none",
  background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
};
const BTN_GHOST: React.CSSProperties = {
  flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #475569",
  background: "transparent", color: TEXT, fontWeight: 600, fontSize: 14, cursor: "pointer",
};
const ICON_BTN: React.CSSProperties = {
  background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 20, padding: 4,
};

/* ─── main component ───────────────────────────────────────────────────────── */
const BranchBilling: React.FC = () => {
  const navigate = useNavigate();
  const { activeBranch } = useTenant();
  const { user } = useAuthUser();
  const branchId = activeBranch?.id || user?.branch_id || 0;

  /* mode */
  type Mode = "billing" | "payment" | "return" | "today_bills" | "inventory" | "day_close";
  const [mode, setMode] = useState<Mode>("billing");

  /* customer */
  const [customer, setCustomer]           = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showCustLedger, setShowCustLedger]   = useState(false);

  /* bill */
  const [billType, setBillType] = useState<string>("non_tax");
  const [items, setItems]       = useState([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes]       = useState("");

  /* payment */
  const [payMode, setPayMode]     = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");

  /* balances */
  const [cashBal, setCashBal] = useState(0);
  const [bankBal, setBankBal] = useState(0);

  /* products */
  const [products, setProducts]       = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");

  /* save */
  const [saving, setSaving]         = useState(false);
  const [lastBill, setLastBill]     = useState<any>(null);
  const [showPrint, setShowPrint]   = useState(false);
  const [flash, setFlash]           = useState("");

  /* today bills */
  const [todayBills, setTodayBills]   = useState<any[]>([]);
  const [billsFilter, setBillsFilter] = useState<"all" | "cash" | "bank" | "credit">("all");

  /* receive payment mode */
  const [payCustomer, setPayCustomer]       = useState<any>(null);
  const [payCustomerSearch, setPayCustomerSearch] = useState("");
  const [payCustomerResults, setPayCustomerResults] = useState<any[]>([]);
  const [outstandingInvs, setOutstandingInvs] = useState<any[]>([]);
  const [receiveAmount, setReceiveAmount]     = useState("");
  const [receiveMode, setReceiveMode]         = useState("cash");
  const [receivingSaving, setReceivingSaving] = useState(false);

  /* return mode */
  const [returnSearch, setReturnSearch]     = useState("");
  const [returnInvoice, setReturnInvoice]   = useState<any>(null);
  const [returnItems, setReturnItems]       = useState<any[]>([]);
  const [returnReason, setReturnReason]     = useState("");
  const [returnRefund, setReturnRefund]     = useState("cash");
  const [returnSaving, setReturnSaving]     = useState(false);

  /* day close */
  const [actualCash, setActualCash]   = useState("");
  const [dcNotes, setDcNotes]         = useState("");
  const [dcSummary, setDcSummary]     = useState<any>(null);
  const [dcSaving, setDcSaving]       = useState(false);

  /* inventory */
  const [inventorySearch, setInventorySearch] = useState("");

  /* stock requests */
  const [requests, setRequests] = useState<any[]>([]);

  /* refs */
  const productSearchRef = useRef<HTMLInputElement>(null);
  const payAmountRef     = useRef<HTMLInputElement>(null);
  const custSearchRef    = useRef<HTMLInputElement>(null);

  /* ── fetch helpers ─────────────────────────────────────────────────────── */
  const fetchBalances = useCallback(async () => {
    try {
      // branch-scoped: JWT branch_id is used server-side, no param needed
      const res = await apiFetch("/branches/billing/balances");
      if (res.ok) { const d = await res.json(); setCashBal(d.cash || 0); setBankBal(d.bank || 0); }
    } catch {}
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiFetch("/branches/billing/inventory");
      if (res.ok) setProducts(await res.json());
    } catch {}
  }, []);

  const fetchTodayBills = useCallback(async () => {
    try {
      const res = await apiFetch(`/branches/billing/today-bills?date=${today()}`);
      if (res.ok) setTodayBills(await res.json());
    } catch {}
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch("/branch-inventory/my-requests");
      if (res.ok) setRequests(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchBalances();
    fetchProducts();
    fetchRequests();
    const interval = setInterval(fetchBalances, 60000);
    return () => clearInterval(interval);
  }, [fetchBalances, fetchProducts, fetchRequests]);

  useEffect(() => {
    if (mode === "today_bills") fetchTodayBills();
    if (mode === "day_close") fetchDaySummary();
  }, [mode]);

  /* ── customer search ───────────────────────────────────────────────────── */
  const searchTimeout = useRef<any>(null);
  const handleCustomerSearch = (q: string) => {
    setCustomerSearch(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setCustomerResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setCustomerResults(await res.json());
      } catch {}
    }, 250);
  };

  const selectCustomer = (c: any) => {
    setCustomer({ ...c, name: c.name || c.username });
    setCustomerSearch("");
    setCustomerResults([]);
    setTimeout(() => productSearchRef.current?.focus(), 100);
  };

  /* generic customer search for payment/other modes */
  const searchCustomerFor = async (q: string, setResults: (r: any[]) => void) => {
    if (!q.trim()) { setResults([]); return; }
    try {
      const res = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } catch {}
  };

  /* ── item helpers ──────────────────────────────────────────────────────── */
  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const u: any = { ...item, [field]: value };
      const qty  = parseFloat(u.quantity || 0);
      const rate = parseFloat(u.rate || 0);
      const gst  = parseFloat(u.gst_percent || 0);
      u.taxable_amount = qty * rate;
      u.gst_amount = billType === "tax" ? (u.taxable_amount * gst / 100) : 0;
      u.total = u.taxable_amount + u.gst_amount;
      return u;
    }));
  };

  const addProductToItems = (p: any) => {
    setItems(prev => {
      const exists = prev.findIndex(it => it.product_id === p.product_id);
      if (exists >= 0) {
        return prev.map((it, i) => {
          if (i !== exists) return it;
          const u: any = { ...it, quantity: it.quantity + 1 };
          u.taxable_amount = u.quantity * u.rate;
          u.gst_amount = billType === "tax" ? (u.taxable_amount * u.gst_percent / 100) : 0;
          u.total = u.taxable_amount + u.gst_amount;
          return u;
        });
      }
      const newItem: any = {
        product_id: p.product_id,
        description: p.name,
        stock_type: "fresh",
        quantity: 1,
        rate: parseFloat(p.selling_price || 0),
        gst_percent: parseFloat(p.gst_percent || 5),
        taxable_amount: parseFloat(p.selling_price || 0),
        gst_amount: billType === "tax" ? parseFloat(p.selling_price || 0) * (parseFloat(p.gst_percent || 5) / 100) : 0,
        total: parseFloat(p.selling_price || 0),
      };
      newItem.total = newItem.taxable_amount + newItem.gst_amount;
      // Remove empty placeholder row if present
      const cleaned = prev.filter(it => it.description || it.product_id);
      return [...cleaned, newItem];
    });
    setProductSearch("");
    productSearchRef.current?.focus();
  };

  /* ── totals ────────────────────────────────────────────────────────────── */
  const totals = useMemo(() => {
    const taxable = items.reduce((s, it) => s + (it.taxable_amount || 0), 0);
    const gst     = items.reduce((s, it) => s + (it.gst_amount || 0), 0);
    const net     = taxable + gst - (discount || 0);
    const paid    = payMode === "split"
      ? (parseFloat(cashAmount || "0") + parseFloat(bankAmount || "0"))
      : parseFloat(paidAmount || "0");
    const balance = Math.max(0, net - paid);
    return { taxable, gst, net, paid, balance };
  }, [items, discount, payMode, paidAmount, cashAmount, bankAmount]);

  /* recalculate gst when bill type changes */
  useEffect(() => {
    setItems(prev => prev.map(item => {
      const u: any = { ...item };
      u.gst_amount = billType === "tax" ? (u.taxable_amount * u.gst_percent / 100) : 0;
      u.total = u.taxable_amount + u.gst_amount;
      return u;
    }));
  }, [billType]);

  /* ── save bill ─────────────────────────────────────────────────────────── */
  const handleSaveBill = async () => {
    if (!customer) { custSearchRef.current?.focus(); return setFlash("Select a customer first"); }
    const validItems = items.filter(it => it.description && it.quantity > 0 && it.rate > 0);
    if (!validItems.length) { productSearchRef.current?.focus(); return setFlash("Add at least one item"); }

    setSaving(true);
    try {
      const payload = {
        bill_type: billType,
        invoice_type: billType.toUpperCase(),
        customer_id: customer.id,
        branch_id: branchId,
        invoice_date: today(),
        items: validItems.map(it => ({
          product_id: it.product_id,
          description: it.description,
          stock_type: it.stock_type,
          quantity: it.quantity,
          unit_price: it.rate,
          rate: it.rate,
          tax_percent: billType === "tax" ? it.gst_percent : 0,
          gst_percent: billType === "tax" ? it.gst_percent : 0,
          taxable_value: it.taxable_amount,
          gst_amount: it.gst_amount,
          line_total: it.total,
        })),
        payment_mode: payMode === "split" ? "SPLIT" : payMode.toUpperCase(),
        paid_amount:  totals.paid,
        cash_amount:  payMode === "split" ? parseFloat(cashAmount || "0") : (payMode === "cash" ? totals.paid : 0),
        bank_amount:  payMode === "split" ? parseFloat(bankAmount || "0") : (payMode === "bank" ? totals.paid : 0),
        discount_amount: discount,
        notes,
        source: "BRANCH_BILLING",
      };

      const res = await apiFetch("/invoice", { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();

      if (res.ok) {
        const savedBill = {
          invoice_number: data.bill_number || data.invoice_number || data.id,
          invoice_date: today(),
          bill_type: billType,
          items: validItems,
          taxable_total: totals.taxable,
          gst_total: totals.gst,
          net_total: totals.net,
          paid_amount: totals.paid,
          balance: totals.balance,
          discount,
        };
        setLastBill(savedBill);
        setShowPrint(true);
        clearBill();
        fetchBalances();
        fetchTodayBills();
      } else {
        setFlash(data.error || "Failed to save bill");
      }
    } catch (err: any) {
      setFlash("System error — check connection");
    } finally {
      setSaving(false);
    }
  };

  const clearBill = () => {
    setCustomer(null);
    setCustomerSearch("");
    setItems([emptyItem()]);
    setDiscount(0);
    setNotes("");
    setPaidAmount("");
    setCashAmount("");
    setBankAmount("");
    setPayMode("cash");
    setBillType("non_tax");
    setFlash("");
    setTimeout(() => custSearchRef.current?.focus(), 100);
  };

  /* ── receive payment ───────────────────────────────────────────────────── */
  const fetchOutstanding = async (cust: any) => {
    try {
      const res = await apiFetch(`/invoice?customer_id=${cust.id}`);
      if (res.ok) {
        const all = await res.json();
        setOutstandingInvs(all.filter((inv: any) => parseFloat(inv.balance_amount || 0) > 0 || inv.status === "PENDING"));
      }
    } catch {}
  };

  const handleReceivePayment = async () => {
    if (!payCustomer || !receiveAmount) return;
    if (!outstandingInvs.length) { setFlash("No outstanding invoices for this customer"); return; }
    setReceivingSaving(true);
    let remaining = parseFloat(receiveAmount);
    try {
      for (const inv of outstandingInvs) {
        if (remaining <= 0) break;
        const invBal = parseFloat(inv.balance_amount || 0) || parseFloat(inv.total_amount || 0);
        const paying = Math.min(remaining, invBal);
        const res = await apiFetch("/payments", {
          method: "POST",
          body: JSON.stringify({ invoice_id: inv.id, amount: paying, payment_method: receiveMode.toUpperCase() }),
        });
        if (!res.ok) { const d = await res.json(); setFlash(d.error || "Payment failed"); setReceivingSaving(false); return; }
        remaining -= paying;
      }
      setFlash(`₹${inr(receiveAmount)} received from ${payCustomer.name}`);
      setPayCustomer(null); setPayCustomerSearch(""); setReceiveAmount(""); setOutstandingInvs([]);
      fetchBalances();
    } catch {
      setFlash("Payment failed — check connection");
    } finally { setReceivingSaving(false); }
  };

  /* ── return ────────────────────────────────────────────────────────────── */
  const searchReturnInvoice = async () => {
    if (!returnSearch.trim()) return;
    try {
      const res = await apiFetch(`/invoice?search=${encodeURIComponent(returnSearch)}`);
      if (res.ok) {
        const data = await res.json();
        const inv = data[0];
        if (inv) {
          setReturnInvoice(inv);
          setReturnItems((inv.line_items || []).map((li: any) => ({ ...li, return_qty: 0 })));
        } else { setFlash("Invoice not found"); }
      }
    } catch {}
  };

  const handleProcessReturn = async () => {
    if (!returnInvoice) return;
    const returnableItems = returnItems.filter(ri => ri.return_qty > 0);
    if (!returnableItems.length) return setFlash("Select items to return");
    setReturnSaving(true);
    try {
      const res = await apiFetch("/sales-returns", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: returnInvoice.id,
          customer_id: returnInvoice.customer_id,
          branch_id: branchId,
          reason: returnReason,
          refund_mode: returnRefund.toUpperCase(),
          items: returnableItems.map(ri => ({
            product_id: ri.product_id,
            quantity: ri.return_qty,
            unit_price: ri.unit_price || ri.rate,
          })),
        }),
      });
      if (res.ok) {
        setFlash("Return processed successfully");
        setReturnInvoice(null); setReturnItems([]); setReturnSearch("");
        fetchBalances();
      } else {
        const d = await res.json();
        setFlash(d.error || "Return failed");
      }
    } finally { setReturnSaving(false); }
  };

  /* ── day close ─────────────────────────────────────────────────────────── */
  const fetchDaySummary = async () => {
    try {
      const res = await apiFetch(`/branches/billing/day-summary?date=${today()}`);
      if (res.ok) {
        const d = await res.json();
        setDcSummary(d);
        if (!actualCash) setActualCash(String(Math.round(d.cash || 0)));
      }
    } catch {}
  };

  const handleDayClose = async () => {
    if (!actualCash) return setFlash("Enter actual cash in hand");
    setDcSaving(true);
    try {
      const expected = dcSummary?.cash || 0;
      const actual   = parseFloat(actualCash || "0");
      const res = await apiFetch("/branches/billing/day-close", {
        method: "POST",
        body: JSON.stringify({
          date: today(),
          expected_cash: expected,
          actual_cash: actual,
          cash_difference: actual - expected,
          bank_balance: dcSummary?.bank || 0,
          today_sales: dcSummary?.today_sales || 0,
          cash_collected: dcSummary?.cash_collected || 0,
          bank_collected: dcSummary?.bank_collected || 0,
          credit_given: dcSummary?.credit_given || 0,
          bills_count: dcSummary?.bills_count || 0,
          notes: dcNotes,
        }),
      });
      if (res.ok) { setFlash("Day close submitted successfully"); setDcSummary((p: any) => ({ ...p, submitted: true })); }
      else setFlash("Day close failed");
    } finally { setDcSaving(false); }
  };

  /* ── keyboard shortcuts ────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2")  { e.preventDefault(); productSearchRef.current?.focus(); }
      if (e.key === "F8")  { e.preventDefault(); payAmountRef.current?.focus(); }
      if (e.key === "F9")  { e.preventDefault(); handleSaveBill(); }
      if (e.key === "F10") { e.preventDefault(); if (lastBill) setShowPrint(true); }
      if (e.key === "Escape") {
        if (showPrint) { setShowPrint(false); return; }
        if (showNewCustomer) { setShowNewCustomer(false); return; }
        if (showCustLedger) { setShowCustLedger(false); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastBill, showPrint, showNewCustomer, showCustLedger, customer, items, payMode, paidAmount]);

  /* flash auto-dismiss */
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const pendingRequests = requests.filter(r => r.status === "PENDING").length;

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())),
    [products, productSearch]
  );

  const filteredTodayBills = useMemo(() => {
    if (billsFilter === "all") return todayBills;
    if (billsFilter === "credit") return todayBills.filter(b => parseFloat(b.balance_amount || 0) > 0);
    return todayBills.filter(b => (b.payment_mode || "").toLowerCase().includes(billsFilter));
  }, [todayBills, billsFilter]);

  const todaySummary = useMemo(() => ({
    total: todayBills.length,
    cash:  todayBills.filter(b => (b.payment_mode || "CASH").toUpperCase() === "CASH").reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0),
    bank:  todayBills.filter(b => ["BANK","UPI"].includes((b.payment_mode || "").toUpperCase())).reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0),
    credit: todayBills.filter(b => parseFloat(b.balance_amount || 0) > 0).length,
    total_amt: todayBills.reduce((s, b) => s + parseFloat(b.grand_total || 0), 0),
  }), [todayBills]);

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ height: "100vh", background: BG, display: "flex", flexDirection: "column", overflow: "hidden", color: TEXT, fontFamily: "Inter, sans-serif" }}>

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header style={{ height: 64, background: "#1e293b", borderBottom: BORDER, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, zIndex: 100 }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#4f46e5,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16 }}>
            {activeBranch?.branch_name?.[0] || "B"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{activeBranch?.branch_name || "Branch"}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
          </div>
        </div>

        {/* Mode tabs */}
        <nav style={{ display: "flex", gap: 2, background: "#0f172a", borderRadius: 10, padding: 4 }}>
          {[
            { id: "billing",     label: "New Bill",   icon: <FaBolt size={12} /> },
            { id: "payment",     label: "Receive ₹",  icon: <FaMoneyBillWave size={12} /> },
            { id: "return",      label: "Return",     icon: <FaUndo size={12} /> },
            { id: "today_bills", label: "Today's Bills", icon: <FaListAlt size={12} /> },
            { id: "inventory",   label: "Inventory",  icon: <FaBox size={12} /> },
            { id: "day_close",   label: "Day Close",  icon: <FaCalendarCheck size={12} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMode(tab.id as Mode)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: "none",
                background: mode === tab.id ? "#4f46e5" : "transparent",
                color: mode === tab.id ? "#fff" : MUTED,
                fontWeight: mode === tab.id ? 700 : 500, fontSize: 12.5, cursor: "pointer", transition: "0.15s" }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>

        {/* Cash/Bank display */}
        <div style={{ display: "flex", gap: 20, marginLeft: "auto", alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>CASH</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#10b981" }}>₹{inr(cashBal)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>BANK</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#3b82f6" }}>₹{inr(bankBal)}</div>
          </div>
          <div style={{ width: 1, height: 32, background: "#334155" }} />
          <button onClick={() => navigate("/inventory/requests")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
              background: pendingRequests > 0 ? "#450a0a" : "#0f172a",
              color: pendingRequests > 0 ? "#f87171" : MUTED,
              border: `1px solid ${pendingRequests > 0 ? "#dc2626" : "#334155"}`,
              fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            <FaInbox size={12} /> {pendingRequests > 0 ? `${pendingRequests} Pending` : "Stock Inbox"}
          </button>
          <button onClick={() => navigate("/dashboard")}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: MUTED, fontSize: 12, cursor: "pointer" }}>
            Exit
          </button>
        </div>
      </header>

      {/* ── FLASH MESSAGE ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)",
              background: flash.includes("first") || flash.includes("fail") || flash.includes("error") ? "#7f1d1d" : "#14532d",
              color: "#fff", padding: "10px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14,
              zIndex: 1500, boxShadow: "0 8px 20px rgba(0,0,0,0.4)" }}>
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BILLING MODE ─────────────────────────────────────────────────── */}
      {mode === "billing" && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 420px", overflow: "hidden" }}>

          {/* LEFT — Customer + Items */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 20px 0 20px", gap: 14 }}>

            {/* Customer row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.06em", marginBottom: 6 }}>CUSTOMER *</div>
                {!customer ? (
                  <div style={{ position: "relative" }}>
                    <input
                      ref={custSearchRef}
                      autoFocus
                      type="text"
                      placeholder="Search by name or phone…"
                      value={customerSearch}
                      onChange={e => handleCustomerSearch(e.target.value)}
                      style={{ ...FIELD_INPUT, border: "2px solid #4f46e5", fontSize: 15, padding: "12px 16px" }}
                    />
                    {customerSearch.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#0f172a", border: "1px solid #4f46e5", borderRadius: 10, zIndex: 500, maxHeight: 320, overflowY: "auto", marginTop: 4, boxShadow: "0 16px 40px rgba(0,0,0,0.8)" }}>
                        {customerResults.map(c => (
                          <div key={c.id} onClick={() => selectCustomer(c)}
                            style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #1e293b", backgroundColor: "transparent" }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e293b")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                              {c.phone}
                              {parseFloat(c.outstanding_balance || 0) > 0 &&
                                <span style={{ color: "#f87171", marginLeft: 8 }}>· Due ₹{inr(c.outstanding_balance)}</span>}
                            </div>
                          </div>
                        ))}
                        {customerResults.length === 0 && (
                          <div style={{ padding: "10px 16px", color: MUTED, fontSize: 13 }}>No customer found</div>
                        )}
                        <div onClick={() => { setShowNewCustomer(true); setCustomerResults([]); }}
                          style={{ padding: "12px 16px", cursor: "pointer", color: "#818cf8", fontWeight: 700, fontSize: 13, borderTop: "1px solid #1e293b", backgroundColor: "transparent" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e293b")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                          + Create new "{customerSearch}"
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "12px 16px", background: PANEL, borderRadius: 10, border: "2px solid #10b981", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{customer.name}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        {customer.phone}
                        {customer.gstin && ` · ${customer.gstin}`}
                        {parseFloat(customer.outstanding_balance || 0) > 0 &&
                          <span style={{ color: "#f87171", marginLeft: 8 }}>Outst: ₹{inr(customer.outstanding_balance)}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowCustLedger(true)}
                        style={{ padding: "5px 10px", background: "transparent", border: "1px solid #475569", color: MUTED, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                        <FaHistory size={10} /> Ledger
                      </button>
                      <button onClick={() => { setCustomer(null); setCustomerSearch(""); }}
                        style={{ ...ICON_BTN, fontSize: 18 }}>×</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bill type */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.06em", marginBottom: 6 }}>BILL TYPE</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {BILL_TYPES.map(bt => (
                    <button key={bt.key} onClick={() => setBillType(bt.key)}
                      style={{ padding: "7px 11px", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
                        border: `2px solid ${billType === bt.key ? bt.color : "#475569"}`,
                        background: billType === bt.key ? bt.color : "transparent",
                        color: "#fff", cursor: "pointer", transition: "0.15s" }}>
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Product search */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", background: PANEL, border: "2px solid #334155", borderRadius: 10, padding: "0 14px" }}>
                <FaSearch size={14} color="#4f46e5" />
                <input
                  ref={productSearchRef}
                  type="text"
                  placeholder="Search product (F2) or scan barcode…"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && filteredProducts.length > 0) { addProductToItems(filteredProducts[0]); } }}
                  style={{ flex: 1, background: "transparent", border: "none", color: TEXT, fontSize: 14, padding: "12px 0", outline: "none" }}
                />
              </div>
              {productSearch && filteredProducts.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#0f172a", border: "1px solid #4f46e5", borderRadius: 10, zIndex: 500, maxHeight: 280, overflowY: "auto", marginTop: 4, boxShadow: "0 16px 40px rgba(0,0,0,0.8)" }}>
                  {filteredProducts.slice(0, 10).map(p => (
                    <div key={p.product_id} onClick={() => addProductToItems(p)}
                      style={{ padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", backgroundColor: "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e293b")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>Stock: {p.fresh_stock ?? p.current_stock ?? 0} | GST: {p.gst_percent || 5}%</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#10b981" }}>₹{inr(p.selling_price)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items table */}
            <div style={{ flex: 1, overflowY: "auto", background: PANEL, borderRadius: 12, border: BORDER }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", background: "#0f172a", position: "sticky", top: 0, zIndex: 1 }}>
                    {["#", "Product", "Stock", "Qty", "Rate ₹", "GST%", "Amount", ""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: h === "Amount" ? "right" : "left", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "10px 12px", color: MUTED, fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ padding: "10px 12px", minWidth: 160 }}>
                        <input
                          value={item.description}
                          onChange={e => updateItem(idx, "description", e.target.value)}
                          placeholder="Item name…"
                          style={{ background: "transparent", border: "none", color: TEXT, fontSize: 13, fontWeight: 600, outline: "none", width: "100%" }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["fresh", "mistake"] as const).map(st => (
                            <button key={st} onClick={() => updateItem(idx, "stock_type", st)}
                              style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, border: "1px solid",
                                borderColor: item.stock_type === st ? (st === "fresh" ? "#10b981" : "#f59e0b") : "#475569",
                                background: item.stock_type === st ? (st === "fresh" ? "#064e3b" : "#451a03") : "transparent",
                                color: item.stock_type === st ? (st === "fresh" ? "#10b981" : "#f59e0b") : MUTED,
                                cursor: "pointer" }}>
                              {st === "fresh" ? "Fresh" : "Mstk"}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <input
                          type="number" min={1} value={item.quantity}
                          onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                          style={{ width: 60, padding: "5px 8px", borderRadius: 6, border: "1px solid #475569", background: "#0f172a", color: TEXT, fontSize: 13, textAlign: "center", outline: "none" }}
                        />
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <input
                          type="number" min={0} value={item.rate || ""}
                          onChange={e => updateItem(idx, "rate", parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid #475569", background: "#0f172a", color: TEXT, fontSize: 13, textAlign: "right", outline: "none" }}
                        />
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {billType === "tax" ? (
                          <input
                            type="number" min={0} value={item.gst_percent}
                            onChange={e => updateItem(idx, "gst_percent", parseFloat(e.target.value) || 0)}
                            style={{ width: 50, padding: "5px 8px", borderRadius: 6, border: "1px solid #475569", background: "#0f172a", color: TEXT, fontSize: 13, textAlign: "center", outline: "none" }}
                          />
                        ) : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                        ₹{inr(item.total)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <button onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}>
                          <FaTrash size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setItems([...items, emptyItem()])}
                style={{ width: "100%", padding: "12px", background: "transparent", border: "none", color: "#818cf8", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FaPlus size={11} /> Add Row
              </button>
            </div>

            {/* Notes */}
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…"
              style={{ ...FIELD_INPUT, marginBottom: 16 }} />
          </div>

          {/* RIGHT — Bill Summary + Payment */}
          <div style={{ background: PANEL, borderLeft: BORDER, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Summary header */}
            <div style={{ padding: "16px 20px", borderBottom: BORDER }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Bill Summary</div>
              {customer && <div style={{ fontSize: 12, color: "#10b981" }}>{customer.name}</div>}
              <div style={{ fontSize: 11, color: MUTED }}>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>

            {/* Items list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
              {items.filter(it => it.description && it.quantity > 0).map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: MUTED }}>{it.description} × {it.quantity} @ {inr(it.rate)}</span>
                  <span style={{ fontWeight: 600 }}>₹{inr(it.total)}</span>
                </div>
              ))}
            </div>

            {/* Totals + Payment */}
            <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Totals */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}>
                  <span>Taxable</span><span>₹{inr(totals.taxable)}</span>
                </div>
                {billType === "tax" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}>
                      <span>CGST</span><span>₹{inr(totals.gst / 2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}>
                      <span>SGST</span><span>₹{inr(totals.gst / 2)}</span>
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED, alignItems: "center" }}>
                  <span>Discount</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span>₹</span>
                    <input type="number" min={0} value={discount || ""} placeholder="0"
                      onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                      style={{ width: 70, padding: "3px 6px", borderRadius: 5, border: "1px solid #475569", background: "#0f172a", color: TEXT, fontSize: 13, textAlign: "right", outline: "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 900, borderTop: BORDER, paddingTop: 10 }}>
                  <span>NET TOTAL</span><span style={{ color: "#10b981" }}>₹{inr(totals.net)}</span>
                </div>
              </div>

              {/* Payment mode */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.05em", marginBottom: 8 }}>PAYMENT MODE (F8)</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {PAY_MODES.map(m => (
                    <button key={m} onClick={() => setPayMode(m)}
                      style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: `2px solid ${payMode === m ? "#4f46e5" : "#475569"}`,
                        background: payMode === m ? "#4f46e5" : "transparent", color: "#fff", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {payMode === "split" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px", background: "#0c1526", borderRadius: 10, border: "2px solid #4f46e5" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", letterSpacing: "0.08em" }}>SPLIT PAYMENT</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...FIELD_LABEL, color: "#10b981" }}>CASH ₹</label>
                      <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)}
                        autoFocus
                        style={{ ...FIELD_INPUT, textAlign: "right", fontSize: 18, fontWeight: 800, border: "2px solid #10b981" }} placeholder="0" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...FIELD_LABEL, color: "#3b82f6" }}>BANK / UPI ₹</label>
                      <input type="number" value={bankAmount} onChange={e => setBankAmount(e.target.value)}
                        style={{ ...FIELD_INPUT, textAlign: "right", fontSize: 18, fontWeight: 800, border: "2px solid #3b82f6" }} placeholder="0" />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid #1e293b", paddingTop: 8 }}>
                    <span style={{ color: MUTED }}>Total Paying</span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: (parseFloat(cashAmount || "0") + parseFloat(bankAmount || "0")) >= totals.net ? "#10b981" : "#f87171" }}>
                      ₹{inr(parseFloat(cashAmount || "0") + parseFloat(bankAmount || "0"))}
                    </span>
                  </div>
                </div>
              ) : payMode !== "credit" ? (
                <div>
                  <label style={FIELD_LABEL}>Amount Received ₹</label>
                  <input ref={payAmountRef} type="number" value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    placeholder={inr(totals.net)}
                    style={{ ...FIELD_INPUT, fontSize: 18, fontWeight: 700, textAlign: "right", border: "2px solid #10b981" }} />
                </div>
              ) : (
                <div style={{ padding: "10px 14px", background: "#1a1030", borderRadius: 8, border: "1px solid #7c3aed", fontSize: 13, color: "#c4b5fd" }}>
                  Credit — Full ₹{inr(totals.net)} due from customer
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: MUTED }}>Balance Due</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: totals.balance > 0 ? "#f87171" : "#10b981" }}>
                  ₹{inr(totals.balance)}
                </span>
              </div>

              {/* Save button */}
              <button onClick={handleSaveBill} disabled={saving}
                style={{ padding: "16px", borderRadius: 10, border: "none",
                  background: saving ? "#374151" : "linear-gradient(135deg,#10b981,#059669)",
                  color: "#fff", fontWeight: 800, fontSize: 16, cursor: saving ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: "0 8px 20px rgba(16,185,129,0.35)" }}>
                {saving ? "Saving…" : <><FaPrint size={14} /> Save & Print (F9)</>}
              </button>
              <button onClick={clearBill}
                style={{ padding: "10px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: MUTED, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Clear Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIVE PAYMENT MODE ─────────────────────────────────────────── */}
      {mode === "payment" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 32, maxWidth: 800, margin: "0 auto", width: "100%" }}>
          <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800 }}>Receive Payment</h2>

          {!payCustomer ? (
            <div style={{ position: "relative", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>CUSTOMER</div>
              <input type="text" placeholder="Search by name or phone…" value={payCustomerSearch}
                onChange={e => {
                  const q = e.target.value;
                  setPayCustomerSearch(q);
                  clearTimeout(searchTimeout.current);
                  if (!q.trim()) { setPayCustomerResults([]); return; }
                  searchTimeout.current = setTimeout(() => searchCustomerFor(q, setPayCustomerResults), 250);
                }}
                style={{ ...FIELD_INPUT, fontSize: 15, padding: "12px 16px", border: "2px solid #4f46e5" }} autoFocus />
              {payCustomerSearch.length >= 1 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#0f172a", border: "1px solid #4f46e5", borderRadius: 10, zIndex: 500, maxHeight: 280, overflowY: "auto", marginTop: 4, boxShadow: "0 16px 40px rgba(0,0,0,0.8)" }}>
                  {payCustomerResults.length === 0 && (
                    <div style={{ padding: "14px 16px", color: MUTED, fontSize: 13 }}>No customer found for "{payCustomerSearch}"</div>
                  )}
                  {payCustomerResults.map(c => (
                    <div key={c.id}
                      onClick={() => { setPayCustomer({ ...c, name: c.name || c.username }); fetchOutstanding({ ...c, name: c.name }); setPayCustomerSearch(""); setPayCustomerResults([]); }}
                      style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #1e293b", backgroundColor: "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e293b")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        {c.phone}
                        {parseFloat(c.outstanding_balance || 0) > 0 &&
                          <span style={{ color: "#f87171", marginLeft: 8 }}>· Due ₹{inr(c.outstanding_balance)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "14px 18px", background: PANEL, borderRadius: 10, border: "2px solid #10b981", marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{payCustomer.name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{payCustomer.phone} · Outstanding: ₹{inr(payCustomer.outstanding_balance)}</div>
              </div>
              <button onClick={() => { setPayCustomer(null); setOutstandingInvs([]); }} style={ICON_BTN}>×</button>
            </div>
          )}

          {payCustomer && (
            <>
              {outstandingInvs.length > 0 && (
                <div style={{ background: PANEL, borderRadius: 10, border: BORDER, overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ padding: "12px 16px", borderBottom: BORDER, fontWeight: 700, fontSize: 14 }}>Outstanding Invoices</div>
                  {outstandingInvs.slice(0, 5).map(inv => (
                    <div key={inv.id} style={{ padding: "12px 16px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>{inv.invoice_date}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#f87171", fontWeight: 700 }}>₹{inr(inv.balance_amount)}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>of ₹{inr(inv.total_amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={FIELD_LABEL}>Amount ₹</label>
                  <input type="number" value={receiveAmount} onChange={e => setReceiveAmount(e.target.value)}
                    style={{ ...FIELD_INPUT, fontSize: 20, fontWeight: 700, border: "2px solid #10b981" }} placeholder="0" autoFocus />
                </div>
                <div>
                  <label style={FIELD_LABEL}>Payment Mode</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["cash", "bank", "upi"].map(m => (
                      <button key={m} onClick={() => setReceiveMode(m)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${receiveMode === m ? "#4f46e5" : "#475569"}`,
                          background: receiveMode === m ? "#4f46e5" : "transparent", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleReceivePayment} disabled={receivingSaving || !receiveAmount}
                style={{ ...BTN_PRIMARY, padding: "16px", fontSize: 16, background: "#10b981", width: "100%", opacity: !receiveAmount ? 0.5 : 1 }}>
                {receivingSaving ? "Processing…" : `Receive ₹${inr(receiveAmount)} from ${payCustomer.name}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── RETURN MODE ──────────────────────────────────────────────────── */}
      {mode === "return" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 32, maxWidth: 860, margin: "0 auto", width: "100%" }}>
          <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800 }}>Sales Return</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input type="text" placeholder="Enter Invoice # to return…" value={returnSearch}
              onChange={e => setReturnSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchReturnInvoice()}
              style={{ ...FIELD_INPUT, flex: 1, fontSize: 15 }} autoFocus />
            <button onClick={searchReturnInvoice} style={{ ...BTN_PRIMARY, flex: "0 0 auto", padding: "10px 20px" }}>
              <FaSearch /> Search
            </button>
          </div>

          {returnInvoice && (
            <>
              <div style={{ background: PANEL, borderRadius: 10, border: BORDER, padding: "14px 18px", marginBottom: 16 }}>
                <div style={{ fontWeight: 700 }}>{returnInvoice.invoice_number} — {returnInvoice.customer_name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{returnInvoice.invoice_date} · ₹{inr(returnInvoice.total_amount)}</div>
              </div>

              <div style={{ background: PANEL, borderRadius: 10, border: BORDER, overflow: "hidden", marginBottom: 16 }}>
                {returnItems.map((ri, i) => (
                  <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ri.description}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>Orig Qty: {ri.quantity} · ₹{inr(ri.unit_price || ri.rate)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 11, color: MUTED }}>Return Qty</label>
                      <input type="number" min={0} max={ri.quantity} value={ri.return_qty || ""}
                        onChange={e => setReturnItems(prev => prev.map((x, idx) => idx === i ? { ...x, return_qty: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 64, padding: "6px", borderRadius: 6, border: "1px solid #475569", background: "#0f172a", color: TEXT, textAlign: "center", outline: "none" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={FIELD_LABEL}>Reason</label>
                  <input value={returnReason} onChange={e => setReturnReason(e.target.value)}
                    placeholder="Defective / Wrong size / etc." style={FIELD_INPUT} />
                </div>
                <div>
                  <label style={FIELD_LABEL}>Refund Mode</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["cash", "bank", "adjust"].map(m => (
                      <button key={m} onClick={() => setReturnRefund(m)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${returnRefund === m ? "#f59e0b" : "#475569"}`,
                          background: returnRefund === m ? "#f59e0b" : "transparent", color: returnRefund === m ? "#000" : "#fff",
                          fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleProcessReturn} disabled={returnSaving}
                style={{ ...BTN_PRIMARY, width: "100%", padding: "16px", fontSize: 16, background: "#f59e0b", color: "#000" }}>
                {returnSaving ? "Processing…" : "Process Return"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── TODAY'S BILLS ─────────────────────────────────────────────────── */}
      {mode === "today_bills" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Today's Bills</h2>
            <button onClick={fetchTodayBills}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: MUTED, fontSize: 13, cursor: "pointer" }}>
              Refresh
            </button>
          </div>

          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Bills", value: todaySummary.total, color: TEXT },
              { label: "Cash Sales", value: `₹${inr(todaySummary.cash)}`, color: "#10b981" },
              { label: "Bank/UPI", value: `₹${inr(todaySummary.bank)}`, color: "#3b82f6" },
              { label: "Credit Bills", value: todaySummary.credit, color: "#f87171" },
              { label: "Total Amount", value: `₹${inr(todaySummary.total_amt)}`, color: "#818cf8" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: PANEL, borderRadius: 10, border: BORDER, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {(["all", "cash", "bank", "credit"] as const).map(f => (
              <button key={f} onClick={() => setBillsFilter(f)}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${billsFilter === f ? "#4f46e5" : "#475569"}`,
                  background: billsFilter === f ? "#4f46e5" : "transparent", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>
                {f}
              </button>
            ))}
          </div>

          <div style={{ background: PANEL, borderRadius: 12, border: BORDER, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f172a", fontSize: 11, color: MUTED, textTransform: "uppercase" }}>
                  {["Bill #", "Time", "Customer", "Type", "Items", "Total", "Paid", "Balance", "Mode", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTodayBills.map((b, i) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #334155", background: i % 2 ? "#1a2535" : "transparent" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{b.invoice_number}</td>
                    <td style={{ padding: "12px 14px", color: MUTED }}>{b.created_at ? new Date(b.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td style={{ padding: "12px 14px" }}>{b.customer_name || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: "#1e3a5f", color: "#60a5fa" }}>
                        {b.bill_type?.replace("_", " ").toUpperCase() || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: MUTED }}>{b.item_count || 0}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>₹{inr(b.grand_total)}</td>
                    <td style={{ padding: "12px 14px", color: "#10b981" }}>₹{inr(b.paid_amount)}</td>
                    <td style={{ padding: "12px 14px", color: parseFloat(b.balance_amount || 0) > 0 ? "#f87171" : "#10b981", fontWeight: 700 }}>₹{inr(b.balance_amount)}</td>
                    <td style={{ padding: "12px 14px", color: MUTED, textTransform: "uppercase", fontSize: 11 }}>{b.payment_mode || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                        background: b.payment_status === "PAID" ? "#064e3b" : b.payment_status === "PARTIAL" ? "#451a03" : "#1c1917",
                        color: b.payment_status === "PAID" ? "#4ade80" : b.payment_status === "PARTIAL" ? "#fb923c" : "#94a3b8" }}>
                        {b.payment_status || "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTodayBills.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: MUTED }}>No bills today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── INVENTORY MODE ────────────────────────────────────────────────── */}
      {mode === "inventory" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Branch Inventory</h2>
            <input type="text" placeholder="Search…" value={inventorySearch}
              onChange={e => setInventorySearch(e.target.value)}
              style={{ ...FIELD_INPUT, width: 240 }} />
          </div>
          <div style={{ background: PANEL, borderRadius: 12, border: BORDER, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f172a", fontSize: 11, color: MUTED, textTransform: "uppercase" }}>
                  {["Product", "HSN", "Fresh Stock", "Mistake Stock", "Total", "Rate", "Value"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.filter(p => p.name?.toLowerCase().includes(inventorySearch.toLowerCase())).map((p, i) => {
                  const fresh   = parseFloat(p.fresh_stock ?? p.current_stock ?? 0);
                  const mistake = parseFloat(p.mistake_stock ?? 0);
                  return (
                    <tr key={p.product_id || i} style={{ borderBottom: "1px solid #334155", background: i % 2 ? "#1a2535" : "transparent" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: "12px 16px", color: MUTED }}>{p.hsn_code || "—"}</td>
                      <td style={{ padding: "12px 16px", color: "#10b981", fontWeight: 700 }}>{fresh}</td>
                      <td style={{ padding: "12px 16px", color: "#f59e0b", fontWeight: 700 }}>{mistake}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: "#818cf8" }}>{fresh + mistake}</td>
                      <td style={{ padding: "12px 16px" }}>₹{inr(p.selling_price)}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>₹{inr((fresh + mistake) * parseFloat(p.selling_price || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DAY CLOSE ────────────────────────────────────────────────────── */}
      {mode === "day_close" && (() => {
        const dc = dcSummary || {};
        const expected    = parseFloat(dc.cash || 0);
        const actual      = parseFloat(actualCash || "0");
        const diff        = actual - expected;
        const diffColor   = diff === 0 ? "#10b981" : diff > 0 ? "#f59e0b" : "#f87171";
        const diffLabel   = diff === 0 ? "Cash matches perfectly" : diff > 0 ? "Cash EXCESS" : "Cash SHORTAGE";

        if (dc.submitted) return (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>Day Closed Successfully</div>
            <div style={{ fontSize: 14, color: MUTED, marginTop: 8 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        );

        return (
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", maxWidth: 700, margin: "0 auto", width: "100%" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Day Close</h2>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                {activeBranch?.branch_name} — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>

            {/* Sales summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total Bills Today",      value: dc.bills_count || 0,    color: "#818cf8", isCount: true },
                { label: "Total Sales Value",       value: dc.today_sales || 0,    color: "#f1f5f9" },
                { label: "Cash Collected",          value: dc.cash_collected || 0, color: "#10b981" },
                { label: "Bank / UPI Collected",    value: dc.bank_collected || 0, color: "#3b82f6" },
                { label: "Credit Given (Pending)",  value: dc.credit_given || 0,   color: "#f87171" },
                { label: "Branch Cash Balance",     value: dc.cash || 0,           color: "#10b981" },
              ].map((item, i) => (
                <div key={i} style={{ background: PANEL, borderRadius: 10, padding: "14px 16px", border: BORDER }}>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>
                    {item.isCount ? Number(item.value).toLocaleString("en-IN") : `₹${inr(item.value)}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Cash reconciliation */}
            <div style={{ background: PANEL, borderRadius: 12, padding: 20, marginBottom: 14, border: BORDER }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.06em", marginBottom: 14, textTransform: "uppercase" }}>
                Cash Reconciliation — This Branch Only
              </div>
              {[
                { label: "Opening Cash (This Branch)", value: `₹${inr(dc.opening_cash || 0)}`, valueColor: TEXT },
                { label: "+ Cash Collected Today",     value: `+₹${inr(dc.cash_collected || 0)}`, valueColor: "#10b981" },
                { label: "Expected Closing Cash",      value: `₹${inr(dc.cash || 0)}`,   valueColor: TEXT, bold: true },
              ].map(({ label, value, valueColor, bold }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
                  <span style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 600, color: valueColor }}>{value}</span>
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <label style={{ ...FIELD_LABEL, color: "#94a3b8" }}>Actual Cash in Hand (Count Now)</label>
                <input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)}
                  placeholder="Count and enter…"
                  style={{ ...FIELD_INPUT, fontSize: 22, fontWeight: 800, textAlign: "right", border: `2px solid ${diffColor}` }} />
                {actualCash && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8,
                    background: diff === 0 ? "#064e3b" : diff > 0 ? "#451a03" : "#450a0a",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: MUTED }}>{diffLabel}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: diffColor }}>
                      {diff === 0 ? "✓ ₹0" : `${diff > 0 ? "+" : "-"}₹${inr(Math.abs(diff))}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bank balance */}
            <div style={{ background: PANEL, borderRadius: 12, padding: "14px 20px", marginBottom: 14, border: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>Bank Balance — This Branch</div>
                <div style={{ fontSize: 12, color: MUTED }}>
                  Opening ₹{inr(dc.opening_bank || 0)} &nbsp;+&nbsp; Today ₹{inr(dc.bank_collected || 0)}
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#3b82f6" }}>₹{inr(dc.bank || 0)}</div>
            </div>

            <textarea value={dcNotes} onChange={e => setDcNotes(e.target.value)}
              placeholder="Any notes for today (optional)…" rows={3}
              style={{ ...FIELD_INPUT, width: "100%", resize: "none", marginBottom: 16, boxSizing: "border-box" } as any} />

            <button onClick={handleDayClose} disabled={dcSaving || !actualCash}
              style={{ width: "100%", padding: "18px", background: "#4f46e5", color: "#fff", border: "none",
                borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: "pointer", letterSpacing: "0.04em",
                opacity: dcSaving || !actualCash ? 0.5 : 1 }}>
              {dcSaving ? "SUBMITTING…" : "SUBMIT DAY CLOSE"}
            </button>
          </div>
        );
      })()}

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
      {showNewCustomer && (
        <NewCustomerModal
          initialName={customerSearch}
          onCreated={c => { selectCustomer(c); setFlash(`Customer "${c.name}" created`); }}
          onClose={() => setShowNewCustomer(false)}
        />
      )}

      {showCustLedger && customer && (
        <CustomerLedgerModal customer={customer} onClose={() => setShowCustLedger(false)} />
      )}

      {showPrint && lastBill && (
        <PrintModal
          bill={lastBill}
          customer={customer || {}}
          branchName={activeBranch?.branch_name || "Branch"}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
};

export default BranchBilling;
