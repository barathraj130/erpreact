// backend/routes/reportRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 SALES REGISTER
 */
router.get('/sales/register', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, customer_id, show_name_sake = 'false' } = req.query;

    try {
        let where = "WHERE i.company_id = $1 AND COALESCE(i.is_deleted, false) = false";
        let params = [companyId];

        if (startDate && endDate) {
            where += " AND i.invoice_date >= $2::date AND i.invoice_date <= $3::date";
            params.push(startDate, endDate);
        }

        if (customer_id) {
            where += ` AND i.customer_id = $${params.length + 1}`;
            params.push(customer_id);
        }

        if (show_name_sake !== 'true') {
            where += " AND COALESCE(i.bill_purpose, '') != 'name_only'";
        }

        const sql = `
            SELECT
                i.*,
                u.username as customer_name,
                COALESCE(p_cash.amount, 0) as cash_collected,
                COALESCE(p_upi.amount, 0) as upi_collected,
                COALESCE(p_bank.amount, 0) as bank_collected
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM invoice_payments WHERE payment_method = 'CASH' GROUP BY invoice_id) p_cash ON i.id = p_cash.invoice_id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM invoice_payments WHERE payment_method = 'UPI' GROUP BY invoice_id) p_upi ON i.id = p_upi.invoice_id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM invoice_payments WHERE (payment_method = 'BANK' OR payment_method = 'NEFT') GROUP BY invoice_id) p_bank ON i.id = p_bank.invoice_id
            ${where}
            ORDER BY i.invoice_date DESC, i.id DESC
        `;

        let rows = await db.pgAll(sql, params);

        // AUTO-EXPAND: If no data in period, show ALL TIME
        if (rows.length === 0 && startDate && endDate) {
            const allTimeSql = sql.replace(/AND i\.invoice_date >= \$2::date AND i\.invoice_date <= \$3::date/, "");
            rows = await db.pgAll(allTimeSql, [companyId, ...(customer_id ? [customer_id] : [])]);
        }

        res.json(rows || []);
    } catch (err) {
        console.error("Sales register error:", err);
        res.json([]);
    }
});

/**
 * 🤝 CUSTOMER-WISE SALES
 */
router.get('/sales/customer-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                u.username as customer_name,
                COUNT(i.id) as invoice_count,
                COALESCE(SUM(i.total_amount), 0) as total_sales,
                COALESCE(SUM(i.paid_amount), 0) as total_paid,
                COALESCE(SUM(i.total_amount - i.paid_amount), 0) as balance,
                MAX(i.invoice_date) as last_date
            FROM users u
            JOIN invoices i ON u.id = i.customer_id
            WHERE u.company_id = $1
              AND COALESCE(i.bill_purpose, '') != 'name_only'
              AND COALESCE(i.is_deleted, false) = false
              AND u.role = 'customer'
            GROUP BY u.id, u.username
            ORDER BY total_sales DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Customer sales error:", err);
        res.json([]);
    }
});

/**
 * 🍎 PRODUCT-WISE SALES
 */
router.get('/sales/product-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                p.name as product_name,
                COALESCE(SUM(li.quantity), 0) as total_qty,
                COALESCE(AVG(li.unit_price), 0) as avg_price,
                COALESCE(SUM(li.line_total), 0) as revenue
            FROM invoice_line_items li
            JOIN invoices i ON li.invoice_id = i.id
            JOIN products p ON li.product_id = p.id
            WHERE i.company_id = $1
              AND COALESCE(i.bill_purpose, '') != 'name_only'
              AND COALESCE(i.is_deleted, false) = false
            GROUP BY p.id, p.name
            ORDER BY revenue DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Product sales error:", err);
        res.json([]);
    }
});

/**
 * 📦 STOCK SUMMARY
 */
router.get('/inventory/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                id, name, sku, current_stock, unit, cost_price as avg_cost,
                (current_stock * cost_price) as stock_value
            FROM products
            WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
            ORDER BY current_stock DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Stock summary error:", err);
        res.json([]);
    }
});

/**
 * 💸 EXPENSES (Horizontal Bar Chart Data)
 */
router.get('/finance/expenses', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT ca.name as name, SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)) as amount
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            WHERE l.company_id = $1 AND ca.account_type = 'EXPENSE'
            GROUP BY ca.name
            ORDER BY amount DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Finance expenses error:", err);
        res.json([]);
    }
});

/**
 * 📈 DASHBOARD STATS (Landing Summary)
 */
