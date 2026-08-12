// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
//
// Fluxora's own internal-organization ERP (HR, attendance, leaves, payroll,
// finance) — scoped to Fluxora Technology's own staff only. Tenants keep
// using their existing Employees/Attendance/Payroll pages untouched; nothing
// here is reachable by, or scoped to, any customer tenant.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const MASTER_SECRET = process.env.MASTER_JWT_SECRET || "fluxora_master_2026_barath_secret_key";

// ── Resolve Fluxora Technology's own organization row once, cache it ───────
let fluxoraOrgId = null;
const getFluxoraOrgId = async () => {
    if (fluxoraOrgId) return fluxoraOrgId;
    const org = await db.pgGet(`SELECT id FROM organizations WHERE slug = 'fluxora-technology'`);
    fluxoraOrgId = org?.id || null;
    return fluxoraOrgId;
};

// ── Only Fluxora's own admin/superadmin users (company_code = FLUXORA) ─────
// Regular tenant admins (e.g. JBS) authenticate fine via authMiddleware but
// are rejected here — this data belongs to Fluxora's own internal company,
// not any customer tenant.
const requireFluxoraStaff = async (req, res, next) => {
    try {
        if (!req.user?.active_company_id) return res.status(403).json({ error: "Not authorized" });
        const company = await db.pgGet(`SELECT company_code FROM companies WHERE id = $1`, [req.user.active_company_id]);
        if (!company || company.company_code !== "FLUXORA") {
            return res.status(403).json({ error: "Fluxora staff only" });
        }
        const role = (req.user.role || "").toLowerCase();
        if (!["admin", "superadmin"].includes(role)) {
            return res.status(403).json({ error: "Admin role required" });
        }
        const orgId = await getFluxoraOrgId();
        if (!orgId) return res.status(500).json({ error: "Fluxora organization not provisioned" });
        req.fluxoraOrgId = orgId;
        next();
    } catch (e) {
        res.status(500).json({ error: "Authorization check failed" });
    }
};

// ── Separate check for platform-revenue endpoints — uses the SAME master  ──
// token verification as routes/master.js (duplicated here, not imported,
// since requireMaster isn't exported from that file and it must not be
// modified). Master Panel is the only caller of these two routes.
const requireMaster = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) return res.status(401).json({ error: "No token" });
        const decoded = jwt.verify(token, MASTER_SECRET);
        if (!decoded.is_master) return res.status(403).json({ error: "Not a master session" });
        const master = await db.pgGet(`SELECT id FROM fluxora_master_users WHERE id = $1 AND is_active = true`, [decoded.id]);
        if (!master) return res.status(403).json({ error: "Master user not found or inactive" });
        req.masterId = master.id;
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid master token" });
    }
};

