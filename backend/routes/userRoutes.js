// backend/routes/userRoutes.js
import bcrypt from "bcryptjs";
import express from "express";
import * as db from "../database/pg.js";
import checkPermission from "../middlewares/checkPermission.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/* ============================================================
   STAFF MANAGEMENT (Settings > Users)
   - Only Admins or those with 'access_settings' can manage staff
============================================================ */

// GET SYSTEM USERS (Staff/Admins) - Linked with HR Data
router.get("/staff", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.role, 
                u.created_at,
                u.employee_id,
                e.name as employee_name,
                e.designation as employee_designation
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.role IN ('admin', 'staff', 'manager') 
            ORDER BY u.id ASC
        `;
        const staff = await db.pgAll(sql);
        res.json(staff);
    } catch (err) {
        console.error("Fetch staff error:", err);
        res.status(500).json({ error: "Failed to fetch staff" });
    }
});

// CREATE STAFF LOGIN (Links to Employee ID)
router.post("/staff", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const { username, password, role, employee_id } = req.body;
    
    if(!username || !password || !role) 
        return res.status(400).json({ error: "Username, Password, and Role are required." });

    try {
        const hashed = await bcrypt.hash(password, 10);

        // Fetch the email from the employee record automatically if linked
        let emailToUse = null;
        if (employee_id) {
            const emp = await db.pgGet("SELECT email FROM employees WHERE id = $1", [employee_id]);
            if (emp) emailToUse = emp.email;
        }

        // Insert User with active_company_id = 1
        await db.pgRun(
            `INSERT INTO users (username, email, password_hash, role, employee_id, active_company_id)
             VALUES ($1, $2, $3, $4, $5, 1)`,
            [username, emailToUse, hashed, role, employee_id || null]
        );
        res.json({ success: true, message: "Login created successfully" });
    } catch (err) {
        console.error("Create staff error:", err);
        res.status(500).json({ error: "Username already taken or database error." });
    }
});

/* ============================================================
   CUSTOMER MANAGEMENT (Sales > Customers)
   - Accessed by Sales staff
   - Includes Password Creation for Customer Portal
============================================================ */

// GET ALL CUSTOMERS
router.get("/", authMiddleware, checkPermission("Sales", "view_invoices"), async (req, res) => {
    try {
        const users = await db.pgAll(`
            SELECT 
                id, username, nickname, email, phone, role, gstin, 
                address_line1, city_pincode, state, state_code,
                initial_balance, COALESCE(initial_balance, 0) as remaining_balance, 
                bank_name, bank_account_no, bank_ifsc_code, created_at
            FROM users 
            WHERE role IN ('user', 'customer') 
            ORDER BY id ASC
        `);
        res.json(users);
    } catch (err) {
        console.error("Fetch customers error:", err);
        res.status(500).json({ error: "Error fetching customers" });
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

    try {
        let password_hash = null;
        
        // If admin sets a password, hash it so customer can login
        if (password && password.trim() !== "") {
            password_hash = await bcrypt.hash(password, 10);
        }

        const result = await db.pgRun(
            `INSERT INTO users (
                username, nickname, email, phone, gstin, 
                address_line1, city_pincode, state, state_code, 
                bank_name, bank_account_no, bank_ifsc_code,
                initial_balance, role, active_company_id,
                password_hash  -- ✅ Storing hash
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'user', $14, $15)
             RETURNING id`,
            [
                username, nickname || null, email || null, phone || null, gstin || null,
                address_line1 || null, city_pincode || null, state || null, state_code || null,
                bank_name || null, bank_account_no || null, bank_ifsc_code || null,
                opening_balance || 0,
                req.user.active_company_id,
                password_hash // ✅ Value
            ]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("Create customer error:", err);
        res.status(500).json({ error: "Failed to create customer" });
    }
});

// UPDATE CUSTOMER
router.put("/:id", authMiddleware, checkPermission("Sales", "edit_invoices"), async (req, res) => {
    const { 
        username, nickname, email, phone, gstin, 
        address_line1, city_pincode, state, state_code,
        bank_name, bank_account_no, bank_ifsc_code,
        password // ✅ Optional Password Reset
    } = req.body;

    try {
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

        await db.pgRun(sql, params);
        res.json({ success: true });
    } catch (err) {
        console.error("Update customer error:", err);
        res.status(500).json({ error: "Failed to update customer" });
    }
});

// DELETE USER (Customer or Staff)
router.delete("/:id", authMiddleware, checkPermission("Sales", "delete_invoices"), async (req, res) => {
    try {
        await db.pgRun(`DELETE FROM users WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

export default router;