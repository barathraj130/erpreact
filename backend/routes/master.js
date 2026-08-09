// backend/routes/master.js
// Fluxora Master Control Panel — a platform-level admin surface, completely
// separate from tenant auth. Deliberately its own credential table
// (fluxora_master_users) and JWT secret so it doesn't depend on, or share any
// attack surface with, the regular users/role='admin' system.
//
// This schema has no separate "tenants" table — a company (companies table,
// linked to a subscriptions row via companies.subscription_id) IS the tenant
// here, exactly as established when the storefront feature was built.
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as db from "../database/pg.js";
import { jwtSecret } from "../config/jwtConfig.js";

const router = express.Router();
const MASTER_SECRET = process.env.MASTER_JWT_SECRET || "fluxora_master_2026_barath_secret_key";

let schemaEnsured = false;
async function ensureMasterSchema() {
    if (schemaEnsured) return;

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS fluxora_master_users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            email VARCHAR(200) UNIQUE NOT NULL,
            password_hash VARCHAR(500) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            last_login TIMESTAMP,
            login_ip VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS master_audit_log (
            id SERIAL PRIMARY KEY,
            master_user_id INTEGER REFERENCES fluxora_master_users(id),
            action VARCHAR(100) NOT NULL,
            target_type VARCHAR(50),
            target_id INTEGER,
            target_name VARCHAR(200),
            details JSONB,
            ip_address VARCHAR(50),
            user_agent VARCHAR(500),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS master_announcements (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info','warning','success','danger','maintenance')),
            show_to_all_companies BOOLEAN DEFAULT true,
            specific_company_ids INTEGER[],
            is_active BOOLEAN DEFAULT true,
            expires_at TIMESTAMP,
            created_by INTEGER REFERENCES fluxora_master_users(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS master_impersonate_log (
            id SERIAL PRIMARY KEY,
            master_user_id INTEGER REFERENCES fluxora_master_users(id),
            company_id INTEGER REFERENCES companies(id),
            company_name VARCHAR(200),
            impersonated_at TIMESTAMP DEFAULT NOW(),
            ended_at TIMESTAMP,
            ip_address VARCHAR(50)
        )
    `).catch(() => {});

    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS system_health_log (
            id SERIAL PRIMARY KEY,
            check_type VARCHAR(50),
            status VARCHAR(20),
            response_time_ms INTEGER,
            details JSONB,
            checked_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});

    const companyAlters = [
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_reason TEXT`,
        `ALTER TABLE companies ADD COLUMN IF NOT EXISTS internal_notes TEXT`,
    ];
    for (const sql of companyAlters) await db.pgRun(sql).catch(() => {});

    await db.pgRun(`ALTER TABLE users ADD COLUMN IF NOT EXISTS impersonated_by INTEGER`).catch(() => {});
    await db.pgRun(`ALTER TABLE users ADD COLUMN IF NOT EXISTS impersonation_expires_at TIMESTAMP`).catch(() => {});

    schemaEnsured = true;
}

const requireMaster = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) return res.status(401).json({ error: "No token" });

        const decoded = jwt.verify(token, MASTER_SECRET);
        if (!decoded.is_master) return res.status(403).json({ error: "Not a master session" });

        const master = await db.pgGet(`SELECT * FROM fluxora_master_users WHERE id = $1 AND is_active = true`, [decoded.id]);
        if (!master) return res.status(403).json({ error: "Master user not found or inactive" });

        req.master = master;
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid master token" });
    }
};

