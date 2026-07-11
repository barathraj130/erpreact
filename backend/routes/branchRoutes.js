// backend/routes/branchRoutes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { checkLimit } from '../middlewares/subscriptionMiddleware.js';

const router = express.Router();

// GET current branch info for the user
router.get('/current', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id;
    
    if (!branchId) {
        // If no branch_id on user, return first branch or company default
        const branches = await db.pgAll('SELECT * FROM branches WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1', [companyId]);
        return res.json(branches[0] || null);
    }

    try {
        const branch = await db.pgGet('SELECT * FROM branches WHERE id = $1 AND company_id = $2', [branchId, companyId]);
        res.json(branch);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch current branch" });
    }
});

// GET all branches for the active company
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user?.company_id || req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "No active company context." });

    try {
        const userRole = req.user?.role?.toLowerCase();
        let query = `
            SELECT b.*, u.email as login_email 
            FROM branches b 
            LEFT JOIN users u ON b.manager_user_id = u.id 
            WHERE b.company_id = $1
        `;
        let params = [companyId];

        // 🏢 BRANCH ISOLATION: Non-admins only see their assigned branch
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            if (req.user.branch_id) {
                query += " AND b.id = $2";
                params.push(req.user.branch_id);
            }
        }

        query += " ORDER BY b.created_at DESC";
        
        const branches = await db.pgAll(query, params);
        res.json(branches);
    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ error: "Failed to fetch branches." });
    }
});

// POST create a new branch (Check limits first)
router.post('/', authMiddleware, checkLimit('max_branches'), async (req, res) => {
    const companyId = req.user?.company_id || req.user?.active_company_id;
    const { 
        branch_name, branch_code, branch_type, is_active,
        address_line1, address_line2, city, pincode, state, country,
        branch_phone, branch_email, whatsapp_number,
        manager_name, manager_phone, manager_email, manager_whatsapp,
        gstin, bill_prefix, default_payment_mode, opening_cash_balance,
        login_email, temporary_password, access_level
    } = req.body;

    if (!branch_name || !branch_code) return res.status(400).json({ error: "Branch name and code are required." });

    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        
        // 1. Create Branch Record
        const sql = `
            INSERT INTO branches (
                company_id, branch_name, branch_code, branch_type, is_active,
                address_line1, address_line2, city, pincode, state, country,
                branch_phone, branch_email, whatsapp_number,
                manager_name, manager_phone, manager_email, manager_whatsapp,
                gstin, bill_prefix, default_payment_mode, opening_cash_balance,
                city_pincode
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) 
            RETURNING id
        `;
        const result = await client.query(sql, [
            companyId, branch_name, branch_code, branch_type || 'Sub Branch', is_active ?? true,
            address_line1, address_line2 || null, city, pincode, state, country || 'India',
            branch_phone, branch_email || null, whatsapp_number || null,
            manager_name, manager_phone, manager_email || null, manager_whatsapp || null,
            gstin || null, bill_prefix, default_payment_mode || 'Cash', opening_cash_balance || 0,
            `${city || ''} - ${pincode || ''}`
        ]);
        const newBranchId = result.rows[0].id;

        // 2. Auto-create Branch Login User (if credentials provided)
        let newUserId = null;
        if (login_email && temporary_password) {
            const hashedPwd = await bcrypt.hash(temporary_password, 10);
            const userSql = `
                INSERT INTO users (
                    company_id, active_company_id, username, email, password_hash, role, branch_id
                ) VALUES ($1, $1, $2, $3, $4, $5, $6) RETURNING id
            `;
            const userRole = access_level === 'Branch Manager' ? 'manager' : 'staff';
            const userRes = await client.query(userSql, [
                companyId, manager_name || branch_name, login_email, hashedPwd, userRole, newBranchId
            ]);
            newUserId = userRes.rows[0].id;
            
            // Link manager_user_id to branch
            await client.query("UPDATE branches SET manager_user_id = $1 WHERE id = $2", [newUserId, newBranchId]);
        }

        // 3. Create Cash Account in Ledger for Opening Balance (optional, non-blocking)
        if (opening_cash_balance && Number(opening_cash_balance) > 0) {
            const groupRes = await client.query("SELECT id FROM ledger_groups WHERE name = 'Cash-in-Hand' AND company_id = $1", [companyId]);
            const groupId = groupRes.rows[0]?.id;
            if (groupId) {
                await client.query(
                    `INSERT INTO ledgers (company_id, branch_id, group_id, name, opening_balance, balance_type)
                     VALUES ($1, $2, $3, $4, $5, 'Dr')`,
                    [companyId, newBranchId, groupId, `Cash A/c - ${branch_code}`, opening_cash_balance]
                );
            }
        }

        await client.query("COMMIT");
        res.status(201).json({ id: newBranchId, message: "Branch created successfully." });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating branch:", error);
        res.status(500).json({ error: error.message || "Failed to create branch." });
    } finally {
        client.release();
    }
});

