import React, { useEffect, useState } from 'react';
import './Reports.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import ChartCard from '../../components/reports/ChartCard';

// Bank-style credit assessment report — everything a lender actually checks
// before deciding whether a business is good for a loan, in one printable
// page: revenue trend, profitability (incl. EBITDA), balance sheet, the
// ratios banks score on (current ratio, debt-to-equity, interest coverage,
// DSO, inventory turnover), receivables/payables detail, outstanding loans,
// and risk flags. Deliberately a pure consolidation — every number here is
// read from the same endpoints the other report pages already use and have
// already been verified against (profit-loss, balance-sheet, ratios,
// money-overview, risk-indicators, monthly-growth); Debt-to-Equity and
// Interest Coverage are the only two derived client-side, from EBITDA/
// interest (profit-loss) and loans outstanding/net equity (money-overview +
// executive/kpis) — no new backend calculation duplicated.

const fmt = (v) => '₹' + Math.abs(parseFloat(v || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtSigned = (v) => (parseFloat(v || 0) < 0 ? '-' : '') + fmt(v);

const HEALTH = {
  good: { label: 'Healthy', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
  fair: { label: 'Watch', bg: '#fffbeb', border: '#fde68a', color: '#d97706' },
  poor: { label: 'Needs Attention', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
};

const RatioRow = ({ label, value, description, health, benchmark }) => {
  const h = HEALTH[health] || HEALTH.fair;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{description}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{value}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: h.bg, color: h.color, border: `1px solid ${h.border}` }}>
          {h.label}
        </span>
        {benchmark && <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{benchmark}</div>}
      </div>
    </div>
  );
};

const Section = ({ title, icon, children, style }) => (
  <div style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #f1f5f9', marginBottom: 20, ...style }}>
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{icon}</span> {title}
    </div>
    {children}
  </div>
);

const StatBlock = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || '#0f172a', marginTop: 4 }}>{value}</div>
  </div>
);

