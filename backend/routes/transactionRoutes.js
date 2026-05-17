// backend/routes/transactionRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Direct transaction routes
 */

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

// GET /api/transactions - Get all transactions (with optional filters)
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { lender_id, user_id, type, category } = req.query;
    const branchFilter = getBranchFilter(req);

    try {
        let sql = `
            SELECT DISTINCT ON (t.id)
                   t.*,
                   l.lender_name,
                   u.username AS user_name,
                   COALESCE(l.lender_name, u.username, t.party_name) AS display_party,
                   COALESCE(NULLIF(t.amount, 0),
                       (SELECT SUM(tl.credit_amount) FROM transaction_lines tl WHERE tl.transaction_id = t.id)
                   ) AS computed_amount
            FROM transactions t
            LEFT JOIN lenders l ON l.id = t.lender_id
            LEFT JOIN users   u ON u.id = t.user_id
            WHERE t.company_id = $1 AND ${branchFilter}
        `;

        const params = [companyId];
        let paramCount = 2;

        if (lender_id) {
            sql += ` AND t.lender_id = $${paramCount++}`;
            params.push(lender_id);
        }
        if (user_id) {
            sql += ` AND t.user_id = $${paramCount++}`;
            params.push(user_id);
        }
        if (type) {
            sql += ` AND t.type = $${paramCount++}`;
            params.push(type);
        }
        if (category) {
            sql += ` AND t.category = $${paramCount++}`;
            params.push(category);
        }

        sql += ` ORDER BY t.id DESC, t.created_at DESC`;

        console.log('📊 SQL Query:', sql);
        console.log('📊 Params:', params);

        const rows = await db.pgAll(sql, params);
        
        console.log('📊 Rows returned:', rows?.length || 0);

        // Normalise date + amount for accounting-engine transactions
        const normalised = rows.map(r => ({
            ...r,
            date: r.transaction_date || r.date || r.created_at,
            // computed_amount = COALESCE(amount, sum of transaction_lines credits)
            amount: Number(r.computed_amount) || Number(r.amount) || 0,
            // Normalise type — accounting engine rows have reference_type, not type
            type: r.type || r.reference_type || 'GENERAL',
            // display_party is the authoritative resolved name from SQL COALESCE
            display_party: r.display_party || null,
            party_name:    r.display_party || r.lender_name || r.user_name || null,
        }));

        // ── FALLBACK: if accounting-engine recorded 0 rows, expose cash/bank
        //    ledger entries as synthetic transactions so the page is never empty.
        if (normalised.length === 0) {
            const ledgerRows = await db.pgAll(`
                SELECT
                    ('CL-' || cl.id::text)         AS id,
                    cl.date,
                    cl.source                       AS type,
                    cl.source                       AS reference_type,
                    cl.amount,
                    cl.source                       AS description,
                    'CASH'                          AS mode,
                    NULL                            AS display_party,
                    NULL                            AS party_name,
                    cl.created_at,
                    NULL                            AS proof_url,
                    'in'                            AS ledger_direction
                FROM cash_ledger cl
                WHERE cl.company_id = $1

                UNION ALL

                SELECT
                    ('BL-' || bl.id::text)         AS id,
                    bl.date,
                    bl.source                       AS type,
                    bl.source                       AS reference_type,
                    bl.amount,
                    COALESCE(bl.bank_name, bl.source) AS description,
                    'BANK'                          AS mode,
                    NULL                            AS display_party,
                    NULL                            AS party_name,
                    bl.created_at,
                    NULL                            AS proof_url,
                    bl.direction                    AS ledger_direction
                FROM bank_ledger bl
                WHERE bl.company_id = $1

                ORDER BY date DESC, created_at DESC
            `, [companyId]);

            const synthNorm = ledgerRows.map(r => ({
                ...r,
                date: r.date || r.created_at,
                amount: Number(r.amount) || 0,
            }));
            return res.json(synthNorm);
        }

        res.json(normalised);
    } catch (err) {
        console.error("Fetch Transactions Error:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

// ── FINANCIAL SUMMARY ────────────────────────────────────────────────────────
// Single source of truth for inflow/outflow stats — reads directly from
// cash_ledger + bank_ledger (same tables the Ledgers page uses).
// This ensures Transactions stats cards always match the Ledgers page.
router.get('/financial-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchFilter = getBranchFilter(req);

    try {
        const row = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) AS total_inflow,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS total_outflow
            FROM (
                SELECT amount, direction FROM cash_ledger WHERE company_id = $1 AND ${branchFilter}
                UNION ALL
                SELECT amount, direction FROM bank_ledger  WHERE company_id = $1 AND ${branchFilter}
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