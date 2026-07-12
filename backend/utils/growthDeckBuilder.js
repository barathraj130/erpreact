// backend/utils/growthDeckBuilder.js
import pptxgen from 'pptxgenjs';

const BRAND = {
    primary: '1E293B',   // slate-900 — cover / dark surfaces
    accent: '4F46E5',    // indigo-600 — matches the AI Repayment Ideas header, ties AI features together
    accent2: '10B981',   // emerald-500 — growth / positive
    warn: 'F59E0B',      // amber-500 — caution
    danger: 'EF4444',    // red-500 — risk
    light: 'F8FAFC',     // slate-50 — content slide background
    text: '1E293B',
    textMuted: '64748B',
    white: 'FFFFFF',
};
const FONT_FACE = 'Calibri';
const EXPENSE_PALETTE = ['4F46E5', '10B981', 'F59E0B', 'EF4444', '0EA5E9', '8B5CF6', 'EC4899', '64748B'];
const PERIOD_TITLES = { weekly: 'Weekly', monthly: 'Monthly', annual: 'Annual' };

const TOPIC_DEFAULTS = {
    revenue:        { divider_title: 'Revenue Trend', chart_ref: 'revenue', insight_headline: 'Revenue over time', insight_narrative: '', takeaways: [] },
    profitability:  { divider_title: 'Profitability', chart_ref: 'gross_profit', insight_headline: 'Gross profit over time', insight_narrative: '', takeaways: [] },
    customers:      { divider_title: 'Customer Growth', chart_ref: 'new_customers', insight_headline: 'New customers over time', insight_narrative: '', takeaways: [] },
    operations:     { divider_title: 'Spend & Operations', chart_ref: 'expense_breakdown', insight_headline: 'Where the money went', insight_narrative: '', takeaways: [] },
    purchases:      { divider_title: 'Purchase Trend', chart_ref: 'purchases', insight_headline: 'Purchases over time', insight_narrative: '', takeaways: [] },
    receivables:    { divider_title: 'Receivables & Payables', chart_ref: 'receivables_payables', insight_headline: 'What is owed, and what is due', insight_narrative: '', takeaways: [] },
};
const TOPIC_ORDER = ['revenue', 'profitability', 'customers', 'operations', 'purchases', 'receivables'];

