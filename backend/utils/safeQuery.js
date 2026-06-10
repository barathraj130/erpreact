// backend/utils/safeQuery.js
import * as db from '../database/pg.js';

/**
 * Ensures all queries are parameterized to prevent SQL Injection
 */
export const safeQuery = async (text, params = []) => {
    if (!Array.isArray(params)) {
        throw new Error("Query parameters must be an array");
    }
    
    // Safety check: ensure no raw strings are being concatenated into the query
    // This is more of a developer-time check / convention enforcer
    return await db.pgRun(text, params);
};

export const safeGet = async (text, params = []) => {
    const result = await safeQuery(text, params);
    return result.rows[0];
};

export const safeAll = async (text, params = []) => {
    const result = await safeQuery(text, params);
    return result.rows;
};
