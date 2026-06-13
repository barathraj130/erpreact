import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatINR, formatDate, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ReportTable from '../../components/reports/ReportTable';
import ChartCard from '../../components/reports/ChartCard';
import FilterBar from '../../components/reports/FilterBar';

const nowMonth = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { from: `${now.getFullYear()}-${m}-01`, to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
};

const TABS = ['By Invoice', 'By Customer'];

const WAIVER_COLOR = '#f59e0b';
const OUTFLOW_COLOR = '#ef4444';

const DiscountReport = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [byCustomer, setByCustomer] = useState([]);
  const [summary, setSummary] = useState({});
  const defaults = nowMonth();
  const [filters, setFilters] = useState({ from: defaults.from, to: defaults.to });

  const fetchData = useCallback(async (f) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(f).toString();
      const res = await apiFetch(`/reports/discounts?${qs}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data?.rows || []);
        setByCustomer(json.data?.byCustomer || []);
        setSummary(json.summary || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(filters); }, [fetchData]);

  const invoiceCols = [
    { key: 'date',           label: 'Date',        width: '12%', render: v => formatDate(v) },
    { key: 'invoice_number', label: 'Invoice #',    width: '16%' },
    { key: 'customer_name',  label: 'Customer',     width: '22%', wrap: true },
    { key: 'total_amount',   label: 'Invoice Amt',  width: '17%', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'discount_amount',label: 'Waiver (₹)',   width: '16%', type: 'amount', align: 'right', render: v => formatINR(v),
      colorFn: () => WAIVER_COLOR },
    { key: 'discount_pct',   label: 'Waiver %',     width: '10%', align: 'right',
      render: v => `${parseFloat(v || 0).toFixed(1)}%`,
      colorFn: v => parseFloat(v) > 10 ? OUTFLOW_COLOR : WAIVER_COLOR },
    { key: 'notes',          label: 'Notes',        width: '7%', wrap: true },
  ];

  const customerCols = [
    { key: 'customer_name',  label: 'Customer',     width: '30%', wrap: true },
    { key: 'invoice_count',  label: 'Invoices',     width: '12%', align: 'right' },
    { key: 'total_billed',   label: 'Total Billed', width: '20%', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'total_discount', label: 'Total Waiver', width: '20%', type: 'amount', align: 'right', render: v => formatINR(v),
      colorFn: () => WAIVER_COLOR, bold: true },
    { key: 'discount_pct',   label: 'Waiver %',     width: '12%', align: 'right',
      render: v => `${parseFloat(v || 0).toFixed(1)}%`,
      colorFn: v => parseFloat(v) > 10 ? OUTFLOW_COLOR : WAIVER_COLOR },
  ];

  const chartData = byCustomer.slice(0, 10).map(r => ({
    name: r.customer_name?.split(' ')[0] || r.customer_name,
    waiver: parseFloat(r.total_discount || 0),
  }));

  return (
    <ReportShell
      title="Discount & Waiver Report"
      subtitle="Track all waivers, discounts and gifts given to customers"
      breadcrumb={[
        { label: 'Home', path: '/dashboard' },
        { label: 'Reports', path: '/reports' },
        { label: 'Discounts & Waivers' },
      ]}
    >
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Total Waived"     value={summary.total_discount || 0}  color={WAIVER_COLOR}  isAmount={true} />
        <KPICard label="Invoices with Waiver" value={String(summary.invoice_count || 0)} color="#6366f1" isAmount={false} />
        <KPICard label="Customers Affected"   value={String(summary.customer_count || 0)} color="#8b5cf6" isAmount={false} />
        <KPICard label="Avg Waiver %"    value={`${summary.avg_discount_pct || '0'}%`}   color={OUTFLOW_COLOR} isAmount={false} />
      </div>

      {/* Filter */}
      <FilterBar
        filters={[{ key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        values={filters} onChange={setFilters}
        onApply={() => fetchData(filters)}
        onReset={() => { setFilters(defaults); fetchData(defaults); }}
      />

      {/* Chart */}
      {chartData.length > 0 && (
        <ChartCard title="Top 10 Customers by Waiver Amount" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="waiver" name="Waiver" fill={WAIVER_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Tabs */}
      <div className="report-tabs" style={{ marginTop: 8 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#f59e0b' : '#6b7280',
              borderBottom: activeTab === i ? '2px solid #f59e0b' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <ReportTable
        columns={activeTab === 0 ? invoiceCols : customerCols}
        data={activeTab === 0 ? rows : byCustomer}
        loading={loading}
        emptyText="No waivers or discounts found for the selected period"
        summary={
          activeTab === 0
            ? { date: 'TOTAL', invoice_number: '', customer_name: '', total_amount: formatINR(summary.total_billed), discount_amount: formatINR(summary.total_discount), discount_pct: `${summary.avg_discount_pct || 0}%`, notes: '' }
            : { customer_name: 'TOTAL', invoice_count: summary.invoice_count, total_billed: formatINR(summary.total_billed), total_discount: formatINR(summary.total_discount), discount_pct: `${summary.avg_discount_pct || 0}%` }
        }
      />
    </ReportShell>
  );
};

export default DiscountReport;
