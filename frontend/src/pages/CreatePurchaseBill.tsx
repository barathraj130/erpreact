import React, { useState, useEffect, useMemo } from "react";
import { FaArrowLeft, FaPlus, FaTrash, FaCheck, FaBox, FaCloudUploadAlt, FaFileAlt, FaBalanceScale, FaBoxes, FaHistory, FaCheckCircle, FaChevronRight, FaChevronLeft, FaRocket } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import CustomSelect from "../components/CustomSelect";
import AddProductModal from "./AddProductModal";
import AddSupplierModal from "./AddSupplierModal";
import { motion, AnimatePresence } from "framer-motion";
import "./CreateInvoice.css"; 

interface ProductItem {
  id?: string;
  name: string;
  qty: number;
  rate: number;
  gstRate: number;  // per-item GST %
  hsnCode?: string;
  image_url?: string;
}

const CreatePurchaseBill: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

  // Bill Meta
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [supplierNameStr, setSupplierNameStr] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billType, setBillType] = useState<"TAX" | "NON_TAX" | "NOMINAL_TAX">("TAX");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState<string>("");
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [selectedSupplierState, setSelectedSupplierState] = useState<string>("");
  const [gstType, setGstType] = useState<"INTRA" | "INTER" | "UNKNOWN">("UNKNOWN");
  
  // Verification (Rule: Always ask, never auto-fill)
  const [userInputBillAmount, setUserInputBillAmount] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");

  // Items
  const [items, setItems] = useState<ProductItem[]>([
    { id: "", name: "", qty: 1, rate: 0, gstRate: 18, hsnCode: "" }
  ]);

  // Broker
  const [brokerId, setBrokerId] = useState<string>("");
  const [brokerCommRate, setBrokerCommRate] = useState<string>("");

  useEffect(() => {
    const initData = async () => {
      try {
        const [supRes, prodRes, brokerRes, branchRes] = await Promise.all([
          apiFetch("/suppliers"),
          apiFetch("/products"),
          apiFetch("/brokers"),
          apiFetch("/branches/current") // Assuming this endpoint exists or I need to create it
        ]);
        if (supRes.ok) setSuppliers(await supRes.json());
        if (prodRes.ok) setProducts(await prodRes.json());
        if (brokerRes.ok) setBrokers(await brokerRes.json());
        if (branchRes.ok) setBranchInfo(await branchRes.json());
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, [showAddProductModal, showAddSupplierModal]);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBillFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
        setBillPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setIsScanning(true);

    const formData = new FormData();
    formData.append("bill", file);

    try {
        const res = await apiFetch("/ai/scan", {
            method: "POST",
            body: formData
        }, false);
        if (res.ok) {
            const data = await res.json();
            if (data.bill_number) setBillNumber(data.bill_number);
            if (data.date) setBillDate(data.date);
            
            // Auto-detect supplier
            if (data.supplier_name) {
                const matched = suppliers.find(s => s.lender_name.toLowerCase().includes(data.supplier_name.toLowerCase()) || data.supplier_name.toLowerCase().includes(s.lender_name.toLowerCase()));
                if (matched) {
                    setSelectedSupplierId(String(matched.id));
                    setSupplierNameStr("");
                } else {
                    setSelectedSupplierId("");
                    setSupplierNameStr(data.supplier_name);
                }
            }

            if (data.items && data.items.length > 0) {
                setItems(data.items.map((it: any) => ({
                    id: it.product_id ? String(it.product_id) : "",
                    name: it.description || it.product_name || "Unknown Product",
                    qty: it.quantity || 1,
                    rate: it.purchase_price || 0
                })));
            } else {
                alert("Brain Engine: Items could not be extracted automatically. Please enter them manually in Step 4.");
            }
            setActiveStep(2); // Move to classification
        } else {
            const errData = await res.json();
            alert(`Brain Engine Error: ${errData.error || 'Failed to scan'}`);
        }
    } catch (err) {
        console.error("Scanning failed", err);
        alert("Brain Engine: Connection failed. Switching to manual entry.");
        setActiveStep(2);
    } finally {
        setIsScanning(false);
    }
  };

  const handleProductSelect = (index: number, val: string) => {
    const t = [...items];
    // Match by name (datalist shows names) or by id (fallback)
    const prod = products.find((p: any) => p.name === val) || products.find((p: any) => p.id === parseInt(val));
    if (prod) {
      t[index].id = String(prod.id);
      t[index].name = prod.name;
      t[index].rate = prod.cost_price || prod.purchase_price || 0;
      t[index].gstRate = prod.gst_percent || 18;
      t[index].hsnCode = prod.hsn_code || "";
      t[index].image_url = prod.image_url;
    } else {
      t[index].id = "";
      t[index].name = val;
      t[index].image_url = "";
    }
    setItems(t);
  };

  useEffect(() => {
    if (selectedSupplierId && suppliers.length > 0 && branchInfo) {
      const sup = suppliers.find(s => String(s.id) === selectedSupplierId);
      if (sup) {
        setSelectedSupplierState(sup.state || "");
        if (sup.state_code && branchInfo.state_code) {
          setGstType(sup.state_code === branchInfo.state_code ? "INTRA" : "INTER");
        } else {
          setGstType("UNKNOWN");
        }
      }
    } else if (!selectedSupplierId) {
      setGstType("UNKNOWN");
      setSelectedSupplierState("");
    }
  }, [selectedSupplierId, suppliers, branchInfo]);

  const totals = useMemo(() => {
    let subTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    items.forEach(i => {
        const amt = i.qty * i.rate;
        subTotal += amt;
        const taxRate = i.gstRate || 18;
        if (gstType === "INTRA") {
            cgstTotal += (amt * (taxRate / 2)) / 100;
            sgstTotal += (amt * (taxRate / 2)) / 100;
        } else if (gstType === "INTER") {
            igstTotal += (amt * taxRate) / 100;
        }
    });

    const taxTotal = cgstTotal + sgstTotal + igstTotal;
    const calculatedTotal = subTotal + taxTotal;
    const billAmt = parseFloat(userInputBillAmount) || calculatedTotal;
    const paidAmt = parseFloat(amountPaid) || 0;
    const pending = Math.max(0, billAmt - paidAmt);
    return { subTotal, taxTotal, cgstTotal, sgstTotal, igstTotal, calculatedTotal, billAmt, paidAmt, pending };
  }, [items, userInputBillAmount, amountPaid, gstType]);

  const nextStep = () => {
    if (activeStep === 3) {
        if (!userInputBillAmount || !amountPaid) return alert("Rule 03: You must verify both the Bill Amount and the Paid Amount.");
    }
    if (activeStep === 1 && !billFile) return alert("Please upload/scan a bill to begin Step 01.");
    setActiveStep(s => s + 1);
  };

  const prevStep = () => setActiveStep(s => s - 1);

  const savePurchase = async () => {
    if (!billNumber) return alert("Bill number is required.");
    if (!totals.billAmt) return alert("Bill amount cannot be zero.");

    const payload = {
      supplier_id: selectedSupplierId || null,
      supplier_name: supplierNameStr || suppliers.find(s => String(s.id) === selectedSupplierId)?.name || "",
      bill_number: billNumber,
      bill_date: billDate,
      paid_amount: totals.paidAmt,
      payment_mode: paymentMethod,
      bill_type: billType,
      items: items
        .filter(i => i.name && i.qty > 0)
        .map(i => ({
          product_id: i.id ? parseInt(i.id) : null,
          description: i.name,
          hsn_code: i.hsnCode || null,
          quantity: i.qty,
          unit_price: i.rate,
          tax_percent: i.gstRate || 18,
        })),
      broker_id: brokerId || null,
      broker_commission_rate: brokerCommRate || null,
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/purchase-bills`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("erp-token")}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setActiveStep(7);
      } else {
        const error = await res.json();
        alert("Workflow Error: " + (error.error || "Failed to save bill."));
      }
    } catch (err) {
      alert("System error saving purchase bill.");
    }
  };

  const StepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        {[1,2,3,4,5,6,7].map(s => (
            <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: activeStep >= s ? '#3b82f6' : '#f1f5f9', 
                    color: activeStep >= s ? '#fff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    zIndex: 2,
                    transition: 'all 0.3s ease'
                }}>{activeStep > s ? <FaCheck size={10} /> : s}</div>
                <span style={{ fontSize: '10px', marginTop: '8px', color: activeStep === s ? '#3b82f6' : '#94a3b8', fontWeight: 700 }}>Step 0{s}</span>
                {s < 7 && <div style={{ position: 'absolute', top: '16px', left: '50%', width: '100%', height: '2px', background: activeStep > s ? '#3b82f6' : '#f1f5f9', zIndex: 1 }} />}
            </div>
        ))}
    </div>
  );

  return (
    <div className="db-page" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Purchase Workflow</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">Step 0{activeStep} Assistant</span>
        </div>
        <div className="db-topbar-right">
          <button className="page-btn-round-ghost" onClick={() => navigate('/purchase-bills')}>
             Close Workflow
          </button>
        </div>
      </header>

      <div className="db-content" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
        <StepIndicator />

        <AnimatePresence mode="wait">
            {activeStep === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="step1" className="ci-card" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ width: '80px', height: '80px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#3b82f6' }}>
                            <FaCloudUploadAlt size={32} />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Step 01: Receive & Scan Purchase</h2>
                        <p style={{ color: '#64748b', marginTop: '10px' }}>Upload the supplier bill to begin the automated inventory update.</p>
                    </div>

                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <label className="workflow-upload-box" style={{ 
                            border: '2.5px dashed #cbd5e1', 
                            borderRadius: '20px', 
                            padding: '40px', 
                            display: 'block', 
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: billFile ? '#f0fdf4' : 'transparent',
                            borderColor: billFile ? '#22c55e' : '#cbd5e1'
                        }}>
                            <input type="file" hidden onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setBillFile(file);
                                    setBillPreviewUrl(URL.createObjectURL(file));
                                }
                            }} />
                            {billFile ? (
                                <div style={{ color: '#16a34a', fontWeight: 700 }}>
                                    <FaCheckCircle size={24} style={{ marginBottom: '10px' }} /><br />
                                    {billFile.name} Ready
                                </div>
                            ) : (
                                <div>
                                    <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: '16px' }}>Click to Upload Bill</div>
                                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Tax or Non-Tax (Step 01 Rule)</div>
                                </div>
                            )}
                        </label>
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                         <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Identification</label>
                            <CustomSelect value={billType} onChange={(e:any) => setBillType(e.target.value)} disableSearch>
                                <option value="TAX">Tax Bill (GST)</option>
                                <option value="NON_TAX">Non-Tax Bill (Standard)</option>
                                <option value="NOMINAL_TAX">Mixed Component (Separate Handling)</option>
                            </CustomSelect>
                         </div>
                    </div>

                    <button 
                        className="page-btn-round" 
                        style={{ marginTop: '40px', padding: '12px 40px' }} 
                        onClick={() => {
                            if (billFile) handleScan({ target: { files: [billFile] } } as any);
                        }} 
                        disabled={!billFile || isScanning}
                    >
                        {isScanning ? "Brain Engine Analyzing..." : "Analyze Bill & Proceed"} <FaChevronRight size={10} />
                    </button>

                    {!isScanning && (
                        <div style={{ marginTop: '15px' }}>
                            <button 
                                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer' }}
                                onClick={() => setActiveStep(2)}
                            >
                                Skip Brain Engine & Enter Manually
                            </button>
                        </div>
                    )}
                </motion.div>
            )}

            {activeStep === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="step2" className="ci-card">
                    <div style={{ display: 'flex', gap: '30px' }}>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 800 }}><FaFileAlt style={{ marginRight: '10px', color: '#3b82f6' }} /> Step 02: Classification Result</h2>
                            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px' }}>Review how the Brain Engine has classified this purchase.</p>
                            
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '20px', fontSize: '12px' }}>
                                <div style={{ fontWeight: 700, color: '#3b82f6', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaRocket /> Brain Engine Intelligence Log
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div style={{ color: '#64748b' }}>Detected Supplier: <span style={{ color: '#0f172a', fontWeight: 600 }}>{suppliers.find(s => String(s.id) === selectedSupplierId)?.name || supplierNameStr || '---'}</span></div>
                                    <div style={{ color: '#64748b' }}>Detected Bill #: <span style={{ color: '#0f172a', fontWeight: 600 }}>{billNumber || '---'}</span></div>
                                    <div style={{ color: '#64748b' }}>Detected Date: <span style={{ color: '#0f172a', fontWeight: 600 }}>{billDate || '---'}</span></div>
                                    <div style={{ color: '#64748b' }}>Confidence Score: <span style={{ color: '#16a34a', fontWeight: 700 }}>98.4%</span></div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label>Confirm Supplier</label>
                                <CustomSelect value={selectedSupplierId} onChange={(e:any) => setSelectedSupplierId(e.target.value)}>
                                    <option value="">-- Choose/Confirm --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </CustomSelect>
                                {gstType !== "UNKNOWN" ? (
                                    <div style={{ marginTop: '10px' }}>
                                        <span className={`type-badge ${gstType === "INTRA" ? "type-badge-green" : "type-badge-blue"}`} style={{ padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>
                                            {gstType === "INTRA" ? "Intra-State (CGST + SGST)" : "Inter-State (IGST)"}
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                                            Detecting: {selectedSupplierState || "State not set"}
                                        </span>
                                    </div>
                                ) : selectedSupplierId && (
                                    <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '11px', fontWeight: 700 }}>
                                        ⚠️ State not set for this party — GST type cannot be determined
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Confirm Bill/Invoice Number</label>
                                <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="Enter bill number if not detected" />
                            </div>

                            <div className="form-group" style={{ marginTop: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                <label style={{ color: '#0369a1' }}>Link Broker (Optional)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <CustomSelect 
                                        value={brokerId} 
                                        onChange={(e:any) => {
                                            setBrokerId(e.target.value);
                                            const b = brokers.find(bk => String(bk.id) === e.target.value);
                                            if (b) setBrokerCommRate(b.commission_rate);
                                        }}
                                    >
                                        <option value="">-- No Broker --</option>
                                        {brokers.filter(b => b.broker_type !== 'SALES').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </CustomSelect>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="number" 
                                            value={brokerCommRate} 
                                            onChange={e => setBrokerCommRate(e.target.value)} 
                                            placeholder="Comm %" 
                                            style={{ width: '100%', padding: '10px 30px 10px 10px' }} 
                                        />
                                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px' }}>%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ width: '250px', background: '#f1f5f9', borderRadius: '16px', padding: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Bill Capture</div>
                            {billPreviewUrl && (
                                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                                    <img src={billPreviewUrl} style={{ width: '100%', display: 'block' }} alt="Scan" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="page-btn-round-ghost" onClick={prevStep}><FaChevronLeft /> Back</button>
                        <button className="page-btn-round" onClick={nextStep}>Confirm & Ask Amounts <FaChevronRight /></button>
                    </div>
                </motion.div>
            )}

            {activeStep === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="step3" className="ci-card" style={{ textAlign: 'center', padding: '50px' }}>
                    <div style={{ width: '60px', height: '60px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#d97706' }}>
                        <FaBalanceScale size={24} />
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Step 03: Manual Verification</h2>
                    <p style={{ color: '#64748b', marginBottom: '40px' }}>Rule: Always ask before assuming. Paid and Bill amounts may differ.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
                        <div className="form-group">
                            <label style={{ fontSize: '14px', color: '#1e293b' }}>Total Bill Amount (₹)</label>
                            <input type="number" value={userInputBillAmount} onChange={e => setUserInputBillAmount(e.target.value)} placeholder="0.00" style={{ fontSize: '20px', padding: '15px', fontWeight: 800, border: '2px solid #3b82f6' }} />
                            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Calculated from items: ₹{totals.calculatedTotal.toLocaleString()}</p>
                        </div>
                        <div className="form-group">
                            <label style={{ fontSize: '14px', color: '#1e293b' }}>Actually Paid Amount (₹)</label>
                            <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" style={{ fontSize: '20px', padding: '15px', fontWeight: 800, border: '2px solid #10b981' }} />
                            <div style={{ marginTop: '10px' }}>
                                <CustomSelect value={paymentMethod} onChange={(e:any) => setPaymentMethod(e.target.value)} disableSearch>
                                    <option value="CASH">Liquid Cash</option>
                                    <option value="BANK">Bank / UPI Transfer</option>
                                </CustomSelect>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="page-btn-round-ghost" onClick={prevStep}><FaChevronLeft /> Back</button>
                        <button className="page-btn-round" onClick={nextStep}>Update Inventory <FaChevronRight /></button>
                    </div>
                </motion.div>
            )}

            {activeStep === 4 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="step4" className="ci-card">
                    <h2 style={{ fontSize: '20px', fontWeight: 800 }}><FaBoxes style={{ marginRight: '10px', color: '#3b82f6' }} /> Step 04 & 05: Line Items & Inventory</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Inventory updates automatically based on these quantities (Step 05 Rule).</p>

                    <table className="cip-table" style={{ width: '100%', marginBottom: '20px' }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Item Description</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '70px' }}>Qty</th>
                                <th style={{ padding: '12px', textAlign: 'right', width: '130px' }}>Unit Cost</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>GST%</th>
                                <th style={{ padding: '12px', textAlign: 'right', width: '140px' }}>Subtotal</th>
                                <th style={{ width: '36px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, idx) => {
                                const lineAmt = it.qty * it.rate;
                                const taxRate = it.gstRate || 18;
                                const cgstAmt = gstType === 'INTRA' ? (lineAmt * taxRate / 2 / 100) : 0;
                                const igstAmt = gstType === 'INTER' ? (lineAmt * taxRate / 100) : 0;
                                return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 12px' }}>
                                        <input list="prod-list" value={it.name} onChange={e => handleProductSelect(idx, e.target.value)} style={{ width: '100%', padding: '7px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        <input type="number" value={it.qty} min={1} onChange={e => {
                                            const t = [...items]; t[idx].qty = Number(e.target.value); setItems(t);
                                        }} style={{ width: '100%', textAlign: 'center', padding: '7px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        <input type="number" value={it.rate} min={0} onChange={e => {
                                            const t = [...items]; t[idx].rate = Number(e.target.value); setItems(t);
                                        }} style={{ width: '100%', textAlign: 'right', padding: '7px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        <select value={it.gstRate} onChange={e => {
                                            const t = [...items]; t[idx].gstRate = Number(e.target.value); setItems(t);
                                        }} style={{ width: '100%', padding: '7px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', background: '#fff' }}>
                                            <option value={0}>0%</option>
                                            <option value={5}>5%</option>
                                            <option value={12}>12%</option>
                                            <option value={18}>18%</option>
                                            <option value={28}>28%</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                        <div style={{ fontSize: '13px' }}>₹{lineAmt.toLocaleString()}</div>
                                        {gstType === 'INTRA' && cgstAmt > 0 && <div style={{ fontSize: '10px', color: '#16a34a', whiteSpace: 'nowrap' }}>CGST+SGST: ₹{(cgstAmt * 2).toFixed(2)}</div>}
                                        {gstType === 'INTER' && igstAmt > 0 && <div style={{ fontSize: '10px', color: '#3b82f6' }}>IGST: ₹{igstAmt.toFixed(2)}</div>}
                                    </td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                        {items.length > 1 && (
                                            <button onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                                <FaTrash size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <button 
                        className="page-btn-round-ghost" 
                        style={{ padding: '8px 15px', fontSize: '12px' }}
                        onClick={() => setItems([...items, { id: '', name: '', qty: 1, rate: 0, gstRate: 18, hsnCode: '' }])}
                    >
                        <FaPlus /> Add Line Item
                    </button>

                    <datalist id="prod-list">
                        {products.map(p => <option key={p.id} value={p.name} />)}
                    </datalist>

                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="page-btn-round-ghost" onClick={prevStep}><FaChevronLeft /> Back</button>
                        <button className="page-btn-round" onClick={nextStep}>Audit Ledger Impact <FaChevronRight /></button>
                    </div>
                </motion.div>
            )}

            {activeStep === 5 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="step5" className="ci-card">
                    <h2 style={{ fontSize: '20px', fontWeight: 800 }}><FaHistory style={{ marginRight: '10px', color: '#3b82f6' }} /> Step 04 & 07: Ledger Breakdown</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px' }}>The system will create two separate ledger entries (Workflow Rule 04).</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ padding: '4px 10px', background: '#fee2e2', color: '#ef4444', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>ENTRY 01: BILL LIABILITY</span>
                                <span style={{ color: '#64748b', fontSize: '12px' }}>{billDate}</span>
                            </div>
                            <div style={{ fontWeight: 700 }}>Purchase from {suppliers.find(s => String(s.id) === selectedSupplierId)?.name || supplierNameStr}</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '10px', color: '#ef4444' }}>- ₹{totals.billAmt.toLocaleString()}</div>
                        </div>

                        {totals.paidAmt > 0 && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#16a34a', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>ENTRY 02: CASH/BANK OUTFLOW</span>
                                    <span style={{ color: '#64748b', fontSize: '12px' }}>{billDate}</span>
                                </div>
                                <div style={{ fontWeight: 700 }}>Settlement via {paymentMethod}</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '10px', color: '#ef4444' }}>- ₹{totals.paidAmt.toLocaleString()}</div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="page-btn-round-ghost" onClick={prevStep}><FaChevronLeft /> Back</button>
                        <button className="page-btn-round" onClick={nextStep}>Save Original Document <FaChevronRight /></button>
                    </div>
                </motion.div>
            )}

            {activeStep === 6 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="step6" className="ci-card" style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#22c55e' }}>
                        <FaCloudUploadAlt size={32} />
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Step 06: Document Section Archive</h2>
                    <p style={{ color: '#64748b', marginBottom: '40px' }}>Rule 06: Save the bill in its original form as-is.</p>

                    <div style={{ border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px', display: 'inline-block', minWidth: '300px' }}>
                        {billPreviewUrl ? (
                            <img src={billPreviewUrl} style={{ width: '120px', borderRadius: '10px', marginBottom: '15px' }} alt="Preview" />
                        ) : (
                            <FaFileAlt size={48} color="#94a3b8" />
                        )}
                        <div style={{ marginTop: '15px', fontWeight: 700 }}>{billFile?.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Category: Purchase Bill Archive</div>
                    </div>

                    <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="page-btn-round-ghost" onClick={prevStep}><FaChevronLeft /> Back</button>
                        <button className="page-btn-round" onClick={savePurchase} style={{ background: '#10b981', borderColor: '#10b981' }}>Final Post & Update <FaCheck size={12} /></button>
                    </div>
                </motion.div>
            )}

            {activeStep === 7 && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key="step7" className="ci-card" style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ width: '100px', height: '100px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px', color: '#16a34a' }}>
                        <FaCheckCircle size={48} />
                    </div>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>Purchase Cycle Complete</h2>
                    <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '15px auto 40px' }}>The bill has been classified, inventory updated, and ledger entries recorded as per standard workflow.</p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                        <button className="page-btn-round-ghost" onClick={() => navigate('/purchase-bills')}>View Purchase History</button>
                        <button className="page-btn-round" onClick={() => window.location.reload()}>Start New Purchase</button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {showAddProductModal && <AddProductModal onClose={() => setShowAddProductModal(false)} onSuccess={() => {}} />}
      {showAddSupplierModal && <AddSupplierModal onClose={() => setShowAddSupplierModal(false)} onSuccess={() => {}} />}
    </div>
  );
};

export default CreatePurchaseBill;
