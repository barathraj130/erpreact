// backend/utils/notifyAttendance.js
// Notifies admin whenever attendance is marked, at Main Office or any branch —
// routed through the centralized notificationService (queued, retried, logged
// to history) instead of calling n8n directly.
import * as db from '../database/pg.js';
import { createNotification } from '../services/notificationService.js';

export async function notifyAttendanceMarked(companyId, { branchId, markedByName, subject, status, date }) {
    try {
        let branchName = 'Main Office';
        if (branchId) {
            const branch = await db.pgGet(`SELECT branch_name FROM branches WHERE id = $1 AND company_id = $2`, [branchId, companyId]).catch(() => null);
            if (branch?.branch_name) branchName = branch.branch_name;
        }

        await createNotification(companyId, {
            eventType: 'ATTENDANCE_MARKED',
            title: 'Attendance Marked',
            message: `Attendance: ${subject} marked ${status} at ${branchName} by ${markedByName || 'Staff'} on ${date}.`,
            priority: 'LOW',
            entityType: 'attendance',
        });
    } catch (e) {
        console.log('[notifyAttendance] skipped:', e.message);
    }
}
