
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// GET settings
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const settings = await db.pgGet('SELECT * FROM bill_format_settings WHERE company_id = $1', [companyId]);
        if (!settings) {
            // Return defaults if none exist
            return res.json({
                bill_title: 'Tax Invoice',
                show_hsn: true,
                show_gst_breakup: true,
                show_barcode: true,
                show_branch_name: true,
                paper_size: 'A4'
            });
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// POST/PUT save settings
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { 
        logo_url, business_name, address, gstin, phone, email,
        bill_title, show_hsn, show_gst_breakup, show_barcode, 
        show_branch_name, footer_message, paper_size 
    } = req.body;

    try {
        const sql = `
            INSERT INTO bill_format_settings (
                company_id, logo_url, business_name, address, gstin, phone, email,
                bill_title, show_hsn, show_gst_breakup, show_barcode, 
                show_branch_name, footer_message, paper_size
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (company_id) DO UPDATE SET
                logo_url = EXCLUDED.logo_url,
                business_name = EXCLUDED.business_name,
                address = EXCLUDED.address,
                gstin = EXCLUDED.gstin,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                bill_title = EXCLUDED.bill_title,
                show_hsn = EXCLUDED.show_hsn,
                show_gst_breakup = EXCLUDED.show_gst_breakup,
                show_barcode = EXCLUDED.show_barcode,
                show_branch_name = EXCLUDED.show_branch_name,
                footer_message = EXCLUDED.footer_message,
                paper_size = EXCLUDED.paper_size,
                updated_at = NOW()
            RETURNING *;
        `;
        const updated = await db.pgGet(sql, [
            companyId, logo_url, business_name, address, gstin, phone, email,
            bill_title, show_hsn, show_gst_breakup, show_barcode, 
            show_branch_name, footer_message, paper_size
        ]);
        res.json(updated);
    } catch (err) {
        console.error("Save bill format error:", err);
        res.status(500).json({ error: "Failed to save settings" });
    }
});

export default router;
