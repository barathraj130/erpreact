import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
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
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
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
import "./SimpleDashboard.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `₹${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `₹${(n / 1_000).toFixed(1)}K`
      : `₹${n.toFixed(2)}`;

// ─── Types ──────────────────────────────────────────────────────────────────
interface KPIs {
  cash: number;
  bank: number;
  profit: number;
  receivable: number;
  payable: number;
}
interface Activity {
  id: string | number;
  description: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
}
interface ChartPoint {
  name: string;
  inflow: number;
  outflow: number;
}
interface RevPoint {
  name: string;
  revenue: number;
  expense: number;
}

// ─── Nav Config ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Home", icon: <FaHome />, path: "/simple", id: "home" },
  {
    label: "Money In/Out",
    icon: <FaMoneyBillWave />,
    path: "/transactions",
    id: "money",
  },
  {
    label: "Bills",
    icon: <FaFileInvoiceDollar />,
    path: "/invoices",
    id: "bills",
  },
  { label: "Items", icon: <FaBox />, path: "/products", id: "items" },
  {
    label: "Finance",
    icon: <FaChartLine />,
    path: "/finance/dashboard",
    id: "finance",
  },
  { label: "People", icon: <FaUsers />, path: "/employees", id: "people" },
  {
    label: "Reports",
    icon: <FaClipboardList />,
    path: "/admin/reports",
    id: "reports",
  },
  { label: "Accounts", icon: <FaWallet />, path: "/ledgers", id: "accounts" },
];

