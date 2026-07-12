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

const SECTION_DEFAULTS = {
    revenue:          { divider_title: 'Revenue Trend', chart_ref: 'revenue', insight_headline: 'Revenue over time', insight_narrative: '' },
    profitability:    { divider_title: 'Profitability', chart_ref: 'gross_profit', insight_headline: 'Gross profit over time', insight_narrative: '' },
    customers:        { divider_title: 'Customer Growth', chart_ref: 'new_customers', insight_headline: 'New customers over time', insight_narrative: '' },
    operations_risk:  { divider_title: 'Operations & Spend', chart_ref: 'expense_breakdown', insight_headline: 'Where the money went', insight_narrative: '' },
};
const SECTION_ORDER = ['revenue', 'profitability', 'customers', 'operations_risk'];

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
    return { ...SECTION_DEFAULTS[key], ...fromAi };
}

function riskColor(level) {
    return level === 'high' ? BRAND.danger : level === 'medium' ? BRAND.warn : BRAND.accent2;
}

function addFooter(slide, company, periodTitle) {
    slide.addText(`${company} — ${periodTitle} Growth Study`, {
        x: 0.4, y: 7.15, w: 8, h: 0.3, fontSize: 9, color: BRAND.textMuted, fontFace: FONT_FACE,
    });
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
    const kpiMap = kpiLabelMap(metrics);
    const outline = aiOutline || {};

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
        slide.addText(metrics.company_name.toUpperCase(), {
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

    // ── 2. Executive summary ─────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Executive Summary', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 24, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.3, w: 11.6, h: 1.6, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 } });
        slide.addText(outline.executive_summary || 'Growth summary unavailable.', {
            x: 0.9, y: 1.5, w: 11, h: 1.2, fontSize: 15, italic: true, color: BRAND.text, fontFace: FONT_FACE, valign: 'middle',
            autoFit: true,
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
        addFooter(slide, metrics.company_name, periodTitle);
    }

    // ── 3. Section divider + chart pairs ─────────────────────────────────
    SECTION_ORDER.forEach((key) => {
        const section = getSection(outline, key);

        // Divider slide
        {
            const slide = pptx.addSlide();
            slide.background = { color: BRAND.accent };
            slide.addText(section.divider_title, {
                x: 0.6, y: 3.1, w: 11.5, h: 1.2, fontSize: 34, bold: true, color: BRAND.white, fontFace: FONT_FACE,
            });
        }

        // Chart slide
        {
            const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
            slide.addText(section.insight_headline, { x: 0.6, y: 0.35, w: 11.5, h: 0.55, fontSize: 20, bold: true, color: BRAND.text, fontFace: FONT_FACE });

            let chartType, chartData, chartOpts = {
                x: 0.6, y: 1.05, w: 7.1, h: 4.6, showLegend: false, chartColors: [BRAND.accent],
                catAxisLabelFontSize: 9, valAxisLabelFontFace: FONT_FACE, catAxisLabelFontFace: FONT_FACE,
                dataLabelFontFace: FONT_FACE,
            };

            if (section.chart_ref === 'expense_breakdown') {
                const rows = metrics.expense_breakdown.length > 0 ? metrics.expense_breakdown : [{ category: 'No data', value: 0 }];
                chartType = pptx.ChartType.doughnut;
                chartData = [{ name: 'Expenses', labels: rows.map(r => r.category), values: rows.map(r => r.value) }];
                chartOpts = { ...chartOpts, showLegend: true, legendPos: 'r', chartColors: EXPENSE_PALETTE };
            } else {
                const series = metrics.series[section.chart_ref] || [];
                const isBar = section.chart_ref === 'new_customers';
                chartType = isBar ? pptx.ChartType.bar : pptx.ChartType.line;
                chartData = [{ name: section.divider_title, labels: series.map(p => p.period_label), values: series.map(p => p.value) }];
                if (!isBar) chartOpts.lineSize = 3;
            }
            slide.addChart(chartType, chartData, chartOpts);

            slide.addText(section.insight_narrative, {
                x: 8.0, y: 1.05, w: 4.7, h: 3.2, fontSize: 12, color: BRAND.text, fontFace: FONT_FACE, valign: 'top', autoFit: true,
            });

            const callouts = (section.kpi_callouts || []).slice(0, 3);
            callouts.forEach((label, i) => {
                const value = lookupKpiValue(kpiMap, label);
                const y = 4.4 + i * 0.65;
                slide.addShape(pptx.ShapeType.roundRect, { x: 8.0, y, w: 4.7, h: 0.55, fill: { color: BRAND.white }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
                slide.addText(
                    value ? `${label}: ${value}` : String(label),
                    { x: 8.15, y, w: 4.4, h: 0.55, fontSize: 11, bold: true, color: BRAND.accent, fontFace: FONT_FACE, valign: 'middle' }
                );
            });
            addFooter(slide, metrics.company_name, periodTitle);
        }
    });

    // ── 4. Risk / health ──────────────────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Business Health & Risk Indicators', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });

        const rows = [
            [
                { text: 'Indicator', options: { bold: true, color: BRAND.white, fill: { color: BRAND.text } } },
                { text: 'Value', options: { bold: true, color: BRAND.white, fill: { color: BRAND.text } } },
                { text: 'Risk', options: { bold: true, color: BRAND.white, fill: { color: BRAND.text } } },
                { text: 'What it means', options: { bold: true, color: BRAND.white, fill: { color: BRAND.text } } },
            ],
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
        addFooter(slide, metrics.company_name, periodTitle);
    }

    // ── 5. Closing / recommendations ─────────────────────────────────────
    {
        const slide = pptx.addSlide({ masterName: 'CONTENT_MASTER' });
        slide.addText('Verdict & Recommendations', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 22, bold: true, color: BRAND.text, fontFace: FONT_FACE });
        slide.addText(outline.closing?.overall_verdict || '', {
            x: 0.6, y: 1.05, w: 11.6, h: 0.7, fontSize: 14, italic: true, color: BRAND.accent, fontFace: FONT_FACE, autoFit: true,
        });

        const priorityColor = { High: BRAND.danger, Medium: BRAND.warn, Low: BRAND.accent2 };
        const recs = (outline.closing?.recommendations || []).slice(0, 5);
        recs.forEach((rec, i) => {
            const y = 1.95 + i * 0.95;
            slide.addShape(pptx.ShapeType.ellipse, { x: 0.6, y, w: 0.45, h: 0.45, fill: { color: priorityColor[rec.priority] || BRAND.accent } });
            slide.addText(String(i + 1), { x: 0.6, y, w: 0.45, h: 0.45, align: 'center', valign: 'middle', color: BRAND.white, bold: true, fontSize: 14, fontFace: FONT_FACE });
            slide.addText(rec.title, { x: 1.25, y: y - 0.05, w: 10.8, h: 0.4, fontSize: 14, bold: true, color: BRAND.text, fontFace: FONT_FACE });
            slide.addText(rec.detail, { x: 1.25, y: y + 0.32, w: 10.8, h: 0.5, fontSize: 11, color: BRAND.textMuted, fontFace: FONT_FACE, autoFit: true });
        });
        slide.addText(`Prepared by ${metrics.company_name} — Powered by AI`, {
            x: 0.6, y: 7.15, w: 8, h: 0.3, fontSize: 9, color: BRAND.textMuted, fontFace: FONT_FACE,
        });
    }

    return pptx;
}
