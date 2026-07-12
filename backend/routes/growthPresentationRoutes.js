// backend/routes/growthPresentationRoutes.js
import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { getGrowthMetrics } from '../utils/growthMetrics.js';
import { buildGrowthDeck } from '../utils/growthDeckBuilder.js';

const router = express.Router();

const PERIOD_TITLES = { weekly: 'Weekly', monthly: 'Monthly', annual: 'Annual' };

function buildPrompt(metrics, period) {
    const periodTitle = PERIOD_TITLES[period] || 'Monthly';
    return `You are a business analyst preparing a ${periodTitle.toLowerCase()} growth study presentation for ${metrics.company_name}, a wholesale surplus knitwear business in Tiruppur, Tamil Nadu, India (fresh and mistake/surplus garment pieces, multiple branches, wholesale buyers across Tamil Nadu).

Here is the already-calculated business data for this ${periodTitle.toLowerCase()} study. Use ONLY the numbers provided below. Do not invent, estimate, or restate any figures yourself — when you need to reference a metric, refer to it BY NAME (e.g. "Total Revenue", "Revenue Growth"), never print a number. Your job is narrative insight — what the trend means and why it matters for this business — not calculation.

DATA:
${JSON.stringify({
    period_range: metrics.series.revenue.length
        ? `${metrics.series.revenue[0].period_label} to ${metrics.series.revenue[metrics.series.revenue.length - 1].period_label}`
        : 'N/A',
    summary_kpis: metrics.summary_kpis,
    revenue_trend: metrics.series.revenue.map(p => ({ period: p.period_label, value: p.value })),
    gross_profit_trend: metrics.series.gross_profit.map(p => ({ period: p.period_label, value: p.value })),
    new_customers_trend: metrics.series.new_customers.map(p => ({ period: p.period_label, value: p.value })),
    expense_breakdown: metrics.expense_breakdown,
    risk_indicators: metrics.risk_indicators,
}, null, 2)}

Respond ONLY in this exact JSON format with no extra text, no markdown fences:
{
  "deck_title": "string — e.g. '${metrics.company_name} — ${periodTitle} Growth Study'",
  "cover_subtitle": "string — one-line positioning subtitle",
  "executive_summary": "2-3 sentences summarizing the whole period, no numbers restated",
  "sections": [
    { "section_key": "revenue", "divider_title": "string", "chart_ref": "revenue", "insight_headline": "string, punchy one-liner", "insight_narrative": "2-4 sentences: what the trend means, why it's happening, business implication", "kpi_callouts": ["Total Revenue", "Revenue Growth"] },
    { "section_key": "profitability", "divider_title": "string", "chart_ref": "gross_profit", "insight_headline": "string", "insight_narrative": "2-4 sentences", "kpi_callouts": ["Gross Profit"] },
    { "section_key": "customers", "divider_title": "string", "chart_ref": "new_customers", "insight_headline": "string", "insight_narrative": "2-4 sentences", "kpi_callouts": ["Total Customers", "New Customers"] },
    { "section_key": "operations_risk", "divider_title": "string", "chart_ref": "expense_breakdown", "insight_headline": "string", "insight_narrative": "2-4 sentences", "kpi_callouts": ["Receivables", "Payables"] }
  ],
  "closing": {
    "overall_verdict": "1-2 sentence health verdict",
    "recommendations": [
      { "title": "string", "detail": "1-2 sentence actionable recommendation", "priority": "High" }
    ]
  }
}
Return exactly these 4 section_key values, in this order: revenue, profitability, customers, operations_risk. Return 3-5 recommendations, each with priority High, Medium, or Low.`;
}

async function callClaudeForOutline(metrics, period) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured on server. Add it to Railway environment variables.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: buildPrompt(metrics, period) }],
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Claude API error:', response.status, errText);
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
        console.error('Failed to parse Claude response:', text);
        throw new Error('Claude returned an unexpected format. Try again.');
    }
}

// ─── GET /api/reports/growth/metrics ─────────────────────────────────────────
router.get('/metrics', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const period = req.query.period;
        const metrics = await getGrowthMetrics(companyId, period);
        res.json(metrics);
    } catch (e) {
        console.error('GET /reports/growth/metrics error:', e.message);
        res.status(500).json({ error: 'Failed to load growth metrics' });
    }
});

// ─── POST /api/reports/growth/presentation ───────────────────────────────────
router.post('/presentation', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const period = req.body?.period;
        const metrics = await getGrowthMetrics(companyId, period);
        const resolvedPeriod = metrics.period;

        const outline = await callClaudeForOutline(metrics, resolvedPeriod);
        const pptx = buildGrowthDeck(metrics, outline, resolvedPeriod);
        const buffer = await pptx.write({ outputType: 'nodebuffer' });

        const safeCompany = metrics.company_name.replace(/[^a-zA-Z0-9]+/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `${safeCompany}_Growth_Study_${resolvedPeriod}_${dateStr}.pptx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (e) {
        console.error('POST /reports/growth/presentation error:', e.message);
        res.status(500).json({ error: e.message || 'Failed to generate presentation' });
    }
});

export default router;
