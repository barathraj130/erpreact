console.log("--> Loading pg.js");
// backend/database/pg.js
// COMPLETE VERSION - Fixed with getClient export for transactions

import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

let pool;

try {
    let config;

    if (process.env.DATABASE_URL) {
        console.log("🔗 Using DATABASE_URL for connection.");
        config = {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
        };
    } else {
        config = {
            user: process.env.DB_USER || process.env.PG_USER,
            host: process.env.DB_HOST || process.env.PG_HOST || '127.0.0.1',
            database: process.env.DB_NAME || process.env.PG_DATABASE,
            password: process.env.DB_PASSWORD || process.env.PG_PASSWORD,
            port: parseInt(process.env.DB_PORT || process.env.PG_PORT || '5432'),
            ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
        };
        console.log(`📌 PG Config: host=${config.host}, port=${config.port}, db=${config.database}, user=${config.user}`);
    }

    if (!config.user || !config.host || !config.database) {
        console.warn("⚠️  PostgreSQL configuration variables missing in .env file.");
    }

    pool = new Pool(config);

    pool.on("error", (err) => {
        console.error("❌ Unexpected error on idle PostgreSQL client:", err.message);
    });

    console.log("✅ PostgreSQL pool initialized.");
} catch (err) {
    console.error("❌ Failed to initialize PostgreSQL Pool:", err.message);
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
 * Get a client from the pool for manual transaction control (BEGIN/COMMIT)
 * IMPORTANT: Always call client.release() in a finally block!
 * @returns {object} PostgreSQL connection client
 */
export const getClient = async () => {
    return await pool.connect();
};

/**
 * Direct query function for general purpose use
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {object} Query result object
 */
export const query = async (text, params = []) => {
    return await pool.query(text, params);
};

// ============================================
// EXPORTS
// ============================================

// Named export for direct pool access
export { pool };

// Default export for compatibility with "import db from ..." syntax
export default {
    pool,
    query,
    pgAll,
    pgGet,
    pgRun,
    getClient
};