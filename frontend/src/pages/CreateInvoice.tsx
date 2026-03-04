// frontend/src/pages/CreateInvoice.tsx
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from "react";
import {
    FaArrowLeft,
    FaMoneyBillWave,
    FaPlus,
    FaReceipt,
    FaSave, FaTrash
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../api/companyApi";
import { fetchProducts, Product } from "../api/productApi";
import { Customer } from "../api/userApi";
import { useAuthUser } from "../hooks/useAuthUser";
import { useUsers } from "../hooks/useUsers";
import { apiFetch } from "../utils/api";
import "./CreateInvoice.css";

// Utility for Words conversion
const toWords = (num: number): string => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const formatted = ('000000000' + num).substr(-9);
    const n = formatted.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    const n1 = Number(n[1]); const n2 = Number(n[2]); const n3 = Number(n[3]); const n4 = Number(n[4]); const n5 = Number(n[5]);
    if (n1 !== 0) str += (a[n1] || b[Math.floor(n1 / 10)] + ' ' + a[n1 % 10]) + 'Crore ';
    if (n2 !== 0) str += (a[n2] || b[Math.floor(n2 / 10)] + ' ' + a[n2 % 10]) + 'Lakh ';
    if (n3 !== 0) str += (a[n3] || b[Math.floor(n3 / 10)] + ' ' + a[n3 % 10]) + 'Thousand ';
    if (n4 !== 0) str += (a[n4] || b[Math.floor(n4 / 10)] + ' ' + a[n4 % 10]) + 'Hundred ';
    if (n5 !== 0) str += (str !== '' ? 'and ' : '') + (a[n5] || b[Math.floor(n5 / 10)] + ' ' + a[n5 % 10]) + 'only ';
    return str;
};

const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface InvoiceItem {
    name: string;
    hsn: string;
    uom: string;
    qty: number;
    rate: number;
}

