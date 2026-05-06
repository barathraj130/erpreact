import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiFetch } from "../utils/api";
import "./Dashboard.css";

/* ─────────────────── helpers ─────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN").format(Math.round(v));

/* ─────────────────── component ─────────────────── */
const Dashboard: React.FC = () => {
  const { user } = useAuthUser();
  const { activeBranch } = useTenant();
  const navigate = useNavigate();
  
  const [kpis, setKpis] = useState({
    cashBalance: 0,
    bankBalance: 0,
    monthlySales: 0,
    taxAmount: 0,
    anonAmount: 0,
    netProfit: 0,
    receivables: 0,
    payables: 0
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setLoading(true);
    
    const fetchDashboard = async () => {
      try {
        const [kpiRes, financeRes, txRes] = await Promise.all([
          apiFetch("/dashboard/kpis").then(r => r.json()),
          apiFetch("/dashboard/finance").then(r => r.json()),
          apiFetch("/transactions?limit=10").then(r => r.json())
        ]);

        if (kpiRes?.data) {
          const k = kpiRes.data;
          setKpis(prev => ({
            ...prev,
            monthlySales: k.monthly_sales || 0,
            taxAmount: k.sales_breakdown?.tax_amount || 0,
            anonAmount: k.sales_breakdown?.anon_amount || 0,
            receivables: k.outstanding_receivables || 0,
            payables: k.outstanding_payables || 0,
          }));
        }

        if (financeRes?.data) {
          const f = financeRes.data;
          setKpis(prev => ({
            ...prev,
            cashBalance: f.summary?.cash_balance || 0,
            bankBalance: f.summary?.total_income || 0,
            netProfit: f.summary?.net_profit || 0
          }));
          setExpenseCategories(f.expenses_by_category || []);
          setMonthlyTrend(f.monthly_trend || []);
        }

        if (Array.isArray(txRes)) {
          setTransactions(txRes.slice(0, 5));
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [activeBranch]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const filtered = transactions.filter(t =>
    (t.description || t.ledger_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.type || "").toLowerCase().includes(search.toLowerCase())
  );

  const getTxTypeClass = (type: string) => {
    const t = type?.toLowerCase();
    if (t === 'sale' || t === 'credit') return 'type-sale';
    if (t === 'payroll') return 'type-payroll';
    if (t === 'expense' || t === 'debit') return 'type-expense';
    return 'type-receipt';
  };

  const totalExpenses = expenseCategories.reduce((sum, c) => sum + parseFloat(c.amount), 0);

  return (
    <div className="db-page">

      {/* ── Sticky Topbar ── */}
      <header className="db-topbar">
        <div className="db-topbar-left" style={{ paddingLeft: isMobile ? "40px" : "0" }}>
          <span className="db-topbar-title">Dashboard</span>
          {!isMobile && <span className="db-topbar-sep">/</span>}
          {!isMobile && <span className="db-topbar-sub">Financial Overview</span>}
        </div>

        <div className="db-topbar-right">
          <button className="db-btn db-btn-ghost" onClick={() => window.location.reload()}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 8a6 6 0 1 0 1.2-3.6"/><path d="M2 4v4h4"/>
            </svg>
            Refresh
          </button>
          <button className="db-btn db-btn-primary">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 2v9M4 8l4 4 4-4M2 13h12"/>
            </svg>
            Export Report
          </button>
        </div>
      </header>

      {/* ── Page Body ── */}
      <div className="db-content">

        {/* Page Header */}
        <div className="db-page-header">
          <div>
            <h1 className="db-page-title" style={{ fontSize: isMobile ? "1.5rem" : "20px" }}>
              {greeting}, <strong>{user?.name}</strong>
            </h1>
            <p className="db-page-sub">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              {activeBranch && !isMobile ? ` · ${activeBranch.branch_name}` : ""}
            </p>
          </div>
        </div>


        {/* KPI Cards */}
        <div className="db-kpi-grid">
          <div className="db-kpi-card db-kpi-card--cash">
            <div className="db-kpi-top">
              <span className="db-kpi-label">Available Cash</span>
              <span className="db-badge bg-green">Live</span>
            </div>
            <div className="db-kpi-value"><span className="db-kpi-cur">₹</span>{fmt(kpis.cashBalance)}</div>
            <div className="db-kpi-footer">
              <span>Current balance in cleared accounts</span>
            </div>
          </div>

          <div className="db-kpi-card db-kpi-card--bank">
            <div className="db-kpi-top">
              <span className="db-kpi-label">Total Monthly Sales</span>
              <span className="db-badge bg-blue">MTD</span>
            </div>
            <div className="db-kpi-value"><span className="db-kpi-cur">₹</span>{fmt(kpis.monthlySales)}</div>
            <div className="db-kpi-footer">
              <span>Gross revenue for this month</span>
            </div>
          </div>

          <div className="db-kpi-card db-kpi-card--sales">
            <div className="db-kpi-top">
              <span className="db-kpi-label">Sales Breakdown</span>
              <span className="db-badge bg-blue">Tax vs Anon</span>
            </div>
            <div className="db-kpi-value"><span className="db-kpi-cur">₹</span>{fmt(kpis.taxAmount + kpis.anonAmount)}</div>
            <div className="db-kpi-footer" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                 <div style={{ width: `${(kpis.taxAmount / (kpis.monthlySales || 1)) * 100}%`, background: '#2563eb' }}></div>
                 <div style={{ width: `${(kpis.anonAmount / (kpis.monthlySales || 1)) * 100}%`, background: '#f59e0b' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10px', fontWeight: 600 }}>
                 <span style={{ color: '#2563eb' }}>Tax: ₹{fmt(kpis.taxAmount)}</span>
                 <span style={{ color: '#f59e0b' }}>Anon: ₹{fmt(kpis.anonAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="db-charts-row">
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Monthly Sales Trend</span>
              <div className="db-chart-legend">
                <span><span className="db-legend-line solid"></span>Revenue</span>
                <button className="db-btn" style={{ padding: "4px 10px", fontSize: "11.5px" }}>This Year ▾</button>
              </div>
            </div>
            <div className="db-card-body">
              <div className="db-chart-area">
                {monthlyTrend.length > 0 ? (
                  <svg viewBox="0 0 560 150" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                    <path d={`M0 150 ${monthlyTrend.map((t, i) => `L ${(i * 560) / (monthlyTrend.length - 1)} ${150 - (Math.min(t.sales / 1000, 140))}`).join(' ')} L 560 150 Z`} fill="#eff4ff" opacity="0.8"/>
                    <path d={`M ${monthlyTrend.map((t, i) => `${(i * 560) / (monthlyTrend.length - 1)} ${150 - (Math.min(t.sales / 1000, 140))}`).join(' L ')}`} fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                    No sales trend data yet
                  </div>
                )}
              </div>
              <div className="db-chart-xaxis">
                {monthlyTrend.slice(-5).map((t, i) => (
                  <span key={i}>{new Date(t.month).toLocaleDateString(undefined, { month: 'short' })}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Expense Breakdown</span>
              <button className="db-btn db-btn-ghost" style={{ padding: "4px 8px", fontSize: "11.5px" }}>MTD ▾</button>
            </div>
            <div className="db-donut-wrap">
              <div className="db-donut-container">
                <svg viewBox="0 0 130 130" style={{ width: "130px", height: "130px" }}>
                  <circle cx="65" cy="65" r="50" fill="none" stroke="#f0f0ee" strokeWidth="18"/>
                  {expenseCategories.map((cat, idx) => {
                    const pct = (parseFloat(cat.amount) / (totalExpenses || 1));
                    const dashArray = `${pct * 314.15} ${314.15}`;
                    let offset = 0;
                    for(let i=0; i<idx; i++) offset -= (parseFloat(expenseCategories[i].amount) / (totalExpenses || 1)) * 314.15;
                    return (
                      <circle key={cat.category} cx="65" cy="65" r="50" fill="none" 
                        stroke={['#1a56db', '#6366f1', '#94a3b8', '#e2e8f0'][idx % 4]} 
                        strokeWidth="18" strokeDasharray={dashArray} strokeDashoffset={offset} 
                        transform="rotate(-90 65 65)"/>
                    );
                  })}
                </svg>
                <div className="db-donut-center">
                  <span className="db-donut-total">₹{totalExpenses > 100000 ? (totalExpenses/100000).toFixed(1)+'L' : fmt(totalExpenses)}</span>
                  <span className="db-donut-sub">Expenses</span>
                </div>
              </div>

              <div className="db-donut-legend">
                {expenseCategories.length > 0 ? expenseCategories.slice(0, 4).map((cat, idx) => (
                  <div key={cat.category} className="db-legend-row">
                    <div className="db-legend-left">
                      <span className="db-legend-dot" style={{ background: ['#1a56db', '#6366f1', '#94a3b8', '#e2e8f0'][idx % 4] }}></span>
                      <span className="db-legend-label">{cat.category}</span>
                    </div>
                    <div>
                      <span className="db-legend-val">₹{fmt(parseFloat(cat.amount))}</span>
                    </div>
                  </div>
                )) : (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>No expenses recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="db-table-wrap">
          <div className="db-table-header">
            <span className="db-table-title">Recent Transactions</span>
            <div className="db-table-actions">
              <div className="db-search-wrap">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
                <input
                  className="db-search-input"
                  type="text"
                  placeholder="Search transactions…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button className="db-btn">Filter</button>
              <button className="db-btn db-btn-primary" onClick={() => navigate("/invoices/new")}>+ Add</button>
            </div>
          </div>

          <table className="db-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(txn => (
                <tr key={txn.id}>
                  <td>
                    <div className="db-txn-name">{txn.description || txn.ledger_name || "General Transaction"}</div>
                    <div className="db-txn-id">TXN-{txn.id}</div>
                  </td>
                  <td><span className={`db-type-tag ${getTxTypeClass(txn.type)}`}>{txn.type}</span></td>
                  <td className="db-date-cell">{new Date(txn.date || txn.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`db-txn-amount ${txn.type === 'DEBIT' ? 'amount-dr' : 'amount-cr'}`}>
                      {txn.type === 'DEBIT' ? '−' : '+'} ₹{fmt(txn.amount)}
                    </span>
                  </td>
                  <td>
                    <span className="db-status-tag st-paid">
                      <span className="db-s-dot"></span>{txn.reference_no || "N/A"}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No transactions found. Add some to see them here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="db-tfoot">
            <span>Showing {filtered.length} of 128 transactions</span>
            <div className="db-pagination">
              <button className="db-pg-btn">←</button>
              <button className="db-pg-btn db-pg-active">1</button>
              <button className="db-pg-btn">2</button>
              <button className="db-pg-btn">3</button>
              <button className="db-pg-btn">→</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
