// backend/routes/authRoutes.js
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/jwtConfig.js";
import * as db from "../database/pg.js";

const router = express.Router();

/* ============================================================
   1. LOGIN ROUTE
============================================================ */
router.post("/login", async (req, res) => {
    const { email, password } = req.body; 
    console.log(`🔹 Login Attempt: ${email}`);

    try {
        // Case-insensitive User Lookup
        const user = await db.pgGet(
            "SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)",
            [email]
        );

        if (!user) {
            console.log("❌ User not found in DB");
            return res.status(401).json({ error: "User not found." });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log("❌ Password incorrect");
            return res.status(401).json({ error: "Invalid password." });
        }

        // Force active_company_id if missing (Self-Healing)
        const activeCompany = user.active_company_id || 1;

        const token = jwt.sign(
            { 
                user: { 
                    id: user.id, 
                    email: user.email, 
                    role: user.role, 
                    active_company_id: activeCompany 
                } 
            },
            jwtSecret,
            { expiresIn: "24h" }
        );

        console.log(`✅ User ${user.username} logged in successfully.`);
        res.json({ success: true, token });

    } catch (err) {
        console.error("❌ Login Critical Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* ============================================================
   2. SIGNUP ROUTE (Optional)
============================================================ */
router.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const exists = await db.pgGet("SELECT id FROM users WHERE email = $1", [email]);
        if (exists) return res.status(400).json({ error: "User exists" });

        const hashed = await bcrypt.hash(password, 10);
        
        await db.pgRun(
            `INSERT INTO users (username, email, password_hash, role, active_company_id)
             VALUES ($1, $2, $3, 'user', 1) RETURNING id`,
            [username, email, hashed]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: "Signup failed" });
    }
});

/* ============================================================
   3. GET CURRENT USER (/me)
============================================================ */
router.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No Token" });

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, jwtSecret);
        
        // 1. Fetch User
        const user = await db.pgGet(
            "SELECT id, username, email, role, active_company_id, signature_url FROM users WHERE id = $1",
            [decoded.user.id]
        );

        if (!user) return res.status(404).json({ error: "User not found" });

        // 2. FETCH PERMISSIONS (With Strict DB check + Fallback)
        let permissions = [];
        
        try {
            permissions = await db.pgAll(`
                SELECT p.module, p.action 
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN roles r ON rp.role_id = r.id
                WHERE LOWER(r.name) = LOWER($1)
            `, [user.role]);
        } catch (dbErr) {
            console.warn("⚠️ DB Permission Check Failed. Using Fallback.");
        }

        // --- 3. HARDCODED FALLBACK (If DB fails or is empty) ---
        if (!permissions || permissions.length === 0) {
            const roleKey = user.role ? user.role.toLowerCase() : 'user';
            
            if (roleKey === 'admin') {
                permissions = [{ action: 'access_settings' }, { action: 'view_invoices' }];
            } 
            else if (roleKey === 'manager') {
                permissions = [
                    { module: 'Sales', action: 'view_invoices' },
                    { module: 'Sales', action: 'create_invoices' },
                    { module: 'Sales', action: 'edit_invoices' },
                    { module: 'Sales', action: 'delete_invoices' },
                    { module: 'Purchases', action: 'view_bills' },
                    { module: 'Purchases', action: 'create_bills' },
                    { module: 'Inventory', action: 'view_products' },
                    { module: 'Inventory', action: 'manage_stock' },
                    { module: 'Finance', action: 'view_ledger' },
                    { module: 'HR', action: 'view_employees' },
                    { module: 'HR', action: 'manage_employees' }
                ];
            }
            else if (roleKey === 'staff') {
                permissions = [
                    { module: 'Sales', action: 'view_invoices' },
                    { module: 'Sales', action: 'create_invoices' },
                    { module: 'Inventory', action: 'view_products' }
                ];
            }
            // ✅ CUSTOMER / USER ROLE PERMISSIONS
            else if (roleKey === 'user' || roleKey === 'customer') {
                permissions = [
                    { module: 'Inventory', action: 'view_products' }, // See catalog
                    { module: 'Sales', action: 'view_invoices' }      // See own orders
                ];
            }
        }

        res.json({ ...user, permissions });

    } catch (err) {
        console.error("❌ Auth /me Error:", err.message);
        return res.status(401).json({ error: "Invalid Token" });
    }
});

export default router;