router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const [todaySales, todayPurchases, receivables, outputGst, inputGst, activeCustomers] = await Promise.all([
            db.pgGet(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND DATE(invoice_date) = CURRENT_DATE AND COALESCE(bill_purpose,'') != 'name_only' AND COALESCE(is_deleted,false)=false`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_bills WHERE company_id = $1 AND DATE(bill_date) = CURRENT_DATE AND COALESCE(bill_purpose,'') != 'name_only'`, [companyId]).catch(() => ({ total: 0 })),
            // True receivables: opening_balance + invoices − invoice_payments − CUSTOMER_PAYMENT transactions
            db.pgGet(`
                SELECT COALESCE(SUM(x.bal), 0) as total FROM (
                    SELECT GREATEST(0,
                        COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, COALESCE(u.initial_balance, 0))
                        + COALESCE((
                            SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,'')) != 'SALES_RETURN'
                                            THEN i2.total_amount ELSE -i2.total_amount END)
                            FROM invoices i2
                            WHERE i2.customer_id = u.id AND i2.company_id = $1
                              AND COALESCE(i2.is_deleted, false) = false
                              AND COALESCE(i2.bill_purpose, '') != 'name_only'
                        ), 0)
                        - COALESCE((
                            SELECT SUM(ip.amount) FROM invoice_payments ip
                            JOIN invoices i3 ON i3.id = ip.invoice_id
                            WHERE i3.customer_id = u.id AND i3.company_id = $1
                              AND COALESCE(i3.is_deleted, false) = false
                        ), 0)
                        - COALESCE((
                            SELECT SUM(t.amount) FROM transactions t
                            WHERE t.reference_id = u.id AND t.company_id = $1
                              AND t.type = 'CUSTOMER_PAYMENT'
                        ), 0)
                    ) as bal
                    FROM users u
                    WHERE u.role IN ('user','customer') AND u.company_id = $1
                ) x WHERE x.bal > 0
            `, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(cgst_total,0) + COALESCE(sgst_total,0) + COALESCE(igst_total,0)), 0) as total FROM invoices WHERE company_id = $1 AND COALESCE(bill_purpose,'') != 'name_only' AND COALESCE(is_deleted,false)=false`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(cgst_total,0) + COALESCE(sgst_total,0) + COALESCE(igst_total,0)), 0) as total FROM purchase_bills WHERE company_id = $1 AND COALESCE(bill_purpose,'') != 'name_only'`, [companyId]).catch(() => ({ total: 0 })),
            db.pgGet(`SELECT COUNT(*) as count FROM users WHERE company_id = $1 AND role = 'customer'`, [companyId]),
        ]);

        let cashBalance = 0;
        try {
            const [cashIn, cashOut, bankIn, bankOut] = await Promise.all([
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE company_id = $1 AND direction = 'in'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE company_id = $1 AND direction = 'out'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM bank_ledger WHERE company_id = $1 AND direction = 'in'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM bank_ledger WHERE company_id = $1 AND direction = 'out'`, [companyId]),
            ]);
            cashBalance = (parseFloat(cashIn?.total || 0) - parseFloat(cashOut?.total || 0))
                        + (parseFloat(bankIn?.total || 0) - parseFloat(bankOut?.total || 0));
        } catch (_) { /* cash/bank ledger may be empty */ }

        res.json({
            today_sales:       parseFloat(todaySales?.total || 0),
            today_purchases:   parseFloat(todayPurchases?.total || 0),
            total_receivables: parseFloat(receivables?.total || 0),
            gst_liability:     parseFloat(outputGst?.total || 0) - parseFloat(inputGst?.total || 0),
            active_customers:  parseInt(activeCustomers?.count || 0),
            cash_balance:      cashBalance
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.json({ today_sales: 0, today_purchases: 0, total_receivables: 0, gst_liability: 0, active_customers: 0, cash_balance: 0 });
    }
});

/**
 * ⚖️ TRIAL BALANCE
 */
router.get('/finance/trial-balance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filterType } = req.query;
    try {
        const { getTrialBalance } = await import('../utils/accountingEngine.js');
        const report = await getTrialBalance(companyId, filterType);
        res.json(report);
    } catch (err) {
        console.error("Trial balance error:", err.message);
        // Fallback: simple ledger_entries aggregation
        try {
            const rows = await db.pgAll(`
                SELECT ca.name AS ledger_name,
                       0 AS opening,
                       COALESCE(SUM(le.debit),0)  AS debit,
                       COALESCE(SUM(le.credit),0) AS credit,
                       COALESCE(SUM(le.debit),0) - COALESCE(SUM(le.credit),0) AS closing
                FROM ledger_entries le
                JOIN chart_of_accounts ca ON le.account_id = ca.id
                WHERE le.company_id = $1
                GROUP BY ca.name
                ORDER BY ca.name
            `, [companyId]);
            res.json(rows || []);
        } catch (_) { res.json([]); }
    }
});

/**
 * 📈 PROFIT & LOSS
 */
router.get('/finance/profit-loss', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, filterType } = req.query;
    try {
        const { getProfitAndLoss } = await import('../utils/accountingEngine.js');
        const report = await getProfitAndLoss(companyId, null, startDate || '2000-01-01', endDate || '2099-12-31', filterType);
        res.json(report);
    } catch (err) {
        console.error("P&L error:", err.message);
        try {
            const [sales, purchases, expenses] = await Promise.all([
                db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(()=>({total:0})),
                db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE company_id=$1`, [companyId]).catch(()=>({total:0})),
            ]);
            res.json({ income: [{ name:'Sales', amount: parseFloat(sales?.total||0) }], expenses: [{ name:'Purchases', amount: parseFloat(purchases?.total||0) }, { name:'Expenses', amount: parseFloat(expenses?.total||0) }], net_profit: parseFloat(sales?.total||0) - parseFloat(purchases?.total||0) - parseFloat(expenses?.total||0) });
        } catch(_) { res.json({ income:[], expenses:[], net_profit:0 }); }
    }
});

/**
 * 🏦 BALANCE SHEET
 */