const logAction = (masterId, action, targetType, targetId, targetName, details, ip) =>
    db.pgRun(
        `INSERT INTO master_audit_log (master_user_id, action, target_type, target_id, target_name, details, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [masterId, action, targetType || null, targetId || null, targetName || null, JSON.stringify(details || {}), ip || null]
    ).catch(() => {});

// ── POST /api/master/login ──────────────────────────────────────────────────
router.post("/login", async (req, res) => {
    try {
        await ensureMasterSchema();
        const { email, password } = req.body;
        if (!email || !password) return res.json({ success: false, error: "Email and password required" });

        const master = await db.pgGet(`SELECT * FROM fluxora_master_users WHERE LOWER(email) = LOWER($1) AND is_active = true`, [email]);
        if (!master) return res.json({ success: false, error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, master.password_hash);
        if (!valid) return res.json({ success: false, error: "Invalid credentials" });

        await db.pgRun(`UPDATE fluxora_master_users SET last_login = NOW(), login_ip = $1 WHERE id = $2`, [req.ip, master.id]);
        await logAction(master.id, "master_login", null, null, null, {}, req.ip);

        const token = jwt.sign(
            { id: master.id, email: master.email, name: master.name, is_master: true },
            MASTER_SECRET,
            { expiresIn: "12h" }
        );

        res.json({ success: true, token, master: { id: master.id, name: master.name, email: master.email } });
    } catch (e) {
        console.error("Master login error:", e.message);
        res.json({ success: false, error: "Login failed" });
    }
});

// ── GET /api/master/dashboard ───────────────────────────────────────────────
router.get("/dashboard", requireMaster, async (req, res) => {
    try {
        const [companyStats, revenueStats, invoiceStats, recentCompanies, planDistribution] = await Promise.all([
            db.pgGet(`
                SELECT
                    COUNT(*) AS total_companies,
                    COUNT(*) FILTER (WHERE s.status = 'ACTIVE') AS active_companies,
                    COUNT(*) FILTER (WHERE s.status = 'TRIAL') AS trial_companies,
                    COUNT(*) FILTER (WHERE s.status = 'SUSPENDED') AS suspended_companies,
                    COUNT(*) FILTER (WHERE s.status = 'EXPIRED') AS expired_companies,
                    COUNT(*) FILTER (WHERE s.trial_ends_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS trials_expiring_7d,
                    COUNT(*) FILTER (WHERE s.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND s.status = 'ACTIVE') AS subscriptions_expiring_7d,
                    COUNT(*) FILTER (WHERE c.created_at > NOW() - INTERVAL '30 days') AS new_this_month
                FROM companies c
                LEFT JOIN subscriptions s ON s.id = c.subscription_id
                WHERE c.is_active = true
            `),
            db.pgGet(`
                SELECT
                    COALESCE(SUM(CASE
                        WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'monthly' THEN s.monthly_price
                        WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'yearly' THEN s.yearly_price / 12
                        WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'quarterly' THEN s.quarterly_price / 3
                        ELSE 0
                    END), 0) AS mrr,
                    COALESCE(SUM(CASE
                        WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'monthly' THEN s.monthly_price * 12
                        WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'yearly' THEN s.yearly_price
                        WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'quarterly' THEN s.quarterly_price * 4
                        ELSE 0
                    END), 0) AS arr
                FROM companies c
                LEFT JOIN subscriptions s ON s.id = c.subscription_id
                WHERE c.is_active = true
            `),
            db.pgGet(`
                SELECT COUNT(*) AS total_invoices, COUNT(DISTINCT company_id) AS companies_with_invoices
                FROM invoices WHERE COALESCE(is_deleted, false) = false
            `).catch(() => ({ total_invoices: 0, companies_with_invoices: 0 })),
            db.pgAll(`
                SELECT c.id, c.company_name, c.company_code, c.email, c.city_pincode, c.created_at,
                       s.status AS subscription_status, s.plan_name, s.monthly_price, s.trial_ends_at, s.expiry_date
                FROM companies c
                LEFT JOIN subscriptions s ON s.id = c.subscription_id
                WHERE c.is_active = true
                ORDER BY c.created_at DESC LIMIT 5
            `),
            db.pgAll(`
                SELECT COALESCE(s.plan_name, 'No Plan') AS plan_name, COUNT(*) AS count, COALESCE(SUM(s.monthly_price), 0) AS plan_revenue
                FROM companies c
                LEFT JOIN subscriptions s ON s.id = c.subscription_id
                WHERE c.is_active = true AND (s.status IN ('ACTIVE', 'TRIAL') OR s.status IS NULL)
                GROUP BY s.plan_name
                ORDER BY plan_revenue DESC
            `),
        ]);

        res.json({
            company_stats: companyStats,
            revenue_stats: revenueStats,
            invoice_stats: invoiceStats,
            recent_companies: recentCompanies,
            plan_distribution: planDistribution,
        });
    } catch (e) {
        console.error("Master dashboard error:", e.message);
        res.json({ error: e.message });
    }
});

// ── GET /api/master/tenants — all companies with usage stats ───────────────
router.get("/tenants", requireMaster, async (req, res) => {
    try {
        const { status, search } = req.query;
        const conditions = ["c.is_active = true"];
        const params = [];

        if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(LOWER(c.company_name) LIKE LOWER($${params.length}) OR LOWER(c.email) LIKE LOWER($${params.length}))`);
        }

        const rows = await db.pgAll(
            `SELECT c.*, s.plan_name, s.status AS subscription_status, s.monthly_price, s.yearly_price,
                    s.billing_cycle, s.max_users, s.max_branches, s.trial_ends_at, s.expiry_date,
                    COALESCE(u.active_users, 0) AS active_users,
                    COALESCE(inv.total_invoices, 0) AS total_invoices,
                    COALESCE(inv.total_billed, 0) AS total_billed,
                    CASE
                        WHEN s.status = 'TRIAL' THEN (s.trial_ends_at - CURRENT_DATE)
                        WHEN s.status = 'ACTIVE' THEN (s.expiry_date::date - CURRENT_DATE)
                        ELSE NULL
                    END AS days_remaining
             FROM companies c
             LEFT JOIN subscriptions s ON s.id = c.subscription_id
             LEFT JOIN (
                 SELECT company_id, COUNT(*) AS active_users
                 FROM users WHERE is_active = true
                 GROUP BY company_id
             ) u ON u.company_id = c.id
             LEFT JOIN (
                 SELECT company_id, COUNT(*) AS total_invoices, COALESCE(SUM(total_amount), 0) AS total_billed
                 FROM invoices WHERE COALESCE(is_deleted, false) = false
                 GROUP BY company_id
             ) inv ON inv.company_id = c.id
             WHERE ${conditions.join(" AND ")}
             ORDER BY c.created_at DESC`,
            params
        );
        res.json(rows);
    } catch (e) {
        console.error("Master tenants list error:", e.message);
        res.json([]);
    }
});

