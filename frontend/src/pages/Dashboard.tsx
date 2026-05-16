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
    cashAvailable: 0,
    taxSales: 0,
    anonSales: 0,
    namesakeSales: 0,
    loanPayable: 0,
    activeLoans: 0
  });

  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [outstandingCustomers, setOutstandingCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [kpiRes, trendRes, expenseRes, outstandingRes, txRes, loansRes] = await Promise.all([
          apiFetch("/dashboard/summary").then(r => r.json()),
          apiFetch("/dashboard/monthly-sales-trend").then(r => r.json()),
          apiFetch("/dashboard/expense-breakdown").then(r => r.json()),
          apiFetch("/dashboard/outstanding-by-customer").then(r => r.json()),
          apiFetch("/transactions?limit=5").then(r => r.json()),
          apiFetch("/loans").then(r => r.json()).catch(() => [])
        ]);

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
            cashAvailable: Number(kpiRes.available_cash || 0),
            taxSales: Number(kpiRes.sales_breakdown?.tax_sales || 0),
            anonSales: Number(kpiRes.sales_breakdown?.anon_sales || 0),
            namesakeSales: Number(kpiRes.sales_breakdown?.name_sake_sales || 0),
            loanPayable,
            activeLoans: activeLoans.length
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
          <h1 className="db-page-title">Welcome back, <strong>{user?.name}</strong></h1>
          <p className="db-page-sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

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
            sub={`${outstandingCustomers.length} customers`}
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

        {/* ── Main Charts ── */}
        <div className="db-charts-row" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="db-card">
            <div className="db-card-header"><span className="db-card-title">Monthly Revenue Trend</span></div>
            <div className="db-card-body" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
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
              <ResponsiveContainer width="100%" height="100%">
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
                <ResponsiveContainer width="100%" height="100%">
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
                <ResponsiveContainer width="100%" height="100%">
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