router.get('/finance/balance-sheet', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        // ── ASSETS ─────────────────────────────────────────────────────────────
        const [
            cashLedger, bankLedger,
            cashInFromInvPay, cashOutPurchases, cashOutWages, cashOutLoans, cashOutSalary,
            directReceipts, propBalance,
            receivables, advancePaid,
            inventory,
            loansGiven,
            propReceiptBalance,
        ] = await Promise.all([
            // Cash in hand = net of cash_ledger (excluding opening balance + already-counted sources)
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS total
                      FROM cash_ledger WHERE company_id=$1 AND source NOT IN ('OPENING_BALANCE','INVOICE_PAYMENT','CUSTOMER_PAYMENT','RECEIPT','PROPRIETOR_RECEIPT','PURCHASE_PAYMENT','Daily_wage','LOAN_REPAYMENT')`, [companyId]).catch(()=>({total:0})),
            // Cash at bank = net of bank_ledger
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS total
                      FROM bank_ledger WHERE company_id=$1 AND source NOT IN ('OPENING_BALANCE','INVOICE_PAYMENT','CUSTOMER_PAYMENT','RECEIPT')`, [companyId]).catch(()=>({total:0})),
            // Invoice payments received (cash)
            db.pgGet(`SELECT COALESCE(SUM(ip.amount),0) AS total FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id WHERE i.company_id=$1 AND (ip.payment_method IS NULL OR UPPER(ip.payment_method) NOT IN ('BANK','ONLINE','UPI','CHEQUE','NEFT','RTGS'))`, [companyId]).catch(()=>({total:0})),
            // Cash paid to suppliers
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM purchase_bill_payments WHERE company_id=$1`, [companyId]).catch(()=>({total:0})),
            // Daily wages paid
            db.pgGet(`SELECT COALESCE(SUM(gross_wage),0) AS total FROM daily_salary_payments WHERE company_id=$1`, [companyId]).catch(()=>({total:0})),
            // Loan repayments paid out
            db.pgGet(`SELECT COALESCE(SUM(lp.total_amount),0) AS total FROM loan_payments lp JOIN loans l ON l.id=lp.loan_id WHERE l.company_id=$1`, [companyId]).catch(()=>({total:0})),
            // Monthly salary paid
            db.pgGet(`SELECT COALESCE(SUM(sp.amount),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1`, [companyId]).catch(()=>({total:0})),
            // Direct receipts (RECEIPT/CUSTOMER_PAYMENT in transactions)
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE company_id=$1 AND type IN ('CUSTOMER_PAYMENT','RECEIPT')`, [companyId]).catch(()=>({total:0})),
            // Proprietor net (receipts - payouts)
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN transaction_type='PERSONAL_RECEIPT' THEN amount ELSE -amount END),0) AS total FROM proprietor_transactions WHERE company_id=$1`, [companyId]).catch(()=>({total:0})),
            // Accounts Receivable = unpaid invoice amounts
            db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total
                      FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND status!='PAID' AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]).catch(()=>({total:0})),
            // Customer Advances (overpaid = negative outstanding = asset for them, not us)
            db.pgGet(`SELECT COALESCE(SUM(ABS(remaining_balance)),0) AS total FROM (
                        SELECT (COALESCE(initial_balance,0)
                            + COALESCE((SELECT SUM(total_amount) FROM invoices WHERE customer_id=u.id AND company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'),0)
                            - COALESCE((SELECT SUM(amount) FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id WHERE i.customer_id=u.id AND i.company_id=$1),0)
                            - COALESCE((SELECT SUM(total_amount) FROM sales_returns WHERE customer_id=u.id AND company_id=$1),0)
                        ) AS remaining_balance
                        FROM users u WHERE u.company_id=$1 AND u.role='customer'
                      ) sub WHERE remaining_balance < 0`, [companyId]).catch(()=>({total:0})),
            // Inventory / Stock value — use current_stock (actual) × cost_price
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(current_stock,opening_stock,0) * COALESCE(cost_price,selling_price,0)),0) AS total
                      FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(()=>({total:0})),
            // Loans given out (if any assets lent)
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(principal_outstanding,principal_amount)),0) AS total
                      FROM loans WHERE company_id=$1 AND UPPER(COALESCE(loan_direction,'')) = 'GIVEN' AND UPPER(COALESCE(status,'')) = 'ACTIVE'`, [companyId]).catch(()=>({total:0})),
            // Proprietor net receipts (money owed via personal account)
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions
                      WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT'`, [companyId]).catch(()=>({total:0})),
        ]);

        // ── LIABILITIES ────────────────────────────────────────────────────────
        const [
            payables,
            loansPayable,
            salaryPayable,
        ] = await Promise.all([
            // Accounts Payable = purchase bills minus what's been paid via purchase_bill_payments
            db.pgGet(`SELECT COALESCE(
                        SUM(COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0))
                        - COALESCE((SELECT SUM(p.amount) FROM purchase_bill_payments p WHERE p.company_id=$1),0)
                      ,0) AS total
                      FROM purchase_bills pb
                      WHERE pb.company_id=$1 AND COALESCE(pb.is_deleted,false)=false`, [companyId]).catch(()=>({total:0})),
            // Loans payable: principal_outstanding (auto-updated on each repayment)
            // Fall back to principal_amount - SUM(principal_component) from loan_payments
            db.pgGet(`
                SELECT COALESCE(SUM(
                    COALESCE(
                        l.principal_outstanding,
                        l.principal_amount - COALESCE((
                            SELECT SUM(lp.principal_component)
                            FROM loan_payments lp WHERE lp.loan_id = l.id
                        ), 0),
                        0
                    )
                ), 0) AS total
                FROM loans l
                WHERE l.company_id = $1
                  AND UPPER(COALESCE(l.loan_direction, 'TAKEN')) != 'GIVEN'
                  AND UPPER(COALESCE(l.status, 'ACTIVE')) IN ('ACTIVE','PENDING','ONGOING')
            `, [companyId]).catch(()=>({total:0})),
            // Salary payable = monthly salaries of active employees not yet paid this month
            db.pgGet(`
                SELECT COALESCE(SUM(s.gross_salary - COALESCE(s.deductions,0)),0) AS total
                FROM salaries s
                WHERE s.company_id = $1
                  AND s.salary_type = 'monthly'
                  AND NOT EXISTS (
                    SELECT 1 FROM salary_payments sp
                    WHERE sp.salary_id = s.id
                      AND DATE_TRUNC('month', sp.date) = DATE_TRUNC('month', CURRENT_DATE)
                  )
            `, [companyId]).catch(()=>({total:0})),
        ]);

        // Cash in hand = ledger misc + invoice payments received (cash) + direct receipts - purchases paid - wages - loans repaid - salaries
        const ledgerMiscCash = parseFloat(cashLedger?.total||0);
        const ledgerMiscBank = parseFloat(bankLedger?.total||0);
        const invPayCash     = parseFloat(cashInFromInvPay?.total||0);
        const purPaid        = parseFloat(cashOutPurchases?.total||0);
        const wagesPaid      = parseFloat(cashOutWages?.total||0);
        const loansPaid      = parseFloat(cashOutLoans?.total||0);
        const salaryPaid     = parseFloat(cashOutSalary?.total||0);
        const drTotal        = parseFloat(directReceipts?.total||0);
        const propNet        = parseFloat(propBalance?.total||0);

        // Net cash position = all money in - all money out
        const cashVal   = Math.max(0, ledgerMiscCash + invPayCash + drTotal - purPaid - wagesPaid - loansPaid - salaryPaid);
        const bankVal   = Math.max(0, ledgerMiscBank);
        const recVal    = parseFloat(receivables?.total||0);
        const advVal    = parseFloat(advancePaid?.total||0);
        const invVal    = parseFloat(inventory?.total||0);
        const loanGiven = parseFloat(loansGiven?.total||0);
        const propRec   = parseFloat(propReceiptBalance?.total||0);

        const payVal     = Math.max(0, parseFloat(payables?.total||0));
        const loanPay    = parseFloat(loansPayable?.total||0);
        const salPayable = parseFloat(salaryPayable?.total||0);

        const totalAssets      = cashVal + bankVal + recVal + advVal + invVal + loanGiven + propRec;
        const totalLiabilities = payVal + loanPay + salPayable;
        const netEquity        = totalAssets - totalLiabilities;

        res.json([
            // ASSETS
            { particulars: 'Cash in Hand',                     account_type: 'ASSET',     amount: cashVal },
            { particulars: 'Cash at Bank',                     account_type: 'ASSET',     amount: bankVal },
            { particulars: 'Accounts Receivable (Customers)',  account_type: 'ASSET',     amount: recVal },
            { particulars: 'Customer Advance Credits',         account_type: 'ASSET',     amount: advVal },
            { particulars: 'Inventory / Stock Value',          account_type: 'ASSET',     amount: invVal },
            { particulars: 'Proprietor Account Receipts',      account_type: 'ASSET',     amount: propRec },
            { particulars: 'Loans Given (Active)',             account_type: 'ASSET',     amount: loanGiven },
            { particulars: 'TOTAL ASSETS',                     account_type: 'TOTAL',     amount: totalAssets },
            // LIABILITIES
            { particulars: 'Accounts Payable (Suppliers)',     account_type: 'LIABILITY', amount: payVal },
            { particulars: 'Loans Payable (Outstanding)',      account_type: 'LIABILITY', amount: loanPay },
            { particulars: 'Salary Payable (This Month)',      account_type: 'LIABILITY', amount: salPayable },
            { particulars: 'TOTAL LIABILITIES',                account_type: 'TOTAL',     amount: totalLiabilities },
            // EQUITY
            { particulars: 'Net Owner\'s Equity',              account_type: 'EQUITY',    amount: netEquity },
        ]);
    } catch (err) {
        console.error("Balance sheet error:", err.message);
        res.json([]);
    }
});

/**
 * 📔 DAY BOOK
 */
