import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { apiFetch } from '../../utils/api';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ChartCard from '../../components/reports/ChartCard';

const fmt = v => Number(v || 0).toLocaleString('en-IN');

const ALERT_STYLES = {
  alert: { bg: '#fef2f2', border: '#fecaca', icon: '🔴', color: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '🟡', color: '#d97706' },
  info: { bg: '#eff6ff', border: '#bfdbfe', icon: '🔵', color: '#2563eb' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '🟢', color: '#16a34a' },
};

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

const ExecutiveDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [insights, setInsights] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const from = `${now.getFullYear()}-${m}-01`;
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    Promise.all([
      apiFetch(`/reports/executive/kpis?from=${from}&to=${to}`).then(r => r.ok ? r.json() : {}),
      apiFetch('/reports/executive/insights').then(r => r.ok ? r.json() : { data: [] }),
      apiFetch('/reports/executive/revenue-forecast?months=3').then(r => r.ok ? r.json() : { data: [] }),
      apiFetch('/reports/executive/risk-indicators').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([k, i, f, r]) => {
      setKpis(k.data || null);
      setInsights(i.data || []);
      setForecast(f.data || []);
      setRisks(r.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const KPIs = kpis ? [
    { label: 'Revenue', value: '₹' + fmt(kpis.revenue?.value), color: '#10b981', trend: kpis.revenue?.trend ? (kpis.revenue.trend > 0 ? 'up' : 'down') : null, subtext: kpis.revenue?.trend ? `${kpis.revenue.trend > 0 ? '+' : ''}${kpis.revenue.trend}% vs last month` : 'Current month' },
    { label: 'Purchases', value: '₹' + fmt(kpis.purchases?.value), color: '#6366f1' },
    { label: 'Gross Profit', value: '₹' + fmt(kpis.gross_profit?.value), color: kpis.gross_profit?.value > 0 ? '#10b981' : '#ef4444', trend: kpis.gross_profit?.value > 0 ? 'up' : 'down' },
    { label: 'Receivables', value: '₹' + fmt(kpis.receivables?.value), color: '#f59e0b' },
    { label: 'Customers', value: kpis.customers?.value || 0, color: '#8b5cf6', prefix: '' },
    { label: 'Invoices', value: kpis.invoice_count?.value || 0, color: '#6366f1', prefix: '' },
    { label: 'Salary Cost', value: '₹' + fmt(kpis.salary_cost?.value), color: '#ef4444' },
    { label: 'Attendance Rate', value: (kpis.attendance_rate?.value || 0) + '%', color: '#10b981', prefix: '' },
  ] : [];

  return (
    <ReportShell
      title="Executive Dashboard"
      subtitle="Real-time business intelligence and key performance indicators"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Executive' }]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Loading executive data...</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            {KPIs.map((kpi, i) => (
              <KPICard
                key={i}
                label={kpi.label}
                value={kpi.value}
                color={kpi.color}
                trend={kpi.trend}
                subtext={kpi.subtext}
                prefix={kpi.prefix !== undefined ? kpi.prefix : ''}
              />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Revenue Forecast Chart */}
            <ChartCard title="Revenue Trend & Forecast" height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => '₹' + Number(v).toLocaleString('en-IN', { notation: 'compact' })} />
                  <Tooltip formatter={v => '₹' + fmt(v)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={(props) => {
                      const { payload } = props;
                      return payload.type === 'forecast'
                        ? <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                        : <circle key={props.key} cx={props.cx} cy={props.cy} r={3} fill="#6366f1" />;
                    }}
                    name="Revenue"
                    strokeDasharray={(d) => d?.type === 'forecast' ? '5 5' : '0'}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Risk Indicators */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 16px 0' }}>Risk Indicators</h3>
              {risks.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No risk data available</p>
              ) : (
                risks.map((r, i) => (
                  <div key={i} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{r.indicator}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: RISK_COLORS[r.risk_level] || '#6b7280' }}>
                        {r.value}{r.unit} — {r.risk_level?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: Math.min(100, parseFloat(r.value || 0)) + '%',
                        background: RISK_COLORS[r.risk_level] || '#6b7280',
                        borderRadius: '4px',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0 0' }}>{r.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Insights / Alerts */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 16px 0' }}>Business Insights</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {insights.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No insights available</p>
              ) : (
                insights.map((ins, i) => {
                  const style = ALERT_STYLES[ins.type] || ALERT_STYLES.info;
                  return (
                    <div key={i} style={{
                      padding: '14px',
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      borderRadius: '10px',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>{style.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', color: style.color, fontWeight: 500 }}>{ins.message}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{ins.category}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
};

export default ExecutiveDashboard;
