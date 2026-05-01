// backend/routes/branchRoutes.js
import express from 'express';
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
        branch_name, branch_code, location, 
        address_line1, city_pincode, state, state_code,
        manager_user_id 
    } = req.body;

    if (!branch_name) return res.status(400).json({ error: "Branch name is required." });

    try {
        const sql = `
            INSERT INTO branches (
                company_id, branch_name, branch_code, location, 
                address_line1, city_pincode, state, state_code,
                manager_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `;
        const result = await db.pgRun(sql, [
            companyId, branch_name, branch_code, location, 
            address_line1, city_pincode, state, state_code,
            manager_user_id
        ]);
        res.status(201).json({ id: result.rows[0].id, message: "Branch created successfully." });
    } catch (error) {
        console.error("Error creating branch:", error);
        res.status(500).json({ error: "Failed to create branch." });
    }
});

// PUT update branch info
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.company_id || req.user?.active_company_id;
    const { 
        branch_name, branch_code, location, 
        address_line1, city_pincode, state, state_code,
        manager_user_id, is_active 
    } = req.body;

    try {
        const sql = `
            UPDATE branches 
            SET branch_name = $1, branch_code = $2, location = $3, 
                address_line1 = $4, city_pincode = $5, state = $6, state_code = $7,
                manager_user_id = $8, is_active = $9
            WHERE id = $10 AND company_id = $11
        `;
        const result = await db.pgRun(sql, [
            branch_name, branch_code, location, 
            address_line1, city_pincode, state, state_code,
            manager_user_id, is_active, id, companyId
        ]);
        
        if (result.rowCount === 0) return res.status(404).json({ error: "Branch not found or unauthorized." });
        
        res.json({ message: "Branch updated successfully." });
    } catch (error) {
        console.error("Error updating branch:", error);
        res.status(500).json({ error: "Failed to update branch." });
    }
});

export default router;
