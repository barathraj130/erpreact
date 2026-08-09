// backend/routes/storefront.js
// Public storefront API — no auth required. Each company can optionally expose a
// public product catalog at /store/:slug, keyed off companies.company_code (there
// is no separate "tenants" table in this schema; a company IS the tenant here).
import express from "express";
import * as db from "../database/pg.js";
import { sendWhatsApp } from "../utils/whatsapp.js";

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

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS storefront_products (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id),
            product_name VARCHAR(200) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            images TEXT[],
            min_price NUMERIC(10,2),
            max_price NUMERIC(10,2),
            is_price_visible BOOLEAN DEFAULT true,
            stock_label VARCHAR(50) DEFAULT 'In Stock',
            is_featured BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            sort_order INTEGER DEFAULT 0,
            tags TEXT[],
            sizes VARCHAR(200),
            colors VARCHAR(200),
            materials VARCHAR(200),
            moq INTEGER DEFAULT 1,
            enquiry_count INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS storefront_enquiries (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES storefront_products(id),
            enquirer_name VARCHAR(200) NOT NULL,
            enquirer_phone VARCHAR(20) NOT NULL,
            enquirer_email VARCHAR(200),
            enquirer_city VARCHAR(100),
            message TEXT,
            quantity_needed INTEGER,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS storefront_visits (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES storefront_products(id),
            visitor_ip VARCHAR(50),
            user_agent VARCHAR(500),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    schemaEnsured = true;
}

const TENANT_FIELDS = `
    id, company_name, company_code, phone, email,
    storefront_enabled, storefront_tagline, storefront_description,
    storefront_logo_url, storefront_banner_url, storefront_primary_color,
    storefront_whatsapp, storefront_phone, storefront_email,
    storefront_address, storefront_city, storefront_state, storefront_pincode,
    storefront_gstin, storefront_instagram, storefront_facebook,
    storefront_business_type, storefront_established_year, storefront_min_order_qty,
    storefront_delivery_info, storefront_return_policy,
    storefront_meta_title, storefront_meta_description
`;

// GET /api/storefront/:slug — public storefront info
router.get("/:slug", async (req, res) => {
    try {
        await ensureStorefrontSchema();
        const company = await db.pgGet(
            `SELECT ${TENANT_FIELDS} FROM companies WHERE LOWER(company_code) = LOWER($1) AND COALESCE(is_active, true) = true`,
            [req.params.slug]
        );
        if (!company) return res.status(404).json({ error: "Store not found" });
        if (!company.storefront_enabled) return res.status(404).json({ error: "Store not available" });

        db.pgRun(
            `INSERT INTO storefront_visits (company_id, visitor_ip, user_agent) VALUES ($1, $2, $3)`,
            [company.id, req.ip, req.headers["user-agent"] || null]
        ).catch(() => {});

        res.json(company);
    } catch (e) {
        console.error("Storefront info error:", e.message);
        res.status(500).json({ error: "Server error" });
    }
});

// GET /api/storefront/:slug/products
router.get("/:slug/products", async (req, res) => {
    try {
        await ensureStorefrontSchema();
        const { category, featured, search } = req.query;

        const company = await db.pgGet(
            `SELECT id FROM companies WHERE LOWER(company_code) = LOWER($1) AND COALESCE(is_active, true) = true AND storefront_enabled = true`,
            [req.params.slug]
        );
        if (!company) return res.json([]);

        const conditions = ["sp.company_id = $1", "sp.is_active = true"];
        const params = [company.id];

        if (category) { params.push(category); conditions.push(`sp.category = $${params.length}`); }
        if (featured === "true") conditions.push("sp.is_featured = true");
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(LOWER(sp.product_name) LIKE LOWER($${params.length}) OR LOWER(COALESCE(sp.description, '')) LIKE LOWER($${params.length}))`);
        }

        const rows = await db.pgAll(
            `SELECT sp.*, COALESCE(inv.total_stock, 0) AS live_stock
             FROM storefront_products sp
             LEFT JOIN (
                 SELECT product_id, SUM(current_stock) AS total_stock
                 FROM inventory
                 WHERE stock_type = 'fresh'
                 GROUP BY product_id
             ) inv ON inv.product_id = sp.product_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY sp.is_featured DESC, sp.sort_order ASC, sp.created_at DESC`,
            params
        );

        res.json(rows);
    } catch (e) {
        console.error("Storefront products error:", e.message);
        res.json([]);
    }
});

// GET /api/storefront/:slug/categories
router.get("/:slug/categories", async (req, res) => {
    try {
        await ensureStorefrontSchema();
        const company = await db.pgGet(
            `SELECT id FROM companies WHERE LOWER(company_code) = LOWER($1) AND COALESCE(is_active, true) = true`,
            [req.params.slug]
        );
        if (!company) return res.json([]);

        const rows = await db.pgAll(
            `SELECT category, COUNT(*) AS product_count
             FROM storefront_products
             WHERE company_id = $1 AND is_active = true AND category IS NOT NULL
             GROUP BY category
             ORDER BY product_count DESC`,
            [company.id]
        );
        res.json(rows);
    } catch (e) {
        console.error("Storefront categories error:", e.message);
        res.json([]);
    }
});

// POST /api/storefront/:slug/enquiry
router.post("/:slug/enquiry", async (req, res) => {
    try {
        await ensureStorefrontSchema();
        const { product_id, name, phone, email, city, message, quantity_needed } = req.body;

        if (!name || !phone) return res.json({ success: false, error: "Name and phone required" });

        const company = await db.pgGet(
            `SELECT id, company_name, storefront_whatsapp FROM companies WHERE LOWER(company_code) = LOWER($1)`,
            [req.params.slug]
        );
        if (!company) return res.json({ success: false, error: "Store not found" });

        await db.pgRun(
            `INSERT INTO storefront_enquiries
                (company_id, product_id, enquirer_name, enquirer_phone, enquirer_email, enquirer_city, message, quantity_needed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [company.id, product_id || null, name, phone, email || null, city || null, message || null, quantity_needed || null]
        );

        if (product_id) {
            await db.pgRun(
                `UPDATE storefront_products SET enquiry_count = enquiry_count + 1 WHERE id = $1`,
                [product_id]
            ).catch(() => {});
        }

        if (company.storefront_whatsapp) {
            const product = product_id
                ? await db.pgGet(`SELECT product_name FROM storefront_products WHERE id = $1`, [product_id])
                : null;
            const productName = product?.product_name || "General enquiry";

            sendWhatsApp(
                company.storefront_whatsapp,
                `🛍️ New Storefront Enquiry!\n\nProduct: ${productName}\nName: ${name}\nPhone: ${phone}\n${city ? `City: ${city}\n` : ""}${quantity_needed ? `Qty needed: ${quantity_needed}\n` : ""}${message ? `Message: ${message}` : ""}\n\nReply to this customer on ${phone}`
            ).catch(() => {});
        }

        res.json({ success: true, message: "Enquiry sent successfully" });
    } catch (e) {
        console.error("Storefront enquiry error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

export default router;
