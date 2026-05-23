
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Get Bill Format Settings — merges bill_format_settings with companies table
 */
router.get("/format", authMiddleware, async (req, res) => {
    try {
        const companyId = parseInt(req.user.active_company_id);
        // Get bill format settings
        const settings = await db.pgGet(
            `SELECT * FROM bill_format_settings WHERE company_id = $1`,
            [companyId]
        );
        // Also get company profile as fallback
        const company = await db.pgGet(
            `SELECT company_name, address_line1, address_line2, city_pincode, state, state_code,
                    gstin, phone, email, bank_name, bank_account_no, bank_ifsc_code
             FROM companies WHERE id = $1`,
            [companyId]
        );
        // Merge: bill_format_settings takes priority, fall back to companies
        const merged = {
            business_name: settings?.business_name || company?.company_name || "",
            address: settings?.address || [company?.address_line1, company?.city_pincode].filter(Boolean).join(', ') || "",
            gstin: settings?.gstin || company?.gstin || "",
            phone: settings?.phone || company?.phone || "",
            email: settings?.email || company?.email || "",
            state: settings?.state || company?.state || "",
            state_code: settings?.state_code || company?.state_code || "",
            bank_name: settings?.bank_name || company?.bank_name || "",
            bank_account_no: settings?.bank_account_no || company?.bank_account_no || "",
            bank_ifsc_code: settings?.bank_ifsc_code || company?.bank_ifsc_code || "",
            bill_title: settings?.bill_title || "INVOICE",
            bill_type: settings?.bill_type || "INVOICE",
            show_hsn: settings?.show_hsn !== false,
            show_gst_breakup: settings?.show_gst_breakup !== false,
            show_barcode: settings?.show_barcode !== false,
            show_branch_name: settings?.show_branch_name !== false,
            footer_message: settings?.footer_message || "Thank you for your business!",
            paper_size: settings?.paper_size || "A4",
        };
        res.json(merged);
    } catch (err) {
        // bill_format_settings table may not exist yet — return empty defaults
        console.log('[billing-config] GET error (safe):', err.message);
        res.json({
            business_name: '', address: '', gstin: '', phone: '', email: '',
            state: '', state_code: '', bank_name: '', bank_account_no: '', bank_ifsc_code: '',
            bill_title: 'INVOICE', bill_type: 'INVOICE',
            show_hsn: true, show_gst_breakup: true, show_barcode: true, show_branch_name: true,
            footer_message: 'Thank you for your business!', paper_size: 'A4'
        });
    }
});

/**
 * Save Bill Format Settings — saves to bill_format_settings AND syncs company name to companies table
 */
router.post("/format", authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        const companyId = parseInt(req.user.active_company_id);
        const {
            logo_url, business_name, address, gstin, phone, email,
            state, state_code, bank_name, bank_account_no, bank_ifsc_code,
            bill_title, bill_type, show_hsn, show_gst_breakup, show_barcode,
            show_branch_name, footer_message, paper_size
        } = req.body;

        await client.query('BEGIN');

        // 1. Upsert bill_format_settings
        await client.query(
            `INSERT INTO bill_format_settings
            (company_id, logo_url, business_name, address, gstin, phone, email,
             state, state_code, bank_name, bank_account_no, bank_ifsc_code,
             bill_title, show_hsn, show_gst_breakup, show_barcode,
             show_branch_name, footer_message, paper_size, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
            ON CONFLICT (company_id) DO UPDATE SET
                logo_url          = EXCLUDED.logo_url,
                business_name     = EXCLUDED.business_name,
                address           = EXCLUDED.address,
                gstin             = EXCLUDED.gstin,
                phone             = EXCLUDED.phone,
                email             = EXCLUDED.email,
                state             = EXCLUDED.state,
                state_code        = EXCLUDED.state_code,
                bank_name         = EXCLUDED.bank_name,
                bank_account_no   = EXCLUDED.bank_account_no,
                bank_ifsc_code    = EXCLUDED.bank_ifsc_code,
                bill_title        = EXCLUDED.bill_title,
                show_hsn          = EXCLUDED.show_hsn,
                show_gst_breakup  = EXCLUDED.show_gst_breakup,
                show_barcode      = EXCLUDED.show_barcode,
                show_branch_name  = EXCLUDED.show_branch_name,
                footer_message    = EXCLUDED.footer_message,
                paper_size        = EXCLUDED.paper_size,
                updated_at        = NOW()`,
            [
                companyId, logo_url || null, business_name, address, gstin, phone, email,
                state || null, state_code || null, bank_name || null, bank_account_no || null, bank_ifsc_code || null,
                bill_title || 'INVOICE', show_hsn !== false, show_gst_breakup !== false, show_barcode !== false,
                show_branch_name !== false, footer_message || '', paper_size || 'A4'
            ]
        );

        // 2. Sync company name + details to companies table so it shows everywhere
        if (business_name) {
            await client.query(
                `UPDATE companies SET
                    company_name   = $1,
                    gstin          = COALESCE($2, gstin),
                    phone          = COALESCE($3, phone),
                    email          = COALESCE($4, email),
                    state          = COALESCE($5, state),
                    state_code     = COALESCE($6, state_code),
                    bank_name      = COALESCE($7, bank_name),
                    bank_account_no = COALESCE($8, bank_account_no),
                    bank_ifsc_code = COALESCE($9, bank_ifsc_code)
                 WHERE id = $10`,
                [business_name, gstin || null, phone || null, email || null,
                 state || null, state_code || null, bank_name || null,
                 bank_account_no || null, bank_ifsc_code || null, companyId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Settings saved and company profile updated." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("billingConfig save error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

export default router;
