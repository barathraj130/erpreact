import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FaSave, FaPlus, FaTrash, FaChevronLeft, FaFileUpload,
  FaFileInvoice, FaRegClock, FaUserAlt, FaBarcode,
  FaMoneyBillWave, FaPercentage, FaCalculator, FaTimes, FaCamera, FaBox,
  FaCreditCard
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import CustomSelect from "../components/CustomSelect";
import ProductCombobox from "../components/ProductCombobox";
import AddProductModal from "./AddProductModal";
import AddSupplierModal from "./AddSupplierModal";
import { motion, AnimatePresence } from "framer-motion";
import "./CreateInvoice.css"; // Reusing some base styles

interface ProductItem {
  id: string;
  name: string;
  qty: number;
  rate: number;
  gstRate: number;
  hsnCode?: string;
  unit: string;
  imageUrl?: string;
}

interface ExpenseItem {
  expense_type: string;
  description: string;
  amount: number;
  tax_percent: number;
}

interface PaymentEntry {
  mode: string;
  amount: number;
  reference: string;
}

const PAYMENT_MODES = [
  { value: "CASH",       label: "Liquid Cash" },
  { value: "BANK",       label: "Bank Transfer" },
  { value: "UPI",        label: "UPI" },
  { value: "CHEQUE",     label: "Cheque" },
  { value: "PROPRIETOR", label: "Proprietor Personal Account" },
  { value: "CREDIT",     label: "Credit (Due Later)" },
];

const MODE_COLORS: Record<string, string> = {
  CASH: "#10b981", BANK: "#3b82f6", UPI: "#8b5cf6",
  CHEQUE: "#f59e0b", PROPRIETOR: "#7c3aed", CREDIT: "#ef4444",
};