const CreditAssessmentReport = () => {
  const [loading, setLoading] = useState(true);
  const [pl, setPl] = useState(null);
  const [bs, setBs] = useState(null);
  const [ratios, setRatios] = useState([]);
  const [money, setMoney] = useState(null);
  const [risks, setRisks] = useState([]);
  const [trend, setTrend] = useState([]);
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    Promise.all([
      apiFetch(`/reports/finance/profit-loss?from=${yearStart}&to=${today}`).then(r => r.ok ? r.json() : { data: null }),
      apiFetch(`/reports/finance/balance-sheet?as_of_date=${today}`).then(r => r.ok ? r.json() : { data: null }),
      apiFetch(`/reports/finance/ratios?from=${yearStart}&to=${today}`).then(r => r.ok ? r.json() : { data: [] }),
      apiFetch('/reports/executive/money-overview').then(r => r.ok ? r.json() : { data: null }),
      apiFetch('/reports/executive/risk-indicators').then(r => r.ok ? r.json() : { data: [] }),
      apiFetch(`/reports/sales/monthly-growth?year=${now.getFullYear()}`).then(r => r.ok ? r.json() : { data: [] }),
      apiFetch(`/reports/executive/kpis?from=${monthStart}&to=${today}`).then(r => r.ok ? r.json() : { data: null }),
    ]).then(([plR, bsR, ratiosR, moneyR, risksR, trendR, kpisR]) => {
      setPl(plR.data || null);
      setBs(bsR.data || null);
      setRatios(ratiosR.data || []);
      setMoney(moneyR.data || null);
      setRisks(risksR.data || []);
      setTrend(trendR.data || []);
      setKpis(kpisR.data || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ReportShell title="Credit Assessment Report" subtitle="Loading…" breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Credit Assessment' }]}>
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Assembling report…</div>
      </ReportShell>
    );
  }

  const revenue = parseFloat(pl?.total_revenue || 0);
  const netProfit = parseFloat(pl?.net_profit || 0);
  const ebitda = parseFloat(pl?.ebitda || 0);
  const interestTotal = parseFloat(pl?.interest_total || 0);
  const grossProfit = parseFloat(pl?.gross_profit || 0);
  const netMargin = revenue > 0 ? (netProfit / revenue * 100) : 0;
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue * 100) : 0;

  const netWorth = parseFloat(kpis?.proprietor_net_equity?.value || 0);
  const loansOutstanding = parseFloat(money?.payables?.loans_total || 0);
  const debtToEquity = netWorth > 0 ? (loansOutstanding / netWorth) : null;
  const interestCoverage = interestTotal > 0 ? (ebitda / interestTotal) : null;

  const findRatio = (name) => ratios.find(r => r.ratio === name)?.value || '—';
  const currentRatioVal = parseFloat(findRatio('Current Ratio')) || 0;
  const dsoVal = parseInt(findRatio('Days Sales Outstanding')) || 0;
  const invTurnoverVal = parseFloat(findRatio('Inventory Turnover')) || 0;
  const grossMarginVal = parseFloat(findRatio('Gross Margin')) || 0;

  const healthOf = (val, goodMin, fairMin, higherIsBetter = true) => {
    if (val === null || val === undefined || isNaN(val)) return 'fair';
    if (higherIsBetter) return val >= goodMin ? 'good' : val >= fairMin ? 'fair' : 'poor';
    return val <= goodMin ? 'good' : val <= fairMin ? 'fair' : 'poor';
  };

  const chartData = trend.map(t => ({ month: t.month, revenue: parseFloat(t.revenue || 0) }));

  return (
    <ReportShell
      title="Credit Assessment Report"
      subtitle="A bank-style snapshot of financial health — revenue, profitability, ratios, debt and risk, all in one place"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Credit Assessment' }]}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
          🖨️ Print / Export PDF
        </button>
      </div>

      {/* Headline numbers */}
      <Section title="Snapshot — This Year" icon="📊">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
          <StatBlock label="Revenue (YTD)" value={fmt(revenue)} color="#10b981" />
          <StatBlock label="Gross Profit" value={fmt(grossProfit)} color="#3b82f6" />
          <StatBlock label="Net Profit" value={fmtSigned(netProfit)} color={netProfit >= 0 ? '#16a34a' : '#dc2626'} />
          <StatBlock label="EBITDA" value={fmtSigned(ebitda)} color={ebitda >= 0 ? '#0891b2' : '#dc2626'} />
          <StatBlock label="Net Worth" value={fmtSigned(netWorth)} color={netWorth >= 0 ? '#16a34a' : '#dc2626'} />
        </div>
      </Section>

      {/* Revenue trend */}
      <Section title="Revenue Trend (This Year, Monthly)" icon="📈" style={{ padding: 0 }}>
        <div style={{ padding: 22 }}>
          <ChartCard height={260}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 10, right: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No monthly data yet</div>
            )}
          </ChartCard>
        </div>
      </Section>

      {/* Balance sheet */}
      {bs && bs.assets && (
        <Section title="Balance Sheet" icon="⚖️">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 8, textTransform: 'uppercase' }}>Assets</div>
              {[
                ['Cash in Hand', bs.assets.cash_in_hand],
                ['Bank Balance', bs.assets.bank_balance],
                ['Accounts Receivable', bs.assets.accounts_receivable],
                ['Inventory Value', bs.assets.inventory_value],
              ].map(([label, amt], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: '#334155' }}>
                  <span>{label}</span><span style={{ fontWeight: 600 }}>{fmt(amt)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0 0', borderTop: '2px solid #e2e8f0', marginTop: 6, fontWeight: 800 }}>
                <span>Total Assets</span><span style={{ color: '#10b981' }}>{fmt(bs.assets.total_assets)}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8, textTransform: 'uppercase' }}>Liabilities</div>
              {[
                ['Accounts Payable', bs.liabilities?.accounts_payable],
                ['Loan Payable', bs.liabilities?.loan_payable],
                ['Chit Liability', bs.liabilities?.chit_liability],
              ].map(([label, amt], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: '#334155' }}>
                  <span>{label}</span><span style={{ fontWeight: 600 }}>{fmt(amt)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0 0', borderTop: '2px solid #e2e8f0', marginTop: 6, fontWeight: 800 }}>
                <span>Total Liabilities</span><span style={{ color: '#dc2626' }}>{fmt(bs.liabilities?.total_liabilities)}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase' }}>Equity</div>
              {[
                ['Proprietor Capital', bs.equity?.proprietor_capital],
                ['Retained Earnings', bs.equity?.retained_earnings],
              ].map(([label, amt], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: '#334155' }}>
                  <span>{label}</span><span style={{ fontWeight: 600 }}>{fmtSigned(amt)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0 0', borderTop: '2px solid #e2e8f0', marginTop: 6, fontWeight: 800 }}>
                <span>Total Equity</span><span style={{ color: '#8b5cf6' }}>{fmtSigned(bs.equity?.total_equity)}</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Ratios banks actually look at */}
      <Section title="Key Ratios (what a lender scores)" icon="🧮">
        <RatioRow label="Gross Margin" value={`${grossMarginVal}%`} description="Revenue minus COGS, as % of revenue"
          health={healthOf(grossMarginVal, 30, 15)} benchmark="≥30% healthy, <15% weak" />
        <RatioRow label="Net Profit Margin" value={`${netMargin.toFixed(1)}%`} description="What's actually left after every expense"
          health={healthOf(netMargin, 10, 3)} benchmark="≥10% healthy, <3% weak" />
        <RatioRow label="EBITDA Margin" value={`${ebitdaMargin.toFixed(1)}%`} description="Operating profitability before interest"
          health={healthOf(ebitdaMargin, 12, 5)} benchmark="≥12% healthy, <5% weak" />
        <RatioRow label="Current Ratio" value={currentRatioVal.toFixed(2)} description="(Receivables + Inventory) / Payables — ability to cover short-term obligations"
          health={healthOf(currentRatioVal, 1.5, 1.0)} benchmark="≥1.5 healthy, <1.0 weak" />
        <RatioRow label="Debt-to-Equity" value={debtToEquity !== null ? `${debtToEquity.toFixed(2)}x` : 'N/A (no net worth data)'}
          description="Loans outstanding / Net worth — how leveraged the business is"
          health={debtToEquity === null ? 'fair' : healthOf(debtToEquity, 1.0, 2.0, false)} benchmark="≤1.0x healthy, >2.0x risky" />
        <RatioRow label="Interest Coverage Ratio" value={interestCoverage !== null ? `${interestCoverage.toFixed(1)}x` : 'N/A (no interest paid)'}
          description="EBITDA / Interest paid — comfort margin for servicing debt"
          health={interestCoverage === null ? 'good' : healthOf(interestCoverage, 3, 1.5)} benchmark="≥3x healthy, <1.5x risky" />
        <RatioRow label="Days Sales Outstanding" value={`${dsoVal} days`} description="Average time to collect payment after a sale"
          health={healthOf(dsoVal, 45, 90, false)} benchmark="≤45 days healthy, >90 days weak" />
        <RatioRow label="Inventory Turnover" value={`${invTurnoverVal}x`} description="How many times stock is sold and replaced per year"
          health={healthOf(invTurnoverVal, 4, 2)} benchmark="≥4x healthy, <2x weak" />
      </Section>

      {/* Receivables / Payables / Loans */}
      {money && (
        <Section title="Who Owes You, Who You Owe" icon="💰">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
            <StatBlock label="Receivables" value={fmt(money.receivables?.total)} color="#10b981" />
            <StatBlock label="Supplier Payables" value={fmt(money.payables?.supplier_total)} color="#d97706" />
            <StatBlock label="Loans Outstanding" value={fmt(money.payables?.loans_total)} color="#dc2626" />
            <StatBlock label="Net Position" value={fmtSigned(money.net_position)} color={(money.net_position || 0) >= 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 8 }}>Top Customers (Owe You)</div>
              {(money.receivables?.top || []).slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', color: '#334155' }}>
                  <span>{r.name}</span><span style={{ fontWeight: 700 }}>{fmt(r.amount)}</span>
                </div>
              ))}
              {(money.receivables?.top || []).length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>None outstanding</div>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 8 }}>Top Suppliers (You Owe)</div>
              {(money.payables?.top_suppliers || []).slice(0, 5).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', color: '#334155' }}>
                  <span>{p.name}</span><span style={{ fontWeight: 700 }}>{fmt(p.amount)}</span>
                </div>
              ))}
              {(money.payables?.top_suppliers || []).length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>None outstanding</div>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Active Loans</div>
              {(money.payables?.loans || []).slice(0, 5).map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', color: '#334155' }}>
                  <span>{l.name}</span><span style={{ fontWeight: 700 }}>{fmt(l.amount)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>/ {fmt(l.principal)}</span></span>
                </div>
              ))}
              {(money.payables?.loans || []).length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>No active loans</div>}
            </div>
          </div>
        </Section>
      )}

      {/* Risk flags */}
      <Section title="Risk Flags" icon="🚩">
        {risks.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No risk data available</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {risks.map((r, i) => {
              const h = r.risk_level === 'low' ? HEALTH.good : r.risk_level === 'high' ? HEALTH.poor : HEALTH.fair;
              return (
                <div key={i} style={{ padding: 12, borderRadius: 10, background: h.bg, border: `1px solid ${h.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{r.indicator}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: h.color, margin: '4px 0' }}>{r.value}{r.unit}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.description}</div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
        This report is generated from the business's own recorded transactions, not an independently audited statement.
        EBITDA excludes depreciation, amortization and a formal tax expense, which this system does not track.
      </div>
    </ReportShell>
  );
};

export default CreditAssessmentReport;
