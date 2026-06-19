// backend/routes/userRoutes.js
import bcrypt from "bcryptjs";
import express from "express";
import * as db from "../database/pg.js";
import checkPermission from "../middlewares/checkPermission.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import {
    buildCustomerLedgerStatement,
    ensureCustomerLedgerMetadata,
    recomputeCustomerBalance,
} from "../services/customerLedgerService.js";

const router = express.Router();

/* ============================================================
   STAFF MANAGEMENT (Settings > Users)
   - Only Admins or those with 'access_settings' can manage staff
============================================================ */

// GET SYSTEM USERS (Staff/Admins) - Linked with HR Data
router.get("/staff", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const companyId = req.user?.active_company_id || req.user?.company_id || 1;
    try {
        const sql = `
            SELECT
                u.id,
                u.username,
                u.email,
                u.role,
                u.branch_id,
                u.is_active,
                u.last_login,
                u.created_at,
                b.branch_name
            FROM users u
            LEFT JOIN branches b ON b.id = u.branch_id
            WHERE u.company_id = $1
              AND u.role IN ('admin', 'superadmin', 'branch_manager', 'accountant', 'staff', 'manager', 'viewer')
            ORDER BY u.id ASC
        `;
        const staff = await db.pgAll(sql, [companyId]);
        res.json(staff);
    } catch (err) {
        console.error("Fetch staff error:", err);
        res.status(500).json({ error: "Failed to fetch staff" });
    }
});

// CREATE STAFF LOGIN (Links to Employee ID)
router.post("/staff", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const { username, password, role, employee_id, email, branch_id } = req.body;

    if(!username || !password || !role)
        return res.status(400).json({ error: "Username, Password, and Role are required." });

    try {
        const hashed = await bcrypt.hash(password, 10);

        // Resolve email: use provided email, or pull from linked employee
        let emailToUse = email || null;
        if (!emailToUse && employee_id) {
            const emp = await db.pgGet("SELECT email FROM employees WHERE id = $1", [employee_id]);
            if (emp) emailToUse = emp.email;
        }

        const companyId = req.user?.active_company_id || req.user?.company_id || 1;

        await db.pgRun(
            `INSERT INTO users (company_id, username, email, password_hash, role, employee_id, active_company_id, branch_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $1, $7, true)`,
            [companyId, username, emailToUse, hashed, role, employee_id || null, branch_id || null]
        );
        res.json({ success: true, message: "Login created successfully" });
    } catch (err) {
        console.error("Create staff error:", err);
        res.status(500).json({ error: "Username already taken or database error." });
    }
});