router.get('/finance/day-book', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, reference_id, reference_type } = req.query;
    try {
        let params = [companyId];
        let where = "WHERE l.company_id = $1";

        if (startDate && endDate) {
            where += ` AND l.entry_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
            params.push(startDate, endDate);
        }

        if (reference_id) {
            where += ` AND t.reference_id = $${params.length + 1}`;
            params.push(reference_id);
        }

        if (reference_type) {
            where += ` AND UPPER(t.reference_type) = UPPER($${params.length + 1})`;
            params.push(reference_type);
        }

        const sql = `
            SELECT
                l.*,
                ca.name as account_name,
                t.reference_type,
                t.reference_id,
                COALESCE(tl.description, t.description) as description
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            LEFT JOIN transactions t ON l.transaction_id = t.id
            LEFT JOIN transaction_lines tl ON l.transaction_id = tl.transaction_id
                AND l.account_id = tl.account_id
                AND l.debit = tl.debit_amount
                AND l.credit = tl.credit_amount
            ${where}
            ORDER BY l.entry_date DESC, l.id DESC
        `;
        const rows = await db.pgAll(sql, params);
        res.json(rows || []);
    } catch (err) {
        console.error("Day book error:", err);
        res.json([]);
    }
});

/**
 * 🧾 GST ITC REPORT
 */
router.get('/gst/itc', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                pb.id as bill_id, pb.bill_number, pb.bill_date, pb.supplier_name, s.gstin,
                COALESCE(pb.sub_total, 0) as taxable_amount,
                COALESCE(pb.cgst_total, 0) as cgst_total,
                COALESCE(pb.sgst_total, 0) as sgst_total,
                COALESCE(pb.igst_total, 0) as igst_total,
                COALESCE(pb.tax_total, 0) as eligible_itc
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON pb.supplier_id = s.id
            WHERE pb.company_id = $1
              AND pb.bill_type = 'TAX'
              AND COALESCE(pb.is_deleted, false) = false
            ORDER BY pb.bill_date DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("ITC report error:", err);
        res.json([]);
    }
});

/**
 * 🧾 GSTR-1 SUMMARY — Intra-state (CGST+SGST) vs Inter-state (IGST)
 */
router.get('/gst/gstr1-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) {
            dateFilter = `AND invoice_date BETWEEN $2::date AND $3::date`;
            params.push(startDate, endDate);
        }

        const sql = `
            SELECT
                supply_type,
                COUNT(*)                         AS invoice_count,
                COALESCE(SUM(sub_total), 0)      AS taxable_value,
                COALESCE(SUM(cgst_total), 0)     AS cgst,
                COALESCE(SUM(sgst_total), 0)     AS sgst,
                COALESCE(SUM(igst_total), 0)     AS igst,
                COALESCE(SUM(tax_total), 0)      AS total_gst,
                COALESCE(SUM(total_amount), 0)   AS total_value
            FROM (
                SELECT *,
                    CASE
                        WHEN UPPER(COALESCE(gst_type,'')) IN ('INTER_STATE','IGST') THEN 'Inter-state (IGST)'
                        ELSE 'Intra-state (CGST+SGST)'
                    END AS supply_type
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(invoice_type,'') = 'TAX_INVOICE'
                  AND COALESCE(is_deleted, false) = false
                  AND COALESCE(bill_purpose, '') != 'name_only'
                  ${dateFilter}
            ) sub
            GROUP BY supply_type
            ORDER BY supply_type
        `;
        const rows = await db.pgAll(sql, params);

        // Also fetch line-item level breakdown grouped by HSN + GST rate
        const hsnSql = `
            SELECT
                COALESCE(li.hsn_code, 'N/A')        AS hsn_code,
                li.gst_rate,
                CASE
                    WHEN UPPER(COALESCE(i.gst_type,'')) IN ('INTER_STATE','IGST') THEN 'IGST'
                    ELSE 'CGST+SGST'
                END                                  AS gst_category,
                COUNT(DISTINCT i.id)                 AS invoice_count,
                COALESCE(SUM(li.taxable_amount), 0)  AS taxable_value,
                COALESCE(SUM(li.cgst_amount), 0)     AS cgst,
                COALESCE(SUM(li.sgst_amount), 0)     AS sgst,
                COALESCE(SUM(li.igst_amount), 0)     AS igst
            FROM invoice_line_items li
            JOIN invoices i ON li.invoice_id = i.id
            WHERE i.company_id = $1
              AND COALESCE(i.invoice_type,'') = 'TAX_INVOICE'
              AND COALESCE(i.is_deleted, false) = false
              AND COALESCE(i.bill_purpose, '') != 'name_only'
              ${dateFilter}
            GROUP BY li.hsn_code, li.gst_rate, gst_category
            ORDER BY taxable_value DESC
        `;
        const hsnRows = await db.pgAll(hsnSql, params).catch(() => []);

        res.json({ success: true, data: { summary: rows || [], hsn_breakdown: hsnRows || [] } });
    } catch (err) {
        console.error("GSTR-1 summary error:", err);
        res.json({ success: true, data: { summary: [], hsn_breakdown: [] } });
    }
});

/**
 * 💳 PAYMENT COLLECTION REPORT
 */
router.get('/sales/payment-collection', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let where = 'WHERE ip.company_id = $1';
        const params = [companyId];
        if (startDate && endDate) {
            where += ` AND ip.payment_date BETWEEN $2::date AND $3::date`;
            params.push(startDate, endDate);
        }
        const sql = `
            SELECT ip.payment_date as date,
                   COALESCE(u.username, u.name, 'Unknown') as customer_name,
                   ip.payment_method as method,
                   ip.reference_number as reference,
                   ip.amount
            FROM invoice_payments ip
            LEFT JOIN invoices i ON ip.invoice_id = i.id
            LEFT JOIN users u ON i.customer_id = u.id
            ${where}
            ORDER BY ip.payment_date DESC, ip.id DESC
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('payment-collection error:', err.message);
        res.json([]);
    }
});

/**
 * 📊 GST SUMMARY (monthly)
 */
router.get('/gst/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT TO_CHAR(invoice_date, 'Mon YYYY') AS month,
                   DATE_TRUNC('month', invoice_date)  AS month_sort,
                   COALESCE(SUM(cgst_total), 0)       AS output_cgst,
                   COALESCE(SUM(sgst_total), 0)       AS output_sgst,
                   0                                  AS input_cgst,
                   0                                  AS input_sgst,
                   COALESCE(SUM(COALESCE(cgst_total,0) + COALESCE(sgst_total,0) + COALESCE(igst_total,0)), 0) AS net_liability
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(invoice_type,'') = 'TAX_INVOICE'
              AND COALESCE(is_deleted, false) = false
            GROUP BY month, month_sort
            ORDER BY month_sort DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('gst/summary error:', err.message);
        res.json([]);
    }
});

/**
 * 🧾 GSTR-1 READY REPORT
 */
