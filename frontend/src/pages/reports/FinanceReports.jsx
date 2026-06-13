import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LineChart, Line, ComposedChart, Area } from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatINR, formatDate, yAxisFormatter, tooltipFormatter } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import KPICard from '../../components/reports/KPICard';
import ReportTable from '../../components/reports/ReportTable';
import ChartCard from '../../components/reports/ChartCard';
import FilterBar from '../../components/reports/FilterBar';
import ExportButtons from '../../components/reports/ExportButtons';

const fmt = v => Number(v || 0).toLocaleString('en-IN');
const fmtRs = v => '₹' + fmt(v);
const nowMonth = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { from: `${now.getFullYear()}-${m}-01`, to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
};

const TABS = [
  'P&L Statement',
  'Cash Flow',
  'Fund Flow',
  'Profitability',
  'Balance Sheet',
  'Income Trend',
  'True Performance',
  'Proprietor A/C',
  'Proprietor Txns',
  'Financial Ratios',
  'Budget vs Actual',
];

const INFLOW_COLOR = '#10b981';
const OUTFLOW_COLOR = '#ef4444';
const NEUTRAL_COLOR = '#6366f1';
const PROP_COLOR = '#7c3aed';

/* ── P&L specific components ── */
const PLRow = ({ label, amount, indent = false, bold = false, isTotal = false, color }) => {
  const num = parseFloat(amount || 0);
  const displayColor = color || (num < 0 ? '#ef4444' : '#1e293b');
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isTotal ? '10px 20px' : '9px 20px', paddingLeft: indent ? 36 : 20, borderBottom: '0.5px solid #f1f5f9', background: isTotal ? '#f8fafc' : 'transparent', minWidth: 0 }}>
      <span style={{ fontSize: isTotal ? 14 : 13, fontWeight: bold || isTotal ? 600 : 400, color: isTotal ? '#1e293b' : '#6b7280', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>
        {label}
      </span>
      <span style={{ fontSize: isTotal ? 15 : 13, fontWeight: bold || isTotal ? 700 : 400, color: displayColor, flexShrink: 0, whiteSpace: 'nowrap', minWidth: 130, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        ₹{Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </span>
    </div>
  );
};

const PLSectionHeader = ({ title, color = '#6366f1' }) => (
  <div style={{ padding: '10px 20px', background: '#f8fafc', borderBottom: '0.5px solid #e5e7eb', borderLeft: `4px solid ${color}`, display: 'flex', alignItems: 'center' }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {title}
    </span>
  </div>
);

const ProfitBand = ({ label, value, color }) => {
  const num = parseFloat(value || 0);
  const isPos = num >= 0;
  const bg = isPos ? '#f0fdf4' : '#fef2f2';
  const textColor = color || (isPos ? '#16a34a' : '#dc2626');
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: bg }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap', color: textColor, fontVariantNumeric: 'tabular-nums' }}>
        ₹{Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </span>
    </div>
  );
};

/* ── Generic line item used in Balance Sheet, Proprietor, True Performance ── */
const SectionHeader = ({ children }) => (
  <div style={{ background: '#f8fafc', borderRadius: 0, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', borderLeft: '3px solid #6366f1' }}>
    {children}
  </div>
);

const LineItem = ({ label, value, indent = false, bold = false, color, borderTop }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 7, paddingBottom: 7, paddingLeft: indent ? 36 : 16, paddingRight: 16, borderTop: borderTop ? '2px solid #e5e7eb' : undefined }}>
    <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: bold ? 700 : 400, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{label}</span>
    <span style={{ fontSize: '0.85rem', fontWeight: bold ? 700 : 600, color: color || '#1e293b', whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: 150, textAlign: 'right' }}>{fmtRs(value)}</span>
  </div>
);

const FinanceReports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [summary, setSummary] = useState({});
  const defaults = nowMonth();
  const [filters, setFilters] = useState({ from: defaults.from, to: defaults.to });
  const [propTxnType, setPropTxnType] = useState('all');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const fetchTab = useCallback(async (tab, f) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(f).toString();
      const endpoints = {
        0:  `/reports/finance/profit-loss?${qs}`,
        1:  `/reports/finance/cash-flow?${qs}`,
        2:  `/reports/finance/fund-flow?${qs}`,
        3:  `/reports/finance/profitability?${qs}`,
        4:  `/reports/finance/balance-sheet?as_of_date=${f.to}`,
        5:  `/reports/finance/income-expense-trend?year=${year}`,
        6:  `/reports/finance/true-performance?${qs}`,
        7:  `/reports/finance/proprietor-capital?${qs}`,
        8:  `/reports/proprietor/transactions?${qs}&type=${propTxnType}`,
        9:  `/reports/finance/ratios?${qs}`,
        10: `/reports/finance/budget-vs-actual?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`,
      };
      const res = await apiFetch(endpoints[tab]);
      if (res.ok) {
        const json = await res.json();
        setData(prev => ({ ...prev, [tab]: json.data || [] }));
        setSummary(prev => ({ ...prev, [tab]: json.summary || {} }));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [year, propTxnType]);

  useEffect(() => { fetchTab(activeTab, filters); }, [activeTab, fetchTab]);

  const tabData    = data[activeTab] || [];
  const tabSummary = summary[activeTab] || {};

  /* ── KPI rows ── */
  const renderKPIs = () => {
    if (activeTab === 0) {
      const d = tabData;
      const kpis = [
        { label: 'TOTAL REVENUE',      value: d?.total_revenue    || 0, color: '#10b981', border: '#bbf7d0' },
        { label: 'GROSS PROFIT',       value: d?.gross_profit     || 0, color: '#3b82f6', border: '#bfdbfe' },
        { label: 'NET PROFIT',         value: d?.net_profit       || 0, color: parseFloat(d?.net_profit||0) >= 0 ? '#10b981' : '#ef4444', border: parseFloat(d?.net_profit||0) >= 0 ? '#bbf7d0' : '#fecaca' },
        { label: 'CAPITAL INTRODUCED', value: d?.capital_invested || 0, color: '#8b5cf6', border: '#ddd6fe' },
      ];
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {kpis.map((card, i) => {
            const n = parseFloat(card.value || 0);
            const display = n >= 10000000 ? '₹' + (n/10000000).toFixed(2) + ' Cr'
                          : n >= 100000   ? '₹' + (n/100000).toFixed(2) + ' L'
                          : n >= 1000     ? '₹' + (n/1000).toFixed(1) + 'K'
                          : '₹' + n.toLocaleString('en-IN');
            return (
              <div key={i} title={`₹${n.toLocaleString('en-IN')}`} style={{ background: '#fff', border: `0.5px solid ${card.border}`, borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${card.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: '0.05em', marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: card.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{display}</div>
              </div>
            );
          })}
        </div>
      );
    }
    if (activeTab === 1) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Total Inflow"  value={tabSummary.total_inflow || 0}  color={INFLOW_COLOR}  isAmount={true} />
        <KPICard label="Total Outflow" value={tabSummary.total_outflow || 0} color={OUTFLOW_COLOR} isAmount={true} />
        <KPICard label="Net Cash Flow" value={tabSummary.net_cash_flow || 0} color={tabSummary.net_cash_flow >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR} isAmount={true} trend={tabSummary.net_cash_flow >= 0 ? 1 : -1} />
        <KPICard label="Closing Cash"  value={tabSummary.closing_cash || 0}  color={NEUTRAL_COLOR} isAmount={true} />
      </div>
    );
    if (activeTab === 2) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Total Inflow"  value={tabSummary.total_inflow || 0}  color={INFLOW_COLOR}  isAmount={true} />
        <KPICard label="Total Outflow" value={tabSummary.total_outflow || 0} color={OUTFLOW_COLOR} isAmount={true} />
        <KPICard label="Net Flow"      value={tabSummary.net_flow || 0}      color={NEUTRAL_COLOR} isAmount={true} trend={tabSummary.net_flow >= 0 ? 1 : -1} />
      </div>
    );
    if (activeTab === 3) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Revenue"      value={tabSummary.revenue || 0}     color={INFLOW_COLOR}  isAmount={true} />
        <KPICard label="Gross Profit" value={tabSummary.gross_profit || 0} color={NEUTRAL_COLOR} isAmount={true} />
        <KPICard label="Net Profit"   value={tabSummary.net_profit || 0}   color={tabSummary.net_profit >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR} isAmount={true} trend={tabSummary.net_profit >= 0 ? 1 : -1} />
        <KPICard label="Gross Margin" value={String((tabSummary.gross_margin || 0) + '%')} color={NEUTRAL_COLOR} isAmount={false} />
      </div>
    );
    if (activeTab === 6) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Total Inflow"   value={tabSummary.total_inflow || 0}   color={INFLOW_COLOR}  isAmount={true} />
        <KPICard label="Total Outflow"  value={tabSummary.total_outflow || 0}  color={OUTFLOW_COLOR} isAmount={true} />
        <KPICard label="Net Position"   value={tabSummary.net_position || 0}   color={tabSummary.net_position >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR} isAmount={true} trend={tabSummary.net_position >= 0 ? 1 : -1} />
        <KPICard label="Cash+Bank Bal"  value={tabSummary.cash_bank_balance || 0} color={NEUTRAL_COLOR} isAmount={true} />
        <KPICard label="Receivables"    value={tabSummary.outstanding_receivables || 0} color="#f59e0b" isAmount={true} />
        <KPICard label="Business Value" value={tabSummary.total_business_value || 0}    color={PROP_COLOR} isAmount={true} />
      </div>
    );
    if (activeTab === 7) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Opening Balance"  value={tabSummary.opening_balance || 0}  color={NEUTRAL_COLOR} isAmount={true} />
        <KPICard label="Capital Intro"    value={tabSummary.capital_intro || 0}    color={INFLOW_COLOR}  isAmount={true} />
        <KPICard label="Drawings"         value={tabSummary.drawings || 0}         color={OUTFLOW_COLOR} isAmount={true} />
        <KPICard label="Closing Balance"  value={tabSummary.closing_balance || 0}  color={tabSummary.closing_balance >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR} isAmount={true} trend={tabSummary.closing_balance >= 0 ? 1 : -1} />
      </div>
    );
    if (activeTab === 8) return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KPICard label="Capital Intro"  value={tabSummary.total_capital_intro || 0} color={INFLOW_COLOR}  isAmount={true} />
        <KPICard label="Drawings"       value={tabSummary.total_drawings || 0}       color={OUTFLOW_COLOR} isAmount={true} />
        <KPICard label="Net Capital"    value={tabSummary.net_capital || 0}          color={tabSummary.net_capital >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR} isAmount={true} trend={tabSummary.net_capital >= 0 ? 1 : -1} />
        <KPICard label="Personal Rcpts" value={tabSummary.total_personal_receipts || 0} color={PROP_COLOR} isAmount={true} />
      </div>
    );
    return null;
  };

  /* ── Charts ── */
  const renderChart = () => {
    // P&L — bar of revenue vs cost
    if (activeTab === 0 && tabData?.total_revenue !== undefined) {
      const d = tabData;
      const chartData = [
        { name: 'Invoice Revenue',    value: d.invoice_revenue,          type: 'income' },
        { name: 'Personal Receipts',  value: d.personal_receipt_revenue, type: 'income' },
        { name: 'Purchases',          value: d.total_cogs,               type: 'expense' },
        { name: 'Salary (Cash)',      value: d.salary_cash,              type: 'expense' },
        { name: 'Salary (Personal)',  value: d.salary_personal,          type: 'prop' },
        { name: 'Chit Payments',      value: (d.chit_cash||0) + (d.chit_personal||0), type: 'expense' },
        { name: 'Broker',             value: (d.broker_cash||0) + (d.broker_personal||0), type: 'expense' },
        { name: 'Loan Interest',      value: (d.interest_cash||0) + (d.interest_personal||0), type: 'expense' },
      ].filter(d => d.value > 0);
      return (
        <ChartCard title="P&L Overview" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.type === 'income' ? INFLOW_COLOR : d.type === 'prop' ? PROP_COLOR : OUTFLOW_COLOR} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    // Cash flow / Fund flow — inflow green / outflow red
    if ((activeTab === 1 || activeTab === 2) && Array.isArray(tabData) && tabData.length > 0) {
      return (
        <ChartCard title={activeTab === 1 ? 'Cash Flow Breakdown' : 'Fund Flow Analysis'} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="amount" radius={[4,4,0,0]}>
                {tabData.map((d, i) => <Cell key={i} fill={d.type === 'inflow' ? INFLOW_COLOR : d.type === 'financing' ? PROP_COLOR : OUTFLOW_COLOR} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    // Income trend — grouped bar + lines
    if (activeTab === 5 && Array.isArray(tabData) && tabData.length > 0) {
      return (
        <ChartCard title={`Income vs Expense Trend ${year}`} height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tabData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="total_income"  fill={INFLOW_COLOR}  name="Income"  radius={[4,4,0,0]} />
              <Bar dataKey="total_expense" fill={OUTFLOW_COLOR} name="Expense" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="capital_intro" stroke={PROP_COLOR}  name="Capital Intro" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="drawings"      stroke="#f59e0b"     name="Drawings"      strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    // True performance inflows vs outflows
    if (activeTab === 6 && tabData?.inflows) {
      const all = [
        ...tabData.inflows.map(d => ({ ...d, type: 'inflow' })),
        ...tabData.outflows.map(d => ({ ...d, type: 'outflow' })),
      ].filter(d => d.amount > 0);
      return (
        <ChartCard title="True Business Performance" height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={all} layout="vertical" margin={{ left: 160, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={yAxisFormatter} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={155} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="amount" radius={[0,4,4,0]}>
                {all.map((d, i) => <Cell key={i} fill={d.type === 'inflow' ? INFLOW_COLOR : OUTFLOW_COLOR} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    // Budget vs actual
    if (activeTab === 10 && Array.isArray(tabData) && tabData.length > 0) {
      return (
        <ChartCard title="Budget vs Actual" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tabData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="budget" fill="#c7d2fe" name="Budget" radius={[4,4,0,0]} />
              <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    return null;
  };

  /* ── Special rendering for structured reports ── */
  const renderPL = () => {
    const d = tabData;
    if (!d || typeof d !== 'object' || d.total_revenue === undefined) return null;
    const gp = parseFloat(d.gross_profit || 0);
    const np = parseFloat(d.net_profit   || 0);
    const eq = parseFloat(d.net_equity_change || 0);
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20, background: '#fff' }}>
        <PLSectionHeader title="Income" color="#10b981" />
        <PLRow label="Invoice Revenue"             amount={d.invoice_revenue}           indent />
        <PLRow label="Personal Account Receipts"   amount={d.personal_receipt_revenue}  indent />
        <PLRow label="Total Revenue"               amount={d.total_revenue}             isTotal bold color="#10b981" />

        <div style={{ height: 8, background: '#f8fafc' }} />

        <PLSectionHeader title="Cost of Goods Sold" color="#f59e0b" />
        <PLRow label="Purchases (Cash / Bank)"     amount={d.purchases_cash}     indent />
        <PLRow label="Purchases (Personal A/C)"    amount={d.purchases_personal} indent />
        <PLRow label="Total COGS"                  amount={d.total_cogs}         isTotal bold />

        <div style={{ height: 8, background: '#f8fafc' }} />

        <ProfitBand label="GROSS PROFIT" value={d.gross_profit} color={gp >= 0 ? '#16a34a' : '#dc2626'} />

        <div style={{ height: 8, background: '#f8fafc' }} />

        <PLSectionHeader title="Operating Expenses" color="#ef4444" />
        <PLRow label="Salaries (Cash / Bank)"            amount={d.salary_cash}      indent />
        <PLRow label="Salaries (Personal A/C)"           amount={d.salary_personal}  indent />
        {(d.chit_cash > 0 || d.chit_personal > 0) && <>
          <PLRow label="Chit Payments (Cash / Bank)"     amount={d.chit_cash}        indent />
          <PLRow label="Chit Payments (Personal A/C)"    amount={d.chit_personal}    indent />
        </>}
        {(d.broker_cash > 0 || d.broker_personal > 0) && <>
          <PLRow label="Broker Commission (Cash / Bank)" amount={d.broker_cash}      indent />
          <PLRow label="Broker Commission (Personal A/C)"amount={d.broker_personal}  indent />
        </>}
        {(d.interest_cash > 0 || d.interest_personal > 0) && <>
          <PLRow label="Loan Interest (Cash / Bank)"     amount={d.interest_cash}    indent />
          <PLRow label="Loan Interest (Personal A/C)"    amount={d.interest_personal}indent />
        </>}
        <PLRow label="Total Expenses" amount={d.total_expenses} isTotal bold color="#dc2626" />

        <div style={{ height: 8, background: '#f8fafc' }} />

        <ProfitBand label="NET PROFIT" value={d.net_profit} color={np >= 0 ? '#16a34a' : '#dc2626'} />

        <div style={{ height: 8, background: '#f8fafc' }} />

        <PLSectionHeader title="Proprietor Equity Impact" color="#8b5cf6" />
        <PLRow label="Capital Introduced" amount={d.capital_invested} indent color="#10b981" />
        <PLRow label="Drawings Taken"     amount={d.drawings_taken}   indent color="#ef4444" />
        <PLRow label="Net Equity Change"  amount={d.net_equity_change} isTotal bold color={eq >= 0 ? '#10b981' : '#ef4444'} />
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!tabData?.assets) return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280', fontSize: '0.9rem' }}>
        No balance sheet data available for the selected date. Try adjusting the date filter and applying.
      </div>
    );
    const { assets, liabilities, equity, check } = tabData;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <SectionHeader>ASSETS</SectionHeader>
          <LineItem label="Cash in Hand"        value={assets.cash_in_hand}       indent />
          <LineItem label="Bank Balance"         value={assets.bank_balance}        indent />
          <LineItem label="Accounts Receivable"  value={assets.accounts_receivable} indent />
          <LineItem label="Inventory Value"      value={assets.inventory_value}     indent />
          <LineItem label="TOTAL ASSETS"         value={assets.total_assets}        bold color={INFLOW_COLOR} borderTop />
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <SectionHeader>LIABILITIES</SectionHeader>
          <LineItem label="Accounts Payable" value={liabilities.accounts_payable} indent />
          <LineItem label="Loan Payable"     value={liabilities.loan_payable}     indent />
          <LineItem label="Chit Liability"   value={liabilities.chit_liability}   indent />
          <LineItem label="TOTAL LIABILITIES" value={liabilities.total_liabilities} bold color={OUTFLOW_COLOR} borderTop />
          <SectionHeader>EQUITY</SectionHeader>
          <LineItem label="Proprietor Capital" value={equity.proprietor_capital} indent />
          <LineItem label="Retained Earnings"  value={equity.retained_earnings}  indent />
          <LineItem label="TOTAL EQUITY"       value={equity.total_equity}       bold color={NEUTRAL_COLOR} borderTop />
          {!check?.balanced && (
            <div style={{ padding: '8px 14px', background: '#fef2f2', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
              ⚠️ Unreconciled: {fmtRs(check?.difference)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProprietorCapital = () => {
    if (!tabData?.debit) return null;
    const { debit, credit } = tabData;
    const totalDebit  = debit.reduce((s, r) => s + r.amount, 0);
    const totalCredit = credit.reduce((s, r) => s + r.amount, 0);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: '#fee2e2', padding: '10px 14px', fontWeight: 700, fontSize: '0.85rem', color: '#dc2626' }}>DEBIT (Outflow)</div>
          {debit.map((r, i) => <LineItem key={i} label={r.label} value={r.amount} indent />)}
          <LineItem label="TOTAL" value={totalDebit} bold color={OUTFLOW_COLOR} borderTop />
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: '#dcfce7', padding: '10px 14px', fontWeight: 700, fontSize: '0.85rem', color: '#15803d' }}>CREDIT (Inflow)</div>
          {credit.map((r, i) => <LineItem key={i} label={r.label} value={r.amount} indent />)}
          <LineItem label="TOTAL" value={totalCredit} bold color={INFLOW_COLOR} borderTop />
        </div>
      </div>
    );
  };

  const renderTruePerformance = () => {
    if (!tabData?.inflows) return null;
    const { inflows, outflows } = tabData;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: '#dcfce7', padding: '10px 14px', fontWeight: 700, fontSize: '0.85rem', color: '#15803d' }}>TOTAL MONEY IN</div>
          {inflows.map((r, i) => <LineItem key={i} label={r.label} value={r.amount} indent />)}
          <LineItem label="TOTAL INFLOW" value={tabSummary.total_inflow} bold color={INFLOW_COLOR} borderTop />
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: '#fee2e2', padding: '10px 14px', fontWeight: 700, fontSize: '0.85rem', color: '#dc2626' }}>TOTAL MONEY OUT</div>
          {outflows.map((r, i) => <LineItem key={i} label={r.label} value={r.amount} indent />)}
          <LineItem label="TOTAL OUTFLOW" value={tabSummary.total_outflow} bold color={OUTFLOW_COLOR} borderTop />
        </div>
      </div>
    );
  };

  const typeLabel = t => ({ CAPITAL_INTRO: 'Capital Intro', DRAWINGS: 'Drawings', PERSONAL_RECEIPT: 'Personal Receipt', PERSONAL_PAYMENT: 'Personal Payment' })[t] || t;

  /* ── Cash Flow / Fund Flow fixed-layout table ── */
  const renderFlowTable = (rows) => {
    const inflow  = rows.filter(r => r.type === 'inflow').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const outflow = rows.filter(r => r.type === 'outflow').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const net     = inflow - outflow;
    const fmtN    = n => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const thStyle = { padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' };

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '45%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '35%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>CATEGORY</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>TYPE</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>AMOUNT (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isIn  = row.type === 'inflow';
              const isFin = row.type === 'financing';
              const badgeBg = isIn ? '#dcfce7' : isFin ? '#eff6ff' : '#fee2e2';
              const badgeClr = isIn ? '#166534' : isFin ? '#1e40af' : '#dc2626';
              const amtClr   = isIn ? '#10b981' : isFin ? '#3b82f6' : '#ef4444';
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.category}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: badgeBg, color: badgeClr }}>
                      {isIn ? 'INFLOW' : isFin ? 'FINANCING' : 'OUTFLOW'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, fontSize: 14, color: amtClr, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {isIn || isFin ? '+' : '−'}₹{fmtN(row.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
              <td style={{ padding: '11px 16px', fontWeight: 600, fontSize: 13 }}>Total Inflow</td>
              <td />
              <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#10b981', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>+₹{fmtN(inflow)}</td>
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '11px 16px', fontWeight: 600, fontSize: 13 }}>Total Outflow</td>
              <td />
              <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#ef4444', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>−₹{fmtN(outflow)}</td>
            </tr>
            <tr style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14 }}>Net Cash Flow</td>
              <td />
              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: 16, color: net >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {net >= 0 ? '+' : '−'}₹{fmtN(Math.abs(net))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const COLUMNS_BY_TAB = {
    3:  [{ key: 'label', label: 'Item', width: '40%', wrap: true }, { key: 'type', label: 'Type', width: '15%' }, { key: 'value', label: 'Amount', width: '45%', type: 'amount', align: 'right', render: v => formatINR(v) }],
    5:  [{ key: 'month', label: 'Month', width: '12%' }, { key: 'total_income', label: 'Income', width: '22%', type: 'amount', align: 'right', render: v => formatINR(v) }, { key: 'total_expense', label: 'Expense', width: '22%', type: 'amount', align: 'right', render: v => formatINR(v) }, { key: 'capital_intro', label: 'Capital Intro', width: '22%', type: 'amount', align: 'right', render: v => formatINR(v) }, { key: 'drawings', label: 'Drawings', width: '22%', type: 'amount', align: 'right', render: v => formatINR(v) }],
    8:  [{ key: 'date', label: 'Date', width: '12%', render: v => formatDate(v) }, { key: 'type', label: 'Type', width: '18%', render: v => typeLabel(v) }, { key: 'reference_type', label: 'Reference', width: '14%' }, { key: 'amount', label: 'Amount', width: '18%', type: 'amount', align: 'right', render: v => formatINR(v) }, { key: 'payment_mode', label: 'Mode', width: '14%' }, { key: 'notes', label: 'Notes', width: '24%', wrap: true }],
    9:  [{ key: 'ratio', label: 'Financial Ratio', width: '35%' }, { key: 'value', label: 'Value', width: '20%', align: 'right' }, { key: 'description', label: 'Description', width: '45%', wrap: true }],
    10: [{ key: 'category', label: 'Category', width: '28%', wrap: true }, { key: 'budget', label: 'Budget', width: '18%', type: 'amount', align: 'right', render: v => formatINR(v) }, { key: 'actual', label: 'Actual', width: '18%', type: 'amount', align: 'right', render: v => formatINR(v) }, { key: 'variance', label: 'Variance', width: '18%', type: 'amount', align: 'right', render: v => formatINR(v), colorFn: v => parseFloat(v) >= 0 ? '#10b981' : '#ef4444' }, { key: 'variance_pct', label: 'Variance %', width: '18%', align: 'right' }],
  };

  const getTableData = () => {
    if (activeTab === 8)  return Array.isArray(tabData) ? tabData : [];
    if (activeTab === 2)  return Array.isArray(tabData) ? tabData : [];
    if (activeTab === 1)  return Array.isArray(tabData) ? tabData : [];
    if ([3, 5, 9, 10].includes(activeTab)) return Array.isArray(tabData) ? tabData : [];
    return [];
  };

  const showTable = [1, 2, 3, 5, 8, 9, 10].includes(activeTab);
  const showFilter = ![5, 10].includes(activeTab);

  return (
    <ReportShell
      title="Finance Reports"
      subtitle="P&L, Cash Flow, Balance Sheet, Proprietor Account and more"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports', path: '/reports' }, { label: 'Finance' }]}
    >
      {/* Tab bar */}
      <div className="report-tabs">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#3b82f6' : '#6b7280', borderBottom: activeTab === i ? '2px solid #3b82f6' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      {showFilter && (
        <FilterBar
          filters={[{ key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
          values={filters} onChange={setFilters}
          onApply={() => fetchTab(activeTab, filters)}
          onReset={() => { setFilters(defaults); fetchTab(activeTab, defaults); }}
        />
      )}

      {/* Year picker for trend */}
      {activeTab === 5 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Year:</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: '13px', width: 90 }} />
          <button onClick={() => fetchTab(5, filters)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}>Load</button>
        </div>
      )}

      {/* Proprietor txn type filter */}
      {activeTab === 8 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'capital_intro', 'drawing', 'personal_receipt', 'personal_payment'].map(t => (
            <button key={t} onClick={() => { setPropTxnType(t); fetchTab(8, { ...filters, type: t }); }}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: '12px', fontWeight: propTxnType === t ? 700 : 400, background: propTxnType === t ? '#7c3aed' : '#f5f3ff', color: propTxnType === t ? '#fff' : '#7c3aed', borderColor: '#7c3aed' }}>
              {t === 'all' ? 'All' : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      )}

      {renderKPIs()}

      {/* Special structured views */}
      {activeTab === 0 && renderPL()}
      {activeTab === 4 && renderBalanceSheet()}
      {activeTab === 7 && renderProprietorCapital()}
      {activeTab === 6 && renderTruePerformance()}

      {/* Chart */}
      <div style={{ marginBottom: 20 }}>{renderChart()}</div>

      {/* Table */}
      {showTable && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Detail View</h3>
            <ExportButtons data={getTableData()} filename={`finance-${TABS[activeTab].toLowerCase().replace(/[\s/&]+/g, '-')}`} />
          </div>
          {/* Cash Flow & Fund Flow use fixed-layout table with type badges + tfoot */}
          {(activeTab === 1 || activeTab === 2) && Array.isArray(tabData) && tabData.length > 0
            ? renderFlowTable(tabData)
            : (activeTab === 1 || activeTab === 2)
              ? <div style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No cash flow data for selected period</div>
              : <ReportTable columns={COLUMNS_BY_TAB[activeTab] || []} data={getTableData()} loading={loading} />
          }
        </>
      )}
    </ReportShell>
  );
};

export default FinanceReports;
