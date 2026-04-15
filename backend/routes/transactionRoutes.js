// backend/routes/transactionRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Direct transaction routes
 */

// GET /api/transactions - Get all transactions (with optional filters)
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { lender_id, user_id, type, category } = req.query;

    console.log('📊 Transaction API called:', { companyId, lender_id, user_id, type, category });

    try {
        let sql = `
            SELECT t.*, 
                   l.lender_name, 
                   u.username as user_name,
                   ledg.name as ledger_name
            FROM transactions t
            LEFT JOIN lenders l ON t.lender_id = l.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN ledgers ledg ON t.ledger_id = ledg.id
            WHERE t.company_id = $1
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

        sql += ` ORDER BY t.date DESC, t.created_at DESC`;

        console.log('📊 SQL Query:', sql);
        console.log('📊 Params:', params);

        const rows = await db.pgAll(sql, params);
        
        console.log('📊 Rows returned:', rows?.length || 0);
        
        res.json(rows);
    } catch (err) {
        console.error("Fetch Transactions Error:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
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
import puppeteer from 'puppeteer';

router.get('/:id/pdf', authMiddleware, async (req, res) => {
    const transactionId = Number(req.params.id);
    const companyId = req.user.active_company_id;

    try {
        const txResult = await db.pgGet('SELECT * FROM transactions WHERE id = $1 AND company_id = $2', [transactionId, companyId]);
        if (!txResult) return res.status(404).json({ error: "Transaction not found" });

        const companyResult = await db.pgGet('SELECT * FROM companies WHERE id = $1', [companyId]);
        let companyName = companyResult ? companyResult.company_name : "RIDGE GREEN CORPORATION";
        
        // Auto wrap for 2+ word company name
        const words = companyName.split(' ');
        if (words.length > 1) {
            const mid = Math.ceil(words.length / 2);
            companyName = words.slice(0, mid).join(' ') + '<br/>' + words.slice(mid).join(' ');
        }

        // Parse description dynamically
        let partyName = "";
        let purpose = txResult.description;
        if (purpose && purpose.startsWith("Cash Receipt - ")) {
            const stripped = purpose.replace("Cash Receipt - ", "");
            const parts = stripped.split(": ");
            if (parts.length > 1) {
                partyName = parts[0];
                purpose = parts.slice(1).join(": ");
            } else {
                partyName = stripped;
            }
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