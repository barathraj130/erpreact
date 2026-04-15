import React, { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import "./Finance.css";
import { FaWallet, FaUniversity, FaChartLine, FaHistory, FaShieldAlt } from "react-icons/fa";

const FinanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalExpenses: 0,
    totalPayments: 0,
    totalReturns: 0,
    totalCash: 0,
    totalBank: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/ledger/health-summary`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("erp-token")}`,
            "x-branch-id": localStorage.getItem("active-branch-id") || ""
          }
        });

        if (response.ok) {
          const data = await response.json();
          setMetrics({
            totalSales: data.baseMetrics?.totalSales || 0,
            totalExpenses: data.baseMetrics?.totalExpenses || 0,
            totalPayments: data.baseMetrics?.totalPayments || 0,
            totalReturns: data.baseMetrics?.totalReturns || 0,
            totalCash: data.baseMetrics?.totalCash || 0,
            totalBank: data.baseMetrics?.totalBank || 0,
          });
          setChartData(data.chartData || []);
        }
      } catch (err) {
        console.error("Finance health data error:", err);
      }
    };
    fetchDashboardData();
  }, []);

  const { totalSales, totalExpenses, totalPayments, totalReturns, totalCash, totalBank } = metrics;
  
  const cashFlow = totalPayments - (totalExpenses + totalReturns);
  const profit = totalSales - totalExpenses;
  const outstanding = totalSales - totalPayments;
  
  const collectionEfficiency = totalSales > 0 ? (totalPayments / totalSales) * 100 : 0;
  const expenseRatio = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;
  const liquidity = totalCash + totalBank;

  const profitStatus = profit >= 0 ? { label: "Healthy", color: "#10b981", bg: "#ecfdf5" } : { label: "Attention Needed", color: "#ef4444", bg: "#fef2f2" };
  const cashFlowStatus = cashFlow > 0 ? { label: "Good", color: "#10b981", bg: "#ecfdf5" } : { label: "Tight", color: "#f59e0b", bg: "#fffbeb" };
  const collectionStatus = collectionEfficiency < 60 ? { label: "Warning", color: "#ef4444", bg: "#fef2f2" } : { label: "On Track", color: "#10b981", bg: "#ecfdf5" };
  const expenseRatioStatus = expenseRatio > 60 ? { label: "Risk", color: "#ef4444", bg: "#fef2f2" } : { label: "Optimal", color: "#10b981", bg: "#ecfdf5" };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 25, scale: 0.96 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring" as const, stiffness: 90, damping: 14 }
    },
    hover: {
      y: -6,
      scale: 1.01,
      transition: { type: "spring" as const, stiffness: 300, damping: 20 }
    }
  };



const LiquidityCard = ({ label, value, subtext, icon: Icon, cardBg }: any) => (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        style={{ 
          padding: "14px", 
          background: cardBg || "#ffffff", 
          borderRadius: "16px", 
          position: "relative",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          cursor: "pointer",
          border: "1px solid #f1f5f9"
        }}
      >
       <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
         <div style={{ 
           padding: "12px", 
           borderRadius: "14px", 
           background: "#f8fafc", 
           color: "#64748b", 
           display: "flex", 
           alignItems: "center", 
           justifyContent: "center",
           border: "1px solid #e2e8f0"
         }}>
           <Icon size={18} />
         </div>
         <div style={{ flex: 1 }}>
           <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>{label}</div>
           <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>₹ {value.toLocaleString()}</div>
           <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontWeight: 500 }}>{subtext}</div>
         </div>
       </div>
     </motion.div>
   );

    const GlobalLiquidityCard = ({ value, status, subtext, cardBg }: any) => (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        style={{ 
          padding: "14px", 
          background: cardBg || "#ffffff", 
          borderRadius: "16px", 
          position: "relative",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          cursor: "pointer",
          display: "flex",
          border: "1px solid #f1f5f9",
          flexDirection: "column",
          justifyContent: "space-between"
        }}
      >
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div style={{ 
            padding: "12px", 
            borderRadius: "14px", 
            background: "#f8fafc", 
            color: "#64748b", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            border: "1px solid #e2e8f0"
          }}>
           <FaChartLine size={18} />
         </div>
         <div style={{ textAlign: "right" }}>
           <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>Global Liquidity</div>
           <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>₹ {value.toLocaleString()}</div>
         </div>
       </div>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
         <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>{subtext}</div>
         <span style={{ 
            fontSize: "10px", 
            fontWeight: 700, 
            padding: "4px 10px", 
            borderRadius: "20px", 
            background: status.bg, 
            color: status.color,
          }}>
           {status.label} FLOW
         </span>
       </div>
     </motion.div>
    );

  const chartVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, delay: 0.4 }
    }
  };

  return (
    <div className="finance-container page-container" style={{ padding: isMobile ? "20px" : "40px", fontFamily: "'Satoshi', 'Inter', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", minHeight: "100vh" }}>
      
       <motion.div 
         initial={{ opacity: 0, y: -20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.5 }}
         style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "48px" }}
       >
         <div>
           <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" }}>Financial Health</h1>
           <p style={{ color: "#64748b", margin: "8px 0 0 0", fontSize: "14px", fontWeight: 500 }}>Real-time performance tracking & analytics</p>
         </div>
         {!isMobile && (
           <div style={{ display: "flex", gap: "14px" }}>
             <button style={{ 
               padding: "12px 24px", 
               borderRadius: "100px", 
               background: "#fff", 
               color: "#475569",
               fontSize: "14px",
               fontWeight: 600,
               cursor: "pointer",
               boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
             }}>Export Report</button>
             <button style={{ 
               padding: "12px 24px", 
               borderRadius: "100px", 
               border: "none", 
               background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
               color: "#fff",
               fontSize: "14px",
               fontWeight: 600,
               cursor: "pointer",
               boxShadow: "0 4px 16px #3b82f640"
             }}>Real-time View</button>
           </div>
         )}
       </motion.div>

