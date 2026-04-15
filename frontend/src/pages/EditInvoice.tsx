// frontend/src/pages/EditInvoice.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaCreditCard,
  FaExchangeAlt,
  FaGlobe,
  FaMobileAlt,
  FaMoneyBillWave,
  FaPrint,
  FaReceipt,
  FaSave,
  FaTrash,
  FaUniversity,
  FaWallet,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProfile } from "../api/companyApi";
import { useAuthUser } from "../hooks/useAuthUser";
import { useUsers } from "../hooks/useUsers";
import { apiFetch } from "../utils/api";
import CustomSelect from "../components/CustomSelect";

const toWords = (num: number): string => {
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const formatted = ("000000000" + num).substr(-9);
  const n = formatted.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  let str = "";
  const n1 = Number(n[1]);
  const n2 = Number(n[2]);
  const n3 = Number(n[3]);
  const n4 = Number(n[4]);
  const n5 = Number(n[5]);
  if (n1 !== 0)
    str += (a[n1] || b[Math.floor(n1 / 10)] + " " + a[n1 % 10]) + "Crore ";
  if (n2 !== 0)
    str += (a[n2] || b[Math.floor(n2 / 10)] + " " + a[n2 % 10]) + "Lakh ";
  if (n3 !== 0)
    str += (a[n3] || b[Math.floor(n3 / 10)] + " " + a[n3 % 10]) + "Thousand ";
  if (n4 !== 0)
    str += (a[n4] || b[Math.floor(n4 / 10)] + " " + a[n4 % 10]) + "Hundred ";
  if (n5 !== 0)
    str +=
      (str !== "" ? "and " : "") +
      (a[n5] || b[Math.floor(n5 / 10)] + " " + a[n5 % 10]) +
      "only ";
  return str;
};

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Table cell styles
const tableHeaderStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "4px 3px",
  fontWeight: "bold",
  background: "#f1f5f9",
  textAlign: "center",
};
const tableCellStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px",
  textAlign: "center",
  height: "20px",
};
const tableCellLeftStyle: React.CSSProperties = {
  ...tableCellStyle,
  textAlign: "left",
  paddingLeft: "4px",
};
const tableCellRightStyle: React.CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
  paddingRight: "4px",
};

// Payment method options
const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: <FaMoneyBillWave />, color: "#10b981" },
  {
    value: "BANK_TRANSFER",
    label: "Bank",
    icon: <FaUniversity />,
    color: "#3b82f6",
  },
  { value: "UPI", label: "UPI", icon: <FaMobileAlt />, color: "#8b5cf6" },
  { value: "CARD", label: "Card", icon: <FaCreditCard />, color: "#f59e0b" },
  { value: "CHEQUE", label: "Cheque", icon: <FaReceipt />, color: "#64748b" },
  { value: "WALLET", label: "Wallet", icon: <FaWallet />, color: "#ec4899" },
];

// Interfaces
interface PaymentEntry {
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_no: string;
}

interface InvoiceItem {
  name: string;
  hsn: string;
  uom: string;
  qty: number;
  rate: number;
}

