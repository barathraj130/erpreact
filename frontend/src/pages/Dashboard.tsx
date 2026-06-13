import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiFetch } from "../utils/api";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar 
} from 'recharts';
import "./Dashboard.css";

/* ─────────────────── helpers ─────────────────── */
const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(Math.round(v));
const fmtCr = (v: number) => {
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v/100000).toFixed(2)}L`;
  if (v >= 1000) return `₹${(v/1000).toFixed(1)}K`;
  return `₹${v}`;
};

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9'];

const calcTrend = (current: number, previous: number) => {
  if (!current || current === 0) return null;
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  return {
    value: change.toFixed(1),
    isUp: change >= 0
  };
};

/* ─────────────────── component ─────────────────── */
const Dashboard: React.FC = () => {
  const { user } = useAuthUser();
  const { activeBranch } = useTenant();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    outstanding: 0,
    outstandingCount: 0,
    cashAvailable: 0,
    taxSales: 0,
    anonSales: 0,
    namesakeSales: 0,
    loanPayable: 0,
    activeLoans: 0
  });
  const [ledgerWarnings, setLedgerWarnings] = useState<{ cash?: string; bank?: string }>({});
  const [nsbPending, setNsbPending] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [stockSummary, setStockSummary] = useState<{ total_fresh: number; total_mistake: number; total_inventory_value: number; active_lots: number } | null>(null);
  const [lotPipeline, setLotPipeline] = useState<Record<string, number> | null>(null);

  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [outstandingCustomers, setOutstandingCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [kpiRes, trendRes, expenseRes, outstandingRes, txRes, loansRes, nsbRes] = await Promise.all([
          apiFetch("/dashboard/summary").then(r => r.json()),
          apiFetch("/dashboard/monthly-sales-trend").then(r => r.json()),
          apiFetch("/dashboard/expense-breakdown").then(r => r.json()),
          apiFetch("/dashboard/outstanding-by-customer").then(r => r.json()),
          apiFetch("/transactions?limit=5").then(r => r.json()),
          apiFetch("/loans").then(r => r.json()).catch(() => []),
          apiFetch("/invoice/nsb/gst-pending").then(r => r.json()).catch(() => ({ summary: {} })),
        ]);

        if (kpiRes?.stock_summary) setStockSummary(kpiRes.stock_summary);
        if (kpiRes?.lot_pipeline)  setLotPipeline(kpiRes.lot_pipeline);

        if (kpiRes) {
          console.log('DASHBOARD DEBUG - KPI Response:', kpiRes);
          const totalRev = Number(kpiRes.total_revenue || 0);
          const monthRev = Number(kpiRes.total_monthly_sales || 0);
          const activeLoans = Array.isArray(loansRes) ? loansRes.filter((l: any) => l.status === 'ACTIVE') : [];
          const loanPayable = activeLoans.reduce((sum: number, l: any) => sum + Number(l.remaining_principal ?? l.principal_amount ?? 0), 0);

          setStats({
            totalRevenue: totalRev,
            monthlyRevenue: monthRev,
            outstanding: Number(kpiRes.outstanding_receivables || 0),
            outstandingCount: Number(kpiRes.outstanding_customer_count || 0),
            cashAvailable: Number(kpiRes.available_cash || 0),
            taxSales: Number(kpiRes.sales_breakdown?.tax_sales || 0),
            anonSales: Number(kpiRes.sales_breakdown?.anon_sales || 0),
            namesakeSales: Number(kpiRes.sales_breakdown?.name_sake_sales || 0),
            loanPayable,
            activeLoans: activeLoans.length
          });
          setLedgerWarnings({
            cash: kpiRes.cash_warning || undefined,
            bank: kpiRes.bank_warning || undefined,
          });
        }
        
        if (trendRes) {
          console.log('DASHBOARD DEBUG - Monthly Trend:', trendRes);
          if (Array.isArray(trendRes)) setMonthlyTrend(trendRes);
        }
        
        if (outstandingRes) {
          console.log('DASHBOARD DEBUG - Top Outstanding:', outstandingRes);
          if (Array.isArray(outstandingRes)) setOutstandingCustomers(outstandingRes);
        }

        if (Array.isArray(expenseRes)) setExpenseData(expenseRes.map(e => ({ name: e.category, amount: parseFloat(e.amount) })));
        if (Array.isArray(txRes)) setTransactions(txRes);
        if (nsbRes?.summary) {
          setNsbPending({
            count: nsbRes.summary.pending_count || 0,
            total: nsbRes.summary.pending_gst_total || 0,
          });
        }

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeBranch]);

  const salesBreakdownData = [
    { name: 'TAX Sales', value: stats.taxSales, color: '#4F46E5' },
    { name: 'Non-TAX', value: stats.anonSales, color: '#F59E0B' },
    { name: 'Name-sake', value: stats.namesakeSales, color: '#E5E7EB' }
  ].filter(d => d.value > 0);

  return (
    <div className="db-page">
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Enterprise Dashboard</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">Real-time Intelligence</span>
        </div>
        <div className="db-topbar-right">
          <button className="db-btn" onClick={() => window.location.reload()}>Refresh</button>
          <button className="db-btn db-btn-primary">Download Insights</button>
        </div>
      </header>

      <div className="db-content">
        <div className="db-page-header">
          <h1 className="db-page-title">Welcome back, <strong>{user?.name || user?.username || 'Admin'}</strong></h1>
          <p className="db-page-sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* ── Ledger warning banners ── */}
        {(ledgerWarnings.cash || ledgerWarnings.bank) && (
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ledgerWarnings.cash && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 500 }}>
                ⚠️ {ledgerWarnings.cash}
              </div>
            )}
            {ledgerWarnings.bank && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 500 }}>
                ⚠️ {ledgerWarnings.bank}
              </div>
            )}
          </div>
        )}

        {/* ── KPI Row ── */}
        <div className="db-kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <KPICard
            title="TOTAL REVENUE"
            value={stats.totalRevenue}
            sub="All time"
            icon="💰"
            color="indigo"
          />
          <KPICard
            title="THIS MONTH"
            value={stats.monthlyRevenue}
            trend={calcTrend(stats.monthlyRevenue, monthlyTrend[monthlyTrend.length - 2]?.revenue)}
            sub={new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            icon="📅"
            color="blue"
          />
          <KPICard
            title="OUTSTANDING"
            value={stats.outstanding}
            sub={`${stats.outstandingCount} customers`}
            icon="⚠️"
            color="amber"
          />
          <KPICard
            title="CASH AVAILABLE"
            value={stats.cashAvailable}
            sub="Live balance"
            icon="🏦"
            color="green"
          />
          <KPICard
            title="LOAN PAYABLE"
            value={stats.loanPayable}
            sub={`${stats.activeLoans} active loan${stats.activeLoans !== 1 ? 's' : ''}`}
            icon="🏛️"
            color="rose"
          />
        </div>

        {/* ── NSB GST Liability Banner ── */}
        {nsbPending.count > 0 && (
          <div style={{
            background: "#fff7ed", border: "1.5px solid #fb923c", borderRadius: "12px",
            padding: "14px 20px", marginBottom: "16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "22px" }}>🧾</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "14px", color: "#c2410c" }}>
                  NSB GST Pending — {nsbPending.count} invoice{nsbPending.count !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: "12px", color: "#9a3412", marginTop: "2px" }}>
                  Total GST liability: ₹{nsbPending.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })} not yet remitted to government
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/invoices")}
              style={{
                padding: "8px 18px", borderRadius: "8px", border: "none",
                background: "#ea580c", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer",
              }}
            >
              View NSB Invoices
            </button>
          </div>
        )}

        {/* ── Main Charts ── */}
        <div className="db-charts-row" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="db-card">
            <div className="db-card-header"><span className="db-card-title">Monthly Revenue Trend</span></div>
            <div className="db-card-body" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%" debounce={200}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} />
                  <Tooltip formatter={(v: any) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="db-card">
            <div className="db-card-header"><span className="db-card-title">Sales Breakdown</span></div>
            <div className="db-card-body" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%" debounce={200}>
                <PieChart>
                  <Pie data={salesBreakdownData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {salesBreakdownData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Secondary Charts ── */}
        <div className="db-charts-row" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="db-card">
            <div className="db-card-header"><span className="db-card-title">Expense Breakdown</span></div>
            <div className="db-card-body" style={{ height: '250px' }}>
              {expenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                  <BarChart data={expenseData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                    <Tooltip formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                    <Bar dataKey="amount" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyPlaceholder message="No expenses recorded this month" />
              )}
            </div>
          </div>

          <div className="db-card">
            <div className="db-card-header"><span className="db-card-title">Top Outstanding by Customer</span></div>
            <div className="db-card-body" style={{ height: '250px' }}>
              {outstandingCustomers.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                  <BarChart data={outstandingCustomers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                    <Tooltip formatter={(v: any) => `₹${v.toLocaleString('en-IN')}`} />
                    <Bar dataKey="amount" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyPlaceholder message="No outstanding balances found" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Management Widget — JBS Knit Wear Surplus Module */}
      {(stockSummary || lotPipeline) && (
        <div style={{ margin: "20px 0", padding: "0 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Stock Management</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 14 }}>
            {[
              { label: "Fresh Available", value: `${Number(stockSummary?.total_fresh || 0).toLocaleString("en-IN")} pcs`, color: "#10b981" },
              { label: "Mistake Available", value: `${Number(stockSummary?.total_mistake || 0).toLocaleString("en-IN")} pcs`, color: "#f59e0b" },
              { label: "Inventory Value", value: `₹${Number(stockSummary?.total_inventory_value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#4f46e5" },
              { label: "Active Lots", value: String(stockSummary?.active_lots || 0), color: "#8b5cf6" },
            ].map(k => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
              </div>
            ))}
          </div>
          {lotPipeline && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 12, textTransform: "uppercase" }}>Lot Pipeline</div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
                {[
                  { label: "Received", key: "received", color: "#6b7280" },
                  { label: "Inspecting", key: "inspecting", color: "#3b82f6" },
                  { label: "Converting", key: "converting", color: "#f59e0b" },
                  { label: "Ready", key: "ready", color: "#10b981" },
                  { label: "Partial", key: "partial_sold", color: "#8b5cf6" },
                  { label: "Sold Out", key: "sold_out", color: "#14b8a6" },
                ].map((stage, i, arr) => (
                  <React.Fragment key={stage.key}>
                    <div style={{ textAlign: "center", minWidth: 80 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: stage.color }}>{lotPipeline[stage.key] || 0}</div>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{stage.label}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ color: "#e2e8f0", fontSize: 18, padding: "0 6px", flexShrink: 0 }}>→</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const KPICard = ({ title, value, sub, icon, color, trend }: any) => (
  <div className={`db-kpi-card db-kpi-card--${color}`}>
    <div className="db-kpi-top">
      <span className="db-kpi-label">{title}</span>
      <span style={{fontSize: '18px'}}>{icon}</span>
    </div>
    <div className="db-kpi-value">{fmtCr(value)}</div>
    <div className="db-kpi-footer">
      {trend ? (
        <span className={`db-kpi-trend ${trend.isUp ? 'up' : 'down'}`}>
          {trend.isUp ? '↑' : '↓'} {Math.abs(trend.value)}% vs last
        </span>
      ) : (
        <span className="db-kpi-sub">{sub}</span>
      )}
    </div>
  </div>
);

const EmptyPlaceholder = ({ message }: any) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '10px' }}>
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <p style={{ fontSize: '13px' }}>{message}</p>
  </div>
);

export default Dashboard;