// ── GET /api/master/tenants/:id — single company full detail ───────────────
router.get("/tenants/:id", requireMaster, async (req, res) => {
    try {
        const companyId = req.params.id;
        const [company, users, recentInvoices, auditLog] = await Promise.all([
            db.pgGet(
                `SELECT c.*, s.plan_name, s.status AS subscription_status, s.monthly_price, s.yearly_price,
                        s.billing_cycle, s.max_users, s.max_branches, s.trial_ends_at, s.expiry_date,
                        s.enabled_modules, s.max_invoices_per_month
                 FROM companies c
                 LEFT JOIN subscriptions s ON s.id = c.subscription_id
                 WHERE c.id = $1`,
                [companyId]
            ),
            db.pgAll(`SELECT id, username, nickname, email, role, is_active, last_login FROM users WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]),
            db.pgAll(
                `SELECT id, invoice_number, invoice_type, invoice_date, total_amount, status
                 FROM invoices WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
                 ORDER BY created_at DESC LIMIT 10`,
                [companyId]
            ).catch(() => []),
            db.pgAll(`SELECT * FROM master_audit_log WHERE target_type = 'company' AND target_id = $1 ORDER BY created_at DESC LIMIT 20`, [companyId]).catch(() => []),
        ]);

        if (!company) return res.json({ error: "Company not found" });

        res.json({ company, users, recent_invoices: recentInvoices, audit_log: auditLog });
    } catch (e) {
        console.error("Master tenant detail error:", e.message);
        res.json({ error: e.message });
    }
});

// ── POST /api/master/tenants/:id/suspend ────────────────────────────────────
// Suspends by flipping the SAME subscriptions.status field authService.js
// already checks on every login — no separate is_suspended flag needed, and
// no risk of the two disagreeing.
router.post("/tenants/:id/suspend", requireMaster, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.json({ success: false, error: "Reason required" });

        const company = await db.pgGet(`SELECT id, company_name, subscription_id FROM companies WHERE id = $1`, [req.params.id]);
        if (!company) return res.json({ success: false, error: "Company not found" });
        if (!company.subscription_id) return res.json({ success: false, error: "Company has no subscription to suspend" });

        await db.pgRun(`UPDATE subscriptions SET status = 'SUSPENDED' WHERE id = $1`, [company.subscription_id]);
        await db.pgRun(`UPDATE companies SET suspended_at = NOW(), suspended_reason = $1 WHERE id = $2`, [reason, req.params.id]);

        await logAction(req.master.id, "tenant_suspended", "company", req.params.id, company.company_name, { reason }, req.ip);

        res.json({ success: true, message: "Company suspended" });
    } catch (e) {
        console.error("Master suspend error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ── POST /api/master/tenants/:id/activate ───────────────────────────────────
router.post("/tenants/:id/activate", requireMaster, async (req, res) => {
    try {
        const { expiry_date, plan_name } = req.body;

        const company = await db.pgGet(`SELECT id, company_name, subscription_id FROM companies WHERE id = $1`, [req.params.id]);
        if (!company) return res.json({ success: false, error: "Company not found" });
        if (!company.subscription_id) return res.json({ success: false, error: "Company has no subscription to activate" });

        await db.pgRun(
            `UPDATE subscriptions SET
                status = 'ACTIVE',
                expiry_date = COALESCE($1::date, expiry_date, CURRENT_DATE + INTERVAL '30 days'),
                plan_name = COALESCE($2, plan_name)
             WHERE id = $3`,
            [expiry_date || null, plan_name || null, company.subscription_id]
        );
        await db.pgRun(`UPDATE companies SET suspended_at = NULL, suspended_reason = NULL WHERE id = $1`, [req.params.id]);

        await logAction(req.master.id, "tenant_activated", "company", req.params.id, company.company_name, { expiry_date, plan_name }, req.ip);

        res.json({ success: true, message: "Company activated" });
    } catch (e) {
        console.error("Master activate error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ── POST /api/master/tenants — create a brand-new company ──────────────────
router.post("/tenants", requireMaster, async (req, res) => {
    let client;
    try {
        const {
            company_name, email, phone, city_pincode, state, gstin, address_line1,
            plan_name, monthly_price, yearly_price, quarterly_price, billing_cycle,
            trial_days, max_users, max_branches, max_invoices_per_month, internal_notes,
            admin_username, admin_email, admin_password,
        } = req.body;

        if (!company_name) return res.json({ success: false, error: "Company name required" });

        // Generate a unique company_code (the login "Workspace Identifier")
        const base = company_name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "COMPANY";
        let companyCode = base;
        for (let attempt = 0; attempt < 5; attempt++) {
            const exists = await db.pgGet(`SELECT id FROM companies WHERE company_code = $1`, [companyCode]);
            if (!exists) break;
            companyCode = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        }

        client = await db.getClient();
        await client.query("BEGIN");

        const trialDays = parseInt(trial_days || 14);
        let subscriptionId = null;
        if (plan_name || monthly_price) {
            const subRes = await client.query(
                `INSERT INTO subscriptions (plan_name, max_branches, max_users, expiry_date, status, monthly_price, yearly_price, quarterly_price, billing_cycle, max_invoices_per_month, trial_ends_at)
                 VALUES ($1,$2,$3,NULL,'TRIAL',$4,$5,$6,$7,$8,CURRENT_DATE + $9 * INTERVAL '1 day')
                 RETURNING id`,
                [
                    plan_name || "starter", parseInt(max_branches || 1), parseInt(max_users || 3),
                    parseFloat(monthly_price || 0), parseFloat(yearly_price || 0), parseFloat(quarterly_price || 0),
                    billing_cycle || "monthly", parseInt(max_invoices_per_month || 500), trialDays,
                ]
            );
            subscriptionId = subRes.rows[0].id;
        }

        const companyRes = await client.query(
            `INSERT INTO companies (company_name, company_code, email, phone, city_pincode, state, gstin, address_line1, subscription_id, internal_notes, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
             RETURNING *`,
            [company_name, companyCode, email || null, phone || null, city_pincode || null, state || null, gstin || null, address_line1 || null, subscriptionId, internal_notes || null]
        );
        const company = companyRes.rows[0];

        let createdAdmin = null;
        if (admin_username && admin_password) {
            const hash = await bcrypt.hash(admin_password, 10);
            const adminRes = await client.query(
                `INSERT INTO users (company_id, active_company_id, username, email, password_hash, role, is_active)
                 VALUES ($1,$1,$2,$3,$4,'admin',true)
                 RETURNING id, username, email`,
                [company.id, admin_username, admin_email || null, hash]
            );
            createdAdmin = adminRes.rows[0];
        }

        await client.query("COMMIT");

        await logAction(req.master.id, "tenant_created", "company", company.id, company.company_name, { plan_name, email, company_code: companyCode }, req.ip);

        res.json({ success: true, company, company_code: companyCode, admin: createdAdmin });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Master create tenant error:", e.message);
        res.json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// ── POST /api/master/tenants/:id/impersonate ────────────────────────────────
// Issues a REAL tenant-side JWT (same secret + payload shape authService.js's
// generateTokens produces) so it drops straight into the normal ERP session —
// not a separate/parallel auth mechanism that could drift out of sync.
router.post("/tenants/:id/impersonate", requireMaster, async (req, res) => {
    try {
        const company = await db.pgGet(
            `SELECT c.*, s.status AS subscription_status, s.enabled_modules
             FROM companies c LEFT JOIN subscriptions s ON s.id = c.subscription_id
             WHERE c.id = $1`,
            [req.params.id]
        );
        if (!company) return res.json({ success: false, error: "Company not found" });

        const adminUser = await db.pgGet(
            `SELECT * FROM users WHERE company_id = $1 AND role = 'admin' AND is_active = true ORDER BY id ASC LIMIT 1`,
            [req.params.id]
        );
        if (!adminUser) return res.json({ success: false, error: "No active admin user found for this company" });

        const permissions = await db.pgAll(
            `SELECT p.module, p.action FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             JOIN roles r ON rp.role_id = r.id
             WHERE LOWER(r.name) = LOWER($1)`,
            [adminUser.role || "admin"]
        ).catch(() => []);

        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await db.pgRun(`UPDATE users SET impersonated_by = $1, impersonation_expires_at = $2 WHERE id = $3`, [req.master.id, expiresAt, adminUser.id]);

        const tenantToken = jwt.sign(
            {
                user: {
                    id: adminUser.id,
                    email: adminUser.email,
                    username: adminUser.username,
                    role: adminUser.role,
                    company_id: adminUser.company_id,
                    branch_id: adminUser.branch_id || 1,
                    subscription_status: company.subscription_status,
                    enabled_modules: company.enabled_modules,
                    permissions,
                    is_impersonated: true,
                    impersonated_by: req.master.name,
                },
            },
            jwtSecret,
            { expiresIn: "2h" }
        );

        await db.pgRun(
            `INSERT INTO master_impersonate_log (master_user_id, company_id, company_name, ip_address) VALUES ($1,$2,$3,$4)`,
            [req.master.id, company.id, company.company_name, req.ip]
        );
        await logAction(req.master.id, "impersonate_tenant", "company", company.id, company.company_name, { admin_email: adminUser.email }, req.ip);

        res.json({
            success: true,
            tenant_token: tenantToken,
            company_name: company.company_name,
            message: `Logged in as ${company.company_name}'s admin — session expires in 2 hours`,
        });
    } catch (e) {
        console.error("Master impersonate error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ── POST /api/master/announcements ──────────────────────────────────────────
router.post("/announcements", requireMaster, async (req, res) => {
    try {
        const { title, message, type, expires_at, specific_company_ids } = req.body;
        if (!title || !message) return res.json({ success: false, error: "Title and message required" });

        await db.pgRun(
            `INSERT INTO master_announcements (title, message, type, expires_at, specific_company_ids, show_to_all_companies, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [title, message, type || "info", expires_at || null, specific_company_ids || null, !specific_company_ids || specific_company_ids.length === 0, req.master.id]
        );

        res.json({ success: true, message: "Announcement created" });
    } catch (e) {
        console.error("Master announcement create error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/master/announcements/active — public, tenant ERP reads this ───
router.get("/announcements/active", async (req, res) => {
    try {
        const { company_id } = req.query;
        const rows = await db.pgAll(
            `SELECT * FROM master_announcements
             WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
               AND (show_to_all_companies = true OR $1 = ANY(specific_company_ids))
             ORDER BY created_at DESC`,
            [parseInt(company_id || 0)]
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

// ── GET /api/master/system-health ───────────────────────────────────────────
router.get("/system-health", requireMaster, async (req, res) => {
    try {
        const checks = [];

        const dbStart = Date.now();
        await db.pgGet("SELECT 1");
        const dbTime = Date.now() - dbStart;
        checks.push({ name: "PostgreSQL Database", status: dbTime < 500 ? "healthy" : "slow", response_ms: dbTime });

        const [companyCount, userCount, todayInvoices] = await Promise.all([
            db.pgGet(`SELECT COUNT(*) AS count FROM companies WHERE is_active = true`),
            db.pgGet(`SELECT COUNT(*) AS count FROM users WHERE is_active = true`),
            db.pgGet(`SELECT COUNT(*) AS count FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND COALESCE(is_deleted, false) = false`).catch(() => ({ count: 0 })),
        ]);

        checks.push({ name: "Active Companies", status: "info", value: companyCount.count });
        checks.push({ name: "Active Users", status: "info", value: userCount.count });
        checks.push({ name: "Invoices Today", status: "info", value: todayInvoices.count });

        res.json({ checks, checked_at: new Date().toISOString() });
    } catch (e) {
        res.json({ checks: [], error: e.message });
    }
});

// ── GET /api/master/audit-log ───────────────────────────────────────────────
router.get("/audit-log", requireMaster, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT mal.*, fmu.name AS master_user_name
             FROM master_audit_log mal
             LEFT JOIN fluxora_master_users fmu ON fmu.id = mal.master_user_id
             ORDER BY mal.created_at DESC LIMIT 100`
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

export default router;
