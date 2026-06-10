// backend/services/auditLogService.js
import * as db from "../database/pg.js";

/**
 * Log action to audit trail
 * @param {object} params - Audit log parameters
 */
export const logAction = async ({
    user_id,
    company_id,
    module,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    status,
    ip_address,
    user_agent,
    error_message = null
}) => {
    try {
        await db.pgRun(
            `INSERT INTO audit_log 
             (user_id_acting, action, entity_type, entity_id, ip_address, timestamp)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [user_id, action, resource_type, resource_id, ip_address]
        );
    } catch (err) {
        console.error("❌ Audit log error:", err);
    }
};

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = async (companyId, filters = {}) => {
    const {
        module = null,
        action = null,
        resource_type = null,
        user_id = null,
        start_date = null,
        end_date = null,
        limit = 100,
        offset = 0
    } = filters;

    let query = "SELECT * FROM audit_logs WHERE company_id = $1";
    const params = [companyId];
    let paramIndex = 2;

    if (module) {
        query += ` AND module = $${paramIndex++}`;
        params.push(module);
    }

    if (action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(action);
    }

    if (resource_type) {
        query += ` AND resource_type = $${paramIndex++}`;
        params.push(resource_type);
    }

    if (user_id) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(user_id);
    }

    if (start_date) {
        query += ` AND created_at >= $${paramIndex++}`;
        params.push(start_date);
    }

    if (end_date) {
        query += ` AND created_at <= $${paramIndex++}`;
        params.push(end_date);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    try {
        const logs = await db.pgAll(query, params);
        return logs;
    } catch (err) {
        console.error("Get audit logs error:", err);
        return [];
    }
};

/**
 * Get audit log statistics
 */
export const getAuditStats = async (companyId, daysBack = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const stats = await db.pgAll(
            `SELECT 
                module,
                action,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
             FROM audit_logs
             WHERE company_id = $1 AND created_at >= $2
             GROUP BY module, action
             ORDER BY count DESC`,
            [companyId, startDate]
        );

        return stats;
    } catch (err) {
        console.error("Get audit stats error:", err);
        return [];
    }
};

/**
 * Get user activity log
 */
export const getUserActivity = async (userId, companyId) => {
    try {
        const activities = await db.pgAll(
            `SELECT * FROM audit_logs 
             WHERE user_id = $1 AND company_id = $2
             ORDER BY created_at DESC LIMIT 100`,
            [userId, companyId]
        );

        return activities;
    } catch (err) {
        console.error("Get user activity error:", err);
        return [];
    }
};

/**
 * Export audit logs to CSV
 */
export const exportAuditLogs = async (companyId, filters = {}) => {
    try {
        const logs = await getAuditLogs(companyId, { ...filters, limit: 10000 });
        
        // Convert to CSV format
        const headers = [
            "Timestamp",
            "User",
            "Module",
            "Action",
            "Resource Type",
            "Resource ID",
            "Status",
            "IP Address",
            "Error Message"
        ];

        let csv = headers.join(",") + "\n";

        for (const log of logs) {
            csv += [
                log.created_at,
                log.user_id,
                log.module,
                log.action,
                log.resource_type,
                log.resource_id,
                log.status,
                log.ip_address,
                log.error_message ? `"${log.error_message.replace(/"/g, '""')}"` : ""
            ].join(",") + "\n";
        }

        return csv;
    } catch (err) {
        console.error("Export audit logs error:", err);
        throw err;
    }
};

export default {
    logAction,
    getAuditLogs,
    getAuditStats,
    getUserActivity,
    exportAuditLogs
};
