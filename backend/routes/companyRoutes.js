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

// ✅ THIS IS THE CRITICAL FIX: EXPORT AS DEFAULT
export default router;