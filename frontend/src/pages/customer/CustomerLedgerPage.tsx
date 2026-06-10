import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import { FaDownload } from "react-icons/fa";

const CustomerLedgerPage: React.FC = () => {
    const [ledger, setLedger] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    
    useEffect(() => {
        const fetchLedger = async () => {
            try {
                const res = await apiFetch("/portal/my-ledger");
                if (res.ok) {
                    const data = await res.json();
                    
                    // Transform invoices into ledger entries
                    let runningBalance = 0;
                    const entries: any[] = [];
                    
                    data.transactions.forEach((inv: any) => {
                        const total = Number(inv.total_amount);
                        const paid = Number(inv.paid_amount);
                        
                        // Add invoice entry (Debit)
                        if (total > 0) {
                            runningBalance += total;
                            entries.push({
                                date: new Date(inv.invoice_date).toLocaleDateString(),
                                description: `Invoice #${inv.invoice_number}`,
                                debit: total,
                                credit: 0,
                                balance: runningBalance
                            });
                        }
                        
                        // Add payment entry (Credit)
                        if (paid > 0) {
                            runningBalance -= paid;
                            entries.push({
                                date: new Date(inv.invoice_date).toLocaleDateString(), // Assuming payment on same day for simplicity, real app would have payment dates
                                description: `Payment Recd against #${inv.invoice_number}`,
                                debit: 0,
                                credit: paid,
                                balance: runningBalance
                            });
                        }
                    });
                    
                    setLedger(entries);
                    setSummary(data.summary);
                    
                    await apiFetch("/portal/activity", {
                        method: "POST",
                        body: JSON.stringify({ activity: "viewed their account statement" })
                    });
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchLedger();
    }, []);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#1e293b" }}>Account Statement</h1>
                    <p style={{ color: "#64748b", margin: "5px 0 0" }}>View your complete ledger and transaction history.</p>
                </div>
                <button style={{ background: "#4f46e5", color: "white", padding: "12px 20px", borderRadius: "10px", border: "none", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaDownload /> Download PDF
                </button>
            </div>

            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <tr>
                            <th style={{ padding: "15px 20px", textAlign: "left", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>DATE</th>
                            <th style={{ padding: "15px 20px", textAlign: "left", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>DESCRIPTION</th>
                            <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>DEBIT (₹)</th>
                            <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>CREDIT (₹)</th>
                            <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>BALANCE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledger.map((entry, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "15px 20px", color: "#64748b" }}>{entry.date}</td>
                                <td style={{ padding: "15px 20px", fontWeight: 600, color: "#1e293b" }}>{entry.description}</td>
                                <td style={{ padding: "15px 20px", textAlign: "right", color: entry.debit > 0 ? "#1e293b" : "transparent" }}>
                                    {entry.debit > 0 ? entry.debit.toLocaleString() : ""}
                                </td>
                                <td style={{ padding: "15px 20px", textAlign: "right", color: entry.credit > 0 ? "#16a34a" : "transparent", fontWeight: 700 }}>
                                    {entry.credit > 0 ? entry.credit.toLocaleString() : ""}
                                </td>
                                <td style={{ padding: "15px 20px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                                    ₹{entry.balance.toLocaleString()} Dr
                                </td>
                            </tr>
                        ))}
                        <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                            <td colSpan={4} style={{ padding: "20px", textAlign: "right", fontWeight: 800, fontSize: "1.1rem", color: "#1e293b" }}>
                                TOTAL BALANCE DUE:
                            </td>
                            <td style={{ padding: "20px", textAlign: "right", fontWeight: 900, fontSize: "1.2rem", color: summary?.balance_pending > 0 ? "#dc2626" : "#16a34a" }}>
                                ₹{summary?.balance_pending ? summary.balance_pending.toLocaleString() : 0}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CustomerLedgerPage;
