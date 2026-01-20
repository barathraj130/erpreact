import React, { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaEdit, FaPrint, FaTrash } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";

const InvoiceDetails: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch invoice data
        apiFetch(`/invoice/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Invoice not found");
                return res.json();
            })
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Could not load invoice. It might have been deleted.");
                setLoading(false);
            });
    }, [id]);

    const handleDelete = async () => {
        if(!window.confirm("Delete this invoice permanently?")) return;
        try {
            await apiFetch(`/invoice/${id}`, { method: 'DELETE' });
            navigate('/invoices');
        } catch(e) { alert("Delete failed"); }
    };

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;
        
        const w = window.open('', '', 'width=900,height=650');
        w?.document.write(`
            <html><head><title>Invoice #${data?.invoice_number || 'Print'}</title>
            <style>
                body { margin: 0; padding: 20px; font-family: 'Helvetica', Arial, sans-serif; font-size: 12px; }
                .container { width: 100%; border: 1px solid #000; }
                .header { text-align: center; border-bottom: 1px solid #000; padding: 10px; }
                table { width: 100%; border-collapse: collapse; }
                th { border-bottom: 1px solid #000; border-right: 1px solid #000; background: #f3f4f6; padding: 6px; font-size: 11px; }
                td { border-right: 1px solid #000; padding: 6px; font-size: 11px; }
                th:last-child, td:last-child { border-right: none; }
                .text-right { text-align: right; }
                @media print { .no-print { display: none; } }
            </style>
            </head><body><div class="container">${content}</div></body></html>
        `);
        w?.document.close();
        w?.print();
    };

    // 1. Loading State
    if (loading) return <div className="p-8 text-center" style={{padding: '40px'}}>Loading Invoice...</div>;

    // 2. Error State (Prevents White Page)
    if (error || !data) return (
        <div style={{padding: '40px', textAlign: 'center'}}>
            <h3 style={{color: 'red'}}>Error</h3>
            <p>{error}</p>
            <button onClick={() => navigate('/invoices')} style={{marginTop: '20px', cursor: 'pointer'}}>Go Back</button>
        </div>
    );

    // --- SAFETY HELPERS ---
    const val = (n: any) => Number(n) || 0;
    const fmt = (n: any) => val(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Safe Property Access
    const companyName = data.company_name || 'My Company';
    const invoiceType = data.invoice_type ? data.invoice_type.replace(/_/g, ' ') : 'TAX INVOICE';
    const invoiceDate = data.invoice_date ? new Date(data.invoice_date).toLocaleDateString() : '-';
    // Ensure items is an array (fixes map crash)
    const items = Array.isArray(data.items) ? data.items : [];

    return (
        <div style={{ background: "#e5e7eb", minHeight: "100vh", padding: "20px", display: "flex", justifyContent: "center" }}>
            
            {/* Toolbar */}
            <div style={{ position: "fixed", top: 20, left: 20, display: "flex", gap: "10px", zIndex: 50 }} className="no-print">
                <button onClick={() => navigate('/invoices')} style={btnStyle} title="Back">
                    <FaArrowLeft />
                </button>
                <button onClick={() => navigate(`/invoices/edit/${id}`)} style={{...btnStyle, color: "#2563eb"}} title="Edit Invoice">
                    <FaEdit /> Edit
                </button>
                <button onClick={handleDelete} style={{...btnStyle, color: "#ef4444"}} title="Delete Invoice">
                    <FaTrash /> Delete
                </button>
                <button onClick={handlePrint} style={{...btnStyle, background: "#2563eb", color: "white", padding: "10px 20px", width: "auto"}} title="Print">
                    <FaPrint style={{marginRight: '8px'}}/> Print
                </button>
            </div>

            {/* INVOICE PAPER */}
            <div ref={printRef} style={{ width: "210mm", minHeight: "297mm", background: "white", padding: "0", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", boxSizing: "border-box", border: "1px solid #ddd" }}>
                
                {/* Header */}
                <div style={{ textAlign: "center", padding: "15px", borderBottom: "1px solid #000" }}>
                    <h1 style={{ margin: "0 0 5px 0", fontSize: "24px", textTransform: "uppercase" }}>{companyName}</h1>
                    <p style={{ margin: 0, fontSize: "12px", color: "#444" }}>
                        {data.c_address || ''}, {data.c_city || ''} {data.c_state ? `- ${data.c_state}` : ''}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", fontWeight: "bold" }}>GSTIN: {data.c_gstin || 'N/A'}</p>
                </div>

                <div style={{ background: "#eee", textAlign: "center", padding: "4px", borderBottom: "1px solid #000", fontWeight: "bold", fontSize: "12px", letterSpacing: "1px" }}>
                    {invoiceType}
                </div>

                {/* Details */}
                <div style={{ display: "flex", borderBottom: "1px solid #000", fontSize: "11px" }}>
                    <div style={{ flex: 1, padding: "10px", borderRight: "1px solid #000" }}>
                        <div>Invoice No: <b>{data.invoice_number}</b></div>
                        <div>Date: <b>{invoiceDate}</b></div>
                        <div>State: {data.c_state || '-'} ({data.state_code || '33'})</div>
                    </div>
                    <div style={{ flex: 1, padding: "10px" }}>
                        <div>Transport: {data.transport_mode || 'By Road'}</div>
                        <div>Vehicle No: {data.vehicle_number || '-'}</div>
                        <div>Place of Supply: {data.place_of_supply || data.state || '-'}</div>
                    </div>
                </div>

                {/* Parties */}
                <div style={{ display: "flex", borderBottom: "1px solid #000", fontSize: "11px" }}>
                    <div style={{ flex: 1, padding: "10px", borderRight: "1px solid #000" }}>
                        <strong style={{ textDecoration: "underline" }}>BILLED TO:</strong><br/>
                        <div style={{ fontSize: "14px", fontWeight: "bold", marginTop: "4px" }}>{data.customer_name || 'Walk-in Customer'}</div>
                        <div>{data.address_line1}</div>
                        <div>{data.city_pincode} {data.state}</div>
                        <div style={{ marginTop: "4px" }}>GSTIN: <b>{data.customer_gstin || 'Unregistered'}</b></div>
                    </div>
                    <div style={{ flex: 1, padding: "10px" }}>
                        <strong style={{ textDecoration: "underline" }}>SHIPPED TO:</strong><br/>
                        <div style={{ fontSize: "14px", fontWeight: "bold", marginTop: "4px" }}>{data.customer_name || 'Same as Billed'}</div>
                    </div>
                </div>

                {/* Items Table */}
                <div style={{ minHeight: "350px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                        <thead>
                            <tr style={{ background: "#f9fafb" }}>
                                <th style={{width: "40px"}}>S.No</th>
                                <th style={{textAlign: "left"}}>Description of Goods</th>
                                <th style={{width: "70px"}}>HSN/SAC</th>
                                <th style={{width: "50px"}}>Qty</th>
                                <th style={{width: "80px", textAlign: "right"}}>Rate</th>
                                <th style={{width: "50px", textAlign: "right"}}>GST</th>
                                <th style={{width: "90px", textAlign: "right"}}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any, i: number) => (
                                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                                    <td style={{textAlign: "center", padding: "8px"}}>{i+1}</td>
                                    <td style={{padding: "8px"}}><b>{item.description}</b></td>
                                    <td style={{textAlign: "center", padding: "8px"}}>{item.hsn_acs_code || '-'}</td>
                                    <td style={{textAlign: "center", padding: "8px"}}>{val(item.quantity)}</td>
                                    <td style={{textAlign: "right", padding: "8px"}}>{fmt(item.unit_price)}</td>
                                    <td style={{textAlign: "right", padding: "8px"}}>{val(item.gst_rate)}%</td>
                                    <td style={{textAlign: "right", padding: "8px", fontWeight: "bold"}}>{fmt(item.line_total)}</td>
                                </tr>
                            ))}
                            {/* Filler Row */}
                            <tr><td colSpan={7} style={{height: "100%"}}></td></tr>
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{ borderTop: "1px solid #000", display: "flex", fontSize: "11px" }}>
                    <div style={{ flex: 1.5, borderRight: "1px solid #000", padding: "10px" }}>
                        <div style={{ marginBottom: "15px" }}>
                            <b>Bank Details:</b><br/>
                            Bank: {data.bank_name || '-'}<br/>
                            A/c: {data.bank_account_no || '-'}<br/>
                            IFSC: {data.bank_ifsc_code || '-'}
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid #eee" }}>
                            <span>Taxable Amount:</span>
                            <span>{fmt(val(data.total_amount) - (val(data.total_cgst_amount||0) + val(data.total_sgst_amount||0) + val(data.total_igst_amount||0)))}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid #eee" }}>
                            <span>Total Tax:</span>
                            <span>{fmt(val(data.total_cgst_amount||0) + val(data.total_sgst_amount||0) + val(data.total_igst_amount||0))}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#eee", fontWeight: "bold", fontSize: "14px" }}>
                            <span>Grand Total:</span>
                            <span>₹{fmt(data.total_amount)}</span>
                        </div>
                        
                        <div style={{ height: "100px", padding: "10px", textAlign: "center", borderTop: "1px solid #000", position: "relative" }}>
                            {data.signature_url && <img src={`http://localhost:3000${data.signature_url}`} style={{ height: "50px", opacity: 0.8 }} alt="Sig" />}
                            <div style={{ position: "absolute", bottom: "10px", width: "100%", fontSize: "10px" }}>Authorised Signatory</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const btnStyle: any = {
    background: "white", padding: "10px 15px", borderRadius: "8px", 
    border: "none", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", 
    cursor: "pointer", display: "flex", alignItems: "center", 
    gap: "6px", fontSize: "13px", fontWeight: "600", width: "auto"
};

export default InvoiceDetails;