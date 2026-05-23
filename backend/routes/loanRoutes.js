
import express from 'express';
import * as financeService from '../services/financeService.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';
import { triggerN8N } from '../utils/triggerN8N.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        // Absolute minimum query — no JOINs, no subqueries, no new columns.
        // Just get all loan rows first. Frontend handles missing fields with fallbacks.
        const loans = await db.pgAll(`SELECT * FROM loans ORDER BY id DESC`);
        console.log(`GET /loans → ${loans.length} rows`);

        // Attach lender_name from lenders table (separate safe query)
        const lenderIds = [...new Set(loans.map(l => l.lender_id).filter(Boolean))];
        let lenderMap = {};
        if (lenderIds.length > 0) {
            const lenders = await db.pgAll(
                `SELECT id, lender_name, lender_type, phone FROM lenders WHERE id = ANY($1)`,
                [lenderIds]
            );
            lenders.forEach(ln => { lenderMap[ln.id] = ln; });
        }

        const result = loans.map(l => ({
            ...l,
            lender_name:  lenderMap[l.lender_id]?.lender_name || l.party_name || 'Unknown',
            lender_type:  lenderMap[l.lender_id]?.lender_type || l.party_type || 'Bank',
            lender_phone: lenderMap[l.lender_id]?.phone || null,
            loan_type:    l.loan_type || l.party_type || 'BANK',
            remaining_principal: l.principal_outstanding ?? l.outstanding_amount ?? l.principal_amount,
            paid_principal:   0,
            total_paid:       0,
            total_interest_paid: 0,
        }));

        res.json(result);
    } catch (err) {
        console.error('GET /loans CRASH:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// FIX 2: Sync lender opening balances → loan records (runs once per lender with balance but no loan)
router.post('/sync-from-lenders', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        // Find lenders with any balance but no loan record at all
        const orphans = await client.query(`
            SELECT id, lender_name, lender_type, phone,
                GREATEST(
                    COALESCE(opening_balance, 0),
                    COALESCE(current_balance, 0),
                    COALESCE(initial_payable_balance, 0)
                ) AS balance
            FROM lenders
            WHERE company_id = $1
              AND GREATEST(
                    COALESCE(opening_balance, 0),
                    COALESCE(current_balance, 0),
                    COALESCE(initial_payable_balance, 0)
                  ) > 0
              AND id NOT IN (SELECT lender_id FROM loans WHERE lender_id IS NOT NULL)
        `, [companyId]);

        console.log(`Sync: found ${orphans.rows.length} lenders needing loan records`);

        const created = [];
        for (const l of orphans.rows) {
            const loanType = (l.lender_type === 'Bank' || l.lender_type === 'BANK') ? 'BANK' : 'PRIVATE';
            const isBank = loanType === 'BANK';

            // INSERT using only original stable columns — no loan_type/principal_outstanding
            // (those may not exist on older deployed DBs)
            const ins = await client.query(`
                INSERT INTO loans (
                    company_id, lender_id, party_name, party_type,
                    loan_direction, principal_amount,
                    interest_rate, interest_type, start_date, duration_months,
                    repayment_cycle, status, notes
                ) VALUES ($1, $2, $3, $4,
                    'BORROWED', $5,
                    12, $6, CURRENT_DATE, 0,
                    $7, 'ACTIVE', 'Auto-created from lender opening balance')
                RETURNING id
            `, [
                companyId, l.id, l.lender_name, loanType,
                l.balance,
                isBank ? 'REDUCING' : 'FLAT',
                isBank ? 'MONTHLY' : 'INDEFINITE'
            ]);

            const loanId = ins.rows[0].id;

            // Best-effort: set new columns if they exist
            await client.query(`SAVEPOINT sp_sync_new_cols`);
            try {
                await client.query(
                    `UPDATE loans SET loan_type = $1, principal_outstanding = $2 WHERE id = $3`,
                    [loanType, l.balance, loanId]
                );
                await client.query(`RELEASE SAVEPOINT sp_sync_new_cols`);
            } catch (_) {
                await client.query(`ROLLBACK TO SAVEPOINT sp_sync_new_cols`);
                await client.query(`RELEASE SAVEPOINT sp_sync_new_cols`);
            }

            created.push({ lender: l.lender_name, loan_id: loanId, amount: l.opening_balance });
        }

        await client.query('COMMIT');
        res.json({ synced: created.length, loans: created });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sync lenders error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const loan = await financeService.createLoan(req.user, req.body);
        res.status(201).json(loan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/repayment', authMiddleware, async (req, res) => {
    try {
        const repayment = await financeService.recordLoanRepayment(req.user, req.body);
        res.status(201).json(repayment);

        // ── Non-blocking post-response notifications ────────────────────────
        try {
            const companyId = req.user.active_company_id;
            const loanInfo = await db.pgGet(
                `SELECT l.principal_amount, l.duration_months, ln.lender_name,
                        GREATEST(0, l.principal_amount - COALESCE((
                            SELECT SUM(principal_component) FROM loan_payments
                            WHERE loan_id = l.id AND company_id = $1
                        ), 0)) AS outstanding
                 FROM loans l
                 LEFT JOIN lenders ln ON l.lender_id = ln.id
                 WHERE l.id = $2 AND l.company_id = $1`,
                [companyId, req.body.loan_id]
            );
            await triggerN8N('erp-alert', {
                event_type:   'loan_due',
                lender_name:  loanInfo?.lender_name || 'Lender',
                emi_amount:   req.body.total_amount,
                due_date:     req.body.payment_date,
                outstanding:  loanInfo?.outstanding ?? 0,
            });

            // WhatsApp to owner
            const { notifyOwner } = await import('../utils/whatsapp.js');
            const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const pType = (req.body.payment_type || 'EMI').toUpperCase();
            const interestComp  = parseFloat(req.body.interest_component  || (pType === 'INTEREST'  ? req.body.total_amount : 0));
            const principalComp = parseFloat(req.body.principal_component || (pType === 'PRINCIPAL' ? req.body.total_amount : 0));

            // Choose emoji and title based on what was actually paid
            const emoji = pType === 'INTEREST' ? '💸' : pType === 'PRINCIPAL' ? '🏦' : '🏦';
            const title = pType === 'INTEREST'  ? 'Interest Payment Recorded'
                        : pType === 'PRINCIPAL' ? 'Principal Repayment Done'
                        : 'Loan EMI Recorded';

            // Build breakdown line only when both components are non-zero
            const breakdown = (interestComp > 0 && principalComp > 0)
                ? `\nInterest:    ₹${fmt(interestComp)}\nPrincipal:   ₹${fmt(principalComp)}`
                : '';

            await notifyOwner(
`${emoji} ${title}

Lender:      ${loanInfo?.lender_name || 'Unknown'}
Amount:      ₹${fmt(req.body.total_amount)}${breakdown}
Principal Outstanding: ₹${fmt(loanInfo?.outstanding ?? 0)}
Date:        ${req.body.payment_date || new Date().toLocaleDateString('en-IN')}`);

        } catch (e) {
            console.log('Post-loan notification failed silently:', e.message);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:loanId/repayments', authMiddleware, async (req, res) => {
    try {
        const repayments = await db.pgAll(
            `SELECT * FROM loan_payments WHERE loan_id = $1 AND company_id = $2 ORDER BY payment_date DESC`,
            [req.params.loanId, req.user.active_company_id]
        );
        res.json(repayments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch repayments' });
    }
});

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const summary = await financeService.getFinanceSummary(req.user.active_company_id);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

export default router;