router.get('/gst/gstr-1', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let where = `WHERE i.company_id = $1 AND COALESCE(i.invoice_type,'') = 'TAX_INVOICE' AND COALESCE(i.is_deleted,false)=false AND COALESCE(i.bill_purpose,'')!='name_only'`;
        const params = [companyId];
        if (startDate && endDate) { where += ` AND i.invoice_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT i.invoice_number AS invoice_no, i.invoice_date AS date,
                   COALESCE(u.username, u.name, i.customer_name) AS receiver_name,
                   COALESCE(u.gstin, '') AS gstin,
                   COALESCE(i.sub_total, 0) AS taxable_amount,
                   COALESCE(i.tax_total, COALESCE(i.cgst_total,0)+COALESCE(i.sgst_total,0)+COALESCE(i.igst_total,0), 0) AS total_tax,
                   COALESCE(i.total_amount, 0) AS total_amount
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            ${where}
            ORDER BY i.invoice_date DESC
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('gstr-1 error:', err.message);
        res.json([]);
    }
});

/**
 * 📋 GSTR-3B READY REPORT
 */
router.get('/gst/gstr-3b', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND invoice_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT
                CASE WHEN UPPER(COALESCE(gst_type,'')) IN ('INTER_STATE','IGST') THEN 'Inter-state Supplies' ELSE 'Intra-state Supplies' END AS supply_nature,
                COALESCE(SUM(sub_total), 0)   AS taxable_value,
                COALESCE(SUM(igst_total), 0)  AS igst,
                COALESCE(SUM(cgst_total), 0)  AS cgst,
                COALESCE(SUM(sgst_total), 0)  AS sgst
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(invoice_type,'') = 'TAX_INVOICE'
              AND COALESCE(is_deleted,false)=false
              AND COALESCE(bill_purpose,'')!='name_only'
              ${dateFilter}
            GROUP BY supply_nature
            ORDER BY supply_nature
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('gstr-3b error:', err.message);
        res.json([]);
    }
});

/**
 * 📈 P&L STATEMENT (alias)
 */
router.get('/finance/pl', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        const [sales, purchases, expenses] = await Promise.all([
            db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(() => ({total:0})),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE company_id=$1`, [companyId]).catch(() => ({total:0})),
        ]);
        const totalSales = parseFloat(sales?.total || 0);
        const totalPurchases = parseFloat(purchases?.total || 0);
        const totalExpenses = parseFloat(expenses?.total || 0);
        const grossProfit = totalSales - totalPurchases;
        const netProfit = grossProfit - totalExpenses;
        res.json([
            { particulars: 'Total Sales (Revenue)',     amount: totalSales },
            { particulars: 'Cost of Purchases',         amount: -totalPurchases },
            { particulars: 'Gross Profit',              amount: grossProfit },
            { particulars: 'Operating Expenses',        amount: -totalExpenses },
            { particulars: 'Net Profit / (Loss)',        amount: netProfit },
        ]);
    } catch (err) {
        console.error('pl error:', err.message);
        res.json([]);
    }
});

/**
 * 💰 CASH FLOW STATEMENT
 */
