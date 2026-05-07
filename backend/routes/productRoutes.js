// backend/routes/productRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as pgModule from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "./uploads/products";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `prod_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

const router = express.Router();

router.post("/", upload.single("image"), authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    const branchId = req.user?.branch_id;
    const userId = req.user?.id;

    const {
        name, selling_price, sku, brand, description, hsn_code, unit,
        cost_price, opening_stock, barcode, min_stock, max_stock_level,
        gst_percent, supplier_name, category, location
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Product Name is required" });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;
    const finalSku = sku || `PROD-${Date.now().toString().slice(-6)}`;

    let client;
    try {
        client = await pgModule.getClient();
        await client.query("BEGIN");

        // 1. Save all form fields to products table
        const productSql = `
            INSERT INTO products (
                company_id, branch_id, name, selling_price, sku, brand, description, hsn_code, unit,
                cost_price, opening_stock, current_stock, barcode, min_stock, max_stock_level,
                gst_percent, supplier_name, category, location, image_url, is_active, is_deleted
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, 1, false)
            RETURNING *;
        `;
        const product = (await client.query(productSql, [
            companyId, branchId, name, selling_price || 0, finalSku, brand || null, description || null,
            hsn_code || null, unit || "pcs", cost_price || 0,
            opening_stock || 0, opening_stock || 0, barcode || null,
            min_stock || 0, max_stock_level || 0, gst_percent || 0, supplier_name || null,
            category || "Other", location || null, imageUrl
        ])).rows[0];

        // 2. Inventory Table (auto-created simultaneously)
        const inventorySql = `
            INSERT INTO inventory (
                company_id, branch_id, product_id, product_name, sku, unit,
                current_stock, min_stock_level, max_stock_level, cost_price, selling_price,
                hsn_code, gst_percent, category, location
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING *;
        `;
        await client.query(inventorySql, [
            companyId, branchId, product.id, name, finalSku, unit || "pcs",
            opening_stock || 0, min_stock || 0, max_stock_level || 0, cost_price || 0, selling_price || 0,
            hsn_code || null, gst_percent || 0, category || "Other", location || null
        ]);

        // 3. Inventory Movement Log (opening stock entry)
        if (parseFloat(opening_stock || 0) > 0) {
            await client.query(`
                INSERT INTO inventory_movements (
                    company_id, branch_id, product_id, type, qty_in, reference_type, reference_id, note
                )
                VALUES ($1,$2,$3,'Opening Stock',$4,'product_creation',$5,'Opening stock entered at product creation')
            `, [companyId, branchId, product.id, opening_stock, product.id]);

            // 4. Ledger Entry (if Opening Stock > 0)
            const inventoryAccount = await client.query(`SELECT id FROM chart_of_accounts WHERE (company_id = $1 OR company_id IS NULL) AND account_code = '1400' LIMIT 1`, [companyId]);
            const openingStockAdjAccount = await client.query(`SELECT id FROM chart_of_accounts WHERE (company_id = $1 OR company_id IS NULL) AND account_code = '3000' LIMIT 1`, [companyId]);

            if (inventoryAccount.rows[0] && openingStockAdjAccount.rows[0]) {
                const stockValue = parseFloat(cost_price || 0) * parseFloat(opening_stock);
                
                // Transaction Header
                const txRes = await client.query(`
                    INSERT INTO transactions (company_id, branch_id, transaction_date, reference_type, reference_id, description, created_by)
                    VALUES ($1, $2, NOW(), 'OPENING_STOCK', $3, $4, $5)
                    RETURNING id
                `, [companyId, branchId, product.id, `Opening stock for ${name}`, userId]);
                const txId = txRes.rows[0].id;

                // Debit Inventory Account
                await client.query(`
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                    VALUES ($1, $2, $3, 0, 'Opening stock debit')
                `, [txId, inventoryAccount.rows[0].id, stockValue]);

                // Credit Opening Stock Adjustment Account
                await client.query(`
                    INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                    VALUES ($1, $2, 0, $3, 'Opening stock adjustment credit')
                `, [txId, openingStockAdjAccount.rows[0].id, stockValue]);
            }
        }

        await client.query("COMMIT");
        return res.status(201).json({ message: "Product created and synced with inventory", product });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Create Product Error:", err);
        return res.status(500).json({ error: "Failed to create product: " + err.message });
    } finally {
        if (client) client.release();
    }
});

