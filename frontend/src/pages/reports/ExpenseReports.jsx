import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatDate, formatINRShort, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import FilterBar from '../../components/reports/FilterBar';
import ExportButtons from '../../components/reports/ExportButtons';
import ChartCard from '../../components/reports/ChartCard';
import { KPIGrid } from '../../components/reports/FinanceRow';
import DataTable from '../../components/reports/DataTable';

const fmt = (v) => '₹' + Math.abs(parseFloat(v || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const toISO = (d) => d.toISOString().split('T')[0];

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

const periodToRange = (period) => {
  const now = new Date();
  if (period === 'today') return { from: toISO(now), to: toISO(now) };
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { from: toISO(start), to: toISO(now) };
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: toISO(now) };
  // month (default)
  return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'categories', label: 'By Category' },
  { id: 'daily', label: 'Day by Day' },
  { id: 'salary', label: 'Salary & Wages' },
  { id: 'purchases', label: 'Purchase Payments' },
  { id: 'loans', label: 'Loan Payments' },
  { id: 'transactions', label: 'All Transactions' },
];

const categoryColumns = [
  { key: 'label', label: 'Category', minWidth: 160, wrap: true,
    render: (v, row) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
        {v}
      </span>
    ) },
  { key: 'transaction_count', label: 'Transactions', align: 'right', minWidth: 110 },
  { key: 'total_amount', label: 'Total Amount', align: 'right', type: 'amount', bold: true, minWidth: 140,
    colorFn: () => '#ef4444' },
  { key: 'percentage', label: '% of Total', align: 'right', minWidth: 90, render: (v) => `${v}%` },
  { key: 'avg_amount', label: 'Avg / Txn', align: 'right', type: 'amount', minWidth: 120 },
  { key: 'min_amount', label: 'Min', align: 'right', type: 'amount', minWidth: 100 },
  { key: 'max_amount', label: 'Max', align: 'right', type: 'amount', minWidth: 100 },
];

const dailyColumns = [
  { key: 'date', label: 'Date', minWidth: 130, render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
  { key: 'date', label: 'Day', minWidth: 90, render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { weekday: 'short' }) : '—' },
  { key: 'total', label: 'Total Expenses', align: 'right', type: 'amount', bold: true, minWidth: 140, colorFn: () => '#ef4444' },
  { key: 'categories', label: 'Categories Used', align: 'right', minWidth: 130, render: (v) => Object.keys(v || {}).length },
  { key: 'top_category', label: 'Highest Category', align: 'right', minWidth: 150,
    render: (_v, row) => {
      const top = Object.entries(row.categories || {}).sort((a, b) => b[1] - a[1])[0];
      if (!top) return '—';
      return (
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: '#fef2f2', color: '#ef4444', fontWeight: 600 }}>
          {top[0].replace(/_/g, ' ')}
        </span>
      );
    } },
];

const salaryColumns = [
  { key: 'employee_name', label: 'Employee', minWidth: 150, bold: true },
  { key: 'employee_role', label: 'Role', minWidth: 110 },
  { key: 'salary_paid', label: 'Salary Paid', align: 'right', type: 'amount', minWidth: 130, colorFn: () => '#4f46e5' },
  { key: 'wages_paid', label: 'Daily Wages', align: 'right', type: 'amount', minWidth: 120, colorFn: () => '#7c3aed' },
  { key: 'advances_given', label: 'Advances', align: 'right', type: 'amount', minWidth: 120, colorFn: () => '#d97706' },
  { key: 'total_outflow', label: 'Total Outflow', align: 'right', type: 'amount', bold: true, minWidth: 140, colorFn: () => '#ef4444' },
  { key: 'payments_count', label: 'Payments', align: 'right', minWidth: 90 },
];

const StatusBadge = ({ value }) => {
  const isPaid = value === 'PAID' || value === 'paid';
  return (
    <span style={{
      fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
      background: isPaid ? '#dcfce7' : '#fee2e2', color: isPaid ? '#166534' : '#991b1b',
    }}>
      {(value || 'PENDING').toUpperCase()}
    </span>
  );
};

