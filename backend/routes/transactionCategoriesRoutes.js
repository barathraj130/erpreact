import express from "express";
import * as pgModule from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// GET /api/transaction-categories?type=income|expense
router.get("/", authMiddleware, async (req, res) => {
    const companyId = parseInt(req.user?.active_company_id);
    const { type } = req.query;
    try {
        let sql = `
            SELECT id, company_id, name, type, usage_count, is_custom
            FROM transaction_categories
            WHERE (company_id = 0 OR company_id = $1)
        `;
        const params = [companyId];
        if (type) {
            sql += ` AND (type = $2 OR type = 'both')`;
            params.push(type);
        }
        sql += ` ORDER BY is_custom ASC, usage_count DESC, name ASC`;
        const rows = await pgModule.pgAll(sql, params);
        return res.json(rows || []);
    } catch (err) {
        console.error("Fetch transaction categories error:", err);
        return res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// POST /api/transaction-categories — upsert and increment usage_count
router.post("/", authMiddleware, async (req, res) => {
    const companyId = parseInt(req.user?.active_company_id);
    const { name, type = "both" } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Category name required" });

    try {
        const existing = await pgModule.pgGet(
            `SELECT id FROM transaction_categories
             WHERE LOWER(name) = LOWER($1) AND (company_id = 0 OR company_id = $2)
             LIMIT 1`,
            [name.trim(), companyId]
        );
        if (existing) {
            await pgModule.pgGet(
                `UPDATE transaction_categories SET usage_count = usage_count + 1 WHERE id = $1 RETURNING id`,
                [existing.id]
            );
            return res.json({ success: true, created: false });
        }
        const cat = await pgModule.pgGet(
            `INSERT INTO transaction_categories (company_id, name, type, usage_count, is_custom)
             VALUES ($1, $2, $3, 1, true) RETURNING *`,
            [companyId, name.trim(), type]
        );
        return res.status(201).json({ success: true, created: true, category: cat });
    } catch (err) {
        console.error("Upsert transaction category error:", err);
        return res.status(500).json({ error: "Failed to save category" });
    }
});

export default router;
