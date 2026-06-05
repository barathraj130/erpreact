import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { 
    FaFileInvoice, FaShoppingBag, FaPercentage, FaGavel, 
    FaChartBar, FaBoxes, FaUserTie, FaUserFriends, 
    FaMoneyBillWave, FaArrowRight, FaStar, FaHistory 
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "./Reports.css";

const categories = [
    {
        id: "sales",
        title: "Sales Reports",
        icon: <FaFileInvoice />,
        color: "#6366f1",
        reports: [
            { id: "sales-register", name: "Sales Register" },
            { id: "customer-sales", name: "Customer-wise Sales" },
            { id: "product-sales", name: "Product-wise Sales" },
            { id: "broker-sales", name: "Broker-wise Sales" },
            { id: "payment-collection", name: "Payment Collection" },
            { id: "sales-return", name: "Sales Return Report" }
        ]
    },
    {
        id: "purchase",
        title: "Purchase Reports",
        icon: <FaShoppingBag />,
        color: "#10b981",
        reports: [
            { id: "purchase-register", name: "Purchase Register" },
            { id: "supplier-purchase", name: "Supplier-wise Purchase" },
            { id: "product-purchase", name: "Product-wise Purchase" },
            { id: "broker-purchase", name: "Broker-wise Purchase" },
            { id: "purchase-payment", name: "Purchase Payment Report" }
        ]
    },
    {
        id: "gst",
        title: "GST Reports",
        icon: <FaPercentage />,
        color: "#f59e0b",
        reports: [
            { id: "gst-summary", name: "GST Summary Report" },
            { id: "gstr-1", name: "GSTR-1 Ready Report" },
            { id: "gstr-3b", name: "GSTR-3B Ready Report" },
            { id: "itc-report", name: "ITC (Input Tax Credit) Report" }
        ]
    },
    {
        id: "finance",
        title: "Financial Reports",
        icon: <FaChartBar />,
        color: "#3b82f6",
        reports: [
            { id: "day-book", name: "Day Book" },
            { id: "trial-balance", name: "Trial Balance" },
            { id: "pl-statement", name: "Profit & Loss Statement" },
            { id: "balance-sheet", name: "Balance Sheet" },
            { id: "cash-flow", name: "Cash Flow Statement" },
            { id: "ledger-report", name: "Ledger Account Report" }
        ]
    },
    {
        id: "inventory",
        title: "Inventory Reports",
        icon: <FaBoxes />,
        color: "#8b5cf6",
        reports: [
            { id: "stock-summary", name: "Stock Summary Report" },
            { id: "stock-movement", name: "Stock Movement Report" },
            { id: "stock-valuation", name: "Stock Valuation Report" },
            { id: "dead-stock", name: "Dead Stock Report" }
        ]
    },
    {
        id: "finance-module",
        title: "Fin-Module Reports",
        icon: <FaMoneyBillWave />,
        color: "#ec4899",
        reports: [
            { id: "loan-statement", name: "Loan Statement Report" },
            { id: "chit-fund", name: "Chit Fund Report" },
            { id: "broker-commission", name: "Broker Commission Report" }
        ]
    },
    {
        id: "hr",
        title: "Employee & HR",
        icon: <FaUserFriends />,
        color: "#ef4444",
        reports: [
            { id: "attendance-report", name: "Attendance Report" },
            { id: "salary-report", name: "Salary Report" },
            { id: "employee-ledger", name: "Employee Ledger Report" }
        ]
    },
    {
        id: "executive",
        title: "Executive Dashboard",
        icon: <FaGavel />,
        color: "#1e293b",
        reports: [
            { id: "health-dashboard", name: "Business Health Dashboard" },
            { id: "day-closing", name: "Day Closing Summary" }
        ]
    }
];

const ReportsDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/reports/dashboard-stats")
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const statCards = [
        { label: "Today's Sales", value: stats?.today_sales || 0, color: "#6366f1", isCurrency: true },
        { label: "Today's Purchases", value: stats?.today_purchases || 0, color: "#10b981", isCurrency: true },
        { label: "Cash Position", value: stats?.cash_balance || 0, color: "#3b82f6", isCurrency: true },
        { label: "GST Liability", value: stats?.gst_liability || 0, color: "#f59e0b", isCurrency: true },
        { label: "Total Receivables", value: stats?.total_receivables || 0, color: "#ec4899", isCurrency: true },
        { label: "Active Customers", value: stats?.active_customers || 0, color: "#8b5cf6", isCurrency: false }
    ];

    return (
        <div className="reports-dashboard-page">
            <header className="reports-header">
                <div className="header-left">
                    <h1>Reports <strong>Intelligence</strong></h1>
                    <p>Comprehensive business insights and financial analytics</p>
                </div>
                <div className="header-right">
                    <div className="date-badge">
                        {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="reports-stats-grid">
                {statCards.map((s, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="stat-mini-card"
                    >
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value" style={{ color: s.color }}>
                            {s.isCurrency ? '₹' : ''}{new Intl.NumberFormat('en-IN').format(s.value)}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Reports Grid */}
            <div className="reports-categories-grid">
                {categories.map((cat, idx) => (
                    <motion.div 
                        key={cat.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + (idx * 0.05) }}
                        className="category-card"
                    >
                        <div className="category-header">
                            <div className="category-icon" style={{ background: `${cat.color}15`, color: cat.color }}>
                                {cat.icon}
                            </div>
                            <div className="category-info">
                                <h3>{cat.title}</h3>
                                <span>{cat.reports.length} Reports Available</span>
                            </div>
                            <button className="pin-btn"><FaStar /></button>
                        </div>
                        <div className="reports-list">
                            {cat.reports.map(r => (
                                <Link key={r.id} to={`/reports/${r.id}`} className="report-link">
                                    <span className="report-name">{r.name}</span>
                                    <FaArrowRight className="link-arrow" />
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Recent Section */}
            <div className="recent-reports-section">
                <div className="section-title">
                    <FaHistory /> Recent Reports
                </div>
                <div className="recent-grid">
                    <div className="recent-item">
                        <FaFileInvoice color="#6366f1" />
                        <span>Sales Register</span>
                        <small>Opened 10m ago</small>
                    </div>
                    <div className="recent-item">
                        <FaBoxes color="#8b5cf6" />
                        <span>Stock Summary</span>
                        <small>Opened 1h ago</small>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsDashboard;
