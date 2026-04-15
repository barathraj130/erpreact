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
                pb.paid_amount,
                pb.balance_amount,
                pb.status,
                pb.file_url,
                pb.supplier_id,
                pb.supplier_name,
                pb.bill_type,
                COALESCE(l.lender_name, pb.supplier_name) as supplier_name
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

// Configure Multer for File Uploads
import multer from 'multer';
import path from 'path';

const normalizeMoney = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveBillStatus = (paidAmount, totalAmount, explicitStatus) => {
    if (explicitStatus && explicitStatus !== "PENDING") return explicitStatus;
    if (paidAmount >= totalAmount && totalAmount > 0) return "PAID";
    if (paidAmount > 0 && paidAmount < totalAmount) return "PARTIAL";
    return "PENDING";
};

const findOrCreateSupplier = async (client, companyId, supplierId, supplierName) => {
    if (supplierId) {
        const byId = await client.query(
            `SELECT id, lender_name FROM lenders WHERE id = $1 AND company_id = $2 LIMIT 1`,
            [supplierId, companyId]
        );
        if (byId.rows[0]) return byId.rows[0];
    }

    if (!supplierName) return null;

    const byName = await client.query(
        `SELECT id, lender_name FROM lenders WHERE company_id = $1 AND LOWER(lender_name) = LOWER($2) LIMIT 1`,
        [companyId, supplierName]
    );
    if (byName.rows[0]) return byName.rows[0];

    const created = await client.query(
        `INSERT INTO lenders (company_id, lender_name, entity_type, initial_payable_balance, current_balance)
         VALUES ($1, $2, 'General', 0, 0)
         RETURNING id, lender_name`,
        [companyId, supplierName]
    );
    return created.rows[0] || null;
};

const ensurePurchaseBillColumns = async () => {
    try {
        await db.pgRun(`ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS supplier_name TEXT;`);
        await db.pgRun(`ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;`);
        await db.pgRun(`ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0;`);
    } catch (err) {
        console.error("❌ Failed to ensure purchase bill columns:", err);
    }
};

ensurePurchaseBillColumns();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Unique filename: Date + Original Name
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDFs are allowed'));
    }
});

// CREATE NEW BILL
router.post("/", authMiddleware, checkPermission("Purchases", "create_bills"), upload.single('bill_file'), async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || 1;
    const {
        supplier_id,
        supplier_name,
        bill_number,
        bill_date,
        due_date,
        total_amount,
        paid_amount,
        balance_amount,
        status,
        bill_type,
        items
    } = req.body;
    
    // Parse items if they come as string (FormData sends strings)
    let billItems = [];
    try {
        billItems = typeof items === 'string' ? JSON.parse(items) : (items || []);
    } catch (e) {
        console.warn("⚠️ Failed to parse bill items:", e);
    }

    let file_url = req.file ? `/uploads/${req.file.filename}` : (req.body.file_url || null);

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const supplier = await findOrCreateSupplier(
            client,
            companyId,
            supplier_id ? Number(supplier_id) : null,
            supplier_name || null
        );
        const totalAmount = normalizeMoney(total_amount, 0);
        const paidAmount = normalizeMoney(paid_amount, 0);
        const balanceAmount = Math.max(0, normalizeMoney(balance_amount, totalAmount - paidAmount));
        const finalStatus = resolveBillStatus(paidAmount, totalAmount, status);

        // 1. Create Purchase Bill Header
        const billRes = await client.query(`
            INSERT INTO purchase_bills 
            (company_id, branch_id, supplier_id, supplier_name, bill_number, bill_date, due_date, total_amount, paid_amount, balance_amount, status, file_url, bill_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [
            companyId,
            branchId,
            supplier?.id || null,
            supplier?.lender_name || supplier_name || null,
            bill_number,
            bill_date,
            due_date,
            totalAmount,
            paidAmount,
            balanceAmount,
            finalStatus,
            file_url,
            bill_type || 'GST'
        ]);
        
        const billId = billRes.rows[0].id;

        // 2. Process Line Items & Update Inventory
        for (const item of billItems) {
            // Record Line Item
            await client.query(`
                INSERT INTO purchase_bill_items (bill_id, product_id, description, quantity, unit_price, line_total)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [billId, item.product_id, item.description, item.quantity, item.unit_price, item.line_total]);

            // 📦 UPDATE INVENTORY (Stage 5 Requirement)
            if (item.product_id) {
                await client.query(`
                    UPDATE products 
                    SET current_stock = COALESCE(current_stock, 0) + $1 
                    WHERE id = $2 AND company_id = $3
                `, [item.quantity, item.product_id, companyId]);
            }
        }

        if (supplier?.id && balanceAmount > 0) {
            await client.query(
                `UPDATE lenders
                 SET current_balance = COALESCE(current_balance, 0) + $1
                 WHERE id = $2 AND company_id = $3`,
                [balanceAmount, supplier.id, companyId]
            );
        }

        // 3. Accounting Integration
        // (Simplified for this atomic transaction block)
        await client.query('COMMIT');
        res.status(201).json({ success: true, id: billId });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Purchase Flow Failed:", err);
        res.status(500).json({ error: "Failed to record purchase and update inventory." });
    } finally {
        if (client) client.release();
    }
});