// UPDATE STAFF USER
router.put("/staff/:id", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const { username, email, role, branch_id, is_active } = req.body;
    const companyId = req.user?.active_company_id || req.user?.company_id || 1;
    try {
        await db.pgRun(
            `UPDATE users SET
               username   = COALESCE($1, username),
               email      = COALESCE($2, email),
               role       = COALESCE($3, role),
               branch_id  = $4,
               is_active  = COALESCE($5, is_active)
             WHERE id = $6 AND company_id = $7`,
            [username || null, email || null, role || null, branch_id || null, is_active ?? null, req.params.id, companyId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Update staff error:", err);
        res.status(500).json({ error: err.message });
    }
});

// RESET STAFF PASSWORD
router.post("/staff/:id/reset-password", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6)
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
        const hash = await bcrypt.hash(new_password, 10);
        await db.pgRun(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET SINGLE CUSTOMER
router.get("/:id", authMiddleware, checkPermission("Sales", "view_invoices"), async (req, res) => {
    try {
        const user = await db.pgGet(`
            SELECT
                id, username, nickname, email, phone, role, gstin,
                address_line1, city_pincode, state, state_code,
                initial_balance, bank_name, bank_account_no, bank_ifsc_code, created_at,
                COALESCE((meta->>'customer_opening_balance')::NUMERIC, COALESCE(initial_balance, 0))
                + COALESCE((
                    SELECT SUM(CASE WHEN UPPER(COALESCE(invoice_type,'')) != 'SALES_RETURN' THEN total_amount ELSE -total_amount END)
                    FROM invoices WHERE customer_id = $1 AND company_id = $2
                      AND COALESCE(is_deleted, false) = false AND COALESCE(bill_purpose, '') != 'name_only'
                ), 0)
                - COALESCE((
                    SELECT SUM(ip.amount)
                    FROM invoice_payments ip
                    JOIN invoices i ON i.id = ip.invoice_id
                    WHERE i.customer_id = $1 AND i.company_id = $2
                ), 0)
                - COALESCE((
                    SELECT SUM(amount)
                    FROM transactions
                    WHERE reference_id = $1 AND company_id = $2 AND type = 'CUSTOMER_PAYMENT'
                ), 0)
                - COALESCE((
                    SELECT SUM(COALESCE(discount_amount, 0))
                    FROM invoices
                    WHERE customer_id = $1 AND company_id = $2
                      AND COALESCE(is_deleted, false) = false
                      AND UPPER(COALESCE(invoice_type, '')) != 'SALES_RETURN'
                ), 0) as remaining_balance
            FROM users
            WHERE id = $1 AND company_id = $2
        `, [req.params.id, req.user.active_company_id]);
        
        if (!user) return res.status(404).json({ error: "Customer not found" });
        
        const stats = await db.pgGet(`
            SELECT COALESCE(SUM(total_amount - paid_amount), 0) as pending_balance
            FROM invoices WHERE customer_id = $1 AND company_id = $2
        `, [req.params.id, req.user.active_company_id]);

        res.json({ ...user, pending_balance: parseFloat(stats.pending_balance || 0) });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch customer" });
    }
});

/* ============================================================
   CUSTOMER MANAGEMENT (Sales > Customers)
   - Accessed by Sales staff
   - Includes Password Creation for Customer Portal
============================================================ */

// GET ALL CUSTOMERS
router.get("/", authMiddleware, checkPermission("Sales", "view_invoices"), async (req, res) => {
    const companyId = req.user.active_company_id || req.user.company_id;
    try {
        const users = await db.pgAll(`
            SELECT
                u.id, u.username, u.nickname, u.email, u.phone, u.role, u.gstin,
                u.address_line1, u.city_pincode, u.state, u.state_code,
                u.initial_balance,
                CASE WHEN u.meta IS NOT NULL AND (u.meta->>'customer_ledger_id') IS NOT NULL AND (u.meta->>'customer_ledger_id') != ''
                     THEN (u.meta->>'customer_ledger_id')::INTEGER ELSE NULL END as ledger_id,
                u.bank_name, u.bank_account_no, u.bank_ifsc_code, u.created_at,
                -- Positive = customer owes us (outstanding); Negative = we owe customer (advance/credit)
                COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, COALESCE(u.initial_balance, 0))
                + COALESCE((
                    SELECT SUM(CASE WHEN UPPER(COALESCE(invoice_type,'')) != 'SALES_RETURN' THEN total_amount ELSE -total_amount END)
                    FROM invoices WHERE customer_id = u.id AND company_id = $1 AND COALESCE(is_deleted, false) = false
                      AND COALESCE(bill_purpose, '') != 'name_only'
                ), 0)
                - COALESCE((
                    SELECT SUM(ip.amount)
                    FROM invoice_payments ip
                    JOIN invoices i ON i.id = ip.invoice_id
                    WHERE i.customer_id = u.id AND i.company_id = $1 AND COALESCE(i.is_deleted, false) = false
                ), 0)
                - COALESCE((
                    SELECT SUM(amount)
                    FROM transactions
                    WHERE reference_id = u.id AND company_id = $1 AND type = 'CUSTOMER_PAYMENT'
                ), 0)
                - COALESCE((
                    SELECT SUM(total_amount)
                    FROM sales_returns
                    WHERE customer_id = u.id AND company_id = $1
                ), 0)
                - COALESCE((
                    SELECT SUM(amount)
                    FROM transactions
                    WHERE user_id = u.id AND company_id = $1 AND type = 'ROUND_OFF'
                ), 0)
                - COALESCE((
                    SELECT SUM(COALESCE(discount_amount, 0))
                    FROM invoices
                    WHERE customer_id = u.id AND company_id = $1
                      AND COALESCE(is_deleted, false) = false
                      AND UPPER(COALESCE(invoice_type, '')) != 'SALES_RETURN'
                ), 0) as remaining_balance
            FROM users u
            WHERE u.role IN ('user', 'customer') AND u.company_id = $1
            ORDER BY u.id ASC
        `, [companyId]);
        res.json(users);
    } catch (err) {
        console.error("Fetch customers error:", err);
        res.status(500).json({ error: "Error fetching customers: " + err.message });
    }
});

// CREATE CUSTOMER (With Optional Login)
router.post("/", authMiddleware, checkPermission("Sales", "create_invoices"), async (req, res) => {
    const { 
        username, nickname, email, phone, gstin, 
        address_line1, city_pincode, state, state_code, 
        bank_name, bank_account_no, bank_ifsc_code,
        opening_balance,
        password // ✅ New Field
    } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Customer username/name is required." });
    }

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const password_hash = (password && password.trim() !== "")
            ? await bcrypt.hash(password, 10)
            : await bcrypt.hash(`disabled-${username}-${Date.now()}`, 10);

        const companyId = req.user.active_company_id || req.user.company_id;

        // username has a global unique constraint — try up to 9 suffixed variants
        // so two customers named "BARATH" become "BARATH" and "BARATH_2" automatically.
        // CRITICAL: each attempt uses a SAVEPOINT so a failed INSERT doesn't abort
        // the parent transaction (PostgreSQL marks a txn aborted on any error unless
        // the error is caught via ROLLBACK TO SAVEPOINT before continuing).
        let insertedId = null;
        let usedUsername = username;
        for (let attempt = 1; attempt <= 9; attempt++) {
            usedUsername = attempt === 1 ? username : `${username}_${attempt}`;
            await client.query(`SAVEPOINT sp_username`);
            try {
                const result = await client.query(
                    `INSERT INTO users (
                        company_id, username, nickname, email, phone, gstin,
                        address_line1, city_pincode, state, state_code,
                        bank_name, bank_account_no, bank_ifsc_code,
                        initial_balance, role, active_company_id, password_hash
                    )
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'customer',$15,$16)
                     RETURNING id`,
                    [
                        companyId,
                        usedUsername,
                        // always store the original name as nickname for display
                        nickname || username,
                        email || null, phone || null, gstin || null,
                        address_line1 || null, city_pincode || null,
                        state || null, state_code || null,
                        bank_name || null, bank_account_no || null, bank_ifsc_code || null,
                        opening_balance || 0,
                        companyId,
                        password_hash
                    ]
                );
                await client.query(`RELEASE SAVEPOINT sp_username`);
                insertedId = result.rows[0].id;
                break; // success — exit retry loop
            } catch (insertErr) {
                // ROLLBACK TO SAVEPOINT restores the txn to a clean state so
                // subsequent queries (including the next loop iteration) can proceed
                await client.query(`ROLLBACK TO SAVEPOINT sp_username`);
                await client.query(`RELEASE SAVEPOINT sp_username`);
                if (insertErr.code === '23505' && attempt < 9) {
                    // duplicate username — try next suffix
                    continue;
                }
                throw insertErr; // re-throw non-duplicate or exhausted attempts
            }
        }

        if (!insertedId) {
            throw new Error(`A customer named "${username}" already exists (tried variants up to ${username}_9). Use a more specific name.`);
        }

        await ensureCustomerLedgerMetadata(client, insertedId, companyId);
        await recomputeCustomerBalance(client, insertedId, companyId);

        await client.query("COMMIT");
        res.status(201).json({ success: true, id: insertedId, username: usedUsername });

        // Welcome WhatsApp (non-blocking, after response sent)
        if (phone) {
            try {
                const { sendWelcomeWhatsApp } = await import('../utils/sendWelcomeWhatsApp.js');
                sendWelcomeWhatsApp('customer', { name: nickname || username, phone }).catch(() => {});
            } catch (_) {}
        }
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Create customer error:", err);
        // Return friendly message for any remaining constraint violations
        const msg = err.code === '23505'
            ? `A customer with this name already exists. Please use a more specific name (e.g. add a city or branch).`
            : `Failed to create customer: ${err.message}`;
        res.status(err.code === '23505' ? 409 : 500).json({ error: msg });
    } finally {
        if (client) client.release();
    }
});