const EditInvoice: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers } = useUsers();
  const { user } = useAuthUser();
  const printRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>({});
  const [invoiceNo, setInvoiceNo] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [amountPaidAlready, setAmountPaidAlready] = useState<number>(0);

  // Multiple payments array (for new payments)
  const [payments, setPayments] = useState<PaymentEntry[]>([
    {
      amount: 0,
      payment_method: "CASH",
      payment_date: new Date().toISOString().slice(0, 10),
      reference_no: "",
    },
  ]);

  const [meta, setMeta] = useState({
    invoiceDate: new Date().toISOString().slice(0, 10),
    vehicleNumber: "",
    bundles: 0,
    placeOfSupply: "",
    supplyStateCode: "",
    transportMode: "",
    reverseCharge: "No",
    dateOfSupply: new Date().toISOString().slice(0, 10),
  });
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customer, setCustomer] = useState({
    name: "",
    address: "",
    gstin: "",
    state: "",
    stateCode: "",
  });

  // Currency Converter State
  const [showConverter, setShowConverter] = useState(false);
  const [convertAmount, setConvertAmount] = useState<string>("1");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [convertedINR, setConvertedINR] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const performConversion = async () => {
    if (!convertAmount || parseFloat(convertAmount) <= 0) return;
    setIsConverting(true);
    try {
      const res = await fetch(
        `https://api.frankfurter.app/latest?amount=${convertAmount}&from=${fromCurrency}&to=INR`,
      );
      const data = await res.json();
      if (data.rates && data.rates.INR) {
        setConvertedINR(data.rates.INR);
      }
    } catch (err) {
      console.error("Conversion failed", err);
    } finally {
      setIsConverting(false);
    }
  };

  // Load Data
  useEffect(() => {
    const load = async () => {
      try {
        // Fetch Profile and Invoice Data in parallel
        const [profile, invoiceRes] = await Promise.all([
          fetchProfile(),
          apiFetch(`/invoice/${id}`),
        ]);

        // Set Company Profile
        setCompany({
          name: profile.company_name,
          address: profile.address_line1,
          city_pincode: profile.city_pincode,
          state: profile.state,
          stateCode: "33",
          gstin: profile.gstin,
          bank_name: profile.bank_name,
          ac_no: profile.bank_account_no,
          ifsc: profile.bank_ifsc_code,
          signature_url: profile.signature_url || null,
        });

        // Set Invoice Data
        const inv = await invoiceRes.json();

        setInvoiceNo(inv.invoice_number);
        setNotes(inv.notes || "");
        setAmountPaidAlready(Number(inv.paid_amount) || 0);

        // Meta
        setMeta({
          invoiceDate: inv.invoice_date
            ? inv.invoice_date.substring(0, 10)
            : new Date().toISOString().slice(0, 10),
          vehicleNumber: inv.vehicle_number || "",
          bundles: Number(inv.bundles_count) || 0,
          transportMode: inv.transportation_mode || "",
          reverseCharge: inv.reverse_charge || "No",
          dateOfSupply: inv.date_of_supply
            ? inv.date_of_supply.substring(0, 10)
            : new Date().toISOString().slice(0, 10),
          placeOfSupply: "", // Will be set when customer loads
          supplyStateCode: "",
        });

        // Items
        if (inv.items && inv.items.length > 0) {
          setItems(
            inv.items.map((i: any) => ({
              name: i.description || "",
              hsn: i.hsn_acs_code || "",
              uom: "Pcs", // Default
              qty: Number(i.quantity) || 0,
              rate: Number(i.unit_price) || 0,
            })),
          );
        }

        // Customer
        if (inv.customer_id) {
          setCustomerId(inv.customer_id);
          // Find customer details from the customers list (which should be cached/loaded by useUsers)
          // Note: customers might not be loaded yet if useUsers is async.
          // However useEffect dependency on `customers` will handle the update.
        }
      } catch (err) {
        console.error("Failed to load edit details", err);
        alert("Could not load invoice details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Update Customer details when `customers` list or `customerId` changes
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const c = customers.find((x) => x.id === customerId);
      if (c) {
        setCustomer({
          name: c.username.toUpperCase(),
          address:
            `${c.address_line1 || ""}, ${c.city_pincode || ""}`.toUpperCase(),
          gstin: c.gstin || "",
          state: c.state?.toUpperCase() || "",
          stateCode: c.state_code || "",
        });
        setMeta((prev) => ({
          ...prev,
          placeOfSupply: c.state?.toUpperCase() || "",
          supplyStateCode: c.state_code || "",
        }));
      }
    }
  }, [customerId, customers]);

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setCustomerId(id);
  };

  let totalTaxable = 0,
    totalCGST = 0,
    totalSGST = 0,
    totalIGST = 0;
  const rows = items.map((it) => {
    const amount = it.qty * it.rate;
    const taxable = amount;
    const isSameState =
      (customer.stateCode || "33") === (company.stateCode || "33");
    const cgstRate = isSameState ? 2.5 : 0;
    const sgstRate = isSameState ? 2.5 : 0;
    const igstRate = isSameState ? 0 : 5;
    const cgst = taxable * (cgstRate / 100);
    const sgst = taxable * (sgstRate / 100);
    const igst = taxable * (igstRate / 100);
    totalTaxable += taxable;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;
    return {
      ...it,
      amount,
      taxable,
      cgstRate,
      sgstRate,
      igstRate,
      cgst,
      sgst,
      igst,
      lineTotal: taxable + cgst + sgst + igst,
    };
  });

  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalTaxable + totalGST;

  // Calculate total from all payments being made now (New payments)
  const paymentNow = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = amountPaidAlready + paymentNow;
  const balanceDue = grandTotal - totalPaid;
  const paymentProgress = grandTotal > 0 ? (totalPaid / grandTotal) * 100 : 0;

  const getPaymentStatus = () => {
    if (balanceDue <= 0 && grandTotal > 0)
      return { label: "PAID", color: "#10b981", bg: "#dcfce7" };
    if (totalPaid > 0)
      return { label: "PARTIAL", color: "#f59e0b", bg: "#fef3c7" };
    return { label: "UNPAID", color: "#ef4444", bg: "#fee2e2" };
  };
  const status = getPaymentStatus();

  const handleQuickPayment = (percent: number) => {
    const maxPayable = grandTotal - amountPaidAlready;
    const amount = Math.round((maxPayable * percent) / 100);
    const newPayments = [...payments];
    newPayments[0] = { ...newPayments[0], amount };
    setPayments(newPayments);
  };

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        amount: 0,
        payment_method: "CASH",
        payment_date: new Date().toISOString().slice(0, 10),
        reference_no: "",
      },
    ]);
  };

  const removePayment = (index: number) => {
    if (payments.length > 1) {
      const newPayments = [...payments];
      newPayments.splice(index, 1);
      setPayments(newPayments);
    }
  };

  const updatePayment = (
    index: number,
    field: keyof PaymentEntry,
    value: any,
  ) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };

  const handleUpdate = async () => {
    if (!customerId) {
      alert("Please select a customer");
      return;
    }

    if (!invoiceNo.trim()) {
      alert("Please enter an invoice number");
      return;
    }

    if (items.length === 0 || items.every((item) => !item.name.trim())) {
      alert("Please add at least one item");
      return;
    }

    // Filter and format valid payments (only new payments)
    const validPayments = payments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        amount: Number(p.amount),
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        reference_no: p.reference_no || "",
        notes: `Payment via ${PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label || p.payment_method}`,
      }));

    const formattedItems = items
      .filter((item) => item.name.trim())
      .map((item) => ({
        description: item.name, // NOTE: Backend expects 'description', frontend input is 'name'
        hsn_acs_code: item.hsn || "",
        quantity: Number(item.qty) || 0,
        unit_price: Number(item.rate) || 0,
        gst_rate: 0, // Will be calculated by backend or ignored as layout does calc
      }));

    // Create payload
    const payload: any = {
      invoice_number: invoiceNo.trim(),
      customer_id: customerId,
      items: formattedItems,
      notes: notes.trim(),
      amount_paid: totalPaid,
      balance_due: balanceDue,
      payment_status: status.label,
      payments: validPayments,
      transport_details: {
        vehicle: meta.vehicleNumber || "",
        mode: meta.transportMode || "",
        supply_date: meta.dateOfSupply,
        reverse_charge: meta.reverseCharge,
      },
      bundles_count: Number(meta.bundles) || 0,
    };

    // Note: We might need to handle how new payments are appended to history, for now we update total paid

    try {
      const response = await apiFetch(`/invoice/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert("Invoice updated successfully!");
        navigate("/invoices");
      } else {
        alert("Failed to update invoice");
      }
    } catch (err: any) {
      console.error("Exception while saving:", err);
      alert(`Failed to save invoice: ${err.message || "Network error"}`);
    }
  };

  const printInvoice = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;
    const w = window.open("", "", "width=900,height=650");
    w!.document.write(
      `<html><head><title>Invoice</title><style>body{margin:0;padding:0;font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:4px;font-size:10px}@media print{body{margin:0;padding:0}}</style></head><body>${printContents}</body></html>`,
    );
    w!.document.close();
    w!.focus();
    w!.print();
  };

  const sectionStyle: React.CSSProperties = { marginBottom: "16px" };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
  const inputLabelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: "0.7rem",
    color: "var(--text-main)",
    marginBottom: "6px",
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
    fontSize: "0.85rem",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  if (loading)
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Loading Invoice...
      </div>
    );

  return (
    <div className="invoice-layout">
      <div className="invoice-form-side">
        <div
          className="glass-panel"
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: "15px",
            zIndex: 10,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
          }}
        >
          <button
            onClick={() => navigate("/invoices")}
            className="btn-secondary"
            style={{
              padding: "8px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FaArrowLeft size={14} />
          </button>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              flex: 1,
              margin: 0,
              color: "var(--text-main)",
              letterSpacing: "-0.5px",
            }}
          >
            Edit Invoice #{invoiceNo}
          </h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowConverter(!showConverter)}
              className="btn-secondary"
              style={{
                padding: "8px 12px",
                fontSize: "0.8rem",
                gap: "6px",
                display: "flex",
                alignItems: "center",
                borderColor: showConverter
                  ? "var(--primary)"
                  : "var(--border-color)",
                color: showConverter ? "var(--primary)" : "var(--text-main)",
                background: showConverter ? "var(--primary-glow)" : "white",
              }}
            >
              <FaGlobe />{" "}
              <span
                style={{
                  display: window.innerWidth > 1400 ? "inline" : "none",
                }}
              >
                Convert
              </span>
            </button>
            <button
              onClick={printInvoice}
              className="btn-secondary"
              style={{
                padding: "8px 12px",
                fontSize: "0.8rem",
                gap: "6px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FaPrint />{" "}
              <span
                style={{
                  display: window.innerWidth > 1200 ? "inline" : "none",
                }}
              >
                Print
              </span>
            </button>
          </div>
        </div>

        {/* Live Currency Converter Tool */}
        {showConverter && (
          <div
            className="page-transition"
            style={{
              padding: "20px",
              background: "var(--bg-body)",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <div
              className="card"
              style={{
                border: "1px solid var(--primary-glow)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--primary)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FaExchangeAlt /> Currency Converter (INR)
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    placeholder="Amount"
                    style={{ ...inputStyle, background: "white" }}
                  />
                </div>
                <div style={{ width: "100px" }}>
                  <CustomSelect
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    style={{
                      ...inputStyle,
                      background: "white",
                      appearance: "auto",
                    }}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="SGD">SGD</option>
                    <option value="AED">AED</option>
                    <option value="SAR">SAR</option>
                  </CustomSelect>
                </div>
                <button
                  onClick={performConversion}
                  disabled={isConverting}
                  className="btn-primary"
                  style={{ padding: "0 20px", height: "42px" }}
                >
                  {isConverting ? "..." : "Convert"}
                </button>
              </div>
              {convertedINR !== null && (
                <div
                  className="page-transition"
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px dashed var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      RESULT
                    </span>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "var(--text-main)",
                      }}
                    >
                      ₹ {fmt(convertedINR)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newItems = [...items];
                      newItems[newItems.length - 1].rate =
                        Math.round(convertedINR * 100) / 100;
                      setItems(newItems);
                      setShowConverter(false);
                    }}
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--primary)",
                      background: "var(--primary-glow)",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "8px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    Apply to Item
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Basic Details Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Basic Details</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "15px",
                marginBottom: "15px",
              }}
            >
              <div>
                <label style={inputLabelStyle}>Invoice No</label>
                <input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Invoice Date</label>
                <input
                  type="date"
                  value={meta.invoiceDate}
                  onChange={(e) =>
                    setMeta({ ...meta, invoiceDate: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={inputLabelStyle}>Customer</label>
              <CustomSelect
                value={customerId || ""}
                onChange={handleCustomerSelect}
                style={inputStyle}
              >
                <option value="">-- Select Customer --</option>
                {customers
                  .filter((c) => c.username !== "admin")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
              </CustomSelect>
            </div>
          </div>

          {/* Items Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Items</h3>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  background: "#f8fafc",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "8px",
                  position: "relative",
                }}
              >
                <div style={{ paddingRight: "30px" }}>
                  <input
                    placeholder="Item Name"
                    value={it.name}
                    onChange={(e) => {
                      const t = [...items];
                      t[i].name = e.target.value;
                      setItems(t);
                    }}
                    style={{ ...inputStyle, marginBottom: "8px" }}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                    gap: "8px",
                  }}
                >
                  <input
                    placeholder="HSN"
                    value={it.hsn}
                    onChange={(e) => {
                      const t = [...items];
                      t[i].hsn = e.target.value;
                      setItems(t);
                    }}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={it.qty || ""}
                    onChange={(e) => {
                      const t = [...items];
                      t[i].qty = Number(e.target.value);
                      setItems(t);
                    }}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    value={it.rate || ""}
                    onChange={(e) => {
                      const t = [...items];
                      t[i].rate = Number(e.target.value);
                      setItems(t);
                    }}
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={() => {
                    const t = [...items];
                    t.splice(i, 1);
                    setItems(t);
                  }}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    color: "red",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  <FaTrash />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setItems([
                  ...items,
                  { name: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 },
                ])
              }
              style={{
                width: "100%",
                padding: "8px",
                background: "#e0f2fe",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                color: "#0284c7",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add Item
            </button>
          </div>

          {/* Payment & Notes Section */}
          <div style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <FaMoneyBillWave color="#10b981" size={18} />
              <h3 style={{ ...sectionTitleStyle, margin: 0 }}>
                Payment & Notes
              </h3>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "4px 10px",
                  background: status.bg,
                  color: status.color,
                  borderRadius: "12px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                }}
              >
                {status.label}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <div
                style={{
                  padding: "10px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                  Total
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700 }}>
                  ₹{fmt(grandTotal)}
                </div>
              </div>
              <div
                style={{
                  padding: "10px",
                  background: "#dcfce7",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#166534" }}>Paid</div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#16a34a",
                  }}
                >
                  ₹{fmt(totalPaid)}
                </div>
              </div>
              <div
                style={{
                  padding: "10px",
                  background: balanceDue > 0 ? "#fee2e2" : "#dcfce7",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: balanceDue > 0 ? "#991b1b" : "#166534",
                  }}
                >
                  Balance
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: balanceDue > 0 ? "#dc2626" : "#16a34a",
                  }}
                >
                  ₹{fmt(Math.max(balanceDue, 0))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={inputLabelStyle}>Amount Paid Already (₹)</label>
              <input
                type="number"
                value={amountPaidAlready || ""}
                onChange={(e) => setAmountPaidAlready(Number(e.target.value))}
                style={{ ...inputStyle, background: "#f8fafc" }}
                placeholder="0"
              />
            </div>

            {/* New Payment Entry */}
            <div
              style={{
                padding: "12px",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #bbf7d0",
                marginBottom: "12px",
              }}
            >
              <label style={{ ...inputLabelStyle, color: "#166534" }}>
                Add New Payment
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <input
                  type="number"
                  placeholder="Amount"
                  value={payments[0].amount || ""}
                  onChange={(e) =>
                    updatePayment(0, "amount", Number(e.target.value))
                  }
                  style={inputStyle}
                />
                <CustomSelect
                  style={inputStyle}
                  value={payments[0].payment_method}
                  onChange={(e) =>
                    updatePayment(0, "payment_method", e.target.value)
                  }
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </CustomSelect>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={inputLabelStyle}>Notes / Terms</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, resize: "none" }}
                placeholder="E.g. Thanks for your business!"
              />
            </div>
            <div
              style={{
                background: "#f8fafc",
                padding: "10px",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  color: "#64748b",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                Amount in Words
              </label>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  textTransform: "capitalize",
                }}
              >
                {grandTotal ? toWords(Math.round(grandTotal)) : "-"}
              </div>
            </div>
          </div>

          {/* Additional Details Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Additional Details</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "15px",
                marginBottom: "15px",
              }}
            >
              <div>
                <label style={inputLabelStyle}>Reverse Charge</label>
                <CustomSelect
                  value={meta.reverseCharge}
                  onChange={(e) =>
                    setMeta({ ...meta, reverseCharge: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option>No</option>
                  <option>Yes</option>
                </CustomSelect>
              </div>
              <div>
                <label style={inputLabelStyle}>Transport Mode</label>
                <input
                  value={meta.transportMode}
                  onChange={(e) =>
                    setMeta({ ...meta, transportMode: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "15px",
                marginBottom: "15px",
              }}
            >
              <div>
                <label style={inputLabelStyle}>Vehicle No.</label>
                <input
                  value={meta.vehicleNumber}
                  onChange={(e) =>
                    setMeta({ ...meta, vehicleNumber: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Date of Supply</label>
                <input
                  type="date"
                  value={meta.dateOfSupply}
                  onChange={(e) =>
                    setMeta({ ...meta, dateOfSupply: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={inputLabelStyle}>No. of Bundles</label>
              <input
                type="number"
                value={meta.bundles}
                onChange={(e) =>
                  setMeta({ ...meta, bundles: Number(e.target.value) })
                }
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer with Save Button */}
        {/* Footer with Save Button */}
        <div
          className="glass-panel"
          style={{
            padding: "15px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255,255,255,0.9)",
            zIndex: 10,
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Grand Total
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "bold",
                color: "var(--text-main)",
              }}
            >
              ₹{fmt(grandTotal)}
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={handleUpdate}
            style={{ gap: "8px" }}
          >
            <FaSave /> Update Invoice
          </button>
        </div>
      </div>

      {/* Print Preview Section */}
      <div className="invoice-preview-side" style={{ overflow: "hidden" }}>
        <div
          ref={printRef}
          style={{
            width: "210mm",
            minWidth: "210mm",
            minHeight: "297mm",
            background: "#fff",
            boxShadow: "0 0 12px rgba(0,0,0,0.4)",
            padding: "15px",
            boxSizing: "border-box",
            transform:
              windowWidth < 1024
                ? `scale(${(windowWidth - 40) / 794})`
                : "none",
            transformOrigin: "top center",
            marginBottom:
              windowWidth < 1024
                ? `-${297 * 3.78 * (1 - (windowWidth - 40) / 794)}px`
                : "0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              border: "1px solid #000",
              width: "100%",
              position: "relative",
            }}
          >
            {/* TRIPLICATE INDICATOR */}
            <div
              style={{
                position: "absolute",
                top: "0",
                right: "0",
                fontSize: "10px",
                textAlign: "right",
                border: "1px solid #ccc",
                padding: "4px",
                zIndex: 10,
              }}
            >
              <div style={{ color: "red" }}>Original for Recipient</div>
              <div style={{ color: "blue" }}>Duplicate for Supplier</div>
              <div style={{ color: "green" }}>Triplicate for Supplier</div>
            </div>

            {/* Header */}
            <div
              style={{
                textAlign: "center",
                padding: "15px 0 0 0",
                clear: "both",
              }}
            >
              <h1
                style={{
                  margin: "0",
                  fontSize: "32px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                {company.name || "COMPANY NAME"}
              </h1>
              <p style={{ margin: "4px 0", fontSize: "11px" }}>
                {company.address}
                {company.city_pincode ? `, ${company.city_pincode}` : ""}
              </p>
              <p
                style={{
                  margin: "3px 0",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {company.state?.toUpperCase() || "TAMILNADU"}
              </p>
              <p
                style={{
                  margin: "3px 0 0 0",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                GSTIN No. : {company.gstin}
              </p>
            </div>

            {/* Invoice Title */}
            <div
              style={{
                textAlign: "center",
                border: "1px solid #000",
                borderBottom: "none",
                padding: "2px 5px",
                fontWeight: "700",
                fontSize: "13px",
                textTransform: "uppercase",
              }}
            >
              INVOICE
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                border: "1px solid #000",
                borderBottom: "none",
                fontSize: "11px",
              }}
            >
              <div style={{ borderRight: "1px solid #000" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    borderBottom: "1px solid #000",
                    padding: "2px 5px",
                  }}
                >
                  <span>Reverse Charge</span>
                  <span>: {meta.reverseCharge}</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    borderBottom: "1px solid #000",
                    padding: "2px 5px",
                  }}
                >
                  <span>Invoice No</span>
                  <span>
                    : <b>{invoiceNo}</b>
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    borderBottom: "1px solid #000",
                    padding: "2px 5px",
                  }}
                >
                  <span>Invoice Date</span>
                  <span>
                    :{" "}
                    <b>
                      {new Date(meta.invoiceDate).toLocaleDateString("en-GB")}
                    </b>
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    padding: "2px 5px",
                  }}
                >
                  <span>State</span>
                  <span>
                    : {company.state || "TAMILNADU"} Code:{" "}
                    {company.stateCode || "33"}
                  </span>
                </div>
              </div>
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    borderBottom: "1px solid #000",
                    padding: "2px 5px",
                  }}
                >
                  <span>Transport Mode</span>
                  <span>: {meta.transportMode}</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    borderBottom: "1px solid #000",
                    padding: "2px 5px",
                  }}
                >
                  <span>Vehicle Number</span>
                  <span>: {meta.vehicleNumber}</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    borderBottom: "1px solid #000",
                    padding: "2px 5px",
                  }}
                >
                  <span>Date of Supply</span>
                  <span>
                    : {new Date(meta.dateOfSupply).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    padding: "2px 5px",
                  }}
                >
                  <span>Place of Supply</span>
                  <span>
                    : {meta.placeOfSupply || "TAMILNADU"} Code:{" "}
                    {meta.supplyStateCode || "33"}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                border: "1px solid #000",
                borderBottom: "none",
                fontSize: "11px",
              }}
            >
              <div style={{ borderRight: "1px solid #000", padding: "5px" }}>
                <b style={{ textDecoration: "underline" }}>
                  Details of Receiver Billed To :
                </b>
                <div style={{ marginTop: "4px" }}>
                  Name : <b>{customer.name}</b>
                </div>
                <div>Address : {customer.address}</div>
                <div>
                  GSTIN : <b>{customer.gstin}</b>
                </div>
                <div>
                  State : {customer.state || "TAMILNADU"} Code :{" "}
                  {customer.stateCode || "33"}
                </div>
              </div>
              <div style={{ padding: "5px" }}>
                <b style={{ textDecoration: "underline" }}>
                  Details of Consignee :
                </b>
                <div style={{ marginTop: "4px" }}>
                  Name : <b>{customer.name}</b>
                </div>
                <div>Address : {customer.address}</div>
                <div>
                  GSTIN : <b>{customer.gstin}</b>
                </div>
                <div>
                  State : {customer.state || "TAMILNADU"} Code :{" "}
                  {customer.stateCode || "33"}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ border: "1px solid #000", minHeight: "400px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "9px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #000",
                      background: "#f9fafb",
                    }}
                  >
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "35px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Sr.No
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        textAlign: "left",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Name of Product
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "50px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      HSN
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "35px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Uom
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "35px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "70px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Rate
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "75px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "60px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Discount
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "75px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Taxable
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "55px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      CGST
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "55px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      SGST
                    </th>
                    <th
                      style={{
                        borderRight: "1px solid #000",
                        padding: "4px 2px",
                        width: "55px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      IGST
                    </th>
                    <th
                      style={{
                        padding: "4px 2px",
                        width: "85px",
                        fontSize: "9px",
                        fontWeight: "bold",
                      }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 15 }).map((_, i) => {
                    const r = rows[i] || {};
                    return (
                      <tr key={i}>
                        <td style={tableCellStyle}>{i + 1}</td>
                        <td style={tableCellLeftStyle}>{r.name || ""}</td>
                        <td style={tableCellStyle}>{r.hsn || ""}</td>
                        <td style={tableCellStyle}>{r.uom || ""}</td>
                        <td style={tableCellStyle}>{r.qty || ""}</td>
                        <td style={tableCellStyle}>
                          {r.rate ? fmt(r.rate) : ""}
                        </td>
                        <td style={tableCellStyle}>
                          {r.amount ? fmt(r.amount) : ""}
                        </td>
                        <td style={tableCellStyle}>0.00</td>
                        <td style={tableCellStyle}>
                          {r.taxable ? fmt(r.taxable) : ""}
                        </td>
                        <td style={tableCellStyle}>
                          {r.cgst > 0 ? fmt(r.cgst) : ""}
                        </td>
                        <td style={tableCellStyle}>
                          {r.sgst > 0 ? fmt(r.sgst) : ""}
                        </td>
                        <td style={tableCellStyle}>
                          {r.igst > 0 ? fmt(r.igst) : ""}
                        </td>
                        <td style={tableCellStyle}>
                          {r.lineTotal ? fmt(r.lineTotal) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      fontWeight: "bold",
                      background: "#f1f5f9",
                      borderTop: "1px solid #000",
                    }}
                  >
                    <td colSpan={6} style={tableCellRightStyle}>
                      Total
                    </td>
                    <td style={tableCellStyle}>{fmt(totalTaxable)}</td>
                    <td style={tableCellStyle}>0.00</td>
                    <td style={tableCellStyle}>{fmt(totalTaxable)}</td>
                    <td style={tableCellStyle}>{fmt(totalCGST)}</td>
                    <td style={tableCellStyle}>{fmt(totalSGST)}</td>
                    <td style={tableCellStyle}>{fmt(totalIGST)}</td>
                    <td style={tableCellStyle}>{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Section */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr",
                border: "1px solid #000",
                borderTop: "none",
                fontSize: "11px",
              }}
            >
              <div
                style={{
                  borderRight: "1px solid #000",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <b>Total Invoice Amount in words</b>
                  <br />
                  <div
                    style={{
                      marginTop: "2px",
                      textTransform: "capitalize",
                      fontWeight: "bold",
                    }}
                  >
                    {grandTotal ? toWords(Math.round(grandTotal)) : ""}
                  </div>
                  <br />
                  Bundles : {meta.bundles}
                </div>
                <div style={{ marginTop: "10px" }}>
                  <b style={{ textDecoration: "underline" }}>Bank Details :</b>
                  <br />* BANK NAME : {company.bank_name}
                  <br />* A/C NO : {company.ac_no}
                  <br />* IFSC NO : {company.ifsc}
                  <br />
                  <br />
                  <b>(Common Seal)</b>
                </div>
              </div>
              <div style={{ padding: "0" }}>
                <table
                  style={{
                    width: "100%",
                    fontSize: "11px",
                    borderCollapse: "collapse",
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                        }}
                      >
                        Total Before Tax
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                          textAlign: "right",
                          borderLeft: "1px solid #000",
                          width: "100px",
                        }}
                      >
                        <b>{fmt(totalTaxable)}</b>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                        }}
                      >
                        Add: CGST
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                          textAlign: "right",
                          borderLeft: "1px solid #000",
                        }}
                      >
                        {fmt(totalCGST)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                        }}
                      >
                        Add: SGST
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                          textAlign: "right",
                          borderLeft: "1px solid #000",
                        }}
                      >
                        {fmt(totalSGST)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                        }}
                      >
                        Add: IGST
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                          textAlign: "right",
                          borderLeft: "1px solid #000",
                        }}
                      >
                        {fmt(totalIGST)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                        }}
                      >
                        Tax Amount: GST
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #000",
                          padding: "4px",
                          textAlign: "right",
                          borderLeft: "1px solid #000",
                        }}
                      >
                        <b>{fmt(totalGST)}</b>
                      </td>
                    </tr>
                    <tr style={{ background: "#f3f4f6", fontSize: "12px" }}>
                      <td style={{ padding: "6px" }}>
                        <b>Total After Tax</b>
                      </td>
                      <td
                        style={{
                          padding: "6px",
                          textAlign: "right",
                          borderLeft: "1px solid #000",
                        }}
                      >
                        <b>{fmt(grandTotal)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div
                  style={{
                    padding: "6px",
                    fontSize: "10px",
                    borderTop: "1px solid #000",
                  }}
                >
                  GST on Reverse Charge : {meta.reverseCharge}
                </div>
                <div
                  style={{
                    padding: "6px",
                    fontSize: "9px",
                    fontStyle: "italic",
                  }}
                >
                  Certified that particulars are true & correct.
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontWeight: "bold",
                    marginTop: "10px",
                    paddingRight: "10px",
                    fontSize: "11px",
                  }}
                >
                  For, {company.name}
                  <div
                    style={{
                      height: "45px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    {(company.signature_url || user?.signature_url) && (
                      <img
                        src={company.signature_url || user?.signature_url}
                        alt="Signature"
                        style={{ height: "35px" }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      borderTop: "1px dotted #000",
                      display: "inline-block",
                      minWidth: "150px",
                      marginTop: "2px",
                    }}
                  >
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: "9px",
                textAlign: "right",
                padding: "4px",
                borderTop: "1px solid #000",
              }}
            >
              [E & OE]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditInvoice;
