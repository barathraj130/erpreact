import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import {
    FaBell,
    FaBox,
    FaChartLine,
    FaChevronDown,
    FaClipboardList,
    FaCog,
    FaDownload,
    FaFileInvoiceDollar,
    FaHome,
    FaMoneyBillWave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaUsers,
    FaWallet,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
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
} from 'recharts';
import './SimpleDashboard.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    n >= 1_000_000
        ? `₹${(n / 1_000_000).toFixed(2)}M`
        : n >= 1_000
        ? `₹${(n / 1_000).toFixed(1)}K`
        : `₹${n.toFixed(2)}`;

// ─── Types ──────────────────────────────────────────────────────────────────
interface KPIs { cash: number; bank: number; profit: number; receivable: number; payable: number; }
interface Activity { id: string | number; description: string; amount: number; type: 'credit' | 'debit'; date: string; status: 'SUCCESS' | 'PENDING' | 'FAILED'; }
interface ChartPoint { name: string; inflow: number; outflow: number }
interface RevPoint  { name: string; revenue: number; expense: number }

// ─── Nav Config ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
    { label: 'Home',         icon: <FaHome />,              path: '/simple',                id: 'home' },
    { label: 'Money In/Out', icon: <FaMoneyBillWave />,     path: '/transactions',          id: 'money' },
    { label: 'Bills',        icon: <FaFileInvoiceDollar />, path: '/invoices',              id: 'bills' },
    { label: 'Items',        icon: <FaBox />,               path: '/products',              id: 'items' },
    { label: 'Finance',      icon: <FaChartLine />,         path: '/finance/dashboard',     id: 'finance' },
    { label: 'People',       icon: <FaUsers />,             path: '/employees',             id: 'people' },
    { label: 'Reports',      icon: <FaClipboardList />,     path: '/admin/reports',         id: 'reports' },
    { label: 'Accounts',     icon: <FaWallet />,            path: '/ledgers',               id: 'accounts' },
];

// ─── Mock Fallback ──────────────────────────────────────────────────────────
const MOCK_KPIS: KPIs = { cash: 248590, bank: 1420000, profit: 682400, receivable: 84320, payable: 42150 };
const MOCK_FLOW: ChartPoint[] = [
    { name:'Mon', inflow:52000, outflow:31000 }, { name:'Tue', inflow:47000, outflow:28000 },
    { name:'Wed', inflow:61000, outflow:45000 }, { name:'Thu', inflow:55000, outflow:39000 },
    { name:'Fri', inflow:70000, outflow:42000 }, { name:'Sat', inflow:48000, outflow:25000 },
    { name:'Sun', inflow:39000, outflow:22000 },
];
const MOCK_REV: RevPoint[] = [
    { name:'Jan', revenue:450000, expense:320000 }, { name:'Feb', revenue:520000, expense:280000 },
    { name:'Mar', revenue:480000, expense:350000 }, { name:'Apr', revenue:610000, expense:420000 },
    { name:'May', revenue:550000, expense:390000 }, { name:'Jun', revenue:670000, expense:450000 },
];
const MOCK_ACTIVITY: Activity[] = [
    { id:1, description:'Invoice #INV-9021 paid',     amount:12450, type:'credit', date:'Today 9:41am',  status:'SUCCESS' },
    { id:2, description:'Supplier payment – Acme Co', amount:3500,  type:'debit',  date:'Today 8:20am',  status:'SUCCESS' },
    { id:3, description:'Employee salary batch',      amount:45000, type:'debit',  date:'Yesterday',     status:'SUCCESS' },
    { id:4, description:'Invoice #INV-9019 pending',  amount:8200,  type:'credit', date:'Yesterday',     status:'PENDING' },
    { id:5, description:'Office rent payment',        amount:8000,  type:'debit',  date:'2 days ago',    status:'SUCCESS' },
];