// UPDATE CUSTOMER
router.put("/:id", authMiddleware, checkPermission("Sales", "edit_invoices"), async (req, res) => {
    const {
        username, nickname, email, phone, gstin,
        address_line1, city_pincode, state, state_code,
        bank_name, bank_account_no, bank_ifsc_code,
        opening_balance, // ✅ Editable opening balance
        password // ✅ Optional Password Reset
    } = req.body;

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // Base Update Query
        let sql = `UPDATE users SET
            username=$1, nickname=$2, email=$3, phone=$4, gstin=$5,
            address_line1=$6, city_pincode=$7, state=$8, state_code=$9,
            bank_name=$10, bank_account_no=$11, bank_ifsc_code=$12`;

        let params = [
            username, nickname || null, email || null, phone || null, gstin || null,
            address_line1 || null, city_pincode || null, state || null, state_code || null,
            bank_name || null, bank_account_no || null, bank_ifsc_code || null
        ];

        // If password is provided, update it too
        if (password && password.trim() !== "") {
            const hash = await bcrypt.hash(password, 10);
            sql += `, password_hash=$${params.length + 1}`;
            params.push(hash);
        }

        // Add WHERE clause
        sql += ` WHERE id=$${params.length + 1}`;
        params.push(req.params.id);

        sql += ` AND company_id=$${params.length + 1}`;
        params.push(req.user.active_company_id);

        await client.query(sql, params);

        // ✅ Update opening balance in meta if provided
        if (opening_balance !== undefined && opening_balance !== null) {
            const newOpeningBalance = parseFloat(opening_balance) || 0;
            const userRow = await client.query(
                `SELECT meta FROM users WHERE id = $1 AND company_id = $2`,
                [req.params.id, req.user.active_company_id]
            );
            if (userRow.rows.length > 0) {
                const currentMeta = userRow.rows[0].meta || {};
                const updatedMeta = {
                    ...currentMeta,
                    customer_opening_balance: newOpeningBalance
                };
                await client.query(
                    `UPDATE users SET meta = $1 WHERE id = $2 AND company_id = $3`,
                    [JSON.stringify(updatedMeta), req.params.id, req.user.active_company_id]
                );
            }
        }

        await ensureCustomerLedgerMetadata(client, req.params.id, req.user.active_company_id);
        await recomputeCustomerBalance(client, req.params.id, req.user.active_company_id);

        await client.query("COMMIT");
        res.json({ success: true });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Update customer error:", err);
        res.status(500).json({ error: "Failed to update customer" });
    } finally {
        if (client) client.release();
    }
});

