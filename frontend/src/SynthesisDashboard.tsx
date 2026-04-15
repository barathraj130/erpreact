import { motion } from "framer-motion";
import React from "react";
import { FaArrowUp, FaDownload, FaEllipsisV, FaFilter } from "react-icons/fa";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SynthesisLayout from "./SynthesisLayout";

const cashFlowData = [
  { name: "Mon", inflow: 4000, outflow: 2400 },
  { name: "Tue", inflow: 3000, outflow: 1398 },
  { name: "Wed", inflow: 2000, outflow: 9800 },
  { name: "Thu", inflow: 2780, outflow: 3908 },
  { name: "Fri", inflow: 1890, outflow: 4800 },
  { name: "Sat", inflow: 2390, outflow: 3800 },
  { name: "Sun", inflow: 3490, outflow: 4300 },
];

const expenseRevenueData = [
  { month: "Jan", revenue: 45000, expense: 32000 },
  { month: "Feb", revenue: 52000, expense: 28000 },
  { month: "Mar", revenue: 48000, expense: 35000 },
  { month: "Apr", revenue: 61000, expense: 42000 },
  { month: "May", revenue: 55000, expense: 39000 },
  { month: "Jun", revenue: 67000, expense: 45000 },
];

const SynthesisDashboard: React.FC = () => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <SynthesisLayout activeItem="Command Center">
      <div className="fade-in-up">
        {/* Header Section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            marginBottom: isMobile ? "1rem" : "2rem",
            padding: isMobile ? "16px 20px" : "2rem",
            background: "#C4B5FD",
            borderRadius: isMobile ? "16px" : "24px",
            gap: isMobile ? "0.75rem" : "1.5rem"
          }}
        >
          <div>
            <h1
              style={{ fontSize: isMobile ? "1.4rem" : "1.8rem", fontWeight: 600, color: "#1E293B" }}
            >
              Welcome back to your Dashboard!
            </h1>
            <p
              style={{
                color: "#475569",
                fontSize: isMobile ? "0.85rem" : "0.95rem",
                fontWeight: 500,
                marginTop: "8px",
              }}
            >
              Manage your resources, track finances, and view latest
              transactions.
            </p>
          </div>
          <div style={{ display: "flex", gap: "1rem", width: isMobile ? "100%" : "auto" }}>
            <button
              style={{
                padding: "0.8rem 1.5rem",
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: "100px",
                fontWeight: 600,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                width: isMobile ? "100%" : "auto",
                justifyContent: "center"
              }}
            >
              <FaDownload size={12} /> Export Data
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="kpi-grid" style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", 
          gap: isMobile ? "10px" : "1rem",
          marginBottom: isMobile ? "1rem" : "1.5rem"
        }}>
          <motion.div
            className="kpi-card"
            style={{ 
              background: "white",
              padding: isMobile ? "14px" : "20px", 
              borderRadius: "24px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
              border: "1px solid #f1f5f9",
              overflow: "hidden"
            }}
          >
            <div className="kpi-label" style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Available Cash
            </div>
            <div className="kpi-value" style={{ color: "#1e293b", fontSize: isMobile ? "1.2rem" : "1.6rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
              $248,590.00
            </div>
            <div className="kpi-trend trend-up" style={{ color: "#10b981", fontSize: "0.7rem", marginTop: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
              <FaArrowUp /> +12.4%{" "}
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                vs last month
              </span>
            </div>
          </motion.div>

          <motion.div
            className="kpi-card"
            style={{ 
              background: "white", 
              padding: isMobile ? "14px" : "20px", 
              borderRadius: "24px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
              border: "1px solid #f1f5f9",
              overflow: "hidden"
            }}
          >
            <div className="kpi-label" style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Total Bank Balance
            </div>
            <div className="kpi-value" style={{ color: "#1e293b", fontSize: isMobile ? "1.2rem" : "1.6rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
              $1,420,000.00
            </div>
            <div className="kpi-trend trend-up" style={{ color: "#10b981", fontSize: "0.7rem", marginTop: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
              <FaArrowUp /> +3.2%{" "}
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                5 accounts
              </span>
            </div>
          </motion.div>

          <motion.div
            className="kpi-card"
            style={{ 
              background: "white", 
              padding: isMobile ? "14px" : "20px", 
              borderRadius: "24px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
              border: "1px solid #f1f5f9",
              overflow: "hidden"
            }}
          >
            <div className="kpi-label" style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Net Profit
            </div>
            <div className="kpi-value" style={{ color: "#1e293b", fontSize: isMobile ? "1.2rem" : "1.6rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
              $682,400.00
            </div>
            <div className="kpi-trend trend-up" style={{ color: "#10b981", fontSize: "0.7rem", marginTop: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
              <FaArrowUp /> +24%{" "}
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                Projected
              </span>
            </div>
          </motion.div>
        </div>

        {/* Analytics Grid */}
        <div className="dashboard-grid">
          {/* Main Chart */}
          <div className="widget-card" style={{ overflow: "hidden" }}>
            <div className="widget-header" style={{ marginBottom: "1rem" }}>
              <h3 className="widget-title">Cash Flow</h3>
              <div className="widget-actions">
                <FaEllipsisV style={{ color: "#94a3b8", cursor: "pointer" }} />
              </div>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(226, 232, 240, 0.5)"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontFamily: "Satoshi", fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                    dy={12}
                  />
                  <Tooltip
                    contentStyle={{ fontFamily: "Satoshi",
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                      padding: "12px 16px",
                      background: "rgba(255, 255, 255, 0.96)",
                      backdropFilter: "blur(4px)"
                    }}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Area
                    type="monotone"
                    dataKey="inflow"
                    stroke="#6366f1"
                    strokeWidth={4}
                    strokeLinecap="round"
                    fillOpacity={1}
                    fill="url(#colorIn)"
                    filter="url(#glow)"
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 0, fill: '#6366f1' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="outflow"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    fill="transparent"
                    strokeDasharray="6 6"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Stats */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            <div className="widget-card" style={{ overflow: "hidden", padding: isMobile ? "16px" : "20px" }}>
              <h3 className="widget-title" style={{ marginBottom: "1rem", fontSize: "1rem" }}>
                Revenue vs Expense
              </h3>
              <div style={{ width: "100%", height: 120 }}>
                <ResponsiveContainer>
                  <BarChart data={expenseRevenueData}>
                    <XAxis dataKey="month" hide />
                    <YAxis hide />
                    <Bar
                      dataKey="revenue"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={16}
                    />
                    <Bar
                      dataKey="expense"
                      fill="#f1f5f9"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="widget-card"
              style={{ background: "#F8FAFC", color: "#1E293B" }}
            >
              <div className="kpi-label" style={{ color: "#64748B" }}>
                Outstanding Receivables
              </div>
              <div
                className="kpi-value"
                style={{ color: "#1E293B", fontSize: "1.5rem" }}
              >
                $84,320.00
              </div>
              <div
                style={{
                  height: "1px",
                  background: "#e2e8f0",
                  margin: "1rem 0",
                }}
              ></div>
              <div className="kpi-label" style={{ color: "#64748B" }}>
                Pending Payables
              </div>
              <div
                className="kpi-value"
                style={{ color: "#1E293B", fontSize: "1.5rem" }}
              >
                $42,150.00
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="widget-card">
          <div className="widget-header">
            <h3 className="widget-title">Recent Transactions</h3>
            <button
              style={{
                color: "#1E293B",
                background: "none",
                border: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              View All
            </button>
          </div>
          <table className="premium-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  id: "FT-9021",
                  entity: "Amazon Web Services",
                  cat: "Cloud Infra",
                  amt: "-$1,240.00",
                  status: "SUCCESS",
                },
                {
                  id: "FT-9022",
                  entity: "Global Logistics Corp",
                  cat: "Shipping",
                  amt: "-$3,500.00",
                  status: "PENDING",
                },
                {
                  id: "FT-9023",
                  entity: "Stripe Payout",
                  cat: "Revenue",
                  amt: "+$12,450.00",
                  status: "SUCCESS",
                },
                {
                  id: "FT-9024",
                  entity: "Employee Payroll (May)",
                  cat: "Workforce",
                  amt: "-$45,000.00",
                  status: "SUCCESS",
                },
                {
                  id: "FT-9025",
                  entity: "Office Space Rental",
                  cat: "Facilities",
                  amt: "-$8,000.00",
                  status: "ERROR",
                },
              ].map((tx, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{tx.id}</td>
                  <td>{tx.entity}</td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#64748B",
                        background: "#f1f5f9",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                      }}
                    >
                      {tx.cat}
                    </span>
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: tx.amt.startsWith("+") ? "#10B981" : "#1E293B",
                    }}
                  >
                    {tx.amt}
                  </td>
                  <td>
                    <span
                      className={`status-pill status-${tx.status.toLowerCase()}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td>
                    <button
                      style={{
                        color: "#64748B",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <FaDownload size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SynthesisLayout>
  );
};

export default SynthesisDashboard;
