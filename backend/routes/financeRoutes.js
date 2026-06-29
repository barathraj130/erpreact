// backend/routes/financeRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// ─── GET /api/finance/loan-snapshot ──────────────────────────────────────────
// Collects all financial data Claude needs to generate repayment ideas
router.get('/loan-snapshot', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0];

        const [loans, sales, expenses, outstanding, cash, bank, customers, stock, pendingInvoices] = await Promise.all([
            // Total outstanding loan principal — no company filter (matches existing Loans page behaviour)
            db.pgGet(`
                SELECT
                    COALESCE(SUM(
                        GREATEST(0, l.principal_amount - COALESCE((
                            SELECT SUM(lp.principal_component) FROM loan_payments lp WHERE lp.loan_id = l.id
                        ), 0))
                    ), 0) AS total_loan,
                    COALESCE(SUM(
                        CASE
                            WHEN l.duration_months > 0 AND l.interest_rate > 0 THEN
                                ROUND(
                                    (GREATEST(0, l.principal_amount - COALESCE((
                                        SELECT SUM(lp.principal_component) FROM loan_payments lp WHERE lp.loan_id = l.id
                                    ), 0)) *
                                    (l.interest_rate/12/100) *
                                    POWER(1 + l.interest_rate/12/100, l.duration_months)) /
                                    NULLIF(POWER(1 + l.interest_rate/12/100, l.duration_months) - 1, 0)
                                , 2)
                            WHEN l.duration_months > 0 THEN
                                ROUND(
                                    GREATEST(0, l.principal_amount - COALESCE((
                                        SELECT SUM(lp.principal_component) FROM loan_payments lp WHERE lp.loan_id = l.id
                                    ), 0)) / l.duration_months
                                , 2)
                            ELSE 0
                        END
                    ), 0) AS monthly_emi
                FROM loans l
                WHERE l.status = 'ACTIVE'
            `),

            // Monthly sales from invoices
            db.pgGet(`
                SELECT COALESCE(SUM(total_amount), 0) AS monthly_sales
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(is_deleted, false) = false
                  AND COALESCE(is_nominal, false) = false
                  AND invoice_date >= $2 AND invoice_date <= $3
            `, [companyId, monthStart, today]),

            // Monthly expenses from transactions
            db.pgGet(`
                SELECT COALESCE(SUM(amount), 0) AS monthly_expenses
                FROM transactions
                WHERE company_id = $1
                  AND type IN ('EXPENSE', 'EXPENSE_PAYMENT', 'SALARY', 'WAGES', 'DAILY_WAGE')
                  AND COALESCE(date, created_at::date) >= $2
            `, [companyId, monthStart]).catch(() => ({ monthly_expenses: 0 })),

            // Customer outstanding (unpaid invoice balance)
            db.pgGet(`
                SELECT COALESCE(SUM(balance_due), 0) AS customer_outstanding
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(is_deleted, false) = false
                  AND balance_due > 0
            `, [companyId]).catch(() => ({ customer_outstanding: 0 })),

            // Cash balance (net from cash_ledger)
            db.pgGet(`
                SELECT
                    COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS balance
                FROM cash_ledger WHERE company_id = $1
            `, [companyId]),

            // Bank balance (net from bank_ledger)
            db.pgGet(`
                SELECT
                    COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS balance
                FROM bank_ledger WHERE company_id = $1
            `, [companyId]),

            // Active customer count
            db.pgGet(`
                SELECT COUNT(*) AS active_customers
                FROM users
                WHERE company_id = $1 AND role = 'customer' AND is_active = true
            `, [companyId]).catch(() => ({ active_customers: 0 })),

            // Stock value from production inventory (fresh + converted)
            db.pgGet(`
                SELECT COALESCE(SUM(pi.total_cost), 0) AS stock_value
                FROM production_inventory pi
                JOIN production_lots pl ON pl.id = pi.lot_id
                WHERE pl.company_id = $1
                  AND pl.is_deleted = false
                  AND pi.stock_type IN ('fresh', 'fresh_converted', 'mistake')
            `, [companyId]).catch(() => ({ stock_value: 0 })),

            // Pending invoice count
            db.pgGet(`
                SELECT COUNT(*) AS pending_invoices
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(is_deleted, false) = false
                  AND balance_due > 0
            `, [companyId]).catch(() => ({ pending_invoices: 0 })),
        ]);

        res.json({
            total_loan:            parseFloat(loans?.total_loan            || 0),
            monthly_emi:           parseFloat(loans?.monthly_emi           || 0),
            monthly_sales:         parseFloat(sales?.monthly_sales         || 0),
            monthly_expenses:      parseFloat(expenses?.monthly_expenses   || 0),
            customer_outstanding:  parseFloat(outstanding?.customer_outstanding || 0),
            cash_balance:          parseFloat(cash?.balance                || 0),
            bank_balance:          parseFloat(bank?.balance                || 0),
            active_customers:      parseInt(customers?.active_customers    || 0),
            stock_value:           parseFloat(stock?.stock_value           || 0),
            pending_invoices:      parseInt(pendingInvoices?.pending_invoices || 0),
        });
    } catch (e) {
        console.error('GET /finance/loan-snapshot error:', e.message);
        res.json({
            total_loan: 0, monthly_emi: 0, monthly_sales: 0, monthly_expenses: 0,
            customer_outstanding: 0, cash_balance: 0, bank_balance: 0,
            active_customers: 0, stock_value: 0, pending_invoices: 0,
        });
    }
});

