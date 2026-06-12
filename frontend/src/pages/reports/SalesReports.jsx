import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
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

  const renderKPIs = () => {
    if (activeTab === 0) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Total Customers" value={tabSummary.total_customers || 0} color="#6366f1" prefix="" />
        <KPICard label="Total Revenue" value={'₹' + fmt(tabSummary.total_revenue)} color="#10b981" prefix="" />
      </div>
    );
    if (activeTab === 2) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Total Outstanding" value={'₹' + fmt(tabSummary.total_outstanding)} color="#ef4444" prefix="" />
        <KPICard label="0-30 days" value={'₹' + fmt(tabSummary.days_0_30)} color="#10b981" prefix="" />
        <KPICard label="31-60 days" value={'₹' + fmt(tabSummary.days_31_60)} color="#f59e0b" prefix="" />
        <KPICard label="90+ days" value={'₹' + fmt(tabSummary.days_90_plus)} color="#ef4444" prefix="" />
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
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
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
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
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
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
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
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
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
            <XAxis type="number" tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <YAxis dataKey="product_name" type="category" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Bar dataKey="revenue" fill="#6366f1" name="Revenue" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );

    return null;
  };

  const COLUMNS = [
    [
      { key: 'customer_name', label: 'Customer' },
      { key: 'invoice_count', label: 'Invoices' },
      { key: 'total_sales', label: 'Total Sales', type: 'amount', align: 'right' },
      { key: 'total_paid', label: 'Paid', type: 'amount', align: 'right' },
      { key: 'outstanding', label: 'Outstanding', type: 'amount', align: 'right' },
      { key: 'last_purchase', label: 'Last Purchase', type: 'date' },
    ],
    [
      { key: 'period', label: 'Period' },
      { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right' },
      { key: 'invoice_count', label: 'Invoices' },
      { key: 'collected', label: 'Collected', type: 'amount', align: 'right' },
    ],
    [
      { key: 'customer_name', label: 'Customer' },
      { key: 'days_0_30', label: '0-30 Days', type: 'amount', align: 'right' },
      { key: 'days_31_60', label: '31-60 Days', type: 'amount', align: 'right' },
      { key: 'days_61_90', label: '61-90 Days', type: 'amount', align: 'right' },
      { key: 'days_90_plus', label: '90+ Days', type: 'amount', align: 'right' },
      { key: 'total_outstanding', label: 'Total', type: 'amount', align: 'right' },
    ],
    [
      { key: 'month', label: 'Month' },
      { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right' },
      { key: 'invoice_count', label: 'Invoices' },
    ],
    [
      { key: 'product_name', label: 'Product' },
      { key: 'qty_sold', label: 'Qty Sold' },
      { key: 'revenue', label: 'Revenue', type: 'amount', align: 'right' },
      { key: 'cost', label: 'Cost', type: 'amount', align: 'right' },
      { key: 'profit', label: 'Profit', type: 'amount', align: 'right' },
      { key: 'margin_pct', label: 'Margin %', align: 'right' },
    ],
  ];

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
        <ExportButtons data={tabData} filename={`sales-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={tabData} loading={loading} />
    </ReportShell>
  );
};

export default SalesReports;