const purchaseColumns = [
  { key: 'bill_number', label: 'Bill No', minWidth: 110, bold: true, colorFn: () => '#4f46e5' },
  { key: 'supplier_name', label: 'Supplier', minWidth: 150 },
  { key: 'date', label: 'Date', minWidth: 100, type: 'date' },
  { key: 'bill_amount', label: 'Bill Amount', align: 'right', type: 'amount', bold: true, minWidth: 130 },
  { key: 'paid_amount', label: 'Paid', align: 'right', type: 'amount', minWidth: 120, colorFn: () => '#16a34a' },
  { key: 'balance_amount', label: 'Balance', align: 'right', type: 'amount', bold: true, minWidth: 120,
    colorFn: (v) => parseFloat(v || 0) > 0 ? '#dc2626' : '#94a3b8' },
  { key: 'status', label: 'Status', align: 'right', minWidth: 100, render: (v) => <StatusBadge value={v} /> },
];

const loanColumns = [
  { key: 'lender_name', label: 'Lender', minWidth: 150, bold: true },
  { key: 'payments_count', label: 'Payments', align: 'right', minWidth: 100 },
  { key: 'principal_repaid', label: 'Principal', align: 'right', type: 'amount', minWidth: 130 },
  { key: 'interest_repaid', label: 'Interest', align: 'right', type: 'amount', minWidth: 120, colorFn: () => '#d97706' },
  { key: 'total_repaid', label: 'Total Repaid', align: 'right', type: 'amount', bold: true, minWidth: 140, colorFn: () => '#ef4444' },
];

const transactionColumns = [
  { key: 'date', label: 'Date', minWidth: 110, render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—' },
  { key: 'label', label: 'Category', minWidth: 150,
    render: (v) => <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: '#fef2f2', color: '#ef4444' }}>{v}</span> },
  { key: 'amount', label: 'Amount', align: 'right', type: 'amount', bold: true, minWidth: 130, colorFn: () => '#ef4444' },
  { key: 'mode', label: 'Mode', minWidth: 90,
    render: (v) => <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: v === 'cash' ? '#fffbeb' : '#eff6ff', color: v === 'cash' ? '#d97706' : '#2563eb' }}>{(v || '').toUpperCase()}</span> },
];

