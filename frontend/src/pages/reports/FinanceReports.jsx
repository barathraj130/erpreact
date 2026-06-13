import React, { useEffect, useState, useCallback } from 'react';
import './Reports.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, LineChart, Line,
  ComposedChart, Area,
} from 'recharts';
import { apiFetch } from '../../utils/api';
import { formatDate } from '../../utils/reportHelpers';
import ReportShell from '../../components/reports/ReportShell';
import FilterBar from '../../components/reports/FilterBar';
import ExportButtons from '../../components/reports/ExportButtons';
import ChartCard from '../../components/reports/ChartCard';
import { FinanceRow, SectionHeader, SectionGap, ReportCard, TwoCol, KPIGrid } from '../../components/reports/FinanceRow';
import DataTable from '../../components/reports/DataTable';

/* ── formatters ── */
const fmt = (v) => '₹' + Math.abs(parseFloat(v || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const fmtSigned = (v) => {
  const n = parseFloat(v || 0);
  return (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
};
const yAxisFmt = (v) => {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (v >= 100000)   return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)     return '₹' + (v / 1000).toFixed(0) + 'K';
  return '₹' + v;
};
const tooltipFmt = (value) => ['₹' + parseFloat(value || 0).toLocaleString('en-IN'), ''];

const nowMonth = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return {
    from: `${now.getFullYear()}-${m}-01`,
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
};

const TABS = [
  'P&L Statement', 'Cash Flow', 'Fund Flow', 'Profitability',
  'Balance Sheet', 'Income Trend', 'True Performance',
  'Proprietor A/C', 'Proprietor Txns', 'Financial Ratios', 'Budget vs Actual',
];

const INFLOW_COLOR  = '#10b981';
const OUTFLOW_COLOR = '#ef4444';
const NEUTRAL_COLOR = '#6366f1';
const PROP_COLOR    = '#7c3aed';

/* ── type badge helper ── */
const TypeBadge = ({ type }) => {
  const isIn  = type === 'inflow';
  const isFin = type === 'financing';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: isIn ? '#dcfce7' : isFin ? '#eff6ff' : '#fee2e2',
      color:      isIn ? '#166534' : isFin ? '#1e40af' : '#dc2626',
    }}>
      {isIn ? 'INFLOW' : isFin ? 'FINANCING' : 'OUTFLOW'}
    </span>
  );
};

/* ── txn type badge ── */
const TxnBadge = ({ type }) => {
  const map = {
    capital_intro:    ['CAPITAL IN',   '#dcfce7', '#166534'],
    CAPITAL_INTRO:    ['CAPITAL IN',   '#dcfce7', '#166534'],
    drawing:          ['DRAWING',      '#fee2e2', '#dc2626'],
    DRAWINGS:         ['DRAWING',      '#fee2e2', '#dc2626'],
    personal_receipt: ['PERSONAL IN',  '#ede9fe', '#6d28d9'],
    PERSONAL_RECEIPT: ['PERSONAL IN',  '#ede9fe', '#6d28d9'],
    personal_payment: ['PERSONAL OUT', '#fef3c7', '#92400e'],
    PERSONAL_PAYMENT: ['PERSONAL OUT', '#fef3c7', '#92400e'],
  };
  const [label, bg, color] = map[type] || [type, '#f3f4f6', '#374151'];
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: bg, color }}>{label}</span>;
};

/* ── status badge ── */
const StatusBadge = ({ status }) => {
  const isGood = status === 'GOOD';
  const isWarn = status === 'WARNING';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
      background: isGood ? '#dcfce7' : isWarn ? '#fef3c7' : '#fee2e2',
      color:      isGood ? '#166534' : isWarn ? '#92400e' : '#dc2626',
    }}>
      {status}
    </span>
  );
};

/* ── columns per tab ── */
const flowColumns = [
  { key: 'category', label: 'Category', minWidth: 160, wrap: true },
  {
    key: 'type', label: 'Type', align: 'center', minWidth: 110,
    render: (v) => <TypeBadge type={v} />,
  },
  {
    key: 'amount', label: 'Amount', align: 'right', minWidth: 140, bold: true,
    render: (v, row) => {
      const isOut = row.type === 'outflow';
      const color = row.type === 'inflow' ? '#10b981' : row.type === 'financing' ? '#3b82f6' : '#ef4444';
      return <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{isOut ? '−' : '+'}{fmt(v)}</span>;
    },
  },
];

