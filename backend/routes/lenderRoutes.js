
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Helper to create a Lender and their corresponding ledger account
 */
async function createLenderAndLedgerPG(client, companyId, lenderData) {
    const {
        lender_name, lender_type, contact_person, phone, email, address, opening_balance, notes
    } = lenderData;

    // 1. Get or Create Group ID for 'Loan Payable'
    let groupRes = await client.query("SELECT id FROM ledger_groups WHERE (company_id = $1 OR company_id = 1) AND name = 'Loan Payable'", [companyId]);
    if (!groupRes.rows[0]) {
        const insertGroup = await client.query(
            "INSERT INTO ledger_groups (company_id, name, nature, is_default) VALUES ($1, 'Loan Payable', 'Liability', TRUE) RETURNING id",
            [companyId]
        );
        groupRes = insertGroup;
    }
    const groupId = groupRes.rows[0].id;

    // 2. Insert Lender
    const initialBalanceParsed = parseFloat(opening_balance || 0);

    const lenderSql = `
        INSERT INTO lenders (
            company_id, lender_name, lender_type, contact_person, phone, email, 
            address, opening_balance, current_balance, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
        RETURNING id
    `;

    const lenderResult = await client.query(lenderSql, [
        companyId, lender_name, lender_type || 'Bank', contact_person || null, 
        phone || null, email || null, address || null, initialBalanceParsed, notes || null
    ]);

    // 3. Create Ledger
    const ledgerSql = `INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, $2, $3, $4, $5)`;
    const isDebit = initialBalanceParsed < 0 ? 1 : 0;

    await client.query(ledgerSql, [companyId, lender_name, groupId, Math.abs(initialBalanceParsed), isDebit]);

    return { id: lenderResult.rows[0].id };
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user?.active_company_id;
        const sql = `
            SELECT l.*, 
                (SELECT SUM(principal_amount) FROM loans WHERE lender_id = l.id AND status = 'ACTIVE') as total_borrowed,
                (SELECT SUM(principal_component) FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE lender_id = l.id)) as total_repaid
            FROM lenders l 
            WHERE l.company_id = $1 
            ORDER BY l.lender_name ASC
        `;
        const rows = await db.pgAll(sql, [companyId]);
        res.json(rows || []);
    } catch (err) {
        console.error("Fetch lenders error:", err);
        res.status(500).json({ error: "Failed to fetch lenders." });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!req.body.lender_name) return res.status(400).json({ error: "Lender Name is required." });

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const result = await createLenderAndLedgerPG(client, companyId, req.body);
        await client.query('COMMIT');
        res.status(201).json({ id: result.id, message: "Lender created." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Create lender error:", err);
        res.status(500).json({ error: "Failed to create lender." });
    } finally {
        if (client) client.release();
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const lender = await db.pgGet('SELECT * FROM lenders WHERE id = $1 AND company_id = $2', [id, req.user.active_company_id]);
        if (!lender) return res.status(404).json({ error: "Lender not found" });
        
        const loans = await db.pgAll('SELECT * FROM loans WHERE lender_id = $1 ORDER BY start_date DESC', [id]);
        res.json({ ...lender, loans });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch lender details" });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.active_company_id;
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        // Check for active loans
        const loans = await client.query('SELECT id FROM loans WHERE lender_id = $1 AND status = $2', [id, 'ACTIVE']);
        if (loans.rows.length > 0) {
            return res.status(400).json({ error: "Cannot delete lender with active loans." });
        }

        const lender = await db.pgGet('SELECT lender_name FROM lenders WHERE id = $1', [id]);
        if (!lender) return res.status(404).json({ error: "Not found" });

        await client.query('DELETE FROM ledgers WHERE name = $1 AND company_id = $2', [lender.lender_name, companyId]);
        await client.query('DELETE FROM lenders WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ message: "Lender deleted." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        res.status(500).json({ error: "Failed to delete lender." });
    } finally {
        if (client) client.release();
    }
});

export default router;