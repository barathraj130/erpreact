// frontend/src/pages/CreateInvoice.tsx
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaChevronDown,
  FaPlus,
  FaPrint,
  FaSave,
  FaTrash,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../api/companyApi";
import { fetchProducts, Product } from "../api/productApi";
import { Customer } from "../api/userApi";
import { useAuthUser } from "../hooks/useAuthUser";
import { useUsers } from "../hooks/useUsers";
import { apiFetch } from "../utils/api";
import "./CreateInvoice.css";
import "./Dashboard.css";
import "./PageShared.css";
import CustomSelect from "../components/CustomSelect";

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
      .match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
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
  desc: string;
  hsn: string;
  uom: string;
  qty: number;
  rate: number;
}

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();
  const { customers } = useUsers();
  const { user: authUser } = useAuthUser();

  const [products, setProducts] = useState<Product[]>([]);
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
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [customerInfo, setCustomerInfo] = useState({
    name: "---",
    address: "---",
    gstin: "---",
    state: "---",
    code: "---",
  });
  const [gstState, setGstState] = useState({ cgst: 2.5, sgst: 2.5, igst: 0 });
  const [bank] = useState({
    name: "ICICI BANK",
    account: "540305000194",
    ifsc: "ICIC0005403",
    bundles: "N/A",
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
      const [p, prodData] = await Promise.all([
        fetchProfile(),
        fetchProducts(),
      ]);
      setCompany({
        name: (p.company_name || "COMPANY NAME").toUpperCase(),
        address: (p.address_line1 || "COMPANY ADDRESS").toUpperCase(),
        gstin: p.gstin || "---",
        state: (p.state || "TAMILNADU").toUpperCase(),
        stateCode: p.state_code || "33",
      });
      setProducts(prodData);
    };
    load();
  }, []);

  const handleProductSelect = (i: number, pid: string) => {
    const prod = products.find((p) => p.id === parseInt(pid));
    if (prod) {
      const t = [...items];
      t[i] = {
        ...t[i],
        desc: prod.name.toUpperCase(),
        hsn: prod.hsn_code || "",
        uom: prod.unit || "Pcs",
        rate: prod.selling_price || 0,
      };
      setItems(t);
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
        code: c.state_code || "---",
      });
      if (c.state_code && c.state_code !== company.stateCode) {
        setGstState({ cgst: 0, sgst: 0, igst: 5 });
      } else {
        setGstState({ cgst: 2.5, sgst: 2.5, igst: 0 });
      }
      setMeta((prev) => ({
        ...prev,
        placeOfSupply: c.state?.toUpperCase() || "---",
        placeOfSupplyCode: c.state_code || "---",
      }));
    }
  };

  const updateItem = (i: number, key: keyof InvoiceItem, val: any) => {
    const t = [...items];
    (t[i] as any)[key] = val;
    setItems(t);
  };

  const totals = useMemo(() => {
    const taxable = items.reduce((s, i) => s + i.qty * i.rate, 0);
    // Tax Invoice and Nominal Tax Invoice calculate GST
    const isTax = invoiceType === "TAX_INVOICE" || invoiceType === "NOMINAL_TAX_INVOICE";
    const cgstAmt = isTax ? taxable * (gstState.cgst / 100) : 0;
    const sgstAmt = isTax ? taxable * (gstState.sgst / 100) : 0;
    const igstAmt = isTax ? taxable * (gstState.igst / 100) : 0;
    const totalGst = cgstAmt + sgstAmt + igstAmt;
    
    // For Nominal Tax Invoice, only the Tax amount is charged as the Grand Total
    const grandTotal = invoiceType === "NOMINAL_TAX_INVOICE" ? totalGst : taxable + totalGst;
    
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    
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
      cgstAmt,
      sgstAmt,
      igstAmt,
      totalGst,
      grandTotal,
      effectiveTotal,
      totalQty,
      pendingAmount,
      paymentStatus
    };
  }, [items, gstState, invoiceType, amountPaid, discount]);

  const emptyRows = useMemo(
    () => new Array(Math.max(0, 15 - items.length)).fill(0),
    [items],
  );

  const saveInvoice = async () => {
    if (invoiceType !== "RETAIL_SALE" && !customerId) {
        return alert("Please select a customer for this invoice type. Retail Sale allows anonymous customers.");
    }
    
    if (invoiceType !== "GIFTED_ITEM" && (amountPaid + discount) > totals.grandTotal) {
        return alert("Overpayment prevented. Paid amount + discount cannot exceed Grand Total unless it's a Gifted Item.");
    }

    try {
      const body = {
        invoice_number: invoiceNo,
        invoice_type: invoiceType,
        customer_id: customerId,
        items: items.filter((i) => i.desc && i.qty > 0),
        notes,
        grand_total: totals.grandTotal,
        discount_amount: discount,
        amount_paid: amountPaid,
        balance_due: totals.pendingAmount,
        payment_status: totals.paymentStatus,
        payments: amountPaid > 0 ? [{ amount: amountPaid, payment_method: paymentMethod }] : [],
        tax_details: gstState,
        logistics: meta,
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
    }
  };

  const thStyle: React.CSSProperties = {
    border: "0.5px solid #000",
    padding: "4px 6px",
    fontSize: "8px",
    textTransform: "uppercase",
  };
  const tdStyle: React.CSSProperties = {
    border: "0.5px solid #000",
    padding: "4px 6px",
    fontSize: "9.5px",
  };

  return (
    <div className="db-page">
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Sales</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">New {invoiceType === "TAX_INVOICE" ? "Tax Invoice" : "Retail Bill (Anon)"}</span>
        </div>
        <div className="db-topbar-right">
          <button className="page-btn-round-ghost" onClick={() => navigate(-1)}>
            <FaArrowLeft size={12} /> Back
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={saveInvoice} id="save-invoice-btn">
            <FaSave size={12} /> Save Invoice
          </button>
        </div>
      </header>

      <div className="db-content" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
        <div className="ci-split" style={{ border: 'none', boxShadow: 'none', borderRadius: '0', background: 'transparent', flex: 1, overflow: 'hidden' }}>
          {/* ═══════════ LEFT: FORM ═══════════ */}
          <div className="ci-form-pane" style={{ background: '#fff' }}>
            {/* Form Inner Body (Scrolled) */}
            <div className="ci-form-body">
              <div className="db-page-header" style={{ marginBottom: '24px' }}>
                <h1 className="db-page-title">Create <strong>New Invoice</strong></h1>
                <p className="db-page-sub">Fill in the details below to generate a professional transaction record.</p>
              </div>
          {/* Invoice Details */}
          <div className="ci-card">
            <div className="ci-card-title">Invoice Details</div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>Invoice Type</label>
                <div style={{ marginTop: '8px' }}>
                  <CustomSelect 
                    value={invoiceType} 
                    onChange={(e: any) => setInvoiceType(e.target.value as any)}
                    disableSearch
                  >
                    <option value="TAX_INVOICE">TAX INVOICE (GST)</option>
                    <option value="NOMINAL_TAX_INVOICE">NOMINAL TAX (Charge Tax Only)</option>
                    <option value="NON_TAX_INVOICE">NON-TAX INVOICE</option>
                    <option value="RETAIL_SALE">RETAIL SALE (No Customer Req.)</option>
                    <option value="GIFTED_ITEM">GIFTED ITEM</option>
                  </CustomSelect>
                </div>
              </div>
              <div className="ci-field">
                <label>Invoice No. (Leave blank for auto)</label>
                <input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="Auto-generated"
                />
              </div>
            </div>
            <div className="ci-row-3">
              <div className="ci-field">
                <label>Invoice Date</label>
                <input
                  type="date"
                  value={meta.invoiceDate}
                  onChange={(e) =>
                    setMeta({ ...meta, invoiceDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>Supply Date</label>
                <input
                  type="date"
                  value={meta.supplyDate}
                  onChange={(e) =>
                    setMeta({ ...meta, supplyDate: e.target.value })
                  }
                />
              </div>
              <div className="ci-field">
                <label>Place of Supply</label>
                <input
                  value={meta.placeOfSupply}
                  onChange={(e) =>
                    setMeta({
                      ...meta,
                      placeOfSupply: e.target.value.toUpperCase(),
                    })
                  }
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
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
                </CustomSelect>
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
            <div className="ci-row-3">
              <div className="ci-field">
                <label>CGST %</label>
                <input
                  type="number"
                  value={gstState.cgst}
                  onChange={(e) =>
                    setGstState({ ...gstState, cgst: Number(e.target.value) })
                  }
                />
              </div>
              <div className="ci-field">
                <label>SGST %</label>
                <input
                  type="number"
                  value={gstState.sgst}
                  onChange={(e) =>
                    setGstState({ ...gstState, sgst: Number(e.target.value) })
                  }
                />
              </div>
              <div className="ci-field">
                <label>IGST %</label>
                <input
                  type="number"
                  value={gstState.igst}
                  onChange={(e) =>
                    setGstState({ ...gstState, igst: Number(e.target.value) })
                  }
                />
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
                <FaPlus size={10} /> Add
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
                        {products.map((p) => (
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

          {/* Payment & Summary */}
          <div className="ci-card">
            <div className="ci-card-title">Payment Details</div>
            <div className="ci-row-2">
              <div className="ci-field">
                <label>Amount Paid (₹)</label>
                <input
                  type="number"
                  value={amountPaid || ""}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="ci-field">
                <label>Payment Method</label>
                <div style={{ marginTop: '8px' }}>
                    <CustomSelect 
                      value={paymentMethod} 
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      disableSearch
                    >
                      <option value="CASH">CASH</option>
                      <option value="BANK">BANK / CARD</option>
                      <option value="UPI">UPI</option>
                    </CustomSelect>
                </div>
              </div>
            </div>

            {/* Discount Row */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <div className="ci-field" style={{ flex: 1 }}>
                <label>Discount / Waiver (₹)</label>
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
                   <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Gross Total</span>
                   <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>₹{fmt(totals.grandTotal)}</span>
               </div>
               {discount > 0 && (
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                     <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>Discount / Waiver</span>
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
              <div className="ci-footer-label">Grand Total</div>
              <div className="ci-footer-total">₹{fmt(totals.grandTotal)}</div>
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
              backgroundColor: "#fff",
              boxShadow: "0 0 20px rgba(0,0,0,0.1)",
              padding: "10mm",
              position: "relative",
              transform: "scale(0.8)",
              transformOrigin: "top center",
              marginBottom: "-20%",
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
                  style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px",
                    fontWeight: 600,
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
                    fontWeight: 600,
                    textTransform: "uppercase",
                    margin: 0,
                    letterSpacing: "1px",
                  }}
                >
                  Tax Invoice
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
                    <span>{meta.transportation || "N/A"}</span>
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
                    <span>{meta.vehicle || "N/A"}</span>
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
                    Details of Receiver/Billed To:
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
                    Details of Consignee/Shipped To:
                  </p>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "11px",
                      marginBottom: "2px",
                      marginTop: "4px",
                    }}
                  >
                    {useShippedSame
                      ? customerInfo.name
                      : shippedInfo.name || "---"}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    {useShippedSame
                      ? customerInfo.address
                      : shippedInfo.address || "---"}
                  </div>
                  <div
                    style={{ display: "flex", gap: "5px", marginBottom: "2px" }}
                  >
                    <span style={{ fontWeight: 700 }}>PH:</span>
                    <span>{(!useShippedSame && shippedInfo.ph) || "---"}</span>
                  </div>
                  <div
                    style={{ display: "flex", gap: "5px", marginBottom: "2px" }}
                  >
                    <span style={{ fontWeight: 700 }}>GSTIN:</span>
                    <span>
                      {useShippedSame
                        ? customerInfo.gstin
                        : shippedInfo.gstin || "---"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ fontWeight: 700 }}>State:</span>
                    <span>
                      {useShippedSame
                        ? customerInfo.state
                        : shippedInfo.state || "---"}
                    </span>
                    <span style={{ fontWeight: 700, marginLeft: "10px" }}>
                      Code:
                    </span>
                    <span>
                      {useShippedSame
                        ? customerInfo.code
                        : shippedInfo.code || "---"}
                    </span>
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
                    <th style={{ ...thStyle, width: "30px" }}>Sr.</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>
                      Description of Goods
                    </th>
                    <th style={{ ...thStyle, width: "60px" }}>HSN</th>
                    <th style={{ ...thStyle, width: "40px" }}>UOM</th>
                    <th
                      style={{ ...thStyle, width: "50px", textAlign: "right" }}
                    >
                      Qty
                    </th>
                    <th
                      style={{ ...thStyle, width: "60px", textAlign: "right" }}
                    >
                      Rate
                    </th>
                    <th
                      style={{ ...thStyle, width: "70px", textAlign: "right" }}
                    >
                      Amount
                    </th>
                    <th
                      style={{ ...thStyle, width: "70px", textAlign: "right" }}
                    >
                      Taxable
                    </th>
                    <th
                      style={{ ...thStyle, width: "60px", textAlign: "right" }}
                    >
                      GST
                    </th>
                    <th
                      style={{ ...thStyle, width: "80px", textAlign: "right" }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const taxable = (it.qty || 0) * (it.rate || 0);
                    const gstPct =
                      gstState.cgst + gstState.sgst + gstState.igst;
                    const gstVal = taxable * (gstPct / 100);
                    return (
                      <tr key={it.id}>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {idx + 1}
                        </td>
                        <td style={{ ...tdStyle }}>{it.desc || "---"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {it.hsn}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {it.uom}
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
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(taxable)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(gstVal)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: 700,
                          }}
                        >
                          {fmt(taxable + gstVal)}
                        </td>
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
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: "#f8f8f8" }}>
                    <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
                      Total
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {totals.totalQty.toFixed(2)}
                    </td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {totals.taxable.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {totals.totalGst.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {totals.grandTotal.toFixed(2)}
                    </td>
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
                    }}
                  >
                    Total Amount in words:
                  </p>
                  <p
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      marginBottom: "10px",
                    }}
                  >
                    {numberToWords(Math.round(totals.grandTotal))}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      marginBottom: "10px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Bundles:</span>
                    <span>N/A</span>
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
                    <span style={{ fontWeight: 700 }}>A/C NO:</span>
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
                      }}
                    >
                      <span>Total Amount Before Tax</span>
                      <span>{totals.taxable.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Add: CGST % ({gstState.cgst}%)</span>
                      <span>{totals.cgstAmt.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Add: SGST % ({gstState.sgst}%)</span>
                      <span>{totals.sgstAmt.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Add: IGST % ({gstState.igst}%)</span>
                      <span>{totals.igstAmt.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 600,
                        borderTop: "1px solid #000",
                        paddingTop: "4px",
                        marginTop: "4px",
                      }}
                    >
                      <span>Total Amount After Tax</span>
                      <span>{totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      fontWeight: 700,
                      marginBottom: "20px",
                    }}
                  >
                    <span>GST Payable on Reverse Charge:</span>
                    <span>No</span>
                  </div>

                  <p
                    style={{
                      textAlign: "right",
                      fontSize: "9px",
                      fontStyle: "italic",
                      marginTop: "40px",
                    }}
                  >
                    Certified that the particulars given above are true &
                    correct.
                  </p>

                  <div style={{ textAlign: "right", marginTop: "20px" }}>
                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: "11px",
                        marginBottom: "30px",
                      }}
                    >
                      For, {company.name}
                    </p>
                    <p
                      style={{
                        fontWeight: 700,
                        borderTop: "1px solid #000",
                        paddingTop: "4px",
                        display: "inline-block",
                      }}
                    >
                      Authorised Signatory
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
    </div>
  );
};

export default CreateInvoice;
