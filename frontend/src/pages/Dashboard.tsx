import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiFetch } from "../utils/api";
import "./Dashboard.css";

/* ─────────────────── helpers ─────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN").format(Math.round(v));

const DUMMY_KPIS = {
  cashBalance: 842500,
  bankBalance: 1245000,
  netProfit: 215400,
};

const DUMMY_TRANSACTIONS = [
  { id: "TXN-2026-03-001", name: "Acme Corp — Invoice #1042", type: "Sale", typeClass: "type-sale", date: "23 Mar 2026", amount: "+ ₹48,000", amountClass: "amount-cr", status: "Paid", statusClass: "st-paid" },
  { id: "TXN-2026-03-002", name: "Monthly Payroll — March", type: "Payroll", typeClass: "type-payroll", date: "22 Mar 2026", amount: "− ₹2,12,000", amountClass: "amount-dr", status: "Paid", statusClass: "st-paid" },
  { id: "TXN-2026-03-003", name: "AWS Infrastructure — Q1", type: "Expense", typeClass: "type-expense", date: "21 Mar 2026", amount: "− ₹34,500", amountClass: "amount-dr", status: "Pending", statusClass: "st-pending" },
  { id: "TXN-2026-03-004", name: "Beta Distributors — Receipt", type: "Receipt", typeClass: "type-receipt", date: "20 Mar 2026", amount: "+ ₹1,05,000", amountClass: "amount-cr", status: "Paid", statusClass: "st-paid" },
  { id: "TXN-2026-03-005", name: "Marketing — Google Ads", type: "Expense", typeClass: "type-expense", date: "19 Mar 2026", amount: "− ₹22,400", amountClass: "amount-dr", status: "Failed", statusClass: "st-failed" },
];

/* ─────────────────── component ─────────────────── */
const Dashboard: React.FC = () => {
  const { user } = useAuthUser();
  const { activeBranch } = useTenant();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(DUMMY_KPIS);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  useEffect(() => {
    apiFetch("/dashboard/kpis")
      .then(r => r.json())
      .then(d => {
        if (d?.data) {
          setKpis(prev => ({
            ...prev,
            cashBalance: d.data.monthly_sales || prev.cashBalance, // Just using for demo if bank empty
            monthlySales: d.data.monthly_sales,
            taxAmount: d.data.sales_breakdown?.tax_amount || 0,
            anonAmount: d.data.sales_breakdown?.anon_amount || 0,
            netProfit: d.data.monthly_sales - (d.data.outstanding_payables || 0),
          }));
        }
      })
      .catch(() => {});
  }, [activeBranch]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const filtered = DUMMY_TRANSACTIONS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.type.toLowerCase().includes(search.toLowerCase())
  );

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
              {greeting}, <strong>{user?.username}</strong>
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
               <span className="db-badge bg-green">↑ +12.4%</span>
             </div>
             <div className="db-kpi-value"><span className="db-kpi-cur">₹</span>{fmt(kpis.cashBalance)}</div>
             <div className="db-kpi-footer">
               <span className="db-trend trend-up">↑ +12.4%</span>
               <span>vs last month</span>
             </div>
           </div>

           <div className="db-kpi-card db-kpi-card--bank">
             <div className="db-kpi-top">
               <span className="db-kpi-label">Total Bank Balance</span>
               <span className="db-badge bg-blue">+3.2%</span>
             </div>
             <div className="db-kpi-value"><span className="db-kpi-cur">₹</span>{fmt(kpis.bankBalance)}</div>
             <div className="db-kpi-footer">
               <span className="db-trend trend-up">↑ +3.2%</span>
               <span>across all accounts</span>
             </div>
           </div>

           <div className="db-kpi-card db-kpi-card--sales">
             <div className="db-kpi-top">
               <span className="db-kpi-label">Month Sales (Tax vs Anon)</span>
               <span className="db-badge bg-blue">Breakdown</span>
             </div>
             <div className="db-kpi-value"><span className="db-kpi-cur">₹</span>{fmt((kpis as any).monthlySales || 0)}</div>
             <div className="db-kpi-footer" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
               <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${((kpis as any).taxAmount / ((kpis as any).monthlySales || 1)) * 100}%`, background: '#2563eb' }}></div>
                  <div style={{ width: `${((kpis as any).anonAmount / ((kpis as any).monthlySales || 1)) * 100}%`, background: '#f59e0b' }}></div>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10px', fontWeight: 600 }}>
                  <span style={{ color: '#2563eb' }}>Tax: ₹{fmt((kpis as any).taxAmount || 0)}</span>
                  <span style={{ color: '#f59e0b' }}>Anon: ₹{fmt((kpis as any).anonAmount || 0)}</span>
               </div>
             </div>
           </div>
         </div>

        {/* Charts row */}
        <div className="db-charts-row">

          {/* Cash Flow: SVG line chart */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Cash Flow Dynamics</span>
              <div className="db-chart-legend">
                <span><span className="db-legend-line solid"></span>Inflow</span>
                <span><span className="db-legend-line dashed"></span>Outflow</span>
                <button className="db-btn" style={{ padding: "4px 10px", fontSize: "11.5px" }}>This month ▾</button>
              </div>
            </div>
            <div className="db-card-body">
              <div className="db-chart-area">
                <svg viewBox="0 0 560 150" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                  {/* Grid */}
                  <line x1="0" y1="0" x2="560" y2="0" stroke="#f0f0ee" strokeWidth="1"/>
                  <line x1="0" y1="38" x2="560" y2="38" stroke="#f0f0ee" strokeWidth="1"/>
                  <line x1="0" y1="75" x2="560" y2="75" stroke="#f0f0ee" strokeWidth="1"/>
                  <line x1="0" y1="113" x2="560" y2="113" stroke="#f0f0ee" strokeWidth="1"/>
                  {/* Area fill */}
                  <path d="M0 120 C40 100 70 60 110 55 C150 50 180 80 220 65 C260 50 290 30 330 25 C370 20 400 45 440 40 C480 35 510 20 560 15 L560 150 L0 150 Z" fill="#eff4ff" opacity="0.8"/>
                  {/* Inflow line */}
                  <path d="M0 120 C40 100 70 60 110 55 C150 50 180 80 220 65 C260 50 290 30 330 25 C370 20 400 45 440 40 C480 35 510 20 560 15" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
                  {/* Outflow dashed */}
                  <path d="M0 133 C40 128 70 114 110 108 C150 103 180 118 220 110 C260 103 290 92 330 90 C370 88 400 100 440 97 C480 94 510 84 560 80" fill="none" stroke="#c7c7c4" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round"/>
                  {/* Dots */}
                  <circle cx="110" cy="55" r="3.5" fill="#fff" stroke="#1a56db" strokeWidth="1.5"/>
                  <circle cx="220" cy="65" r="3.5" fill="#fff" stroke="#1a56db" strokeWidth="1.5"/>
                  <circle cx="330" cy="25" r="4" fill="#1a56db"/>
                  <circle cx="440" cy="40" r="3.5" fill="#fff" stroke="#1a56db" strokeWidth="1.5"/>
                  <circle cx="560" cy="15" r="3.5" fill="#fff" stroke="#1a56db" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="db-chart-xaxis">
                <span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span><span>Today</span>
              </div>
            </div>
          </div>

          {/* Donut chart */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Expenses by Category</span>
              <button className="db-btn db-btn-ghost" style={{ padding: "4px 8px", fontSize: "11.5px" }}>This month ▾</button>
            </div>
            <div className="db-donut-wrap">
              {/* Donut SVG */}
              <div className="db-donut-container">
                <svg viewBox="0 0 130 130" style={{ width: "130px", height: "130px" }}>
                  <circle cx="65" cy="65" r="50" fill="none" stroke="#f0f0ee" strokeWidth="18"/>
                  {/* Payroll 38% = 119.3/314 */}
                  <circle cx="65" cy="65" r="50" fill="none" stroke="#1a56db" strokeWidth="18"
                    strokeDasharray="119.3 194.7" strokeDashoffset="0" transform="rotate(-90 65 65)"/>
                  {/* Ops 27% = 84.8 */}
                  <circle cx="65" cy="65" r="50" fill="none" stroke="#6366f1" strokeWidth="18"
                    strokeDasharray="84.8 229.2" strokeDashoffset="-119.3" transform="rotate(-90 65 65)"/>
                  {/* Marketing 19% = 59.7 */}
                  <circle cx="65" cy="65" r="50" fill="none" stroke="#94a3b8" strokeWidth="18"
                    strokeDasharray="59.7 254.3" strokeDashoffset="-204.1" transform="rotate(-90 65 65)"/>
                  {/* Other 16% */}
                  <circle cx="65" cy="65" r="50" fill="none" stroke="#e2e8f0" strokeWidth="18"
                    strokeDasharray="50.2 263.8" strokeDashoffset="-263.8" transform="rotate(-90 65 65)"/>
                </svg>
                <div className="db-donut-center">
                  <span className="db-donut-total">₹5.57L</span>
                  <span className="db-donut-sub">Expenses</span>
                </div>
              </div>

              <div className="db-donut-legend">
                {[
                  { label: "Payroll", pct: "38%", val: "₹2,12,000", color: "#1a56db" },
                  { label: "Operations", pct: "27%", val: "₹1,49,390", color: "#6366f1" },
                  { label: "Marketing", pct: "19%", val: "₹1,05,830", color: "#94a3b8" },
                  { label: "Other", pct: "16%", val: "₹89,780", color: "#e2e8f0", border: true },
                ].map(item => (
                  <div key={item.label} className="db-legend-row">
                    <div className="db-legend-left">
                      <span className="db-legend-dot" style={{ background: item.color, border: item.border ? "1px solid #cbd5e1" : "none" }}></span>
                      <span className="db-legend-label">{item.label}</span>
                    </div>
                    <div>
                      <span className="db-legend-val">{item.val}</span>
                      <span className="db-legend-pct">{item.pct}</span>
                    </div>
                  </div>
                ))}
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
                <th>Transaction</th>
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(txn => (
                <tr key={txn.id}>
                  <td>
                    <div className="db-txn-name">{txn.name}</div>
                    <div className="db-txn-id">{txn.id}</div>
                  </td>
                  <td><span className={`db-type-tag ${txn.typeClass}`}>{txn.type}</span></td>
                  <td className="db-date-cell">{txn.date}</td>
                  <td><span className={`db-txn-amount ${txn.amountClass}`}>{txn.amount}</span></td>
                  <td>
                    <span className={`db-status-tag ${txn.statusClass}`}>
                      <span className="db-s-dot"></span>{txn.status}
                    </span>
                  </td>
                </tr>
              ))}
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