// ─── Main Component ─────────────────────────────────────────────────────────
const SimpleDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [activeNav, setActiveNav]     = useState('home');
    const [kpis, setKpis]               = useState<KPIs>(MOCK_KPIS);
    const [flow, setFlow]               = useState<ChartPoint[]>(MOCK_FLOW);
    const [rev, setRev]                 = useState<RevPoint[]>(MOCK_REV);
    const [activity, setActivity]       = useState<Activity[]>(MOCK_ACTIVITY);
    const [loading, setLoading]         = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [filterOpen, setFilterOpen]   = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [searchVal, setSearchVal]     = useState('');
    const overlayRef = useRef<HTMLDivElement>(null);

    const token = () => localStorage.getItem('erp-token') || '';

    // Fetch live data
    useEffect(() => {
        const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
        Promise.allSettled([
            fetch(`${API}/finance/summary`, { headers }).then(r => r.json()),
            fetch(`${API}/transactions?limit=5`, { headers }).then(r => r.json()),
        ]).then(([sumRes, txRes]) => {
            if (sumRes.status === 'fulfilled' && sumRes.value && !sumRes.value.error) {
                const s = sumRes.value;
                setKpis({
                    cash:       s.cash_in_hand ?? MOCK_KPIS.cash,
                    bank:       s.bank_balance ?? MOCK_KPIS.bank,
                    profit:     s.net_profit   ?? MOCK_KPIS.profit,
                    receivable: s.receivable   ?? MOCK_KPIS.receivable,
                    payable:    s.payable      ?? MOCK_KPIS.payable,
                });
                if (s.cash_flow)      setFlow(s.cash_flow);
                if (s.revenue_chart)  setRev(s.revenue_chart);
            }
            if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) {
                const mapped: Activity[] = (txRes.value as any[]).slice(0, 5).map((tx: any) => ({
                    id:          tx.id,
                    description: tx.description || tx.narration || 'Transaction',
                    amount:      Math.abs(tx.amount ?? 0),
                    type:        (tx.amount ?? 0) >= 0 ? 'credit' : 'debit',
                    date:        tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '',
                    status:      (tx.status as Activity['status']) || 'SUCCESS',
                }));
                if (mapped.length > 0) setActivity(mapped);
            }
        }).finally(() => setLoading(false));
    }, []);

    // Close sidebar on outside click (mobile)
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (overlayRef.current && e.target === overlayRef.current) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNav = (item: typeof NAV_ITEMS[0]) => {
        setActiveNav(item.id);
        setSidebarOpen(false);
        navigate(item.path);
    };

    const handleSettings = () => {
        navigate('/admin/settings');
        setSidebarOpen(false);
    };

    const handleDownloadReport = () => {
        navigate('/admin/reports');
    };

    const handleSeeAll = () => {
        navigate('/transactions');
    };

    const handleLogout = () => {
        localStorage.removeItem('erp-token');
        navigate('/company-login');
        setProfileOpen(false);
    };

    const filteredActivity = activity.filter(tx =>
        searchVal === '' || tx.description.toLowerCase().includes(searchVal.toLowerCase())
    );

    return (
        <div className="simple-layout">

            {/* Mobile overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        ref={overlayRef}
                        className="sidebar-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* ── Sidebar ───────────────────────────────── */}
            <motion.aside
                className={`simple-sidebar${sidebarOpen ? ' open' : ''}`}
                initial={{ x: -220 }}
                animate={{ x: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            >
                <div className="sidebar-brand">
                    <div className="brand-icon">S</div>
                    <h2>Synthesis ERP</h2>
                    <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
                        <FaTimes size={14} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            className={`nav-item${activeNav === item.id ? ' active' : ''}`}
                            onClick={() => handleNav(item)}
                            title={item.label}
                            aria-label={item.label}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <button
                        className="nav-item"
                        onClick={handleSettings}
                        aria-label="Settings"
                    >
                        <span className="nav-icon"><FaCog /></span>
                        <span className="nav-label">Settings</span>
                    </button>
                </div>
            </motion.aside>

            {/* ── Main ──────────────────────────────────── */}
            <main className="simple-main">

                {/* Top Bar */}
                <header className="simple-topbar">
                    <div className="topbar-left">
                        <button
                            className="hamburger"
                            onClick={() => setSidebarOpen(o => !o)}
                            aria-label="Toggle sidebar"
                        >
                            ☰
                        </button>
                        <div className="branch-selector" title="Switch branch">
                            <span className="branch-dot" />
                            Main Branch&nbsp;<FaChevronDown size={10} />
                        </div>
                        <div className="topbar-search">
                            <FaSearch size={12} />
                            <input
                                placeholder="Search transactions, invoices…"
                                value={searchVal}
                                onChange={e => setSearchVal(e.target.value)}
                                aria-label="Search"
                            />
                            {searchVal && (
                                <button
                                    className="clear-search"
                                    onClick={() => setSearchVal('')}
                                    aria-label="Clear search"
                                >
                                    <FaTimes size={10} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="topbar-right">
                        <button
                            className="icon-btn notif"
                            aria-label="Notifications"
                            title="Notifications"
                        >
                            <FaBell size={16} />
                            <span className="badge" />
                        </button>

                        <button
                            className="refresh-btn"
                            onClick={() => window.location.reload()}
                            title="Refresh data"
                            aria-label="Refresh"
                        >
                            <FaSyncAlt size={14} />
                        </button>

                        <div className="profile-wrapper">
                            <button
                                className="profile-trigger"
                                onClick={() => setProfileOpen(p => !p)}
                                aria-label="Profile menu"
                            >
                                <div className="profile-avatar">AD</div>
                                <div className="profile-info">
                                    <span className="profile-name">Admin</span>
                                    <span className="profile-role">Owner</span>
                                </div>
                                <FaChevronDown size={10} style={{ color:'#94a3b8' }} />
                            </button>

                            <AnimatePresence>
                                {profileOpen && (
                                    <motion.div
                                        className="profile-dropdown"
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                    >
                                        <button className="dropdown-item" onClick={() => { navigate('/admin/settings'); setProfileOpen(false); }}>
                                            ⚙️ &nbsp;Settings
                                        </button>
                                        <button className="dropdown-item" onClick={() => { navigate('/admin/reports'); setProfileOpen(false); }}>
                                            📋 &nbsp;Reports
                                        </button>
                                        <div className="dropdown-divider" />
                                        <button className="dropdown-item danger" onClick={handleLogout}>
                                            🚪 &nbsp;Log Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* ── Content ─────────────────────────────── */}
                <div className="content-scrollable" onClick={() => { if (profileOpen) setProfileOpen(false); if (filterOpen) setFilterOpen(false); }}>

                    {/* Page Title */}
                    <div className="page-title-row">
                        <div>
                            <h1 className="page-title">Your Business Overview</h1>
                            <p className="page-subtitle">Everything you need to know, all in one place.</p>
                        </div>
                        <div className="title-actions">
                            {/* Filter Dropdown */}
                            <div className="filter-wrapper">
                                <button
                                    className={`btn-outline${filterOpen ? ' active' : ''}`}
                                    onClick={e => { e.stopPropagation(); setFilterOpen(f => !f); }}
                                >
                                    Filter ▾
                                </button>
                                <AnimatePresence>
                                    {filterOpen && (
                                        <motion.div
                                            className="filter-dropdown"
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                        >
                                            {['Today', 'This Week', 'This Month', 'This Year'].map(label => (
                                                <button
                                                    key={label}
                                                    className="dropdown-item"
                                                    onClick={() => { setFilterOpen(false); }}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <button
                                className="btn-primary"
                                onClick={handleDownloadReport}
                            >
                                <FaDownload size={12} />
                                &nbsp;Download Report
                            </button>
                        </div>
                    </div>

                    {/* ── KPI Strip ─────────────────────────── */}
                    {loading ? (
                        <div className="loading-row">
                            {[0,1,2,3,4].map(i => <div key={i} className="skeleton" />)}
                        </div>
                    ) : (
                        <div className="kpi-strip">
                            <KPICard label="Money in Hand"      value={fmt(kpis.cash)}       color="blue"   trend="+12.4%" onClick={() => navigate('/transactions')} />
                            <KPICard label="Bank Balance"       value={fmt(kpis.bank)}       color="indigo" trend="+3.2%"  onClick={() => navigate('/finance/dashboard')} />
                            <KPICard label="Profit (This Year)" value={fmt(kpis.profit)}     color="green"  trend="+24%"   onClick={() => navigate('/admin/reports')} />
                            <KPICard label="Customers Owe You"  value={fmt(kpis.receivable)} color="amber"  trend=""       onClick={() => navigate('/customers')} />
                            <KPICard label="You Owe Suppliers"  value={fmt(kpis.payable)}    color="red"    trend=""       onClick={() => navigate('/suppliers')} />
                        </div>
                    )}

                    {/* ── Charts Row ────────────────────────── */}
                    <div className="charts-row">

                        {/* Cash Flow */}
                        <div className="chart-card wide">
                            <div className="chart-header">
                                <span className="chart-title">Money Coming In vs Going Out (This Week)</span>
                            </div>
                            <ResponsiveContainer width="100%" height={175}>
                                <AreaChart data={flow} margin={{ top:5, right:10, left:0, bottom:0 }}>
                                    <defs>
                                        <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15}/>
                                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ border:'none', borderRadius:10, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', fontSize:12 }} />
                                    <Area dataKey="inflow"  stroke="#3B82F6" strokeWidth={2.5} fill="url(#gin)" name="Money In" />
                                    <Area dataKey="outflow" stroke="#94a3b8" strokeWidth={2} fill="transparent" name="Money Out" strokeDasharray="4 3" />
                                </AreaChart>
                            </ResponsiveContainer>
                            <div className="chart-legend">
                                <span className="legend-dot blue" />Money In &nbsp;
                                <span className="legend-dot grey" />Money Out
                            </div>
                        </div>

                        {/* Revenue vs Expense */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <span className="chart-title">Sales vs Expenses (6 Months)</span>
                            </div>
                            <ResponsiveContainer width="100%" height={175}>
                                <BarChart data={rev} margin={{ top:5, right:10, left:0, bottom:0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ border:'none', borderRadius:10, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', fontSize:12 }} />
                                    <Bar dataKey="revenue" fill="#1E2A78" radius={[4,4,0,0]} name="Sales" maxBarSize={20} />
                                    <Bar dataKey="expense" fill="#E2E8F0" radius={[4,4,0,0]} name="Expenses" maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="chart-legend">
                                <span className="legend-dot indigo" />Sales &nbsp;
                                <span className="legend-dot silver" />Expenses
                            </div>
                        </div>

                        {/* Quick Summary */}
                        <div className="chart-card summary-card">
                            <p className="summary-label">Customers Still Need to Pay You</p>
                            <p className="summary-value blue" style={{ cursor:'pointer' }} onClick={() => navigate('/customers')}>
                                {fmt(kpis.receivable)}
                            </p>
                            <div className="divider" />
                            <p className="summary-label">You Still Need to Pay Suppliers</p>
                            <p className="summary-value red" style={{ cursor:'pointer' }} onClick={() => navigate('/suppliers')}>
                                {fmt(kpis.payable)}
                            </p>
                            <div className="divider" />
                            <button className="btn-outline-sm" onClick={() => navigate('/finance/dashboard')}>
                                View Full Finance →
                            </button>
                        </div>
                    </div>

                    {/* ── Recent Activity ───────────────────── */}
                    <div className="activity-card">
                        <div className="activity-header">
                            <span className="chart-title">Recent Transactions</span>
                            <button className="btn-link" onClick={handleSeeAll}>See All →</button>
                        </div>
                        <table className="simple-table">
                            <thead>
                                <tr>
                                    <th>What Happened</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredActivity.map(tx => (
                                    <tr
                                        key={tx.id}
                                        className="tx-row"
                                        onClick={() => navigate('/transactions')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div className="tx-desc">
                                                <span className={`tx-dot ${tx.type === 'credit' ? 'green' : 'red'}`} />
                                                {tx.description}
                                            </div>
                                        </td>
                                        <td className={`tx-amount ${tx.type === 'credit' ? 'green' : 'red'}`}>
                                            {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                                        </td>
                                        <td className="tx-date">{tx.date}</td>
                                        <td>
                                            <span className={`status-pill status-${tx.status.toLowerCase()}`}>
                                                {tx.status === 'SUCCESS' ? 'Done' : tx.status === 'PENDING' ? 'Waiting' : 'Failed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredActivity.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign:'center', color:'#94a3b8', padding:'1.5rem' }}>
                                            No transactions match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </main>
        </div>
    );
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
const PALETTE: Record<string, string> = {
    blue: '#3B82F6', indigo: '#1E2A78',
    green: '#10B981', amber: '#F59E0B', red: '#EF4444',
};

const KPICard: React.FC<{
    label: string; value: string; color: string; trend: string; onClick?: () => void;
}> = ({ label, value, color, trend, onClick }) => (
    <motion.button
        className="kpi-card kpi-card-btn"
        whileHover={{ y: -4, boxShadow: '0 8px 18px rgba(0,0,0,0.11)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        title={`View ${label}`}
    >
        <div className="kpi-accent" style={{ background: PALETTE[color] || PALETTE.blue }} />
        <p className="kpi-label">{label}</p>
        <p className="kpi-value" style={{ color: color === 'red' ? PALETTE.red : color === 'green' ? PALETTE.green : '#1E293B' }}>
            {value}
        </p>
        {trend && (
            <p className="kpi-trend" style={{ color: PALETTE.green }}>↑ {trend} vs last month</p>
        )}
    </motion.button>
);

export default SimpleDashboard;