router.get("/breakdown", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    try {
        const sql = `
            SELECT 
                p.id as product_id, 
                p.name, 
                p.sku, 
                p.unit,
                p.current_stock as main_stock,
                p.min_stock as main_min_stock,
                COALESCE(SUM(bi.current_stock), 0) as branches_total_stock,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'branch_id', b.id,
                        'branch_name', b.name,
                        'stock', bi.current_stock
                    )
                ) FILTER (WHERE b.id IS NOT NULL) as branch_details
            FROM products p
            LEFT JOIN branch_inventory bi ON p.id = bi.product_id
            LEFT JOIN branches b ON bi.branch_id = b.id
            WHERE p.company_id = $1 AND p.is_deleted = false
            GROUP BY p.id, p.name, p.sku, p.unit, p.current_stock, p.min_stock
            ORDER BY p.name ASC
        `;
        const breakdown = await pgModule.pgAll(sql, [companyId]);
        return res.json(breakdown);
    } catch (err) {
        console.error("Inventory breakdown error:", err);
        return res.status(500).json({ error: "Failed to fetch inventory breakdown" });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    try {
        const sql = `SELECT * FROM products WHERE company_id = $1 AND is_deleted = false ORDER BY id DESC`;
        const list = await pgModule.pgAll(sql, [companyId]);
        return res.json(list || []);
    } catch (err) {
        console.error("List Products Error:", err);
        return res.status(500).json({ error: "Failed to fetch products: " + err.message });
    }
});

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const sql = `SELECT * FROM products WHERE id = $1 AND company_id = $2 AND is_deleted = false`;
        const product = await pgModule.pgGet(sql, [req.params.id, req.user.active_company_id]);
        if (!product) return res.status(404).json({ error: "Product not found" });
        return res.json(product);
    } catch (err) {
        console.error("Get Product Error:", err);
        return res.status(500).json({ error: "Failed to fetch product: " + err.message });
    }
});

router.put("/:id", upload.single("image"), authMiddleware, async (req, res) => {
    const body = req.body || {};
    const companyId = req.user.active_company_id;

    let updateFields = [];
    let values = [];
    let index = 1;

    for (const key in body) {
        if (key === 'id' || key === 'company_id') continue;
        updateFields.push(`${key} = $${index}`);
        values.push(body[key]);
        index++;
    }

    if (req.file) {
        updateFields.push(`image_url = $${index}`);
        values.push(`/uploads/products/${req.file.filename}`);
        index++;
    }

    values.push(req.params.id);
    values.push(companyId);

    const sql = `
        UPDATE products
        SET ${updateFields.join(", ")}, updated_at = NOW()
        WHERE id = $${index} AND company_id = $${index + 1} AND is_deleted = false
        RETURNING *;
    `;

    try {
        const updated = await pgModule.pgGet(sql, values);
        if (!updated) return res.status(404).json({ error: "Product not found" });
        return res.json({ message: "Updated", updated });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update product" });
    }
});

/**
 * RULE 1 — NO DELETION EVER
 * Using PATCH for Archiving
 */
router.patch("/:id/archive", authMiddleware, async (req, res) => {
    try {
        const sql = `
            UPDATE products
            SET is_deleted = true, deleted_at = NOW()
            WHERE id = $1 AND company_id = $2
            RETURNING id
        `;
        const deleted = await pgModule.pgGet(sql, [req.params.id, req.user.active_company_id]);
        if (!deleted) return res.status(404).json({ error: "Product not found" });
        return res.json({ message: "Product archived successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to archive product" });
    }
});

export default router;
