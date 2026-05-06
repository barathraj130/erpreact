
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

async function createSupplierAndLedgerPG(client, companyId, supplierData) {
    const {
        name, contact_person, phone, email, address, gstin, opening_balance
    } = supplierData;

    // 1. Get or Create Group ID
    let groupRes = await client.query("SELECT id FROM ledger_groups WHERE (company_id = $1 OR company_id = 1) AND name = 'Sundry Creditors'", [companyId]);
    if (!groupRes.rows[0]) {
        const insertGroup = await client.query(
            "INSERT INTO ledger_groups (company_id, name, nature, is_default) VALUES ($1, 'Sundry Creditors', 'Liability', TRUE) RETURNING id",
            [companyId]
        );
        groupRes = insertGroup;
    }
    const groupId = groupRes.rows[0].id;

    // 2. Insert Supplier
    const initialBalanceParsed = parseFloat(opening_balance || 0);

    const supplierSql = `
        INSERT INTO suppliers (
            company_id, name, contact_person, phone, email, address, gstin,
            opening_balance, current_balance
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING id
    `;

    const supplierResult = await client.query(supplierSql, [
        companyId, name, contact_person || null, phone || null, email || null,
        address || null, gstin || null, initialBalanceParsed
    ]);

    // 3. Create Ledger
    const ledgerSql = `INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, $2, $3, $4, $5)`;
    const isDebit = initialBalanceParsed < 0 ? 1 : 0;

    await client.query(ledgerSql, [companyId, name, groupId, Math.abs(initialBalanceParsed), isDebit]);

    return { id: supplierResult.rows[0].id };
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const sql = `SELECT * FROM suppliers WHERE company_id = $1 ORDER BY name ASC`;
        const rows = await db.pgAll(sql, [req.user?.active_company_id]);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch suppliers." });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!req.body.name) return res.status(400).json({ error: "Supplier Name is required." });

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const result = await createSupplierAndLedgerPG(client, companyId, req.body);
        await client.query('COMMIT');
        res.status(201).json({ id: result.id, message: "Supplier created." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Create supplier error:", err);
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
        const supplier = await db.pgGet('SELECT name FROM suppliers WHERE id = $1', [id]);
        if (!supplier) return res.status(404).json({ error: "Not found" });

        await client.query('DELETE FROM ledgers WHERE name = $1 AND company_id = $2', [supplier.name, companyId]);
        await client.query('DELETE FROM suppliers WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ message: "Supplier deleted." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        res.status(500).json({ error: "Failed to delete supplier." });
    } finally {
        if (client) client.release();
    }
});

export default router;