// ── GET /api/org/departments ────────────────────────────────────────────
router.get("/departments", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT d.*, oe.name AS head_name
             FROM departments d
             LEFT JOIN organization_employees oe ON oe.id = d.head_employee_id
             WHERE d.organization_id = $1 AND d.is_active = true
             ORDER BY d.name`,
            [req.fluxoraOrgId]
        );
        res.json(rows);
    } catch (e) {
        console.error("org departments list error:", e.message);
        res.json([]);
    }
});

router.post("/departments", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.json({ success: false, error: "Name required" });
        const result = await db.pgRun(
            `INSERT INTO departments (organization_id, name, description) VALUES ($1,$2,$3) RETURNING *`,
            [req.fluxoraOrgId, name, description || null]
        );
        res.json({ success: true, department: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/designations ───────────────────────────────────────────
router.get("/designations", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM designations WHERE organization_id = $1 AND is_active = true ORDER BY level, title`,
            [req.fluxoraOrgId]
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

router.post("/designations", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { title, level } = req.body;
        if (!title) return res.json({ success: false, error: "Title required" });
        const result = await db.pgRun(
            `INSERT INTO designations (organization_id, title, level) VALUES ($1,$2,$3) RETURNING *`,
            [req.fluxoraOrgId, title, parseInt(level) || 1]
        );
        res.json({ success: true, designation: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/branches ───────────────────────────────────────────────
router.get("/branches", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM organization_branches WHERE organization_id = $1 AND is_active = true ORDER BY name`,
            [req.fluxoraOrgId]
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

router.post("/branches", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { name, branch_code, branch_type, address, city, state } = req.body;
        if (!name) return res.json({ success: false, error: "Name required" });
        const result = await db.pgRun(
            `INSERT INTO organization_branches (organization_id, name, branch_code, branch_type, address, city, state)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [req.fluxoraOrgId, name, branch_code || null, branch_type || "office", address || null, city || null, state || null]
        );
        res.json({ success: true, branch: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/employees ──────────────────────────────────────────────
router.get("/employees", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { branch_id, department_id, status } = req.query;
        const conditions = ["oe.organization_id = $1"];
        const params = [req.fluxoraOrgId];
        let pc = 1;

        if (branch_id) { pc++; conditions.push(`oe.branch_id = $${pc}`); params.push(branch_id); }
        if (department_id) { pc++; conditions.push(`oe.department_id = $${pc}`); params.push(department_id); }
        if (status) { pc++; conditions.push(`oe.employment_status = $${pc}`); params.push(status); }

        const rows = await db.pgAll(
            `SELECT oe.*,
                    d.name AS department_name,
                    des.title AS designation_title,
                    ob.name AS branch_name,
                    mgr.name AS manager_name
             FROM organization_employees oe
             LEFT JOIN departments d ON d.id = oe.department_id
             LEFT JOIN designations des ON des.id = oe.designation_id
             LEFT JOIN organization_branches ob ON ob.id = oe.branch_id
             LEFT JOIN organization_employees mgr ON mgr.id = oe.reporting_manager_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY oe.name ASC`,
            params
        );
        res.json(rows);
    } catch (e) {
        console.error("org employees list error:", e.message);
        res.json([]);
    }
});

// ── POST /api/org/employees ─────────────────────────────────────────────
router.post("/employees", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const {
            name, email, phone, department_id, designation_id, branch_id,
            joining_date, employment_type, basic_salary, reporting_manager_id,
        } = req.body;
        if (!name) return res.json({ success: false, error: "Employee name required" });

        const countRes = await db.pgGet(
            `SELECT COUNT(*) AS count FROM organization_employees WHERE organization_id = $1`,
            [req.fluxoraOrgId]
        );
        const empNum = String(parseInt(countRes.count) + 1).padStart(4, "0");
        const employeeId = `FLX-${new Date().getFullYear()}-${empNum}`;

        const result = await db.pgRun(
            `INSERT INTO organization_employees (
                employee_id, organization_id, branch_id, department_id, designation_id,
                name, email, phone, joining_date, employment_type, basic_salary, reporting_manager_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
                employeeId, req.fluxoraOrgId, branch_id || null, department_id || null, designation_id || null,
                name, email || null, phone || null, joining_date || null, employment_type || "fulltime",
                basic_salary || 0, reporting_manager_id || null,
            ]
        );

        res.json({ success: true, employee: result.rows[0], employee_id: employeeId });
    } catch (e) {
        console.error("org employee create error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/attendance ─────────────────────────────────────────────
router.get("/attendance", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { date, month, employee_id } = req.query;
        const conditions = ["oa.organization_id = $1"];
        const params = [req.fluxoraOrgId];
        let pc = 1;

        if (date) { pc++; conditions.push(`oa.attendance_date = $${pc}`); params.push(date); }
        if (month) { pc++; conditions.push(`TO_CHAR(oa.attendance_date,'YYYY-MM') = $${pc}`); params.push(month); }
        if (employee_id) { pc++; conditions.push(`oa.employee_id = $${pc}`); params.push(employee_id); }

        const rows = await db.pgAll(
            `SELECT oa.*, oe.name AS employee_name, oe.employee_id AS emp_code
             FROM org_attendance oa
             JOIN organization_employees oe ON oe.id = oa.employee_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY oa.attendance_date DESC, oe.name`,
            params
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

// ── POST /api/org/attendance — mark/update one employee's day ──────────
router.post("/attendance", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { employee_id, attendance_date, status, check_in, check_out, notes } = req.body;
        if (!employee_id || !attendance_date) return res.json({ success: false, error: "Employee and date required" });

        const empCheck = await db.pgGet(
            `SELECT id FROM organization_employees WHERE id = $1 AND organization_id = $2`,
            [employee_id, req.fluxoraOrgId]
        );
        if (!empCheck) return res.json({ success: false, error: "Employee not found" });

        await db.pgRun(
            `INSERT INTO org_attendance (employee_id, organization_id, attendance_date, status, check_in, check_out, notes, marked_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (employee_id, attendance_date)
             DO UPDATE SET status = $4, check_in = $5, check_out = $6, notes = $7`,
            [employee_id, req.fluxoraOrgId, attendance_date, status || "present", check_in || null, check_out || null, notes || null, req.user.id]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── POST /api/org/attendance/bulk-mark — mark everyone present for a date ──
router.post("/attendance/bulk-mark", authMiddleware, requireFluxoraStaff, async (req, res) => {
    const client = await db.getClient();
    try {
        const { attendance_date } = req.body;
        if (!attendance_date) return res.json({ success: false, error: "Date required" });

        await client.query("BEGIN");
        const employees = await client.query(
            `SELECT id FROM organization_employees WHERE organization_id = $1 AND employment_status = 'active'`,
            [req.fluxoraOrgId]
        );
        for (const emp of employees.rows) {
            await client.query(
                `INSERT INTO org_attendance (employee_id, organization_id, attendance_date, status, marked_by)
                 VALUES ($1,$2,$3,'present',$4)
                 ON CONFLICT (employee_id, attendance_date) DO NOTHING`,
                [emp.id, req.fluxoraOrgId, attendance_date, req.user.id]
            );
        }
        await client.query("COMMIT");
        res.json({ success: true, marked: employees.rows.length });
    } catch (e) {
        await client.query("ROLLBACK");
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

// ── GET /api/org/leaves ─────────────────────────────────────────────────
router.get("/leaves", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { status, employee_id } = req.query;
        const conditions = ["ol.organization_id = $1"];
        const params = [req.fluxoraOrgId];
        let pc = 1;

        if (status) { pc++; conditions.push(`ol.status = $${pc}`); params.push(status); }
        if (employee_id) { pc++; conditions.push(`ol.employee_id = $${pc}`); params.push(employee_id); }

        const rows = await db.pgAll(
            `SELECT ol.*, oe.name AS employee_name, oe.employee_id AS emp_code, u.username AS approved_by_name
             FROM org_leaves ol
             JOIN organization_employees oe ON oe.id = ol.employee_id
             LEFT JOIN users u ON u.id = ol.approved_by
             WHERE ${conditions.join(" AND ")}
             ORDER BY ol.created_at DESC`,
            params
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

router.post("/leaves", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { employee_id, leave_type, from_date, to_date, reason } = req.body;
        if (!employee_id || !from_date || !to_date) return res.json({ success: false, error: "Employee, from date and to date required" });

        const days = Math.ceil((new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24)) + 1;
        const result = await db.pgRun(
            `INSERT INTO org_leaves (employee_id, organization_id, leave_type, from_date, to_date, total_days, reason, applied_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [employee_id, req.fluxoraOrgId, leave_type || "casual", from_date, to_date, days, reason || null, req.user.id]
        );
        res.json({ success: true, leave: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

router.post("/leaves/:id/approve", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { action, rejection_reason } = req.body;
        const newStatus = action === "approve" ? "approved" : "rejected";
        await db.pgRun(
            `UPDATE org_leaves SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3
             WHERE id = $4 AND organization_id = $5`,
            [newStatus, req.user.id, rejection_reason || null, req.params.id, req.fluxoraOrgId]
        );
        res.json({ success: true, status: newStatus });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/payroll ────────────────────────────────────────────────
router.get("/payroll", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { month, employee_id } = req.query;
        const conditions = ["op.organization_id = $1"];
        const params = [req.fluxoraOrgId];
        let pc = 1;

        if (month) { pc++; conditions.push(`op.payroll_month = $${pc}`); params.push(month); }
        if (employee_id) { pc++; conditions.push(`op.employee_id = $${pc}`); params.push(employee_id); }

        const rows = await db.pgAll(
            `SELECT op.*, oe.name AS employee_name, oe.employee_id AS emp_code,
                    oe.bank_name, oe.bank_account, oe.bank_ifsc
             FROM org_payroll op
             JOIN organization_employees oe ON oe.id = op.employee_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY op.payroll_month DESC, oe.name`,
            params
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

// ── POST /api/org/payroll/process — generate this month's rows ─────────
router.post("/payroll/process", authMiddleware, requireFluxoraStaff, async (req, res) => {
    const client = await db.getClient();
    try {
        const { payroll_month } = req.body;
        if (!payroll_month) return res.json({ success: false, error: "Payroll month required" });

        await client.query("BEGIN");
        const employees = await client.query(
            `SELECT id, basic_salary FROM organization_employees WHERE organization_id = $1 AND employment_status = 'active'`,
            [req.fluxoraOrgId]
        );

        let processed = 0;
        for (const emp of employees.rows) {
            const existing = await client.query(
                `SELECT id FROM org_payroll WHERE employee_id = $1 AND payroll_month = $2`,
                [emp.id, payroll_month]
            );
            if (existing.rows.length > 0) continue;

            const net = parseFloat(emp.basic_salary || 0);
            await client.query(
                `INSERT INTO org_payroll (employee_id, organization_id, payroll_month, basic_salary, net_salary)
                 VALUES ($1,$2,$3,$4,$5)`,
                [emp.id, req.fluxoraOrgId, payroll_month, net, net]
            );
            processed++;
        }

        await client.query("COMMIT");
        res.json({ success: true, processed, message: `Payroll processed for ${processed} employees` });
    } catch (e) {
        await client.query("ROLLBACK");
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

// ── POST /api/org/payroll/:id/mark-paid ─────────────────────────────────
router.post("/payroll/:id/mark-paid", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        await db.pgRun(
            `UPDATE org_payroll SET payment_status = 'paid', payment_date = CURRENT_DATE, paid_by = $1
             WHERE id = $2 AND organization_id = $3`,
            [req.user.id, req.params.id, req.fluxoraOrgId]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/finance/summary ────────────────────────────────────────
router.get("/finance/summary", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        const toDate = to || new Date().toISOString().split("T")[0];

        const row = await db.pgGet(
            `SELECT
                COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS total_expense,
                COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS net,
                COUNT(*) AS transaction_count
             FROM org_transactions
             WHERE organization_id = $1 AND transaction_date BETWEEN $2 AND $3`,
            [req.fluxoraOrgId, fromDate, toDate]
        );
        res.json(row);
    } catch (e) {
        res.json({ total_income: 0, total_expense: 0, net: 0, transaction_count: 0 });
    }
});

// ── GET /api/org/finance/transactions ───────────────────────────────────
router.get("/finance/transactions", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { transaction_type, from, to } = req.query;
        const conditions = ["organization_id = $1"];
        const params = [req.fluxoraOrgId];
        let pc = 1;

        if (transaction_type) { pc++; conditions.push(`transaction_type = $${pc}`); params.push(transaction_type); }
        if (from) { pc++; conditions.push(`transaction_date >= $${pc}`); params.push(from); }
        if (to) { pc++; conditions.push(`transaction_date <= $${pc}`); params.push(to); }

        const rows = await db.pgAll(
            `SELECT * FROM org_transactions WHERE ${conditions.join(" AND ")} ORDER BY transaction_date DESC, id DESC LIMIT 200`,
            params
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

router.post("/finance/transactions", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const { transaction_type, category, amount, direction, description, transaction_date, payment_mode } = req.body;
        if (!amount || !direction) return res.json({ success: false, error: "Amount and direction required" });

        const result = await db.pgRun(
            `INSERT INTO org_transactions (organization_id, transaction_type, category, amount, direction, description, transaction_date, payment_mode, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [
                req.fluxoraOrgId, transaction_type || (direction === "in" ? "income" : "expense"), category || null,
                parseFloat(amount), direction, description || null, transaction_date || new Date().toISOString().split("T")[0],
                payment_mode || "cash", req.user.id,
            ]
        );
        res.json({ success: true, transaction: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ── GET /api/org/dashboard — Fluxora company overview ──────────────────
router.get("/dashboard", authMiddleware, requireFluxoraStaff, async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        const payrollMonth = today.slice(0, 7);

        const [employeeStats, attendanceToday, pendingLeaves, payrollStatus, financeSummary] = await Promise.all([
            db.pgGet(
                `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE employment_status = 'active') AS active
                 FROM organization_employees WHERE organization_id = $1`,
                [req.fluxoraOrgId]
            ),
            db.pgGet(
                `SELECT
                    COUNT(*) FILTER (WHERE status = 'present') AS present,
                    COUNT(*) FILTER (WHERE status = 'absent') AS absent,
                    COUNT(*) FILTER (WHERE status = 'on_leave') AS on_leave
                 FROM org_attendance WHERE organization_id = $1 AND attendance_date = $2`,
                [req.fluxoraOrgId, today]
            ),
            db.pgAll(
                `SELECT ol.*, oe.name AS employee_name FROM org_leaves ol
                 JOIN organization_employees oe ON oe.id = ol.employee_id
                 WHERE ol.organization_id = $1 AND ol.status = 'pending'
                 ORDER BY ol.created_at DESC LIMIT 5`,
                [req.fluxoraOrgId]
            ),
            db.pgGet(
                `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid,
                        COALESCE(SUM(net_salary), 0) AS total_amount
                 FROM org_payroll WHERE organization_id = $1 AND payroll_month = $2`,
                [req.fluxoraOrgId, payrollMonth]
            ),
            db.pgGet(
                `SELECT
                    COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS total_income,
                    COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS total_expense
                 FROM org_transactions WHERE organization_id = $1 AND transaction_date >= $2`,
                [req.fluxoraOrgId, monthStart]
            ),
        ]);

        res.json({
            employees: employeeStats,
            attendance_today: attendanceToday,
            pending_leaves: pendingLeaves,
            payroll_this_month: payrollStatus,
            finance_this_month: financeSummary,
        });
    } catch (e) {
        console.error("org dashboard error:", e.message);
        res.json({ error: e.message });
    }
});

// ── Platform revenue — master-only, real SaaS payment ledger ───────────
router.get("/platform/revenue", requireMaster, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT pr.*, c.company_name FROM platform_revenue pr
             LEFT JOIN companies c ON c.id = pr.tenant_id
             ORDER BY pr.payment_date DESC LIMIT 200`
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

router.post("/platform/revenue", requireMaster, async (req, res) => {
    try {
        const { tenant_id, revenue_type, plan_name, amount, billing_cycle, payment_date, payment_mode, invoice_number, notes } = req.body;
        if (!amount || !revenue_type) return res.json({ success: false, error: "Amount and revenue type required" });

        const result = await db.pgRun(
            `INSERT INTO platform_revenue (tenant_id, revenue_type, plan_name, amount, billing_cycle, payment_date, payment_mode, invoice_number, notes, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [
                tenant_id || null, revenue_type, plan_name || null, parseFloat(amount), billing_cycle || null,
                payment_date || new Date().toISOString().split("T")[0], payment_mode || "bank",
                invoice_number || null, notes || null, req.masterId,
            ]
        );
        res.json({ success: true, revenue: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

router.get("/platform/revenue-summary", requireMaster, async (req, res) => {
    try {
        const [revenue, tenants, mrrRow] = await Promise.all([
            db.pgGet(
                `SELECT
                    COALESCE(SUM(amount), 0) AS total_revenue,
                    COUNT(*) AS total_payments,
                    COALESCE(SUM(amount) FILTER (WHERE payment_date >= NOW() - INTERVAL '30 days'), 0) AS last_30_days
                 FROM platform_revenue`
            ),
            db.pgGet(
                `SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE s.status = 'ACTIVE') AS active,
                    COUNT(*) FILTER (WHERE s.status = 'TRIAL') AS trial,
                    COUNT(*) FILTER (WHERE s.status = 'SUSPENDED') AS suspended,
                    COUNT(*) FILTER (WHERE c.created_at > NOW() - INTERVAL '30 days') AS new_this_month
                 FROM companies c LEFT JOIN subscriptions s ON s.id = c.subscription_id`
            ),
            db.pgGet(
                `SELECT COALESCE(SUM(CASE
                    WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'monthly' THEN s.monthly_price
                    WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'yearly' THEN s.yearly_price / 12
                    WHEN s.status = 'ACTIVE' AND s.billing_cycle = 'quarterly' THEN s.quarterly_price / 3
                    ELSE 0
                 END), 0) AS mrr
                 FROM companies c LEFT JOIN subscriptions s ON s.id = c.subscription_id`
            ),
        ]);

        const mrr = parseFloat(mrrRow.mrr || 0);
        res.json({ revenue, tenants, mrr, arr: mrr * 12 });
    } catch (e) {
        res.json({ error: e.message });
    }
});

export default router;
