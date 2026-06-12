import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatINR, formatNum, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ReportTable from '../../components/reports/ReportTable';
import ChartCard from '../../components/reports/ChartCard';
import ExportButtons from '../../components/reports/ExportButtons';

const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };

const TABS = ['ABC Analysis', 'Fast Moving', 'Slow Moving', 'Reorder Alerts'];

const InventoryReports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [summary, setSummary] = useState({});

  const fetchTab = useCallback(async (tab) => {
    setLoading(true);
    try {
      const now = new Date();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const from = `${now.getFullYear()}-${m}-01`;
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const endpoints = {
        0: '/reports/inventory/abc-analysis',
        1: `/reports/inventory/fast-moving?from=${from}&to=${to}&limit=20`,
        2: '/reports/inventory/slow-moving?days=90',
        3: '/reports/inventory/reorder-alerts',
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

  useEffect(() => { fetchTab(activeTab); }, [activeTab, fetchTab]);

  const tabData = data[activeTab] || [];
  const tabSummary = summary[activeTab] || {};

  const renderKPIs = () => {
    if (activeTab === 0) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Class A (80% revenue)" value={String(tabSummary.a_count || 0)} color="#10b981" isAmount={false} />
        <KPICard label="Class B" value={String(tabSummary.b_count || 0)} color="#f59e0b" isAmount={false} />
        <KPICard label="Class C" value={String(tabSummary.c_count || 0)} color="#ef4444" isAmount={false} />
      </div>
    );
    if (activeTab === 2) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Slow Items" value={String(tabSummary.total_items || 0)} color="#f59e0b" isAmount={false} />
        <KPICard label="Value at Risk" value={tabSummary.total_value || 0} color="#ef4444" isAmount={true} />
      </div>
    );
    if (activeTab === 3) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Out of Stock" value={String(tabSummary.out_of_stock || 0)} color="#ef4444" isAmount={false} />
        <KPICard label="Critical" value={String(tabSummary.critical || 0)} color="#f59e0b" isAmount={false} />
        <KPICard label="Low Stock" value={String(tabSummary.low || 0)} color="#6366f1" isAmount={false} />
      </div>
    );
    return null;
  };

  const renderChart = () => {
    if (tabData.length === 0) return null;
    if (activeTab === 0) {
      const top20 = tabData.slice(0, 20);
      return (
        <ChartCard title="ABC Pareto Analysis (Top 20 Products)" height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={top20} margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="product_name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tickFormatter={yAxisFormatter} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => v + '%'} domain={[0, 100]} />
              <Tooltip formatter={(v, name) => name === 'Cumulative %' ? v + '%' : tooltipFormatter(v)[0]} />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                {top20.map((entry, idx) => (
                  <Cell key={idx} fill={ABC_COLORS[entry.abc_class] || '#6366f1'} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cumulative_pct" stroke="#6366f1" name="Cumulative %" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    if (activeTab === 1) return (
      <ChartCard title="Fast Moving Products" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" />
            <YAxis dataKey="product_name" type="category" tick={{ fontSize: 11 }} width={80} />
            <Tooltip />
            <Bar dataKey="qty_sold" fill="#10b981" name="Qty Sold" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 3) return (
      <ChartCard title="Reorder Alert Levels" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 10)} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="product_name" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="current_stock" name="Current Stock" fill="#6366f1" />
            <Bar dataKey="min_stock_level" name="Min Level" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    return null;
  };

  const abcCols = [
    { key: 'product_name', label: 'Product', wrap: true },
    { key: 'abc_class', label: 'Class', align: 'center', render: v => {
      const colors = { A: ['#dcfce7','#166534'], B: ['#fef3c7','#92400e'], C: ['#fee2e2','#dc2626'] };
      const [bg, c] = colors[v] || colors.C;
      return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color: c }}>{v || '—'}</span>;
    }},
    { key: 'qty_sold', label: 'Qty Sold', align: 'right', render: v => formatNum(v) },
    { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'revenue_pct', label: 'Rev %', align: 'right', render: v => parseFloat(v||0).toFixed(1) + '%' },
    { key: 'cumulative_pct', label: 'Cumulative %', align: 'right', render: v => parseFloat(v||0).toFixed(1) + '%' },
  ];

  const fastMovingCols = [
    { key: 'product_name', label: 'Product', wrap: true },
    { key: 'qty_sold', label: 'Qty Sold', align: 'right', render: v => formatNum(v) },
    { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'order_count', label: 'Orders', align: 'right' },
    { key: 'current_stock', label: 'Stock', align: 'right', render: v => formatNum(v) },
  ];

  const slowMovingCols = [
    { key: 'product_name', label: 'Product', wrap: true },
    { key: 'current_stock', label: 'Stock', align: 'right', render: v => formatNum(v) },
    { key: 'stock_value', label: 'Value', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'days_since_sale', label: 'Days Since Sale', align: 'right' },
    { key: 'last_sale_date', label: 'Last Sale', align: 'center', render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
  ];

  const reorderCols = [
    { key: 'product_name', label: 'Product', wrap: true },
    { key: 'min_stock_level', label: 'Min Level', align: 'right', render: v => formatNum(v) },
    { key: 'current_stock', label: 'Current Stock', align: 'right', render: v => formatNum(v), colorFn: v => parseFloat(v) === 0 ? '#dc2626' : '#f59e0b' },
    { key: 'alert_level', label: 'Alert', align: 'center', render: v => {
      const map = {
        OUT_OF_STOCK: ['OUT OF STOCK', '#fee2e2', '#dc2626'],
        CRITICAL: ['CRITICAL', '#fef3c7', '#92400e'],
        LOW: ['LOW', '#eff6ff', '#1e40af'],
      };
      const [label, bg, c] = map[v] || ['OK', '#f0fdf4', '#166534'];
      return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: c }}>{label}</span>;
    }},
    { key: 'cost_price', label: 'Cost Price', type: 'amount', align: 'right', render: v => formatINR(v) },
  ];

  const COLUMNS = [abcCols, fastMovingCols, slowMovingCols, reorderCols];
  const TAB_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <ReportShell
      title="Inventory Reports"
      subtitle="Stock analysis, movement tracking and reorder management"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Inventory' }]}
    >
      <div className="report-tabs">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? TAB_COLORS[i] : '#6b7280', borderBottom: activeTab === i ? `2px solid ${TAB_COLORS[i]}` : '2px solid transparent', transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {renderKPIs()}
      <div style={{ marginBottom: '20px' }}>{renderChart()}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Detail View</h3>
        <ExportButtons data={tabData} filename={`inventory-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={tabData} loading={loading} />
    </ReportShell>
  );
};

export default InventoryReports;
