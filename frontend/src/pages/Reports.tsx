// frontend/src/pages/Reports.tsx
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaBalanceScale,
  FaCalendarAlt,
  FaChartBar,
  FaDownload,
} from "react-icons/fa";
import { apiFetch } from "../utils/api";

interface PLReport {
  details: any[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

const Reports: React.FC = () => {
  const [report, setReport] = useState<PLReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(
        `/accounting/reports/profit-loss?start_date=${dates.start}&end_date=${dates.end}`
      );
      const data = await response.json();
      if (response.ok) setReport(data);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dates]);

  return (
    <div className="page-container reports-page" style={{ padding: isMobile ? "10px" : "0" }}>
      <header 
        className="page-header reports-header" 
        style={{ 
          background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)", 
          color: "#0F172A",
          padding: isMobile ? "30px 24px" : "45px 55px",
          borderRadius: isMobile ? "24px" : "40px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          gap: "24px",
          marginBottom: "32px",
          border: "1px solid #fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
        }}
      >
        <div className="page-title-section">
          <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.4px", lineHeight: 1.3, margin: 0, color: "#111110" }}>Profit & Loss</h1>
          <p style={{ color: "rgba(15, 23, 42, 0.7)", fontWeight: 600, fontSize: isMobile ? "0.85rem" : "1rem" }}>Financial analytics and performance tracking.</p>
        </div>
        
        <div className="page-actions" style={{ flexWrap: 'wrap', width: isMobile ? '100%' : 'auto', gap: '12px', display: 'flex' }}>
          <div className="date-picker-group" style={{ 
            display: 'flex', 
            gap: '8px', 
            background: '#fff', 
            padding: '8px 16px', 
            borderRadius: '100px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
            height: '48px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaCalendarAlt size={12} color="var(--primary)" />
              <input 
                type="date" 
                value={dates.start} 
                onChange={e => setDates({...dates, start: e.target.value})} 
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
              />
            </div>
            <span style={{ opacity: 0.3 }}>→</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaCalendarAlt size={12} color="var(--primary)" />
              <input 
                type="date" 
                value={dates.end} 
                onChange={e => setDates({...dates, end: e.target.value})} 
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
              />
            </div>
          </div>
          <button className="btn-primary" style={{ borderRadius: '100px', width: isMobile ? '100%' : '48px', height: '48px', padding: '0', justifyContent: 'center', background: '#0F172A', color: '#fff', border: 'none' }}>
            <FaDownload />
          </button>
        </div>
      </header>

      <div className="summary-grid">
        <PerformanceCard
          icon={<FaArrowUp />}
          title="Total Income"
          value={report?.totalIncome || 0}
          color="var(--success)"
          detail="Money In"
        />
        <PerformanceCard
          icon={<FaArrowDown />}
          title="Total Expenses"
          value={report?.totalExpense || 0}
          color="var(--error)"
          detail="Money Out"
        />
        <PerformanceCard
          icon={<FaBalanceScale />}
          title="Clear Profit"
          value={report?.netProfit || 0}
          color="#fff"
          detail="Bottom Line"
          isLarge
        />
      </div>

      <div className="table-responsive">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
          <FaChartBar color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Statement Details</h3>
        </div>
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Net Impact</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={{ padding: '60px', textAlign: 'center' }}>
                  <div className="skeleton" style={{ height: '20px', width: '60%', margin: '0 auto' }} />
                </td>
              </tr>
            ) : (
              report?.details.map((item, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <td data-label="Account">{item.account_name}</td>
                  <td data-label="Category">
                    <span className={`status-pill ${item.account_type === 'INCOME' ? 'success' : 'error'}`}>
                      {item.account_type}
                    </span>
                  </td>
                  <td data-label="Impact" style={{ 
                    textAlign: "right", 
                    fontWeight: 700,
                    color: item.account_type === "EXPENSE" ? "var(--error)" : "var(--success)"
                  }}>
                    {item.account_type === "EXPENSE" ? "-" : "+"} ₹{Math.abs(item.net_impact).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
        
        {report && (
          <div style={{ padding: '24px', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--border-color)', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
             <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>Total Net Profit</span>
             <span style={{ fontWeight: 800, fontSize: '1.5rem', color: report.netProfit >= 0 ? 'var(--primary)' : 'var(--error)' }}>
               ₹{report.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
             </span>
          </div>
        )}
      </div>
    </div>
  );
};

const PerformanceCard: React.FC<any> = ({ icon, title, value, color, detail, isLarge }) => (
  <div className={`stat-card ${isLarge ? 'primary' : ''}`} style={{ 
    background: isLarge ? 'var(--text-primary)' : '#fff',
    color: isLarge ? '#fff' : 'inherit',
    minHeight: '180px'
  }}>
    <div className="stat-info" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
         <div style={{ color: isLarge ? 'var(--primary)' : color }}>{icon}</div>
         <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase' }}>{detail}</span>
      </div>
      <span className="stat-label" style={{ color: isLarge ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{title}</span>
      <h3 className="stat-value" style={{ fontSize: '2rem', color: isLarge ? '#fff' : 'inherit' }}>
        ₹{Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </h3>
    </div>
  </div>
);

export default Reports;
