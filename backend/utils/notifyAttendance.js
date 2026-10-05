// backend/utils/notifyAttendance.js
// Notifies admin (via the n8n SMS workflow) whenever attendance is marked, at
// Main Office or any branch. Fire-and-forget — triggerN8N itself never throws,
// so a missing recipients table or dead n8n tunnel never blocks attendance.
import * as db from '../database/pg.js';
import { triggerN8N } from './triggerN8N.js';

export async function notifyAttendanceMarked(companyId, { branchId, markedByName, subject, status, date }) {
    try {
        const recipients = await db.pgAll(
            `SELECT phone_number FROM sms_notification_recipients WHERE company_id = $1 AND is_active = true`,
            [companyId]
        ).catch(() => []); // table may not exist yet on an older deploy — skip silently

        if (!recipients.length) return;

        let branchName = 'Main Office';
        if (branchId) {
            const branch = await db.pgGet(`SELECT branch_name FROM branches WHERE id = $1 AND company_id = $2`, [branchId, companyId]).catch(() => null);
            if (branch?.branch_name) branchName = branch.branch_name;
        }

        await triggerN8N('attendance-marked', {
            recipients: recipients.map(r => r.phone_number),
            branch_name: branchName,
            marked_by: markedByName || 'Staff',
            subject,
            status,
            date,
        });
    } catch (e) {
        console.log('[notifyAttendance] skipped:', e.message);
    }
}
