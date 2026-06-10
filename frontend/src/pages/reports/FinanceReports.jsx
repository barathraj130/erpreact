import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { apiFetch } from '../../utils/api';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ReportTable from '../../components/reports/ReportTable';
import ChartCard from '../../components/reports/ChartCard';
import FilterBar from '../../components/reports/FilterBar';
import ExportButtons from '../../components/reports/ExportButtons';

const fmt = v => Number(v || 0).toLocaleString('en-IN');
const nowMonth = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { from: `${now.getFullYear()}-${m}-01`, to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
};

const TABS = ['Fund Flow', 'Profitability', 'Financial Ratios', 'Budget vs Actual'];

const PROFIT_COLORS = { income: '#10b981', expense: '#ef4444', subtotal: '#6366f1', total: '#0ea5e9' };

const FinanceReports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [summary, setSummary] = useState({});
  const defaults = nowMonth();
  const [filters, setFilters] = useState({ from: defaults.from, to: defaults.to });

  const fetchTab = useCallback(async (tab, f) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(f).toString();
      const endpoints = {
        0: `/reports/finance/fund-flow?${qs}`,
        1: `/reports/finance/profitability?${qs}`,
        2: `/reports/finance/ratios?${qs}`,
        3: `/reports/finance/budget-vs-actual?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`,
      };
      const res = await apiFetch(endpoints[tab]);
      if (res.ok) {
        const json = await res.json();
        setData(prev => ({ ...prev, [tab]: json.data || [] }));
        setSummary(prev => ({ ...prev, [tab]: json.summary || {} }));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTab(activeTab, filters); }, [activeTab, fetchTab]);

  const tabData = data[activeTab] || [];
  const tabSummary = summary[activeTab] || {};

  const renderKPIs = () => {
    if (activeTab === 0) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Total Inflow" value={'₹' + fmt(tabSummary.total_inflow)} color="#10b981" prefix="" />
        <KPICard label="Total Outflow" value={'₹' + fmt(tabSummary.total_outflow)} color="#ef4444" prefix="" />
        <KPICard label="Net Flow" value={'₹' + fmt(tabSummary.net_flow)} color="#6366f1" prefix="" trend={tabSummary.net_flow > 0 ? 'up' : 'down'} />
      </div>
    );
    if (activeTab === 1) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Revenue" value={'₹' + fmt(tabSummary.revenue)} color="#10b981" prefix="" />
        <KPICard label="Gross Profit" value={'₹' + fmt(tabSummary.gross_profit)} color="#6366f1" prefix="" />
        <KPICard label="Net Profit" value={'₹' + fmt(tabSummary.net_profit)} color={tabSummary.net_profit > 0 ? '#10b981' : '#ef4444'} prefix="" trend={tabSummary.net_profit > 0 ? 'up' : 'down'} />
        <KPICard label="Gross Margin" value={tabSummary.gross_margin + '%'} color="#6366f1" prefix="" />
      </div>
    );
    return null;
  };

  const renderChart = () => {
    if (tabData.length === 0) return null;
    if (activeTab === 0) return (
      <ChartCard title="Fund Flow Analysis" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Legend />
            <Bar dataKey="amount" name="Amount" radius={[4,4,0,0]}>
              {tabData.map((entry, idx) => (
                <Cell key={idx} fill={entry.type === 'inflow' ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 1) return (
      <ChartCard title="Profitability Breakdown" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.filter(d => d.type !== 'expense' || d.label !== 'Operating Expenses')} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '₹' + Number(Math.abs(v)).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(Math.abs(v))} />
            <Bar dataKey="value" name="Amount" radius={[4,4,0,0]}>
              {tabData.map((entry, idx) => (
                <Cell key={idx} fill={PROFIT_COLORS[entry.type] || '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 3) return (
      <ChartCard title="Budget vs Actual" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Legend />
            <Bar dataKey="budget" fill="#c7d2fe" name="Budget" radius={[4,4,0,0]} />
            <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    return null;
  };

  const COLUMNS = [
    [
      { key: 'category', label: 'Category' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', type: 'amount', align: 'right' },
    ],
    [
      { key: 'label', label: 'Item' },
      { key: 'type', label: 'Type' },
      { key: 'value', label: 'Amount', type: 'amount', align: 'right' },
    ],
    [
      { key: 'ratio', label: 'Financial Ratio' },
      { key: 'value', label: 'Value', align: 'right' },
      { key: 'description', label: 'Description' },
    ],
    [
      { key: 'category', label: 'Category' },
      { key: 'budget', label: 'Budget', type: 'amount', align: 'right' },
      { key: 'actual', label: 'Actual', type: 'amount', align: 'right' },
      { key: 'variance', label: 'Variance', type: 'amount', align: 'right' },
      { key: 'variance_pct', label: 'Variance %', align: 'right' },
    ],
  ];

  return (
    <ReportShell
      title="Finance Reports"
      subtitle="Cash flow, profitability, financial ratios and budget tracking"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Finance' }]}
    >
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#3b82f6' : '#6b7280', borderBottom: activeTab === i ? '2px solid #3b82f6' : '2px solid transparent', transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {[0, 1, 2].includes(activeTab) && (
        <FilterBar
          filters={[{ key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
          values={filters} onChange={setFilters}
          onApply={() => fetchTab(activeTab, filters)}
          onReset={() => { setFilters(defaults); fetchTab(activeTab, defaults); }}
        />
      )}

      {renderKPIs()}
      <div style={{ marginBottom: '20px' }}>{renderChart()}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Detail View</h3>
        <ExportButtons data={tabData} filename={`finance-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={tabData} loading={loading} />
    </ReportShell>
  );
};

export default FinanceReports;
