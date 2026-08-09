// backend/routes/storefrontManage.js
// Authenticated storefront management API — lets a company's own admin manage
// their public /store/:slug catalog. Schema/column setup lives in storefront.js;
// this file assumes ensureStorefrontSchema() has already run via the public routes,
// but calls it defensively too since either could be hit first.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

let schemaEnsured = false;
async function ensureStorefrontSchema() {
    if (schemaEnsured) return;
    const alters = [
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_enabled BOOLEAN DEFAULT false`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_tagline VARCHAR(300)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_description TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_logo_url TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_banner_url TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_primary_color VARCHAR(20) DEFAULT '#4f46e5'`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_whatsapp VARCHAR(20)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_phone VARCHAR(20)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_email VARCHAR(200)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_address TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_city VARCHAR(100)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_state VARCHAR(50)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_pincode VARCHAR(10)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_gstin VARCHAR(20)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_instagram VARCHAR(200)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_facebook VARCHAR(200)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_business_type VARCHAR(100)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_established_year INTEGER`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_min_order_qty INTEGER DEFAULT 1`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_delivery_info TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_return_policy TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_meta_title VARCHAR(200)`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS storefront_meta_description VARCHAR(500)`,
    ];
    for (const sql of alters) await db.pgRun(sql).catch(() => {});
    schemaEnsured = true;
}

const isAdmin = (req) => ["admin", "superadmin"].includes(String(req.user?.role || "").toLowerCase());

// GET /api/manage/storefront/settings
router.get("/settings", authMiddleware, async (req, res) => {
    try {
        await ensureStorefrontSchema();
        const companyId = req.user.active_company_id;
        const company = await db.pgGet(`SELECT * FROM companies WHERE id = $1`, [companyId]);
        res.json(company || {});
    } catch (e) {
        console.error("Storefront settings fetch error:", e.message);
        res.json({});
    }
});

// PUT /api/manage/storefront/settings
router.put("/settings", authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        await ensureStorefrontSchema();
        const companyId = req.user.active_company_id;
        const {
            storefront_enabled, storefront_tagline, storefront_description,
            storefront_primary_color, storefront_whatsapp, storefront_phone, storefront_email,
            storefront_address, storefront_city, storefront_state, storefront_pincode,
            storefront_gstin, storefront_instagram, storefront_facebook,
            storefront_business_type, storefront_established_year,
            storefront_delivery_info, storefront_return_policy, storefront_min_order_qty,
        } = req.body;

        await db.pgRun(
            `UPDATE companies SET
                storefront_enabled = $1, storefront_tagline = $2, storefront_description = $3,
                storefront_primary_color = $4, storefront_whatsapp = $5, storefront_phone = $6, storefront_email = $7,
                storefront_address = $8, storefront_city = $9, storefront_state = $10, storefront_pincode = $11,
                storefront_gstin = $12, storefront_instagram = $13, storefront_facebook = $14,
                storefront_business_type = $15, storefront_established_year = $16,
                storefront_delivery_info = $17, storefront_return_policy = $18, storefront_min_order_qty = $19
             WHERE id = $20`,
            [
                !!storefront_enabled, storefront_tagline || null, storefront_description || null,
                storefront_primary_color || "#4f46e5", storefront_whatsapp || null, storefront_phone || null, storefront_email || null,
                storefront_address || null, storefront_city || null, storefront_state || null, storefront_pincode || null,
                storefront_gstin || null, storefront_instagram || null, storefront_facebook || null,
                storefront_business_type || null, storefront_established_year || null,
                storefront_delivery_info || null, storefront_return_policy || null, storefront_min_order_qty || 1,
                companyId,
            ]
        );

        res.json({ success: true });
    } catch (e) {
        console.error("Storefront settings update error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// GET /api/manage/storefront/products
router.get("/products", authMiddleware, async (req, res) => {
    try {
        await ensureStorefrontSchema();
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(
            `SELECT sp.*, p.product_name AS erp_product_name, COALESCE(inv.total_stock, 0) AS live_stock
             FROM storefront_products sp
             LEFT JOIN products p ON p.id = sp.product_id
             LEFT JOIN (
                 SELECT product_id, SUM(current_stock) AS total_stock
                 FROM inventory
                 WHERE stock_type = 'fresh'
                 GROUP BY product_id
             ) inv ON inv.product_id = sp.product_id
             WHERE sp.company_id = $1
             ORDER BY sp.is_featured DESC, sp.sort_order ASC, sp.created_at DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (e) {
        console.error("Storefront products fetch error:", e.message);
        res.json([]);
    }
});

// POST /api/manage/storefront/products
router.post("/products", authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const companyId = req.user.active_company_id;
        const {
            product_id, product_name, description, category,
            min_price, max_price, is_price_visible,
            is_featured, tags, sizes, colors, materials, moq,
        } = req.body;

        if (!product_name) return res.json({ success: false, error: "Product name required" });

        const result = await db.pgGet(
            `INSERT INTO storefront_products (
                company_id, product_id, product_name, description, category,
                min_price, max_price, is_price_visible, is_featured,
                tags, sizes, colors, materials, moq, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
            RETURNING *`,
            [
                companyId, product_id || null, product_name, description || null, category || null,
                min_price || null, max_price || null, is_price_visible !== false, is_featured || false,
                tags || null, sizes || null, colors || null, materials || null, moq || 1,
            ]
        );

        res.json({ success: true, product: result });
    } catch (e) {
        console.error("Storefront product create error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// PUT /api/manage/storefront/products/:id
router.put("/products/:id", authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const companyId = req.user.active_company_id;
        const {
            product_name, description, category, min_price, max_price,
            is_price_visible, is_featured, is_active, sizes, colors, moq, sort_order,
        } = req.body;

        await db.pgRun(
            `UPDATE storefront_products SET
                product_name = $1, description = $2, category = $3,
                min_price = $4, max_price = $5, is_price_visible = $6,
                is_featured = $7, is_active = $8, sizes = $9, colors = $10,
                moq = $11, sort_order = $12, updated_at = NOW()
             WHERE id = $13 AND company_id = $14`,
            [
                product_name, description || null, category || null, min_price || null, max_price || null,
                is_price_visible !== false, !!is_featured, is_active !== false, sizes || null, colors || null,
                moq || 1, sort_order || 0, req.params.id, companyId,
            ]
        );

        res.json({ success: true });
    } catch (e) {
        console.error("Storefront product update error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// DELETE /api/manage/storefront/products/:id — soft delete (deactivate)
router.delete("/products/:id", authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const companyId = req.user.active_company_id;
        await db.pgRun(
            `UPDATE storefront_products SET is_active = false WHERE id = $1 AND company_id = $2`,
            [req.params.id, companyId]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Storefront product delete error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// GET /api/manage/storefront/enquiries
router.get("/enquiries", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(
            `SELECT se.*, sp.product_name
             FROM storefront_enquiries se
             LEFT JOIN storefront_products sp ON sp.id = se.product_id
             WHERE se.company_id = $1
             ORDER BY se.created_at DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (e) {
        console.error("Storefront enquiries fetch error:", e.message);
        res.json([]);
    }
});

// PUT /api/manage/storefront/enquiries/:id/read — mark an enquiry as read
router.put("/enquiries/:id/read", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        await db.pgRun(
            `UPDATE storefront_enquiries SET is_read = true WHERE id = $1 AND company_id = $2`,
            [req.params.id, companyId]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

export default router;
