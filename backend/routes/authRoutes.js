// backend/routes/authRoutes.js
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/jwtConfig.js";
import * as db from "../database/pg.js";
import { loginLimiter } from "../middlewares/rateLimitMiddleware.js";
import { logAction } from "../services/auditLogService.js";
import * as authService from "../services/authService.js";

const router = express.Router();

/* ============================================================
   1. LOGIN ROUTE
============================================================ */
/* ============================================================
   1. LOGIN ROUTE (MULTI-TENANT)
============================================================ */
router.post("/login", loginLimiter, async (req, res) => {
    const { company_code, email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`🔹 Login Attempt: ${email} for Company: ${company_code}`);

    try {
        // Authenticate user
        const user = await authService.authenticateUser(company_code, email, password);
        
        // Generate tokens
        const { accessToken, refreshToken } = authService.generateTokens(user);

        // Store refresh token in database
        await db.pgRun(
            `INSERT INTO refresh_tokens (user_id, token, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
            [user.id, refreshToken]
        );

        // Log successful login
        await logAction({
            user_id: user.id,
            company_id: user.company_id,
            module: "AUTH",
            action: "LOGIN",
            resource_type: "session",
            resource_id: user.id,
            status: "success",
            ip_address: ip
        });

        console.log(`✅ User ${user.username} logged in successfully for ${user.company_name}`);
        
        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                name: user.username,
                email: user.email,
                role: user.role,
                company: user.company_name,
                permissions: user.permissions
            },
            token: accessToken // 👈 For compatibility with Login.tsx
        });

    } catch (err) {
        console.error("❌ Login Error:", err.message);
        
        // Log failed login
        await logAction({
            user_id: null,
            company_id: null,
            module: "AUTH",
            action: "LOGIN_FAILED",
            resource_type: "session",
            resource_id: null,
            status: "error",
            ip_address: ip,
            error_message: err.message
        }).catch(() => {}); // Ignore logging errors

        const statusCode = err.code === "SUBSCRIPTION_EXPIRED" ? 403 : 
                          err.code === "ACCOUNT_LOCKED" ? 423 : 401;
        
        res.status(statusCode).json({
            error: err.message,
            code: err.code,
            attemptsLeft: err.attemptsLeft,
            minutesLeft: err.minutesLeft
        });
    }
});

/* ============================================================
   1B. REFRESH TOKEN ROUTE
============================================================ */
router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
    }

    try {
        const newAccessToken = authService.refreshAccessToken(refreshToken);
        res.json({ success: true, accessToken: newAccessToken });
    } catch (err) {
        console.error("❌ Refresh token error:", err.message);
        res.status(401).json({ error: "Invalid or expired refresh token" });
    }
});

/* ============================================================
   1C. LOGOUT ROUTE
============================================================ */
router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    try {
        if (refreshToken) {
            // Invalidate refresh token
            await db.pgRun("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
        }

        const token = authHeader?.split(" ")[1];
        if (token) {
            const decoded = jwt.verify(token, jwtSecret);
            await logAction({
                user_id: decoded.user.id,
                company_id: decoded.user.company_id,
                module: "AUTH",
                action: "LOGOUT",
                resource_type: "session",
                resource_id: decoded.user.id,
                status: "success"
            });
        }

        res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        res.json({ success: true, message: "Logout complete" });
    }
});
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
        
        // 1. Fetch User with Company and Subscription Context
        const user = await db.pgGet(`
            SELECT 
                u.id, u.username, u.email, u.role, u.active_company_id, u.signature_url,
                c.company_name, c.company_code,
                s.enabled_modules, s.status as subscription_status
            FROM users u
            JOIN companies c ON u.active_company_id = c.id
            LEFT JOIN subscriptions s ON c.subscription_id = s.id
            WHERE u.id = $1
        `, [decoded.user.id]);

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