const ExpenseReports = () => {
  const [period, setPeriod] = useState('month');
  const defaultRange = periodToRange('month');
  const [filters, setFilters] = useState(defaultRange);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [tabData, setTabData] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [debugError, setDebugError] = useState(null);

  const range = period === 'custom' ? filters : periodToRange(period);

  const fetchSummary = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/reports/expense/summary?from=${r.from}&to=${r.to}`);
      const json = await res.json();
      setSummaryData(json);
      setDebugError(json.error || null);
    } catch (e) { console.error(e); setDebugError(e.message); }
    setLoading(false);
  }, []);

  const fetchTabData = useCallback(async (tab, r) => {
    const endpoints = {
      salary: '/reports/expense/salary',
      purchases: '/reports/expense/purchases',
      loans: '/reports/expense/loans',
      transactions: '/reports/expense/transactions',
    };
    if (!endpoints[tab]) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${endpoints[tab]}?from=${r.from}&to=${r.to}`);
      const json = await res.json();
      setTabData(prev => ({ ...prev, [tab]: json.data || [] }));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSummary(range); }, [period, filters.from, filters.to]); // eslint-disable-line
  useEffect(() => { fetchTabData(activeTab, range); }, [activeTab, period, filters.from, filters.to]); // eslint-disable-line

  const summary = summaryData?.summary || {};
  const categoryBreakdown = summaryData?.category_breakdown || [];
  const dailyTrend = summaryData?.daily_trend || [];

  const kpiCards = [
    {
      label: 'Total Expenses',
      value: summary.total_expenses || 0,
      color: '#ef4444', border: '#fecaca',
      subtext: summary.change_direction === 'up'
        ? `↑ ${summary.change_percent}% vs last period`
        : `↓ ${Math.abs(summary.change_percent || 0)}% vs last period`,
    },
    { label: 'Cash Outflow', value: summary.cash_outflow || 0, color: '#d97706', border: '#fde68a',
      subtext: summary.total_expenses > 0 ? `${((summary.cash_outflow / summary.total_expenses) * 100).toFixed(0)}% of total` : '' },
    { label: 'Bank Outflow', value: summary.bank_outflow || 0, color: '#2563eb', border: '#bfdbfe',
      subtext: summary.total_expenses > 0 ? `${((summary.bank_outflow / summary.total_expenses) * 100).toFixed(0)}% of total` : '' },
    { label: 'Transactions', value: summary.transaction_count || 0, color: '#7c3aed', border: '#ddd6fe', isRatio: true, subtext: 'Total entries' },
    { label: 'Avg / Day', value: (summary.total_expenses || 0) / Math.max(1, dailyTrend.length || 1), color: '#16a34a', border: '#bbf7d0', subtext: 'Daily burn rate' },
  ];

  return (
    <ReportShell
      title="Expense Reports"
      subtitle="Complete breakdown of where every rupee went"
      breadcrumb={[
        { label: 'Home', path: '/dashboard' },
        { label: 'Reports', path: '/reports' },
        { label: 'Expense Reports' },
      ]}
    >
      {debugError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, fontWeight: 600 }}>
          Server error: {debugError}
        </div>
      )}

      {/* Period presets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${period === p.key ? '#ef4444' : '#e2e8f0'}`,
              background: period === p.key ? '#ef4444' : '#fff',
              color: period === p.key ? '#fff' : '#64748b', cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => { fetchSummary(range); fetchTabData(activeTab, range); }}
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {period === 'custom' && (
        <FilterBar
          filters={[{ key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
          values={filters} onChange={setFilters}
          onApply={() => { fetchSummary(filters); fetchTabData(activeTab, filters); }}
          onReset={() => setFilters(defaultRange)}
        />
      )}

      <KPIGrid cards={kpiCards} />

      {/* Tab bar */}
      <div className="report-tabs" style={{ overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
            color: activeTab === t.id ? '#ef4444' : '#6b7280',
            borderBottom: activeTab === t.id ? '2px solid #ef4444' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>Where the Money Went</div>
            {categoryBreakdown.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 32 }}>
                {loading ? 'Loading…' : 'No expense data for this period'}
              </div>
            )}
            {categoryBreakdown.map((cat, i) => (
              <div key={i} style={{ marginBottom: 14, cursor: 'pointer' }}
                onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{cat.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>({cat.transaction_count} txns)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{fmt(cat.total_amount)}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{cat.percentage}%</span>
                  </div>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${cat.percentage}%`, background: cat.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                {expandedCategory === cat.category && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>Avg / txn: {fmt(cat.avg_amount)}</span>
                    <span>Min: {fmt(cat.min_amount)}</span>
                    <span>Max: {fmt(cat.max_amount)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <ChartCard title="Daily Expense Trend" height={300}>
            {dailyTrend.length > 0 ? (
              <BarChart data={dailyTrend} margin={{ left: 10, right: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => new Date(d).getDate()} />
                <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 10 }} />
                <Tooltip formatter={tooltipFormatter} labelFormatter={(d) => formatDate(d)} />
                <Bar dataKey="total" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No daily data</div>
            )}
          </ChartCard>
        </div>
      )}

      {/* By Category */}
      {activeTab === 'categories' && (
        <DataTable
          columns={categoryColumns}
          data={categoryBreakdown}
          loading={loading}
          emptyText="No expense data for this period"
          summary={{ label: 'TOTAL', transaction_count: categoryBreakdown.reduce((s, c) => s + c.transaction_count, 0), total_amount: summary.total_expenses }}
        />
      )}

      {/* Day by Day */}
      {activeTab === 'daily' && (
        <DataTable columns={dailyColumns} data={dailyTrend} loading={loading} emptyText="No daily data for this period" />
      )}

      {/* Salary & Wages */}
      {activeTab === 'salary' && (
        <DataTable columns={salaryColumns} data={tabData.salary || []} loading={loading} emptyText="No salary/wage payments in this period" />
      )}

      {/* Purchase Payments */}
      {activeTab === 'purchases' && (
        <DataTable columns={purchaseColumns} data={tabData.purchases || []} loading={loading} emptyText="No purchase bills in this period" />
      )}

      {/* Loan Payments */}
      {activeTab === 'loans' && (
        <DataTable columns={loanColumns} data={tabData.loans || []} loading={loading} emptyText="No loan repayments in this period" />
      )}

      {/* All Transactions */}
      {activeTab === 'transactions' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{(tabData.transactions || []).length} transactions</span>
            <ExportButtons data={tabData.transactions || []} filename={`expenses-${range.from}-to-${range.to}`} />
          </div>
          <DataTable columns={transactionColumns} data={tabData.transactions || []} loading={loading} emptyText="No transactions in this period" />
        </>
      )}
    </ReportShell>
  );
};

export default ExpenseReports;
