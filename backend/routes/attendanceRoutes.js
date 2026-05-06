// backend/routes/attendanceRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Generate unique QR codes for employees
router.post("/generate-qrs", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const employees = await db.pgAll(`SELECT id FROM employees WHERE company_id = $1 AND status = 'Active'`, [companyId]);
        let generated = 0;
        for (const emp of employees) {
            const existing = await db.pgGet(`SELECT id FROM employee_qr_codes WHERE employee_id = $1`, [emp.id]);
            if (!existing) {
                const qrString = `EMP-QR-${uuidv4()}`;
                await db.pgRun(
                    `INSERT INTO employee_qr_codes (company_id, employee_id, qr_code_string) VALUES ($1, $2, $3)`,
                    [companyId, emp.id, qrString]
                );
                generated++;
            }
        }
        res.json({ success: true, message: `Generated ${generated} new QR codes.` });
    } catch (err) {
        console.error("QR Generation Error:", err);
        res.status(500).json({ error: "Failed to generate QR codes" });
    }
});

// Employee scans QR to mark attendance
router.post("/mark", async (req, res) => {
    const { qr_code_string, status, od_location } = req.body;
    const today = new Date().toISOString().split('T')[0];

    try {
        const qrRecord = await db.pgGet(`SELECT employee_id, company_id FROM employee_qr_codes WHERE qr_code_string = $1`, [qr_code_string]);
        if (!qrRecord) return res.status(404).json({ error: "Invalid QR Code" });

        const { employee_id, company_id } = qrRecord;

        const existing = await db.pgGet(`SELECT id, confirmed_at FROM attendance WHERE employee_id = $1 AND date = $2`, [employee_id, today]);
        
        if (existing) {
            if (existing.confirmed_at) return res.status(400).json({ error: "Attendance already confirmed for today" });
            
            await db.pgRun(
                `UPDATE attendance SET status = $1, od_location = $2 WHERE id = $3`,
                [status || 'Present', od_location || null, existing.id]
            );
            return res.json({ success: true, message: "Attendance updated successfully." });
        }

        await db.pgRun(
            `INSERT INTO attendance (company_id, employee_id, date, status, od_location) VALUES ($1, $2, $3, $4, $5)`,
            [company_id, employee_id, today, status || 'Present', od_location || null]
        );

        res.json({ success: true, message: "Attendance marked successfully." });
    } catch (err) {
        console.error("Attendance Mark Error:", err);
        res.status(500).json({ error: "Failed to mark attendance" });
    }
});

// Get daily attendance for manager confirmation
router.get("/daily", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    try {
        const sql = `
            SELECT a.*, e.name as employee_name, q.qr_code_string
            FROM employees e
            LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = $2
            LEFT JOIN employee_qr_codes q ON e.id = q.employee_id
            WHERE e.company_id = $1 AND e.status = 'Active'
        `;
        const data = await db.pgAll(sql, [companyId, date]);
        
        // Auto-flag as pending if past 11 AM and not confirmed
        const now = new Date();
        const isPast11AM = now.getHours() >= 11;
        
        const enriched = data.map(record => {
            if (!record.id) {
                return { ...record, display_status: 'Not Marked' };
            }
            if (!record.confirmed_at && isPast11AM) {
                return { ...record, display_status: 'Pending Auto-Flagged' };
            }
            if (!record.confirmed_at) {
                return { ...record, display_status: 'Pending Confirmation' };
            }
            return { ...record, display_status: 'Confirmed' };
        });

        res.json(enriched);
    } catch (err) {
        console.error("Fetch Daily Attendance Error:", err);
        res.status(500).json({ error: "Failed to fetch attendance" });
    }
});

// Manager confirms attendance
router.post("/confirm", authMiddleware, async (req, res) => {
    const { attendance_ids } = req.body; // Array of attendance IDs to confirm
    const managerId = req.user.id;
    const companyId = req.user.active_company_id;

    try {
        if (!attendance_ids || !attendance_ids.length) {
            return res.status(400).json({ error: "No attendance records selected." });
        }

        const placeholders = attendance_ids.map((_, i) => `$${i + 3}`).join(",");
        await db.pgRun(
            `UPDATE attendance SET confirmed_by = $1, confirmed_at = NOW() WHERE company_id = $2 AND id IN (${placeholders})`,
            [managerId, companyId, ...attendance_ids]
        );

        res.json({ success: true, message: "Attendance confirmed successfully." });
    } catch (err) {
        console.error("Confirm Attendance Error:", err);
        res.status(500).json({ error: "Failed to confirm attendance" });
    }
});

export default router;
