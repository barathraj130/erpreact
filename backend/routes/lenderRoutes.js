// backend/routes/lenderRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

async function createLenderAndLedgerPG(client, companyId, lenderData) {
    const { 
        lender_name, entity_type, phone, email, initial_payable_balance, notes,
        bank_name, bank_account_no, bank_ifsc_code 
    } = lenderData;
    
    // 1. Get Group ID
    const groupRes = await client.query("SELECT id FROM ledger_groups WHERE company_id = $1 AND name = 'Sundry Creditors'", [companyId]);
    if (!groupRes.rows[0]) throw new Error("Sundry Creditors ledger group not found.");
    const groupId = groupRes.rows[0].id;

    // 2. Insert Lender with Bank Details
    const initialBalanceParsed = parseFloat(initial_payable_balance || 0);
    
    const lenderSql = `
        INSERT INTO lenders (
            company_id, lender_name, entity_type, phone, email, 
            initial_payable_balance, current_balance, notes, 
            bank_name, bank_account_no, bank_ifsc_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10)
        RETURNING id
    `;
    
    const lenderResult = await client.query(lenderSql, [
        companyId, lender_name, entity_type || 'General', phone || null, email || null, 
        initialBalanceParsed, notes || null,
        bank_name || null, bank_account_no || null, bank_ifsc_code || null
    ]);
    
    // 3. Create Ledger
    const ledgerSql = `INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, $2, $3, $4, $5)`;
    const isDebit = initialBalanceParsed < 0 ? 1 : 0; 
    
    await client.query(ledgerSql, [companyId, lender_name, groupId, Math.abs(initialBalanceParsed), isDebit]);
    
    return { id: lenderResult.rows[0].id };
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const sql = `
            SELECT l.*, (COALESCE(l.current_balance, l.initial_payable_balance, 0)) AS remaining_balance 
            FROM lenders l WHERE l.company_id = $1 ORDER BY l.lender_name ASC
        `;
        const rows = await db.pgAll(sql, [req.user?.active_company_id]);
        res.json(rows || []); 
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch suppliers." });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!req.body.lender_name) return res.status(400).json({ error: "Supplier Name is required." });

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const result = await createLenderAndLedgerPG(client, companyId, req.body);
        await client.query('COMMIT');
        res.status(201).json({ id: result.id, message: "Supplier created." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Create lender error:", err);
        res.status(500).json({ error: "Failed to create supplier." });
    } finally {
        if (client) client.release();
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.active_company_id;
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const lender = await db.pgGet('SELECT lender_name FROM lenders WHERE id = $1', [id]);
        if (!lender) return res.status(404).json({ error: "Not found" });
        
        await client.query('DELETE FROM ledgers WHERE name = $1 AND company_id = $2', [lender.lender_name, companyId]);
        await client.query('DELETE FROM lenders WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        res.json({ message: "Supplier deleted." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        res.status(500).json({ error: "Failed to delete." });
    } finally {
        if (client) client.release();
    }
});

export default router;