// ─── Mock Fallback ──────────────────────────────────────────────────────────
const MOCK_KPIS: KPIs = {
  cash: 248590,
  bank: 1420000,
  profit: 682400,
  receivable: 84320,
  payable: 42150,
};
const MOCK_FLOW: ChartPoint[] = [
  { name: "Mon", inflow: 52000, outflow: 31000 },
  { name: "Tue", inflow: 47000, outflow: 28000 },
  { name: "Wed", inflow: 61000, outflow: 45000 },
  { name: "Thu", inflow: 55000, outflow: 39000 },
  { name: "Fri", inflow: 70000, outflow: 42000 },
  { name: "Sat", inflow: 48000, outflow: 25000 },
  { name: "Sun", inflow: 39000, outflow: 22000 },
];
const MOCK_REV: RevPoint[] = [
  { name: "Jan", revenue: 450000, expense: 320000 },
  { name: "Feb", revenue: 520000, expense: 280000 },
  { name: "Mar", revenue: 480000, expense: 350000 },
  { name: "Apr", revenue: 610000, expense: 420000 },
  { name: "May", revenue: 550000, expense: 390000 },
  { name: "Jun", revenue: 670000, expense: 450000 },
];
const MOCK_ACTIVITY: Activity[] = [
  {
    id: 1,
    description: "Invoice #INV-9021 paid",
    amount: 12450,
    type: "credit",
    date: "Today 9:41am",
    status: "SUCCESS",
  },
  {
    id: 2,
    description: "Supplier payment – Acme Co",
    amount: 3500,
    type: "debit",
    date: "Today 8:20am",
    status: "SUCCESS",
  },
  {
    id: 3,
    description: "Employee salary batch",
    amount: 45000,
    type: "debit",
    date: "Yesterday",
    status: "SUCCESS",
  },
  {
    id: 4,
    description: "Invoice #INV-9019 pending",
    amount: 8200,
    type: "credit",
    date: "Yesterday",
    status: "PENDING",
  },
  {
    id: 5,
    description: "Office rent payment",
    amount: 8000,
    type: "debit",
    date: "2 days ago",
    status: "SUCCESS",
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────
const SimpleDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("home");
  const [kpis, setKpis] = useState<KPIs>(MOCK_KPIS);
  const [flow, setFlow] = useState<ChartPoint[]>(MOCK_FLOW);
  const [rev, setRev] = useState<RevPoint[]>(MOCK_REV);
  const [activity, setActivity] = useState<Activity[]>(MOCK_ACTIVITY);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const token = () => localStorage.getItem("erp-token") || "";

  // Fetch live data
  useEffect(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const t = token();
    if (t) headers["Authorization"] = `Bearer ${t}`;

    const now = new Date();
    const startOfYear = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().split("T")[0];

    Promise.allSettled([
      fetch(`${API}/accounting/accounts`, { headers }).then((r) => r.json()),
      fetch(
        `${API}/accounting/reports/profit-loss?start_date=${startOfYear}&end_date=${today}`,
        { headers },
      ).then((r) => r.json()),
      fetch(`${API}/transactions`, { headers }).then((r) => r.json()),
      fetch(`${API}/dashboard/summary`, { headers }).then((r) => r.json()),
    ])
      .then(([accountsRes, plRes, txRes, dashRes]) => {
        // --- KPI from chart_of_accounts ---
        if (
          accountsRes.status === "fulfilled" &&
          Array.isArray(accountsRes.value)
        ) {
          const accounts = accountsRes.value;
          const getBal = (keyword: string) => {
            const match = accounts.find((a: any) =>
              (a.name || "").toLowerCase().includes(keyword.toLowerCase()),
            );
            return match
              ? Math.abs(
                  parseFloat(match.current_balance || match.balance || "0"),
                )
              : 0;
          };
          setKpis((prev) => ({
            ...prev,
            cash: getBal("Cash") || prev.cash,
            bank: getBal("Bank") || prev.bank,
            receivable: getBal("Receivable") || prev.receivable,
            payable: getBal("Payable") || prev.payable,
          }));
        }

        // --- P&L net profit ---
        if (plRes.status === "fulfilled" && plRes.value && !plRes.value.error) {
          const p = plRes.value;
          const netProfit = p.netProfit ?? p.net_profit ?? 0;
          setKpis((prev) => ({
            ...prev,
            profit:
              typeof netProfit === "number"
                ? netProfit
                : parseFloat(netProfit) || prev.profit,
          }));
        }

        // --- Dashboard summary (if available) ---
        if (
          dashRes.status === "fulfilled" &&
          dashRes.value &&
          !dashRes.value.error
        ) {
          const s = dashRes.value;
          if (s.cash_flow) setFlow(s.cash_flow);
          if (s.revenue_chart) setRev(s.revenue_chart);
        }

        // --- Recent transactions ---
        if (txRes.status === "fulfilled" && Array.isArray(txRes.value)) {
          const mapped: Activity[] = (txRes.value as any[])
            .slice(0, 5)
            .map((tx: any) => ({
              id: tx.id,
              description:
                tx.description || tx.narration || `Transaction #${tx.id}`,
              amount: Math.abs(tx.amount ?? 0),
              type:
                tx.type === "RECEIPT" ||
                tx.type === "INVOICE" ||
                (tx.amount ?? 0) >= 0
                  ? ("credit" as const)
                  : ("debit" as const),
              date: tx.date
                ? new Date(tx.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })
                : tx.transaction_date
                  ? new Date(tx.transaction_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "",
              status: (tx.status as Activity["status"]) || "SUCCESS",
            }));
          if (mapped.length > 0) setActivity(mapped);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNav = (item: (typeof NAV_ITEMS)[0]) => {
    setActiveNav(item.id);
    setSidebarOpen(false);
    navigate(item.path);
  };

  const handleSettings = () => {
    navigate("/admin/settings");
    setSidebarOpen(false);
  };

  const handleDownloadReport = () => {
    navigate("/admin/reports");
  };

  const handleSeeAll = () => {
    navigate("/transactions");
  };

  const handleLogout = () => {
    localStorage.removeItem("erp-token");
    navigate("/company-login");
    setProfileOpen(false);
  };

  const filteredActivity = activity.filter(
    (tx) =>
      searchVal === "" ||
      tx.description.toLowerCase().includes(searchVal.toLowerCase()),
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
        className={`simple-sidebar${sidebarOpen ? " open" : ""}`}
        initial={{ x: -220 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 25 }}
      >
        <div className="sidebar-brand">
          <div className="brand-icon">S</div>
          <h2>Synthesis ERP</h2>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
          >
            <FaTimes size={14} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item${activeNav === item.id ? " active" : ""}`}
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
            <span className="nav-icon">
              <FaCog />
            </span>
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
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <div className="branch-selector" title="Switch branch">
              <span className="branch-dot" />
              Main Branch&nbsp;
              <FaChevronDown size={10} />
            </div>
            <div className="topbar-search">
              <FaSearch size={12} />
              <input
                placeholder="Search transactions, invoices…"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                aria-label="Search"
              />
              {searchVal && (
                <button
                  className="clear-search"
                  onClick={() => setSearchVal("")}
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
                onClick={() => setProfileOpen((p) => !p)}
                aria-label="Profile menu"
              >
                <div className="profile-avatar">AD</div>
                <div className="profile-info">
                  <span className="profile-name">Admin</span>
                  <span className="profile-role">Owner</span>
                </div>
                <FaChevronDown size={10} style={{ color: "#94a3b8" }} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    className="profile-dropdown"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        navigate("/admin/settings");
                        setProfileOpen(false);
                      }}
                    >
                      ⚙️ &nbsp;Settings
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        navigate("/admin/reports");
                        setProfileOpen(false);
                      }}
                    >
                      📋 &nbsp;Reports
                    </button>
                    <div className="dropdown-divider" />
                    <button
                      className="dropdown-item danger"
                      onClick={handleLogout}
                    >
                      🚪 &nbsp;Log Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────────── */}
        <div
          className="content-scrollable"
          onClick={() => {
            if (profileOpen) setProfileOpen(false);
            if (filterOpen) setFilterOpen(false);
          }}
        >
          {/* Page Title */}
          <div className="page-title-row">
            <div>
              <h1 className="page-title">Your Business Overview</h1>
              <p className="page-subtitle">
                Everything you need to know, all in one place.
              </p>
            </div>
            <div className="title-actions">
              {/* Filter Dropdown */}
              <div className="filter-wrapper">
                <button
                  className={`btn-outline${filterOpen ? " active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterOpen((f) => !f);
                  }}
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
                      {["Today", "This Week", "This Month", "This Year"].map(
                        (label) => (
                          <button
                            key={label}
                            className="dropdown-item"
                            onClick={() => {
                              setFilterOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ),
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button className="btn-primary" onClick={handleDownloadReport}>
                <FaDownload size={12} />
                &nbsp;Download Report
              </button>
            </div>
          </div>

          {/* ── KPI Strip ─────────────────────────── */}
          {loading ? (
            <div className="loading-row">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          ) : (
            <div className="kpi-strip" style={{ gap: "0.5rem" }}>
              <KPICard
                label="Cash"
                value={fmt(kpis.cash)}
                color="blue"
                trend="+12%"
                onClick={() => navigate("/transactions")}
              />
              <KPICard
                label="Bank"
                value={fmt(kpis.bank)}
                color="indigo"
                trend="+3%"
                onClick={() => navigate("/finance/dashboard")}
              />
              <KPICard
                label="Profit"
                value={fmt(kpis.profit)}
                color="green"
                trend="+24%"
                onClick={() => navigate("/admin/reports")}
              />
              <KPICard
                label="Owed By"
                value={fmt(kpis.receivable)}
                color="amber"
                trend=""
                onClick={() => navigate("/customers")}
              />
              <KPICard
                label="Owed To"
                value={fmt(kpis.payable)}
                color="red"
                trend=""
                onClick={() => navigate("/suppliers")}
              />
            </div>
          )}

          {/* ── Charts Row ────────────────────────── */}
          <div className="charts-row">
            {/* Cash Flow */}
            <div className="chart-card wide">
              <div className="chart-header">
                <span className="chart-title">
                  Money Coming In vs Going Out (This Week)
                </span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart
                  data={flow}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#3B82F6"
                        stopOpacity={0.3}
                      />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(226, 232, 240, 0.4)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontFamily: "Satoshi", fontSize: 10, fill: "#94a3b8", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                  />
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ fontFamily: "Satoshi",
                      border: "none",
                      borderRadius: 12,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                      fontSize: 11,
                      padding: "8px 12px"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="inflow"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    fill="url(#gin)"
                    name="Money In"
                    dot={{ r: 3, fill: '#3B82F6', strokeWidth: 1, stroke: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="outflow"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    fill="transparent"
                    name="Money Out"
                    strokeDasharray="5 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                <span className="legend-dot blue" />
                Money In &nbsp;
                <span className="legend-dot grey" />
                Money Out
              </div>
            </div>

            {/* Revenue vs Expense */}
            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-title">
                  Sales vs Expenses (6 Months)
                </span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart
                  data={rev}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(226, 232, 240, 0.4)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontFamily: "Satoshi", fontSize: 10, fill: "#94a3b8", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                  />
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ fontFamily: "Satoshi",
                      border: "none",
                      borderRadius: 12,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                      fontSize: 11,
                      padding: "8px 12px"
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#1E2A78"
                    radius={[4, 4, 0, 0]}
                    name="Sales"
                    maxBarSize={12}
                  />
                  <Bar
                    dataKey="expense"
                    fill="#e2e8f0"
                    radius={[4, 4, 0, 0]}
                    name="Expenses"
                    maxBarSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                <span className="legend-dot indigo" />
                Sales &nbsp;
                <span className="legend-dot silver" />
                Expenses
              </div>
            </div>

            {/* Quick Summary */}
            <div className="chart-card summary-card">
              <p className="summary-label">Customers Still Need to Pay You</p>
              <p
                className="summary-value blue"
                style={{ cursor: "pointer" }}
                onClick={() => navigate("/customers")}
              >
                {fmt(kpis.receivable)}
              </p>
              <div className="divider" />
              <p className="summary-label">You Still Need to Pay Suppliers</p>
              <p
                className="summary-value red"
                style={{ cursor: "pointer" }}
                onClick={() => navigate("/suppliers")}
              >
                {fmt(kpis.payable)}
              </p>
              <div className="divider" />
              <button
                className="btn-outline-sm"
                onClick={() => navigate("/finance/dashboard")}
              >
                View Full Finance →
              </button>
            </div>
          </div>

          {/* ── Recent Activity ───────────────────── */}
          <div className="activity-card">
            <div className="activity-header">
              <span className="chart-title">Recent Transactions</span>
              <button className="btn-link" onClick={handleSeeAll}>
                See All →
              </button>
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
                {filteredActivity.map((tx) => (
                  <tr
                    key={tx.id}
                    className="tx-row"
                    onClick={() => navigate("/transactions")}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div className="tx-desc">
                        <span
                          className={`tx-dot ${tx.type === "credit" ? "green" : "red"}`}
                        />
                        {tx.description}
                      </div>
                    </td>
                    <td
                      className={`tx-amount ${tx.type === "credit" ? "green" : "red"}`}
                    >
                      {tx.type === "credit" ? "+" : "-"}
                      {fmt(tx.amount)}
                    </td>
                    <td className="tx-date">{tx.date}</td>
                    <td>
                      <span
                        className={`status-pill status-${tx.status.toLowerCase()}`}
                      >
                        {tx.status === "SUCCESS"
                          ? "Done"
                          : tx.status === "PENDING"
                            ? "Waiting"
                            : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredActivity.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        color: "#94a3b8",
                        padding: "1.5rem",
                      }}
                    >
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
  blue: "#3B82F6",
  indigo: "#1E2A78",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
};

const KPICard: React.FC<{
  label: string;
  value: string;
  color: string;
  trend: string;
  onClick?: () => void;
}> = ({ label, value, color, trend, onClick }) => (
  <button
    className="kpi-card kpi-card-btn"
    onClick={onClick}
    title={`View ${label}`}
  >
    <div
      className="kpi-accent"
      style={{ background: PALETTE[color] || PALETTE.blue }}
    />
    <p className="kpi-label">{label}</p>
    <p
      className="kpi-value"
      style={{
        color:
          color === "red"
            ? PALETTE.red
            : color === "green"
              ? PALETTE.green
              : "#1E293B",
      }}
    >
      {value}
    </p>
    {trend && (
      <p className="kpi-trend" style={{ color: PALETTE.green }}>
        ↑ {trend} vs last month
      </p>
    )}
  </button>
);

export default SimpleDashboard;
