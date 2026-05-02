
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Get Bill Format Settings (Main Branch)
 */
router.get("/format", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const settings = await db.pgGet(
            `SELECT * FROM bill_format_settings WHERE company_id = $1`,
            [companyId]
        );
        res.json(settings || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Update Bill Format Settings
 */
router.post("/format", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { 
            logo_url, business_name, address, gstin, phone, email, 
            bill_title, show_hsn, show_gst_breakup, show_barcode, 
            show_branch_name, footer_message, paper_size 
        } = req.body;

        const resSet = await db.pgRun(
            `INSERT INTO bill_format_settings 
            (company_id, logo_url, business_name, address, gstin, phone, email, 
             bill_title, show_hsn, show_gst_breakup, show_barcode, 
             show_branch_name, footer_message, paper_size, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
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
            RETURNING *`,
            [
                companyId, logo_url, business_name, address, gstin, phone, email,
                bill_title, show_hsn, show_gst_breakup, show_barcode,
                show_branch_name, footer_message, paper_size
            ]
        );
        res.json(resSet.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