function fmtINR(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

function periodRangeLabel(metrics) {
    const series = metrics.series.revenue;
    if (!series || series.length === 0) return '';
    return `${series[0].period_label} – ${series[series.length - 1].period_label}`;
}

function kpiLabelMap(metrics) {
    const k = metrics.summary_kpis;
    return {
        'total revenue': fmtINR(k.total_revenue),
        'revenue': fmtINR(k.total_revenue),
        'total purchases': fmtINR(k.total_purchases),
        'purchases': fmtINR(k.total_purchases),
        'gross profit': fmtINR(k.total_gross_profit),
        'profit': fmtINR(k.total_gross_profit),
        'revenue growth': k.revenue_growth_pct != null ? `${k.revenue_growth_pct}%` : 'N/A',
        'growth': k.revenue_growth_pct != null ? `${k.revenue_growth_pct}%` : 'N/A',
        'average revenue': fmtINR(k.avg_bucket_revenue),
        'total customers': String(k.total_customers),
        'customers': String(k.total_customers),
        'new customers': String(k.new_customers_in_window),
        'receivables': fmtINR(k.receivables),
        'payables': fmtINR(k.payables),
    };
}

function lookupKpiValue(map, label) {
    const key = String(label || '').toLowerCase().trim();
    if (map[key]) return map[key];
    const found = Object.keys(map).find(k => key.includes(k) || k.includes(key));
    return found ? map[found] : null;
}

function getSection(aiOutline, key) {
    const fromAi = (aiOutline?.sections || []).find(s => s.section_key === key) || {};
    return { ...TOPIC_DEFAULTS[key], ...fromAi };
}

function riskColor(level) {
    return level === 'high' ? BRAND.danger : level === 'medium' ? BRAND.warn : BRAND.accent2;
}

function addFooter(slide, company, periodTitle) {
    slide.addText(`${company} — ${periodTitle} Growth Study`, {
        x: 0.4, y: 7.15, w: 8, h: 0.3, fontSize: 9, color: BRAND.textMuted, fontFace: FONT_FACE,
    });
}

function tableHeaderCell(text, opts = {}) {
    return { text, options: { bold: true, color: BRAND.white, fill: { color: BRAND.text }, ...opts } };
}

// ── chart data resolution ────────────────────────────────────────────────
function seriesFor(metrics, chartRef) {
    if (chartRef === 'expense_breakdown') {
        const rows = metrics.expense_breakdown.length > 0 ? metrics.expense_breakdown : [{ category: 'No data', value: 0 }];
        return { labels: rows.map(r => r.category), values: rows.map(r => r.value) };
    }
    if (chartRef === 'receivables_payables') {
        return { labels: ['Receivables', 'Payables'], values: [metrics.summary_kpis.receivables || 0, metrics.summary_kpis.payables || 0] };
    }
    const series = metrics.series[chartRef] || [];
    return { labels: series.map(p => p.period_label), values: series.map(p => p.value) };
}

// ── section header + primary chart slide ─────────────────────────────────
function addTopicChartSlide(pptx, metrics, outline, topicKey, topicIdx, periodTitle, companyName) {
    const section = getSection(outline, topicKey);
    const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.05, fill: { color: BRAND.accent } });
    slide.addText(`${String(topicIdx + 1).padStart(2, '0')}`, {
        x: 0.5, y: 0.15, w: 1, h: 0.75, fontSize: 26, bold: true, color: 'C7D2FE', fontFace: FONT_FACE, valign: 'middle',
    });
    slide.addText(section.divider_title, {
        x: 1.4, y: 0.12, w: 10.5, h: 0.5, fontSize: 20, bold: true, color: BRAND.white, fontFace: FONT_FACE,
    });
    slide.addText(section.insight_headline, {
        x: 1.4, y: 0.58, w: 10.5, h: 0.4, fontSize: 12, italic: true, color: 'E0E7FF', fontFace: FONT_FACE,
    });

    const { labels, values } = seriesFor(metrics, section.chart_ref);
    let chartType, chartOpts = {
        x: 0.6, y: 1.35, w: 7.1, h: 5.6, showLegend: false, chartColors: [BRAND.accent],
        catAxisLabelFontSize: 9, valAxisLabelFontFace: FONT_FACE, catAxisLabelFontFace: FONT_FACE,
        dataLabelFontFace: FONT_FACE,
    };
    if (topicKey === 'operations') {
        chartType = pptx.ChartType.doughnut;
        chartOpts = { ...chartOpts, showLegend: true, legendPos: 'r', chartColors: EXPENSE_PALETTE };
    } else if (topicKey === 'customers') {
        chartType = pptx.ChartType.bar;
    } else if (topicKey === 'receivables') {
        chartType = pptx.ChartType.bar;
        chartOpts.chartColors = [BRAND.warn, BRAND.danger];
    } else {
        chartType = pptx.ChartType.line;
        chartOpts.lineSize = 3;
    }
    slide.addChart(chartType, [{ name: section.divider_title, labels, values }], chartOpts);

    slide.addText(section.insight_narrative, {
        x: 8.0, y: 1.35, w: 4.7, h: 3.4, fontSize: 12, color: BRAND.text, fontFace: FONT_FACE, valign: 'top', autoFit: true,
    });

    const kpiMap = kpiLabelMap(metrics);
    (section.kpi_callouts || []).slice(0, 3).forEach((label, i) => {
        const value = lookupKpiValue(kpiMap, label);
        const y = 4.9 + i * 0.65;
        slide.addShape(pptx.ShapeType.roundRect, { x: 8.0, y, w: 4.7, h: 0.55, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
        slide.addText(value ? `${label}: ${value}` : String(label), { x: 8.15, y, w: 4.4, h: 0.55, fontSize: 11, bold: true, color: BRAND.accent, fontFace: FONT_FACE, valign: 'middle' });
    });
    addFooter(slide, companyName, periodTitle);
}

// ── secondary "more detail" slide per topic ──────────────────────────────
function addPeriodDetailSlide(pptx, metrics, chartRef, title, periodTitle, companyName) {
    const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
    slide.addText(`${title} — Period by Period`, { x: 0.6, y: 0.4, w: 11.6, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });

    const series = metrics.series[chartRef] || [];
    const values = series.map(p => Number(p.value) || 0);
    const rows = [
        [tableHeaderCell('Period'), tableHeaderCell('Value', { align: 'right' })],
        ...series.map(p => ([{ text: p.period_label, options: { color: BRAND.text } }, { text: fmtINR(p.value), options: { color: BRAND.text, bold: true, align: 'right' } }])),
    ];
    slide.addTable(rows, { x: 0.6, y: 1.3, w: 6.3, colW: [3.3, 3], fontSize: 11, fontFace: FONT_FACE, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, autoPage: false });

    const max = values.length ? Math.max(...values) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    [
        { label: 'Highest Period', value: fmtINR(max) },
        { label: 'Lowest Period', value: fmtINR(min) },
        { label: 'Average per Period', value: fmtINR(avg) },
    ].forEach((s, i) => {
        const y = 1.3 + i * 1.35;
        slide.addShape(pptx.ShapeType.rect, { x: 7.3, y, w: 4.9, h: 1.15, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
        slide.addShape(pptx.ShapeType.rect, { x: 7.3, y, w: 4.9, h: 0.08, fill: { color: BRAND.accent } });
        slide.addText(s.value, { x: 7.3, y: y + 0.18, w: 4.9, h: 0.55, align: 'center', fontSize: 20, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        slide.addText(s.label, { x: 7.3, y: y + 0.75, w: 4.9, h: 0.35, align: 'center', fontSize: 11, color: BRAND.textMuted, fontFace: FONT_FACE });
    });
    addFooter(slide, companyName, periodTitle);
}

function addRevenueVsPurchasesSlide(pptx, metrics, periodTitle, companyName) {
    const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
    slide.addText('Revenue vs Purchases — Period Comparison', { x: 0.6, y: 0.4, w: 11.6, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
    const rev = metrics.series.revenue || [];
    const pur = metrics.series.purchases || [];
    const labels = rev.map(p => p.period_label);
    slide.addChart(pptx.ChartType.bar, [
        { name: 'Revenue', labels, values: rev.map(p => p.value) },
        { name: 'Purchases', labels, values: pur.map(p => p.value) },
    ], {
        x: 0.6, y: 1.3, w: 11.6, h: 5.6, barGrouping: 'clustered', showLegend: true, legendPos: 'b',
        chartColors: [BRAND.accent, BRAND.danger], catAxisLabelFontSize: 9,
        catAxisLabelFontFace: FONT_FACE, valAxisLabelFontFace: FONT_FACE, dataLabelFontFace: FONT_FACE,
    });
    addFooter(slide, companyName, periodTitle);
}

function addExpenseRankingSlide(pptx, metrics, periodTitle, companyName) {
    const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
    slide.addText('Spend & Operations — Category Ranking', { x: 0.6, y: 0.4, w: 11.6, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
    const rows = [...metrics.expense_breakdown].sort((a, b) => b.value - a.value);
    const data = rows.length ? rows : [{ category: 'No data', value: 0 }];
    slide.addChart(pptx.ChartType.bar, [{ name: 'Expenses', labels: data.map(r => r.category), values: data.map(r => r.value) }], {
        x: 0.6, y: 1.3, w: 11.6, h: 5.6, barDir: 'bar', showLegend: false, chartColors: [BRAND.accent],
        catAxisLabelFontSize: 10, catAxisLabelFontFace: FONT_FACE, valAxisLabelFontFace: FONT_FACE, dataLabelFontFace: FONT_FACE,
    });
    addFooter(slide, companyName, periodTitle);
}

function addReceivablesDetailSlide(pptx, metrics, periodTitle, companyName) {
    const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
    slide.addText('Receivables & Payables — Position', { x: 0.6, y: 0.4, w: 11.6, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
    const k = metrics.summary_kpis;
    const netPosition = (k.receivables || 0) - (k.payables || 0);
    const tiles = [
        { label: 'Receivables (owed to us)', value: fmtINR(k.receivables), color: BRAND.warn },
        { label: 'Payables (we owe)', value: fmtINR(k.payables), color: BRAND.danger },
        { label: 'Net Position', value: fmtINR(netPosition), color: netPosition >= 0 ? BRAND.accent2 : BRAND.danger },
        { label: 'Gross Profit (context)', value: fmtINR(k.total_gross_profit), color: BRAND.accent },
    ];
    const tileW = 5.6, tileH = 2.2, gapX = 0.4, gapY = 0.3, startX = 0.6, startY = 1.4;
    tiles.forEach((t, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = startX + col * (tileW + gapX);
        const y = startY + row * (tileH + gapY);
        slide.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: tileH, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
        slide.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: 0.1, fill: { color: t.color } });
        slide.addText(t.value, { x, y: y + 0.5, w: tileW, h: 0.9, align: 'center', fontSize: 28, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        slide.addText(t.label, { x, y: y + 1.5, w: tileW, h: 0.5, align: 'center', fontSize: 12, color: BRAND.textMuted, fontFace: FONT_FACE });
    });
    addFooter(slide, companyName, periodTitle);
}

function addSecondarySlide(pptx, metrics, topicKey, periodTitle, companyName) {
    if (topicKey === 'profitability') return addRevenueVsPurchasesSlide(pptx, metrics, periodTitle, companyName);
    if (topicKey === 'operations') return addExpenseRankingSlide(pptx, metrics, periodTitle, companyName);
    if (topicKey === 'receivables') return addReceivablesDetailSlide(pptx, metrics, periodTitle, companyName);
    const titleMap = { revenue: 'Revenue', customers: 'New Customers', purchases: 'Purchases' };
    return addPeriodDetailSlide(pptx, metrics, TOPIC_DEFAULTS[topicKey].chart_ref, titleMap[topicKey] || TOPIC_DEFAULTS[topicKey].divider_title, periodTitle, companyName);
}

function addDeepDiveSlide(pptx, outline, topicKey, periodTitle, companyName) {
    const section = getSection(outline, topicKey);
    const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
    slide.addText(`${section.divider_title} — In Depth`, { x: 0.6, y: 0.4, w: 11.6, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.2, w: 11.6, h: 1.6, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
    slide.addText(section.insight_narrative || 'No additional narrative available.', {
        x: 0.9, y: 1.4, w: 11, h: 1.2, fontSize: 13, italic: true, color: BRAND.text, fontFace: FONT_FACE, valign: 'middle', autoFit: true,
    });
    (section.takeaways || []).slice(0, 4).forEach((t, i) => {
        const y = 3.2 + i * 0.85;
        slide.addShape(pptx.ShapeType.ellipse, { x: 0.6, y, w: 0.4, h: 0.4, fill: { color: BRAND.accent } });
        slide.addText('✓', { x: 0.6, y, w: 0.4, h: 0.4, align: 'center', valign: 'middle', color: BRAND.white, bold: true, fontFace: FONT_FACE });
        slide.addText(String(t), { x: 1.15, y: y - 0.08, w: 11, h: 0.7, fontSize: 13, color: BRAND.text, fontFace: FONT_FACE, valign: 'middle', autoFit: true });
    });
    addFooter(slide, companyName, periodTitle);
}

/**
 * Builds a pptxgenjs presentation from real aggregated numbers (`metrics`, from
 * getGrowthMetrics) and AI-authored narrative text (`aiOutline`). Every number on
 * every slide is read from `metrics` — `aiOutline` supplies only prose and labels,
 * never figures, so the deck can't reflect anything the AI invented.
 */
export function buildGrowthDeck(metrics, aiOutline, period) {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = metrics.company_name;
    pptx.company = metrics.company_name;

    const periodTitle = PERIOD_TITLES[period] || 'Monthly';
    const rangeLabel = periodRangeLabel(metrics);
    const outline = aiOutline || {};
    const companyName = metrics.company_name;

    pptx.defineSlideMaster({
        title: 'CONTENT_MASTER',
        background: { color: BRAND.light },
        objects: [
            { rect: { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: BRAND.accent } } },
        ],
    });

    // ── 1. Cover ──────────────────────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        slide.background = { color: BRAND.primary };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 3.55, w: 1.4, h: 0.09, fill: { color: BRAND.accent } });
        slide.addText(companyName.toUpperCase(), {
            x: 0.6, y: 0.5, w: 9, h: 0.5, fontSize: 14, bold: true, color: BRAND.accent, fontFace: FONT_FACE, charSpacing: 2,
        });
        slide.addText(outline.deck_title || `${periodTitle} Growth Study`, {
            x: 0.6, y: 2.6, w: 11.5, h: 1.4, fontSize: 40, bold: true, color: BRAND.white, fontFace: FONT_FACE,
        });
        slide.addText(outline.cover_subtitle || `A data-driven look at ${periodTitle.toLowerCase()} performance`, {
            x: 0.6, y: 3.9, w: 11, h: 0.6, fontSize: 16, color: 'CBD5E1', fontFace: FONT_FACE,
        });
        slide.addText(`${rangeLabel}  ·  Generated ${new Date(metrics.generated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, {
            x: 0.6, y: 6.7, w: 11, h: 0.4, fontSize: 11, color: BRAND.textMuted, fontFace: FONT_FACE,
        });
    }

    // ── 2. Table of contents ─────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Table of Contents', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 24, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        const items = [
            'Executive Summary', 'Key Highlights',
            ...TOPIC_ORDER.map(k => getSection(outline, k).divider_title),
            'Period Comparison', 'Business Health & Risk Indicators', 'Verdict & Recommendations', 'Data Notes & Methodology',
        ];
        const half = Math.ceil(items.length / 2);
        items.forEach((label, i) => {
            const col = i < half ? 0 : 1;
            const row = i < half ? i : i - half;
            const x = 0.6 + col * 6.1;
            const y = 1.4 + row * 0.62;
            slide.addText(`${i + 1}.`, { x, y, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: BRAND.accent, fontFace: FONT_FACE });
            slide.addText(label, { x: x + 0.5, y, w: 5.3, h: 0.5, fontSize: 14, color: BRAND.text, fontFace: FONT_FACE, valign: 'middle' });
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 3. Executive summary ─────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Executive Summary', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 24, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.3, w: 11.6, h: 1.6, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
        slide.addText(outline.executive_summary || 'Growth summary unavailable.', {
            x: 0.9, y: 1.5, w: 11, h: 1.2, fontSize: 15, italic: true, color: BRAND.text, fontFace: FONT_FACE, valign: 'middle', autoFit: true,
        });

        const tiles = [
            { label: 'Total Revenue', value: fmtINR(metrics.summary_kpis.total_revenue) },
            { label: 'Gross Profit', value: fmtINR(metrics.summary_kpis.total_gross_profit) },
            { label: 'Revenue Growth', value: metrics.summary_kpis.revenue_growth_pct != null ? `${metrics.summary_kpis.revenue_growth_pct}%` : 'N/A' },
            { label: 'Total Customers', value: String(metrics.summary_kpis.total_customers) },
        ];
        const tileW = 2.75, gap = 0.2, startX = 0.6;
        tiles.forEach((t, i) => {
            const x = startX + i * (tileW + gap);
            slide.addShape(pptx.ShapeType.rect, { x, y: 3.3, w: tileW, h: 1.6, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
            slide.addShape(pptx.ShapeType.rect, { x, y: 3.3, w: tileW, h: 0.08, fill: { color: BRAND.accent } });
            slide.addText(t.value, { x, y: 3.55, w: tileW, h: 0.7, align: 'center', fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
            slide.addText(t.label, { x, y: 4.25, w: tileW, h: 0.5, align: 'center', fontSize: 11, color: BRAND.textMuted, fontFace: FONT_FACE });
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 4. Key highlights ─────────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Key Highlights', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 24, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        const k = metrics.summary_kpis;
        const tiles = [
            { label: 'Total Revenue', value: fmtINR(k.total_revenue) },
            { label: 'Total Purchases', value: fmtINR(k.total_purchases) },
            { label: 'Gross Profit', value: fmtINR(k.total_gross_profit) },
            { label: 'Revenue Growth', value: k.revenue_growth_pct != null ? `${k.revenue_growth_pct}%` : 'N/A' },
            { label: 'Avg Period Revenue', value: fmtINR(k.avg_bucket_revenue) },
            { label: 'Total Customers', value: String(k.total_customers) },
            { label: 'New Customers', value: String(k.new_customers_in_window) },
            { label: 'Receivables', value: fmtINR(k.receivables) },
            { label: 'Payables', value: fmtINR(k.payables) },
        ];
        const cols = 3, tileW = 3.75, tileH = 1.7, gapX = 0.15, gapY = 0.2, startX = 0.6, startY = 1.25;
        tiles.forEach((t, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const x = startX + col * (tileW + gapX);
            const y = startY + row * (tileH + gapY);
            slide.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: tileH, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
            slide.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: 0.08, fill: { color: BRAND.accent } });
            slide.addText(t.value, { x, y: y + 0.35, w: tileW, h: 0.7, align: 'center', fontSize: 20, bold: true, color: BRAND.text, fontFace: FONT_FACE });
            slide.addText(t.label, { x, y: y + 1.1, w: tileW, h: 0.5, align: 'center', fontSize: 11, color: BRAND.textMuted, fontFace: FONT_FACE });
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 5. Six topics × 3 slides each (chart, secondary detail, deep dive) ──
    TOPIC_ORDER.forEach((key, idx) => {
        addTopicChartSlide(pptx, metrics, outline, key, idx, periodTitle, companyName);
        addSecondarySlide(pptx, metrics, key, periodTitle, companyName);
        addDeepDiveSlide(pptx, outline, key, periodTitle, companyName);
    });

    // ── 6. Period comparison table ───────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Period Comparison — All Metrics', { x: 0.6, y: 0.4, w: 11.6, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        const rev = metrics.series.revenue || [];
        const pur = metrics.series.purchases || [];
        const gp = metrics.series.gross_profit || [];
        const ncByLabel = new Map((metrics.series.new_customers || []).map(p => [p.period_label, p.value]));
        const rows = [
            [tableHeaderCell('Period'), tableHeaderCell('Revenue', { align: 'right' }), tableHeaderCell('Purchases', { align: 'right' }), tableHeaderCell('Gross Profit', { align: 'right' }), tableHeaderCell('New Customers', { align: 'right' })],
            ...rev.map((r, i) => ([
                { text: r.period_label, options: { color: BRAND.text } },
                { text: fmtINR(r.value), options: { color: BRAND.text, align: 'right' } },
                { text: fmtINR(pur[i]?.value || 0), options: { color: BRAND.text, align: 'right' } },
                { text: fmtINR(gp[i]?.value || 0), options: { color: BRAND.text, bold: true, align: 'right' } },
                { text: String(ncByLabel.get(r.period_label) || 0), options: { color: BRAND.text, align: 'right' } },
            ])),
        ];
        slide.addTable(rows, {
            x: 0.4, y: 1.2, w: 12.2, colW: [2.8, 2.5, 2.5, 2.6, 1.8],
            fontSize: 10.5, fontFace: FONT_FACE, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, autoPage: false,
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 7. Risk / health ──────────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Business Health & Risk Indicators', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        const rows = [
            [tableHeaderCell('Indicator'), tableHeaderCell('Value'), tableHeaderCell('Risk'), tableHeaderCell('What it means')],
            ...metrics.risk_indicators.map(r => ([
                { text: r.indicator, options: { color: BRAND.text } },
                { text: `${r.value}${r.unit}`, options: { color: BRAND.text, bold: true } },
                { text: r.risk_level.toUpperCase(), options: { color: BRAND.white, fill: { color: riskColor(r.risk_level) }, bold: true, align: 'center' } },
                { text: r.description, options: { color: BRAND.textMuted, fontSize: 10 } },
            ])),
        ];
        slide.addTable(rows, {
            x: 0.6, y: 1.3, w: 11.6, colW: [2.6, 1.6, 1.4, 6],
            fontSize: 12, fontFace: FONT_FACE, border: { type: 'solid', color: 'E2E8F0', pt: 1 }, autoPage: false,
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 8. Verdict ────────────────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Verdict', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 24, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.3, w: 11.6, h: 2.2, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
        slide.addText(outline.closing?.overall_verdict || '', {
            x: 0.9, y: 1.5, w: 11, h: 1.8, fontSize: 17, italic: true, color: BRAND.accent, fontFace: FONT_FACE, valign: 'middle', autoFit: true,
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 9. Recommendations (paginated, up to 3 per slide) ────────────────
    {
        const priorityColor = { High: BRAND.danger, Medium: BRAND.warn, Low: BRAND.accent2 };
        const recs = (outline.closing?.recommendations || []).slice(0, 6);
        const pages = [];
        for (let i = 0; i < recs.length; i += 3) pages.push(recs.slice(i, i + 3));
        if (pages.length === 0) pages.push([]);

        pages.forEach((pageRecs, pageIdx) => {
            const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
            const title = pages.length > 1 ? `Recommendations (${pageIdx + 1}/${pages.length})` : 'Recommendations';
            slide.addText(title, { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 24, bold: true, color: BRAND.text, fontFace: FONT_FACE });
            pageRecs.forEach((rec, i) => {
                const globalIdx = pageIdx * 3 + i;
                const y = 1.4 + i * 1.7;
                slide.addShape(pptx.ShapeType.ellipse, { x: 0.6, y, w: 0.5, h: 0.5, fill: { color: priorityColor[rec.priority] || BRAND.accent } });
                slide.addText(String(globalIdx + 1), { x: 0.6, y, w: 0.5, h: 0.5, align: 'center', valign: 'middle', color: BRAND.white, bold: true, fontSize: 16, fontFace: FONT_FACE });
                slide.addText(rec.title, { x: 1.3, y: y - 0.05, w: 10.6, h: 0.5, fontSize: 16, bold: true, color: BRAND.text, fontFace: FONT_FACE });
                slide.addText(rec.detail, { x: 1.3, y: y + 0.45, w: 10.6, h: 0.8, fontSize: 12, color: BRAND.textMuted, fontFace: FONT_FACE, autoFit: true });
                slide.addText((rec.priority || 'Medium').toUpperCase(), {
                    x: 1.3, y: y + 1.15, w: 2, h: 0.35, fontSize: 9, bold: true, color: BRAND.white,
                    fill: { color: priorityColor[rec.priority] || BRAND.accent }, align: 'center', valign: 'middle', fontFace: FONT_FACE,
                });
            });
            addFooter(slide, companyName, periodTitle);
        });
    }

    // ── 10. Data notes & methodology ─────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Data Notes & Methodology', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        const notes = [
            'All figures are computed directly from live transaction records — invoices, purchase bills, and the ledger — at the time this deck was generated.',
            'AI-authored text on each slide provides narrative context only; every number shown is calculated by the system, not estimated by the AI.',
            `Revenue growth compares this ${periodTitle.toLowerCase()} window against the immediately preceding window of equal length.`,
            'Receivables and payables reflect the outstanding balance as of the generation date, not the selected period.',
            `Generated ${new Date(metrics.generated_at).toLocaleString('en-IN')}.`,
        ];
        notes.forEach((n, i) => {
            const y = 1.4 + i * 0.95;
            slide.addShape(pptx.ShapeType.ellipse, { x: 0.6, y: y + 0.05, w: 0.16, h: 0.16, fill: { color: BRAND.accent } });
            slide.addText(n, { x: 1.0, y: y - 0.1, w: 11.2, h: 0.85, fontSize: 13, color: BRAND.text, fontFace: FONT_FACE, valign: 'top', autoFit: true });
        });
        addFooter(slide, companyName, periodTitle);
    }

    // ── 11. Thank you ─────────────────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        slide.background = { color: BRAND.primary };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 3.55, w: 1.4, h: 0.09, fill: { color: BRAND.accent } });
        slide.addText('Thank You', { x: 0.6, y: 3.0, w: 11.5, h: 1.2, fontSize: 36, bold: true, color: BRAND.white, fontFace: FONT_FACE });
        slide.addText(`${companyName} — ${periodTitle} Growth Study`, { x: 0.6, y: 4.1, w: 11.5, h: 0.5, fontSize: 14, color: 'CBD5E1', fontFace: FONT_FACE });
        slide.addText('Powered by AI · Every number verified against live records', {
            x: 0.6, y: 6.7, w: 11, h: 0.4, fontSize: 11, color: BRAND.textMuted, fontFace: FONT_FACE,
        });
    }

    return pptx;
}
