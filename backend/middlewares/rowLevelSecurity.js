// backend/middlewares/rowLevelSecurity.js
import * as db from '../database/pg.js';

/**
 * Middleware to enforce company isolation at the request level
 */
export const rowLevelSecurity = (req, res, next) => {
    if (req.user) {
        req.company_id = req.user.company_id || req.user.active_company_id;
        
        if (!req.company_id) {
            return res.status(403).json({ error: "Company context missing. Access denied." });
        }
    }
    next();
};

/**
 * Helper to ensure company_id is present in query parameters
 * @param {string} query 
 * @param {Array} params 
 * @param {Object} req 
 */
export const enforceCompanyScope = (query, params, req) => {
    const companyId = req.company_id;
    
    // Check if company_id is already in params
    // This is a simple helper; in production, manual verification in each route is safer.
    if (!query.toLowerCase().includes('company_id')) {
        console.warn(`⚠️ Query missing company_id filter: ${query}`);
    }
    
    return { query, params };
};

/**
 * SQL for Audit Trigger (Run this in PostgreSQL)
 * 
 * CREATE OR REPLACE FUNCTION audit_log_changes() RETURNS TRIGGER AS $$
 * BEGIN
 *     INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_data, new_data)
 *     VALUES (
 *         COALESCE(NEW.company_id, OLD.company_id), 
 *         current_setting('app.current_user_id', true)::integer, 
 *         TG_OP, 
 *         TG_TABLE_NAME, 
 *         COALESCE(NEW.id, OLD.id), 
 *         row_to_json(OLD), 
 *         row_to_json(NEW)
 *     );
 *     RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 * 
 * CREATE TRIGGER trg_audit_invoices AFTER UPDATE OR INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
 */
