import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
    FaUserCircle, FaMoneyBillWave, FaHandHoldingUsd, 
    FaHistory, FaSignOutAlt, FaCalendarAlt, FaShieldAlt
} from "react-icons/fa";

const EmployeeDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("erp-employee-token");
    if (!token) {
        navigate("/employee-login");
        return;
    }

    const fetchData = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/employee-portal/dashboard`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(result);
            } else if (response.status === 401) {
                navigate("/employee-login");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("erp-employee-token");
    localStorage.removeItem("erp-employee-data");
    navigate("/employee-login");
  };

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ fontWeight: 600, color: "#64748b" }}>Loading your records...</p>
    </div>
  );

  if (!data) return null;

  const { profile, salarySummary, advanceSummary, paymentHistory } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Satoshi', sans-serif" }}>
      {/* Header */}
      <nav style={{ background: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#2563eb", color: "white", width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>EP</div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>Employee Portal</h2>
        </div>
        <button 
            onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #e2e8f0", background: "white", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: 600, color: "#ef4444" }}
        >
            <FaSignOutAlt /> Sign Out
        </button>
      </nav>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 24px" }}>
        
        {/* Profile Card */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: "white", padding: "32px", borderRadius: "24px", display: "flex", alignItems: "center", gap: "24px", marginBottom: "32px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
        >
            <div style={{ width: "80px", height: "80px", background: "#f8fafc", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                <FaUserCircle size={80} />
            </div>
            <div>
                <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#1e293b" }}>{profile.name}</h1>
                <p style={{ margin: "4px 0 0 0", fontSize: "16px", color: "#64748b", fontWeight: 500 }}>{profile.designation} • {profile.department || "General"}</p>
                <div style={{ marginTop: "12px", display: "flex", gap: "12px" }}>
                    <span style={{ background: "#ecfdf5", color: "#059669", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 700 }}>ACTIVE EMPLOYEE</span>
                    <span style={{ background: "#f1f5f9", color: "#475569", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 700 }}>ID: #{localStorage.getItem("erp-employee-data") ? JSON.parse(localStorage.getItem("erp-employee-data")!).id : "N/A"}</span>
                </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <p style={{ margin: 0, color: "#64748b", fontSize: "14px", fontWeight: 600 }}>Standard Base Salary</p>
                <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#1e293b" }}>₹{Number(profile.base_salary).toLocaleString()}</h2>
            </div>
        </motion.div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginBottom: "32px" }}>
            
            {/* Salary Box */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", padding: "24px", borderRadius: "24px", color: "white" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{ background: "rgba(255,255,255,0.1)", padding: "12px", borderRadius: "14px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FaMoneyBillWave size={24} />
                    </div>
                    <span style={{ background: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>CURRENT MONTH</span>
                </div>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "14px", fontWeight: 500 }}>Take-home Salary</p>
                <h2 style={{ margin: "4px 0", fontSize: "32px", fontWeight: 800 }}>₹{salarySummary.currentMonth ? Number(salarySummary.currentMonth.final_salary).toLocaleString() : "0"}</h2>
                <p style={{ margin: 0, fontSize: "13px", opacity: 0.6 }}>Updated on: {salarySummary.currentMonth ? new Date(salarySummary.currentMonth.created_at).toLocaleDateString() : "No record"}</p>
                
                {salarySummary.currentMonth && (
                    <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "16px" }}>
                        <div>
                            <p style={{ margin: 0, fontSize: "11px", opacity: 0.6 }}>BONUS</p>
                            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>₹{Number(salarySummary.currentMonth.bonus).toLocaleString()}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: "11px", opacity: 0.6 }}>DEDUCTIONS</p>
                            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#fca5a5" }}>₹{Number(salarySummary.currentMonth.deductions).toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Advance Box */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                style={{ background: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "14px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                        <FaHandHoldingUsd size={24} />
                    </div>
                    <span style={{ background: "#f1f5f9", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 600, color: "#475569" }}>ADVANCE REPAYMENT</span>
                </div>
                <p style={{ margin: 0, color: "#64748b", fontSize: "14px", fontWeight: 500 }}>Remaining Balance</p>
                <h2 style={{ margin: "4px 0", fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>₹{Number(advanceSummary.remaining).toLocaleString()}</h2>
                <p style={{ margin: 0, fontSize: "13px", color: Number(advanceSummary.remaining) > 0 ? "#ef4444" : "#059669", fontWeight: 600 }}>
                    {Number(advanceSummary.remaining) > 0 ? `Total Taken: ₹${Number(advanceSummary.totalTaken).toLocaleString()}` : "No outstanding advances"}
                </p>

                <div style={{ marginTop: "20px", height: "8px", background: "#f1f5f9", borderRadius: "100px", overflow: "hidden" }}>
                    <div style={{ 
                        height: "100%", 
                        background: "#2563eb", 
                        width: advanceSummary.totalTaken > 0 ? `${( (advanceSummary.totalTaken - advanceSummary.remaining) / advanceSummary.totalTaken) * 100}%` : "0%" 
                    }}></div>
                </div>
                <p style={{ marginTop: "8px", margin: 0, fontSize: "12px", color: "#64748b", textAlign: "right", fontWeight: 500 }}>
                    Progress: {advanceSummary.totalTaken > 0 ? Math.round(((advanceSummary.totalTaken - advanceSummary.remaining) / advanceSummary.totalTaken) * 100) : 0}% Repaid
                </p>
            </motion.div>

            {/* Attendance Box */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                style={{ background: "#fdf4ff", padding: "24px", borderRadius: "24px", border: "1px solid #f5d0fe" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{ background: "white", padding: "12px", borderRadius: "14px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", color: "#d946ef" }}>
                        <FaCalendarAlt size={24} />
                    </div>
                    <span style={{ background: "#fae8ff", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 700, color: "#d946ef" }}>ATTENDANCE</span>
                </div>
                <p style={{ margin: 0, color: "#a21caf", fontSize: "14px", fontWeight: 500 }}>Usage Ratio (Present days)</p>
                <h2 style={{ margin: "4px 0", fontSize: "32px", fontWeight: 800, color: "#701a75" }}>{data.stats.attendancePercent}%</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#a21caf", fontWeight: 600 }}>
                    {data.stats.presentDays} days present this month
                </p>

                <div style={{ marginTop: "20px", height: "8px", background: "#fae8ff", borderRadius: "100px", overflow: "hidden" }}>
                    <div style={{ 
                        height: "100%", 
                        background: "#d946ef", 
                        width: `${data.stats.attendancePercent}%` 
                    }}></div>
                </div>
                <p style={{ marginTop: "8px", margin: 0, fontSize: "12px", color: "#a21caf", textAlign: "right", fontWeight: 500 }}>
                    Current Month Standing
                </p>
            </motion.div>

        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "24px" }}>
            
            {/* Payment History */}
            <div style={{ background: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <FaHistory color="#64748b" />
                    <h3 style={{ margin: 0, fontWeight: 700 }}>Payment History</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {paymentHistory.length === 0 ? (
                        <p style={{ color: "#94a3b8", fontSize: "14px", textAlign: "center", padding: "40px" }}>No payment records found.</p>
                    ) : paymentHistory.map((pay: any) => (
                        <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#f8fafc", borderRadius: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <div style={{ background: "white", width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", border: "1px solid #e2e8f0" }}>
                                    <FaCalendarAlt />
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>{new Date(pay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    <p style={{ margin: 0, color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Pay Mode: {pay.mode}</p>
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontWeight: 800, color: "#059669", fontSize: "16px" }}>+ ₹{Number(pay.amount).toLocaleString()}</p>
                                {pay.transaction_id && <p style={{ margin: 0, color: "#94a3b8", fontSize: "11px" }}>Ref: {pay.transaction_id}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Corner */}
            <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <FaShieldAlt color="#64748b" />
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: "16px" }}>Security Info</h3>
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>
                    This information is confidential. Only the HR and Finance departments can modify these records. 
                    If you notice any discrepancy, please file a support ticket immediately.
                </p>
                <div style={{ marginTop: "20px", padding: "16px", background: "white", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>LOGGED IN FROM</p>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>Web Dashboard</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>Session expires: {new Date(Date.now() + 24*3600*1000).toLocaleTimeString()}</p>
                </div>
            </div>

        </div>

      </div>
    </div>
  );
};

export default EmployeeDashboard;