// PUT update branch info
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.company_id || req.user?.active_company_id;
    const { 
        branch_name, branch_type, is_active,
        address_line1, address_line2, city, pincode, state, country,
        branch_phone, branch_email, whatsapp_number,
        manager_name, manager_phone, manager_email, manager_whatsapp,
        gstin, bill_prefix, default_payment_mode, opening_cash_balance,
        login_email
    } = req.body;

    const client = await db.getClient();
    try {
        await client.query("BEGIN");

        // 1. Update Branch Record
        const sql = `
            UPDATE branches 
            SET branch_name = $1, branch_type = $2, is_active = $3,
                address_line1 = $4, address_line2 = $5, city = $6, pincode = $7, state = $8, country = $9,
                branch_phone = $10, branch_email = $11, whatsapp_number = $12,
                manager_name = $13, manager_phone = $14, manager_email = $15, manager_whatsapp = $16,
                gstin = $17, bill_prefix = $18, default_payment_mode = $19, opening_cash_balance = $20,
                city_pincode = $21
            WHERE id = $22 AND company_id = $23
            RETURNING manager_user_id
        `;
        const result = await client.query(sql, [
            branch_name, branch_type, is_active,
            address_line1, address_line2, city, pincode, state, country,
            branch_phone, branch_email, whatsapp_number,
            manager_name, manager_phone, manager_email, manager_whatsapp,
            gstin, bill_prefix, default_payment_mode, opening_cash_balance,
            city + " - " + pincode,
            id, companyId
        ]);
        
        if (result.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Branch not found or unauthorized." });
        }

        const managerUserId = result.rows[0].manager_user_id;

        // 2. Update associated User Record (if exists)
        if (managerUserId && login_email) {
            await client.query(
                "UPDATE users SET email = $1, username = $2 WHERE id = $3 AND company_id = $4",
                [login_email, manager_name || branch_name, managerUserId, companyId]
            );
        }
        
        await client.query("COMMIT");
        res.json({ message: "Branch updated successfully." });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating branch:", error);
        res.status(500).json({ error: "Failed to update branch." });
    } finally {
        client.release();
    }
});

