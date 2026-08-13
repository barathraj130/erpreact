// backend/routes/groupAttendance.js
// Group Attendance — additive extension of the Work Accountability module.
// Any ONE active member of an employee_groups group can mark the whole
// group present/absent for the day; the same status applies to every
// member. Reuses existing companies(id)/users(id)/employee_groups(id)/
// group_members/jobs(id) via FK only (SELECT/JOIN) — no existing table,
// route, or record is modified. New tables only: group_attendance,
// employee_attendance_summary, attendance_audit (see migration already
// run). Mounted at /api/work-attendance — a new prefix, distinct from
// the existing /api/attendance (attendanceRoutes.js), which this file
// never touches.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const isAdmin = (role) => ["admin", "superadmin"].includes((role || "").toLowerCase());

const computeWorkHours = (start_time, end_time) => {
    if (!start_time || !end_time) return null;
    const start = new Date(`2000-01-01T${start_time}`);
    const end = new Date(`2000-01-01T${end_time}`);
    const hrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Number.isFinite(hrs) && hrs >= 0 ? Number(hrs.toFixed(2)) : null;
};

// ============================================================
// POST /mark — any active member of the group (or admin) marks
// present/absent/half_day/on_leave for the whole group, for one day.
// ============================================================
router.post("/mark", authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query("BEGIN");

        const {
            group_id, job_id, attendance_date, status,
            location_lat, location_lng, location_address,
            photo_url, start_time, end_time, notes,
        } = req.body;

        if (!group_id) throw new Error("Group required");
        if (!status || !["present", "absent", "half_day", "on_leave"].includes(status)) {
            throw new Error("Status required — present, absent, half_day or on_leave");
        }

        const companyId = req.user.active_company_id;

        const group = await client.query(
            `SELECT id FROM employee_groups WHERE id = $1 AND company_id = $2 AND is_active = true`,
            [group_id, companyId]
        );
        if (group.rows.length === 0) throw new Error("Group not found");

        if (!isAdmin(req.user.role)) {
            const memberCheck = await client.query(
                `SELECT id FROM group_members WHERE group_id = $1 AND employee_id = $2 AND is_active = true`,
                [group_id, req.user.id]
            );
            if (memberCheck.rows.length === 0) throw new Error("You are not a member of this group");
        }

        const today = new Date().toISOString().split("T")[0];
        const attendanceDate = attendance_date || today;

        const existing = await client.query(
            `SELECT id, status FROM group_attendance WHERE group_id = $1 AND attendance_date = $2`,
            [group_id, attendanceDate]
        );
        if (existing.rows.length > 0) {
            throw new Error(`Attendance already marked as ${existing.rows[0].status} for this date. Contact admin to correct.`);
        }

        const isBackdated = attendanceDate < today;
        const workHours = computeWorkHours(start_time, end_time);

        const result = await client.query(
            `INSERT INTO group_attendance (
                company_id, group_id, job_id, attendance_date, status,
                marked_by, marked_at,
                location_lat, location_lng, location_address,
                photo_url, start_time, end_time, work_hours,
                notes, is_backdated
             ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [
                companyId, group_id, job_id || null, attendanceDate, status,
                req.user.id,
                location_lat || null, location_lng || null, location_address || null,
                photo_url || null, start_time || null, end_time || null,
                workHours, notes || null, isBackdated,
            ]
        );
        const attendance = result.rows[0];

        const members = await client.query(
            `SELECT employee_id FROM group_members WHERE group_id = $1 AND is_active = true`,
            [group_id]
        );

        const month = attendanceDate.substring(0, 7);
        for (const member of members.rows) {
            await client.query(
                `INSERT INTO employee_attendance_summary
                    (company_id, employee_id, group_id, attendance_month,
                     total_days, present_days, absent_days, half_days, leave_days, total_work_hours)
                 VALUES ($1,$2,$3,$4,1,
                    CASE WHEN $5 = 'present' THEN 1 ELSE 0 END,
                    CASE WHEN $5 = 'absent' THEN 1 ELSE 0 END,
                    CASE WHEN $5 = 'half_day' THEN 1 ELSE 0 END,
                    CASE WHEN $5 = 'on_leave' THEN 1 ELSE 0 END,
                    $6)
                 ON CONFLICT (employee_id, group_id, attendance_month)
                 DO UPDATE SET
                    total_days = employee_attendance_summary.total_days + 1,
                    present_days = employee_attendance_summary.present_days + CASE WHEN $5 = 'present' THEN 1 ELSE 0 END,
                    absent_days = employee_attendance_summary.absent_days + CASE WHEN $5 = 'absent' THEN 1 ELSE 0 END,
                    half_days = employee_attendance_summary.half_days + CASE WHEN $5 = 'half_day' THEN 1 ELSE 0 END,
                    leave_days = employee_attendance_summary.leave_days + CASE WHEN $5 = 'on_leave' THEN 1 ELSE 0 END,
                    total_work_hours = employee_attendance_summary.total_work_hours + $6,
                    updated_at = NOW()`,
                [companyId, member.employee_id, group_id, month, status, workHours || 0]
            );
        }

        await client.query(
            `INSERT INTO attendance_audit (company_id, group_attendance_id, action, done_by, new_status, notes)
             VALUES ($1,$2,'marked',$3,$4,$5)`,
            [companyId, attendance.id, req.user.id, status, notes || null]
        );

        await client.query("COMMIT");

        const [markerRes, groupRes] = await Promise.all([
            db.pgGet(`SELECT username FROM users WHERE id = $1`, [req.user.id]),
            db.pgGet(`SELECT name FROM employee_groups WHERE id = $1`, [group_id]),
        ]);

        res.json({
            success: true,
            attendance_id: attendance.id,
            marked_for_group: groupRes?.name,
            marked_by: markerRes?.username,
            status,
            attendance_date: attendanceDate,
            members_count: members.rows.length,
            message: `Attendance marked as ${status.toUpperCase()} for ${members.rows.length} member${members.rows.length === 1 ? "" : "s"} of ${groupRes?.name || "group"}`,
        });
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

// ============================================================
// GET /group/:group_id — attendance history for one group
// ============================================================
router.get("/group/:group_id", authMiddleware, async (req, res) => {
    try {
        const { from, to, month } = req.query;
        const companyId = req.user.active_company_id;
        const params = [req.params.group_id, companyId];
        let dateFilter = "";

        if (month) {
            params.push(month);
            dateFilter = `AND TO_CHAR(ga.attendance_date, 'YYYY-MM') = $${params.length}`;
        } else if (from && to) {
            params.push(from);
            dateFilter = `AND ga.attendance_date >= $${params.length}`;
            params.push(to);
            dateFilter += ` AND ga.attendance_date <= $${params.length}`;
        }

        const rows = await db.pgAll(
            `SELECT ga.*, u.username AS marked_by_name, eg.name AS group_name,
                    COUNT(gm.employee_id) AS member_count
             FROM group_attendance ga
             LEFT JOIN users u ON u.id = ga.marked_by
             LEFT JOIN employee_groups eg ON eg.id = ga.group_id
             LEFT JOIN group_members gm ON gm.group_id = ga.group_id AND gm.is_active = true
             WHERE ga.group_id = $1 AND ga.company_id = $2 ${dateFilter}
             GROUP BY ga.id, u.username, eg.name
             ORDER BY ga.attendance_date DESC`,
            params
        );
        res.json(rows);
    } catch (e) {
        console.error("group attendance history error:", e.message);
        res.json([]);
    }
});

// ============================================================
// GET /today — today's status across all groups (admin dashboard)
// ============================================================
router.get("/today", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const today = new Date().toISOString().split("T")[0];

        const rows = await db.pgAll(
            `SELECT
                eg.id AS group_id,
                eg.name AS group_name,
                eg.leader_id,
                COUNT(gm.employee_id) AS member_count,
                ga.id AS attendance_id,
                ga.status,
                ga.marked_by,
                ga.marked_at,
                ga.start_time,
                ga.end_time,
                u.username AS marked_by_name,
                CASE WHEN ga.id IS NOT NULL THEN true ELSE false END AS is_marked
             FROM employee_groups eg
             LEFT JOIN group_members gm ON gm.group_id = eg.id AND gm.is_active = true
             LEFT JOIN group_attendance ga ON ga.group_id = eg.id AND ga.attendance_date = $2
             LEFT JOIN users u ON u.id = ga.marked_by
             WHERE eg.company_id = $1 AND eg.is_active = true
             GROUP BY eg.id, eg.name, eg.leader_id, ga.id, ga.status, ga.marked_by, ga.marked_at, ga.start_time, ga.end_time, u.username
             ORDER BY eg.name`,
            [companyId, today]
        );

        const total = rows.length;
        const marked = rows.filter((r) => r.is_marked).length;
        const present = rows.filter((r) => r.status === "present").length;
        const absent = rows.filter((r) => r.status === "absent").length;

        res.json({
            date: today,
            summary: { total, marked, present, absent, unmarked: total - marked },
            groups: rows,
        });
    } catch (e) {
        console.error("attendance today error:", e.message);
        res.json({ summary: {}, groups: [] });
    }
});

// ============================================================
// GET /my-groups — groups the logged-in user belongs to, plus
// today's marked status for each (used by the Mark Attendance page)
// ============================================================
router.get("/my-groups", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const today = new Date().toISOString().split("T")[0];

        const rows = await db.pgAll(
            `SELECT
                eg.id AS group_id,
                eg.name AS group_name,
                (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = eg.id AND gm2.is_active = true) AS member_count,
                ga.id AS attendance_id,
                ga.status,
                ga.marked_by,
                ga.marked_at,
                u.username AS marked_by_name
             FROM employee_groups eg
             JOIN group_members gm ON gm.group_id = eg.id AND gm.employee_id = $2 AND gm.is_active = true
             LEFT JOIN group_attendance ga ON ga.group_id = eg.id AND ga.attendance_date = $3
             LEFT JOIN users u ON u.id = ga.marked_by
             WHERE eg.company_id = $1 AND eg.is_active = true
             ORDER BY eg.name`,
            [companyId, req.user.id, today]
        );
        res.json(rows);
    } catch (e) {
        console.error("my-groups error:", e.message);
        res.json([]);
    }
});

// ============================================================
// GET /employee/:employee_id/summary — running total per employee
// ============================================================
router.get("/employee/:employee_id/summary", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(
            `SELECT eas.*, eg.name AS group_name, u.username AS employee_name
             FROM employee_attendance_summary eas
             LEFT JOIN employee_groups eg ON eg.id = eas.group_id
             LEFT JOIN users u ON u.id = eas.employee_id
             WHERE eas.employee_id = $1 AND eas.company_id = $2
             ORDER BY eas.attendance_month DESC`,
            [req.params.employee_id, companyId]
        );

        const totals = rows.reduce(
            (acc, row) => ({
                total_days: acc.total_days + (parseInt(row.total_days) || 0),
                present_days: acc.present_days + (parseInt(row.present_days) || 0),
                absent_days: acc.absent_days + (parseInt(row.absent_days) || 0),
                total_work_hours: acc.total_work_hours + (parseFloat(row.total_work_hours) || 0),
            }),
            { total_days: 0, present_days: 0, absent_days: 0, total_work_hours: 0 }
        );

        res.json({ employee_id: req.params.employee_id, monthly_summary: rows, all_time_totals: totals });
    } catch (e) {
        console.error("employee attendance summary error:", e.message);
        res.json({ monthly_summary: [], all_time_totals: {} });
    }
});

// ============================================================
// PUT /:id/correct — admin corrects a wrong group-attendance entry.
// Writes a NEW attendance_audit row rather than silently overwriting
// history — the audit trail keeps the previous_status.
// ============================================================
router.put("/:id/correct", authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        if (!isAdmin(req.user.role)) throw new Error("Admin only");

        const { status, reason } = req.body;
        if (!status || !["present", "absent", "half_day", "on_leave"].includes(status)) {
            throw new Error("Valid status required");
        }
        if (!reason || reason.trim().length < 5) throw new Error("Reason required to correct attendance");

        const old = await client.query(
            `SELECT * FROM group_attendance WHERE id = $1 AND company_id = $2`,
            [req.params.id, req.user.active_company_id]
        );
        if (!old.rows[0]) throw new Error("Attendance record not found");

        await client.query(`UPDATE group_attendance SET status = $1, updated_at = NOW() WHERE id = $2`, [status, req.params.id]);

        await client.query(
            `INSERT INTO attendance_audit (company_id, group_attendance_id, action, done_by, previous_status, new_status, notes)
             VALUES ($1,$2,'corrected',$3,$4,$5,$6)`,
            [old.rows[0].company_id, req.params.id, req.user.id, old.rows[0].status, status, reason]
        );

        await client.query("COMMIT");
        res.json({ success: true, message: "Attendance corrected" });
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

export default router;