// ─── POST /api/finance/loan-ideas ────────────────────────────────────────────
// Proxies Claude API call (keeps API key server-side)
router.post('/loan-ideas', authMiddleware, async (req, res) => {
    try {
        const { financialData } = req.body;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.json({ success: false, error: 'ANTHROPIC_API_KEY not configured on server. Add it to Railway environment variables.' });
        }

        const fd = financialData || {};
        const prompt = `You are a financial advisor for JBS Knit Wear, a wholesale surplus T-shirt business in Tiruppur, Tamil Nadu, India.

Here is the current financial snapshot:
- Total Loan Outstanding: ₹${fd.total_loan || 0}
- Monthly EMI: ₹${fd.monthly_emi || 0}
- Cash in Hand: ₹${fd.cash_balance || 0}
- Bank Balance: ₹${fd.bank_balance || 0}
- Monthly Sales (this month): ₹${fd.monthly_sales || 0}
- Monthly Expenses: ₹${fd.monthly_expenses || 0}
- Pending Customer Outstanding: ₹${fd.customer_outstanding || 0}
- Number of Active Customers: ${fd.active_customers || 0}
- Stock Value in Hand: ₹${fd.stock_value || 0}
- Number of Pending Invoices: ${fd.pending_invoices || 0}

Business context:
- Wholesale surplus T-shirt trading in Tiruppur garment hub
- Deals in fresh and mistake/surplus pieces
- Has multiple branches
- Customers are wholesale buyers across Tamil Nadu

Generate 6 specific, practical, immediately actionable ideas to repay the loan faster. Each idea must be realistic for this specific business.

Respond ONLY in this exact JSON format with no extra text:
{
  "summary": "One sentence overview of the financial situation",
  "urgency": "low" or "medium" or "high",
  "ideas": [
    {
      "title": "Short title",
      "category": "one of: Collections, Sales, Cost Cutting, Stock, Banking, Operations",
      "impact": "one of: High, Medium, Low",
      "timeframe": "one of: This Week, This Month, Next 3 Months",
      "description": "2-3 sentences explaining exactly what to do",
      "estimated_amount": "Approximate amount this could free up in rupees or percentage",
      "first_step": "The single first action to take today"
    }
  ]
}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Claude API error:', response.status, errText);
            return res.json({ success: false, error: `Claude API error: ${response.status}` });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        let parsed;
        try {
            parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        } catch {
            console.error('Failed to parse Claude response:', text);
            return res.json({ success: false, error: 'Claude returned an unexpected format. Try again.' });
        }

        res.json({ success: true, ideas: parsed });
    } catch (e) {
        console.error('POST /finance/loan-ideas error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

export default router;
