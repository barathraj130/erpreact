// backend/routes/suppliersRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { getAccountByCode } from '../utils/accountingEngine.js';

const router = express.Router();

/**
 * 📝 LIST SUPPLIERS
 * Includes unpaid purchase bill balance calculation
 */
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    try {
        let whereClause = "WHERE s.company_id = $1";
        let params = [companyId];

        if (search) {
            whereClause += " AND (s.name ILIKE $2 OR s.gstin ILIKE $2 OR s.phone ILIKE $2)";
            params.push(`%${search}%`);
        }

        const sql = `
            SELECT 
                s.*,
                COALESCE(SUM(pb.total_amount - pb.paid_amount), 0) as pending_balance
            FROM suppliers s
            LEFT JOIN purchase_bills pb ON s.id = pb.supplier_id AND pb.status != 'PAID'
            ${whereClause}
            GROUP BY s.id
            ORDER BY s.name ASC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        
        const rows = await db.pgAll(sql, [...params, limit, offset]);
        res.json(rows || []);
    } catch (err) {
        console.error("Fetch suppliers error:", err);
        res.status(500).json({ error: "Failed to fetch suppliers." });
    }
});

/**
 * ➕ CREATE SUPPLIER
 * Auto-creates Accounts Payable account in COA
 */
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { name, phone, gstin, state, address, email, opening_balance } = req.body;

    if (!name || !phone) return res.status(400).json({ error: "Name and Phone are required." });

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Insert Supplier
        const supplierSql = `
            INSERT INTO suppliers (company_id, name, phone, gstin, state, address, email, opening_balance, current_balance)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            RETURNING *
        `;
        const supplier = (await client.query(supplierSql, [
            companyId, name, phone, gstin || null, state || null, address || null, email || null, parseFloat(opening_balance || 0)
        ])).rows[0];

        // 2. Auto-seed Accounts Payable if needed (Code 2000 range usually)
        // For simplicity, we'll ensure a generic 'Accounts Payable' exists or create one for this supplier if needed
        // Requirement says "Auto-create Accounts Payable ledger account for supplier"
        const accountCode = `2100-${supplier.id}`; // Sub-account style or just link to main AP
        await client.query(`
            INSERT INTO chart_of_accounts (company_id, account_code, name, account_type, opening_balance)
            VALUES ($1, $2, $3, 'LIABILITY', $4)
            ON CONFLICT DO NOTHING
        `, [companyId, accountCode, `Payable: ${name}`, parseFloat(opening_balance || 0)]);

        await client.query('COMMIT');
        res.status(201).json(supplier);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Create supplier error:", err);
        res.status(500).json({ error: "Failed to create supplier." });
    } finally {
        if (client) client.release();
    }
});

/**
 * 🔍 GET SUPPLIER PROFILE
 */
router.get('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const supplier = await db.pgGet(
            "SELECT * FROM suppliers WHERE id = $1 AND company_id = $2",
            [req.params.id, companyId]
        );
        if (!supplier) return res.status(404).json({ error: "Supplier not found" });

        const bills = await db.pgAll(
            "SELECT * FROM purchase_bills WHERE supplier_id = $1 AND is_deleted = false ORDER BY bill_date DESC LIMIT 20",
            [req.params.id]
        );

        const stats = await db.pgGet(`
            SELECT 
                COALESCE(SUM(total_amount), 0)  as total_billed,
                COALESCE(SUM(paid_amount), 0)   as total_paid,
                COALESCE(SUM(total_amount - paid_amount), 0) as balance
            FROM purchase_bills 
            WHERE supplier_id = $1 AND is_deleted = false
        `, [req.params.id]);

        // Build a simple ledger from bill + payment history
        const ledger = [];
        for (const b of bills) {
            ledger.push({
                date: b.bill_date,
                description: `Purchase Bill #${b.bill_number}`,
                debit: 0,
                credit: parseFloat(b.total_amount || 0),
                balance: parseFloat(b.balance_amount || 0)
            });
            if (parseFloat(b.paid_amount || 0) > 0) {
                ledger.push({
                    date: b.bill_date,
                    description: `Payment against Bill #${b.bill_number}`,
                    debit: parseFloat(b.paid_amount || 0),
                    credit: 0,
                    balance: parseFloat(b.balance_amount || 0)
                });
            }
        }

        res.json({
            ...supplier,
            balance:         parseFloat(stats.balance || 0),
            pending_balance: parseFloat(stats.balance || 0),
            total_billed:    parseFloat(stats.total_billed || 0),
            total_paid:      parseFloat(stats.total_paid || 0),
            recent_bills:    bills,
            ledger
        });
    } catch (err) {
        console.error("Supplier profile error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

/**
 * ✏️ UPDATE SUPPLIER
 */
router.put('/:id', authMiddleware, async (req, res) => {
    const { name, phone, email, address, state } = req.body;
    try {
        const sql = `UPDATE suppliers SET name=$1, phone=$2, email=$3, address=$4, state=$5, updated_at=NOW() WHERE id=$6 AND company_id=$7 RETURNING *`;
        const updated = await db.pgGet(sql, [name, phone, email, address, state, req.params.id, req.user.active_company_id]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

/**
 * 🗑️ DELETE SUPPLIER
 * Block if balance > 0
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const stats = await db.pgGet(`
            SELECT 
                COALESCE(SUM(total_amount - paid_amount), 0) as balance,
                COUNT(*) as bill_count
            FROM purchase_bills 
            WHERE supplier_id = $1 AND company_id = $2
        `, [req.params.id, companyId]);

        if (stats.balance > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with outstanding balance: ₹" + stats.balance });
        }
        if (stats.bill_count > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with existing purchase history." });
        }

        await db.pgRun("DELETE FROM suppliers WHERE id = $1 AND company_id = $2", [req.params.id, companyId]);
        res.json({ message: "Supplier deleted" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

export default router;
