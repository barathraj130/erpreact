// frontend/src/pages/CreateInvoice.tsx
import React, { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaCheckCircle, FaCreditCard, FaMobileAlt, FaMoneyBillWave, FaPlus, FaPrint, FaReceipt, FaSave, FaTrash, FaUniversity, FaWallet } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../api/companyApi";
import { useAuthUser } from "../hooks/useAuthUser";
import { useUsers } from "../hooks/useUsers";
import { apiFetch } from "../utils/api";

// Helper function to convert numbers to words
function convertNumberToWords(num: number): string {
    num = Math.floor(num);
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
        'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];
    if ((num = num.toString() as any).length > 9) return 'Overflow';
    const n: any = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? a[Number(n[4])] + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + a[n[5][1]]) + 'Only ' : '';
    return str.toUpperCase();
}

// Table cell styles
const tableHeaderStyle: React.CSSProperties = { border: "1px solid #000", padding: "4px 3px", fontWeight: "bold", background: "#f1f5f9", textAlign: "center" };
const tableCellStyle: React.CSSProperties = { border: "1px solid #000", padding: "3px", textAlign: "center", height: "20px" };
const tableCellLeftStyle: React.CSSProperties = { ...tableCellStyle, textAlign: "left", paddingLeft: "4px" };
const tableCellRightStyle: React.CSSProperties = { ...tableCellStyle, textAlign: "right", paddingRight: "4px" };

// Payment method options
const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash', icon: <FaMoneyBillWave />, color: '#10b981' },
    { value: 'BANK_TRANSFER', label: 'Bank', icon: <FaUniversity />, color: '#3b82f6' },
    { value: 'UPI', label: 'UPI', icon: <FaMobileAlt />, color: '#8b5cf6' },
    { value: 'CARD', label: 'Card', icon: <FaCreditCard />, color: '#f59e0b' },
    { value: 'CHEQUE', label: 'Cheque', icon: <FaReceipt />, color: '#64748b' },
    { value: 'WALLET', label: 'Wallet', icon: <FaWallet />, color: '#ec4899' }
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