// POST /api/branches/reset-password
router.post('/reset-password', authMiddleware, async (req, res) => {
    const { email, new_password } = req.body;
    const requesterRole = req.user?.role?.toLowerCase();
    const companyId = req.user?.company_id || req.user?.active_company_id;
    
    // 1. Security Check: Only admins or superadmins can reset passwords
    if (requesterRole !== 'admin' && requesterRole !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized. Only administrators can reset branch passwords." });
    }

    if (!email || !new_password) {
        return res.status(400).json({ error: "Email and new password are required" });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    try {
        const hashedPwd = await bcrypt.hash(new_password, 10);
        
        // 2. Data Isolation: Ensure the target user belongs to the same company
        const result = await db.pgRun(
            "UPDATE users SET password_hash = $1, failed_attempts = 0, lock_until = NULL WHERE email = $2 AND company_id = $3",
            [hashedPwd, email, companyId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found with this email in your company context." });
        }

        res.json({ success: true, message: "Password reset successfully" });
    } catch (err) {
        console.error("Error resetting password:", err);
        res.status(500).json({ error: "Failed to reset password" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BRANCH BILLING — all routes use req.user.branch_id from JWT, never from body
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/branches/billing/debug — admin-only diagnostic info
router.get('/billing/debug', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    try {
        const [cashBranches, bankBranches, roles, invoiceBranches] = await Promise.all([
            db.pgAll(`SELECT branch_id, COUNT(*) AS rows, ROUND(SUM(amount)::numeric,0) AS total FROM cash_ledger WHERE company_id=$1 GROUP BY branch_id ORDER BY branch_id`, [companyId]),
            db.pgAll(`SELECT branch_id, COUNT(*) AS rows, ROUND(SUM(amount)::numeric,0) AS total FROM bank_ledger WHERE company_id=$1 GROUP BY branch_id ORDER BY branch_id`, [companyId]),
            db.pgAll(`SELECT DISTINCT role FROM users ORDER BY role`),
            db.pgAll(`SELECT branch_id, COUNT(*) AS invoices FROM invoices WHERE company_id=$1 GROUP BY branch_id ORDER BY branch_id`, [companyId]),
        ]);
        res.json({ jwt_branch_id: branchId, cash_ledger: cashBranches, bank_ledger: bankBranches, roles, invoice_branches: invoiceBranches });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/branches/billing/balances — branch cash + bank
// Primary: cash_ledger/bank_ledger filtered by branch_id
// Fallback: sum from invoices (handles legacy rows with NULL/wrong branch_id)
router.get('/billing/balances', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    if (!branchId) return res.json({ cash: 0, bank: 0 });
    try {
        // Try ledger first — covers branch_id exact match OR NULL (legacy rows)
        const [cashRow, bankRow] = await Promise.all([
            db.pgGet(`
                SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0)
                     - COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance
                FROM cash_ledger
                WHERE company_id=$1 AND (branch_id=$2 OR branch_id IS NULL)
            `, [companyId, branchId]),
            db.pgGet(`
                SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0)
                     - COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance
                FROM bank_ledger
                WHERE company_id=$1 AND (branch_id=$2 OR branch_id IS NULL)
            `, [companyId, branchId]),
        ]);

        let cash = Number(cashRow?.balance || 0);
        let bank = Number(bankRow?.balance || 0);

        // If ledger has nothing, compute from invoices (branch_id is always set on invoices)
        if (cash === 0 && bank === 0) {
            const invRow = await db.pgGet(`
                SELECT
                  COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'CASH')) IN ('CASH','SPLIT')
                    THEN COALESCE(cash_amount, paid_amount, 0) ELSE 0 END), 0) AS cash,
                  COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'')) IN ('BANK','UPI','NEFT','RTGS','IMPS')
                    THEN COALESCE(paid_amount, 0) ELSE 0 END), 0) AS bank,
                  COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'')) = 'SPLIT'
                    THEN COALESCE(bank_amount, 0) ELSE 0 END), 0) AS split_bank
                FROM invoices
                WHERE company_id=$1 AND branch_id=$2 AND COALESCE(is_deleted,false)=false
            `, [companyId, branchId]);
            cash = Number(invRow?.cash || 0);
            bank = Number(invRow?.bank || 0) + Number(invRow?.split_bank || 0);
        }

        res.json({ cash, bank });
    } catch (err) {
        console.error('[billing/balances]', err.message);
        res.json({ cash: 0, bank: 0 });
    }
});

// GET /api/branches/billing/day-summary?date=YYYY-MM-DD
router.get('/billing/day-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    const date      = req.query.date || new Date().toISOString().split('T')[0];
    if (!branchId) return res.json({ cash: 0, bank: 0, bills_count: 0, today_sales: 0, cash_collected: 0, bank_collected: 0, credit_given: 0 });
    try {
        const [cashBal, bankBal, openCash, openBank, salesRow, cashIn, bankIn, creditRow] = await Promise.all([
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0)-COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance FROM cash_ledger WHERE company_id=$1 AND branch_id=$2`, [companyId, branchId]),
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0)-COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance FROM bank_ledger WHERE company_id=$1 AND branch_id=$2`, [companyId, branchId]),
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0)-COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance FROM cash_ledger WHERE company_id=$1 AND branch_id=$2 AND date < $3`, [companyId, branchId, date]),
            db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0)-COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance FROM bank_ledger WHERE company_id=$1 AND branch_id=$2 AND DATE(created_at) < $3`, [companyId, branchId, date]),
            db.pgGet(`SELECT COUNT(*) AS bills_count, COALESCE(SUM(COALESCE(grand_total,net_payable,total_amount,0)),0) AS today_sales FROM invoices WHERE company_id=$1 AND branch_id=$2 AND DATE(invoice_date)=$3 AND COALESCE(is_deleted,false)=false`, [companyId, branchId, date]),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger WHERE company_id=$1 AND branch_id=$2 AND direction='in' AND date=$3`, [companyId, branchId, date]),
            db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM bank_ledger WHERE company_id=$1 AND branch_id=$2 AND direction='in' AND DATE(created_at)=$3`, [companyId, branchId, date]),
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(balance_amount,0)),0) AS total FROM invoices WHERE company_id=$1 AND branch_id=$2 AND DATE(invoice_date)=$3 AND COALESCE(balance_amount,0)>0 AND COALESCE(is_deleted,false)=false`, [companyId, branchId, date]),
        ]);
        res.json({
            date,
            branch_id: branchId,
            cash: Number(cashBal?.balance || 0),
            bank: Number(bankBal?.balance || 0),
            opening_cash: Number(openCash?.balance || 0),
            opening_bank: Number(openBank?.balance || 0),
            bills_count: Number(salesRow?.bills_count || 0),
            today_sales: Number(salesRow?.today_sales || 0),
            cash_collected: Number(cashIn?.total || 0),
            bank_collected: Number(bankIn?.total || 0),
            credit_given: Number(creditRow?.total || 0),
        });
    } catch (err) {
        console.error('[billing/day-summary]', err.message);
        res.json({ cash: 0, bank: 0, opening_cash: 0, opening_bank: 0, bills_count: 0, today_sales: 0, cash_collected: 0, bank_collected: 0, credit_given: 0 });
    }
});

// GET /api/branches/billing/today-bills?date=YYYY-MM-DD
router.get('/billing/today-bills', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    const date      = req.query.date || new Date().toISOString().split('T')[0];
    if (!branchId) return res.json([]);
    try {
        const rows = await db.pgAll(`
            SELECT i.id, i.invoice_number, i.invoice_type, i.invoice_date, i.created_at,
                   COALESCE(u.nickname, u.username, i.walk_in_name) AS customer_name,
                   u.phone AS customer_phone,
                   COALESCE(i.grand_total, i.net_payable, i.total_amount, 0) AS grand_total,
                   COALESCE(i.paid_amount, 0) AS paid_amount,
                   COALESCE(i.balance_amount, 0) AS balance_amount,
                   COALESCE(i.payment_status, 'PENDING') AS payment_status,
                   COALESCE(i.payment_mode, 'CASH') AS payment_mode,
                   COALESCE(i.bill_type, i.invoice_type, 'NON_TAX') AS bill_type,
                   (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id) AS item_count
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            WHERE i.company_id = $1 AND i.branch_id = $2
              AND DATE(i.invoice_date) = $3
              AND COALESCE(i.is_deleted, false) = false
            ORDER BY i.created_at DESC
        `, [companyId, branchId, date]);
        res.json(rows);
    } catch (err) {
        console.error('[billing/today-bills]', err.message);
        res.json([]);
    }
});

// GET /api/branches/billing/inventory
router.get('/billing/inventory', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    if (!branchId) return res.json([]);
    try {
        // NOTE: branch_inventory only tracks a single current_stock total (used by
        // stock-transfer/request features) — it has no fresh/mistake split at all.
        // The fresh/mistake model billing needs lives in the `inventory` table
        // instead (branch_id + product_id + stock_type='fresh'|'mistake').
        const rows = await db.pgAll(`
            SELECT p.id AS product_id, p.name, p.hsn_code,
                   COALESCE(inv_f.selling_price, inv_m.selling_price, p.selling_price) AS selling_price,
                   COALESCE(inv_f.gst_percent, inv_m.gst_percent, p.gst_percent, 5) AS gst_percent,
                   COALESCE(inv_f.current_stock, 0) AS fresh_stock,
                   COALESCE(inv_m.current_stock, 0) AS mistake_stock,
                   COALESCE(inv_f.current_stock, 0) + COALESCE(inv_m.current_stock, 0) AS total_stock
            FROM products p
            LEFT JOIN inventory inv_f ON inv_f.product_id = p.id AND inv_f.branch_id = $1 AND inv_f.stock_type = 'fresh'
            LEFT JOIN inventory inv_m ON inv_m.product_id = p.id AND inv_m.branch_id = $1 AND inv_m.stock_type = 'mistake'
            WHERE p.company_id = $2 AND COALESCE(p.is_deleted, false) = false
              AND (COALESCE(inv_f.current_stock, 0) + COALESCE(inv_m.current_stock, 0)) > 0
            ORDER BY p.name
        `, [branchId, companyId]);
        res.json(rows);
    } catch (err) {
        console.error('[billing/inventory]', err.message);
        res.json([]);
    }
});

// POST /api/branches/billing/day-close
router.post('/billing/day-close', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    const userId    = req.user.id;
    const { date, expected_cash, actual_cash, cash_difference, bank_balance,
            today_sales, cash_collected, bank_collected, credit_given, bills_count, notes } = req.body;
    const closeDate = date || new Date().toISOString().split('T')[0];
    try {
        await db.pgRun(`
            CREATE TABLE IF NOT EXISTS branch_day_close (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                date DATE NOT NULL,
                expected_cash NUMERIC(12,2) DEFAULT 0,
                actual_cash NUMERIC(12,2) DEFAULT 0,
                cash_difference NUMERIC(12,2) DEFAULT 0,
                bank_balance NUMERIC(12,2) DEFAULT 0,
                today_sales NUMERIC(12,2) DEFAULT 0,
                cash_collected NUMERIC(12,2) DEFAULT 0,
                bank_collected NUMERIC(12,2) DEFAULT 0,
                credit_given NUMERIC(12,2) DEFAULT 0,
                bills_count INTEGER DEFAULT 0,
                notes TEXT,
                submitted_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(company_id, branch_id, date)
            )
        `).catch(() => {});
        await db.pgRun(`
            INSERT INTO branch_day_close (company_id, branch_id, date, expected_cash, actual_cash, cash_difference,
                bank_balance, today_sales, cash_collected, bank_collected, credit_given, bills_count, notes, submitted_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (company_id, branch_id, date) DO UPDATE SET
                expected_cash=$4, actual_cash=$5, cash_difference=$6,
                bank_balance=$7, today_sales=$8, cash_collected=$9,
                bank_collected=$10, credit_given=$11, bills_count=$12,
                notes=$13, submitted_by=$14, created_at=NOW()
        `, [companyId, branchId, closeDate,
            expected_cash || 0, actual_cash || 0, cash_difference || 0,
            bank_balance || 0, today_sales || 0, cash_collected || 0,
            bank_collected || 0, credit_given || 0, bills_count || 0,
            notes || '', userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('[billing/day-close]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
