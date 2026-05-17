// backend/routes/transactionRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Direct transaction routes
 */

// Helper: convert branch filter alias from 't.' to the given table alias
const applyAlias = (filter, alias) =>
    filter.includes('t.') ? filter.replace(/\bt\./g, alias + '.') : filter;

// Helper for branch filtering
const getBranchFilter = (req) => {
    const headerBranch = req.headers['x-branch-id'];
    const role = req.user.role;
    const userBranch = req.user.branch_id;

    if (headerBranch && headerBranch !== 'all' && headerBranch !== 'null' && !isNaN(Number(headerBranch))) {
        return 't.branch_id = ' + Number(headerBranch);
    }
    if (role === 'admin' && (!headerBranch || headerBranch === 'all')) {
        return '1=1';
    }
    if (userBranch) {
        return 't.branch_id = ' + userBranch;
    }
    return '1=1';
};

// ── GET /api/transactions ─────────────────────────────────────────────────────
// Single Source of Truth: reads cash_ledger + bank_ledger (same tables the
// financial-summary and Ledgers page use), enriched with transactions table
// metadata where available.  This guarantees the audit trail always matches
// the summary cards — no fallback logic required.
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const rawFilter = getBranchFilter(req);
    const clFilter  = applyAlias(rawFilter, 'cl');
    const blFilter  = applyAlias(rawFilter, 'bl');

    try {
        // ── 1. Enriched cash-ledger rows ──────────────────────────────────────
        // cash_ledger.reference_id links to transactions.id when the entry was
        // created by processTransaction() (Record Transaction form).
        // Loan / chit entries have no reference_id — we still show them raw.
        const sql = `
            SELECT
                ('CL-' || cl.id::text)                                     AS id,
                cl.date,
                COALESCE(t.type, cl.source)                                AS type,
                cl.source                                                   AS reference_type,
                cl.amount,
                'CASH'                                                      AS mode,
                COALESCE(t.description, cl.source)                         AS description,
                'in'                                                        AS ledger_direction,
                COALESCE(ln.lender_name, t.party_name, t.description)      AS display_party,
                COALESCE(ln.lender_name, t.party_name)                     AS party_name,
                t.proof_url,
                cl.created_at
            FROM cash_ledger cl
            LEFT JOIN transactions t  ON t.id  = cl.reference_id AND t.company_id = $1
            LEFT JOIN lenders      ln ON ln.id = t.lender_id
            WHERE cl.company_id = $1 AND ${clFilter}

            UNION ALL

            SELECT
                ('BL-' || bl.id::text)                                     AS id,
                bl.date,
                COALESCE(t.type, bl.source)                                AS type,
                bl.source                                                   AS reference_type,
                bl.amount,
                'BANK'                                                      AS mode,
                COALESCE(bl.bank_name, t.description, bl.source)           AS description,
                bl.direction                                                AS ledger_direction,
                COALESCE(ln.lender_name, t.party_name, t.description)      AS display_party,
                COALESCE(ln.lender_name, t.party_name)                     AS party_name,
                t.proof_url,
                bl.created_at
            FROM bank_ledger bl
            LEFT JOIN transactions t  ON t.id  = bl.reference_id AND t.company_id = $1
            LEFT JOIN lenders      ln ON ln.id = t.lender_id
            WHERE bl.company_id = $1 AND ${blFilter}

            ORDER BY date DESC, created_at DESC
        `;

        const rows = await db.pgAll(sql, [companyId]);
        console.log(`📊 Transactions (cash+bank ledger) returned: ${rows.length} rows`);

        const normalised = rows.map(r => ({
            ...r,
            date:         r.date,
            amount:       Number(r.amount) || 0,
            type:         r.type || r.reference_type || 'GENERAL',
            display_party: r.display_party || null,
            party_name:   r.display_party || r.party_name || null,
        }));

        res.json(normalised);
    } catch (err) {
        console.error('Fetch Transactions Error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// ── FINANCIAL SUMMARY ────────────────────────────────────────────────────────
// Single source of truth for inflow/outflow stats — reads directly from
// cash_ledger + bank_ledger (same tables the Ledgers page uses).
// This ensures Transactions stats cards always match the Ledgers page.
router.get('/financial-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const rawFilter = getBranchFilter(req);
    const clFilter  = applyAlias(rawFilter, 'cl');
    const blFilter  = applyAlias(rawFilter, 'bl');

    try {
        const row = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) AS total_inflow,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS total_outflow
            FROM (
                SELECT amount, direction FROM cash_ledger cl WHERE cl.company_id = $1 AND ${clFilter}
                UNION ALL
                SELECT amount, direction FROM bank_ledger bl WHERE bl.company_id = $1 AND ${blFilter}
            ) combined
        `, [companyId]);

        const inflow  = Number(row?.total_inflow  || 0);
        const outflow = Number(row?.total_outflow || 0);
        res.json({ total_inflow: inflow, total_outflow: outflow, net_balance: inflow - outflow });
    } catch (err) {
        console.error("Financial summary error:", err);
        res.status(500).json({ error: "Failed to fetch financial summary" });
    }
});

// ── DEBUG ENDPOINT ────────────────────────────────────────────────────────────
// GET /api/transactions/debug — raw DB counts so we can diagnose empty tables.
// Admin only. Does NOT filter by branch so you see everything.
router.get('/debug', authMiddleware, async (req, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const cid = req.user.active_company_id;
    try {
        const [txCount, clCount, blCount, latestTx, latestCl, latestBl] = await Promise.all([
            db.pgGet(`SELECT COUNT(*) AS cnt FROM transactions WHERE company_id = $1`, [cid]),
            db.pgGet(`SELECT COUNT(*) AS cnt FROM cash_ledger  WHERE company_id = $1`, [cid]),
            db.pgGet(`SELECT COUNT(*) AS cnt FROM bank_ledger  WHERE company_id = $1`, [cid]),
            db.pgGet(`SELECT id, company_id, branch_id, amount, type, reference_type, date, transaction_date, created_at FROM transactions WHERE company_id = $1 ORDER BY id DESC LIMIT 1`, [cid]),
            db.pgGet(`SELECT id, company_id, branch_id, source, amount, direction, date, created_at FROM cash_ledger  WHERE company_id = $1 ORDER BY id DESC LIMIT 1`, [cid]),
            db.pgGet(`SELECT id, company_id, branch_id, source, amount, direction, date, created_at FROM bank_ledger  WHERE company_id = $1 ORDER BY id DESC LIMIT 1`, [cid]),
        ]);
        res.json({
            company_id: cid,
            user_branch_id: req.user.branch_id,
            user_role: req.user.role,
            counts: {
                transactions: Number(txCount?.cnt || 0),
                cash_ledger:  Number(clCount?.cnt || 0),
                bank_ledger:  Number(blCount?.cnt || 0),
            },
            latest: {
                transaction: latestTx || null,
                cash_ledger: latestCl || null,
                bank_ledger: latestBl || null,
            }
        });
    } catch (err) {
        console.error('Debug endpoint error:', err);
        res.status(500).json({ error: err.message });
    }
});

import multer from 'multer';
import path from 'path';
import { processTransaction } from '../services/transactionService.js';

// Multer Storage for Proofs
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/proofs/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error("Only Image (JPG/PNG) and PDF files are allowed."));
    }
});

// POST /api/transactions - Create a general transaction with optional proof
router.post('/', authMiddleware, upload.single('proof'), async (req, res) => {
    try {
        const txData = { 
            ...req.body, 
            proof_url: req.file ? `/uploads/proofs/${req.file.filename}` : null 
        };
        
        const result = await processTransaction(txData, req.user);
        res.status(201).json({ 
            success: true, 
            id: result.transactionId, 
            message: "Transaction recorded and ledgers updated successfully." 
        });
    } catch (error) {
        console.error("Error creating transaction:", error.message);
        res.status(500).json({ error: error.message || "Failed to record transaction." });
    }
});

// GET /api/transactions/:id/pdf - Generate Cash Voucher PDF
import * as puppeteer from 'puppeteer';

router.get('/:id/pdf', authMiddleware, async (req, res) => {
    const transactionId = Number(req.params.id);
    const companyId = req.user.active_company_id;

    try {
        const txResult = await db.pgGet(`
            SELECT t.*,
                   COALESCE(NULLIF(t.amount, 0),
                       (SELECT SUM(tl.credit_amount) FROM transaction_lines tl WHERE tl.transaction_id = t.id)
                   ) AS display_amount,
                   l.lender_name
            FROM transactions t
            LEFT JOIN lenders l ON t.lender_id = l.id
            WHERE t.id = $1 AND t.company_id = $2
        `, [transactionId, companyId]);
        if (!txResult) return res.status(404).json({ error: "Transaction not found" });
        // Use display_amount for the PDF
        txResult.amount = txResult.display_amount || txResult.amount || 0;

        const companyResult = await db.pgGet('SELECT * FROM companies WHERE id = $1', [companyId]);
        let companyName = companyResult ? companyResult.company_name : "RIDGE GREEN CORPORATION";
        
        // Auto wrap for 2+ word company name
        const words = companyName.split(' ');
        if (words.length > 1) {
            const mid = Math.ceil(words.length / 2);
            companyName = words.slice(0, mid).join(' ') + '<br/>' + words.slice(mid).join(' ');
        }

        // Parse description dynamically
        let partyName = txResult.lender_name || "";
        let purpose = txResult.description || "";
        if (!partyName && purpose.startsWith("Cash Receipt - ")) {
            const stripped = purpose.replace("Cash Receipt - ", "");
            const parts = stripped.split(": ");
            if (parts.length > 1) {
                partyName = parts[0];
                purpose = parts.slice(1).join(": ");
            } else {
                partyName = stripped;
            }
        } else if (!partyName && purpose.includes(" from ")) {
            // e.g. "Loan received from MOHAN"
            partyName = purpose.split(" from ").slice(1).join(" from ");
        }

        const dateStr = new Date(txResult.date || txResult.created_at).toLocaleDateString('en-IN');

        const html = `
        <html>
        <head>
            <style>
                body { margin: 0; padding: 40px; font-family: 'Helvetica', Arial, sans-serif; display: flex; justify-content: center; background: white; }
                .receipt-container { 
                    width: 250mm; 
                    min-height: 120mm; 
                    border: 10px solid #0f6e3c; 
                    padding: 30px 50px; 
                    box-sizing: border-box; 
                    position: relative;
                }
                .title { font-size: 38px; font-weight: 800; color: #0f6e3c; text-align: center; margin-top: 10px; margin-bottom: 0px; letter-spacing: 1px; }
                .company-name { position: absolute; right: 50px; top: 40px; font-size: 16px; font-weight: 800; color: #0f6e3c; text-align: right; line-height: 1.2; }
                table { width: 100%; border-collapse: collapse; margin-top: 40px; font-size: 18px; border: 1px solid #444; }
                td { border: 1px solid #444; padding: 14px 20px; }
                .label { color: #444; display: inline-block; vertical-align: top; margin-right: 10px; font-weight: 500; }
                .val { font-weight: 700; color: #111; display: inline-block; }
                .box-row { height: 120px; vertical-align: top; }
                .footer-row td { width: 50%; height: 80px; vertical-align: bottom; padding: 14px 20px; }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="title">CASH VOUCHER</div>
                <div class="company-name">${companyName}</div>
                
                <table>
                    <tr>
                        <td colspan="2">
                            <span class="label">Transaction Type:</span> <span class="val">CASH RECEIPT (#${txResult.id})</span>
                            <span style="float: right; margin-right: 20px;"><span class="label">Date:</span> <span class="val">${dateStr}</span></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="label">Amount:</span> <span class="val">Rs. ${Number(txResult.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="label">To:</span> <span class="val">${partyName}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2" class="box-row">
                            <span class="label" style="display:block; margin-bottom: 8px;">Purpose:</span> 
                            <span class="val" style="font-weight: 500;">${purpose}</span>
                        </td>
                    </tr>
                    <tr class="footer-row">
                        <td><span class="label">Approved By:</span></td>
                        <td><span class="label">Signature:</span></td>
                    </tr>
                </table>
            </div>
        </body>
        </html>
        `;

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            landscape: true, 
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Cash_Voucher_${transactionId}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("Receipt PDF Error:", err);
        res.status(500).json({ error: "Failed to generate PDF voucher" });
    }
});

export default router;