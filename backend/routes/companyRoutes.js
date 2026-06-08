// backend/routes/companyRoutes.js
import express from 'express';
import * as db from '../database/pg.js'; // Ensure correct import for pg
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// GET /api/company/profile - Fetch profile of the active company
router.get('/profile', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized or no active company." });

    try {
        const profile = await db.pgGet('SELECT * FROM companies WHERE id = $1', [companyId]);
        if (!profile) return res.status(404).json({ error: "Company profile not found." });
        res.json(profile);
    } catch (error) {
        console.error("Error fetching company profile:", error.message);
        res.status(500).json({ error: "Failed to fetch profile." });
    }
});

// PUT /api/company/profile - Update company profile
router.put('/profile', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    const { 
        company_name, gstin, pan_number, company_type, 
        financial_year_start_month, default_currency,
        address_line1, city_pincode, state, phone, email,
        bank_name, bank_account_no, bank_ifsc_code 
    } = req.body;

    try {
        const sql = `
            UPDATE companies 
            SET company_name = $1, gstin = $2, pan_number = $3, company_type = $4,
                financial_year_start_month = $5, default_currency = $6,
                address_line1 = $7, city_pincode = $8, state = $9, 
                phone = $10, email = $11, 
                bank_name = $12, bank_account_no = $13, bank_ifsc_code = $14
            WHERE id = $15
        `;
        
        await db.pgRun(sql, [
            company_name, gstin, pan_number, company_type,
            financial_year_start_month, default_currency,
            address_line1, city_pincode, state, phone, email,
            bank_name, bank_account_no, bank_ifsc_code, 
            companyId
        ]);

        res.json({ message: "Company profile updated successfully." });
    } catch (error) {
        console.error("Error updating company profile:", error.message);
        res.status(500).json({ error: "Failed to update profile." });
    }
});

// GET /api/company/bank-accounts
router.get('/bank-accounts', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    try {
        const accounts = await db.pgAll('SELECT * FROM bank_details WHERE company_id = $1 ORDER BY is_default DESC', [companyId]);
        res.json(accounts);
    } catch (error) {
        console.error("Error fetching bank accounts:", error.message);
        res.status(500).json({ error: "Failed to fetch bank accounts." });
    }
});

// POST /api/company/bank-accounts
router.post('/bank-accounts', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });
    
    const { 
        bank_name, account_number, ifsc_code, account_type, 
        upi_id, opening_balance, purpose, is_default 
    } = req.body;

    if (!bank_name || !account_number) {
        return res.status(400).json({ error: "Bank name and account number are required." });
    }
    
    const sql = `
        INSERT INTO bank_details (
            company_id, bank_name, account_number, ifsc_code, account_type, 
            upi_id, opening_balance, current_balance, purpose, is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `;
    
    try {
        const result = await db.pgRun(sql, [
            companyId, bank_name, account_number, ifsc_code, account_type, 
            upi_id, opening_balance || 0, opening_balance || 0, purpose, is_default || false
        ]);
        const newId = result.rows[0].id;
        res.status(201).json({ id: newId, message: "Bank account added successfully." });
    } catch (error) {
        console.error("Error adding bank account:", error.message);
         if (error.code === '23505') {
             return res.status(400).json({ error: "Account number already exists." });
         }
        res.status(500).json({ error: "Failed to add bank account." });
    }
});

// PUT /api/company/bank-accounts/:id
router.put('/bank-accounts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    const { 
        bank_name, account_number, ifsc_code, account_type, 
        upi_id, opening_balance, purpose, is_default 
    } = req.body;

    try {
        const sql = `
            UPDATE bank_details 
            SET bank_name = $1, account_number = $2, ifsc_code = $3, account_type = $4,
                upi_id = $5, opening_balance = $6, purpose = $7, is_default = $8
            WHERE id = $9 AND company_id = $10
        `;
        const result = await db.pgRun(sql, [
            bank_name, account_number, ifsc_code, account_type,
            upi_id, opening_balance, purpose, is_default,
            id, companyId
        ]);

        if (result.rowCount === 0) return res.status(404).json({ error: "Bank account not found." });
        res.json({ message: "Bank account updated successfully." });
    } catch (error) {
        console.error("Error updating bank account:", error.message);
        res.status(500).json({ error: "Failed to update bank account." });
    }
});


