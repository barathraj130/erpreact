
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { transferStock, createStockRequest } from "../services/branchInventoryService.js";

const router = express.Router();

// --- Main Branch Only Routes ---

/**
 * Get all pending stock requests (Main Branch View)
 */
router.get("/requests/pending", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const requests = await db.pgAll(
            `SELECT sr.*, p.name as product_name, b.branch_name, 
                    inv.current_stock as main_stock
             FROM stock_requests sr
             JOIN products p ON sr.product_id = p.id
             JOIN branches b ON sr.from_branch_id = b.id
             LEFT JOIN inventory inv ON sr.product_id = inv.product_id
             WHERE sr.company_id = $1 AND sr.status = 'PENDING'
             ORDER BY sr.urgency DESC, sr.requested_at ASC`,
            [companyId]
        );
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Approve & Transfer Stock
 */
router.post("/requests/:id/approve", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { transfer_qty } = req.body;
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        
        const request = await client.query(`SELECT * FROM stock_requests WHERE id = $1 FOR UPDATE`, [id]);
        if (!request.rows[0]) throw new Error("Request not found");
        if (request.rows[0].status !== 'PENDING') throw new Error("Request already processed");

        const r = request.rows[0];
        const qty = parseFloat(transfer_qty || r.requested_qty);

        // 1. Perform Transfer
        await transferStock(client, {
            company_id: r.company_id,
            from_branch_id: null, // From Main
            to_branch_id: r.from_branch_id,
            product_id: r.product_id,
            qty: qty,
            userId: req.user.id,
            notes: r.note,
            reference_type: 'stock_request',
            reference_id: id
        });

        // 2. Update Request Status
        await client.query(
            `UPDATE stock_requests SET status = 'TRANSFERRED', transferred_qty = $1, responded_by = $2, responded_at = NOW() WHERE id = $3`,
            [qty, req.user.id, id]
        );

        await client.query("COMMIT");
        res.json({ success: true, message: "Stock transferred successfully" });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/**
 * Manual Stock Transfer (Main to Branch)
 */
router.post("/requests/manual-transfer", authMiddleware, async (req, res) => {
    const { product_id, to_branch_id, qty, notes } = req.body;
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        
        await transferStock(client, {
            company_id: req.user.active_company_id,
            from_branch_id: null,
            to_branch_id,
            product_id,
            qty,
            userId: req.user.id,
            notes,
            reference_type: 'manual_transfer'
        });

        await client.query("COMMIT");
        res.json({ success: true, message: "Manual transfer completed" });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/**
 * Decline Stock Request
 */
router.post("/requests/:id/decline", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        await db.pgRun(
            `UPDATE stock_requests SET status = 'DECLINED', decline_reason = $1, responded_by = $2, responded_at = NOW() WHERE id = $3`,
            [reason, req.user.id, id]
        );
        res.json({ success: true, message: "Request declined" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Branch Routes ---

/**
 * Create a stock request (Branch Side)
 */
router.post("/requests", authMiddleware, async (req, res) => {
    try {
        const { product_id, requested_qty, urgency, note } = req.body;
        const result = await createStockRequest({
            company_id: req.user.active_company_id,
            from_branch_id: req.user.branch_id,
            product_id,
            requested_qty,
            urgency,
            note,
            userId: req.user.id
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get My Branch Requests
 */
router.get("/my-requests", authMiddleware, async (req, res) => {
    try {
        const branchId = req.user.branch_id;
        const requests = await db.pgAll(
            `SELECT sr.*, p.name as product_name
             FROM stock_requests sr
             JOIN products p ON sr.product_id = p.id
             WHERE sr.from_branch_id = $1
             ORDER BY sr.requested_at DESC`,
            [branchId]
        );
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get Branch Inventory
 */
router.get("/inventory", authMiddleware, async (req, res) => {
    try {
        const branchId = req.user.branch_id || req.query.branch_id;
        const inventory = await db.pgAll(
            `SELECT bi.*, p.name, p.selling_price, p.unit, p.image_url, p.description
             FROM branch_inventory bi
             JOIN products p ON bi.product_id = p.id
             WHERE bi.branch_id = $1`,
            [branchId]
        );
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get Consolidated Inventory (Main Branch View)
 */
router.get("/consolidated", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const products = await db.pgAll(
            `SELECT p.id, p.name, p.sku, p.unit, p.selling_price, 
                    inv.current_stock as main_stock,
                    COALESCE(SUM(bi.current_stock), 0) as total_branch_stock,
                    (inv.current_stock + COALESCE(SUM(bi.current_stock), 0)) as total_stock
             FROM products p
             LEFT JOIN inventory inv ON p.id = inv.product_id
             LEFT JOIN branch_inventory bi ON p.id = bi.product_id
             WHERE p.company_id = $1 AND p.is_deleted = false
             GROUP BY p.id, inv.current_stock`,
            [companyId]
        );
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get Product Stock Breakdown
 */
router.get("/breakdown/:productId", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const branches = await db.pgAll(
            `SELECT b.name as branch_name, COALESCE(bi.current_stock, 0) as stock
             FROM branches b
             LEFT JOIN branch_inventory bi ON b.id = bi.branch_id AND bi.product_id = $1
             WHERE b.is_deleted = false`,
            [productId]
        );
        res.json(branches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