// UPDATE BILL
router.put("/:id", authMiddleware, checkPermission("Purchases", "create_bills"), upload.single('bill_file'), async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    const { supplier_id, supplier_name, bill_number, bill_date, due_date, total_amount, paid_amount, balance_amount, status, bill_type } = req.body;

    // Construct file URL if file was uploaded
    let file_url = undefined;
    if (req.file) {
        file_url = `/uploads/${req.file.filename}`;
    }

    try {
        // Build dynamic update query
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (supplier_id) { fields.push(`supplier_id=$${paramCount++}`); values.push(supplier_id); }
        if (supplier_name) { fields.push(`supplier_name=$${paramCount++}`); values.push(supplier_name); }
        if (bill_number) { fields.push(`bill_number=$${paramCount++}`); values.push(bill_number); }
        if (bill_date) { fields.push(`bill_date=$${paramCount++}`); values.push(bill_date); }
        if (due_date) { fields.push(`due_date=$${paramCount++}`); values.push(due_date); }
        if (total_amount) { fields.push(`total_amount=$${paramCount++}`); values.push(total_amount); }
        if (paid_amount !== undefined) { fields.push(`paid_amount=$${paramCount++}`); values.push(paid_amount); }
        if (balance_amount !== undefined) { fields.push(`balance_amount=$${paramCount++}`); values.push(balance_amount); }
        if (status) { fields.push(`status=$${paramCount++}`); values.push(status); }
        if (bill_type) { fields.push(`bill_type=$${paramCount++}`); values.push(bill_type); }
        if (file_url) { fields.push(`file_url=$${paramCount++}`); values.push(file_url); }

        if (fields.length === 0) return res.json({ success: true, message: "No changes" });

        // Add ID and CompanyID to values
        values.push(id);
        values.push(companyId);

        const sql = `
            UPDATE purchase_bills 
            SET ${fields.join(', ')} 
            WHERE id=$${paramCount++} AND company_id=$${paramCount++}
            RETURNING id
        `;

        const result = await db.pgRun(sql, values);

        if (result.rowCount === 0) return res.status(404).json({ error: "Bill not found" });

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        // Fallback if bill_type fails (schema mismatch)
        if (err.message && err.message.includes('column "bill_type" of relation "purchase_bills" does not exist')) {
             console.warn("⚠️ Update failed due to missing bill_type column. Retrying without it.");
             
             // Remove bill_type from fields/values and retry
             const fields = [];
             const values = [];
             let paramCount = 1;
     
             if (supplier_id) { fields.push(`supplier_id=$${paramCount++}`); values.push(supplier_id); }
             if (supplier_name) { fields.push(`supplier_name=$${paramCount++}`); values.push(supplier_name); }
             if (bill_number) { fields.push(`bill_number=$${paramCount++}`); values.push(bill_number); }
             if (bill_date) { fields.push(`bill_date=$${paramCount++}`); values.push(bill_date); }
             if (due_date) { fields.push(`due_date=$${paramCount++}`); values.push(due_date); }
             if (total_amount) { fields.push(`total_amount=$${paramCount++}`); values.push(total_amount); }
             if (paid_amount !== undefined) { fields.push(`paid_amount=$${paramCount++}`); values.push(paid_amount); }
             if (balance_amount !== undefined) { fields.push(`balance_amount=$${paramCount++}`); values.push(balance_amount); }
             if (status) { fields.push(`status=$${paramCount++}`); values.push(status); }
             // Skip bill_type
             if (file_url) { fields.push(`file_url=$${paramCount++}`); values.push(file_url); }
     
             if (fields.length === 0) return res.json({ success: true, message: "No changes (fallback)" });
     
             values.push(id);
             values.push(companyId);
     
             const fallbackSql = `
                 UPDATE purchase_bills 
                 SET ${fields.join(', ')} 
                 WHERE id=$${paramCount++} AND company_id=$${paramCount++}
                 RETURNING id
             `;
             
             try {
                const fbResult = await db.pgRun(fallbackSql, values);
                if (fbResult.rowCount === 0) return res.status(404).json({ error: "Bill not found" });
                return res.json({ success: true, id: fbResult.rows[0].id, warning: "Bill type not updated (schema mismatch)" });
             } catch (fbErr) {
                 console.error("Fallback Update Error:", fbErr);
                 return res.status(500).json({ error: "Failed to update purchase bill (fallback)" });
             }
        }
        console.error("Update Bill Error:", err);
        res.status(500).json({ error: "Failed to update purchase bill" });
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
