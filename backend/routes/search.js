// backend/routes/search.js
// Global search (Ctrl+K) — searches across invoices, customers, products,
// suppliers, employees, purchase bills, expenses, and production lots.
// New, additive route file — does not modify any existing route or table.
import express from "express";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import * as db from "../database/pg.js";

const router = express.Router();

const TYPE_ICONS = {
    invoice: "🧾",
    customer: "👥",
    product: "📦",
    supplier: "🏭",
    employee: "👤",
    purchase_bill: "📄",
    expense: "💸",
    production_lot: "🏗️",
};

const TYPE_LABELS = {
    invoice: "Invoice",
    customer: "Customer",
    product: "Product",
    supplier: "Supplier",
    employee: "Employee",
    purchase_bill: "Purchase Bill",
    expense: "Expense",
    production_lot: "Production Lot",
};

router.get("/global", authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) return res.json({ results: [] });

        const query = `%${q.trim()}%`;
        const companyId = req.user?.active_company_id;
        if (!companyId) return res.json({ results: [] });

        const empty = { rows: [] };

        const [invoices, customers, products, suppliers, employees, purchaseBills, expenses, productionLots] = await Promise.all([
            db.pgAll(`
                SELECT 'invoice' AS type, i.id, i.invoice_number AS title,
                    COALESCE(u.nickname, u.username, i.walk_in_name, 'Walk-in') AS subtitle,
                    i.invoice_date::text AS meta, ('/invoices/' || i.id) AS url
                FROM invoices i
                LEFT JOIN users u ON i.customer_id = u.id
                WHERE i.company_id = $1 AND COALESCE(i.is_deleted, false) = false
                    AND (i.invoice_number ILIKE $2 OR u.nickname ILIKE $2 OR u.username ILIKE $2 OR i.walk_in_name ILIKE $2)
                ORDER BY i.created_at DESC LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'customer' AS type, id, COALESCE(nickname, username) AS title,
                    COALESCE(phone, '') AS subtitle, '' AS meta, '/customers' AS url
                FROM users
                WHERE company_id = $1 AND role IN ('user', 'customer')
                    AND (nickname ILIKE $2 OR username ILIKE $2 OR phone ILIKE $2)
                ORDER BY COALESCE(nickname, username) LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'product' AS type, id, COALESCE(NULLIF(name, ''), product_name) AS title,
                    COALESCE(hsn_code, '') AS subtitle, '' AS meta, '/products' AS url
                FROM products
                WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
                    AND (name ILIKE $2 OR product_name ILIKE $2 OR description ILIKE $2)
                ORDER BY COALESCE(NULLIF(name, ''), product_name) LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'supplier' AS type, id, name AS title,
                    COALESCE(phone, '') AS subtitle, '' AS meta, '/suppliers' AS url
                FROM suppliers
                WHERE company_id = $1 AND (name ILIKE $2 OR phone ILIKE $2)
                ORDER BY name LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'employee' AS type, id, name AS title,
                    COALESCE(designation, '') AS subtitle, '' AS meta, '/employees' AS url
                FROM employees
                WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
                    AND (name ILIKE $2 OR phone ILIKE $2 OR designation ILIKE $2)
                ORDER BY name LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'purchase_bill' AS type, id, bill_number AS title,
                    COALESCE(supplier_name, '') AS subtitle, bill_date::text AS meta, '/purchase-bills' AS url
                FROM purchase_bills
                WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
                    AND (bill_number ILIKE $2 OR supplier_name ILIKE $2)
                ORDER BY created_at DESC LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'expense' AS type, id, COALESCE(NULLIF(reference_number, ''), 'Expense #' || id) AS title,
                    paid_to AS subtitle, expense_date::text AS meta, '/expenses' AS url
                FROM expense_entries
                WHERE company_id = $1
                    AND (reference_number ILIKE $2 OR paid_to ILIKE $2 OR description ILIKE $2)
                ORDER BY created_at DESC LIMIT 5
            `, [companyId, query]).catch(() => empty),

            db.pgAll(`
                SELECT 'production_lot' AS type, pl.id, pl.lot_number AS title,
                    COALESCE(NULLIF(p.name, ''), p.product_name, '') AS subtitle,
                    pl.purchase_date::text AS meta, ('/production/lots/' || pl.id) AS url
                FROM production_lots pl
                LEFT JOIN products p ON pl.product_id = p.id
                WHERE pl.company_id = $1 AND COALESCE(pl.is_deleted, false) = false
                    AND (pl.lot_number ILIKE $2 OR p.name ILIKE $2 OR p.product_name ILIKE $2)
                ORDER BY pl.created_at DESC LIMIT 5
            `, [companyId, query]).catch(() => empty),
        ]);

        const all = [
            ...invoices, ...customers, ...products,
            ...suppliers, ...employees, ...purchaseBills, ...expenses, ...productionLots,
        ].map((r) => ({
            ...r,
            icon: TYPE_ICONS[r.type] || "📄",
            type_label: TYPE_LABELS[r.type] || r.type,
        }));

        res.json({ results: all, query: q.trim() });
    } catch (e) {
        console.error("Global search error:", e.message);
        res.json({ results: [] });
    }
});

export default router;