const profitabilityColumns = [
  { key: 'month',        label: 'Month',        minWidth: 90 },
  { key: 'revenue',      label: 'Revenue',      align: 'right', type: 'amount', minWidth: 130 },
  { key: 'cogs',         label: 'COGS',         align: 'right', type: 'amount', minWidth: 120 },
  { key: 'gross_profit', label: 'Gross Profit', align: 'right', type: 'amount', minWidth: 130, bold: true, colorFn: (v) => parseFloat(v) >= 0 ? '#16a34a' : '#dc2626' },
  { key: 'expenses',     label: 'Expenses',     align: 'right', type: 'amount', minWidth: 120 },
  { key: 'net_profit',   label: 'Net Profit',   align: 'right', type: 'amount', minWidth: 120, bold: true, colorFn: (v) => parseFloat(v) >= 0 ? '#16a34a' : '#dc2626' },
  { key: 'margin',       label: 'Margin %',     align: 'right', minWidth: 90, render: (v) => parseFloat(v || 0).toFixed(1) + '%' },
];

const incomeTrendColumns = [
  { key: 'month',             label: 'Month',       minWidth: 80 },
  { key: 'total_income',      label: 'Income',      align: 'right', type: 'amount', minWidth: 130, bold: true },
  { key: 'total_expense',     label: 'Expenses',    align: 'right', type: 'amount', minWidth: 130 },
  { key: 'capital_intro',     label: 'Capital In',  align: 'right', type: 'amount', minWidth: 130 },
  { key: 'drawings',          label: 'Drawings',    align: 'right', type: 'amount', minWidth: 130 },
  {
    key: 'net', label: 'Net', align: 'right', minWidth: 130, bold: true,
    render: (v, row) => {
      const net = (parseFloat(row.total_income || 0) - parseFloat(row.total_expense || 0)).toLocaleString('en-IN');
      const val = parseFloat(row.total_income || 0) - parseFloat(row.total_expense || 0);
      return <span style={{ color: val >= 0 ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
        {val >= 0 ? '+' : '−'}₹{Math.abs(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </span>;
    },
  },
];

const propTxnColumns = [
  { key: 'transaction_date', label: 'Date',      minWidth: 100, render: (v) => formatDate(v) },
  { key: 'transaction_type', label: 'Type',      minWidth: 120, render: (v) => <TxnBadge type={v} /> },
  { key: 'reference_type',   label: 'Reference', minWidth: 130, render: (v) => (v || '').replace(/_/g, ' ').toUpperCase() },
  { key: 'payment_mode',     label: 'Mode',      minWidth: 90 },
  { key: 'amount',           label: 'Amount',    align: 'right', type: 'amount', minWidth: 140, bold: true },
  { key: 'notes',            label: 'Notes',     minWidth: 160, wrap: true },
];

const ratioColumns = [
  { key: 'ratio',       label: 'Ratio',       minWidth: 200, wrap: true },
  { key: 'value',       label: 'Value',       align: 'right', minWidth: 100, bold: true },
  { key: 'description', label: 'Description', minWidth: 200, wrap: true },
  { key: 'status',      label: 'Status',      align: 'center', minWidth: 100, render: (v) => v ? <StatusBadge status={v} /> : '—' },
];

const budgetColumns = [
  { key: 'category',       label: 'Category',  minWidth: 160, wrap: true },
  { key: 'budget',         label: 'Budgeted',  align: 'right', type: 'amount', minWidth: 130 },
  { key: 'actual',         label: 'Actual',    align: 'right', type: 'amount', minWidth: 130 },
  {
    key: 'variance', label: 'Variance', align: 'right', minWidth: 130, bold: true,
    render: (v) => fmt(Math.abs(v || 0)),
    colorFn: (v) => parseFloat(v) >= 0 ? '#16a34a' : '#dc2626',
  },
  {
    key: 'variance_pct', label: 'Used %', align: 'right', minWidth: 90,
    render: (v) => parseFloat(v || 0).toFixed(1) + '%',
    colorFn: (v) => parseFloat(v) > 100 ? '#dc2626' : parseFloat(v) > 80 ? '#f59e0b' : '#16a34a',
  },
];


const FinanceReports = () => {
  const [activeTab, setActiveTab]       = useState(0);
  const [loading, setLoading]           = useState(false);
  const [data, setData]                 = useState({});
  const [summary, setSummary]           = useState({});
  const defaults                        = nowMonth();
  const [filters, setFilters]           = useState({ from: defaults.from, to: defaults.to });
  const [propTxnType, setPropTxnType]   = useState('all');
  const [year, setYear]                 = useState(String(new Date().getFullYear()));

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

  const tabData    = data[activeTab];
  const tabSummary = summary[activeTab] || {};

  /* ─────────── TAB 0: P&L ─────────── */
  const renderPL = () => {
    const d = tabData;
    if (!d || typeof d !== 'object' || d.total_revenue === undefined) {
      return loading
        ? <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
        : <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No P&L data for selected period</div>;
    }
    const gp = parseFloat(d.gross_profit || 0);
    const np = parseFloat(d.net_profit   || 0);
    const eq = parseFloat(d.net_equity_change || 0);
    const kpis = [
      { label: 'Total Revenue',      value: d.total_revenue    || 0, color: '#10b981', border: '#bbf7d0' },
      { label: 'Gross Profit',       value: d.gross_profit     || 0, color: '#3b82f6', border: '#bfdbfe' },
      { label: 'Net Profit',         value: d.net_profit       || 0, color: np >= 0 ? '#10b981' : '#ef4444', border: np >= 0 ? '#bbf7d0' : '#fecaca' },
      { label: 'Capital Introduced', value: d.capital_invested || 0, color: '#8b5cf6', border: '#ddd6fe' },
    ];
    return (
      <>
        <KPIGrid cards={kpis} />
        <ReportCard style={{ marginBottom: 20 }}>
          <SectionHeader title="Income" color="#10b981" />
          <FinanceRow label="Invoice Revenue"           amount={d.invoice_revenue}          indent />
          <FinanceRow label="Personal Account Receipts" amount={d.personal_receipt_revenue} indent />
          <FinanceRow label="Total Revenue"             amount={d.total_revenue}            isTotal color="#10b981" />
          <SectionGap />

          <SectionHeader title="Cost of Goods Sold" color="#f59e0b" />
          <FinanceRow label="Purchases (Cash / Bank)"  amount={d.purchases_cash}     indent />
          <FinanceRow label="Purchases (Personal A/C)" amount={d.purchases_personal} indent />
          <FinanceRow label="Total COGS"               amount={d.total_cogs}         isTotal />
          <SectionGap />

          <FinanceRow label="GROSS PROFIT" amount={d.gross_profit} isGrandTotal color={gp >= 0 ? '#16a34a' : '#dc2626'} />
          <SectionGap />

          <SectionHeader title="Operating Expenses" color="#ef4444" />
          <FinanceRow label="Salaries (Cash / Bank)"  amount={d.salary_cash}     indent />
          <FinanceRow label="Salaries (Personal A/C)" amount={d.salary_personal} indent />
          {(d.chit_cash > 0 || d.chit_personal > 0) && <>
            <FinanceRow label="Chit Payments (Cash / Bank)"     amount={d.chit_cash}     indent />
            <FinanceRow label="Chit Payments (Personal A/C)"    amount={d.chit_personal} indent />
          </>}
          {(d.broker_cash > 0 || d.broker_personal > 0) && <>
            <FinanceRow label="Broker Commission (Cash / Bank)"  amount={d.broker_cash}     indent />
            <FinanceRow label="Broker Commission (Personal A/C)" amount={d.broker_personal} indent />
          </>}
          {(d.interest_cash > 0 || d.interest_personal > 0) && <>
            <FinanceRow label="Loan Interest (Cash / Bank)"  amount={d.interest_cash}     indent />
            <FinanceRow label="Loan Interest (Personal A/C)" amount={d.interest_personal} indent />
          </>}
          <FinanceRow label="Total Expenses" amount={d.total_expenses} isTotal color="#dc2626" />
          <SectionGap />

          <FinanceRow label="NET PROFIT" amount={d.net_profit} isGrandTotal color={np >= 0 ? '#16a34a' : '#dc2626'} />
          <SectionGap />

          <SectionHeader title="Proprietor Equity Impact" color="#8b5cf6" />
          <FinanceRow label="Capital Introduced" amount={d.capital_invested}   indent color="#10b981" />
          <FinanceRow label="Drawings Taken"     amount={d.drawings_taken}     indent color="#ef4444" />
          <FinanceRow label="Net Equity Change"  amount={d.net_equity_change}  isTotal color={eq >= 0 ? '#10b981' : '#ef4444'} />
        </ReportCard>
      </>
    );
  };

  /* ─────────── TAB 1 & 2: Cash / Fund Flow ─────────── */
  const renderFlow = () => {
    const rows = Array.isArray(tabData) ? tabData : [];
    const inflow  = rows.filter(r => r.type === 'inflow').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const outflow = rows.filter(r => r.type === 'outflow').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const net = inflow - outflow;
    const flowSummary = { category: 'Net Cash Flow', amount: net };
    return (
      <>
        <KPIGrid cards={[
          { label: 'Total Inflow',    value: inflow,  color: '#10b981', border: '#bbf7d0' },
          { label: 'Total Outflow',   value: outflow, color: '#ef4444', border: '#fecaca' },
          { label: 'Net Cash Flow',   value: net,     color: net >= 0 ? '#10b981' : '#ef4444', border: net >= 0 ? '#bbf7d0' : '#fecaca' },
          { label: 'Closing Balance', value: tabSummary.closing_cash || tabSummary.closing_balance || 0, color: '#6366f1', border: '#e0e7ff' },
        ]} />
        <DataTable
          columns={flowColumns}
          data={rows}
          loading={loading}
          emptyText={`No ${activeTab === 1 ? 'cash' : 'fund'} flow data for selected period`}
        />
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Total Inflow </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>+{fmt(inflow)}</span>
            </div>
            <div style={{ padding: '10px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Total Outflow </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>−{fmt(outflow)}</span>
            </div>
            <div style={{ padding: '10px 20px', background: net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Net </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: net >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
              </span>
            </div>
          </div>
        )}
      </>
    );
  };

  /* ─────────── TAB 4: Balance Sheet ─────────── */
  const renderBalanceSheet = () => {
    if (!tabData?.assets) return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
        No balance sheet data for selected date. Try adjusting the date filter.
      </div>
    );
    const { assets, liabilities, equity, check } = tabData;
    return (
      <TwoCol>
        <ReportCard>
          <SectionHeader title="Assets" color="#3b82f6" />
          <FinanceRow label="Cash in Hand"       amount={assets.cash_in_hand}       indent />
          <FinanceRow label="Bank Balance"        amount={assets.bank_balance}        indent />
          <FinanceRow label="Accounts Receivable" amount={assets.accounts_receivable} indent />
          <FinanceRow label="Inventory Value"     amount={assets.inventory_value}     indent />
          <FinanceRow label="Total Assets"        amount={assets.total_assets}        isTotal color="#3b82f6" />
        </ReportCard>
        <ReportCard>
          <SectionHeader title="Liabilities" color="#ef4444" />
          <FinanceRow label="Accounts Payable"  amount={liabilities.accounts_payable}  indent />
          <FinanceRow label="Loan Payable"      amount={liabilities.loan_payable}      indent />
          <FinanceRow label="Chit Liability"    amount={liabilities.chit_liability}    indent />
          <FinanceRow label="Total Liabilities" amount={liabilities.total_liabilities} isTotal color="#ef4444" />
          <SectionGap />
          <SectionHeader title="Equity" color="#8b5cf6" />
          <FinanceRow label="Proprietor Capital" amount={equity.proprietor_capital} indent />
          <FinanceRow label="Retained Earnings"  amount={equity.retained_earnings}  indent />
          <FinanceRow label="Total Equity"       amount={equity.total_equity}       isTotal color="#8b5cf6" />
          {!check?.balanced && (
            <div style={{ padding: '8px 14px', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
              ⚠ Unreconciled: {fmt(check?.difference)}
            </div>
          )}
        </ReportCard>
      </TwoCol>
    );
  };

  /* ─────────── TAB 6: True Performance ─────────── */
  const renderTruePerformance = () => {
    if (!tabData?.inflows) return null;
    const { inflows, outflows } = tabData;
    return (
      <>
        <KPIGrid cards={[
          { label: 'Total Inflow',    value: tabSummary.total_inflow    || 0, color: '#10b981', border: '#bbf7d0' },
          { label: 'Total Outflow',   value: tabSummary.total_outflow   || 0, color: '#ef4444', border: '#fecaca' },
          { label: 'Net Position',    value: tabSummary.net_position    || 0, color: (tabSummary.net_position || 0) >= 0 ? '#10b981' : '#ef4444', border: '#e0e7ff' },
          { label: 'Cash + Bank',     value: tabSummary.cash_bank_balance || 0, color: '#3b82f6', border: '#bfdbfe' },
          { label: 'Receivables',     value: tabSummary.outstanding_receivables || 0, color: '#f59e0b', border: '#fef3c7' },
          { label: 'Business Value',  value: tabSummary.total_business_value    || 0, color: '#7c3aed', border: '#ede9fe' },
        ]} />
        <TwoCol>
          <ReportCard>
            <SectionHeader title="Total Money In" color="#10b981" />
            {inflows.map((r, i) => <FinanceRow key={i} label={r.label} amount={r.amount} indent />)}
            <FinanceRow label="Total Inflow" amount={tabSummary.total_inflow} isTotal color="#10b981" />
          </ReportCard>
          <ReportCard>
            <SectionHeader title="Total Money Out" color="#ef4444" />
            {outflows.map((r, i) => <FinanceRow key={i} label={r.label} amount={r.amount} indent />)}
            <FinanceRow label="Total Outflow" amount={tabSummary.total_outflow} isTotal color="#ef4444" />
          </ReportCard>
        </TwoCol>
      </>
    );
  };

  /* ─────────── TAB 7: Proprietor A/C ─────────── */
  const renderProprietorCapital = () => {
    if (!tabData?.debit) return null;
    const { debit, credit } = tabData;
    const totalDebit  = debit.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const totalCredit = credit.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    return (
      <>
        <KPIGrid cards={[
          { label: 'Capital Invested', value: tabSummary.capital_intro      || 0, color: '#10b981', border: '#bbf7d0' },
          { label: 'Drawings Taken',   value: tabSummary.drawings           || 0, color: '#ef4444', border: '#fecaca' },
          { label: 'Net Capital',      value: tabSummary.net_capital        || 0, color: '#6366f1', border: '#e0e7ff' },
          { label: 'Personal Rcpts',   value: tabSummary.total_personal_receipts || 0, color: '#7c3aed', border: '#ede9fe' },
          { label: 'Closing Balance',  value: tabSummary.closing_balance    || 0, color: '#3b82f6', border: '#bfdbfe' },
        ]} />
        <TwoCol>
          <ReportCard>
            <div style={{ background: '#fee2e2', padding: '10px 14px', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>
              DEBIT (Outflow)
            </div>
            {debit.map((r, i) => <FinanceRow key={i} label={r.label} amount={r.amount} indent />)}
            <FinanceRow label="Total Debit" amount={totalDebit} isTotal color="#ef4444" />
          </ReportCard>
          <ReportCard>
            <div style={{ background: '#dcfce7', padding: '10px 14px', fontWeight: 700, fontSize: 13, color: '#15803d' }}>
              CREDIT (Inflow)
            </div>
            {credit.map((r, i) => <FinanceRow key={i} label={r.label} amount={r.amount} indent />)}
            <FinanceRow label="Total Credit" amount={totalCredit} isTotal color="#10b981" />
          </ReportCard>
        </TwoCol>
      </>
    );
  };

  /* ─────────── CHARTS ─────────── */
  const renderChart = () => {
    if (activeTab === 0 && tabData?.total_revenue !== undefined) {
      const d = tabData;
      const chartData = [
        { name: 'Invoice Revenue',   value: d.invoice_revenue,                              type: 'income'  },
        { name: 'Personal Receipts', value: d.personal_receipt_revenue,                     type: 'income'  },
        { name: 'Purchases',         value: d.total_cogs,                                   type: 'expense' },
        { name: 'Salary (Cash)',     value: d.salary_cash,                                  type: 'expense' },
        { name: 'Salary (Personal)', value: d.salary_personal,                              type: 'prop'    },
        { name: 'Chit Payments',     value: (d.chit_cash || 0) + (d.chit_personal || 0),   type: 'expense' },
        { name: 'Broker',            value: (d.broker_cash || 0) + (d.broker_personal || 0), type: 'expense' },
        { name: 'Loan Interest',     value: (d.interest_cash || 0) + (d.interest_personal || 0), type: 'expense' },
      ].filter(row => row.value > 0);
      return (
        <ChartCard title="P&L Overview" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 10, right: 20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={55} />
              <YAxis tickFormatter={yAxisFmt} tick={{ fontSize: 10 }} />
              <Tooltip formatter={tooltipFmt} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((row, i) => (
                  <Cell key={i} fill={row.type === 'income' ? INFLOW_COLOR : row.type === 'prop' ? PROP_COLOR : OUTFLOW_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    if ((activeTab === 1 || activeTab === 2) && Array.isArray(tabData) && tabData.length > 0) {
      return (
        <ChartCard title={activeTab === 1 ? 'Cash Flow Breakdown' : 'Fund Flow Analysis'} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tabData} margin={{ left: 10, right: 20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={55} />
              <YAxis tickFormatter={yAxisFmt} tick={{ fontSize: 10 }} />
              <Tooltip formatter={tooltipFmt} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {tabData.map((row, i) => (
                  <Cell key={i} fill={row.type === 'inflow' ? INFLOW_COLOR : row.type === 'financing' ? PROP_COLOR : OUTFLOW_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    if (activeTab === 5 && Array.isArray(tabData) && tabData.length > 0) {
      return (
        <ChartCard title={`Income vs Expense Trend ${year}`} height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tabData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={yAxisFmt} tick={{ fontSize: 10 }} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Bar dataKey="total_income"  fill={INFLOW_COLOR}  name="Income"       radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_expense" fill={OUTFLOW_COLOR} name="Expense"      radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="capital_intro" stroke={PROP_COLOR} name="Capital Intro" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="drawings"      stroke="#f59e0b"    name="Drawings"      strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    if (activeTab === 6 && tabData?.inflows) {
      const all = [
        ...tabData.inflows.map(r => ({ ...r, flowType: 'inflow' })),
        ...tabData.outflows.map(r => ({ ...r, flowType: 'outflow' })),
      ].filter(r => r.amount > 0);
      return (
        <ChartCard title="True Business Performance" height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={all} layout="vertical" margin={{ left: 160, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={yAxisFmt} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={155} />
              <Tooltip formatter={tooltipFmt} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {all.map((row, i) => <Cell key={i} fill={row.flowType === 'inflow' ? INFLOW_COLOR : OUTFLOW_COLOR} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    if (activeTab === 10 && Array.isArray(tabData) && tabData.length > 0) {
      return (
        <ChartCard title="Budget vs Actual" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tabData} margin={{ left: 10, right: 20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={55} />
              <YAxis tickFormatter={yAxisFmt} tick={{ fontSize: 10 }} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Bar dataKey="budget" fill="#c7d2fe" name="Budget" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }
    return null;
  };

  const showFilter = ![5, 10].includes(activeTab);
  const tableRows = Array.isArray(tabData) ? tabData : [];

  return (
    <ReportShell
      title="Finance Reports"
      subtitle="P&L, Cash Flow, Balance Sheet, Proprietor Account and more"
      breadcrumb={[
        { label: 'Home', path: '/dashboard' },
        { label: 'Reports', path: '/reports' },
        { label: 'Finance' },
      ]}
    >
      {/* Tab bar */}
      <div className="report-tabs" style={{ overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === i ? 600 : 400,
            color: activeTab === i ? '#3b82f6' : '#6b7280',
            borderBottom: activeTab === i ? '2px solid #3b82f6' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Date filter */}
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
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Year:</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 90 }} />
          <button onClick={() => fetchTab(5, filters)}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
            Load
          </button>
        </div>
      )}

      {/* Proprietor txn type filter */}
      {activeTab === 8 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'capital_intro', 'drawing', 'personal_receipt', 'personal_payment'].map(t => (
            <button key={t} onClick={() => { setPropTxnType(t); fetchTab(8, { ...filters, type: t }); }}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 12,
                fontWeight: propTxnType === t ? 700 : 400,
                background: propTxnType === t ? '#7c3aed' : '#f5f3ff',
                color: propTxnType === t ? '#fff' : '#7c3aed',
                borderColor: '#7c3aed',
              }}>
              {t === 'all' ? 'All' : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab content ── */}
      {activeTab === 0 && renderPL()}
      {(activeTab === 1 || activeTab === 2) && renderFlow()}
      {activeTab === 4 && renderBalanceSheet()}
      {activeTab === 6 && renderTruePerformance()}
      {activeTab === 7 && renderProprietorCapital()}

      {/* Chart */}
      <div style={{ marginBottom: 20 }}>{renderChart()}</div>

      {/* Data tables */}
      {[3, 5, 8, 9, 10].includes(activeTab) && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>Detail View</h3>
            <ExportButtons data={tableRows} filename={`finance-${TABS[activeTab].toLowerCase().replace(/[\s/&]+/g, '-')}`} />
          </div>
          <DataTable
            columns={
              activeTab === 3  ? profitabilityColumns :
              activeTab === 5  ? incomeTrendColumns   :
              activeTab === 8  ? propTxnColumns       :
              activeTab === 9  ? ratioColumns         :
              activeTab === 10 ? budgetColumns        : []
            }
            data={tableRows}
            loading={loading}
            emptyText="No data for selected period"
          />
        </>
      )}
    </ReportShell>
  );
};

export default FinanceReports;