router.get('/finance/cash-flow', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }

        // Build separate date filters per table (avoid column-name collision in .replace)
        let ipDateFilter = '';      // invoice_payments.payment_date
        let propDateFilter = '';    // proprietor_transactions.transaction_date
        let txDateFilter = '';      // transactions.date
        if (startDate && endDate) {
            ipDateFilter   = `AND ip.payment_date BETWEEN $2::date AND $3::date`;
            propDateFilter = `AND transaction_date BETWEEN $2::date AND $3::date`;
            txDateFilter   = `AND date BETWEEN $2::date AND $3::date`;
        }

        const [
            cashIn, cashOut, bankIn, bankOut,
            invPayCash, invPayBank,
            propReceipts, propPayouts,
            directReceiptsCash, _unused,
        ] = await Promise.all([
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger WHERE company_id=$1 AND direction='in' AND source NOT IN ('OPENING_BALANCE','INVOICE_PAYMENT','CUSTOMER_PAYMENT','RECEIPT','PROPRIETOR_RECEIPT') ${dateFilter}`, params),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger WHERE company_id=$1 AND direction='out' AND source NOT IN ('OPENING_BALANCE','INVOICE_PAYMENT','PURCHASE_PAYMENT','Daily_wage','LOAN_REPAYMENT','PROPRIETOR_PAYOUT') ${dateFilter}`, params),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM bank_ledger WHERE company_id=$1 AND direction='in' AND source NOT IN ('OPENING_BALANCE','INVOICE_PAYMENT','CUSTOMER_PAYMENT','RECEIPT') ${dateFilter}`, params),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM bank_ledger WHERE company_id=$1 AND direction='out' AND source NOT IN ('OPENING_BALANCE','INVOICE_PAYMENT','PURCHASE_PAYMENT') ${dateFilter}`, params),

            // Invoice payments received — cash methods
            db.pgGet(`SELECT COALESCE(SUM(ip.amount),0) AS total FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id WHERE i.company_id=$1 AND (ip.payment_method IS NULL OR UPPER(ip.payment_method) NOT IN ('BANK','ONLINE','UPI','CHEQUE','NEFT','RTGS')) ${ipDateFilter}`, params).catch(()=>({total:0})),
            // Invoice payments received — bank methods
            db.pgGet(`SELECT COALESCE(SUM(ip.amount),0) AS total FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id WHERE i.company_id=$1 AND UPPER(COALESCE(ip.payment_method,'')) IN ('BANK','ONLINE','UPI','CHEQUE','NEFT','RTGS') ${ipDateFilter}`, params).catch(()=>({total:0})),

            // Proprietor personal account receipts
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT' ${propDateFilter}`, params).catch(()=>({total:0})),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='WITHDRAWAL' ${propDateFilter}`, params).catch(()=>({total:0})),

            // Direct receipts from transactions table (RECEIPT/CUSTOMER_PAYMENT)
            // Note: transactions table has no 'mode' column — mode is only used at write-time
            // to choose cash_ledger vs bank_ledger. We sum all direct receipts here.
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE company_id=$1 AND type IN ('CUSTOMER_PAYMENT','RECEIPT') ${txDateFilter}`, params).catch(()=>({total:0})),
            db.pgGet(`SELECT 0 AS total`, []).catch(()=>({total:0})), // placeholder — bank split not available
        ]);

        const ci  = parseFloat(cashIn?.total||0),  co  = parseFloat(cashOut?.total||0);
        const bi  = parseFloat(bankIn?.total||0),   bo  = parseFloat(bankOut?.total||0);
        const ipc = parseFloat(invPayCash?.total||0), ipb = parseFloat(invPayBank?.total||0);
        const pr  = parseFloat(propReceipts?.total||0), pp = parseFloat(propPayouts?.total||0);
        const dr  = parseFloat(directReceiptsCash?.total||0); // all direct receipts

        const totalIn  = ci + bi + ipc + ipb + pr + dr;
        const totalOut = co + bo + pp;
        res.json([
            { activity: 'Invoice Payments (Cash)',          inflow: ipc,  outflow: 0,   net: ipc },
            { activity: 'Invoice Payments (Bank/Online)',   inflow: ipb,  outflow: 0,   net: ipb },
            { activity: 'Direct Receipts (Cash/Bank)',      inflow: dr,   outflow: 0,   net: dr },
            { activity: 'Proprietor Account Receipts',     inflow: pr,   outflow: 0,   net: pr },
            { activity: 'Other Cash Inflows',              inflow: ci,   outflow: 0,   net: ci },
            { activity: 'Other Bank Inflows',              inflow: bi,   outflow: 0,   net: bi },
            { activity: 'Cash Payments',                   inflow: 0,    outflow: co,  net: -co },
            { activity: 'Bank Payments',                   inflow: 0,    outflow: bo,  net: -bo },
            { activity: 'Proprietor Account Payouts',      inflow: 0,    outflow: pp,  net: -pp },
            { activity: 'NET CASH FLOW',                   inflow: totalIn, outflow: totalOut, net: totalIn - totalOut },
        ]);
    } catch (err) {
        console.error('cash-flow error:', err.message);
        res.json([]);
    }
});

/**
 * 📒 LEDGER ACCOUNT REPORT
 */
router.get('/finance/ledger', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND l.entry_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT l.entry_date AS date, ca.account_type AS type,
                   COALESCE(t.description,'') AS particulars,
                   COALESCE(l.debit,0) AS debit, COALESCE(l.credit,0) AS credit,
                   COALESCE(l.debit,0) - COALESCE(l.credit,0) AS balance
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            LEFT JOIN transactions t ON l.transaction_id = t.id
            WHERE l.company_id = $1 ${dateFilter}
            ORDER BY l.entry_date DESC, l.id DESC
            LIMIT 500
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('ledger error:', err.message);
        res.json([]);
    }
});

/**
 * 📦 STOCK MOVEMENT
 */
router.get('/inventory/movement', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND i.invoice_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT i.invoice_date AS date, p.name AS product_name,
                   'SALE' AS type, i.invoice_number AS reference,
                   0 AS qty_in, SUM(li.quantity) AS qty_out,
                   p.current_stock AS balance
            FROM invoice_line_items li
            JOIN invoices i ON li.invoice_id = i.id
            JOIN products p ON li.product_id = p.id
            WHERE i.company_id = $1 AND COALESCE(i.is_deleted,false)=false
              AND COALESCE(li.is_return,false)=false ${dateFilter}
            GROUP BY i.invoice_date, p.name, i.invoice_number, p.current_stock
            ORDER BY i.invoice_date DESC
            LIMIT 500
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('inventory/movement error:', err.message);
        res.json([]);
    }
});

/**
 * 💎 STOCK VALUATION
 */
router.get('/inventory/valuation', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT name AS product_name, COALESCE(current_stock,0) AS qty,
                   COALESCE(cost_price,0) AS rate,
                   COALESCE(current_stock,0) * COALESCE(cost_price,0) AS value
            FROM products
            WHERE company_id = $1 AND COALESCE(is_deleted,false)=false
            ORDER BY value DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('valuation error:', err.message);
        res.json([]);
    }
});

/**
 * 💀 DEAD STOCK
 */
router.get('/inventory/dead-stock', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT p.name AS product_name,
                   MAX(i.invoice_date) AS last_date,
                   COALESCE(CURRENT_DATE - MAX(i.invoice_date)::date, 999) AS idle_days,
                   COALESCE(p.current_stock,0) * COALESCE(p.cost_price,0) AS value
            FROM products p
            LEFT JOIN invoice_line_items li ON li.product_id = p.id
            LEFT JOIN invoices i ON li.invoice_id = i.id AND COALESCE(i.is_deleted,false)=false
            WHERE p.company_id = $1 AND COALESCE(p.is_deleted,false)=false
              AND COALESCE(p.current_stock,0) > 0
            GROUP BY p.id, p.name, p.current_stock, p.cost_price
            HAVING MAX(i.invoice_date) < CURRENT_DATE - INTERVAL '60 days' OR MAX(i.invoice_date) IS NULL
            ORDER BY idle_days DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('dead-stock error:', err.message);
        res.json([]);
    }
});

/**
 * 🏦 LOAN STATEMENT
 */
router.get('/finance/loan-statement', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT COALESCE(ln.lender_name, l.party_name, 'Unknown') AS entity_name,
                   COALESCE(l.principal_amount,0) AS principal,
                   0 AS interest,
                   COALESCE(l.principal_outstanding, l.principal_amount, 0) AS outstanding
            FROM loans l
            LEFT JOIN lenders ln ON l.lender_id = ln.id
            WHERE l.company_id = $1
            ORDER BY l.id DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('loan-statement error:', err.message);
        res.json([]);
    }
});

/**
 * 🪙 CHIT FUND REPORT
 */
router.get('/finance/chit-fund', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT cg.group_name,
                   COALESCE(cg.total_value,0) AS total_value,
                   COUNT(ci.id) AS paid_count,
                   COALESCE(SUM(ci.amount),0) AS total_paid
            FROM chit_groups cg
            LEFT JOIN chit_installments ci ON ci.chit_group_id = cg.id AND ci.company_id = $1
            WHERE cg.company_id = $1
            GROUP BY cg.id, cg.group_name, cg.total_value
            ORDER BY cg.id DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('chit-fund error:', err.message);
        res.json([]);
    }
});

/**
 * 🤝 BROKER COMMISSION REPORT
 */
router.get('/finance/broker-commission', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT b.name AS broker_name,
                   COALESCE(SUM(i.total_amount),0) AS total_volume,
                   COALESCE(SUM(COALESCE(i.broker_commission,0)),0) AS earned,
                   0 AS paid,
                   COALESCE(SUM(COALESCE(i.broker_commission,0)),0) AS outstanding
            FROM brokers b
            LEFT JOIN invoices i ON i.broker_id = b.id AND COALESCE(i.is_deleted,false)=false
            WHERE b.company_id = $1
            GROUP BY b.id, b.name
            ORDER BY total_volume DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('broker-commission error:', err.message);
        res.json([]);
    }
});

/**
 * 👤 EMPLOYEE LEDGER REPORT
 */
router.get('/hr/employee-ledger', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT e.name AS employee_name,
                   COALESCE(SUM(CASE WHEN sa.id IS NOT NULL THEN COALESCE(sa.current_balance, sa.amount, 0) ELSE 0 END),0) AS advances,
                   0 AS salary_due,
                   COALESCE(SUM(CASE WHEN sa.id IS NOT NULL THEN COALESCE(sa.current_balance, sa.amount, 0) ELSE 0 END),0) AS net_payable
            FROM employees e
            LEFT JOIN salary_advances sa ON sa.employee_id = e.id AND sa.company_id = $1
                AND COALESCE(sa.status,'ACTIVE') != 'RECOVERED'
            WHERE e.company_id = $1
            GROUP BY e.id, e.name
            ORDER BY advances DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('hr/employee-ledger error:', err.message);
        res.json([]);
    }
});

/**
 * 🏥 BUSINESS HEALTH DASHBOARD
 */
router.get('/executive/health', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND invoice_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }

        const [sales, purchases, receivables, loans, collected, proprietorReceipts] = await Promise.all([
            db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' ${dateFilter}`, params),
            // Try purchase_bills, fallback to purchase_bill with different column names
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(()=>({total:0})),
            // Receivables = invoices billed - directly paid via invoice_payments
            db.pgGet(`SELECT COALESCE(SUM(i.total_amount),0) AS total FROM invoices i WHERE i.company_id=$1 AND COALESCE(i.is_deleted,false)=false AND i.status != 'PAID' AND COALESCE(i.bill_purpose,'')!='name_only'`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(principal_outstanding,principal_amount)),0) AS total FROM loans WHERE company_id=$1 AND status='ACTIVE'`, [companyId]).catch(()=>({total:0})),
            // Amount already collected via invoice_payments
            db.pgGet(`SELECT COALESCE(SUM(ip.amount),0) AS total FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id WHERE i.company_id=$1 AND COALESCE(i.is_deleted,false)=false`, [companyId]),
            // Receipts via proprietor personal account
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT'`, [companyId]).catch(()=>({total:0})),
        ]);

        const totalSales      = parseFloat(sales?.total||0);
        const totalPurchases  = parseFloat(purchases?.total||0);
        const totalCollected  = parseFloat(collected?.total||0) + parseFloat(proprietorReceipts?.total||0);
        const totalReceivables = Math.max(0, totalSales - totalCollected);
        const loanOutstanding  = parseFloat(loans?.total||0);

        res.json([
            { metric: 'Total Sales',        value: totalSales,        growth: '-' },
            { metric: 'Total Purchases',    value: totalPurchases,    growth: '-' },
            { metric: 'Total Receivables',  value: totalReceivables,  growth: '-' },
            { metric: 'Loan Outstanding',   value: loanOutstanding,   growth: '-' },
        ]);
    } catch (err) {
        console.error('executive/health error:', err.message);
        res.json([]);
    }
});

