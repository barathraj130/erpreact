import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  FaSave, FaPlus, FaTrash, FaChevronLeft, FaFileUpload, 
  FaFileInvoice, FaRegClock, FaUserAlt, FaBarcode, 
  FaMoneyBillWave, FaPercentage, FaCalculator, FaTimes, FaCamera, FaBox
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import CustomSelect from "../components/CustomSelect";
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
  const [billCategory, setBillCategory] = useState<"PRODUCT" | "EXPENSE">("PRODUCT");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [items, setItems] = useState<ProductItem[]>([
    { id: "", name: "", qty: 1, rate: 0, gstRate: 18, unit: "pcs", imageUrl: "" }
  ]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { expense_type: "Freight / Transport", description: "", amount: 0, tax_percent: 18 }
  ]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [brokerId, setBrokerId] = useState<string>("");
  const [brokerCommRate, setBrokerCommRate] = useState<number>(0);

  // UI State
  const [loading, setLoading] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

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
    const balance = Math.max(0, netTotal - paidAmount);

    return { subTotal, totalTax, grossTotal, netTotal, balance };
  }, [items, expenses, billCategory, billType, discountAmount, paidAmount]);

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

  const handleProductSelect = (index: number, val: string) => {
    const newItems = [...items];
    const prod = products.find(p => p.name === val || p.id === parseInt(val));
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
      newItems[index].name = val;
    }
    setItems(newItems);
  };

  const handleSave = async (print = false) => {
    if (!selectedSupplierId) return alert("Please select a supplier.");
    if (!billNumber) return alert("Please enter bill number.");
    if (billCategory === "PRODUCT" && items.some(i => !i.name || i.qty <= 0)) return alert("Please ensure all products have name and quantity.");
    if (billCategory === "EXPENSE" && expenses.some(e => !e.expense_type || e.amount <= 0)) return alert("Please ensure all expenses have type and amount.");

    setLoading(true);
    try {
      const formData = new FormData();
      const payload = {
        bill_category: billCategory,
        items: billCategory === "PRODUCT" ? items.map(i => ({
          product_id: i.id ? parseInt(i.id) : null,
          description: i.name,
          quantity: i.qty,
          unit_price: i.rate,
          tax_percent: billType === "TAX" ? i.gstRate : 0,
          hsn_code: i.hsnCode
        })) : [],
        expenses: billCategory === "EXPENSE" ? expenses : [],
        discount_amount: discountAmount,
        paid_amount: paidAmount,
        payment_mode: paymentMode,
        broker_id: brokerId || null,
        broker_commission_rate: brokerCommRate || 0
      };

      formData.append("data", JSON.stringify(payload));
      if (billFile) formData.append("bill_file", billFile);

      const res = await apiFetch("/purchase-bills", {
        method: "POST",
        body: formData
      }, false);

      if (res.ok) {
        const result = await res.json();
        alert("Purchase Bill Saved Successfully!");
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
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <th style={{ padding: "15px", width: "60px" }}>IMG</th>
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Product Description</th>
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "center", width: "100px" }}>Qty</th>
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right", width: "150px" }}>Rate (₹)</th>
                      {billType === "TAX" && (
                        <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "center", width: "100px" }}>GST %</th>
                      )}
                      <th style={{ padding: "15px", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right", width: "160px" }}>Total (₹)</th>
                      <th style={{ padding: "15px", width: "50px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {items.map((item, idx) => (
                        <motion.tr key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#f1f5f9", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}>
                               {item.imageUrl ? <img src={item.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaBox color="#cbd5e1" />}
                            </div>
                          </td>
                          <td style={{ padding: "10px" }}>
                            <input list="purchase-prod-list" value={item.name} onChange={e => handleProductSelect(idx, e.target.value)} placeholder="Type or select product..." style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }} />
                          </td>
                          <td style={{ padding: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                              <input type="number" value={item.qty} min={1} onChange={e => {
                                  const t = [...items]; t[idx].qty = parseFloat(e.target.value) || 0; setItems(t);
                              }} style={{ width: "80px", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600 }} />
                              <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700 }}>{item.unit}</span>
                            </div>
                          </td>
                          <td style={{ padding: "10px" }}>
                            <input type="number" value={item.rate} min={0} onChange={e => {
                                const t = [...items]; t[idx].rate = parseFloat(e.target.value) || 0; setItems(t);
                            }} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }} />
                          </td>
                          {billType === "TAX" && (
                            <td style={{ padding: "10px" }}>
                              <select value={item.gstRate} onChange={e => {
                                  const t = [...items]; t[idx].gstRate = parseInt(e.target.value); setItems(t);
                              }} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff" }}>
                                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                          )}
                          <td style={{ padding: "10px", textAlign: "right" }}>
                             <div style={{ fontWeight: 800, color: "#1e293b" }}>
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
                <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#4f46e5" }}>₹{totals.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ padding: "20px", background: "#f0f9ff", borderRadius: "16px", border: "1px solid #e0f2fe", marginTop: "10px" }}>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                    Amount Paid Now (₹)
                  </label>
                  <input type="number" value={paidAmount} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #bae6fd", fontSize: "1.1rem", fontWeight: 800, color: "#0369a1" }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                    Payment Mode
                  </label>
                  <CustomSelect value={paymentMode} onChange={(e: any) => setPaymentMode(e.target.value)} disableSearch>
                    <option value="CASH">Liquid Cash</option>
                    <option value="BANK">Bank / UPI</option>
                    <option value="CHEQUE">Cheque</option>
                  </CustomSelect>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", padding: "10px 0" }}>
                <span style={{ fontWeight: 600, color: "#64748b" }}>Balance Payable</span>
                <span style={{ fontWeight: 900, color: totals.balance > 0 ? "#ef4444" : "#22c55e" }}>₹{totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
                <button onClick={() => handleSave(false)} disabled={loading} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "1rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)" }}>
                  {loading ? "Saving..." : <><FaSave /> Save Purchase Bill</>}
                </button>
                <button onClick={() => handleSave(true)} disabled={loading} style={{ background: "#fff", color: "#4f46e5", border: "2px solid #4f46e5", borderRadius: "12px", padding: "14px", fontSize: "1rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                   Save & Print
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
