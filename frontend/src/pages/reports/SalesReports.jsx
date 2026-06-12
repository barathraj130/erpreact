import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatINR, formatDate, formatNum, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ReportTable from '../../components/reports/ReportTable';
import ChartCard from '../../components/reports/ChartCard';
import FilterBar from '../../components/reports/FilterBar';
import ExportButtons from '../../components/reports/ExportButtons';

const nowMonth = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { from: `${now.getFullYear()}-${m}-01`, to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
};

const TABS = ['Top Customers', 'Sales Trend', 'Aging Receivables', 'Monthly Growth', 'Product Performance'];

const SalesReports = () => {
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
        0: `/reports/sales/top-customers?${qs}&limit=10`,
        1: `/reports/sales/trend?${qs}&group_by=month`,
        2: `/reports/sales/aging-receivables`,
        3: `/reports/sales/monthly-growth?year=${new Date().getFullYear()}`,
        4: `/reports/sales/product-performance?${qs}`,
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

  useEffect(() => {
    fetchTab(activeTab, filters);
  }, [activeTab, fetchTab]);

  const tabData = data[activeTab] || [];
  const tabSummary = summary[activeTab] || {};

  // Pre-process data to add rank for top customers and product performance
  const rankedData = (activeTab === 0 || activeTab === 4)
    ? tabData.map((r, i) => ({ ...r, rank: i + 1 }))
    : tabData;

  const renderKPIs = () => {
    if (activeTab === 0) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Total Customers" value={String(tabSummary.total_customers || 0)} color="#6366f1" isAmount={false} />
        <KPICard label="Total Revenue" value={tabSummary.total_revenue || 0} color="#10b981" isAmount={true} />
      </div>
    );
    if (activeTab === 2) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Total Outstanding" value={tabSummary.total_outstanding || 0} color="#ef4444" isAmount={true} />
        <KPICard label="0-30 days" value={tabSummary.days_0_30 || 0} color="#10b981" isAmount={true} />
        <KPICard label="31-60 days" value={tabSummary.days_31_60 || 0} color="#f59e0b" isAmount={true} />
        <KPICard label="90+ days" value={tabSummary.days_90_plus || 0} color="#ef4444" isAmount={true} />
      </div>
    );
    return null;
  };

  const renderChart = () => {
    if (tabData.length === 0) return null;

    if (activeTab === 0) return (
      <ChartCard title="Top 10 Customers by Revenue" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="customer_name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={yAxisFormatter} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="total_sales" fill="#6366f1" radius={[4,4,0,0]} name="Total Sales" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );

    if (activeTab === 1) return (
      <ChartCard title="Sales Trend" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={tabData} margin={{ left: 20, right: 20 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={yAxisFormatter} />
            <Tooltip formatter={tooltipFormatter} />
            <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#colorRev)" name="Revenue" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    );

    if (activeTab === 2) return (
      <ChartCard title="Aging Receivables by Bucket" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 10)} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="customer_name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={yAxisFormatter} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="days_0_30" fill="#10b981" name="0-30 days" stackId="a" />
            <Bar dataKey="days_31_60" fill="#f59e0b" name="31-60 days" stackId="a" />
            <Bar dataKey="days_61_90" fill="#f97316" name="61-90 days" stackId="a" />
            <Bar dataKey="days_90_plus" fill="#ef4444" name="90+ days" stackId="a" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );

    if (activeTab === 3) return (
      <ChartCard title={`Monthly Growth ${new Date().getFullYear()}`} height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={yAxisFormatter} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4,4,0,0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );

    if (activeTab === 4) return (
      <ChartCard title="Product Performance by Revenue" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tickFormatter={yAxisFormatter} />
            <YAxis dataKey="product_name" type="category" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="revenue" fill="#6366f1" name="Revenue" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );

    return null;
  };

  const topCustomerCols = [
    { key: 'rank', label: 'Rank', width: '6%', align: 'center' },
    { key: 'customer_name', label: 'Customer', wrap: true },
    { key: 'invoice_count', label: 'Invoices', align: 'right' },
    { key: 'total_sales', label: 'Total Billed', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'total_paid', label: 'Total Paid', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: () => '#065f46' },
    { key: 'outstanding', label: 'Outstanding', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) > 0 ? '#dc2626' : '#065f46' },
    { key: 'last_purchase', label: 'Last Purchase', align: 'center', render: v => formatDate(v) },
  ];

  const trendCols = [
    { key: 'period', label: 'Period' },
    { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'invoice_count', label: 'Invoices', align: 'right' },
    { key: 'collected', label: 'Collected', type: 'amount', align: 'right', render: v => formatINR(v) },
  ];

  const agingCols = [
    { key: 'customer_name', label: 'Customer', wrap: true },
    { key: 'days_0_30', label: '0-30 Days', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) > 0 ? '#f59e0b' : '#9ca3af' },
    { key: 'days_31_60', label: '31-60 Days', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) > 0 ? '#f97316' : '#9ca3af' },
    { key: 'days_61_90', label: '61-90 Days', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) > 0 ? '#ef4444' : '#9ca3af' },
    { key: 'days_90_plus', label: '90+ Days', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) > 0 ? '#dc2626' : '#9ca3af' },
    { key: 'total_outstanding', label: 'Total Due', type: 'amount', align: 'right', bold: true, render: v => formatINR(v), colorFn: v => parseFloat(v) > 0 ? '#dc2626' : '#9ca3af' },
  ];

  const monthlyGrowthCols = [
    { key: 'month', label: 'Month' },
    { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'invoice_count', label: 'Invoices', align: 'right' },
  ];

  const productCols = [
    { key: 'rank', label: 'Rank', width: '6%', align: 'center' },
    { key: 'product_name', label: 'Product', wrap: true },
    { key: 'qty_sold', label: 'Qty Sold', align: 'right', render: v => formatNum(v) },
    { key: 'avg_price', label: 'Avg Rate', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right', bold: true, render: v => formatINR(v), colorFn: () => '#065f46' },
    { key: 'cost', label: 'Cost', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'profit', label: 'Profit', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) >= 0 ? '#065f46' : '#dc2626' },
    { key: 'margin_pct', label: 'Margin %', align: 'right', render: v => parseFloat(v || 0).toFixed(1) + '%' },
  ];

  const COLUMNS = [topCustomerCols, trendCols, agingCols, monthlyGrowthCols, productCols];

  return (
    <ReportShell
      title="Sales Reports"
      subtitle="Analyze sales performance, customer behavior and revenue trends"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Sales' }]}
    >
      {/* Tabs */}
      <div className="report-tabs">
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`report-tab-btn${activeTab === i ? ' report-tab-btn-active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters (for tabs that support date range) */}
      {[0, 1, 4].includes(activeTab) && (
        <FilterBar
          filters={[
            { key: 'from', label: 'From', type: 'date' },
            { key: 'to', label: 'To', type: 'date' },
          ]}
          values={filters}
          onChange={setFilters}
          onApply={() => fetchTab(activeTab, filters)}
          onReset={() => { setFilters(defaults); fetchTab(activeTab, defaults); }}
        />
      )}

      {/* KPIs */}
      {renderKPIs()}

      {/* Chart */}
      <div style={{ marginBottom: '20px' }}>
        {renderChart()}
      </div>

      {/* Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Detail View</h3>
        <ExportButtons data={rankedData} filename={`sales-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={rankedData} loading={loading} />
    </ReportShell>
  );
};

export default SalesReports;