/**
 * 📅 DAY CLOSING SUMMARY
 */
router.get('/executive/day-closing', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    const date = startDate || new Date().toISOString().split('T')[0];
    try {
        const [sales, purchases, payments, expenses] = await Promise.all([
            db.pgGet(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount FROM invoices WHERE company_id=$1 AND DATE(invoice_date)=$2::date AND COALESCE(is_deleted,false)=false`, [companyId, date]),
            db.pgGet(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount FROM purchase_bills WHERE company_id=$1 AND DATE(bill_date)=$2::date AND COALESCE(is_deleted,false)=false`, [companyId, date]).catch(()=>({count:0,amount:0})),
            db.pgGet(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id WHERE i.company_id=$1 AND DATE(ip.payment_date)=$2::date`, [companyId, date]),
            db.pgGet(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM expenses WHERE company_id=$1 AND DATE(expense_date)=$2::date`, [companyId, date]).catch(()=>({count:0,amount:0})),
        ]);
        res.json([
            { category: 'Sales',    count: parseInt(sales?.count||0),     amount: parseFloat(sales?.amount||0) },
            { category: 'Purchases',count: parseInt(purchases?.count||0),  amount: parseFloat(purchases?.amount||0) },
            { category: 'Payments', count: parseInt(payments?.count||0),   amount: parseFloat(payments?.amount||0) },
            { category: 'Expenses', count: parseInt(expenses?.count||0),   amount: parseFloat(expenses?.amount||0) },
        ]);
    } catch (err) {
        console.error('day-closing error:', err.message);
        res.json([]);
    }
});

/**
 * 🛒 PURCHASE REGISTER
 */
router.get('/purchase/register', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let where = 'WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted,false)=false';
        const params = [companyId];
        if (startDate && endDate) { where += ` AND pb.bill_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT pb.bill_date AS date, pb.bill_number AS bill_no,
                   COALESCE(s.name, pb.supplier_name, 'Unknown') AS supplier_name,
                   COALESCE(pb.sub_total, 0) AS taxable_amount,
                   COALESCE(pb.tax_total, COALESCE(pb.cgst_total,0)+COALESCE(pb.sgst_total,0)+COALESCE(pb.igst_total,0), 0) AS total_tax,
                   COALESCE(pb.total_amount, 0) AS total_amount,
                   COALESCE(pb.payment_status, pb.status, 'PENDING') AS status
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON pb.supplier_id = s.id
            ${where}
            ORDER BY pb.bill_date DESC, pb.id DESC
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('purchase/register error:', err.message);
        res.json([]);
    }
});

/**
 * 🏭 SUPPLIER-WISE PURCHASE
 */
router.get('/purchase/supplier-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT COALESCE(s.name, pb.supplier_name, 'Unknown') AS supplier_name,
                   COUNT(pb.id) AS bill_count,
                   COALESCE(SUM(pb.total_amount), 0) AS total_purchase,
                   COALESCE(SUM(pb.paid_amount), 0) AS total_paid,
                   COALESCE(SUM(pb.total_amount - COALESCE(pb.paid_amount,0)), 0) AS balance
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON pb.supplier_id = s.id
            WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted,false)=false
            GROUP BY s.id, s.name, pb.supplier_name
            ORDER BY total_purchase DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('purchase/supplier-wise error:', err.message);
        res.json([]);
    }
});

/**
 * 📦 PRODUCT-WISE PURCHASE
 */
router.get('/purchase/product-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT COALESCE(p.name, pbi.product_name, 'Unknown') AS product_name,
                   COALESCE(SUM(pbi.quantity), 0) AS total_qty,
                   COALESCE(AVG(pbi.unit_price), 0) AS avg_cost,
                   COALESCE(SUM(pbi.line_total), 0) AS total_value
            FROM purchase_bill_items pbi
            JOIN purchase_bills pb ON pbi.bill_id = pb.id
            LEFT JOIN products p ON pbi.product_id = p.id
            WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted,false)=false
            GROUP BY p.id, p.name, pbi.product_name
            ORDER BY total_value DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('purchase/product-wise error:', err.message);
        res.json([]);
    }
});

/**
 * 🤝 BROKER-WISE PURCHASE
 */
router.get('/purchase/broker-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT COALESCE(b.name, 'Direct') AS broker_name,
                   COUNT(pb.id) AS bill_count,
                   COALESCE(SUM(pb.total_amount), 0) AS total_purchase
            FROM purchase_bills pb
            LEFT JOIN brokers b ON pb.broker_id = b.id
            WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted,false)=false
            GROUP BY b.id, b.name
            ORDER BY total_purchase DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('purchase/broker-wise error:', err.message);
        res.json([]);
    }
});

/**
 * 💳 PURCHASE PAYMENT REPORT
 */
router.get('/purchase/payments', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let where = 'WHERE pp.company_id = $1';
        const params = [companyId];
        if (startDate && endDate) { where += ` AND pp.payment_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT pp.payment_date AS date,
                   COALESCE(s.name, pb.supplier_name, 'Unknown') AS supplier_name,
                   pp.payment_method AS method,
                   pp.amount,
                   pp.reference_number AS reference
            FROM purchase_bill_payments pp
            JOIN purchase_bills pb ON pp.bill_id = pb.id
            LEFT JOIN suppliers s ON pb.supplier_id = s.id
            ${where}
            ORDER BY pp.payment_date DESC
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        // Fallback: try purchase_payments table
        try {
            const data = await db.pgAll(`SELECT * FROM purchase_payments WHERE company_id=$1 ORDER BY created_at DESC LIMIT 200`, [req.user.active_company_id]);
            res.json(data || []);
        } catch (_) { res.json([]); }
    }
});

/**
 * 🤝 BROKER-WISE SALES
 */
router.get('/sales/broker-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT COALESCE(b.name, 'Direct') AS broker_name,
                   COUNT(i.id) AS invoice_count,
                   COALESCE(SUM(i.total_amount), 0) AS total_sales,
                   COALESCE(SUM(COALESCE(i.broker_commission,0)), 0) AS commission
            FROM invoices i
            LEFT JOIN brokers b ON i.broker_id = b.id
            WHERE i.company_id = $1 AND COALESCE(i.is_deleted,false)=false
              AND COALESCE(i.bill_purpose,'')!='name_only'
            GROUP BY b.id, b.name
            ORDER BY total_sales DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error('sales/broker-wise error:', err.message);
        res.json([]);
    }
});

