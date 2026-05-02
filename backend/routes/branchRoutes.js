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
        const branches = await db.pgAll('SELECT * FROM branches WHERE company_id = $1 ORDER BY created_at DESC', [companyId]);
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

    try {
        await db.pgRun("BEGIN");
        
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
        const result = await db.pgRun(sql, [
            companyId, branch_name, branch_code, branch_type, is_active ?? true,
            address_line1, address_line2, city, pincode, state, country,
            branch_phone, branch_email, whatsapp_number,
            manager_name, manager_phone, manager_email, manager_whatsapp,
            gstin, bill_prefix, default_payment_mode, opening_cash_balance,
            city + " - " + pincode
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
            const userRole = access_level === 'Branch Staff' ? 'staff' : 'manager'; // Map as needed
            const userRes = await db.pgRun(userSql, [
                companyId, manager_name || branch_name, login_email, hashedPwd, userRole, newBranchId
            ]);
            newUserId = userRes.rows[0].id;
            
            // Link manager_user_id to branch
            await db.pgRun("UPDATE branches SET manager_user_id = $1 WHERE id = $2", [newUserId, newBranchId]);
        }

        // 3. Create Cash Account in Ledger for Opening Balance
        if (opening_cash_balance && Number(opening_cash_balance) > 0) {
            // Find Cash-in-Hand group
            const groupRes = await db.pgGet("SELECT id FROM ledger_groups WHERE name = 'Cash-in-Hand' AND company_id = $1", [companyId]);
            let groupId = groupRes ? groupRes.id : null;
            
            if (groupId) {
                const ledgerSql = `
                    INSERT INTO ledgers (company_id, branch_id, group_id, name, opening_balance, balance_type)
                    VALUES ($1, $2, $3, $4, $5, 'Dr')
                `;
                await db.pgRun(ledgerSql, [companyId, newBranchId, groupId, `Cash A/c - ${branch_code}`, opening_cash_balance]);
            }
        }

        await db.pgRun("COMMIT");
        res.status(201).json({ id: newBranchId, message: "Branch created successfully." });
    } catch (error) {
        await db.pgRun("ROLLBACK");
        console.error("Error creating branch:", error);
        res.status(500).json({ error: "Failed to create branch." });
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
        gstin, bill_prefix, default_payment_mode, opening_cash_balance
    } = req.body;

    try {
        const sql = `
            UPDATE branches 
            SET branch_name = $1, branch_type = $2, is_active = $3,
                address_line1 = $4, address_line2 = $5, city = $6, pincode = $7, state = $8, country = $9,
                branch_phone = $10, branch_email = $11, whatsapp_number = $12,
                manager_name = $13, manager_phone = $14, manager_email = $15, manager_whatsapp = $16,
                gstin = $17, bill_prefix = $18, default_payment_mode = $19, opening_cash_balance = $20,
                city_pincode = $21
            WHERE id = $22 AND company_id = $23
        `;
        const result = await db.pgRun(sql, [
            branch_name, branch_type, is_active,
            address_line1, address_line2, city, pincode, state, country,
            branch_phone, branch_email, whatsapp_number,
            manager_name, manager_phone, manager_email, manager_whatsapp,
            gstin, bill_prefix, default_payment_mode, opening_cash_balance,
            city + " - " + pincode,
            id, companyId
        ]);
        
        if (result.rowCount === 0) return res.status(404).json({ error: "Branch not found or unauthorized." });
        
        res.json({ message: "Branch updated successfully." });
    } catch (error) {
        console.error("Error updating branch:", error);
        res.status(500).json({ error: "Failed to update branch." });
    }
});

export default router;