// ── POST /users/recompute-all-balances — fix all customer outstanding amounts ──
router.post("/recompute-all-balances", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    let fixed = 0, errors = 0;
    try {
        const customers = await db.pgAll(
            `SELECT id FROM users WHERE role = 'customer' AND company_id = $1`,
            [companyId]
        );
        for (const c of customers) {
            try {
                const client = await db.getClient();
                await client.query('BEGIN');
                await ensureCustomerLedgerMetadata(client, c.id, companyId);
                await recomputeCustomerBalance(client, c.id, companyId);
                await client.query('COMMIT');
                client.release();
                fixed++;
            } catch (e) { errors++; }
        }
        res.json({ success: true, fixed, errors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/ledger", authMiddleware, checkPermission("Sales", "view_invoices"), async (req, res) => {
    try {
        const statement = await buildCustomerLedgerStatement(req.user.active_company_id, Number(req.params.id), req.query);
        if (!statement) return res.status(404).json({ error: "Customer not found" });
        res.json(statement);
    } catch (err) {
        console.error("Fetch customer ledger error:", err);
        res.status(500).json({ error: "Failed to fetch customer ledger" });
    }
});

// ── Helper: fully cascade-delete an invoice and all linked records ────────────
async function cascadeDeleteInvoice(client, invoiceId, companyId) {
    // 1. Get all transaction IDs linked to this invoice
    const txRows = await client.query(
        `SELECT id FROM transactions WHERE reference_id = $1 AND reference_type = 'INVOICE' AND company_id = $2`,
        [invoiceId, companyId]
    );
    const txIds = txRows.rows.map(r => r.id);

    if (txIds.length > 0) {
        // 2. Delete ledger_entries for those transactions
        await client.query(`DELETE FROM ledger_entries WHERE transaction_id = ANY($1::int[])`, [txIds]);
        // 3. Remove from cash/bank ledger
        await client.query(`DELETE FROM cash_ledger WHERE reference_id = ANY($1::int[]) AND company_id = $2`, [txIds, companyId]).catch(() => {});
        await client.query(`DELETE FROM bank_ledger WHERE reference_id = ANY($1::int[]) AND company_id = $2`, [txIds, companyId]).catch(() => {});
        // 4. Delete the transactions themselves
        await client.query(`DELETE FROM transactions WHERE id = ANY($1::int[])`, [txIds]);
    }

    // 5. Delete all payments for this invoice + their linked transactions
    const pmtRows = await client.query(`SELECT id FROM invoice_payments WHERE invoice_id = $1`, [invoiceId]);
    const pmtIds = pmtRows.rows.map(r => r.id);
    if (pmtIds.length > 0) {
        // Also clean up any transactions that reference these payments
        const pmtTxRows = await client.query(
            `SELECT id FROM transactions WHERE reference_id = ANY($1::int[]) AND reference_type = 'PAYMENT' AND company_id = $2`,
            [pmtIds, companyId]
        );
        const pmtTxIds = pmtTxRows.rows.map(r => r.id);
        if (pmtTxIds.length > 0) {
            await client.query(`DELETE FROM ledger_entries WHERE transaction_id = ANY($1::int[])`, [pmtTxIds]);
            await client.query(`DELETE FROM cash_ledger WHERE reference_id = ANY($1::int[]) AND company_id = $2`, [pmtTxIds, companyId]).catch(() => {});
            await client.query(`DELETE FROM bank_ledger WHERE reference_id = ANY($1::int[]) AND company_id = $2`, [pmtTxIds, companyId]).catch(() => {});
            await client.query(`DELETE FROM transactions WHERE id = ANY($1::int[])`, [pmtTxIds]);
        }
        await client.query(`DELETE FROM invoice_payments WHERE invoice_id = $1`, [invoiceId]);
    }

    // 6. Delete line items
    await client.query(`DELETE FROM invoice_line_items WHERE invoice_id = $1`, [invoiceId]).catch(() => {});

    // 7. Hard-delete the invoice
    await client.query(`DELETE FROM invoices WHERE id = $1 AND company_id = $2`, [invoiceId, companyId]);
}

// DELETE a single customer ledger entry — full cascade
// entryId uses the same encoded offsets as the ledger service:
//   < 1 000 000 000  → invoice row  (cascade-delete invoice + payments + transactions + ledger entries)
//   1B – 2B          → invoice_payments row  (real id = entryId - 1B)
//   2B – 3B          → transactions CUSTOMER_PAYMENT/RECEIPT row (real id = entryId - 2B)
//   ≥ 3B             → ROUND_OFF transaction or sales_return (real id = entryId - 3B; type disambiguates)
router.delete("/:customerId/ledger-entry/:entryId", authMiddleware, checkPermission("Sales", "delete_invoices"), async (req, res) => {
    const companyId  = req.user.active_company_id;
    const customerId = Number(req.params.customerId);
    const entryId    = Number(req.params.entryId);
    const entryType  = req.query.type || '';  // 'INVOICE','RETURN','RECEIPT','ROUND_OFF' etc.
    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        if (entryId >= 3_000_000_000) {
            const realId = entryId - 3_000_000_000;
            if (entryType === 'RETURN') {
                await client.query(`DELETE FROM sales_returns WHERE id = $1 AND company_id = $2`, [realId, companyId]);
            } else {
                // ROUND_OFF transaction — remove ledger entries then transaction
                await client.query(`DELETE FROM ledger_entries WHERE transaction_id = $1 AND company_id = $2`, [realId, companyId]);
                await client.query(`DELETE FROM transactions WHERE id = $1 AND company_id = $2`, [realId, companyId]);
            }
        } else if (entryId >= 2_000_000_000) {
            const realId = entryId - 2_000_000_000;
            // Direct CUSTOMER_PAYMENT or RECEIPT transaction
            await client.query(`DELETE FROM ledger_entries WHERE transaction_id = $1 AND company_id = $2`, [realId, companyId]);
            await client.query(`DELETE FROM cash_ledger WHERE reference_id = $1 AND company_id = $2`, [realId, companyId]).catch(() => {});
            await client.query(`DELETE FROM bank_ledger WHERE reference_id = $1 AND company_id = $2`, [realId, companyId]).catch(() => {});
            await client.query(`DELETE FROM transactions WHERE id = $1 AND company_id = $2`, [realId, companyId]);
        } else if (entryId >= 1_000_000_000) {
            // Invoice payment row — delete payment + linked cash/bank entries
            const realId = entryId - 1_000_000_000;
            const pmtTxRows = await client.query(
                `SELECT id FROM transactions WHERE reference_id = $1 AND reference_type = 'PAYMENT' AND company_id = $2`,
                [realId, companyId]
            );
            for (const { id: txId } of pmtTxRows.rows) {
                await client.query(`DELETE FROM ledger_entries WHERE transaction_id = $1 AND company_id = $2`, [txId, companyId]);
                await client.query(`DELETE FROM cash_ledger WHERE reference_id = $1 AND company_id = $2`, [txId, companyId]).catch(() => {});
                await client.query(`DELETE FROM bank_ledger WHERE reference_id = $1 AND company_id = $2`, [txId, companyId]).catch(() => {});
                await client.query(`DELETE FROM transactions WHERE id = $1`, [txId]);
            }
            await client.query(`DELETE FROM invoice_payments WHERE id = $1`, [realId]);
        } else {
            // Invoice row — cascade-delete everything
            await cascadeDeleteInvoice(client, entryId, companyId);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Entry and all related records deleted' });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[customer ledger delete]', err.message);
        res.status(500).json({ error: 'Failed to delete entry: ' + err.message });
    } finally {
        if (client) client.release();
    }
});

// DELETE USER (Customer or Staff)
// Pass ?force=true to cascade-clear all related data before deleting
router.delete("/:id", authMiddleware, checkPermission("Sales", "delete_invoices"), async (req, res) => {
    const id = req.params.id;
    const companyId = req.user.active_company_id;
    const force = req.query.force === 'true';
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        if (force) {
            // 1. Soft-delete any remaining active invoices and clear their financials
            const activeInvoices = await client.query(
                `SELECT id FROM invoices WHERE customer_id = $1 AND company_id = $2 AND COALESCE(is_deleted, false) = false`,
                [id, companyId]
            );
            for (const inv of activeInvoices.rows) {
                await client.query(`UPDATE invoices SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [inv.id]);
                await client.query(`DELETE FROM ledger_entries WHERE transaction_id IN (SELECT id FROM transactions WHERE reference_type = 'INVOICE' AND reference_id = $1)`, [inv.id]);
                await client.query(`DELETE FROM transactions WHERE reference_type = 'INVOICE' AND reference_id = $1`, [inv.id]);
                await client.query(`DELETE FROM invoice_payments WHERE invoice_id = $1`, [inv.id]);
            }
            // 2. Delete all customer payment transactions
            await client.query(
                `DELETE FROM transactions WHERE reference_id = $1 AND company_id = $2 AND type = 'CUSTOMER_PAYMENT'`,
                [id, companyId]
            );
            // 3. Clear customer ledger entries
            await client.query(
                `DELETE FROM transactions WHERE user_id = $1 AND company_id = $2`,
                [id, companyId]
            );
        } else {
            // Soft-check: block if active invoices exist
            const invoiceCount = await client.query(
                `SELECT COUNT(*) AS cnt FROM invoices WHERE customer_id = $1 AND company_id = $2 AND COALESCE(is_deleted, false) = false`,
                [id, companyId]
            );
            if (Number(invoiceCount.rows[0]?.cnt) > 0) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    error: `Cannot delete: this customer has ${invoiceCount.rows[0].cnt} invoice(s). Cancel all invoices first, or use force delete.`
                });
            }
            const txCount = await client.query(
                `SELECT COUNT(*) AS cnt FROM transactions WHERE reference_id = $1 AND company_id = $2 AND type = 'CUSTOMER_PAYMENT'`,
                [id, companyId]
            );
            if (Number(txCount.rows[0]?.cnt) > 0) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    error: `Cannot delete: this customer has ${txCount.rows[0].cnt} payment record(s). Remove all transactions first.`
                });
            }
        }

        await client.query(`DELETE FROM users WHERE id=$1 AND company_id = $2`, [id, companyId]);
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Delete user error:", err);
        res.status(500).json({ error: "Failed to delete customer: " + err.message });
    } finally {
        if (client) client.release();
    }
});

// POST /users/send-reminders — send outstanding balance WhatsApp to customers
// Accepts optional { customer_ids: [id, ...] } to target specific customers
router.post("/send-reminders", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id || req.user.company_id;
    const { customer_ids } = req.body || {};
    const filterByIds = Array.isArray(customer_ids) && customer_ids.length > 0;

    try {
        const { sendWhatsApp } = await import('../utils/whatsapp.js');
        const company = await db.pgGet(`SELECT company_name, phone FROM companies WHERE id = $1`, [companyId]);
        const companyName = company?.company_name || 'JBS Knit Wear';
        const companyPhone = company?.phone || '9791902205';

        // Build WHERE clause — optionally filter by specific customer IDs
        const idFilter = filterByIds
            ? `AND u.id = ANY($2::int[])`
            : '';
        const params = filterByIds ? [companyId, customer_ids] : [companyId];

        const customers = await db.pgAll(`
            SELECT
                u.id, COALESCE(u.nickname, u.username) as name, u.phone,
                COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, COALESCE(u.initial_balance, 0))
                + COALESCE((
                    SELECT SUM(CASE WHEN UPPER(COALESCE(invoice_type,'')) != 'SALES_RETURN' THEN total_amount ELSE -total_amount END)
                    FROM invoices WHERE customer_id = u.id AND company_id = $1 AND COALESCE(is_deleted, false) = false
                      AND COALESCE(bill_purpose, '') != 'name_only'
                ), 0)
                - COALESCE((
                    SELECT SUM(ip.amount) FROM invoice_payments ip
                    JOIN invoices i ON i.id = ip.invoice_id
                    WHERE i.customer_id = u.id AND i.company_id = $1 AND COALESCE(i.is_deleted, false) = false
                ), 0)
                - COALESCE((
                    SELECT SUM(amount) FROM transactions
                    WHERE reference_id = u.id AND company_id = $1 AND type = 'CUSTOMER_PAYMENT'
                ), 0)
                - COALESCE((
                    SELECT SUM(total_amount) FROM sales_returns
                    WHERE customer_id = u.id AND company_id = $1
                ), 0) as outstanding
            FROM users u
            WHERE u.role IN ('user','customer') AND u.company_id = $1
              AND u.phone IS NOT NULL AND u.phone != ''
              ${idFilter}
            ORDER BY u.id ASC
        `, params);

        let sent = 0, skipped = 0;
        const results = [];

        for (const c of customers) {
            const bal = Number(c.outstanding) || 0;
            if (bal <= 0) { skipped++; continue; }

            const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const msg =
`Dear ${c.name},

This is a gentle reminder from *${companyName}*.

📋 *Outstanding Balance: ${fmt(bal)}*

Kindly arrange the payment at your earliest convenience.

For queries, contact us:
📞 ${companyPhone}
*${companyName}*`;

            try {
                await sendWhatsApp(String(c.phone), msg);
                sent++;
                results.push({ name: c.name, phone: c.phone, outstanding: bal, status: 'sent' });
            } catch (e) {
                results.push({ name: c.name, phone: c.phone, outstanding: bal, status: 'failed', error: e.message });
            }
        }

        res.json({
            success: true,
            sent,
            skipped,
            message: `✅ Sent reminders to ${sent} customers. Skipped ${skipped} (no balance or no phone).`,
            results
        });
    } catch (err) {
        console.error('[send-reminders]', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