// DELETE /api/company/bank-accounts/:id
router.delete('/bank-accounts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });
    
    try {
        const usageCheck = await db.pgGet('SELECT COUNT(*) as count FROM invoices WHERE selected_bank_details_id = $1', [id]);
        if (usageCheck && parseInt(usageCheck.count) > 0) {
            return res.status(400).json({ error: "Cannot delete this bank account; it is linked to existing invoices." });
        }
        
        const result = await db.pgRun('DELETE FROM bank_details WHERE id = $1 AND company_id = $2', [id, companyId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Bank account not found." });
        }
        
        res.json({ message: "Bank account deleted successfully." });
    } catch (error) {
        console.error("Error deleting bank account:", error.message);
        res.status(500).json({ error: "Failed to delete bank account." });
    }
});

// ─────────────────────────────────────────────
// GET /company/opening-balance  — fetch current opening balances
// ─────────────────────────────────────────────
router.get('/opening-balance', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized.' });
    try {
        // Return the OPENING_BALANCE entry amounts — after a hard reset,
        // these ARE the total balances.
        const cash = await db.pgGet(
            `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS amount
             FROM cash_ledger
             WHERE company_id = $1 AND source = 'OPENING_BALANCE'`,
            [companyId]
        );
        const bankRow = await db.pgGet(
            `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS amount
             FROM bank_ledger
             WHERE company_id = $1 AND source = 'OPENING_BALANCE'`,
            [companyId]
        );
        res.json({
            cash_opening: parseFloat(cash?.amount || 0),
            bank_openings: [{ bank_name: 'Bank', amount: parseFloat(bankRow?.amount || 0) }]
        });
    } catch (err) {
        console.error('Get opening balance error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /company/opening-balance — set/replace opening balances
// Body: { cash_opening: 50000, bank_openings: [{ bank_detail_id, bank_name, amount }] }
// ─────────────────────────────────────────────
router.post('/opening-balance', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    const branchId = req.user?.branch_id || 1;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized.' });

    const { cash_opening, bank_openings = [] } = req.body;

    try {
        // ── CASH: only replace the OPENING_BALANCE entry — never touch real transactions ──
        const desiredCash = Number(cash_opening) || 0;
        await db.pgRun(`DELETE FROM cash_ledger WHERE company_id = $1 AND source = 'OPENING_BALANCE'`, [companyId]);
        if (desiredCash > 0) {
            await db.pgRun(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1, $2, 'OPENING_BALANCE', $3, 'in', '2000-01-01')`,
                [companyId, branchId, desiredCash]
            );
        }

        // ── BANK: only replace the OPENING_BALANCE entry — never touch real transactions ──
        await db.pgRun(`DELETE FROM bank_ledger WHERE company_id = $1 AND source = 'OPENING_BALANCE'`, [companyId]);
        for (const b of bank_openings) {
            const bankName = b.bank_name || 'Bank';
            const desiredBank = Number(b.amount) || 0;
            if (desiredBank > 0) {
                await db.pgRun(
                    `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                     VALUES ($1, $2, 'OPENING_BALANCE', $3, 'in', $4, '2000-01-01')`,
                    [companyId, branchId, desiredBank, bankName]
                );
            }
            if (b.bank_detail_id) {
                await db.pgRun(
                    `UPDATE bank_details SET opening_balance = $1, current_balance = $1 WHERE id = $2 AND company_id = $3`,
                    [desiredBank, b.bank_detail_id, companyId]
                );
            }
        }

        res.json({ success: true, message: 'Opening balances saved successfully.' });
    } catch (err) {
        console.error('Set opening balance error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🔁 POST /company/rebuild-ledger — Rebuild cash_ledger + bank_ledger from source tables
 * Reconstructs ledger entries from: invoice_payments, purchase_bill_payments,
 * salary payments, daily_salary_payments, loan_payments, sales_returns, transactions
 */
router.post('/rebuild-ledger', authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    const branchId  = req.user?.branch_id || 1;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized.' });

    let inserted = 0;
    try {
        // 1. Invoice payments (cash received from customers)
        const invPay = await db.pgAll(`
            SELECT ip.payment_date AS date, ip.amount, ip.payment_method AS mode, ip.reference_no AS ref
            FROM invoice_payments ip
            JOIN invoices i ON i.id = ip.invoice_id
            WHERE i.company_id = $1
        `, [companyId]);
        for (const r of invPay) {
            const mode = (r.mode || '').toUpperCase();
            const tbl  = mode === 'BANK' || mode === 'ONLINE' || mode === 'UPI' || mode === 'CHEQUE' ? 'bank_ledger' : 'cash_ledger';
            const existing = await db.pgGet(`SELECT id FROM ${tbl} WHERE company_id=$1 AND source='INVOICE_PAYMENT' AND date=$2 AND amount=$3 LIMIT 1`, [companyId, r.date, r.amount]);
            if (!existing) {
                await db.pgRun(`INSERT INTO ${tbl} (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'INVOICE_PAYMENT',$3,'in',$4)`, [companyId, branchId, r.amount, r.date]);
                inserted++;
            }
        }

        // 2. Purchase bill payments (cash paid to suppliers)
        const purPay = await db.pgAll(`
            SELECT payment_date AS date, amount, payment_mode AS mode
            FROM purchase_bill_payments WHERE company_id = $1
        `, [companyId]).catch(() => []);
        for (const r of purPay) {
            const mode = (r.mode || '').toUpperCase();
            const tbl  = mode === 'BANK' || mode === 'ONLINE' || mode === 'UPI' || mode === 'CHEQUE' ? 'bank_ledger' : 'cash_ledger';
            const existing = await db.pgGet(`SELECT id FROM ${tbl} WHERE company_id=$1 AND source='PURCHASE_PAYMENT' AND date=$2 AND amount=$3 LIMIT 1`, [companyId, r.date, r.amount]);
            if (!existing) {
                await db.pgRun(`INSERT INTO ${tbl} (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'PURCHASE_PAYMENT',$3,'out',$4)`, [companyId, branchId, r.amount, r.date]);
                inserted++;
            }
        }

        // 3. Daily salary payments
        const dsp = await db.pgAll(`
            SELECT payment_date AS date, gross_wage AS amount, payment_mode AS mode
            FROM daily_salary_payments WHERE company_id = $1
        `, [companyId]).catch(() => []);
        for (const r of dsp) {
            const existing = await db.pgGet(`SELECT id FROM cash_ledger WHERE company_id=$1 AND source='Daily_wage' AND date=$2 AND amount=$3 LIMIT 1`, [companyId, r.date, r.amount]);
            if (!existing) {
                await db.pgRun(`INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'Daily_wage',$3,'out',$4)`, [companyId, branchId, r.amount, r.date]);
                inserted++;
            }
        }

        // 4. Loan repayments (principal + interest paid out)
        const loanPay = await db.pgAll(`
            SELECT lp.payment_date AS date, lp.total_amount AS amount, lp.payment_mode AS mode
            FROM loan_payments lp
            JOIN loans l ON l.id = lp.loan_id
            WHERE l.company_id = $1
        `, [companyId]).catch(() => []);
        for (const r of loanPay) {
            const existing = await db.pgGet(`SELECT id FROM cash_ledger WHERE company_id=$1 AND source='LOAN_REPAYMENT' AND date=$2 AND amount=$3 LIMIT 1`, [companyId, r.date, r.amount]);
            if (!existing) {
                await db.pgRun(`INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'LOAN_REPAYMENT',$3,'out',$4)`, [companyId, branchId, r.amount, r.date]);
                inserted++;
            }
        }

        // 5. General transactions (MISC_EXPENSE, GIFT_CONTRIBUTION, etc.)
        const txns = await db.pgAll(`
            SELECT date, type AS source, amount, mode
            FROM transactions
            WHERE company_id = $1 AND type NOT IN ('INVOICE','SALARY_PAYMENT','CUSTOMER_PAYMENT')
        `, [companyId]).catch(() => []);
        const INFLOW_TYPES = ['RECEIPT','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'];
        for (const r of txns) {
            const direction = INFLOW_TYPES.includes(r.source) ? 'in' : 'out';
            const mode = (r.mode || '').toUpperCase();
            const tbl  = mode === 'BANK' || mode === 'ONLINE' ? 'bank_ledger' : 'cash_ledger';
            const existing = await db.pgGet(`SELECT id FROM ${tbl} WHERE company_id=$1 AND source=$2 AND date=$3 AND amount=$4 LIMIT 1`, [companyId, r.source, r.date, r.amount]);
            if (!existing) {
                await db.pgRun(`INSERT INTO ${tbl} (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,$3,$4,$5,$6)`, [companyId, branchId, r.source, r.amount, direction, r.date]);
                inserted++;
            }
        }

        // 6. Proprietor account receipts (customers paying into proprietor's personal account)
        const propTxns = await db.pgAll(`
            SELECT transaction_date AS date, amount, transaction_type, notes
            FROM proprietor_transactions
            WHERE company_id = $1
        `, [companyId]).catch(() => []);
        for (const r of propTxns) {
            const direction = r.transaction_type === 'PERSONAL_RECEIPT' ? 'in' : 'out';
            const source    = r.transaction_type === 'PERSONAL_RECEIPT' ? 'PROPRIETOR_RECEIPT' : 'PROPRIETOR_PAYOUT';
            // Proprietor receipts are NOT physical cash/bank — they represent amounts owed via personal account.
            // We add them to cash_ledger with source PROPRIETOR so cash flow reflects them.
            const existing = await db.pgGet(`SELECT id FROM cash_ledger WHERE company_id=$1 AND source=$2 AND date=$3 AND amount=$4 LIMIT 1`, [companyId, source, r.date, r.amount]);
            if (!existing) {
                await db.pgRun(`INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [companyId, branchId, source, r.amount, direction, r.date, r.notes || null]);
                inserted++;
            }
        }

        res.json({ success: true, inserted, message: `Ledger rebuilt — ${inserted} entries restored.` });
    } catch (err) {
        console.error('Rebuild ledger error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🏢 CREATE NEW COMPANY (Global Administration)
 * Only accessible by 'superadmin'
 */
router.post('/', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized. Superadmin only." });
    }

    const { 
        company_name, company_code, admin_email, admin_password,
        plan_name, max_branches, max_users, enabled_modules, expiry_date 
    } = req.body;
    
    if (!company_name || !company_code || !admin_email || !admin_password) {
        return res.status(400).json({ error: "Missing required identity fields." });
    }

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Create Subscription
        const subRes = await client.query(
            `INSERT INTO subscriptions (plan_name, max_branches, max_users, enabled_modules, expiry_date, status) 
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
            [plan_name || 'Standard', max_branches || 1, max_users || 5, enabled_modules || 'sales,finance', expiry_date || null]
        );
        const subscriptionId = subRes.rows[0].id;

        // 2. Create Company
        const compRes = await client.query(
            `INSERT INTO companies (
                company_name, company_code, subscription_id, is_active, 
                financial_year_start_month, default_currency
            ) VALUES ($1, $2, $3, TRUE, 4, 'INR') RETURNING id`,
            [company_name, company_code, subscriptionId]
        );
        const companyId = compRes.rows[0].id;

        // 3. Create Default Branch
        const branchRes = await client.query(
            "INSERT INTO branches (company_id, branch_name, branch_code, is_active) VALUES ($1, 'Main Branch', 'MAIN-01', TRUE) RETURNING id",
            [companyId]
        );
        const branchId = branchRes.rows[0].id;

        // 4. Ensure System Roles Exist (Don't create duplicates)
        const rolesToCreate = ['admin', 'manager', 'staff', 'accountant', 'sales', 'viewer'];
        const roleIds = {};
        
        for (const roleName of rolesToCreate) {
            // Try to insert, ignore if already exists
            await client.query(
                `INSERT INTO roles (name, description, is_system_role) 
                 VALUES ($1, $2, TRUE) 
                 ON CONFLICT (name) DO NOTHING`,
                [roleName, `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} Role`]
            );
            
            // Fetch the role ID (whether we created it or it already exists)
            const roleRes = await client.query(
                `SELECT id FROM roles WHERE name = $1`,
                [roleName]
            );
            if (roleRes.rows.length > 0) {
                roleIds[roleName] = roleRes.rows[0].id;
            }
        }

        // 5. Ensure System Permissions Exist (Don't create duplicates)
        const ALL_PERMS = [
            { module: 'Sales', action: 'view_customers', description: 'View Customers List' },
            { module: 'Sales', action: 'manage_customers', description: 'Add/Edit Customers' },
            { module: 'Sales', action: 'view_invoices', description: 'View Invoices' },
            { module: 'Sales', action: 'create_invoices', description: 'Create Invoices' },
            { module: 'Sales', action: 'edit_invoices', description: 'Edit Invoices' },
            { module: 'Sales', action: 'delete_invoices', description: 'Delete Invoices' },
            { module: 'Purchases', action: 'view_bills', description: 'View Purchase Bills' },
            { module: 'Purchases', action: 'create_bills', description: 'Record Purchase Bills' },
            { module: 'Inventory', action: 'view_products', description: 'View Inventory' },
            { module: 'Inventory', action: 'manage_stock', description: 'Add/Edit Products' },
            { module: 'Finance', action: 'view_ledger', description: 'View Ledgers & Transactions' },
            { module: 'Finance', action: 'manage_transactions', description: 'Record Journal/Receipts' },
            { module: 'HR', action: 'view_employees', description: 'View Employee List' },
            { module: 'HR', action: 'manage_employees', description: 'Add/Edit Employees' },
            { module: 'Settings', action: 'access_settings', description: 'Access System Settings' }
        ];

        const permissionIds = {};
        for (const perm of ALL_PERMS) {
            // Insert and ignore if already exists
            await client.query(
                `INSERT INTO permissions (module, action, description) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (module, action) DO NOTHING`,
                [perm.module, perm.action, perm.description]
            );
            
            // Fetch the permission ID (whether we created it or it already exists)
            const permRes = await client.query(
                `SELECT id FROM permissions WHERE module = $1 AND action = $2`,
                [perm.module, perm.action]
            );
            if (permRes.rows.length > 0) {
                const key = `${perm.module}:${perm.action}`;
                permissionIds[key] = permRes.rows[0].id;
            }
        }

        // 6. Assign All Permissions to Admin Role (Idempotent)
        const adminRoleId = roleIds['admin'];
        if (adminRoleId) {
            for (const [key, permId] of Object.entries(permissionIds)) {
                await client.query(
                    `INSERT INTO role_permissions (role_id, permission_id) 
                     VALUES ($1, $2) 
                     ON CONFLICT DO NOTHING`,
                    [adminRoleId, permId]
                );
            }
        }

        // 7. Create Admin User
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.default.hash(admin_password, 10);
        
        await client.query(
            `INSERT INTO users (company_id, branch_id, active_company_id, username, email, password_hash, role, is_active) 
             VALUES ($1, $2, $1, $3, $4, $5, 'admin', TRUE)`,
            [companyId, branchId, admin_email.split('@')[0], admin_email, hashedPassword]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, company_id: companyId, company_code });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Onboarding Transaction Failed:", error);
        res.status(500).json({ error: "Failed to provision new tenant environment." });
    } finally {
        if (client) client.release();
    }
});

/**
 * 🔐 VIEW TENANT CREDENTIALS (Superadmin only)
 */
router.get('/credentials/:id', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized. Superadmin only." });
    }

    const { id } = req.params;

    try {
        const company = await db.pgGet('SELECT company_name, company_code FROM companies WHERE id = $1', [id]);
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        // Find the first admin user for this company
        const admin = await db.pgGet('SELECT email, username FROM users WHERE company_id = $1 AND role = $2 LIMIT 1', [id, 'admin']);

        res.json({
            company_name: company.company_name,
            company_code: company.company_code,
            admin_email: admin?.email || 'N/A',
            admin_username: admin?.username || 'N/A',
            suggested_password: 'Admin@123' // Platform standard reset password
        });
    } catch (error) {
        console.error("Error fetching tenant credentials:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * 🗑️ DELETE TENANT (Global Administration)
 * Only accessible by 'superadmin'
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized. Superadmin only." });
    }

    const { id } = req.params;
    let client;

    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Get Subscription ID before deleting company
        const companyRes = await client.query('SELECT subscription_id FROM companies WHERE id = $1', [id]);
        if (companyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Company not found." });
        }
        const subscriptionId = companyRes.rows[0].subscription_id;

        // --- CASCADE DELETE ALL DEPENDENT DATA ---
        // We delete in reverse order of dependencies to avoid foreign key violations
        
        // 2. Finance & Transactions
        await client.query('DELETE FROM transaction_lines WHERE transaction_id IN (SELECT id FROM transactions WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM ledger_entries WHERE company_id = $1', [id]);
        await client.query('DELETE FROM transactions WHERE company_id = $1', [id]);
        await client.query('DELETE FROM ledgers WHERE company_id = $1', [id]);
        await client.query('DELETE FROM ledger_groups WHERE company_id = $1', [id]);
        await client.query('DELETE FROM chart_of_accounts WHERE company_id = $1', [id]);
        
        // 3. Sales & Purchases
        await client.query('DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM invoices WHERE company_id = $1', [id]);
        await client.query('DELETE FROM purchase_bill_items WHERE bill_id IN (SELECT id FROM purchase_bills WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM purchase_bills WHERE company_id = $1', [id]);
        
        // 4. Products & Inventory
        await client.query('DELETE FROM product_suppliers WHERE product_id IN (SELECT id FROM products WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM products WHERE company_id = $1', [id]);
        await client.query('DELETE FROM stock_units WHERE company_id = $1', [id]);
        
        // 5. HR & Payroll
        await client.query('DELETE FROM attendance_logs WHERE company_id = $1', [id]);
        await client.query('DELETE FROM payroll_runs WHERE company_id = $1', [id]);
        await client.query('DELETE FROM advance_repayments WHERE advance_id IN (SELECT id FROM salary_advances WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM salary_advances WHERE company_id = $1', [id]);
        await client.query('DELETE FROM employees WHERE company_id = $1', [id]);
        
        // 6. Others
        await client.query('DELETE FROM bank_details WHERE company_id = $1', [id]);
        await client.query('DELETE FROM business_agreements WHERE company_id = $1', [id]);
        await client.query('DELETE FROM constraint_actions WHERE company_id = $1', [id]);
        await client.query('DELETE FROM constraints WHERE company_id = $1', [id]);
        await client.query('DELETE FROM throughput_metrics WHERE company_id = $1', [id]);
        await client.query('DELETE FROM audit_log WHERE entity_id = $1 AND entity_type = \'company\'', [id]);
        
        // 7. Core Identity (Users, Branches, Company, Subs)
        await client.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM user_companies WHERE company_id = $1', [id]);
        await client.query('DELETE FROM users WHERE company_id = $1', [id]);
        await client.query('DELETE FROM branches WHERE company_id = $1', [id]);
        await client.query('DELETE FROM companies WHERE id = $1', [id]);

        if (subscriptionId) {
            await client.query('DELETE FROM subscriptions WHERE id = $1', [subscriptionId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Tenant and all associated data deleted successfully." });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Tenant Deletion Failed:", error);
        res.status(500).json({ error: "Failed to delete tenant. Data may be linked to other records." });
    } finally {
        if (client) client.release();
    }
});

// ✅ THIS IS THE CRITICAL FIX: EXPORT AS DEFAULT
export default router;