const CreateInvoice: React.FC = () => {
    const navigate = useNavigate();
    const { customers } = useUsers();
    const { user: authUser } = useAuthUser();
    const printRef = useRef<HTMLDivElement>(null);

    const [products, setProducts] = useState<Product[]>([]);
    const [company, setCompany] = useState<any>({});
    const [invoiceNo, setInvoiceNo] = useState("");
    const [items, setItems] = useState<InvoiceItem[]>([{ name: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 }]);
    const [notes, setNotes] = useState("");
    const [meta, setMeta] = useState({
        invoiceDate: new Date().toISOString().slice(0, 10),
        vehicleNumber: "", 
        bundles: 0, 
        transportMode: "", 
        reverseCharge: "No",
    });
    const [customerId, setCustomerId] = useState<number | null>(null);
    const [customer, setCustomer] = useState({ name: "", address: "", gstin: "", state: "", stateCode: "" });

    useEffect(() => {
        const load = async () => {
            const [p, prodData] = await Promise.all([fetchProfile(), fetchProducts()]);
            setCompany({
                name: p.company_name, address: p.address_line1, city_pincode: p.city_pincode,
                state: p.state, stateCode: "33", gstin: p.gstin
            });
            setProducts(prodData);
        };
        load();
    }, []);

    const handleProductSelect = (index: number, productId: string) => {
        const prod = products.find(p => p.id === parseInt(productId));
        if (prod) {
            const newItems = [...items];
            newItems[index] = {
                ...newItems[index],
                name: prod.name,
                hsn: prod.hsn_code || "",
                uom: prod.unit || "Pcs",
                rate: prod.selling_price || 0
            };
            setItems(newItems);
        }
    };

    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        setCustomerId(id);
        const c = customers.find((x: Customer) => x.id === id);
        if (c) {
            setCustomer({
                name: c.username.toUpperCase(),
                address: `${c.address_line1 || ''}, ${c.city_pincode || ''}`.toUpperCase(),
                gstin: c.gstin || "", state: c.state?.toUpperCase() || "", stateCode: c.state_code || ""
            });
        }
    };

    // Calculation Logic
    let totalTaxable = 0;
    const rows = items.map(it => {
        const amount = it.qty * it.rate;
        totalTaxable += amount;
        return { ...it, amount };
    });

    const taxAmount = totalTaxable * 0.18; // 18% GST Flattened Example
    const grandTotal = totalTaxable + taxAmount;

    const saveInvoice = async () => {
        if (!customerId || !invoiceNo) return alert("Missing Strategic parameters (Customer/Invoice No)");
        try {
            const body = {
                invoice_number: invoiceNo,
                customer_id: customerId,
                items: items.filter(i => i.name),
                notes: notes,
                grand_total: grandTotal
            };
            const res = await apiFetch("/invoice", { method: "POST", body: JSON.stringify(body) });
            if (res.ok) {
                alert("Fiscal Document Crystallized.");
                navigate("/invoices");
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="invoice-creation-canvas">
            {/* LEFT SIDE: FORM */}
            <div className="invoice-form-scroll">
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="btn-secondary" 
                            onClick={() => navigate(-1)} 
                            style={{ width: '48px', height: '48px', padding: 0, borderRadius: '14px' }}
                        >
                            <FaArrowLeft />
                        </motion.button>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-1.5px', margin: 0 }}>
                            Generate <span style={{ color: 'var(--primary)' }}>Manifest</span>
                        </h2>
                    </div>
                </header>

                {/* Section: Context */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="form-section-card">
                    <div className="form-section-label" style={{ marginBottom: '24px' }}>
                        <FaReceipt color="var(--primary)" /> <span>Fiscal Metadata</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-block">
                            <label>Document Index</label>
                            <input className="input-modern" placeholder="X-INV-999" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                        </div>
                        <div className="input-block">
                            <label>Execution Date</label>
                            <input className="input-modern" type="date" value={meta.invoiceDate} onChange={e => setMeta({...meta, invoiceDate: e.target.value})} />
                        </div>
                    </div>
                    <div className="input-block" style={{ marginTop: '20px' }}>
                        <label>Target Stakeholder</label>
                        <select className="input-modern" onChange={handleCustomerSelect} value={customerId || ""}>
                            <option value="">Interface with Stakeholder Registry...</option>
                            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.username}</option>)}
                        </select>
                    </div>
                </motion.div>

                {/* Section: Line Items */}
                <div className="form-section-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div className="form-section-label">
                            <FaPlus color="var(--primary)" /> <span>Asset Inventory Lines</span>
                        </div>
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="btn-secondary" 
                            style={{ padding: '10px 20px', fontSize: '0.8rem', fontWeight: 900 }}
                            onClick={() => setItems([...items, { name: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 }])}
                        >
                            Allocate New Row
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {items.map((it, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="item-row-card"
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className="input-block">
                                        <label>Neural Asset Link</label>
                                        <select className="input-modern" onChange={e => handleProductSelect(i, e.target.value)}>
                                            <option value="">Retrieve from Repository...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-block">
                                        <label>Custom Identifier</label>
                                        <input className="input-modern" value={it.name} onChange={e => { const t = [...items]; t[i].name = e.target.value; setItems(t); }} placeholder="Asset Description" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                    <div className="input-block">
                                        <label>Quantity</label>
                                        <input className="input-modern" type="number" value={it.qty || ""} onChange={e => { const t = [...items]; t[i].qty = Number(e.target.value); setItems(t); }} />
                                    </div>
                                    <div className="input-block">
                                        <label>Unit Valuation (₹)</label>
                                        <input className="input-modern" type="number" value={it.rate || ""} onChange={e => { const t = [...items]; t[i].rate = Number(e.target.value); setItems(t); }} />
                                    </div>
                                    <div className="input-block">
                                        <label>Aggregate Line Value</label>
                                        <div className="input-modern" style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 900 }}>
                                            ₹{fmt(it.qty * it.rate)}
                                        </div>
                                    </div>
                                </div>
                                {items.length > 1 && (
                                    <button className="remove-item-btn" onClick={() => { const t = [...items]; t.splice(i, 1); setItems(t); }}>
                                        <FaTrash size={12} />
                                    </button>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Section: Logistics */}
                <div className="form-section-card">
                    <div className="form-section-label" style={{ marginBottom: '24px' }}>
                        <FaMoneyBillWave color="var(--primary)" /> <span>Logistics Coordination</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-block">
                            <label>Transit Protocol</label>
                            <input className="input-modern" value={meta.transportMode} onChange={e => setMeta({...meta, transportMode: e.target.value})} placeholder="e.g. Hypersonic Surface" />
                        </div>
                        <div className="input-block">
                            <label>Vessel ID / Tracking</label>
                            <input className="input-modern" value={meta.vehicleNumber} onChange={e => setMeta({...meta, vehicleNumber: e.target.value})} placeholder="TRANSIT-ID-001" />
                        </div>
                    </div>
                </div>

                <div className="invoice-summary-bar">
                    <div className="total-display">
                        <span className="total-label">Total Liabilities (incl. Neural Tax)</span>
                        <span className="total-value">₹{fmt(grandTotal)}</span>
                    </div>
                    <motion.button 
                        whileHover={{ scale: 1.05, boxShadow: '0 15px 30px rgba(99, 102, 241, 0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary" 
                        style={{ padding: '16px 40px', fontSize: '1rem', height: '64px', borderRadius: '18px' }} 
                        onClick={saveInvoice}
                    >
                        <FaSave /> Execute & Record Manifest
                    </motion.button>
                </div>
            </div>

            {/* RIGHT SIDE: PREVIEW */}
            <div className="invoice-preview-container hide-mobile">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
                    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="invoice-paper-wrapper"
                >
                    <div className="invoice-paper" ref={printRef}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: "4px solid #1e293b", paddingBottom: "30px", marginBottom: "40px" }}>
                            <div>
                                <h1 style={{ margin: 0, fontSize: "3rem", fontWeight: 950, letterSpacing: '-2px', color: '#1e293b' }}>{company.name || "NEXUS SYSTEMS"}</h1>
                                <p style={{ margin: "8px 0", fontSize: "1rem", color: "#64748b", fontWeight: 600 }}>{company.address} | GSTIN: {company.gstin}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ background: '#1e293b', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '1.25rem', fontWeight: 900 }}>TAX INVOICE</div>
                                <div style={{ marginTop: '12px', color: '#64748b', fontWeight: 700 }}>#{invoiceNo || 'DRAFT-PROTO'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginBottom: '60px' }}>
                            <div>
                                <h4 style={{ textTransform: 'uppercase', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '0.1em' }}>Consignee Perspective</h4>
                                <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#1e293b' }}>{customer.name || '---'}</div>
                                <div style={{ color: '#475569', maxWidth: '300px', fontSize: '1rem', marginTop: '4px', lineHeight: '1.5', fontWeight: 500 }}>{customer.address}</div>
                                {customer.gstin && <div style={{ marginTop: '12px', fontSize: '0.9rem', fontWeight: 800 }}>GSTIN: <span style={{ color: 'var(--primary)' }}>{customer.gstin}</span></div>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h4 style={{ textTransform: 'uppercase', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '0.1em' }}>Execution Data</h4>
                                <div style={{ marginBottom: '8px', fontSize: '1.1rem', fontWeight: 700 }}>Temporal Index: <span style={{ color: '#1e293b' }}>{new Date(meta.invoiceDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</span></div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Logistics ID: <span style={{ color: '#1e293b' }}>{meta.vehicleNumber || 'N/A'}</span></div>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ textAlign: 'left', padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Identifier</th>
                                    <th style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Units</th>
                                    <th style={{ textAlign: 'right', padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Unit Rate</th>
                                    <th style={{ textAlign: 'right', padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hash Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '24px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{r.name || 'Prototype Line Item'}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>HSN: {r.hsn || '---'}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '24px 0', fontWeight: 700 }}>{r.qty} {r.uom}</td>
                                        <td style={{ textAlign: 'right', padding: '24px 0', fontWeight: 700 }}>₹{fmt(r.rate)}</td>
                                        <td style={{ textAlign: 'right', padding: '24px 0', fontWeight: 900, color: '#1e293b' }}>₹{fmt(r.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '350px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Operational Subtotal</span>
                                    <span style={{ fontWeight: 800 }}>₹{fmt(totalTaxable)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Neural Levy (18%)</span>
                                    <span style={{ fontWeight: 800 }}>₹{fmt(taxAmount)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 0', marginTop: '12px' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#1e293b' }}>Final Manifest Total</span>
                                    <span style={{ fontSize: '1.75rem', fontWeight: 950, color: 'var(--primary)' }}>₹{fmt(grandTotal)}</span>
                                </div>
                                
                                <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Amount in Words</div>
                                    <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem', lineHeight: '1.4' }}>{toWords(Math.round(grandTotal)).toUpperCase()}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '80px', paddingTop: '40px', borderTop: '2px solid #1e293b', display: 'grid', gridTemplateColumns: '1.5fr 1fr' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6' }}>
                                <div style={{ fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>DECLARATION</div>
                                We declare that this manifest shows the actual price of the assets described and that all particulars are true and correct.
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ height: '80px' }}></div>
                                <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1e293b' }}>AUTHORIZED EXECUTION</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Nexus Systems Control Node</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default CreateInvoice;