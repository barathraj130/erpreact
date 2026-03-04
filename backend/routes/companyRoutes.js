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
        company_name, gstin, address_line1, city_pincode, state, phone, email,
        bank_name, bank_account_no, bank_ifsc_code 
    } = req.body;

    try {
        const sql = `
            UPDATE companies 
            SET company_name = $1, gstin = $2, address_line1 = $3, city_pincode = $4, 
                state = $5, phone = $6, email = $7, 
                bank_name = $8, bank_account_no = $9, bank_ifsc_code = $10
            WHERE id = $11
        `;
        
        await db.pgRun(sql, [
            company_name, gstin, address_line1, city_pincode, state, phone, email,
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
    
    const { bank_name, account_number, ifsc_code, account_type, is_default } = req.body;

    if (!bank_name || !account_number) {
        return res.status(400).json({ error: "Bank name and account number are required." });
    }
    
    const sql = `
        INSERT INTO bank_details (company_id, bank_name, account_number, ifsc_code, account_type, is_default)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `;
    
    try {
        const result = await db.pgRun(sql, [companyId, bank_name, account_number, ifsc_code, account_type, is_default || false]);
        // pgRun returns { rowCount, rows }, get ID from rows[0]
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
            "INSERT INTO companies (company_name, company_code, subscription_id, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id",
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

// ✅ THIS IS THE CRITICAL FIX: EXPORT AS DEFAULT
export default router;