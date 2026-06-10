// backend/middlewares/auditLogMiddleware.js
// FIX: Correct path to PG module
const pgModule = require('../database/pg'); 

/**
 * Middleware to log API requests that potentially modify data (POST, PUT, DELETE).
 * This is simplified; a full implementation requires comparing before/after states.
 */
const auditLogMiddleware = async (req, res, next) => {
    const { method, originalUrl, body, ip } = req;
    const userId = req.user?.id;
    
    // Only log modifying requests
    if (['POST', 'PUT', 'DELETE'].includes(method) && !originalUrl.includes('/jwt-auth')) {
        
        // Determine entity type and ID (simple heuristic, could be improved)
        const parts = originalUrl.split('/').filter(p => p.length > 0);
        let entity_type = parts[1]; // e.g., 'products', 'users'
        let entity_id = parts.length > 2 && !isNaN(parseInt(parts[2])) ? parseInt(parts[2]) : null;
        
        const action = `${method} ${originalUrl}`;
        
        const logSql = `
            INSERT INTO audit_log (user_id_acting, action, entity_type, entity_id, details_after, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        try {
            // Log only critical info from the body, excluding large data (like file uploads)
            const details_after = JSON.stringify(body).substring(0, 1000); 
            
            await pgModule.pgRun(logSql, [
                userId, action, entity_type, entity_id, details_after, ip
            ]);
        } catch (error) {
            // WARN: Don't stop the request flow if audit logging fails
            console.warn(`[Audit Log Failed] ${error.message}`);
        }
    }
    
    next();
};

module.exports = {
    auditLogMiddleware
};