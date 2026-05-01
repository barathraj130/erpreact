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
    const {
        name, selling_price, sku, brand, description, hsn_code, unit,
        cost_price, opening_stock, current_stock, barcode, min_stock,
        gst_percent, supplier_name
    } = req.body;

    if (!name || !selling_price) {
        return res.status(400).json({ error: "Name & Selling Price are required" });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    const sql = `
        INSERT INTO products (
            company_id, name, selling_price, sku, brand, description, hsn_code, unit,
            cost_price, opening_stock, current_stock, barcode, min_stock,
            gst_percent, supplier_name, image_url, is_deleted
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, false)
        RETURNING *;
    `;

    const params = [
        companyId, name, selling_price, sku || null, brand || null, description || null,
        hsn_code || null, unit || null, cost_price || null,
        opening_stock || 0, current_stock || 0, barcode || null,
        min_stock || null, gst_percent || null, supplier_name || null, imageUrl
    ];

    try {
        const product = await pgModule.pgGet(sql, params);
        return res.json({ message: "Product created", product });
    } catch (err) {
        console.error("❌ Create Product Error:", err);
        return res.status(500).json({ error: "Failed to create product" });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    try {
        const sql = `SELECT * FROM products WHERE company_id = $1 AND is_deleted = false ORDER BY id DESC`;
        const list = await pgModule.pgAll(sql, [companyId]);
        return res.json(list || []);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch products" });
    }
});

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const sql = `SELECT * FROM products WHERE id = $1 AND company_id = $2 AND is_deleted = false`;
        const product = await pgModule.pgGet(sql, [req.params.id, req.user.active_company_id]);
        if (!product) return res.status(404).json({ error: "Product not found" });
        return res.json(product);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch product" });
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
