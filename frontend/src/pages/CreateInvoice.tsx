// frontend/src/pages/CreateInvoice.tsx
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaPrint,
    FaSave,
    FaTimes,
    FaTrash
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../api/companyApi";
import { fetchProducts, Product } from "../api/productApi";
import { Customer } from "../api/userApi";
import CustomSelect from "../components/CustomSelect";
import PaymentPopup from "../components/PaymentPopup";
import { useTenant } from "../context/TenantContext";
import { useAuthUser } from "../hooks/useAuthUser";
import { useUsers } from "../hooks/useUsers";
import { apiFetch } from "../utils/api";
import "./CreateInvoice.css";
import "./Dashboard.css";
import "./PageShared.css";

const numberToWords = (n: number) => {
  const a = [
    "",
    "one ",
    "two ",
    "three ",
    "four ",
    "five ",
    "six ",
    "seven ",
    "eight ",
    "nine ",
    "ten ",
    "eleven ",
    "twelve ",
    "thirteen ",
    "fourteen ",
    "fifteen ",
    "sixteen ",
    "seventeen ",
    "eighteen ",
    "nineteen ",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const inWords = (num: number | string): string => {
    let n_str = num.toString();
    if (n_str.length > 9) return "overflow";
    let match = ("000000000" + n_str)
      .substr(-9)
      .match(new RegExp('^(\\d{2})(\\d{2})(\\d{2})(\\d{1})(\\d{2})$'));
    if (!match) return "";
    let str = "";
    str +=
      Number(match[1]) !== 0
        ? (a[Number(match[1])] ||
            b[Number(match[1][0])] + " " + a[Number(match[1][1])]) + "crore "
        : "";
    str +=
      Number(match[2]) !== 0
        ? (a[Number(match[2])] ||
            b[Number(match[2][0])] + " " + a[Number(match[2][1])]) + "lakh "
        : "";
    str +=
      Number(match[3]) !== 0
        ? (a[Number(match[3])] ||
            b[Number(match[3][0])] + " " + a[Number(match[3][1])]) + "thousand "
        : "";
    str +=
      Number(match[4]) !== 0
        ? (a[Number(match[4])] ||
            b[Number(match[4][0])] + " " + a[Number(match[4][1])]) + "hundred "
        : "";
    str +=
      Number(match[5]) !== 0
        ? (str !== "" ? "and " : "") +
          (a[Number(match[5])] ||
            b[Number(match[5][0])] + " " + a[Number(match[5][1])])
        : "";
    return str.toUpperCase();
  };
  const amount = Math.floor(n);
  const paise = Math.round((n - amount) * 100);
  let result = inWords(amount) + " RUPEES";
  if (paise > 0) result += " AND " + inWords(paise) + " PAISE";
  return result + " ONLY";
};

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface InvoiceItem {
  id: number;
  product_id?: number | null;  // links to products table for stock deduction
  desc: string;
  hsn: string;
  uom: string;
  qty: number;
  rate: number;
  gst_rate?: number | null;
}

/** Derive GST state code from state name when DB value is missing */
const STATE_CODES: Record<string, string> = {
  "ANDHRA PRADESH":"28","ARUNACHAL PRADESH":"12","ASSAM":"18","BIHAR":"10",
  "CHHATTISGARH":"22","GOA":"30","GUJARAT":"24","HARYANA":"06",
  "HIMACHAL PRADESH":"02","JAMMU AND KASHMIR":"01","J&K":"01","JHARKHAND":"20",
  "KARNATAKA":"29","KERALA":"32","LADAKH":"38","MADHYA PRADESH":"23","MP":"23",
  "MAHARASHTRA":"27","MANIPUR":"14","MEGHALAYA":"17","MIZORAM":"15",
  "NAGALAND":"13","ODISHA":"21","PUNJAB":"03","RAJASTHAN":"08","SIKKIM":"11",
  "TAMIL NADU":"33","TN":"33","TAMILNADU":"33","TELANGANA":"36","TRIPURA":"16",
  "UTTAR PRADESH":"09","UP":"09","UTTARAKHAND":"05","WEST BENGAL":"19","WB":"19",
  "ANDAMAN AND NICOBAR":"35","CHANDIGARH":"04","DADRA AND NAGAR HAVELI":"26",
  "DAMAN AND DIU":"25","DELHI":"07","LAKSHADWEEP":"31","PUDUCHERRY":"34",
};
function resolveCode(stateName?: string | null, existingCode?: string | null): string {
  if (existingCode && existingCode !== "---") return existingCode;
  if (!stateName || stateName === "---") return "";
  return STATE_CODES[stateName.toUpperCase().trim()] || "";
}

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();
  const { customers } = useUsers();
  const { user: authUser } = useAuthUser();
  const { activeBranch } = useTenant();

  const [products, setProducts] = useState<Product[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [company, setCompany] = useState({
    name: "COMPANY NAME",
    address: "COMPANY ADDRESS",
    gstin: "---",
    state: "TAMILNADU",
    stateCode: "33",
  });
  const [invoiceNo, setInvoiceNo] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: Date.now(), desc: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 },
  ]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [meta, setMeta] = useState({
    invoiceDate: new Date().toISOString().slice(0, 10),
    supplyDate: new Date().toISOString().slice(0, 10),
    transportation: "Road",
    vehicle: "",
    reverseCharge: "No",
    placeOfSupply: "TAMILNADU",
    placeOfSupplyCode: "33",
  });
  const [invoiceType, setInvoiceType] = useState<"TAX_INVOICE" | "NON_TAX_INVOICE" | "RETAIL_SALE" | "GIFTED_ITEM" | "NOMINAL_TAX_INVOICE">("TAX_INVOICE");
  const [paymentsList, setPaymentsList] = useState<{ amount: number; method: string; reference?: string }[]>([{ amount: 0, method: "CASH", reference: "" }]);
  const amountPaid = useMemo(() => paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [paymentsList]);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [activePaymentIndex, setActivePaymentIndex] = useState<number | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [customerAdvance, setCustomerAdvance] = useState<number>(0);
  const [returnItems, setReturnItems] = useState<InvoiceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "---",
    address: "---",
    gstin: "---",
    state: "---",
    code: "---",
  });
  const [brokerId, setBrokerId] = useState<number | "">("");
  const [brokerCommRate, setBrokerCommRate] = useState<number | "">("");
  const [gstState, setGstState] = useState({ cgst: 9, sgst: 9, igst: 0, totalRate: 18 });
  const [gstType, setGstType] = useState<"INTRA" | "INTER" | "NONE">("INTRA");
  const [bank] = useState({
    name: "ICICI BANK",
    account: "540305000194",
    ifsc: "ICIC0005403",
    bundles: "N{'/'}A",
  });
  const [shippedInfo, setShippedInfo] = useState({
    name: "",
    address: "",
    gstin: "",
    state: "",
    code: "",
    ph: "",
  });
  const [useShippedSame, setUseShippedSame] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, prodData, brokerData] = await Promise.all([
          fetchProfile().catch(() => ({})),
          fetchProducts().catch(() => []),
          apiFetch("/brokers").then(r => r.json()).catch(() => [])
        ]);

        const comp = p as any;
        if (comp && !comp.error && comp.company_name) {
          setCompany({
            name: (comp.company_name || "COMPANY NAME").toUpperCase(),
            address: (comp.address_line1 || "COMPANY ADDRESS").toUpperCase(),
            gstin: comp.gstin || "---",
            state: (comp.state || "TAMILNADU").toUpperCase(),
            stateCode: comp.state_code || "33",
          });
        }
        
        setProducts(Array.isArray(prodData) ? prodData : []);
        setBrokers(Array.isArray(brokerData) ? brokerData : []);
      } catch (err) {
        console.error("Failed to load invoice dependencies:", err);
      }
    };
    load();
  }, []);

  const handleProductSelect = (i: number, pid: string, isReturn = false) => {
    const prod = products.find((p) => p.id === parseInt(pid));
    if (prod) {
      const patch = {
        product_id: prod.id,              // ← critical for stock deduction
        desc: prod.name.toUpperCase(),
        hsn: prod.hsn_code || "",
        uom: prod.unit || "Pcs",
        rate: prod.selling_price || 0,
        gst_rate: prod.gst_percent ?? null, // ← preserve product-level GST rate
      };
      if (isReturn) {
        const t = [...returnItems];
        t[i] = { ...t[i], ...patch };
        setReturnItems(t);
      } else {
        const t = [...items];
        t[i] = { ...t[i], ...patch };
        setItems(t);
      }
    }
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setCustomerId(id);
    const c = customers.find((x: Customer) => x.id === id);
    if (c) {
      setCustomerInfo({
        name: c.username.toUpperCase(),
        address:
          `${c.address_line1 || ""}, ${c.city_pincode || ""}`.toUpperCase(),
        gstin: c.gstin || "---",
        state: c.state?.toUpperCase() || "---",
        code: resolveCode(c.state, c.state_code) || "---",
      });
      const resolvedCode = resolveCode(c.state, c.state_code);
      const isInterState = resolvedCode && resolvedCode !== company.stateCode;
      const currentTotal = gstState.totalRate;
      
      setGstType(isInterState ? "INTER" : "INTRA");
      
      if (isInterState) {
        setGstState({ cgst: 0, sgst: 0, igst: currentTotal, totalRate: currentTotal });
      } else {
        setGstState({ cgst: currentTotal * 0.5, sgst: currentTotal * 0.5, igst: 0, totalRate: currentTotal });
      }

      setMeta((prev) => ({
        ...prev,
        placeOfSupply: c.state?.toUpperCase() || "---",
        placeOfSupplyCode: c.state_code || "---",
      }));

      // Check for advance balance (remaining_balance < 0 means customer overpaid)
      const rawBalance = Number(c.remaining_balance ?? 0);
      const advance = rawBalance < 0 ? Math.abs(rawBalance) : 0;
      setCustomerAdvance(advance);
    } else {
      setCustomerAdvance(0);
    }
  };

  const updateItem = (i: number, key: keyof InvoiceItem, val: any, isReturn = false) => {
    if (isReturn) {
        const t = [...returnItems];
        (t[i] as any)[key] = val;
        setReturnItems(t);
    } else {
        const t = [...items];
        (t[i] as any)[key] = val;
        setItems(t);
    }
  };

  const totals = useMemo(() => {
    const taxable = items.reduce((s, i) => s + i.qty * i.rate, 0);
    const returnTaxable = returnItems.reduce((s, i) => s + i.qty * i.rate, 0);

    // Tax Invoice and Nominal Tax Invoice calculate GST
    const isTax = invoiceType === "TAX_INVOICE" || invoiceType === "NOMINAL_TAX_INVOICE";
    
    const cgstAmt = isTax ? taxable * (gstState.cgst * 0.01) : 0;
    const sgstAmt = isTax ? taxable * (gstState.sgst * 0.01) : 0;
    const igstAmt = isTax ? taxable * (gstState.igst * 0.01) : 0;
    const totalGst = cgstAmt + sgstAmt + igstAmt;

    const rcgstAmt = isTax ? returnTaxable * (gstState.cgst * 0.01) : 0;
    const rsgstAmt = isTax ? returnTaxable * (gstState.sgst * 0.01) : 0;
    const rigstAmt = isTax ? returnTaxable * (gstState.igst * 0.01) : 0;
    const totalReturnGst = rcgstAmt + rsgstAmt + rigstAmt;
    
    const saleTotal = taxable + totalGst;
    const returnTotal = returnTaxable + totalReturnGst;

    const grandTotal = saleTotal - returnTotal;
    
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalReturnQty = returnItems.reduce((s, i) => s + i.qty, 0);
    
    // Effective amount after discount is applied
    const effectiveTotal = Math.max(0, grandTotal - discount);
    
    // Auto-calculate pending and status
    const pendingAmount = invoiceType === "GIFTED_ITEM" ? 0 : Math.max(0, effectiveTotal - amountPaid);
    let paymentStatus = "UNPAID";
    if (amountPaid > 0 || discount > 0) {
      paymentStatus = (amountPaid + discount) >= grandTotal ? "PAID" : "PARTIALLY_PAID";
    }

    return {
      taxable,
      returnTaxable,
      cgstAmt,
      sgstAmt,
      igstAmt,
      totalGst,
      totalReturnGst,
      grandTotal,
      effectiveTotal,
      totalQty,
      totalReturnQty,
      pendingAmount,
      paymentStatus,
      totalReturnAmount: returnTotal
    };
  }, [items, returnItems, gstState, invoiceType, amountPaid, discount]);

  const emptyRows = useMemo(
    () => new Array(Math.max(0, 15 - items.length - returnItems.length)).fill(0),
    [items, returnItems],
  );

  const saveInvoice = async () => {
    if (isSaving) return; // prevent double-submit
    if (invoiceType !== "RETAIL_SALE" && !customerId) {
        return alert("Please select a customer for this invoice type. Retail Sale allows anonymous customers.");
    }

    if (invoiceType !== "GIFTED_ITEM" && (amountPaid + discount) > totals.grandTotal) {
        // Allow overpayment if they really want, but warn.
        // Actually, usually we don't want overpayment on a single invoice unless it creates a credit.
    }

    setIsSaving(true);
    try {
      const body = {
        invoice_number: invoiceNo,
        invoice_type: invoiceType,
        customer_id: customerId,
        // For each item, ensure gst_rate is set. If the product has no GST rate (0 or null),
        // fall back to the invoice-level GST rate the user selected (gstState.totalRate).
        items: items.filter((i) => i.desc && i.qty > 0).map(i => ({
          ...i,
          gst_rate: (i.gst_rate != null && Number(i.gst_rate) > 0) ? i.gst_rate : gstState.totalRate,
        })),
        return_items: returnItems.filter((i) => i.desc && i.qty > 0).map(i => ({
          ...i,
          gst_rate: (i.gst_rate != null && Number(i.gst_rate) > 0) ? i.gst_rate : gstState.totalRate,
        })),
        notes,
        grand_total: totals.grandTotal,
        discount_amount: discount,
        amount_paid: amountPaid,
        balance_due: totals.pendingAmount,
        payment_status: totals.paymentStatus,
        payments: paymentsList.filter(p => p.amount > 0).map(p => ({
            amount: p.amount,
            payment_method: p.method,
            payment_date: meta.invoiceDate,
            reference: p.reference || ""
        })),
        tax_details: gstState,
        logistics: meta,
        broker_id: brokerId || null,
        broker_commission_rate: brokerCommRate || null,
        branch_id: (activeBranch && (activeBranch as any).id !== 'all') ? (activeBranch as any).id : null,
      };
      const res = await apiFetch("/invoice", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        alert("Invoice saved successfully.");
        navigate("/invoices");
      } else {
        const error = await res.json();
        alert("Failed to save: " + (error.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Failure saving transaction.");
    } finally {
      setIsSaving(false);
    }
  };

  const thStyle: React.CSSProperties = {
    border: "1px solid #000",
    padding: "5px 6px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    backgroundColor: "#f5f5f5",
  };
  const tdStyle: React.CSSProperties = {
    border: "1px solid #000",
    padding: "5px 6px",
    fontSize: "11px",
  };

  const isSameState = company.stateCode === customerInfo.code;

  try {
    return (
    <div className="db-page">
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Sales</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">New Invoice</span>
        </div>
        <div className="db-topbar-right">
          <button className="page-btn-round-ghost" onClick={() => navigate(-1)}>
            <FaArrowLeft size={12} /> Back
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={saveInvoice} id="save-invoice-btn" disabled={isSaving} style={isSaving ? { opacity: 0.6, cursor: "not-allowed" } : {}}>
            <FaSave size={12} /> {isSaving ? "Saving…" : "Save Invoice"}
          </button>
        </div>
      </header>

      <div className="db-content" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div className="ci-split" style={{ border: 'none', boxShadow: 'none', borderRadius: '0', background: 'transparent' }}>
          {/* ═══════════ LEFT: FORM ═══════════ */}
          <div className="ci-form-pane" style={{ background: '#transparent' }}>
            {/* Form Inner Body (Scrolled) */}
            <div className="ci-form-body">
              <div className="db-page-header" style={{ marginBottom: '24px' }}>
                <h1 className="db-page-title">Create <strong>New Invoice</strong></h1>
                <p className="db-page-sub">Fill in the details below to generate a professional transaction record.</p>
              </div>
          {/* Invoice Details */}
          <div className="ci-card">
            <div className="ci-card-title">Invoice Details</div>
            
            <div className="ci-row-3">
              <div className="ci-field">
                <label>Invoice No <span style={{fontSize:"10px",color:"#888",fontWeight:400}}>(leave blank to auto-generate)</span></label>
                <input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value.toUpperCase())}
                  placeholder={
                    invoiceType === "TAX_INVOICE"          ? "Auto: 1, 2, 3… (TAX series)" :
                    invoiceType === "NOMINAL_TAX_INVOICE"  ? "Auto: 1, 2, 3… (NTX series)" :
                    invoiceType === "NON_TAX_INVOICE"      ? "Auto: 1, 2, 3… (INV series)" :
                    invoiceType === "RETAIL_SALE"          ? "Auto: 1, 2, 3… (RET series)" :
                    invoiceType === "GIFTED_ITEM"          ? "Auto: 1, 2, 3… (GFT series)" :
                    "Auto-generated if left blank"
                  }
                />
              </div>
              <div className="ci-field">
                <label>Invoice Type</label>
                <div style={{ marginTop: '8px' }}>
                  <CustomSelect
                    value={invoiceType}
                    onChange={(e: any) => setInvoiceType(e.target.value as any)}
                    disableSearch
                  >
                    <option value="TAX_INVOICE">TAX INVOICE (GST)</option>
                    <option value="NOMINAL_TAX_INVOICE">NOMINAL TAX INVOICE</option>
                    <option value="NON_TAX_INVOICE">NON-TAX INVOICE</option>
                    <option value="RETAIL_SALE">RETAIL SALE (No Customer Req.)</option>
                    <option value="GIFTED_ITEM">GIFTED ITEM</option>
                  </CustomSelect>
                </div>
              </div>
              
              <div className="ci-field">
                <label>Invoice Date</label>
                <input
                  type="date"
                  value={meta.invoiceDate}
                  onChange={(e) => setMeta({ ...meta, invoiceDate: e.target.value })}
                />
              </div>
            </div>

            {gstType !== "NONE" && customerId && (
              <div style={{ marginTop: '16px', padding: '12px', background: gstType === "INTRA" ? '#f0fdf4' : '#eff6ff', borderRadius: '12px', border: `1px solid ${gstType === "INTRA" ? '#bbf7d0' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    background: gstType === "INTRA" ? '#16a34a' : '#2563eb', 
                    color: '#fff', 
                    borderRadius: '100px', 
                    fontSize: '10px', 
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    {gstType === "INTRA" ? "Intra-State" : "Inter-State"}
                  </span>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                    {gstType === "INTRA" ? "CGST + SGST applied" : "IGST applied"}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Party State: <strong>{customerInfo.state} ({customerInfo.code})</strong>
                </div>
              </div>
            )}

            <div className="ci-row-2" style={{ marginTop: '16px' }}>
              <div className="ci-field">
                <label>Supply Date</label>
                <input
                  type="date"
                  value={meta.supplyDate}
                  onChange={(e) => setMeta({ ...meta, supplyDate: e.target.value })}
                />
              </div>
              <div className="ci-field">
                <label>Place of Supply</label>
                <input
                  value={meta.placeOfSupply}
                  onChange={(e) => setMeta({ ...meta, placeOfSupply: e.target.value.toUpperCase() })}
                  placeholder="TAMILNADU"
                />
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="ci-card">
            <div className="ci-card-title">Customer {invoiceType === "RETAIL_SALE" ? "(Optional)" : "*"}</div>
            <div className="ci-field">
              <div style={{ marginTop: "8px" }}>
                <CustomSelect
                  onChange={handleCustomerSelect}
                  value={customerId || ""}
                  placeholder="-- Choose Customer --"
                >
                  <option value="">-- Choose Customer --</option>
                  {Array.isArray(customers) && customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
                </CustomSelect>
              </div>
            </div>
          </div>

          {/* Broker */}
          <div className="ci-card" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div className="ci-card-title" style={{ color: '#0369a1' }}>Link Broker (Optional)</div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>Broker Name</label>
                <div style={{ marginTop: '8px' }}>
                  <CustomSelect
                    value={brokerId}
                    onChange={(e: any) => {
                      const id = parseInt(e.target.value);
                      setBrokerId(id);
                      const b = brokers.find(x => x.id === id);
                      if (b) setBrokerCommRate(b.commission_rate);
                    }}
                  >
                    <option value="">-- No Broker --</option>
                    {Array.isArray(brokers) && brokers.filter(b => b.broker_type !== 'PURCHASE').map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>
              <div className="ci-field">
                <label>Commission Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={brokerCommRate}
                  onChange={(e) => setBrokerCommRate(parseFloat(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="ci-card">
            <div className="ci-card-title">Billed To</div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>Name</label>
                <input
                  value={customerInfo.name}
                  onChange={(e) =>
                    setCustomerInfo({
                      ...customerInfo,
                      name: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Customer Name"
                />
              </div>
              <div className="ci-field">
                <label>GSTIN</label>
                <input
                  value={customerInfo.gstin}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, gstin: e.target.value })
                  }
                  placeholder="GSTIN"
                />
              </div>
            </div>
            <div className="ci-field" style={{ marginTop: "10px" }}>
              <label>Address</label>
              <input
                value={customerInfo.address}
                onChange={(e) =>
                  setCustomerInfo({
                    ...customerInfo,
                    address: e.target.value.toUpperCase(),
                  })
                }
                placeholder="Address"
              />
            </div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>State</label>
                <input
                  value={customerInfo.state}
                  onChange={(e) =>
                    setCustomerInfo({
                      ...customerInfo,
                      state: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="TAMILNADU"
                />
              </div>
              <div className="ci-field">
                <label>State Code</label>
                <input
                  value={customerInfo.code}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, code: e.target.value })
                  }
                  placeholder="33"
                />
              </div>
            </div>
          </div>

          {/* Shipped To */}
          <div className="ci-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="ci-card-title" style={{ marginBottom: 0 }}>
                Shipped To
              </div>
              <label className="ci-same-check">
                <input
                  type="checkbox"
                  checked={useShippedSame}
                  onChange={(e) => setUseShippedSame(e.target.checked)}
                />
                Same as Billed
              </label>
            </div>
            {useShippedSame ? (
              <div className="ci-customer-info" style={{ marginTop: "10px" }}>
                <span>
                  <strong>{customerInfo.name}</strong>
                </span>
                <span>{customerInfo.address}</span>
                <span>
                  GSTIN: {customerInfo.gstin} | State: {customerInfo.state} (
                  {customerInfo.code})
                </span>
              </div>
            ) : (
              <>
                <div className="ci-row-2">
                  <div className="ci-field">
                    <label>Name</label>
                    <input
                      value={shippedInfo.name}
                      onChange={(e) =>
                        setShippedInfo({
                          ...shippedInfo,
                          name: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Consignee Name"
                    />
                  </div>
                  <div className="ci-field">
                    <label>GSTIN</label>
                    <input
                      value={shippedInfo.gstin}
                      onChange={(e) =>
                        setShippedInfo({
                          ...shippedInfo,
                          gstin: e.target.value,
                        })
                      }
                      placeholder="GSTIN"
                    />
                  </div>
                </div>
                <div className="ci-field" style={{ marginTop: "10px" }}>
                  <label>Address</label>
                  <input
                    value={shippedInfo.address}
                    onChange={(e) =>
                      setShippedInfo({
                        ...shippedInfo,
                        address: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Address"
                  />
                </div>
                <div className="ci-row-2">
                  <div className="ci-field">
                    <label>State</label>
                    <input
                      value={shippedInfo.state}
                      onChange={(e) =>
                        setShippedInfo({
                          ...shippedInfo,
                          state: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="State"
                    />
                  </div>
                  <div className="ci-field">
                    <label>State Code</label>
                    <input
                      value={shippedInfo.code}
                      onChange={(e) =>
                        setShippedInfo({ ...shippedInfo, code: e.target.value })
                      }
                      placeholder="33"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Transport */}
          <div className="ci-card">
            <div className="ci-card-title">Transport & Tax</div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>Transport Mode</label>
                <input
                  value={meta.transportation}
                  onChange={(e) =>
                    setMeta({ ...meta, transportation: e.target.value })
                  }
                  placeholder="Road"
                />
              </div>
              <div className="ci-field">
                <label>Vehicle No.</label>
                <input
                  value={meta.vehicle}
                  onChange={(e) =>
                    setMeta({ ...meta, vehicle: e.target.value.toUpperCase() })
                  }
                  placeholder="TN 38 BU 1234"
                />
              </div>
            </div>
            <div className="ci-row-1">
              <div className="ci-field">
                <label>GST Rate (%)</label>
                <div style={{ marginTop: '8px' }}>
                  <CustomSelect
                    value={gstState.totalRate}
                    onChange={(e: any) => {
                      const val = Number(e.target.value);
                      if (gstType === "INTER") {
                        setGstState({ cgst: 0, sgst: 0, igst: val, totalRate: val });
                      } else {
                        setGstState({ cgst: val * 0.5, sgst: val * 0.5, igst: 0, totalRate: val });
                      }
                    }}
                    disableSearch
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </CustomSelect>
                </div>
              </div>
            </div>
            <div className="ci-row-3" style={{ opacity: 0.7, pointerEvents: 'none' }}>
              <div className="ci-field">
                <label>CGST %</label>
                <input type="number" value={gstState.cgst} readOnly />
              </div>
              <div className="ci-field">
                <label>SGST %</label>
                <input type="number" value={gstState.sgst} readOnly />
              </div>
              <div className="ci-field">
                <label>IGST %</label>
                <input type="number" value={gstState.igst} readOnly />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="ci-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="ci-card-title" style={{ marginBottom: 0 }}>
                Line Items
              </div>
              <button
                className="page-btn-round"
                style={{ padding: '6px 16px', fontSize: '0.72rem' }}
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      id: Date.now(),
                      desc: "",
                      hsn: "",
                      uom: "Pcs",
                      qty: 0,
                      rate: 0,
                    },
                  ])
                }
              >
                <FaPlus size={10} /> Add Item
              </button>
            </div>
            <AnimatePresence mode="popLayout">
              {items.map((it, i) => (
                <motion.div
                  key={it.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="ci-item-card"
                >
                  <div className="ci-item-num">{i + 1}</div>
                  <div className="ci-item-fields">
                    <div className="ci-field" style={{ marginBottom: "8px" }}>
                      <label>Product</label>
                      <CustomSelect
                        onChange={(e) => handleProductSelect(i, e.target.value)}
                        style={{ fontSize: "0.8rem" }}
                      >
                        <option value="">Autofill from catalog...</option>
                        {Array.isArray(products) && products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </CustomSelect>
                    </div>
                    <div className="ci-row-2" style={{ marginBottom: "8px" }}>
                      <div className="ci-field">
                        <label>Description</label>
                        <input
                          value={it.desc}
                          onChange={(e) =>
                            updateItem(i, "desc", e.target.value.toUpperCase())
                          }
                          placeholder="Item name"
                        />
                      </div>
                      <div className="ci-field">
                        <label>HSN</label>
                        <input
                          value={it.hsn}
                          onChange={(e) => updateItem(i, "hsn", e.target.value)}
                          placeholder="6103"
                        />
                      </div>
                    </div>
                    <div className="ci-row-3">
                      <div className="ci-field">
                        <label>Qty</label>
                        <input
                          type="number"
                          value={it.qty || ""}
                          onChange={(e) =>
                            updateItem(i, "qty", Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="ci-field">
                        <label>Rate ₹</label>
                        <input
                          type="number"
                          value={it.rate || ""}
                          onChange={(e) =>
                            updateItem(i, "rate", Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="ci-field">
                        <label>Amount</label>
                        <div className="ci-amount-display">
                          ₹{fmt(it.qty * it.rate)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button
                      className="ci-item-delete"
                      onClick={() =>
                        setItems(items.filter((_, idx) => idx !== i))
                      }
                    >
                      <FaTrash size={9} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Return Section */}
          <div className="ci-card" style={{ borderLeft: '4px solid #ef4444', background: '#fff' }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="ci-card-title" style={{ marginBottom: 0 }}>Return Pcs?</div>
                <p style={{ fontSize: '0.65rem', color: '#64748b', margin: '4px 0 0 0' }}>Add items being returned to reduce from this bill.</p>
              </div>
              <button
                className="page-btn-round"
                style={{ padding: '6px 16px', fontSize: '0.72rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                onClick={() =>
                  setReturnItems([
                    ...returnItems,
                    {
                      id: Date.now(),
                      desc: "",
                      hsn: "",
                      uom: "Pcs",
                      qty: 0,
                      rate: 0,
                    },
                  ])
                }
              >
                <FaPlus size={10} /> Add Return
              </button>
            </div>
            
            <AnimatePresence mode="popLayout">
              {returnItems.map((it, i) => (
                <motion.div
                  key={it.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px dashed #fecaca' }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '4px' }}>Product to Return</label>
                        <CustomSelect
                            onChange={(e) => handleProductSelect(i, e.target.value, true)}
                            style={{ fontSize: "0.75rem" }}
                        >
                            <option value="">Select product...</option>
                              {Array.isArray(products) && products.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                            ))}
                        </CustomSelect>
                        <input
                          value={it.desc}
                          onChange={(e) => updateItem(i, "desc", e.target.value.toUpperCase(), true)}
                          placeholder="Or type description..."
                          style={{ marginTop: '6px', fontSize: '0.75rem', height: '28px' }}
                        />
                    </div>
                    <div style={{ width: '60px' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Qty</label>
                        <input
                          type="number"
                          value={it.qty || ""}
                          onChange={(e) => updateItem(i, "qty", Number(e.target.value), true)}
                          style={{ fontSize: '0.75rem', height: '28px' }}
                        />
                    </div>
                    <div style={{ width: '80px' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Rate ₹</label>
                        <input
                          type="number"
                          value={it.rate || ""}
                          onChange={(e) => updateItem(i, "rate", Number(e.target.value), true)}
                          style={{ fontSize: '0.75rem', height: '28px' }}
                        />
                    </div>
                    <button
                      onClick={() => setReturnItems(returnItems.filter((_, idx) => idx !== i))}
                      style={{ marginTop: '22px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {returnItems.length > 0 && (
                <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>
                    Total Return Credit: ₹{fmt(totals.totalReturnAmount)}
                </div>
            )}
          </div>

          {/* Payment & Summary */}
          <div className="ci-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <div className="ci-card-title" style={{ marginBottom: 0 }}>Payment Details</div>
              <button 
                onClick={() => setPaymentsList([...paymentsList, { amount: 0, method: "CASH", reference: "" }])}
                style={{ padding: "6px 12px", background: "#f1f5f9", color: "#4f46e5", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <FaPlus /> Add Split
              </button>
            </div>
            
            {paymentsList.map((payment, index) => (
              <div key={index} style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "10px", position: "relative" }}>
                {paymentsList.length > 1 && (
                  <button 
                    onClick={() => setPaymentsList(paymentsList.filter((_, i) => i !== index))}
                    style={{ position: "absolute", right: "-8px", top: "-8px", width: "24px", height: "24px", borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}
                  >
                    <FaTimes size={10} />
                  </button>
                )}
                <div className="ci-row-2">
                  <div className="ci-field">
                    <label>Amount Paid (₹)</label>
                    <input
                      type="number"
                      value={payment.amount || ""}
                      onChange={(e) => {
                        const newArr = [...paymentsList];
                        newArr[index].amount = Number(e.target.value);
                        setPaymentsList(newArr);
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="ci-field">
                    <label>Payment Method</label>
                    <div style={{ marginTop: '8px' }}>
                        <CustomSelect 
                          value={payment.method} 
                          onChange={(e: any) => {
                            const newArr = [...paymentsList];
                            newArr[index].method = e.target.value;
                            setPaymentsList(newArr);
                          }}
                          disableSearch
                        >
                          <option value="CASH">CASH</option>
                          <option value="BANK">BANK {'/'} CARD</option>
                          <option value="UPI">UPI {'/'} QR SCAN</option>
                        </CustomSelect>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "12px" }}>
                    <button 
                      onClick={() => { setActivePaymentIndex(index); setShowPaymentPopup(true); }}
                      style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "2px dashed #4f46e5", background: "#f5f3ff", color: "#4f46e5", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.8rem" }}
                    >
                      💳 {payment.method === "CASH" ? "Show Digital Payment Options" : `Set via Digital (${payment.method})`}
                    </button>
                </div>
              </div>
            ))}

            {/* Advance Balance Banner */}
            {customerAdvance > 0 && (
              <div style={{ marginTop: '12px', padding: '12px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>Advance Balance Available</div>
                  <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: '2px' }}>Customer has overpaid — apply to reduce this bill</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#15803d' }}>₹{fmt(customerAdvance)}</span>
                  <button
                    type="button"
                    onClick={() => setDiscount(Math.min(customerAdvance, totals.grandTotal))}
                    style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Discount Row */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <div className="ci-field" style={{ flex: 1 }}>
                <label>Discount {'/'} Waiver (₹)</label>
                <input
                  type="number"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              {totals.pendingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setDiscount(totals.pendingAmount + discount)}
                  style={{
                    padding: '8px 14px',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#92400e',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Waive ₹{fmt(totals.pendingAmount)}
                </button>
              )}
            </div>
            
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginTop: '16px', border: '1px solid #e2e8f0' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                   <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Gross Sale Total</span>
                   <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>₹{fmt(totals.taxable + totals.totalGst)}</span>
               </div>
               {returnItems.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Less: Return Credits</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444' }}>- ₹{fmt(totals.totalReturnAmount)}</span>
                  </div>
               )}
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                   <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Net Bill Amount</span>
                   <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>₹{fmt(totals.grandTotal)}</span>
               </div>
               {discount > 0 && (
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                     <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>Discount {'/'} Waiver</span>
                     <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>- ₹{fmt(discount)}</span>
                 </div>
               )}
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                   <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Net Payable</span>
                   <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>₹{fmt(totals.effectiveTotal)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                   <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Amount Paid</span>
                   <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#16a34a' }}>₹{fmt(amountPaid)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                   <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800 }}>Pending Balance</span>
                   <span style={{ fontSize: '1rem', fontWeight: 900, color: totals.pendingAmount > 0 ? '#ef4444' : '#16a34a' }}>₹{fmt(totals.pendingAmount)}</span>
               </div>
               <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.7rem', padding: '4px 12px', background: totals.paymentStatus === 'PAID' ? '#dcfce7' : totals.paymentStatus === 'UNPAID' ? '#fee2e2' : '#fef9c3', color: totals.paymentStatus === 'PAID' ? '#166534' : totals.paymentStatus === 'UNPAID' ? '#991b1b' : '#854d0e', borderRadius: '4px', fontWeight: 700 }}>
                     {totals.paymentStatus}
                   </span>
                   <span style={{ fontSize: '0.7rem', padding: '4px 12px', background: '#eff6ff', color: '#1e40af', borderRadius: '4px', fontWeight: 700 }}>
                     {invoiceType.replaceAll('_', ' ')}
                   </span>
               </div>
            </div>
          </div>
          
          {/* Notes */}
          <div className="ci-card">
            <div className="ci-card-title">Notes</div>
            <div className="ci-field">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special instructions..."
              />
            </div>
          </div>

          {/* Summary Footer */}
          <div className="ci-form-footer">
            <div>
              <div className="ci-footer-label">{discount > 0 ? "Net Payable" : "Grand Total"}</div>
              <div className="ci-footer-total">₹{fmt(totals.effectiveTotal)}</div>
              {discount > 0 && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Bill: ₹{fmt(totals.grandTotal)} − Discount: ₹{fmt(discount)}
                </div>
              )}
            </div>
            <button className="page-btn-round" onClick={() => window.print()}>
              <FaPrint size={12} /> Print
            </button>
          </div>
        </div>
        </div>
      {/* ═══════════ RIGHT: PREVIEW ═══════════ */}
      <div className="ci-preview-pane no-print-hide">
        <div className="ci-preview-scroll">
          <div
            className="invoice-wrapper"
            style={{
              width: "210mm",
              height: "297mm",
              backgroundColor: "#fff",
              boxShadow: "0 0 20px rgba(0,0,0,0.1)",
              padding: "10mm 15mm",
              position: "relative",
              transform: "scale(0.8)",
              transformOrigin: "top center",
              marginBottom: "-20%",
              overflow: "hidden",
            }}
          >
            <div style={{ border: "1px solid #000", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%) rotate(-45deg)",
                  fontSize: "80px",
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.03)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  zIndex: 0,
                  textTransform: "uppercase",
                }}
              >
                {company.name}
              </div>

              {/* Header */}
              <div
                style={{
                  borderBottom: "1px solid #000",
                  padding: "10px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "18px",
                    fontWeight: 700,
                    textAlign: "center",
                    marginBottom: "5px",
                  }}
                >
                  {company.name}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {company.address}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "5px",
                    marginTop: "5px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700 }}>
                    GSTIN No.:
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 700 }}>
                    {company.gstin}
                  </span>
                </div>
              </div>

              <div
                style={{
                  borderBottom: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
                }}
              >
                <h2
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    margin: 0,
                    letterSpacing: "1px",
                  }}
                >
                  INVOICE
                </h2>
              </div>

              {/* Top Info Grid */}
              <div
                style={{
                  borderBottom: "1px solid #000",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  fontSize: "11px",
                }}
              >
                <div style={{ borderRight: "1px solid #000", padding: "8px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr",
                      gap: "5px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Invoice No:</span>
                    <span>{invoiceNo || "---"}</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr",
                      gap: "5px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Invoice Date:</span>
                    <span>
                      {new Date(meta.invoiceDate).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ fontWeight: 700 }}>State:</span>
                    <span>{company.state}</span>
                    <span style={{ fontWeight: 700, marginLeft: "10px" }}>
                      Code:
                    </span>
                    <span>{company.stateCode}</span>
                  </div>
                </div>
                <div style={{ padding: "8px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr",
                      gap: "5px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>
                      Transportation Mode:
                    </span>
                    <span>{meta.transportation || "N{'/'}A"}</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr",
                      gap: "5px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Vehicle Number:</span>
                    <span>{meta.vehicle || "N{'/'}A"}</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr",
                      gap: "5px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Date of Supply:</span>
                    <span>
                      {new Date(meta.supplyDate).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ fontWeight: 700 }}>Place of Supply:</span>
                    <span>{meta.placeOfSupply}</span>
                    <span style={{ fontWeight: 700, marginLeft: "10px" }}>
                      Code:
                    </span>
                    <span>{meta.placeOfSupplyCode}</span>
                  </div>
                </div>
              </div>

              {/* Parties Section */}
              <div
                style={{
                  borderBottom: "1px solid #000",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  fontSize: "10px",
                }}
              >
                <div style={{ borderRight: "1px solid #000", padding: "8px" }}>
                  <p
                    style={{
                      fontWeight: 700,
                      textDecoration: "underline",
                      marginBottom: "5px",
                      margin: 0,
                    }}
                  >
                    Details of Receiver{'/'}Billed To:
                  </p>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "11px",
                      marginBottom: "2px",
                      marginTop: "4px",
                    }}
                  >
                    {customerInfo.name || "---"}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    {customerInfo.address || "---"}
                  </div>
                  <div
                    style={{ display: "flex", gap: "5px", marginBottom: "2px" }}
                  >
                    <span style={{ fontWeight: 700 }}>GSTIN:</span>
                    <span>{customerInfo.gstin || "---"}</span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ fontWeight: 700 }}>State:</span>
                    <span>{customerInfo.state || "---"}</span>
                    <span style={{ fontWeight: 700, marginLeft: "10px" }}>
                      Code:
                    </span>
                    <span>{customerInfo.code || "---"}</span>
                  </div>
                </div>
                <div style={{ padding: "8px" }}>
                  <p
                    style={{
                      fontWeight: 700,
                      textDecoration: "underline",
                      marginBottom: "5px",
                      margin: 0,
                    }}
                  >
                    Details of Consignee{'/'}Shipped To:
                  </p>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "11px",
                      marginBottom: "2px",
                      marginTop: "4px",
                    }}
                  >
                    {company.name}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    {company.address}
                  </div>
                  <div
                    style={{ display: "flex", gap: "5px", marginBottom: "2px" }}
                  >
                    <span style={{ fontWeight: 700 }}>PH:</span>
                    <span>---</span>
                  </div>
                  <div
                    style={{ display: "flex", gap: "5px", marginBottom: "2px" }}
                  >
                    <span style={{ fontWeight: 700 }}>GSTIN:</span>
                    <span>{company.gstin}</span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ fontWeight: 700 }}>State:</span>
                    <span>{company.state}</span>
                    <span style={{ fontWeight: 700, marginLeft: "10px" }}>
                      Code:
                    </span>
                    <span>{company.stateCode}</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "none",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8f8f8" }}>
                    <th style={{ ...thStyle, width: "5%" }}>S.No</th>
                    <th style={{ ...thStyle, width: "35%", textAlign: "left" }}>
                      Description
                    </th>
                    <th style={{ ...thStyle, width: "10%", textAlign: "center" }}>HSN</th>
                    <th style={{ ...thStyle, width: "8%", textAlign: "right" }}>
                      Qty
                    </th>
                    <th
                      style={{ ...thStyle, width: "10%", textAlign: "right" }}
                    >
                      Rate
                    </th>
                    <th
                      style={{ ...thStyle, width: "12%", textAlign: "right" }}
                    >
                      Taxable
                    </th>
                    {invoiceType === "TAX_INVOICE" && (
                      <>
                        <th
                          style={{ ...thStyle, width: "5%", textAlign: "right" }}
                        >
                          GST%
                        </th>
                        <th
                          style={{ ...thStyle, width: "15%", textAlign: "right" }}
                        >
                          Amount
                        </th>
                      </>
                    )}
                    {invoiceType !== "TAX_INVOICE" && (
                      <th
                        style={{ ...thStyle, width: "15%", textAlign: "right" }}
                      >
                        Amount
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const taxable = (it.qty || 0) * (it.rate || 0);
                    const gstPct =
                      gstState.cgst + gstState.sgst + gstState.igst;
                    const gstVal = taxable * (gstPct * 0.01);
                    const total = invoiceType === "TAX_INVOICE" ? taxable + gstVal : taxable;
                    return (
                      <tr key={it.id}>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {idx + 1}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "left" }}>{it.desc || "---"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {it.hsn || "-"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {it.qty || "-"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(it.rate)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(taxable)}
                        </td>
                        {invoiceType === "TAX_INVOICE" && (
                          <>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {gstPct}%
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {fmt(total)}
                            </td>
                          </>
                        )}
                        {invoiceType !== "TAX_INVOICE" && (
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              fontWeight: 600,
                            }}
                          >
                            {fmt(total)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {emptyRows.map((_, i) => (
                    <tr key={`empty-${i}`} style={{ height: "22px" }}>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      {invoiceType === "TAX_INVOICE" && (
                        <>
                          <td style={tdStyle}></td>
                          <td style={tdStyle}></td>
                        </>
                      )}
                      {invoiceType !== "TAX_INVOICE" && (
                        <td style={tdStyle}></td>
                      )}
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: "#f8f8f8" }}>
                    <td colSpan={2} style={{ ...tdStyle, textAlign: "right" }}>Total</td>
                    <td style={tdStyle}></td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {totals.totalQty.toFixed(2)}
                    </td>
                    <td style={tdStyle}></td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {fmt(totals.taxable)}
                    </td>
                    {invoiceType === "TAX_INVOICE" && (
                      <>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(totals.totalGst)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(totals.grandTotal)}
                        </td>
                      </>
                    )}
                    {invoiceType !== "TAX_INVOICE" && (
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {fmt(totals.taxable)}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>

              {/* Lower Section */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr",
                  fontSize: "11px",
                }}
              >
                <div style={{ borderRight: "1px solid #000", padding: "10px" }}>
                  <p
                    style={{
                      fontWeight: 700,
                      marginBottom: "2px",
                      marginTop: 0,
                      fontSize: "11px",
                    }}
                  >
                    Total Amount in words:
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      fontStyle: "italic",
                      fontWeight: 500,
                      marginBottom: "10px",
                    }}
                  >
                    {numberToWords(Math.round(totals.effectiveTotal))}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      marginBottom: "10px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Bundles:</span>
                    <span>N{'/'}A</span>
                  </div>

                  <p
                    style={{
                      fontWeight: 700,
                      textDecoration: "underline",
                      marginBottom: "4px",
                      marginTop: 0,
                    }}
                  >
                    Bank Details:
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px 1fr",
                      rowGap: "2px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>BANK NAME:</span>
                    <span>{bank.name}</span>
                    <span style={{ fontWeight: 700 }}>A{'/'}C NO:</span>
                    <span>{bank.account}</span>
                    <span style={{ fontWeight: 700 }}>IFSC NO:</span>
                    <span>{bank.ifsc}</span>
                  </div>

                  <div style={{ marginTop: "15px" }}>
                    <p style={{ fontWeight: 700, margin: 0 }}>Notes:</p>
                    <p style={{ margin: 0 }}>{notes}</p>
                  </div>

                  <p
                    style={{
                      marginTop: "30px",
                      color: "#666",
                      fontSize: "10px",
                    }}
                  >
                    (Common Seal)
                  </p>
                </div>
                <div style={{ padding: "10px" }}>
                  {invoiceType === "TAX_INVOICE" && (
                    <div
                      style={{
                        borderBottom: "1px solid #ddd",
                        paddingBottom: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "4px",
                          fontSize: "11px",
                        }}
                      >
                        <span>Total Before Tax</span>
                        <span style={{ fontWeight: 600 }}>{fmt(totals.taxable)}</span>
                      </div>
                      {isSameState && gstState.cgst > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                            fontSize: "11px",
                          }}
                        >
                          <span>Add: CGST {gstState.cgst}%</span>
                          <span>{fmt(totals.cgstAmt)}</span>
                        </div>
                      )}
                      {isSameState && gstState.sgst > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                            fontSize: "11px",
                          }}
                        >
                          <span>Add: SGST {gstState.sgst}%</span>
                          <span>{fmt(totals.sgstAmt)}</span>
                        </div>
                      )}
                      {!isSameState && gstState.igst > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                            fontSize: "11px",
                          }}
                        >
                          <span>Add: IGST {gstState.igst}%</span>
                          <span>{fmt(totals.igstAmt)}</span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: 700,
                          borderTop: "1px solid #000",
                          paddingTop: "4px",
                          marginTop: "4px",
                          fontSize: "12px",
                        }}
                      >
                        <span>Total{discount > 0 ? " (After Discount)" : " After Tax"}</span>
                        <span>{fmt(totals.effectiveTotal)}</span>
                      </div>
                    </div>
                  )}
                  {invoiceType !== "TAX_INVOICE" && (
                    <div
                      style={{
                        borderBottom: "1px solid #ddd",
                        paddingBottom: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        <span>Total{discount > 0 ? " (After Discount)" : " Amount"}</span>
                        <span>{fmt(totals.effectiveTotal)}</span>
                      </div>
                    </div>
                  )}

                  {invoiceType === "TAX_INVOICE" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        fontWeight: 700,
                        marginBottom: "20px",
                        fontSize: "10px",
                      }}
                    >
                      <span>GST Payable on Reverse Charge:</span>
                      <span>{meta.reverseCharge || "No"}</span>
                    </div>
                  )}

                  <p
                    style={{
                      textAlign: "right",
                      fontSize: "10px",
                      fontStyle: "italic",
                      marginTop: "40px",
                    }}
                  >
                    Certified that the particulars given above are true & correct.
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "20px", position: "relative", minHeight: "80px" }}>
                    <div>
                      {/* QR Code Placeholder */}
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: "60px", height: "60px", border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#999" }}>
                        QR Code
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: "11px",
                          marginBottom: "40px",
                          margin: 0,
                        }}
                      >
                        For, {company.name}
                      </p>
                      <div style={{ textAlign: "right", paddingTop: "40px" }}>
                        <p
                          style={{
                            fontWeight: 700,
                            borderTop: "1px solid #000",
                            paddingTop: "4px",
                            display: "inline-block",
                            fontSize: "11px",
                            margin: 0,
                          }}
                        >
                          Authorized Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
        {showPaymentPopup && activePaymentIndex !== null && (
           <PaymentPopup 
              amount={paymentsList[activePaymentIndex]?.amount > 0 ? paymentsList[activePaymentIndex].amount : totals.pendingAmount > 0 ? totals.pendingAmount : totals.effectiveTotal} 
              onClose={() => { setShowPaymentPopup(false); setActivePaymentIndex(null); }} 
              onConfirm={(method, details) => {
                 const newArr = [...paymentsList];
                 newArr[activePaymentIndex].method = method;
                 if (newArr[activePaymentIndex].amount === 0) {
                     newArr[activePaymentIndex].amount = totals.pendingAmount > 0 ? totals.pendingAmount : totals.effectiveTotal;
                 }
                 if (details) {
                    newArr[activePaymentIndex].reference = details.upi_id || details.account_number || "";
                 }
                 setPaymentsList(newArr);
                 setShowPaymentPopup(false);
                 setActivePaymentIndex(null);
              }} 
           />
        )}
      </div>
    </div>
  </div>
    );
  } catch (err: any) {
    console.error("FATAL RENDERING ERROR in CreateInvoice:", err);
    return (
      <div style={{ padding: '40px', background: '#fff1f2', color: '#be123c', minHeight: '100vh', fontFamily: 'monospace', overflow: 'auto' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Runtime Error in CreateInvoice</h1>
        <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>{err?.message || 'Unknown Error'}</p>
        <pre style={{ background: '#000', color: '#fff', padding: '20px', borderRadius: '8px', overflow: 'auto', maxWidth: '100%', whiteSpace: 'pre-wrap' }}>
          {err?.stack || 'No stack trace available'}
        </pre>
        <button 
          onClick={() => window.location.reload()}
          style={{ marginTop: '24px', padding: '12px 24px', background: '#be123c', color: '#fff', border: 'none', borderRadius: '100px', cursor: 'pointer', fontWeight: 700 }}
        >
          Try Reloading
        </button>
      </div>
    );
  }
};


export default CreateInvoice;