/**
 * ↩️ SALES RETURN REPORT
 */
router.get('/sales/returns', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let where = `WHERE i.company_id=$1 AND UPPER(COALESCE(i.invoice_type,''))='SALES_RETURN' AND COALESCE(i.is_deleted,false)=false`;
        const params = [companyId];
        if (startDate && endDate) { where += ` AND i.invoice_date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT i.invoice_date AS date, i.invoice_number AS return_no,
                   COALESCE(u.username, u.name, 'Unknown') AS customer_name,
                   COALESCE(i.total_amount, 0) AS amount
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            ${where}
            ORDER BY i.invoice_date DESC
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('sales/returns error:', err.message);
        res.json([]);
    }
});

/**
 * 👥 ATTENDANCE REPORT
 */
router.get('/hr/attendance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND a.date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        const sql = `
            SELECT e.name,
                   COUNT(CASE WHEN UPPER(a.status) IN ('PRESENT','P') THEN 1 END) AS present_days,
                   COUNT(CASE WHEN UPPER(a.status) IN ('ABSENT','A')  THEN 1 END) AS absent_days,
                   COUNT(CASE WHEN UPPER(a.status) IN ('OD','ON_DUTY','ON-DUTY') THEN 1 END) AS od_days,
                   CASE WHEN COUNT(a.id) > 0
                        THEN ROUND(COUNT(CASE WHEN UPPER(a.status) IN ('PRESENT','P','OD','ON_DUTY','HALF_DAY') THEN 1 END)::numeric / COUNT(a.id) * 100, 1)::TEXT || '%'
                        ELSE '0%' END AS pct
            FROM employees e
            LEFT JOIN attendance_logs a ON a.employee_id = e.id AND a.company_id = $1 ${dateFilter}
            WHERE e.company_id = $1
            GROUP BY e.id, e.name
            ORDER BY e.name
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('hr/attendance error:', err.message);
        res.json([]);
    }
});

/**
 * 💼 SALARY REGISTER
 */
router.get('/hr/salary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) { dateFilter = `AND sp.date BETWEEN $2::date AND $3::date`; params.push(startDate, endDate); }
        // salary_payments: employee_id, salary_id, amount, mode, date
        // salaries: employee_id, base_salary, bonus, deductions, advance_deducted, final_salary
        const sql = `
            SELECT e.name,
                   COALESCE(SUM(s.base_salary + COALESCE(s.bonus,0)), SUM(sp.amount), 0)  AS gross,
                   COALESCE(SUM(COALESCE(s.deductions,0) + COALESCE(s.advance_deducted,0)), 0) AS deductions,
                   COALESCE(SUM(COALESCE(s.final_salary, sp.amount, 0)), 0) AS net,
                   CASE WHEN COUNT(sp.id)>0 THEN 'PAID' ELSE 'PENDING' END AS status
            FROM employees e
            LEFT JOIN salary_payments sp ON sp.employee_id = e.id ${dateFilter}
            LEFT JOIN salaries s ON s.id = sp.salary_id
            WHERE e.company_id = $1
            GROUP BY e.id, e.name
            ORDER BY net DESC
        `;
        const data = await db.pgAll(sql, params);
        res.json(data || []);
    } catch (err) {
        console.error('hr/salary error:', err.message);
        res.json([]);
    }
});

// ─── Discount / Waiver Report ──────────────────────────────────────────────
router.get('/discounts', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { from, to } = req.query;
    try {
        let dateClause = '';
        const params = [companyId];
        if (from && to) {
            dateClause = ` AND i.invoice_date >= $2::date AND i.invoice_date <= $3::date`;
            params.push(from, to);
        }

        // Per-invoice detail rows
        const rows = await db.pgAll(`
            SELECT
                i.id,
                i.invoice_number,
                i.invoice_date AS date,
                u.username AS customer_name,
                i.total_amount,
                COALESCE(i.discount_amount, 0) AS discount_amount,
                CASE WHEN i.total_amount > 0
                     THEN ROUND(COALESCE(i.discount_amount, 0) * 100.0 / i.total_amount, 1)
                     ELSE 0 END AS discount_pct,
                i.notes
            FROM invoices i
            JOIN users u ON u.id = i.customer_id
            WHERE i.company_id = $1
              AND COALESCE(i.is_deleted, false) = false
              AND UPPER(COALESCE(i.invoice_type, '')) != 'SALES_RETURN'
              AND COALESCE(i.discount_amount, 0) > 0
              ${dateClause}
            ORDER BY i.invoice_date DESC
        `, params);

        // Customer-level summary
        const byCustomer = await db.pgAll(`
            SELECT
                u.username AS customer_name,
                COUNT(*) AS invoice_count,
                SUM(COALESCE(i.discount_amount, 0)) AS total_discount,
                SUM(i.total_amount) AS total_billed,
                CASE WHEN SUM(i.total_amount) > 0
                     THEN ROUND(SUM(COALESCE(i.discount_amount, 0)) * 100.0 / SUM(i.total_amount), 1)
                     ELSE 0 END AS discount_pct
            FROM invoices i
            JOIN users u ON u.id = i.customer_id
            WHERE i.company_id = $1
              AND COALESCE(i.is_deleted, false) = false
              AND UPPER(COALESCE(i.invoice_type, '')) != 'SALES_RETURN'
              AND COALESCE(i.discount_amount, 0) > 0
              ${dateClause}
            GROUP BY u.id, u.username
            ORDER BY total_discount DESC
        `, params);

        const totalDiscount = rows.reduce((s, r) => s + parseFloat(r.discount_amount || 0), 0);
        const totalBilled   = rows.reduce((s, r) => s + parseFloat(r.total_amount   || 0), 0);

        res.json({
            data: { rows, byCustomer },
            summary: {
                total_discount: totalDiscount,
                total_billed: totalBilled,
                invoice_count: rows.length,
                customer_count: byCustomer.length,
                avg_discount_pct: totalBilled > 0 ? ((totalDiscount / totalBilled) * 100).toFixed(1) : '0',
            }
        });
    } catch (err) {
        console.error('discounts report error:', err.message);
        res.json({ data: { rows: [], byCustomer: [] }, summary: {} });
    }
});

// ─── Enterprise Reports Sub-Routers ────────────────────────────────────────
import salesReports from './reports/sales.js';
import purchaseReports from './reports/purchase.js';
import inventoryReports from './reports/inventory.js';
import financeNewReports from './reports/finance.js';
import gstNewReports from './reports/gst.js';
import hrNewReports from './reports/hr.js';
import executiveNewReports from './reports/executive.js';
import savedReports from './reports/saved.js';
import proprietorReports from './reports/proprietor.js';

router.use('/sales', salesReports);
router.use('/purchase', purchaseReports);
router.use('/inventory', inventoryReports);
router.use('/finance', financeNewReports);
router.use('/gst', gstNewReports);
router.use('/hr', hrNewReports);
router.use('/executive', executiveNewReports);
router.use('/proprietor', proprietorReports);
router.use('/', savedReports);

export default router;