const CreateInvoice: React.FC = () => {
    const navigate = useNavigate();
    const { customers } = useUsers();
    const { user } = useAuthUser();
    const printRef = useRef<HTMLDivElement>(null);

    const [company, setCompany] = useState<any>({});
    const [invoiceNo, setInvoiceNo] = useState("");
    const [items, setItems] = useState<InvoiceItem[]>([{ name: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 }]);
    const [notes, setNotes] = useState("");
    const [amountPaidAlready, setAmountPaidAlready] = useState<number>(0);
    
    // Multiple payments array
    const [payments, setPayments] = useState<PaymentEntry[]>([
        { amount: 0, payment_method: 'CASH', payment_date: new Date().toISOString().slice(0, 10), reference_no: '' }
    ]);

    const [meta, setMeta] = useState({
        invoiceDate: new Date().toISOString().slice(0, 10),
        vehicleNumber: "", bundles: 0, placeOfSupply: "", supplyStateCode: "",
        transportMode: "", reverseCharge: "No", dateOfSupply: new Date().toISOString().slice(0, 10)
    });
    const [customerId, setCustomerId] = useState<number | null>(null);
    const [customer, setCustomer] = useState({ name: "", address: "", gstin: "", state: "", stateCode: "" });

    useEffect(() => {
        const load = async () => {
            const p = await fetchProfile();
            setCompany({
                name: p.company_name, address: p.address_line1, city_pincode: p.city_pincode,
                state: p.state, stateCode: "33", gstin: p.gstin, bank_name: p.bank_name,
                ac_no: p.bank_account_no, ifsc: p.bank_ifsc_code, signature_url: p.signature_url || null
            });
        };
        load();
    }, []);

    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        setCustomerId(id);
        const c = customers.find(x => x.id === id);
        if (c) {
            setCustomer({
                name: c.username.toUpperCase(),
                address: `${c.address_line1 || ''}, ${c.city_pincode || ''}`.toUpperCase(),
                gstin: c.gstin || "", state: c.state?.toUpperCase() || "", stateCode: c.state_code || ""
            });
            setMeta(prev => ({ ...prev, placeOfSupply: c.state?.toUpperCase() || "", supplyStateCode: c.state_code || "" }));
        }
    };

    let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
    const rows = items.map(it => {
        const amount = it.qty * it.rate;
        const taxable = amount;
        const isSameState = customer.stateCode === company.stateCode;
        const cgstRate = isSameState ? 2.5 : 0;
        const sgstRate = isSameState ? 2.5 : 0;
        const igstRate = isSameState ? 0 : 5;
        const cgst = taxable * (cgstRate / 100);
        const sgst = taxable * (sgstRate / 100);
        const igst = taxable * (igstRate / 100);
        totalTaxable += taxable; totalCGST += cgst; totalSGST += sgst; totalIGST += igst;
        return { ...it, amount, taxable, cgstRate, sgstRate, igstRate, cgst, sgst, igst, lineTotal: taxable + cgst + sgst + igst };
    });

    const totalGST = totalCGST + totalSGST + totalIGST;
    const grandTotal = Math.round(totalTaxable + totalGST);
    
    // Calculate total from all payments being made now
    const paymentNow = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPaid = amountPaidAlready + paymentNow;
    const balanceDue = grandTotal - totalPaid;
    const paymentProgress = grandTotal > 0 ? (totalPaid / grandTotal) * 100 : 0;

    const getPaymentStatus = () => {
        if (balanceDue <= 0 && grandTotal > 0) return { label: 'PAID', color: '#10b981', bg: '#dcfce7' };
        if (totalPaid > 0) return { label: 'PARTIAL', color: '#f59e0b', bg: '#fef3c7' };
        return { label: 'UNPAID', color: '#ef4444', bg: '#fee2e2' };
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
        setPayments([...payments, { 
            amount: 0, 
            payment_method: 'CASH', 
            payment_date: new Date().toISOString().slice(0, 10), 
            reference_no: '' 
        }]);
    };

    const removePayment = (index: number) => {
        if (payments.length > 1) {
            const newPayments = [...payments];
            newPayments.splice(index, 1);
            setPayments(newPayments);
        }
    };

    const updatePayment = (index: number, field: keyof PaymentEntry, value: any) => {
        const newPayments = [...payments];
        newPayments[index] = { ...newPayments[index], [field]: value };
        setPayments(newPayments);
    };

    const saveInvoice = async () => {
        if (!customerId) {
            alert("Please select a customer");
            return;
        }
        
        if (!invoiceNo.trim()) {
            alert("Please enter an invoice number");
            return;
        }

        if (items.length === 0 || items.every(item => !item.name.trim())) {
            alert("Please add at least one item");
            return;
        }
        
        // Filter and format valid payments
        const validPayments = payments
            .filter(p => p.amount > 0)
            .map(p => ({
                amount: Number(p.amount),
                payment_method: p.payment_method,
                payment_date: p.payment_date,
                reference_no: p.reference_no || '',
                notes: `Payment via ${PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method}`
            }));

        // Format items to ensure proper data types
        const formattedItems = items
            .filter(item => item.name.trim())
            .map(item => ({
                name: item.name,
                hsn: item.hsn || '',
                uom: item.uom || 'Pcs',
                qty: Number(item.qty) || 0,
                rate: Number(item.rate) || 0
            }));

        // Create payload matching the original backend format
        // Note: Multiple payments stored in frontend, but backend gets totals only
        const payload: any = {
            invoice_number: invoiceNo.trim(),
            invoice_type: "TAX_INVOICE",
            customer_id: customerId,
            items: formattedItems,
            notes: notes.trim(),
            amount_paid: totalPaid,
            balance_due: balanceDue,
            payment_status: status.label,
            transport_details: {
                vehicle: meta.vehicleNumber || '',
                mode: meta.transportMode || '',
                supply_date: meta.dateOfSupply,
                reverse_charge: meta.reverseCharge
            },
            bundles_count: Number(meta.bundles) || 0
        };

        // If there are payments being made now, send them in the old format
        // Backend will need to be updated to handle multiple payments properly
        if (validPayments.length > 0) {
            // For now, send as array - backend should be updated to handle this
            payload.payments = validPayments;
            
            // Add a summary note about multiple payments
            if (validPayments.length > 1) {
                const paymentSummary = validPayments.map((p, i) => 
                    `Payment ${i+1}: ₹${p.amount.toLocaleString('en-IN')} via ${PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label}`
                ).join('; ');
                payload.notes = payload.notes + (payload.notes ? '\n\n' : '') + 'Multiple Payments: ' + paymentSummary;
            }
        }
        
        console.log('Saving invoice with payload:', payload);
        console.log('Valid payments:', validPayments);
        
        try {
            const response = await apiFetch("/invoice", { 
                method: "POST", 
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Invoice saved successfully:', result);
                alert("Invoice saved successfully!");
                navigate("/invoices");
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('Backend error response:', errorData);
                console.error('Full response status:', response.status);
                
                // Show detailed error
                let errorMsg = 'Failed to save invoice';
                if (errorData.message) errorMsg = errorData.message;
                else if (errorData.error) errorMsg = errorData.error;
                else if (errorData.details) errorMsg = JSON.stringify(errorData.details);
                
                alert(`Error saving invoice: ${errorMsg}`);
            }
        } catch (err: any) {
            console.error('Exception while saving:', err);
            alert(`Failed to save invoice: ${err.message || 'Network error'}`);
        }
    };

    const printInvoice = () => {
        const printContents = printRef.current?.innerHTML;
        if (!printContents) return;
        const w = window.open('', '', 'width=900,height=650');
        w!.document.write(`<html><head><title>Invoice</title><style>body{margin:0;padding:0;font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:4px;font-size:10px}@media print{body{margin:0;padding:0}}</style></head><body>${printContents}</body></html>`);
        w!.document.close(); w!.focus(); w!.print();
    };

    const sectionStyle: React.CSSProperties = { background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "15px" };
    const sectionTitleStyle: React.CSSProperties = { fontSize: "0.9rem", fontWeight: 700, color: "#3b82f6", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" };
    const inputLabelStyle: React.CSSProperties = { fontWeight: 600, fontSize: "12px", color: "#475569", marginBottom: "4px", display: "block" };
    const inputStyle: React.CSSProperties = { width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box" };

    return (
        <div style={{ display: "flex", height: "100vh", background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{ width: "450px", background: "#fff", borderRight: "1px solid #d1d5db", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "15px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={() => navigate("/invoices")} style={{ background: "none", border: "none", cursor: "pointer" }}><FaArrowLeft size={16} /></button>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, flex: 1, margin: 0 }}>New Invoice</h2>
                    <button onClick={printInvoice} style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", padding: "6px 12px", borderRadius: "6px", color: "#0284c7", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}><FaPrint /> Print</button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                    {/* Basic Details Section */}
                    <div style={sectionStyle}>
                        <h3 style={sectionTitleStyle}>Basic Details</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                            <div><label style={inputLabelStyle}>Invoice No</label><input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} style={inputStyle} /></div>
                            <div><label style={inputLabelStyle}>Invoice Date</label><input type="date" value={meta.invoiceDate} onChange={e => setMeta({ ...meta, invoiceDate: e.target.value })} style={inputStyle} /></div>
                        </div>
                        <div><label style={inputLabelStyle}>Customer</label>
                            <select value={customerId || ""} onChange={handleCustomerSelect} style={inputStyle}>
                                <option value="">-- Select Customer --</option>
                                {customers.filter(c => c.username !== "admin").map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div style={sectionStyle}>
                        <h3 style={sectionTitleStyle}>Items</h3>
                        {items.map((it, i) => (
                            <div key={i} style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
                                <input placeholder="Item Name" value={it.name} onChange={e => { const t = [...items]; t[i].name = e.target.value; setItems(t); }} style={{ ...inputStyle, marginBottom: "8px" }} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 30px", gap: "8px" }}>
                                    <input placeholder="HSN" value={it.hsn} onChange={e => { const t = [...items]; t[i].hsn = e.target.value; setItems(t); }} style={inputStyle} />
                                    <input type="number" placeholder="Qty" value={it.qty || ""} onChange={e => { const t = [...items]; t[i].qty = Number(e.target.value); setItems(t); }} style={inputStyle} />
                                    <input type="number" placeholder="Rate" value={it.rate || ""} onChange={e => { const t = [...items]; t[i].rate = Number(e.target.value); setItems(t); }} style={inputStyle} />
                                    <button onClick={() => { const t = [...items]; t.splice(i, 1); setItems(t); }} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}><FaTrash /></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setItems([...items, { name: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 }])} style={{ width: "100%", padding: "8px", background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: "6px", color: "#0284c7", fontWeight: 600, cursor: "pointer" }}>+ Add Item</button>
                    </div>

                    {/* Payment & Notes Section */}
                    <div style={sectionStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                            <FaMoneyBillWave color="#10b981" size={18} />
                            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Payment & Notes</h3>
                            <span style={{ marginLeft: "auto", padding: "4px 10px", background: status.bg, color: status.color, borderRadius: "12px", fontSize: "0.7rem", fontWeight: 700 }}>{status.label}</span>
                        </div>
                        
                        {grandTotal > 0 && (
                            <div style={{ marginBottom: "15px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.75rem", color: "#64748b" }}><span>Payment Progress</span><span>{Math.min(paymentProgress, 100).toFixed(0)}%</span></div>
                                <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.min(paymentProgress, 100)}%`, background: paymentProgress >= 100 ? '#10b981' : '#3b82f6', borderRadius: "4px", transition: "width 0.3s" }}></div>
                                </div>
                            </div>
                        )}
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "8px", textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: "#64748b" }}>Total</div><div style={{ fontSize: "1rem", fontWeight: 700 }}>₹{grandTotal.toLocaleString('en-IN')}</div></div>
                            <div style={{ padding: "10px", background: "#dcfce7", borderRadius: "8px", textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: "#166534" }}>Paid</div><div style={{ fontSize: "1rem", fontWeight: 700, color: "#16a34a" }}>₹{totalPaid.toLocaleString('en-IN')}</div></div>
                            <div style={{ padding: "10px", background: balanceDue > 0 ? "#fee2e2" : "#dcfce7", borderRadius: "8px", textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: balanceDue > 0 ? "#991b1b" : "#166534" }}>Balance</div><div style={{ fontSize: "1rem", fontWeight: 700, color: balanceDue > 0 ? "#dc2626" : "#16a34a" }}>₹{Math.max(balanceDue, 0).toLocaleString('en-IN')}</div></div>
                        </div>
                        
                        <div style={{ marginBottom: "15px" }}>
                            <label style={inputLabelStyle}>Amount Paid Already (₹)</label>
                            <input type="number" value={amountPaidAlready || ""} onChange={e => setAmountPaidAlready(Number(e.target.value))} style={{ ...inputStyle, background: "#f8fafc" }} placeholder="0" />
                        </div>

                        {grandTotal > 0 && balanceDue > 0 && (
                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ ...inputLabelStyle, marginBottom: "8px" }}>Quick Select:</label>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {[100, 75, 50, 25].map(percent => {
                                        const amount = Math.round(((grandTotal - amountPaidAlready) * percent) / 100);
                                        const isSelected = paymentNow === amount;
                                        return (<button key={percent} type="button" onClick={() => handleQuickPayment(percent)} style={{ padding: "6px 12px", background: isSelected ? "#10b981" : "#f8fafc", color: isSelected ? "white" : "#374151", border: `1px solid ${isSelected ? "#10b981" : "#e2e8f0"}`, borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}>{percent === 100 ? 'Full' : `${percent}%`} (₹{amount.toLocaleString('en-IN')})</button>);
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Multiple Payments Section */}
                        <div style={{ padding: "15px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", marginBottom: "15px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                                <label style={{ ...inputLabelStyle, margin: 0, color: "#166534" }}>
                                    <FaCheckCircle style={{ marginRight: "6px" }} />Payment Methods ({payments.length})
                                </label>
                                <button 
                                    type="button"
                                    onClick={addPayment}
                                    style={{ padding: "4px 10px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                                >
                                    <FaPlus size={10} /> Add Payment
                                </button>
                            </div>

                            {payments.map((payment, index) => {
                                const method = PAYMENT_METHODS.find(m => m.value === payment.payment_method);
                                return (
                                    <div key={index} style={{ background: "white", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#166534" }}>Payment #{index + 1}</span>
                                            {payments.length > 1 && (
                                                <button 
                                                    type="button"
                                                    onClick={() => removePayment(index)}
                                                    style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px" }}
                                                    title="Remove payment"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ marginBottom: "10px" }}>
                                            <label style={{ ...inputLabelStyle, fontSize: "10px" }}>Payment Method</label>
                                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                {PAYMENT_METHODS.map(m => {
                                                    const isSelected = payment.payment_method === m.value;
                                                    return (
                                                        <button 
                                                            key={m.value} 
                                                            type="button" 
                                                            onClick={() => updatePayment(index, 'payment_method', m.value)}
                                                            style={{ padding: "6px 10px", background: isSelected ? m.color : "white", color: isSelected ? "white" : "#374151", border: `1px solid ${isSelected ? m.color : "#e2e8f0"}`, borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: 500 }}
                                                        >
                                                            {m.icon}{m.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                                            <div>
                                                <label style={{ ...inputLabelStyle, fontSize: "10px" }}>Amount (₹)</label>
                                                <input 
                                                    type="number" 
                                                    value={payment.amount || ""} 
                                                    onChange={e => updatePayment(index, 'amount', Number(e.target.value))}
                                                    placeholder="0"
                                                    style={{ ...inputStyle, fontSize: "0.85rem", padding: "6px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ ...inputLabelStyle, fontSize: "10px" }}>Payment Date</label>
                                                <input 
                                                    type="date" 
                                                    value={payment.payment_date} 
                                                    onChange={e => updatePayment(index, 'payment_date', e.target.value)}
                                                    style={{ ...inputStyle, fontSize: "0.85rem", padding: "6px" }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ ...inputLabelStyle, fontSize: "10px" }}>Reference No.</label>
                                            <input 
                                                type="text" 
                                                value={payment.reference_no} 
                                                onChange={e => updatePayment(index, 'reference_no', e.target.value)}
                                                placeholder="Transaction ID / Reference"
                                                style={{ ...inputStyle, fontSize: "0.85rem", padding: "6px" }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {paymentNow > 0 && (
                                <div style={{ padding: "10px", background: "#fef3c7", borderRadius: "6px", border: "1px solid #fcd34d", fontSize: "0.75rem", color: "#92400e" }}>
                                    <strong>💰 Total Payment Now:</strong> ₹{paymentNow.toLocaleString('en-IN')}
                                    {payments.filter(p => p.amount > 0).length > 1 && (
                                        <div style={{ marginTop: "4px", fontSize: "0.7rem" }}>
                                            Split across {payments.filter(p => p.amount > 0).length} methods: {
                                                payments.filter(p => p.amount > 0).map((p, i) => {
                                                    const method = PAYMENT_METHODS.find(m => m.value === p.payment_method);
                                                    return `${method?.label} ₹${p.amount.toLocaleString('en-IN')}`;
                                                }).join(', ')
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: "15px" }}><label style={inputLabelStyle}>Notes / Terms</label><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, resize: "none" }} placeholder="E.g. Thanks for your business!" /></div>
                        <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px dashed #cbd5e1" }}><label style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Amount in Words</label><div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>{grandTotal ? convertNumberToWords(grandTotal) + " RUPEES ONLY" : "-"}</div></div>
                    </div>

                    {/* Additional Details Section */}
                    <div style={sectionStyle}>
                        <h3 style={sectionTitleStyle}>Additional Details</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                            <div><label style={inputLabelStyle}>Reverse Charge</label><select value={meta.reverseCharge} onChange={e => setMeta({ ...meta, reverseCharge: e.target.value })} style={inputStyle}><option>No</option><option>Yes</option></select></div>
                            <div><label style={inputLabelStyle}>Transport Mode</label><input value={meta.transportMode} onChange={e => setMeta({ ...meta, transportMode: e.target.value })} style={inputStyle} /></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                            <div><label style={inputLabelStyle}>Vehicle No.</label><input value={meta.vehicleNumber} onChange={e => setMeta({ ...meta, vehicleNumber: e.target.value })} style={inputStyle} /></div>
                            <div><label style={inputLabelStyle}>Date of Supply</label><input type="date" value={meta.dateOfSupply} onChange={e => setMeta({ ...meta, dateOfSupply: e.target.value })} style={inputStyle} /></div>
                        </div>
                        <div><label style={inputLabelStyle}>No. of Bundles</label><input type="number" value={meta.bundles} onChange={e => setMeta({ ...meta, bundles: Number(e.target.value) })} style={inputStyle} /></div>
                    </div>
                </div>

                {/* Footer with Save Button */}
                <div style={{ padding: "15px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: "0.7rem", color: "#64748b" }}>Grand Total</div><div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>₹{grandTotal.toLocaleString('en-IN')}</div></div>
                    <button onClick={saveInvoice} style={{ background: "#2563eb", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: 700, cursor: "pointer", display: "flex", gap: "8px", alignItems: "center" }}><FaSave /> Save Invoice</button>
                </div>
            </div>

            {/* Print Preview Section */}
            <div style={{ flex: 1, background: "#4b5563", overflowY: "auto", display: "flex", justifyContent: "center", padding: "25px" }}>
                <div ref={printRef} style={{ width: "210mm", minHeight: "297mm", background: "#fff", boxShadow: "0 0 12px rgba(0,0,0,0.4)", padding: "15px", boxSizing: "border-box" }}>
                    <div style={{ border: "1px solid #000", width: "100%" }}>
                        {/* Header */}
                        <div style={{ borderBottom: "1px solid #000", textAlign: "center", padding: "10px", position: "relative" }}>
                            <div style={{ margin: "0 160px" }}>
                                <div style={{ fontSize: "28px", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px" }}>{company.name || "COMPANY NAME"}</div>
                                <div style={{ fontSize: "12px", marginBottom: "4px" }}>{company.address}{company.city_pincode ? `, ${company.city_pincode}` : ''}</div>
                                <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>{company.state?.toUpperCase()}</div>
                                <div style={{ fontSize: "13px", fontWeight: "bold" }}>GSTIN No. : {company.gstin}</div>
                            </div>
                            <div style={{ position: "absolute", right: "0px", top: "0px", width: "150px", borderLeft: "1px solid #000", borderBottom: "1px solid #000", fontSize: "9px", textAlign: "left" }}>
                                <div style={{ padding: "2px 4px", borderBottom: "1px solid #ccc", color: "red" }}>Original for Recipient</div>
                                <div style={{ padding: "2px 4px", borderBottom: "1px solid #ccc", color: "blue" }}>Duplicate for Supplier</div>
                                <div style={{ padding: "2px 4px", color: "green" }}>Triplicate for Supplier</div>
                            </div>
                        </div>
                        
                        {/* Invoice Title */}
                        <div style={{ borderBottom: "1px solid #000", fontWeight: "bold", textAlign: "center", padding: "4px 0", fontSize: "14px" }}>INVOICE</div>
                        
                        {/* Invoice Details */}
                        <div style={{ display: "flex", borderBottom: "1px solid #000", fontSize: "11px" }}>
                            <div style={{ width: "50%", padding: "6px", borderRight: "1px solid #000" }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Reverse Charge</span><span>: {meta.reverseCharge}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice No</span><span>: <b>{invoiceNo}</b></span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice Date</span><span>: <b>{new Date(meta.invoiceDate).toLocaleDateString("en-GB")}</b></span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>State</span><span>: {company.state} Code: {company.stateCode}</span></div>
                            </div>
                            <div style={{ width: "50%", padding: "6px" }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Transport Mode</span><span>: {meta.transportMode}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Vehicle Number</span><span>: {meta.vehicleNumber}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date of Supply</span><span>: {new Date(meta.dateOfSupply).toLocaleDateString("en-GB")}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Place of Supply</span><span>: {meta.placeOfSupply} Code: {meta.supplyStateCode}</span></div>
                            </div>
                        </div>
                        
                        {/* Customer Details */}
                        <div style={{ display: "flex", borderBottom: "1px solid #000", fontSize: "11px" }}>
                            <div style={{ width: "50%", padding: "6px", borderRight: "1px solid #000" }}>
                                <b style={{ textDecoration: "underline" }}>Details of Receiver Billed To :</b><br />
                                <div style={{ marginTop: '4px' }}>Name : <b>{customer.name}</b></div>
                                <div>Address : {customer.address}</div>
                                <div>GSTIN : <b>{customer.gstin}</b></div>
                                <div>State : {customer.state} Code : {customer.stateCode}</div>
                            </div>
                            <div style={{ width: "50%", padding: "6px" }}>
                                <b style={{ textDecoration: "underline" }}>Details of Consignee :</b><br />
                                <div style={{ marginTop: '4px' }}>Name : <b>{company.name}</b></div>
                                <div>Address : {company.address}{company.city_pincode ? `, ${company.city_pincode}` : ''}</div>
                                <div>GSTIN : <b>{company.gstin}</b></div>
                                <div>State : {company.state} Code : {company.stateCode}</div>
                            </div>
                        </div>
                        
                        {/* Items Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                            <thead><tr>
                                <th style={tableHeaderStyle}>Sr.No</th>
                                <th style={tableHeaderStyle}>Name of Product</th>
                                <th style={tableHeaderStyle}>HSN</th>
                                <th style={tableHeaderStyle}>Uom</th>
                                <th style={tableHeaderStyle}>Qty</th>
                                <th style={tableHeaderStyle}>Rate</th>
                                <th style={tableHeaderStyle}>Amount</th>
                                <th style={tableHeaderStyle}>Discount</th>
                                <th style={tableHeaderStyle}>Taxable</th>
                                <th style={tableHeaderStyle}>CGST</th>
                                <th style={tableHeaderStyle}>SGST</th>
                                <th style={tableHeaderStyle}>IGST</th>
                                <th style={tableHeaderStyle}>Total</th>
                            </tr></thead>
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
                                            <td style={tableCellStyle}>{r.rate ? r.rate.toFixed(2) : ""}</td>
                                            <td style={tableCellStyle}>{r.amount ? r.amount.toFixed(2) : ""}</td>
                                            <td style={tableCellStyle}></td>
                                            <td style={tableCellStyle}>{r.taxable ? r.taxable.toFixed(2) : ""}</td>
                                            <td style={tableCellStyle}>{r.cgst > 0 ? r.cgst.toFixed(2) : ""}</td>
                                            <td style={tableCellStyle}>{r.sgst > 0 ? r.sgst.toFixed(2) : ""}</td>
                                            <td style={tableCellStyle}>{r.igst > 0 ? r.igst.toFixed(2) : ""}</td>
                                            <td style={tableCellStyle}>{r.lineTotal ? r.lineTotal.toFixed(2) : ""}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: "bold", background: "#f1f5f9" }}>
                                    <td colSpan={6} style={tableCellRightStyle}>Total</td>
                                    <td style={tableCellStyle}>{totalTaxable.toFixed(2)}</td>
                                    <td style={tableCellStyle}></td>
                                    <td style={tableCellStyle}>{totalTaxable.toFixed(2)}</td>
                                    <td style={tableCellStyle}>{totalCGST.toFixed(2)}</td>
                                    <td style={tableCellStyle}>{totalSGST.toFixed(2)}</td>
                                    <td style={tableCellStyle}>{totalIGST.toFixed(2)}</td>
                                    <td style={tableCellStyle}>{grandTotal.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        {/* Footer Section */}
                        <div style={{ borderTop: "1px solid #000", display: "flex", fontSize: "11px" }}>
                            <div style={{ width: "60%", borderRight: "1px solid #000", padding: "6px" }}>
                                <b>Total Invoice Amount in words</b><br />
                                {grandTotal ? convertNumberToWords(grandTotal) + " RUPEES ONLY" : ""}<br /><br />
                                Bundles : {meta.bundles}<br /><br />
                                <b style={{ textDecoration: "underline" }}>: Bank Details :</b><br />
                                * BANK NAME : {company.bank_name}<br />
                                * A/C NO : {company.ac_no}<br />
                                * IFSC NO : {company.ifsc}<br /><br />
                                <b>(Common Seal)</b>
                            </div>
                            <div style={{ width: "40%", padding: "0" }}>
                                <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                                    <tbody>
                                        <tr><td style={{ borderBottom: '1px solid #000', padding: '4px' }}>Total Before Tax</td><td style={{ borderBottom: '1px solid #000', padding: '4px', textAlign: 'right' }}><b>{totalTaxable.toFixed(2)}</b></td></tr>
                                        <tr><td style={{ borderBottom: '1px solid #000', padding: '4px' }}>Add: CGST</td><td style={{ borderBottom: '1px solid #000', padding: '4px', textAlign: 'right' }}>{totalCGST.toFixed(2)}</td></tr>
                                        <tr><td style={{ borderBottom: '1px solid #000', padding: '4px' }}>Add: SGST</td><td style={{ borderBottom: '1px solid #000', padding: '4px', textAlign: 'right' }}>{totalSGST.toFixed(2)}</td></tr>
                                        <tr><td style={{ borderBottom: '1px solid #000', padding: '4px' }}>Add: IGST</td><td style={{ borderBottom: '1px solid #000', padding: '4px', textAlign: 'right' }}>{totalIGST.toFixed(2)}</td></tr>
                                        <tr><td style={{ borderBottom: '1px solid #000', padding: '4px' }}>Tax Amount: GST</td><td style={{ borderBottom: '1px solid #000', padding: '4px', textAlign: 'right' }}><b>{totalGST.toFixed(2)}</b></td></tr>
                                        <tr style={{ background: '#eee' }}><td style={{ borderBottom: '1px solid #000', padding: '6px' }}><b>Total After Tax</b></td><td style={{ borderBottom: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>{grandTotal.toFixed(2)}</b></td></tr>
                                    </tbody>
                                </table>
                                <div style={{ padding: '6px', fontSize: '10px' }}>GST on Reverse Charge : {meta.reverseCharge}</div>
                                <div style={{ padding: '6px', fontSize: '9px', fontStyle: 'italic' }}>Certified that particulars are true & correct.</div>
                                <div style={{ textAlign: "center", fontWeight: "bold", marginTop: "10px", position: "relative", height: "80px" }}>
                                    For, {company.name}
                                    {(company.signature_url || user?.signature_url) && (
                                        <img src={company.signature_url || user?.signature_url} alt="Signature" style={{ width: "120px", position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "20px", opacity: 0.9 }} />
                                    )}
                                    <div style={{ position: 'absolute', bottom: '0', width: '100%' }}>Authorised Signatory</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: "9px", textAlign: "right", padding: "4px", borderTop: "1px solid #000" }}>[E & OE]</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateInvoice;