import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatDate, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import FilterBar from '../../components/reports/FilterBar';
import ChartCard from '../../components/reports/ChartCard';
import { KPIGrid } from '../../components/reports/FinanceRow';

// Self-contained "where does revenue come from" overview — the inflow
// mirror of ExpenseReports.jsx's Overview tab (same period presets, same
// KPI/category-breakdown/daily-trend layout, green instead of red). Kept as
// its own component with its own period state, separate from the rest of
// Sales Reports' tab/filter machinery, since its data shape (summary +
// category_breakdown + daily_trend) doesn't match the other tabs' plain
// data/summary rows.

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
  return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
};

const SalesOverviewTab = () => {
  const [period, setPeriod] = useState('month');
  const defaultRange = periodToRange('month');
  const [filters, setFilters] = useState(defaultRange);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [debugError, setDebugError] = useState(null);

  const range = period === 'custom' ? filters : periodToRange(period);

  const fetchSummary = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/reports/sales/summary?from=${r.from}&to=${r.to}`);
      const json = await res.json();
      setSummaryData(json);
      setDebugError(json.error || null);
    } catch (e) { console.error(e); setDebugError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSummary(range); }, [period, filters.from, filters.to]); // eslint-disable-line

  const summary = summaryData?.summary || {};
  const categoryBreakdown = summaryData?.category_breakdown || [];
  const dailyTrend = summaryData?.daily_trend || [];

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: summary.total_revenue || 0,
      color: '#059669', border: '#a7f3d0',
      subtext: summary.change_direction === 'up'
        ? `↑ ${summary.change_percent}% vs last period`
        : `↓ ${Math.abs(summary.change_percent || 0)}% vs last period`,
    },
    { label: 'Cash Inflow', value: summary.cash_inflow || 0, color: '#d97706', border: '#fde68a',
      subtext: summary.total_revenue > 0 ? `${((summary.cash_inflow / summary.total_revenue) * 100).toFixed(0)}% of total` : '' },
    { label: 'Bank Inflow', value: summary.bank_inflow || 0, color: '#2563eb', border: '#bfdbfe',
      subtext: summary.total_revenue > 0 ? `${((summary.bank_inflow / summary.total_revenue) * 100).toFixed(0)}% of total` : '' },
    { label: 'Transactions', value: summary.transaction_count || 0, color: '#7c3aed', border: '#ddd6fe', isRatio: true, subtext: 'Total entries' },
    { label: 'Avg / Day', value: (summary.total_revenue || 0) / Math.max(1, dailyTrend.length || 1), color: '#16a34a', border: '#bbf7d0', subtext: 'Daily revenue rate' },
  ];

  return (
    <div>
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
              border: `1.5px solid ${period === p.key ? '#059669' : '#e2e8f0'}`,
              background: period === p.key ? '#059669' : '#fff',
              color: period === p.key ? '#fff' : '#64748b', cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => fetchSummary(range)}
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {period === 'custom' && (
        <FilterBar
          filters={[{ key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
          values={filters} onChange={setFilters}
          onApply={() => fetchSummary(filters)}
          onReset={() => setFilters(defaultRange)}
        />
      )}

      <KPIGrid cards={kpiCards} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>Where the Revenue Comes From</div>
          {categoryBreakdown.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 32 }}>
              {loading ? 'Loading…' : 'No revenue data for this period'}
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

        <ChartCard title="Daily Revenue Trend" height={300}>
          {dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend} margin={{ left: 10, right: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => new Date(d).getDate()} />
                <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 10 }} />
                <Tooltip formatter={tooltipFormatter} labelFormatter={(d) => formatDate(d)} />
                <Bar dataKey="total" fill="#059669" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No daily data</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default SalesOverviewTab;
