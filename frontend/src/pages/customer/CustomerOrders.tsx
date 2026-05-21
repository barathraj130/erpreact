import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import { FaFilePdf, FaSearch } from "react-icons/fa";

const CustomerOrders: React.FC = () => {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [filter, setFilter] = useState("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                const res = await apiFetch("/portal/my-ledger");
                if (res.ok) {
                    const data = await res.json();
                    setInvoices(data.transactions || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchInvoices();
    }, []);

    const filteredInvoices = invoices.filter(inv => {
        const isPaid = Number(inv.paid_amount) >= Number(inv.total_amount);
        if (filter === "PAID" && !isPaid) return false;
        if (filter === "PENDING" && isPaid) return false;
        
        return inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalOutstanding = invoices.reduce((sum, inv) => {
        const bal = Number(inv.total_amount) - Number(inv.paid_amount);
        return sum + (bal > 0 ? bal : 0);
    }, 0);

    const handleDownloadPdf = async (id: number, invNumber: string) => {
        try {
            const res = await apiFetch(`/invoice/pdf/${id}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Invoice_${invNumber}.pdf`;
                a.click();
                
                // Log activity
                await apiFetch("/portal/activity", {
                    method: "POST",
                    body: JSON.stringify({ activity: `downloaded Invoice #${invNumber}` })
                });
            } else {
                alert("PDF not available.");
            }
        } catch (err) {
            console.error(err);
            alert("Error downloading PDF");
        }
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#1e293b" }}>My Orders</h1>
                    <p style={{ color: "#64748b", margin: "5px 0 0" }}>View and download your past invoices.</p>
                </div>
                <div style={{ background: "#fef2f2", padding: "15px 25px", borderRadius: "16px", border: "1px solid #fee2e2", textAlign: "right" }}>
                    <div style={{ fontSize: "0.85rem", color: "#ef4444", fontWeight: 700, textTransform: "uppercase" }}>Total Outstanding</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#b91c1c" }}>₹{totalOutstanding.toLocaleString()}</div>
                </div>
            </div>

            <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
                <div style={{ flex: 1, position: "relative" }}>
                    <FaSearch style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input 
                        type="text" 
                        placeholder="Search by Bill No..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: "100%", padding: "14px 14px 14px 45px", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                    />
                </div>
                <div style={{ display: "flex", gap: "10px", background: "#f1f5f9", padding: "5px", borderRadius: "12px" }}>
                    {["ALL", "PAID", "PENDING"].map(f => (
                        <button 
                            key={f} 
                            onClick={() => setFilter(f)}
                            style={{ 
                                padding: "10px 20px", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer",
                                background: filter === f ? "white" : "transparent",
                                color: filter === f ? "#4f46e5" : "#64748b",
                                boxShadow: filter === f ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <tr>
                            <th style={{ padding: "15px 20px", textAlign: "left", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>BILL NO</th>
                            <th style={{ padding: "15px 20px", textAlign: "left", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>DATE</th>
                            <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>AMOUNT</th>
                            <th style={{ padding: "15px 20px", textAlign: "center", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>STATUS</th>
                            <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map((inv, idx) => {
                            const isPaid = Number(inv.paid_amount) >= Number(inv.total_amount);
                            const bal = Number(inv.total_amount) - Number(inv.paid_amount);
                            return (
                                <tr key={inv.id} style={{ borderBottom: idx < filteredInvoices.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                    <td style={{ padding: "20px", fontWeight: 800, color: "#1e293b" }}>{inv.invoice_number}</td>
                                    <td style={{ padding: "20px", color: "#64748b" }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                    <td style={{ padding: "20px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>₹{Number(inv.total_amount).toLocaleString()}</td>
                                    <td style={{ padding: "20px", textAlign: "center" }}>
                                        <span style={{ 
                                            background: isPaid ? "#dcfce7" : "#fee2e2", 
                                            color: isPaid ? "#166534" : "#991b1b",
                                            padding: "6px 12px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 700
                                        }}>
                                            {isPaid ? "✅ Paid" : `🔴 Bal: ₹${bal.toLocaleString()}`}
                                        </span>
                                    </td>
                                    <td style={{ padding: "20px", textAlign: "right" }}>
                                        <button 
                                            onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                                            style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", color: "#475569", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <FaFilePdf color="#ef4444" /> PDF
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredInvoices.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No invoices found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CustomerOrders;
