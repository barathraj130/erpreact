// backend/routes/debugRoutes.js
// READ-ONLY diagnostic endpoint — shows ERP data state for the current company.
// Returns table row counts and recent records so you can verify DB contents.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// GET /api/debug/state
// Returns row counts and samples from all key inventory tables.
router.get("/state", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(400).json({ error: "No active_company_id on JWT" });

    const safe = async (label, fn) => {
        try { return { ok: true, data: await fn() }; }
        catch (e) { return { ok: false, error: e.message }; }
    };

    const [
        productsCount,
        productsSample,
        inventoryCount,
        inventorySample,
        billsCount,
        billItemsCount,
        billItemsSample,
    ] = await Promise.all([
        safe("products_count",     () => db.pgGet(`SELECT COUNT(*) as n FROM products WHERE company_id=$1`, [companyId])),
        safe("products_sample",    () => db.pgAll(`SELECT id, name, current_stock, is_active, is_deleted FROM products WHERE company_id=$1 ORDER BY id DESC LIMIT 5`, [companyId])),
        safe("inventory_count",    () => db.pgGet(`SELECT COUNT(*) as n FROM inventory WHERE company_id=$1`, [companyId])),
        safe("inventory_sample",   () => db.pgAll(`SELECT id, product_id, current_stock FROM inventory WHERE company_id=$1 ORDER BY id DESC LIMIT 5`, [companyId])),
        safe("bills_count",        () => db.pgGet(`SELECT COUNT(*) as n FROM purchase_bills WHERE company_id=$1 AND is_deleted=false`, [companyId])),
        safe("bill_items_count",   () => db.pgGet(`SELECT COUNT(*) as n FROM purchase_bill_items pbi JOIN purchase_bills pb ON pb.id=pbi.bill_id WHERE pb.company_id=$1`, [companyId])),
        safe("bill_items_sample",  () => db.pgAll(`SELECT pbi.id, pbi.bill_id, pbi.product_id, pbi.description, pbi.quantity, pbi.unit_price FROM purchase_bill_items pbi JOIN purchase_bills pb ON pb.id=pbi.bill_id WHERE pb.company_id=$1 ORDER BY pbi.id DESC LIMIT 5`, [companyId])),
    ]);

    res.json({
        company_id: companyId,
        products: {
            count: productsCount.ok ? Number(productsCount.data?.n) : productsCount.error,
            sample: productsSample.ok ? productsSample.data : productsSample.error,
        },
        inventory: {
            count: inventoryCount.ok ? Number(inventoryCount.data?.n) : inventoryCount.error,
            sample: inventorySample.ok ? inventorySample.data : inventorySample.error,
        },
        purchase_bills: {
            count: billsCount.ok ? Number(billsCount.data?.n) : billsCount.error,
        },
        purchase_bill_items: {
            count: billItemsCount.ok ? Number(billItemsCount.data?.n) : billItemsCount.error,
            sample: billItemsSample.ok ? billItemsSample.data : billItemsSample.error,
        },
        schema_check: await (async () => {
            const checks = {};
            for (const [tbl, col] of [
                ['products', 'is_deleted'],
                ['products', 'is_active'],
                ['purchase_bill_items', 'cgst_rate'],
                ['purchase_bill_items', 'line_total'],
                ['purchase_bill_items', 'unit'],
                ['inventory', 'last_updated'],
            ]) {
                try {
                    const r = await db.pgGet(
                        `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2) AS exists`,
                        [tbl, col]
                    );
                    checks[`${tbl}.${col}`] = r?.exists ? '✓ exists' : '✗ MISSING';
                } catch (e) {
                    checks[`${tbl}.${col}`] = `error: ${e.message}`;
                }
            }
            return checks;
        })(),
    });
});

export default router;