const SimplifiedPurchaseBill: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data Lists
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [branchInfo, setBranchInfo] = useState<any>(null);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billType, setBillType] = useState<"TAX" | "NON_TAX">("TAX");
  const [billCategory, setBillCategory] = useState<"PRODUCT" | "EXPENSE">("PRODUCT");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [items, setItems] = useState<ProductItem[]>([
    { id: "", name: "", qty: 1, rate: 0, gstRate: 18, unit: "pcs", imageUrl: "" }
  ]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { expense_type: "Freight / Transport", description: "", amount: 0, tax_percent: 18 }
  ]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  // Multi-mode split payments
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { mode: "CASH", amount: 0, reference: "" }
  ]);
  const [brokerId, setBrokerId] = useState<string>("");
  const [brokerCommRate, setBrokerCommRate] = useState<number>(0);

  // Surplus stock fields
  const [isSurplus, setIsSurplus] = useState(false);
  const [surplusLotNumber, setSurplusLotNumber] = useState("");
  const [surplusTransportCost, setSurplusTransportCost] = useState<number>(0);
  interface SurplusLine { description: string; fresh_qty: string; fresh_rate: string; mistake_qty: string; mistake_rate: string; fresh_amount: number; mistake_amount: number; total_amount: number; }
  const [surplusLines, setSurplusLines] = useState<SurplusLine[]>([
    { description: "", fresh_qty: "", fresh_rate: "", mistake_qty: "", mistake_rate: "", fresh_amount: 0, mistake_amount: 0, total_amount: 0 }
  ]);

  const addSurplusLine = () => setSurplusLines(prev => [...prev, { description: "", fresh_qty: "", fresh_rate: "", mistake_qty: "", mistake_rate: "", fresh_amount: 0, mistake_amount: 0, total_amount: 0 }]);
  const removeSurplusLine = (index: number) => setSurplusLines(prev => prev.filter((_, i) => i !== index));
  const updateSurplusLine = (index: number, field: string, value: string) => {
    setSurplusLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const updated: any = { ...line, [field]: value };
      const freshAmt   = parseFloat(updated.fresh_qty  || "0") * parseFloat(updated.fresh_rate  || "0");
      const mistakeAmt = parseFloat(updated.mistake_qty || "0") * parseFloat(updated.mistake_rate || "0");
      updated.fresh_amount   = freshAmt;
      updated.mistake_amount = mistakeAmt;
      updated.total_amount   = freshAmt + mistakeAmt;
      return updated;
    }));
  };

  const surplusTotals = {
    fresh_qty:      surplusLines.reduce((s, l) => s + parseFloat(l.fresh_qty   || "0"), 0),
    mistake_qty:    surplusLines.reduce((s, l) => s + parseFloat(l.mistake_qty || "0"), 0),
    fresh_amount:   surplusLines.reduce((s, l) => s + parseFloat(l.fresh_qty   || "0") * parseFloat(l.fresh_rate  || "0"), 0),
    mistake_amount: surplusLines.reduce((s, l) => s + parseFloat(l.mistake_qty || "0") * parseFloat(l.mistake_rate || "0"), 0),
    get subtotal()    { return this.fresh_amount + this.mistake_amount; },
    get grand_total() { return this.subtotal + (surplusTransportCost || 0); },
  };

  // UI State
  const [loading, setLoading] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [draftBanner, setDraftBanner] = useState<{ savedAt: string } | null>(null);

  const DRAFT_KEY = "purchase_bill_draft";

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      const [supRes, prodRes, brokerRes, branchRes] = await Promise.all([
        apiFetch("/suppliers"),
        apiFetch("/products"),
        apiFetch("/brokers"),
        apiFetch("/branches/current")
      ]);
      if (supRes.ok) setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (brokerRes.ok) setBrokers(await brokerRes.json());
      if (branchRes.ok) setBranchInfo(await branchRes.json());
    };
    fetchData();
  }, [showAddProductModal, showAddSupplierModal]);

  // Draft detection on mount
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.savedAt) setDraftBanner({ savedAt: draft.savedAt });
      } catch {}
    }
  }, []);

  const saveDraft = () => {
    const draft = {
      savedAt: new Date().toISOString(),
      selectedSupplierId, billNumber, billDate, billType, billCategory,
      items, expenses, discountAmount, payments, brokerId, brokerCommRate,
      isSurplus, surplusLotNumber, surplusTransportCost, surplusLines,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    alert("Draft saved! You can continue later.");
  };

  const restoreDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.selectedSupplierId !== undefined) setSelectedSupplierId(d.selectedSupplierId);
      if (d.billNumber       !== undefined) setBillNumber(d.billNumber);
      if (d.billDate         !== undefined) setBillDate(d.billDate);
      if (d.billType         !== undefined) setBillType(d.billType);
      if (d.billCategory     !== undefined) setBillCategory(d.billCategory);
      if (d.items            !== undefined) setItems(d.items);
      if (d.expenses         !== undefined) setExpenses(d.expenses);
      if (d.discountAmount   !== undefined) setDiscountAmount(d.discountAmount);
      if (d.payments         !== undefined) setPayments(d.payments);
      if (d.brokerId         !== undefined) setBrokerId(d.brokerId);
      if (d.brokerCommRate   !== undefined) setBrokerCommRate(d.brokerCommRate);
      if (d.isSurplus        !== undefined) setIsSurplus(d.isSurplus);
      if (d.surplusLotNumber !== undefined) setSurplusLotNumber(d.surplusLotNumber);
      if (d.surplusTransportCost !== undefined) setSurplusTransportCost(d.surplusTransportCost);
      if (d.surplusLines     !== undefined) setSurplusLines(d.surplusLines);
    } catch {}
    setDraftBanner(null);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftBanner(null);
  };

  // GST Type Detection
  const gstType = useMemo(() => {
    if (!selectedSupplierId || !branchInfo) return "INTRA_STATE";
    const sup = suppliers.find(s => String(s.id) === selectedSupplierId);
    if (sup && sup.state_code && branchInfo.state_code) {
      return sup.state_code === branchInfo.state_code ? "INTRA_STATE" : "INTER_STATE";
    }
    return "INTRA_STATE";
  }, [selectedSupplierId, suppliers, branchInfo]);

  // Calculations
  const totals = useMemo(() => {
    let subTotal = 0;
    let totalTax = 0;
    
    if (billCategory === "PRODUCT") {
        items.forEach(item => {
            const amt = item.qty * item.rate;
            subTotal += amt;
            if (billType === "TAX") {
                totalTax += (amt * (item.gstRate || 0)) / 100;
            }
        });
    } else {
        expenses.forEach(exp => {
            const amt = exp.amount;
            subTotal += amt;
            if (billType === "TAX") {
                totalTax += (amt * (exp.tax_percent || 0)) / 100;
            }
        });
    }

    const grossTotal = subTotal + totalTax;
    const netTotal = grossTotal - discountAmount;
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const balance = Math.max(0, netTotal - totalPaid);

    return { subTotal, totalTax, grossTotal, netTotal, totalPaid, balance };
  }, [items, expenses, billCategory, billType, discountAmount, payments]);

  // Handlers
  const handleAddItem = () => {
    if (billCategory === "PRODUCT") {
        setItems([...items, { id: "", name: "", qty: 1, rate: 0, gstRate: 18, unit: "pcs", imageUrl: "" }]);
    } else {
        setExpenses([...expenses, { expense_type: "Other", description: "", amount: 0, tax_percent: 18 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (billCategory === "PRODUCT") {
        if (items.length > 1) setItems(items.filter((_, i) => i !== index));
    } else {
        if (expenses.length > 1) setExpenses(expenses.filter((_, i) => i !== index));
    }
  };

  const addPaymentRow = () =>
    setPayments(prev => [...prev, { mode: "CASH", amount: 0, reference: "" }]);

  const removePaymentRow = (i: number) =>
    setPayments(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const updatePayment = (i: number, field: keyof PaymentEntry, val: string | number) =>
    setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

  const handleProductSelect = (index: number, val: string, id?: string) => {
    const newItems = [...items];
    const prod = id
      ? products.find(p => String(p.id) === id) || products.find(p => p.name === val)
      : products.find(p => p.name === val || p.id === parseInt(val));
    if (prod) {
      newItems[index] = {
        id: String(prod.id),
        name: prod.name,
        qty: newItems[index].qty,
        rate: prod.cost_price || 0,
        gstRate: prod.gst_percent || 18,
        unit: prod.unit || "pcs",
        hsnCode: prod.hsn_code,
        imageUrl: prod.image_url
      };
    } else {
      newItems[index] = { ...newItems[index], id: id || "", name: val };
    }
    setItems(newItems);
  };

  const handleSave = async (print = false) => {
    if (!selectedSupplierId) return alert("Please select a supplier.");
    if (!billNumber) return alert("Please enter bill number.");
    if (!isSurplus && billCategory === "PRODUCT" && items.some(i => !i.name || i.qty <= 0)) return alert("Please ensure all products have name and quantity.");
    if (billCategory === "EXPENSE" && expenses.some(e => !e.expense_type || e.amount <= 0)) return alert("Please ensure all expenses have type and amount.");
    const validPayments = payments.filter(p => p.amount > 0);
    const effectiveTotal = isSurplus ? surplusTotals.grand_total - discountAmount : totals.netTotal;
    const totalPaid = validPayments.reduce((s, p) => s + (p.amount || 0), 0);
    if (totalPaid > effectiveTotal + 0.01) return alert(`Total paid (₹${totalPaid.toFixed(2)}) cannot exceed bill amount (₹${effectiveTotal.toFixed(2)}).`);

    setLoading(true);
    try {
      const formData = new FormData();
      const payload: any = {
        supplier_id: selectedSupplierId,
        bill_number: billNumber,
        bill_date: billDate,
        bill_type: billType,
        bill_category: billCategory,
        items: (!isSurplus && billCategory === "PRODUCT") ? items.map(i => ({
          product_id: i.id ? parseInt(i.id) : null,
          description: i.name,
          quantity: i.qty,
          unit_price: i.rate,
          unit: i.unit || "pcs",
          tax_percent: billType === "TAX" ? i.gstRate : 0,
          hsn_code: i.hsnCode || null
        })) : [],
        expenses: billCategory === "EXPENSE" ? expenses : [],
        discount_amount: discountAmount,
        payments: validPayments.length > 0 ? validPayments : [],
        broker_id: brokerId || null,
        broker_commission_rate: brokerCommRate || 0
      };
      if (isSurplus) {
        if (!surplusLotNumber.trim()) { setLoading(false); return alert("Enter lot number for surplus purchase."); }
        for (let i = 0; i < surplusLines.length; i++) {
          const line = surplusLines[i];
          if (!line.description.trim()) { setLoading(false); return alert(`Enter description for row ${i + 1}.`); }
          const hasFresh   = parseFloat(line.fresh_qty   || "0") > 0;
          const hasMistake = parseFloat(line.mistake_qty || "0") > 0;
          if (!hasFresh && !hasMistake)                           { setLoading(false); return alert(`Enter fresh qty or mistake qty for row ${i + 1}.`); }
          if (hasFresh   && !parseFloat(line.fresh_rate  || "0")) { setLoading(false); return alert(`Enter fresh rate for row ${i + 1}.`); }
          if (hasMistake && !parseFloat(line.mistake_rate || "0")) { setLoading(false); return alert(`Enter mistake rate for row ${i + 1}.`); }
        }
        payload.is_surplus     = true;
        payload.lot_number     = surplusLotNumber;
        payload.transport_cost = surplusTransportCost || 0;
        payload.surplus_lines  = surplusLines.filter(l => l.description.trim()).map(l => ({
          description:    l.description.trim(),
          fresh_qty:      parseFloat(l.fresh_qty   || "0"),
          fresh_rate:     parseFloat(l.fresh_rate  || "0"),
          mistake_qty:    parseFloat(l.mistake_qty || "0"),
          mistake_rate:   parseFloat(l.mistake_rate || "0"),
          fresh_amount:   parseFloat(l.fresh_qty   || "0") * parseFloat(l.fresh_rate  || "0"),
          mistake_amount: parseFloat(l.mistake_qty || "0") * parseFloat(l.mistake_rate || "0"),
          total_amount:   parseFloat(l.fresh_qty   || "0") * parseFloat(l.fresh_rate  || "0") +
                          parseFloat(l.mistake_qty || "0") * parseFloat(l.mistake_rate || "0"),
        }));
      }

      formData.append("data", JSON.stringify(payload));
      if (billFile) formData.append("bill_file", billFile);

      const res = await apiFetch("/purchase-bills", {
        method: "POST",
        body: formData
      }, false);

      if (res.ok) {
        const result = await res.json();
        localStorage.removeItem(DRAFT_KEY);
        const summary = result.items_saved > 0
          ? `Bill saved! ${result.items_saved} item(s) recorded, ${result.products_created} new product(s) created, inventory updated.`
          : "Purchase Bill Saved Successfully!";
        alert(summary);
        if (print) {
            navigate(`/purchase-bills/${result.id}/print`);
        } else {
            navigate("/purchase-bills");
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save bill.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="db-page" style={{ background: "#f1f5f9", minHeight: "100vh" }}>
      <header className="db-topbar" style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 30px" }}>
        <div className="db-topbar-left">
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginRight: "15px" }}>
            <FaChevronLeft />
          </button>
          <span className="db-topbar-title" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
            New Purchase Bill
          </span>
        </div>
        <div className="db-topbar-right">
          <span style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>
            <FaRegClock /> {new Date().toLocaleDateString()}
          </span>
        </div>
      </header>

      {draftBanner && (
        <div style={{ background: "#fef9c3", borderBottom: "1px solid #fde047", padding: "12px 30px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", color: "#854d0e", fontWeight: 600 }}>
            📋 You have an unsaved draft from {new Date(draftBanner.savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <button onClick={restoreDraft}
            style={{ padding: "5px 16px", borderRadius: 8, border: "none", background: "#854d0e", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
            Restore Draft
          </button>
          <button onClick={discardDraft}
            style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #854d0e", background: "transparent", color: "#854d0e", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
            Discard
          </button>
        </div>
      )}

      <div className="db-content" style={{ padding: "30px", display: "grid", gridTemplateColumns: "1fr 380px", gap: "30px", maxWidth: "1600px", margin: "0 auto" }}>
        {/* Main Form Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          {/* Section 1: Supplier & Bill Info */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                  Supplier Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <CustomSelect value={selectedSupplierId} onChange={(e: any) => setSelectedSupplierId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </CustomSelect>
                  <button onClick={() => setShowAddSupplierModal(true)} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#3b82f6", borderRadius: "10px", padding: "0 12px", cursor: "pointer" }}>
                    <FaPlus size={14} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                  Bill Date
                </label>
                <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
              </div>

              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                  Bill Number <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="e.g. BILL-456" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
              </div>

              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                  Bill Type
                </label>
                <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "10px", padding: "4px" }}>
                  <button onClick={() => setBillType("TAX")} style={{ flex: 1, border: "none", background: billType === "TAX" ? "#fff" : "transparent", padding: "8px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 600, color: billType === "TAX" ? "#4f46e5" : "#64748b", boxShadow: billType === "TAX" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", cursor: "pointer" }}>
                    TAX (GST)
                  </button>
                  <button onClick={() => setBillType("NON_TAX")} style={{ flex: 1, border: "none", background: billType === "NON_TAX" ? "#fff" : "transparent", padding: "8px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 600, color: billType === "NON_TAX" ? "#4f46e5" : "#64748b", boxShadow: billType === "NON_TAX" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", cursor: "pointer" }}>
                    NON-TAX
                  </button>
                </div>
              </div>
            </div>
            
            {selectedSupplierId && (
              <div style={{ marginTop: "15px", padding: "10px 15px", background: "#f0fdf4", borderRadius: "10px", border: "1px solid #dcfce7", display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "#166534" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                Auto-detected: <strong>{gstType === "INTRA_STATE" ? "Intra-State (CGST+SGST)" : "Inter-State (IGST)"}</strong>
              </div>
            )}
          </section>

          {/* Bill Type Selector */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "15px 24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: "20px" }}>
             <span style={{ fontWeight: 800, color: "#475569", fontSize: "0.85rem", textTransform: "uppercase" }}>Bill Category:</span>
             <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "12px", padding: "4px", width: "400px" }}>
                <button 
                  onClick={() => { if(items.length > 1 || items[0].id) { if(!confirm("Switching will clear your items. Continue?")) return; } setBillCategory("PRODUCT"); setItems([{ id: "", name: "", qty: 1, rate: 0, gstRate: 18, unit: "pcs", imageUrl: "" }]); }} 
                  style={{ flex: 1, border: "none", background: billCategory === "PRODUCT" ? "#4f46e5" : "transparent", padding: "10px", borderRadius: "10px", fontSize: "0.9rem", fontWeight: 700, color: billCategory === "PRODUCT" ? "#fff" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                   <FaBox /> Product Bill
                </button>
                <button 
                  onClick={() => { if(expenses.length > 1 || expenses[0].amount > 0) { if(!confirm("Switching will clear your items. Continue?")) return; } setBillCategory("EXPENSE"); setExpenses([{ expense_type: "Freight / Transport", description: "", amount: 0, tax_percent: 18 }]); }} 
                  style={{ flex: 1, border: "none", background: billCategory === "EXPENSE" ? "#4f46e5" : "transparent", padding: "10px", borderRadius: "10px", fontSize: "0.9rem", fontWeight: 700, color: billCategory === "EXPENSE" ? "#fff" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                   <FaFileInvoice /> Expense Bill
                </button>
             </div>
          </section>

          {/* Surplus T-shirt Stock Toggle */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "16px 24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <div
                onClick={() => setIsSurplus(!isSurplus)}
                style={{ width: "44px", height: "24px", borderRadius: "12px", background: isSurplus ? "#4f46e5" : "#e2e8f0", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
              >
                <div style={{ position: "absolute", top: "3px", left: isSurplus ? "22px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
              <div>
                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>Surplus T-shirt Purchase</span>
                <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: "10px" }}>Splits into Fresh + Mistake inventory</span>
              </div>
            </label>

            <AnimatePresence>
              {isSurplus && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                  <div style={{ paddingTop: "20px", borderTop: "1px solid #f1f5f9", marginTop: "16px" }}>
                    {/* Lot + Transport row */}
                    <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Lot Number *</label>
                        <input value={surplusLotNumber} onChange={e => setSurplusLotNumber(e.target.value)}
                          placeholder="e.g. JBS/2025/06/001"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: !surplusLotNumber.trim() ? "1.5px solid #ef4444" : "0.5px solid #e2e8f0", boxSizing: "border-box", fontSize: "0.9rem" }} />
                      </div>
                      <div style={{ width: "160px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Transport Cost (₹)</label>
                        <input type="number" min="0" value={surplusTransportCost || ""}
                          onChange={e => setSurplusTransportCost(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #e2e8f0", boxSizing: "border-box" }} />
                      </div>
                    </div>

                    {/* Unified surplus table */}
                    <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "12px" }}>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: "680px" }}>
                          <colgroup>
                            <col style={{ width: "20%" }} />
                            <col style={{ width: "9%" }} />
                            <col style={{ width: "9%" }} />
                            <col style={{ width: "9%" }} />
                            <col style={{ width: "9%" }} />
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "4%" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#475569", borderBottom: "0.5px solid #e2e8f0", background: "#f8fafc", letterSpacing: "0.04em" }}>DESCRIPTION</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#10b981", borderBottom: "0.5px solid #e2e8f0", background: "#f0fdf4", letterSpacing: "0.04em" }}>FRESH QTY</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#10b981", borderBottom: "0.5px solid #e2e8f0", background: "#f0fdf4", letterSpacing: "0.04em" }}>FRESH RATE</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#f59e0b", borderBottom: "0.5px solid #e2e8f0", background: "#fffbeb", letterSpacing: "0.04em" }}>MSTK QTY</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#f59e0b", borderBottom: "0.5px solid #e2e8f0", background: "#fffbeb", letterSpacing: "0.04em" }}>MSTK RATE</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#10b981", borderBottom: "0.5px solid #e2e8f0", background: "#f8fafc", letterSpacing: "0.04em" }}>FRESH AMT</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#f59e0b", borderBottom: "0.5px solid #e2e8f0", background: "#f8fafc", letterSpacing: "0.04em" }}>MSTK AMT</th>
                              <th style={{ padding: "9px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#0f172a", borderBottom: "0.5px solid #e2e8f0", background: "#f8fafc", letterSpacing: "0.04em" }}>TOTAL</th>
                              <th style={{ padding: "9px 4px", borderBottom: "0.5px solid #e2e8f0", background: "#f8fafc" }} />
                            </tr>
                          </thead>
                          <tbody>
                            {surplusLines.map((line, index) => (
                              <tr key={index} style={{ borderBottom: "0.5px solid #f1f5f9", background: index % 2 === 0 ? "#fff" : "#fafafa" }}>
                                <td style={{ padding: "7px 10px" }}>
                                  <input type="text" placeholder="Product / description" value={line.description}
                                    onChange={e => updateSurplusLine(index, "description", e.target.value)}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: !line.description.trim() ? "1.5px solid #ef4444" : "0.5px solid #e2e8f0", fontSize: 12, boxSizing: "border-box" }} />
                                </td>
                                <td style={{ padding: "7px 5px" }}>
                                  <input type="number" placeholder="0" value={line.fresh_qty}
                                    onChange={e => updateSurplusLine(index, "fresh_qty", e.target.value)}
                                    style={{ width: "100%", padding: "6px", borderRadius: 6, border: "0.5px solid #bbf7d0", background: "#f0fdf4", fontSize: 12, textAlign: "right", boxSizing: "border-box" }} />
                                </td>
                                <td style={{ padding: "7px 5px" }}>
                                  <input type="number" placeholder="0" value={line.fresh_rate}
                                    onChange={e => updateSurplusLine(index, "fresh_rate", e.target.value)}
                                    style={{ width: "100%", padding: "6px", borderRadius: 6, border: "0.5px solid #bbf7d0", background: "#f0fdf4", fontSize: 12, textAlign: "right", boxSizing: "border-box" }} />
                                </td>
                                <td style={{ padding: "7px 5px" }}>
                                  <input type="number" placeholder="0"
                                    value={line.mistake_qty === "" ? "" : line.mistake_qty}
                                    onChange={e => updateSurplusLine(index, "mistake_qty", e.target.value)}
                                    onFocus={e => e.target.select()}
                                    style={{ width: "100%", padding: "6px", borderRadius: 6, border: "0.5px solid #fde68a", background: "#fffbeb", fontSize: 12, textAlign: "right", boxSizing: "border-box", color: "#92400e", fontWeight: 500, cursor: "text" }} />
                                </td>
                                <td style={{ padding: "7px 5px" }}>
                                  <input type="number" placeholder="0"
                                    value={line.mistake_rate === "" ? "" : line.mistake_rate}
                                    onChange={e => updateSurplusLine(index, "mistake_rate", e.target.value)}
                                    onFocus={e => e.target.select()}
                                    style={{ width: "100%", padding: "6px", borderRadius: 6, border: "0.5px solid #fde68a", background: "#fffbeb", fontSize: 12, textAlign: "right", boxSizing: "border-box", color: "#92400e", fontWeight: 500, cursor: "text" }} />
                                </td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#10b981", whiteSpace: "nowrap" }}>
                                  {line.fresh_amount > 0 ? `₹${line.fresh_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : <span style={{ color: "#cbd5e1" }}>—</span>}
                                </td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#f59e0b", whiteSpace: "nowrap" }}>
                                  {(parseFloat(line.mistake_qty || "0") * parseFloat(line.mistake_rate || "0")) > 0
                                    ? `₹${(parseFloat(line.mistake_qty || "0") * parseFloat(line.mistake_rate || "0")).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                                    : <span style={{ color: "#cbd5e1" }}>—</span>}
                                </td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                                  ₹{line.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                </td>
                                <td style={{ padding: "7px 4px", textAlign: "center" }}>
                                  {surplusLines.length > 1 && (
                                    <button onClick={() => removeSurplusLine(index)}
                                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: 0 }}>×</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                              <td style={{ padding: "10px 12px", fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                                TOTAL ({surplusLines.length} item{surplusLines.length > 1 ? "s" : ""})
                              </td>
                              <td style={{ padding: "10px 8px", textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: "#10b981" }}>{surplusTotals.fresh_qty > 0 ? `${surplusTotals.fresh_qty} pcs` : "—"}</td>
                              <td></td>
                              <td style={{ padding: "10px 8px", textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: "#f59e0b" }}>{surplusTotals.mistake_qty > 0 ? `${surplusTotals.mistake_qty} pcs` : "—"}</td>
                              <td></td>
                              <td style={{ padding: "10px 10px", textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: "#10b981", whiteSpace: "nowrap" }}>{surplusTotals.fresh_amount > 0 ? `₹${surplusTotals.fresh_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}</td>
                              <td style={{ padding: "10px 10px", textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: "#f59e0b", whiteSpace: "nowrap" }}>{surplusTotals.mistake_amount > 0 ? `₹${surplusTotals.mistake_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}</td>
                              <td style={{ padding: "10px 10px", textAlign: "right", fontSize: "0.88rem", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>₹{surplusTotals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td></td>
                            </tr>
                            {(surplusTransportCost || 0) > 0 && (
                              <tr style={{ background: "#f8fafc" }}>
                                <td colSpan={7} style={{ padding: "8px 12px", fontSize: "0.8rem", color: "#64748b" }}>Transport Cost</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "0.8rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>₹{(surplusTransportCost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                                <td></td>
                              </tr>
                            )}
                            <tr style={{ background: "#eff6ff", borderTop: "1px solid #bfdbfe" }}>
                              <td colSpan={7} style={{ padding: "11px 12px", fontSize: "0.88rem", fontWeight: 800, color: "#1e40af" }}>GRAND TOTAL (incl. transport)</td>
                              <td style={{ padding: "11px 10px", textAlign: "right", fontSize: "1rem", fontWeight: 900, color: "#1e40af", whiteSpace: "nowrap" }}>₹{surplusTotals.grand_total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <button onClick={addSurplusLine}
                      style={{ padding: "8px 16px", border: "0.5px dashed #cbd5e1", borderRadius: "8px", background: "transparent", fontSize: "0.85rem", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <FaPlus size={11} /> Add Row
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Section 2: Product Entry Table / Expense Table */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "10px" }}>
                {billCategory === "PRODUCT" ? <><FaBarcode color="#4f46e5" /> Items Breakdown</> : <><FaMoneyBillWave color="#4f46e5" /> Expense Details</>}
              </h3>
              {billCategory === "PRODUCT" && (
                <button onClick={() => setShowAddProductModal(true)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", borderRadius: "10px", padding: "8px 16px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaPlus /> New Product
                </button>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              {billCategory === "PRODUCT" ? (
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "15%" }} />
                    {billType === "TAX" && <col style={{ width: "12%" }} />}
                    <col style={{ width: billType === "TAX" ? "16%" : "28%" }} />
                    <col style={{ width: "4%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <th style={{ padding: "12px 14px", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Product Description</th>
                      <th style={{ padding: "12px 8px", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "center" }}>Qty</th>
                      <th style={{ padding: "12px 8px", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Rate (₹)</th>
                      {billType === "TAX" && (
                        <th style={{ padding: "12px 8px", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "center" }}>GST %</th>
                      )}
                      <th style={{ padding: "12px 8px", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Total (₹)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {items.map((item, idx) => (
                        <motion.tr key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px" }}>
                            <ProductCombobox
                              products={products}
                              value={item.id}
                              productName={item.name}
                              onSelect={({ id, name }) => handleProductSelect(idx, name, id)}
                              onNameChange={(name) => {
                                const t = [...items]; t[idx] = { ...t[idx], name }; setItems(t);
                              }}
                              onProductCreated={({ id, name }) => {
                                setProducts((prev: any[]) => [...prev, { id, name }]);
                                handleProductSelect(idx, name, id);
                              }}
                              style={{ padding: "9px 10px", borderRadius: "8px", fontSize: "0.88rem" }}
                              placeholder="Type or select product..."
                            />
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                              <input type="number" value={item.qty} min={1} onChange={e => {
                                  const t = [...items]; t[idx].qty = parseFloat(e.target.value) || 0; setItems(t);
                              }} style={{ width: "100%", padding: "9px 6px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, fontSize: "0.9rem", boxSizing: "border-box" }} />
                              <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 700 }}>{item.unit}</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            <input type="number" value={item.rate || ""} min={0} placeholder="0" onChange={e => {
                                const t = [...items]; t[idx].rate = parseFloat(e.target.value) || 0; setItems(t);
                            }} style={{ width: "100%", padding: "9px 8px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, fontSize: "0.9rem", boxSizing: "border-box" }} />
                          </td>
                          {billType === "TAX" && (
                            <td style={{ padding: "8px 6px" }}>
                              <select value={item.gstRate} onChange={e => {
                                  const t = [...items]; t[idx].gstRate = parseInt(e.target.value); setItems(t);
                              }} style={{ width: "100%", padding: "9px 6px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.85rem", boxSizing: "border-box" }}>
                                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                          )}
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                             <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "0.95rem" }}>
                               ₹{((item.qty * item.rate) + (billType === "TAX" ? (item.qty * item.rate * item.gstRate / 100) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <button onClick={() => handleRemoveItem(idx)} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", opacity: items.length > 1 ? 1 : 0.3 }}>
                              <FaTrash size={14} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <th style={{ padding: "15px", width: "250px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Expense Type</th>
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Description</th>
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right", width: "150px" }}>Amount (₹)</th>
                      {billType === "TAX" && (
                        <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "center", width: "100px" }}>GST %</th>
                      )}
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right", width: "160px" }}>Total (₹)</th>
                      <th style={{ padding: "15px", width: "50px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {expenses.map((exp, idx) => (
                        <motion.tr key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px" }}>
                            <select value={exp.expense_type} onChange={e => {
                                const t = [...expenses]; t[idx].expense_type = e.target.value; setExpenses(t);
                            }} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff" }}>
                                {['Freight / Transport', 'Labour Charges', 'Professional Fees', 'Rent', 'Electricity', 'Repair & Maintenance', 'Printing & Stationery', 'Advertisement', 'Bank Charges', 'Insurance', 'Other'].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                          </td>
                          <td style={{ padding: "10px" }}>
                             <input type="text" value={exp.description} onChange={e => {
                                 const t = [...expenses]; t[idx].description = e.target.value; setExpenses(t);
                             }} placeholder="What was this for?" style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
                          </td>
                          <td style={{ padding: "10px" }}>
                            <input type="number" value={exp.amount} min={0} onChange={e => {
                                const t = [...expenses]; t[idx].amount = parseFloat(e.target.value) || 0; setExpenses(t);
                            }} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }} />
                          </td>
                          {billType === "TAX" && (
                            <td style={{ padding: "10px" }}>
                              <select value={exp.tax_percent} onChange={e => {
                                  const t = [...expenses]; t[idx].tax_percent = parseInt(e.target.value); setExpenses(t);
                              }} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff" }}>
                                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                          )}
                          <td style={{ padding: "10px", textAlign: "right" }}>
                             <div style={{ fontWeight: 800, color: "#1e293b" }}>
                               ₹{(exp.amount + (billType === "TAX" ? (exp.amount * exp.tax_percent / 100) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <button onClick={() => handleRemoveItem(idx)} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", opacity: expenses.length > 1 ? 1 : 0.3 }}>
                              <FaTrash size={14} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>

            <button onClick={handleAddItem} style={{ marginTop: "20px", background: "#f8fafc", border: "2px dashed #e2e8f0", color: "#64748b", borderRadius: "12px", padding: "12px", width: "100%", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor = "#4f46e5"} onMouseOut={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
              <FaPlus /> {billCategory === "PRODUCT" ? "Add Line Item" : "Add Another Expense"}
            </button>
          </section>

          {/* Section 4: File Upload / Scan */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
             <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <FaFileUpload color="#4f46e5" /> Document Storage (Auditor-Ready)
             </h3>
             <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed #cbd5e1", borderRadius: "16px", padding: "30px", textAlign: "center", cursor: "pointer", background: billFile ? "#f0fdf4" : "#f8fafc", transition: "all 0.2s" }}>
                <input type="file" ref={fileInputRef} hidden onChange={e => setBillFile(e.target.files?.[0] || null)} />
                {billFile ? (
                  <div>
                    <FaFileInvoice size={32} color="#22c55e" style={{ marginBottom: "12px" }} />
                    <div style={{ fontWeight: 700, color: "#166534" }}>{billFile.name} Uploaded</div>
                    <div style={{ fontSize: "0.85rem", color: "#15803d" }}>Click to change document</div>
                  </div>
                ) : (
                  <div>
                    <FaCamera size={32} color="#94a3b8" style={{ marginBottom: "12px" }} />
                    <div style={{ fontWeight: 700, color: "#475569" }}>Click or Drag Bill to Upload</div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>PNG, JPG or PDF supported</div>
                  </div>
                )}
             </div>
          </section>
        </div>

        {/* Sidebar Summary */}
        <div style={{ position: "sticky", top: "30px", height: "fit-content" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a", marginBottom: "25px", borderBottom: "2px solid #f1f5f9", paddingBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FaCalculator color="#4f46e5" /> Bill Summary
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {isSurplus ? (
                <div style={{ marginTop: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #e2e8f0" }}>
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>Fresh Stock</span>
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {surplusTotals.fresh_qty > 0
                        ? `${surplusTotals.fresh_qty.toLocaleString("en-IN")} pcs = ₹${surplusTotals.fresh_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        : "0 pcs = ₹0"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #e2e8f0" }}>
                    <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 500 }}>Mistake Stock</span>
                    <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {surplusTotals.mistake_qty > 0
                        ? `${surplusTotals.mistake_qty.toLocaleString("en-IN")} pcs = ₹${surplusTotals.mistake_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        : "0 pcs = ₹0"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.95rem", color: "#64748b" }}>Subtotal</span>
                    <span style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>₹{surplusTotals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {(surplusTransportCost || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #e2e8f0" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Transport</span>
                      <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>₹{(surplusTransportCost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      Total ({(surplusTotals.fresh_qty + surplusTotals.mistake_qty).toLocaleString("en-IN")} pcs)
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#4f46e5", whiteSpace: "nowrap" }}>
                      ₹{surplusTotals.grand_total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "#64748b" }}>
                    <span>Subtotal</span>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>₹{totals.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {billType === "TAX" && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "#64748b" }}>
                      <span>Total Tax</span>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>₹{totals.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "#64748b" }}>
                    <span>Gross Total</span>
                    <span style={{ fontWeight: 800, color: "#0f172a" }}>₹{totals.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              <div style={{ padding: "15px", background: "#fef2f2", borderRadius: "12px", border: "1px solid #fee2e2" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#b91c1c", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  Cash Discount (₹)
                </label>
                <div style={{ position: "relative" }}>
                   <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontWeight: 700 }}>₹</span>
                   <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "10px 10px 10px 25px", borderRadius: "8px", border: "1px solid #fecaca", fontWeight: 800, color: "#b91c1c" }} />
                </div>
              </div>

              <div style={{ borderTop: "2px dashed #f1f5f9", paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>NET AMOUNT</span>
                <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#4f46e5" }}>
                  ₹{isSurplus
                    ? (surplusTotals.grand_total - discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })
                    : totals.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* ── Split Payment Section ──────────────────────────── */}
              <div style={{ background: "#f0f9ff", borderRadius: "16px", border: "1px solid #e0f2fe", overflow: "hidden", marginTop: "10px" }}>
                <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e0f2fe" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaCreditCard color="#0369a1" size={14} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase" }}>Payment Entries</span>
                  </div>
                  <button onClick={addPaymentRow} style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: "8px", padding: "5px 12px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaPlus size={10} /> Add Mode
                  </button>
                </div>

                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <AnimatePresence>
                    {payments.map((p, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }}
                        style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: "8px", alignItems: "center" }}>
                        <select value={p.mode} onChange={e => updatePayment(i, "mode", e.target.value)}
                          style={{ padding: "8px 6px", borderRadius: "8px", border: `1.5px solid ${MODE_COLORS[p.mode] || "#bae6fd"}`, fontSize: "0.78rem", fontWeight: 700, color: MODE_COLORS[p.mode] || "#0369a1", background: "#fff", cursor: "pointer" }}>
                          {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <input type="number" min={0} placeholder="Amount (₹)" value={p.amount || ""}
                          onChange={e => updatePayment(i, "amount", parseFloat(e.target.value) || 0)}
                          style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #bae6fd", fontWeight: 700, color: "#0369a1", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" }} />
                        <button onClick={() => removePaymentRow(i)} disabled={payments.length === 1}
                          style={{ background: "none", border: "none", color: "#f43f5e", cursor: payments.length === 1 ? "default" : "pointer", opacity: payments.length === 1 ? 0.3 : 1, padding: "6px" }}>
                          <FaTrash size={12} />
                        </button>
                        {/* Optional reference field (UTR / Cheque No) */}
                        {(p.mode === "BANK" || p.mode === "UPI" || p.mode === "CHEQUE") && (
                          <input type="text" placeholder={p.mode === "CHEQUE" ? "Cheque No." : "UTR / Ref No."}
                            value={p.reference} onChange={e => updatePayment(i, "reference", e.target.value)}
                            style={{ gridColumn: "1 / -1", padding: "7px 10px", borderRadius: "8px", border: "1px solid #bae6fd", fontSize: "0.78rem", color: "#475569", boxSizing: "border-box", width: "100%" }} />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Summary row */}
                <div style={{ padding: "12px 18px", borderTop: "1px solid #e0f2fe", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0369a1" }}>Total Paying Now</span>
                  <span style={{ fontWeight: 900, color: totals.totalPaid > totals.netTotal + 0.01 ? "#ef4444" : "#0369a1", fontSize: "1rem" }}>
                    ₹{totals.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Balance Payable */}
              {(() => {
                const isPaid = totals.balance <= 0 && totals.totalPaid > 0;
                const isPartial = totals.totalPaid > 0 && totals.balance > 0;
                const color = isPaid ? "#22c55e" : isPartial ? "#f59e0b" : "#ef4444";
                const label = isPaid ? "Fully Paid" : isPartial ? "Partial — Balance Due" : "Unpaid";
                return (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: isPaid ? "#f0fdf4" : isPartial ? "#fffbeb" : "#fef2f2", border: `1px solid ${color}22` }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 800, color, textTransform: "uppercase", marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Balance Payable</div>
                    </div>
                    <span style={{ fontWeight: 900, color, fontSize: "1.25rem" }}>₹{totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
                <button onClick={() => handleSave(false)} disabled={loading} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "1rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)" }}>
                  {loading ? "Saving..." : <><FaSave /> Save Purchase Bill</>}
                </button>
                <button onClick={() => handleSave(true)} disabled={loading} style={{ background: "#fff", color: "#4f46e5", border: "2px solid #4f46e5", borderRadius: "12px", padding: "14px", fontSize: "1rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                   Save & Print
                </button>
                <button onClick={saveDraft} disabled={loading}
                  style={{ background: "#fef9c3", color: "#854d0e", border: "1.5px dashed #fde047", borderRadius: "12px", padding: "12px", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  📋 Save Draft (Continue Later)
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "20px", padding: "20px", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaUserAlt color="#94a3b8" /> Broker Details
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
               <CustomSelect value={brokerId} onChange={(e: any) => setBrokerId(e.target.value)}>
                  <option value="">Select Broker</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </CustomSelect>
               <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input type="number" value={brokerCommRate} onChange={e => setBrokerCommRate(parseFloat(e.target.value) || 0)} placeholder="Rate %" style={{ width: "80px", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Commission %</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {showAddProductModal && <AddProductModal onClose={() => setShowAddProductModal(false)} onSuccess={() => {}} />}
      {showAddSupplierModal && <AddSupplierModal onClose={() => setShowAddSupplierModal(false)} onSuccess={() => {}} />}
    </div>
  );
};

export default SimplifiedPurchaseBill;
