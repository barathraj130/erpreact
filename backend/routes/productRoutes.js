console.log("--> Loading productRoutes.js");
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

/* ======================================================
   AUTO CREATE PRODUCTS TABLE IF NOT EXISTS  
====================================================== */
async function ensureProductsTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sku TEXT,
            brand TEXT,
            description TEXT,
            hsn_code TEXT,
            unit TEXT,
            cost_price NUMERIC(12,2),
            selling_price NUMERIC(12,2) NOT NULL,
            opening_stock NUMERIC(12,2) DEFAULT 0,
            current_stock NUMERIC(12,2) DEFAULT 0,
            barcode TEXT,
            min_stock NUMERIC(12,2),
            gst_percent NUMERIC(5,2),
            supplier_name TEXT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    await pgModule.pgRun(sql);
    
    // Add columns if missing (for existing tables)
    const columnsToAdd = [
        "description TEXT",
        "supplier_name TEXT",
        "gst_percent NUMERIC(5,2)",
        "image_url TEXT"
    ];
    for (const col of columnsToAdd) {
        try {
            await pgModule.pgRun(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col};`);
        } catch (e) {}
    }

    console.log("✅ Products table ensured (dynamic)");
}

ensureProductsTable().catch((err) => {
    console.error("❌ Product table sync failed:", err);
});

/* ======================================================
   CREATE PRODUCT (Only name + price required)
====================================================== */
router.post("/", upload.single("image"), authMiddleware, async (req, res) => {
    const body = req.body || {};
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized" });

    const {
        name,
        selling_price,
        sku,
        brand,
        description,
        hsn_code,
        unit,
        cost_price,
        opening_stock,
        current_stock,
        barcode,
        min_stock,
        gst_percent,
        supplier_name
    } = req.body;

    if (!name || !selling_price) {
        return res.status(400).json({ error: "Name & Selling Price are required" });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    const sql = `
        INSERT INTO products (
            company_id, name, selling_price, sku, brand, description, hsn_code, unit,
            cost_price, opening_stock, current_stock, barcode, min_stock,
            gst_percent, supplier_name, image_url
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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

/* ======================================================
   GET ALL PRODUCTS OF COMPANY
====================================================== */
router.get("/", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;

    try {
        const sql = `
            SELECT * FROM products 
            WHERE company_id = $1
            ORDER BY id DESC
        `;
        const list = await pgModule.pgAll(sql, [companyId]);
        return res.json(list || []);
    } catch (err) {
        console.error("❌ Fetch Products Error:", err);
        return res.status(500).json({ error: "Failed to fetch products" });
    }
});

/* ======================================================
   GET SINGLE PRODUCT
====================================================== */
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const sql = `
            SELECT * FROM products 
            WHERE id = $1 AND company_id = $2
        `;
        const product = await pgModule.pgGet(sql, [req.params.id, req.user.active_company_id]);

        if (!product) return res.status(404).json({ error: "Product not found" });

        return res.json(product);
    } catch (err) {
        console.error("❌ Fetch Product Error:", err);
        return res.status(500).json({ error: "Failed to fetch product" });
    }
});

/* ======================================================
   UPDATE PRODUCT (Any field optional)
====================================================== */
router.put("/:id", upload.single("image"), authMiddleware, async (req, res) => {
    const body = req.body || {};
    const companyId = req.user.active_company_id;

    let updateFields = [];
    let values = [];
    let index = 1;

    for (const key in body) {
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
        WHERE id = $${index} AND company_id = $${index + 1}
        RETURNING *;
    `;

    try {
        const updated = await pgModule.pgGet(sql, values);
        if (!updated) return res.status(404).json({ error: "Product not found" });
        return res.json({ message: "Updated", updated });
    } catch (err) {
        console.error("❌ Update Product Error:", err);
        return res.status(500).json({ error: "Failed to update product" });
    }
});

/* ======================================================
   DELETE PRODUCT
====================================================== */
router.delete("/:id", authMiddleware, async (req, res) => {
    const sql = `
        DELETE FROM products
        WHERE id = $1 AND company_id = $2
        RETURNING id
    `;

    try {
        const deleted = await pgModule.pgGet(sql, [req.params.id, req.user.active_company_id]);
        if (!deleted) return res.status(404).json({ error: "Product not found" });

        return res.json({ message: "Product deleted" });
    } catch (err) {
        console.error("❌ Delete Product Error:", err);
        return res.status(500).json({ error: "Failed to delete product" });
    }
});

export default router;
