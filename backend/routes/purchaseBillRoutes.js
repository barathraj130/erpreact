import express from "express";
import * as db from "../database/pg.js";
import checkPermission from "../middlewares/checkPermission.js"; // ✅ Permission Check
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// GET ALL BILLS
router.get("/", authMiddleware, checkPermission("Purchases", "view_bills"), async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT 
                pb.id, 
                pb.bill_number, 
                pb.bill_date, 
                pb.due_date, 
                pb.total_amount, 
                pb.status,
                pb.file_url,
                l.lender_name as supplier_name
            FROM purchase_bills pb
            LEFT JOIN lenders l ON pb.supplier_id = l.id
            WHERE pb.company_id = $1
            ORDER BY pb.bill_date DESC
        `;
        const result = await db.pgAll(sql, [companyId]);
        res.json(result);
    } catch (err) {
        console.error("Fetch Bills Error:", err);
        res.status(500).json({ error: "Failed to fetch purchase bills" });
    }
});

// CREATE NEW BILL
router.post("/", authMiddleware, checkPermission("Purchases", "create_bills"), async (req, res) => {
    const companyId = req.user.active_company_id;
    const { supplier_id, bill_number, bill_date, due_date, total_amount, status, file_url } = req.body;

    try {
        const sql = `
            INSERT INTO purchase_bills 
            (company_id, supplier_id, bill_number, bill_date, due_date, total_amount, status, file_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `;
        const result = await db.pgRun(sql, [
            companyId, 
            supplier_id, 
            bill_number, 
            bill_date, 
            due_date, 
            total_amount, 
            status || 'PENDING',
            file_url || null // ✅ Added File URL support
        ]);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("Create Bill Error:", err);
        res.status(500).json({ error: "Failed to create purchase bill" });
    }
});

// DELETE BILL
router.delete("/:id", authMiddleware, checkPermission("Purchases", "delete_bills"), async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    try {
        const result = await db.pgRun(
            `DELETE FROM purchase_bills WHERE id=$1 AND company_id=$2 RETURNING id`, 
            [id, companyId]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: "Bill not found" });

        res.json({ success: true, message: "Bill deleted" });
    } catch (err) {
        console.error("Delete Bill Error:", err);
        res.status(500).json({ error: "Failed to delete bill" });
    }
});

export default router;