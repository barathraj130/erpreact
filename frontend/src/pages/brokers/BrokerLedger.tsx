
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as brokerApi from "../../api/brokerApi";
import { FaArrowLeft, FaFileInvoice, FaDownload, FaPrint } from "react-icons/fa";

const BrokerLedger: React.FC = () => {
  const { id } = useParams();
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) loadLedger();
  }, [id]);

  const loadLedger = async () => {
    try {
      const data = await brokerApi.fetchBrokerLedger(Number(id));
      setLedger(data);
    } catch (err) {
      console.error("Load Ledger Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);

  const totalEarned = ledger.reduce((sum, item) => sum + (Number(item.earned) || 0), 0);
  const totalPaid = ledger.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
  const balance = totalEarned - totalPaid;

  return (
    <div className="page-container" style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <header style={{ marginBottom: "40px" }}>
        <button 
          onClick={() => navigate("/finance/brokers")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#64748b", fontWeight: 600, cursor: "pointer", marginBottom: "16px" }}
        >
          <FaArrowLeft size={12} /> Back to Brokers
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Broker Statement</h1>
            <p style={{ color: "#64748b", marginTop: "8px" }}>Detailed commission ledger and payment history.</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <FaPrint size={14} /> Print
            </button>
            <button style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <FaDownload size={14} /> Export PDF
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "32px" }}>
        <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Cumulative Earnings</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>{fmt(totalEarned)}</div>
        </div>
        <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Total Payouts</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>{fmt(totalPaid)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", padding: "24px", borderRadius: "20px", color: "#fff" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginBottom: "8px" }}>Net Payable</div>
          <div style={{ fontSize: "24px", fontWeight: 800 }}>{fmt(balance)}</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: 700 }}>Date</th>
              <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: 700 }}>Description</th>
              <th style={{ textAlign: "right", padding: "16px 24px", color: "#64748b", fontWeight: 700 }}>Bill Amount</th>
              <th style={{ textAlign: "center", padding: "16px 24px", color: "#64748b", fontWeight: 700 }}>Rate</th>
              <th style={{ textAlign: "right", padding: "16px 24px", color: "#64748b", fontWeight: 700 }}>Earned</th>
              <th style={{ textAlign: "right", padding: "16px 24px", color: "#64748b", fontWeight: 700 }}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading ledger...</td></tr>
            ) : ledger.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No transactions found.</td></tr>
            ) : (
              ledger.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "16px 24px", color: "#1e293b", fontWeight: 500 }}>{new Date(item.date).toLocaleDateString()}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: 600 }}>
                      <FaFileInvoice style={{ opacity: 0.3 }} />
                      {item.description}
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", color: "#64748b" }}>{item.bill_amount ? fmt(item.bill_amount) : "-"}</td>
                  <td style={{ padding: "16px 24px", textAlign: "center" }}>
                    {item.rate ? (
                      <span style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{item.rate}%</span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", color: "#10b981", fontWeight: 700 }}>{item.earned > 0 ? `+ ${fmt(item.earned)}` : "-"}</td>
                  <td style={{ padding: "16px 24px", textAlign: "right", color: "#e11d48", fontWeight: 700 }}>{item.paid > 0 ? `- ${fmt(item.paid)}` : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BrokerLedger;
