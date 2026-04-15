import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaFileInvoiceDollar, FaCheckCircle, FaClock, FaDownload, FaExclamationTriangle } from "react-icons/fa";
import { apiFetch } from "../../utils/api";

interface Transaction {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  file_url?: string;
}

interface Summary {
  total_billed: number;
  total_paid: number;
  balance_pending: number;
}

const CustomerLedger: React.FC = () => {
  const [data, setData] = useState<{ summary: Summary, transactions: Transaction[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    try {
      const res = await apiFetch("/portal/my-ledger");
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch ledger", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: "100px", textAlign: "center" }}>
      <div className="fa-spin" style={{ fontSize: "2rem", color: "#2563eb" }}><FaClock /></div>
      <p style={{ marginTop: "20px", fontWeight: 600, color: "#64748b" }}>Retrieving your financial records...</p>
    </div>
  );

  if (!data) return null;

  return (
    <div>
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>My Financial Statement</h1>
        <p style={{ color: "#64748b", marginTop: "4px" }}>View your order history and outstanding balance.</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px", marginBottom: "40px" }}>
        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
           <div style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: 600 }}>Total Billed</div>
           <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1e293b", marginTop: "8px" }}>₹{data.summary.total_billed.toLocaleString()}</div>
        </div>
        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
           <div style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: 600 }}>Total Paid</div>
           <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#059669", marginTop: "8px" }}>₹{data.summary.total_paid.toLocaleString()}</div>
        </div>
        <div style={{ 
          background: data.summary.balance_pending > 0 ? "#fff1f2" : "#f0fdf4", 
          padding: "24px", borderRadius: "20px", border: "1px solid", 
          borderColor: data.summary.balance_pending > 0 ? "#fecdd3" : "#bbf7d0",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" 
        }}>
           <div style={{ color: data.summary.balance_pending > 0 ? "#be123c" : "#15803d", fontSize: "0.9rem", fontWeight: 600 }}>Balance Outstanding</div>
           <div style={{ fontSize: "1.8rem", fontWeight: 800, color: data.summary.balance_pending > 0 ? "#9f1239" : "#166534", marginTop: "8px" }}>₹{data.summary.balance_pending.toLocaleString()}</div>
        </div>
      </div>

      {/* Transaction Table */}
      <div style={{ background: "white", borderRadius: "24px", border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
              <th style={{ padding: "20px 24px", fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Invoice Info</th>
              <th style={{ padding: "20px 24px", fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Date</th>
              <th style={{ padding: "20px 24px", fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Amount</th>
              <th style={{ padding: "20px 24px", fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Paid</th>
              <th style={{ padding: "20px 24px", fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "20px 24px", fontSize: "0.85rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
                   <FaFileInvoiceDollar size={48} style={{ opacity: 0.2, marginBottom: "16px" }} />
                   <p>No transactions found in your history.</p>
                </td>
              </tr>
            ) : data.transactions.map((tx, idx) => (
              <motion.tr 
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{ borderBottom: "1px solid #f1f5f9" }}
              >
                <td style={{ padding: "20px 24px" }}>
                   <div style={{ fontWeight: 700, color: "#1e293b" }}>{tx.invoice_number}</div>
                   <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Ref ID: #{tx.id}</div>
                </td>
                <td style={{ padding: "20px 24px", color: "#64748b", fontWeight: 500 }}>
                   {new Date(tx.invoice_date).toLocaleDateString()}
                </td>
                <td style={{ padding: "20px 24px", fontWeight: 700, color: "#1e293b" }}>
                   ₹{Number(tx.total_amount).toLocaleString()}
                </td>
                <td style={{ padding: "20px 24px", fontWeight: 700, color: "#059669" }}>
                   ₹{Number(tx.paid_amount).toLocaleString()}
                </td>
                <td style={{ padding: "20px 24px" }}>
                   <span style={{ 
                     padding: "6px 12px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700,
                     background: tx.status === "Paid" ? "#ecfdf5" : (tx.status === "Partially Paid" ? "#fffbeb" : "#fef2f2"),
                     color: tx.status === "Paid" ? "#059669" : (tx.status === "Partially Paid" ? "#d97706" : "#ef4444")
                   }}>
                     {tx.status}
                   </span>
                </td>
                <td style={{ padding: "20px 24px", textAlign: "right" }}>
                   {tx.file_url ? (
                     <a 
                       href={tx.file_url} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style={{ 
                         display: "inline-flex", alignItems: "center", gap: "8px", 
                         background: "#1e293b", color: "white", padding: "8px 16px", 
                         borderRadius: "8px", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 
                       }}
                     >
                        <FaDownload size={12} /> Invoice PDF
                     </a>
                   ) : (
                     <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>No file available</span>
                   )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Discrepancy Alert */}
      <div style={{ marginTop: "30px", padding: "20px", background: "#f8fafc", borderRadius: "16px", display: "flex", gap: "16px", alignItems: "center", border: "1px dashed #cbd5e1" }}>
         <div style={{ background: "white", width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", border: "1px solid #e2e8f0" }}>
            <FaExclamationTriangle />
         </div>
         <div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>Found a discrepancy?</div>
            <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>If you notice any errors in your billing history, please contact our support team or your account manager for immediate resolution.</p>
         </div>
      </div>
    </div>
  );
};

export default CustomerLedger;
