import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatINR, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
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

const TABS = ['Productivity', 'Attendance Trends', 'Salary Cost'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6'];

const HRReports = () => {
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
        0: `/reports/hr/productivity?${qs}`,
        1: `/reports/hr/attendance-trends?${qs}`,
        2: `/reports/hr/salary-cost?${qs}`,
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
        <KPICard label="Total Employees" value={String(tabSummary.total_employees || 0)} color="#6366f1" isAmount={false} />
        <KPICard label="Avg Attendance" value={String((tabSummary.avg_attendance || 0) + '%')} color="#10b981" isAmount={false} />
      </div>
    );
    if (activeTab === 2) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KPICard label="Monthly Salary" value={tabSummary.total_monthly_salary || 0} color="#6366f1" isAmount={true} />
        <KPICard label="Daily Wages" value={tabSummary.total_daily_wages || 0} color="#f59e0b" isAmount={true} />
        <KPICard label="Total Cost" value={tabSummary.total_cost || 0} color="#ef4444" isAmount={true} />
      </div>
    );
    return null;
  };

  const renderChart = () => {
    if (tabData.length === 0) return null;
    if (activeTab === 0) return (
      <ChartCard title="Employee Attendance %" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tabData.slice(0, 15)} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => v + '%'} />
            <YAxis dataKey="employee_name" type="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip formatter={v => v + '%'} />
            <Bar dataKey="attendance_pct" fill="#6366f1" name="Attendance %" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 1) return (
      <ChartCard title="Weekly Attendance Trends" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tabData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => v + '%'} />
            <Tooltip formatter={v => v + '%'} />
            <Legend />
            <Line type="monotone" dataKey="attendance_rate" stroke="#6366f1" name="Attendance Rate" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
    if (activeTab === 2) {
      const deptData = tabData.reduce((acc, row) => {
        const dept = row.department || 'General';
        if (!acc[dept]) acc[dept] = { department: dept, salary: 0 };
        acc[dept].salary += parseFloat(row.salary_paid || 0);
        return acc;
      }, {});
      const pieData = Object.values(deptData);
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <ChartCard title="Salary by Department" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="salary" nameKey="department" cx="50%" cy="50%" outerRadius={100} label={e => e.department}>
                  {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top Earners" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tabData.slice(0, 8)} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={yAxisFormatter} />
                <YAxis dataKey="employee_name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar dataKey="salary_paid" fill="#6366f1" name="Salary" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      );
    }
    return null;
  };

  const productivityCols = [
    { key: 'employee_name', label: 'Employee', wrap: true },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'days_present', label: 'Present', align: 'right', colorFn: () => '#065f46' },
    { key: 'total_days', label: 'Total Days', align: 'right' },
    { key: 'attendance_pct', label: 'Attendance %', align: 'right', render: v => parseFloat(v||0).toFixed(1) + '%', colorFn: v => parseFloat(v) >= 90 ? '#10b981' : parseFloat(v) >= 75 ? '#f59e0b' : '#ef4444' },
  ];

  const attendanceTrendCols = [
    { key: 'period', label: 'Week' },
    { key: 'present_count', label: 'Present', align: 'right', colorFn: () => '#065f46' },
    { key: 'absent_count', label: 'Absent', align: 'right', colorFn: v => parseFloat(v) > 3 ? '#dc2626' : '#374151' },
    { key: 'attendance_rate', label: 'Rate %', align: 'right', render: v => parseFloat(v||0).toFixed(1) + '%', colorFn: v => parseFloat(v) >= 90 ? '#10b981' : parseFloat(v) >= 75 ? '#f59e0b' : '#ef4444' },
  ];

  const salaryCols = [
    { key: 'employee_name', label: 'Employee', wrap: true },
    { key: 'department', label: 'Department' },
    { key: 'salary_paid', label: 'Salary Paid', type: 'amount', align: 'right', render: v => formatINR(v) },
    { key: 'payment_count', label: 'Payments', align: 'right' },
  ];

  const COLUMNS = [productivityCols, attendanceTrendCols, salaryCols];

  return (
    <ReportShell
      title="HR Reports"
      subtitle="Employee productivity, attendance trends and salary analysis"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'HR' }]}
    >
      <div className="report-tabs">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#ef4444' : '#6b7280', borderBottom: activeTab === i ? '2px solid #ef4444' : '2px solid transparent', transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      <FilterBar
        filters={[{ key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        values={filters} onChange={setFilters}
        onApply={() => fetchTab(activeTab, filters)}
        onReset={() => { setFilters(defaults); fetchTab(activeTab, defaults); }}
      />

      {renderKPIs()}
      <div style={{ marginBottom: '20px' }}>{renderChart()}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Detail View</h3>
        <ExportButtons data={tabData} filename={`hr-${TABS[activeTab].toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      <ReportTable columns={COLUMNS[activeTab] || []} data={tabData} loading={loading} />
    </ReportShell>
  );
};

export default HRReports;
