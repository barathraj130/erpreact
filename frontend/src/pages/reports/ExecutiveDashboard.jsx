import React, { useEffect, useState } from 'react';
import './Reports.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { apiFetch } from '../../utils/api';
import { yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ChartCard from '../../components/reports/ChartCard';
import GrowthPresentation from './GrowthPresentation';

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
  const [moneyOverview, setMoneyOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState('dashboard');

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
      apiFetch('/reports/executive/money-overview').then(r => r.ok ? r.json() : { data: null }),
    ]).then(([k, i, f, r, m]) => {
      setKpis(k.data || null);
      setInsights(i.data || []);
      setForecast(f.data || []);
      setRisks(r.data || []);
      setMoneyOverview(m.data || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmtAmt = (v) => '₹' + Math.abs(parseFloat(v || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const KPIs = kpis ? [
    { label: 'Revenue', value: kpis.revenue?.value || 0, color: '#10b981', trend: kpis.revenue?.trend || null, subtext: kpis.revenue?.trend ? `${kpis.revenue.trend > 0 ? '+' : ''}${kpis.revenue.trend}% vs last month` : 'Current month', isAmount: true },
    { label: 'Purchases', value: kpis.purchases?.value || 0, color: '#6366f1', isAmount: true },
    { label: 'Gross Profit', value: kpis.gross_profit?.value || 0, color: kpis.gross_profit?.value > 0 ? '#10b981' : '#ef4444', trend: kpis.gross_profit?.value > 0 ? 1 : -1, isAmount: true },
    { label: 'Receivables', value: kpis.receivables?.value || 0, color: '#f59e0b', isAmount: true },
    { label: 'Customers', value: String(kpis.customers?.value || 0), color: '#8b5cf6', isAmount: false },
    { label: 'Invoices', value: String(kpis.invoice_count?.value || 0), color: '#6366f1', isAmount: false },
    { label: 'Salary Cost', value: kpis.salary_cost?.value || 0, color: '#ef4444', isAmount: true },
    { label: 'Attendance Rate', value: String((kpis.attendance_rate?.value || 0) + '%'), color: '#10b981', isAmount: false },
  ] : [];

  return (
    <ReportShell
      title="Executive Dashboard"
      subtitle="Real-time business intelligence and key performance indicators"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Executive' }]}
    >
      {/* Page-level tab toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'dashboard', label: '📊 Executive Dashboard' },
          { key: 'growth-deck', label: '✨ Growth Study Deck' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setPageTab(t.key)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: pageTab === t.key ? '#4f46e5' : 'transparent',
              color: pageTab === t.key ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pageTab === 'growth-deck' && <GrowthPresentation />}

      {pageTab === 'dashboard' && (loading ? (
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
                isAmount={kpi.isAmount}
              />
            ))}
          </div>

          {/* Money In / Money Out — what's owed TO the business vs what it owes,
              right now (not bounded by a date range, unlike the KPIs above). */}
          {moneyOverview && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <KPICard label="Receivables (Owed to You)" value={moneyOverview.receivables?.total || 0} color="#10b981" isAmount={true}
                  subtext={`${moneyOverview.receivables?.customer_count || 0} customers`} />
                <KPICard label="Supplier Payables" value={moneyOverview.payables?.supplier_total || 0} color="#f59e0b" isAmount={true}
                  subtext={`${moneyOverview.payables?.supplier_count || 0} suppliers`} />
                <KPICard label="Loans Outstanding" value={moneyOverview.payables?.loans_total || 0} color="#dc2626" isAmount={true}
                  subtext={`${moneyOverview.payables?.loan_count || 0} active loans`} />
                <KPICard label="Net Position" value={moneyOverview.net_position || 0} color={(moneyOverview.net_position || 0) >= 0 ? '#10b981' : '#dc2626'} isAmount={true}
                  subtext="Receivables − total payables" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#0f172a' }}>💰 Who Owes You</div>
                  {(moneyOverview.receivables?.top || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>Nothing outstanding</div>
                  ) : moneyOverview.receivables.top.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < moneyOverview.receivables.top.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: 13, color: '#334155' }}>{r.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtAmt(r.amount)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#0f172a' }}>💸 Suppliers You Owe</div>
                  {(moneyOverview.payables?.top_suppliers || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>Nothing outstanding</div>
                  ) : moneyOverview.payables.top_suppliers.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < moneyOverview.payables.top_suppliers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: 13, color: '#334155' }}>{p.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>{fmtAmt(p.amount)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#0f172a' }}>🏦 Loans You Owe</div>
                  {(moneyOverview.payables?.loans || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No active loans</div>
                  ) : moneyOverview.payables.loans.map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < moneyOverview.payables.loans.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: 13, color: '#334155' }}>{l.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmtAmt(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Revenue Forecast Chart */}
            <ChartCard title="Revenue Trend & Forecast" height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={yAxisFormatter} />
                  <Tooltip formatter={tooltipFormatter} />
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
      ))}
    </ReportShell>
  );
};

export default ExecutiveDashboard;
