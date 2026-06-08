import React, { useEffect, useState, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

const TABS = ['GST Audit', 'Tax Liability', 'Collection Trend'];

const GSTReports = () => {
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
        0: `/reports/gst/audit?${qs}`,
        1: `/reports/gst/tax-liability?${qs}`,
        2: `/reports/gst/collection-trend?year=${new Date().getFullYear()}`,
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
        <KPICard label="Total Invoices" value={tabSummary.total_invoices || 0} color="#f59e0b" prefix="" />
        <KPICard label="CGST" value={'₹' + fmt(tabSummary.total_cgst)} color="#6366f1" prefix="" />
        <KPICard label="SGST" value={'₹' + fmt(tabSummary.total_sgst)} color="#6366f1" prefix="" />
        <KPICard label="Total GST" value={'₹' + fmt(tabSummary.total_gst)} color="#ef4444" prefix="" />
      </div>
    );
    if (activeTab === 1) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Output GST" value={'₹' + fmt(tabSummary.total_output)} color="#ef4444" prefix="" />
        <KPICard label="Input Tax Credit" value={'₹' + fmt(tabSummary.total_input)} color="#10b981" prefix="" />
        <KPICard label="Net Liability" value={'₹' + fmt(tabSummary.net_liability)} color={tabSummary.net_liability > 0 ? '#ef4444' : '#10b981'} prefix="" />
      </div>
    );
    return null;
  };

  const renderChart = () => {
    if (tabData.length === 0) return null;
    if (activeTab === 1) return (
      <ChartCard title="GST Liability by Type" height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="tax_type" tick={{ fontSize: 13 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Legend />
            <Bar dataKey="output" fill="#ef4444" name="Output Tax" radius={[4,4,0,0]} />
            <Bar dataKey="input" fill="#10b981" name="Input Credit" radius={[4,4,0,0]} />
            <Bar dataKey="net_liability" fill="#6366f1" name="Net Liability" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 2) return (
      <ChartCard title="GST Collection Trend" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={tabData} margin={{ left: 20, right: 20 }}>
            <defs>
              <linearGradient id="gstGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
            <Tooltip formatter={v => '₹' + fmt(v)} />
            <Legend />
            <Area type="monotone" dataKey="cgst" stroke="#6366f1" fill="none" name="CGST" strokeWidth={2} />
            <Area type="monotone" dataKey="sgst" stroke="#10b981" fill="none" name="SGST" strokeWidth={2} />
            <Area type="monotone" dataKey="total_gst" stroke="#f59e0b" fill="url(#gstGrad)" name="Total GST" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    return null;
  };

  const COLUMNS = [
    [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'invoice_no', label: 'Invoice No' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'cgst', label: 'CGST', type: 'amount', align: 'right' },
      { key: 'sgst', label: 'SGST', type: 'amount', align: 'right' },
      { key: 'igst', label: 'IGST', type: 'amount', align: 'right' },
      { key: 'total_gst', label: 'Total GST', type: 'amount', align: 'right' },
    ],
    [
      { key: 'tax_type', label: 'Tax Type' },
      { key: 'output', label: 'Output Tax', type: 'amount', align: 'right' },
      { key: 'input', label: 'Input Credit', type: 'amount', align: 'right' },
      { key: 'net_liability', label: 'Net Liability', type: 'amount', align: 'right' },
    ],
    [
      { key: 'month', label: 'Month' },
      { key: 'cgst', label: 'CGST', type: 'amount', align: 'right' },
      { key: 'sgst', label: 'SGST', type: 'amount', align: 'right' },
      { key: 'igst', label: 'IGST', type: 'amount', align: 'right' },
      { key: 'total_gst', label: 'Total GST', type: 'amount', align: 'right' },
    ],
  ];

  return (
    <ReportShell
      title="GST Reports"
      subtitle="GST audit trail, tax liability and collection trends"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'GST' }]}
    >
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#f59e0b' : '#6b7280', borderBottom: activeTab === i ? '2px solid #f59e0b' : '2px solid transparent', transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {[0, 1].includes(activeTab) && (
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
        <ExportButtons data={tabData} filename={`gst-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={tabData} loading={loading} />
    </ReportShell>
  );
};

export default GSTReports;
