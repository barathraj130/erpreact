// backend/routes/attendanceRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📅 GET TODAY'S ATTENDANCE SUMMARY
 */
router.get('/daily', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT 
                e.id as employee_id,
                e.name,
                e.designation,
                a.id as attendance_id,
                a.date,
                COALESCE(a.status, 'Pending') as status,
                a.od_location,
                a.confirmed_by,
                u.username as confirmed_by_name
            FROM employees e
            LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = CURRENT_DATE
            LEFT JOIN users u ON a.confirmed_by = u.id
            WHERE e.company_id = $1 AND e.status = 'Active'
            ORDER BY e.name ASC
        `;
        const list = await db.pgAll(sql, [companyId]);
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch daily attendance" });
    }
});

/**
 * ✅ MARK ATTENDANCE
 */
router.post('/', authMiddleware, async (req, res) => {
    const { employee_id, date, status, od_location } = req.body;
    const companyId = req.user.active_company_id;

    if (!employee_id || !date || !status) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Block future dates
    if (new Date(date) > new Date()) {
        return res.status(400).json({ error: "Cannot mark attendance for future dates" });
    }

    try {
        const sql = `
            INSERT INTO attendance (company_id, employee_id, date, status, od_location)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (employee_id, date) 
            DO UPDATE SET status = EXCLUDED.status, od_location = EXCLUDED.od_location
            RETURNING *
        `;
        const entry = await db.pgGet(sql, [companyId, employee_id, date, status, od_location || null]);
        res.json(entry);
    } catch (err) {
        res.status(500).json({ error: "Failed to mark attendance" });
    }
});

/**
 * 🛠️ CONFIRM ATTENDANCE (MANAGER ONLY)
 */
router.put('/:id/confirm', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role?.toLowerCase();

    if (role !== 'admin' && role !== 'manager') {
        return res.status(403).json({ error: "Access denied. Managers only." });
    }

    try {
        const sql = `
            UPDATE attendance 
            SET confirmed_by = $1, confirmed_at = NOW() 
            WHERE id = $2
            RETURNING *
        `;
        const confirmed = await db.pgGet(sql, [userId, id]);
        if (!confirmed) return res.status(404).json({ error: "Attendance entry not found" });
        res.json({ message: "Attendance confirmed", confirmed });
    } catch (err) {
        res.status(500).json({ error: "Confirmation failed" });
    }
});

export default router;
