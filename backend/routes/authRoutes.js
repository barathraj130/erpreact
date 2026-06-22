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
   0. VERIFY TOKEN (For SystemTester)
   ============================================================ */
router.get("/verify", (req, res) => {
    // If it reaches here, the middleware passed (or we can add middleware here)
    res.json({ success: true, message: "Token is valid" });
});

// Public — returns the single active company's code so branch-login can auto-fill it
router.get("/company", async (req, res) => {
    try {
        const company = await db.pgGet(
            `SELECT company_name, company_code FROM companies WHERE is_active = TRUE ORDER BY id ASC LIMIT 1`
        );
        if (!company) return res.status(404).json({ error: "No active company" });
        res.json({ company_name: company.company_name, company_code: company.company_code });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        const user = await authService.authenticateUser(company_code?.trim(), email?.trim(), password);
        
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
   1D. DEMO LOGIN — one-click guest access for customer demos
============================================================ */
router.post("/demo-login", async (req, res) => {
    try {
        const DEMO_USERNAME     = "demo";
        const DEMO_EMAIL        = "demo@erpdemo.com";
        const DEMO_COMPANY_NAME = "Demo Company";
        const DEMO_COMPANY_CODE = "DEMO";

        // Find or create the isolated demo company (no real data)
        let demoCompany = await db.pgGet(
            `SELECT id FROM companies WHERE company_code = $1`, [DEMO_COMPANY_CODE]
        );
        if (!demoCompany) {
            demoCompany = await db.pgGet(
                `INSERT INTO companies (company_name, company_code, is_active, status)
                 VALUES ($1, $2, true, 'ACTIVE') RETURNING id`,
                [DEMO_COMPANY_NAME, DEMO_COMPANY_CODE]
            );
        }
        const companyId = demoCompany.id;

        // Find or create demo user — look up by email to avoid username unique-constraint conflicts
        let demoUser = await db.pgGet(
            `SELECT * FROM users WHERE email = $1`,
            [DEMO_EMAIL]
        );
        if (!demoUser) {
            const hash = await bcrypt.hash("Demo@1234", 10);
            // Use company-scoped username (e.g. "demo_7") to avoid clashing with any existing "demo" user
            const scopedUsername = `demo_${companyId}`;
            demoUser = await db.pgGet(
                `INSERT INTO users (username, email, password_hash, role, company_id, active_company_id, is_active)
                 VALUES ($1, $2, $3, 'admin', $4, $4, true)
                 ON CONFLICT (username) DO UPDATE SET active_company_id = EXCLUDED.active_company_id
                 RETURNING *`,
                [scopedUsername, DEMO_EMAIL, hash, companyId]
            );
        }

        const tokenPayload = {
            user: {
                id:                  demoUser.id,
                username:            DEMO_USERNAME,
                email:               DEMO_EMAIL,
                role:                "admin",
                company_id:          companyId,
                active_company_id:   companyId,
                branch_id:           null,
                subscription_status: "active",
                enabled_modules:     "sales,purchase,inventory,finance,hr,reports",
                permissions:         []
            }
        };

        const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "2h" });
        res.json({ success: true, token, user: tokenPayload.user });
    } catch (err) {
        console.error("Demo login error:", err.message);
        res.status(500).json({ error: "Demo login failed: " + err.message });
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
            const user = decoded.user;

            // --- MANAGER LEDGER CLOSURE CHECK ---
            if (user.role === 'manager' || user.role === 'admin') {
                const currentHour = new Date().getHours();
                
                // Only enforce ledger closure after 6 PM (18:00)
                if (currentHour >= 18) {
                    const today = new Date().toISOString().split('T')[0];
                    const closingCheck = await db.pgGet(`
                        SELECT 1 FROM daily_ledger_closings 
                        WHERE company_id = $1 AND branch_id = $2 AND closing_date = $3
                    `, [user.company_id, user.branch_id || 1, today]);

                    if (!closingCheck && !req.body.force) {
                        return res.status(200).json({ 
                            success: false, 
                            needs_closure: true, 
                            message: "It's after 6 PM and the daily ledger has not been closed yet. Would you like to close it before logging out?" 
                        });
                    }
                }
            }

            await logAction({
                user_id: user.id,
                company_id: user.company_id,
                module: "AUTH",
                action: "LOGOUT",
                resource_type: "session",
                resource_id: user.id,
                status: "success"
            });
        }

        res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        console.error("Logout Error:", err);
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
        // COALESCE ensures users with null active_company_id still get their company + modules
        const user = await db.pgGet(`
            SELECT 
                u.id, u.username, u.email, u.role, u.active_company_id, u.company_id, u.signature_url,
                c.company_name, c.company_code,
                s.enabled_modules, s.status as subscription_status
            FROM users u
            JOIN companies c ON c.id = COALESCE(u.active_company_id, u.company_id)
            LEFT JOIN subscriptions s ON c.subscription_id = s.id
            WHERE u.id = $1
        `, [decoded.user.id]);

        if (!user) return res.status(404).json({ error: "User not found" });

        // 2. FETCH PERMISSIONS (With Strict DB check + Fallback)
        let permissions = [];
        
        try {
            // 1. Get Base Role Permissions
            const rolePermissions = await db.pgAll(`
                SELECT p.module, p.action, p.id
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN roles r ON rp.role_id = r.id
                WHERE LOWER(r.name) = LOWER($1)
            `, [user.role]);

            // 2. Get User-Specific Overrides
            const userOverrides = await db.pgAll(`
                SELECT p.module, p.action, p.id, up.is_granted
                FROM permissions p
                JOIN user_permissions up ON p.id = up.permission_id
                WHERE up.user_id = $1
            `, [user.id]);

            // 3. Merge Strategy
            let permissionMap = new Map();
            
            // Add Role Permissions
            rolePermissions.forEach(p => {
                permissionMap.set(`${p.module}:${p.action}`, p);
            });

            // Apply Overrides
            userOverrides.forEach(ov => {
                const key = `${ov.module}:${ov.action}`;
                if (ov.is_granted) {
                    permissionMap.set(key, { module: ov.module, action: ov.action, id: ov.id });
                } else {
                    permissionMap.delete(key);
                }
            });

            permissions = Array.from(permissionMap.values());

        } catch (dbErr) {
            console.warn("⚠️ DB Permission Check Failed. Using Fallback.");
        }

        // --- 3. HARDCODED FALLBACK (If DB fails or is empty) ---
        if (!permissions || permissions.length === 0) {
            const roleKey = user.role ? user.role.toLowerCase() : 'user';
            
            if (roleKey === 'admin') {
                // Admin gets ALL permissions
                permissions = [
                    { module: 'Sales', action: 'view_customers' },
                    { module: 'Sales', action: 'manage_customers' },
                    { module: 'Sales', action: 'view_invoices' },
                    { module: 'Sales', action: 'create_invoices' },
                    { module: 'Sales', action: 'edit_invoices' },
                    { module: 'Sales', action: 'delete_invoices' },
                    { module: 'Purchases', action: 'view_bills' },
                    { module: 'Purchases', action: 'create_bills' },
                    { module: 'Inventory', action: 'view_products' },
                    { module: 'Inventory', action: 'manage_stock' },
                    { module: 'Finance', action: 'view_ledger' },
                    { module: 'Finance', action: 'manage_transactions' },
                    { module: 'HR', action: 'view_employees' },
                    { module: 'HR', action: 'manage_employees' },
                    { module: 'Settings', action: 'access_settings' }
                ];
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