<div className="stats-grid" style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", marginBottom: "32px" }}>
          <div className="stat-card card-blue">
            <FaChartLine className="stat-icon" />
            <span className="label">Inflow</span>
            <span className="value">₹ {totalSales.toLocaleString()}</span>
            <span className="stat-sub">Total Sales Revenue</span>
          </div>
          <div className="stat-card card-peach">
            <FaHistory className="stat-icon" />
            <span className="label">Outflow</span>
            <span className="value">₹ {totalExpenses.toLocaleString()}</span>
            <span className="stat-sub">Operating Expenses</span>
          </div>
          <div className="stat-card card-emerald">
            <FaShieldAlt className="stat-icon" />
            <span className="label">Net Earnings</span>
            <span className="value">₹ {profit.toLocaleString()}</span>
            <span className="stat-sub">Consolidated Profit</span>
          </div>
          <div className="stat-card card-purple">
            <FaWallet className="stat-icon" />
            <span className="label">Receivables</span>
            <span className="value">₹ {outstanding.toLocaleString()}</span>
            <span className="stat-sub">Pending Outstanding</span>
          </div>
        </div>

<motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}
        >
          <LiquidityCard 
            label="Bank Liquidity"
            value={totalBank}
            subtext="Across all active accounts"
            icon={FaUniversity}
            cardBg="#ffffff"
          />
          <LiquidityCard 
            label="Cash in Hand"
            value={totalCash}
            subtext="Physical branch holdings"
            icon={FaWallet}
            cardBg="#ffffff"
          />
          <GlobalLiquidityCard 
            value={liquidity}
            status={cashFlowStatus}
            subtext="Total working capital available"
            cardBg="#ffffff"
          />
        </motion.div>

<motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ 
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: "16px", 
            marginBottom: "32px",
            display: "grid"
          }}
        >
<motion.div 
          variants={chartVariants}
          style={{ 
            background: "#fff", 
            padding: "24px", 
            borderRadius: "20px", 
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)"
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Monthly Sales vs Expenses</h3>
          </div>
          <div style={{ width: "100%", height: "280px" }}>
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
               <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 12, fill: "#94a3b8" }} dy={10} />
               <YAxis axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 12, fill: "#94a3b8" }} tickFormatter={(val) => `₹${val/1000}k`} />
               <Tooltip 
                 cursor={{ fill: "#f8fafc" }}
                 contentStyle={{ fontFamily: "Satoshi", borderRadius: "14px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontWeight: 600 }}
                 formatter={(value: any) => [`₹ ${Number(value || 0).toLocaleString()}`, ""]}
               />
               <Legend iconType="circle" wrapperStyle={{ fontFamily: "Satoshi", fontSize: "12px", paddingTop: "20px" }} />
               <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={50} />
               <Bar dataKey="expenses" name="Expenses" fill="#1e40af" radius={[6, 6, 0, 0]} maxBarSize={50} />
             </BarChart>
           </ResponsiveContainer>
         </div>
       </motion.div>

<motion.div 
          variants={chartVariants}
          style={{ 
            background: "#fff", 
            padding: "24px", 
            borderRadius: "20px", 
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)"
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Cash Flow Trend</h3>
          </div>
          <div style={{ width: "100%", height: "280px" }}>
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
               <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 12, fill: "#94a3b8" }} dy={10} />
               <YAxis axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 12, fill: "#94a3b8" }} tickFormatter={(val) => `₹${val/1000}k`} />
               <Tooltip 
                 contentStyle={{ fontFamily: "Satoshi", borderRadius: "14px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontWeight: 600 }}
                 formatter={(value: any) => [`₹ ${Number(value || 0).toLocaleString()}`, ""]}
               />
               <Legend iconType="circle" wrapperStyle={{ fontFamily: "Satoshi", fontSize: "12px", paddingTop: "20px" }} />
               <Line type="monotone" dataKey="payments" name="Inflow" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 7 }} />
               <Line type="monotone" dataKey="expenses" name="Outflow" stroke="#1e40af" strokeWidth={3} dot={{ r: 5, fill: "#1e40af", strokeWidth: 0 }} activeDot={{ r: 7 }} />
             </LineChart>
           </ResponsiveContainer>
         </div>
       </motion.div>
      </motion.div>
    </div>
  );
};

export default FinanceDashboard;