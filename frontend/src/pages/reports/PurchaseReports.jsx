import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

const TABS = ['Vendor Performance', 'Payment Aging', 'Monthly Trend'];

const PurchaseReports = () => {
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
        0: `/reports/purchase/vendor-performance?${qs}`,
        1: `/reports/purchase/payment-aging`,
        2: `/reports/purchase/monthly-trend?${qs}`,
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
        <KPICard label="Vendors" value={tabSummary.total_vendors || 0} color="#10b981" prefix="" />
        <KPICard label="Total Purchased" value={'₹' + fmt(tabSummary.total_purchased)} color="#6366f1" prefix="" />
        <KPICard label="Total Outstanding" value={'₹' + fmt(tabSummary.total_outstanding)} color="#ef4444" prefix="" />
      </div>
    );
    if (activeTab === 1) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Total Payable" value={'₹' + fmt(tabSummary.total_payable)} color="#ef4444" prefix="" />
      </div>
    );
    return null;
  };

  const renderChart = () => {
    if (tabData.length === 0) return null;
    if (activeTab === 0) return (
      <ChartCard title="Vendor Performance" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 10)} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="vendor_name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Legend />
            <Bar dataKey="total_purchased" fill="#10b981" name="Total Purchased" />
            <Bar dataKey="outstanding" fill="#ef4444" name="Outstanding" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 1) return (
      <ChartCard title="Payment Aging by Vendor" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 10)} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="vendor_name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Legend />
            <Bar dataKey="days_0_30" fill="#10b981" name="0-30 Days" stackId="a" />
            <Bar dataKey="days_31_60" fill="#f59e0b" name="31-60 Days" stackId="a" />
            <Bar dataKey="days_60_plus" fill="#ef4444" name="60+ Days" stackId="a" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 2) return (
      <ChartCard title="Monthly Purchase Trend" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Bar dataKey="amount" fill="#10b981" radius={[4,4,0,0]} name="Amount" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    return null;
  };

  const COLUMNS = [
    [
      { key: 'vendor_name', label: 'Vendor' },
      { key: 'bill_count', label: 'Bills' },
      { key: 'total_purchased', label: 'Total Purchased', type: 'amount', align: 'right' },
      { key: 'total_paid', label: 'Paid', type: 'amount', align: 'right' },
      { key: 'outstanding', label: 'Outstanding', type: 'amount', align: 'right' },
      { key: 'last_purchase', label: 'Last Purchase', type: 'date' },
    ],
    [
      { key: 'vendor_name', label: 'Vendor' },
      { key: 'days_0_30', label: '0-30 Days', type: 'amount', align: 'right' },
      { key: 'days_31_60', label: '31-60 Days', type: 'amount', align: 'right' },
      { key: 'days_60_plus', label: '60+ Days', type: 'amount', align: 'right' },
      { key: 'total_outstanding', label: 'Total', type: 'amount', align: 'right' },
    ],
    [
      { key: 'period', label: 'Period' },
      { key: 'amount', label: 'Amount', type: 'amount', align: 'right' },
      { key: 'bill_count', label: 'Bills' },
    ],
  ];

  return (
    <ReportShell
      title="Purchase Reports"
      subtitle="Vendor analysis, payment tracking and purchase trends"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Purchase' }]}
    >
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#10b981' : '#6b7280', borderBottom: activeTab === i ? '2px solid #10b981' : '2px solid transparent', transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {[0, 2].includes(activeTab) && (
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
        <ExportButtons data={tabData} filename={`purchase-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={tabData} loading={loading} />
    </ReportShell>
  );
};

export default PurchaseReports;
