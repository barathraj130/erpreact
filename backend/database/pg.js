// backend/database/pg.js
// COMPLETE VERSION - Fixed with getClient export for transactions

import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

let pool;

try {
    const config = {
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT || 5432,
        ssl: process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false
    };

    if (!config.user || !config.host || !config.database) {
        console.warn("⚠️  PG Config missing. Check .env variables.");
    }

    pool = new Pool(config);

    pool.on("error", (err) => {
        console.error("❌ Unexpected error on idle client:", err.message);
    });

    console.log("✅ PostgreSQL pool initialized.");
} catch (err) {
    console.error("❌ Failed to initialize PG Pool:", err.message);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Execute SELECT query returning multiple rows
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {array} Array of rows
 */
export const pgAll = async (text, params = []) => {
    const res = await pool.query(text, params);
    return res.rows;
};

/**
 * Execute SELECT query returning single row
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {object|undefined} Single row object or undefined
 */
export const pgGet = async (text, params = []) => {
    const res = await pool.query(text, params);
    return res.rows[0];
};

/**
 * Execute INSERT/UPDATE/DELETE query
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {object} Object with rowCount and rows
 */
export const pgRun = async (text, params = []) => {
    const res = await pool.query(text, params);
    return { rowCount: res.rowCount, rows: res.rows };
};

/**
 * Get a client from the pool for manual transaction control
 * IMPORTANT: Always call client.release() when done!
 * 
 * Usage:
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   // ... your queries ...
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 * 
 * @returns {object} PostgreSQL client
 */
export const getClient = async () => {
    return await pool.connect();
};

/**
 * Direct query function (for compatibility)
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {object} Query result
 */
export const query = async (text, params = []) => {
    return await pool.query(text, params);
};

// ============================================
// EXPORTS
// ============================================

// Export pool for direct access
export { pool };

// Default export - required by some legacy files
export default {
    pool,
    query,
    pgAll,
    pgGet,
    pgRun,
    getClient
};