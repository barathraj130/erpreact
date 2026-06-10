
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "./uploads/qrcodes";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `qr_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

const router = express.Router();

// Get all active payment methods for billing
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const qrs = await db.pgAll('SELECT * FROM payment_qr_codes WHERE company_id = $1 AND is_active = true ORDER BY sort_order ASC, id ASC', [companyId]);
        const banks = await db.pgAll('SELECT * FROM company_bank_accounts WHERE company_id = $1 AND is_active = true ORDER BY sort_order ASC, id ASC', [companyId]);
        
        res.json({ qrs, banks });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch payment methods" });
    }
});

// Admin ONLY routes below
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: "Only admins can manage payment methods." });
    }
    next();
};

// --- QR CODES ---
router.get('/qr', authMiddleware, adminOnly, async (req, res) => {
    try {
        const qrs = await db.pgAll('SELECT * FROM payment_qr_codes WHERE company_id = $1 ORDER BY sort_order ASC, id ASC', [req.user.active_company_id]);
        res.json(qrs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/qr', authMiddleware, adminOnly, upload.single('image'), async (req, res) => {
    const { label, upi_id, is_active } = req.body;
    const imageUrl = req.file ? `/uploads/qrcodes/${req.file.filename}` : null;
    try {
        const qr = await db.pgGet(`
            INSERT INTO payment_qr_codes (company_id, label, upi_id, image_url, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [req.user.active_company_id, label, upi_id, imageUrl, is_active !== 'false', req.user.id]);
        res.json(qr);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/qr/:id', authMiddleware, adminOnly, upload.single('image'), async (req, res) => {
    const { label, upi_id, is_active } = req.body;
    try {
        let sql = `UPDATE payment_qr_codes SET label=$1, upi_id=$2, is_active=$3, updated_at=NOW()`;
        let params = [label, upi_id, is_active !== 'false'];
        
        if (req.file) {
            sql += `, image_url=$4`;
            params.push(`/uploads/qrcodes/${req.file.filename}`);
        }
        
        sql += ` WHERE id=$${params.length + 1} AND company_id=$${params.length + 2} RETURNING *`;
        params.push(req.params.id, req.user.active_company_id);
        
        const qr = await db.pgGet(sql, params);
        res.json(qr);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/qr/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await db.pgRun('DELETE FROM payment_qr_codes WHERE id=$1 AND company_id=$2', [req.params.id, req.user.active_company_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BANK ACCOUNTS ---
router.get('/bank', authMiddleware, adminOnly, async (req, res) => {
    try {
        const banks = await db.pgAll('SELECT * FROM company_bank_accounts WHERE company_id = $1 ORDER BY sort_order ASC, id ASC', [req.user.active_company_id]);
        res.json(banks);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bank', authMiddleware, adminOnly, async (req, res) => {
    const { bank_name, account_number, ifsc_code, account_type, holder_name, display_name, upi_id, is_active } = req.body;
    try {
        const bank = await db.pgGet(`
            INSERT INTO company_bank_accounts 
            (company_id, bank_name, account_number, ifsc_code, account_type, holder_name, display_name, upi_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [req.user.active_company_id, bank_name, account_number, ifsc_code, account_type, holder_name, display_name, upi_id, is_active !== false]);
        res.json(bank);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/bank/:id', authMiddleware, adminOnly, async (req, res) => {
    const { bank_name, account_number, ifsc_code, account_type, holder_name, display_name, upi_id, is_active } = req.body;
    try {
        const bank = await db.pgGet(`
            UPDATE company_bank_accounts SET 
                bank_name=$1, account_number=$2, ifsc_code=$3, account_type=$4, 
                holder_name=$5, display_name=$6, upi_id=$7, is_active=$8, updated_at=NOW()
            WHERE id=$9 AND company_id=$10 RETURNING *
        `, [bank_name, account_number, ifsc_code, account_type, holder_name, display_name, upi_id, is_active !== false, req.params.id, req.user.active_company_id]);
        res.json(bank);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/bank/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await db.pgRun('DELETE FROM company_bank_accounts WHERE id=$1 AND company_id=$2', [req.params.id, req.user.active_company_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
