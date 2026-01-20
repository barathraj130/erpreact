import db from "../database/pg.js";

/**
 * Check if a table exists in PostgreSQL
 */
async function tableExists(tableName) {
    const sql = `
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        );
    `;
    const result = await db.pgGet(sql, [tableName]);
    return result?.exists || false;
}

/**
 * Check if a column exists in a table
 */
async function columnExists(tableName, columnName) {
    const sql = `
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        );
    `;
    const result = await db.pgGet(sql, [tableName, columnName]);
    return result?.exists || false;
}

/**
 * Main Sync Function:
 * 1. Creates table if it doesn't exist.
 * 2. Adds columns if they are missing (Dynamic Evolution).
 * 
 * @param {string} tableName - Name of the table (e.g., 'users')
 * @param {object} columnsDef - Object definition (e.g., { username: 'TEXT', age: 'INTEGER' })
 */
export async function syncTable(tableName, columnsDef) {
    
    // --- 1. Create Table if Missing ---
    if (!(await tableExists(tableName))) {
        console.log(`🛠️  Creating missing table: ${tableName}...`);
        
        // Convert object { id: "SERIAL...", name: "TEXT" } -> Array ["id SERIAL...", "name TEXT"]
        const colDefinitions = Object.entries(columnsDef)
            .map(([colName, colType]) => `${colName} ${colType}`)
            .join(", ");
            
        const createSql = `CREATE TABLE ${tableName} (${colDefinitions});`;
        
        try {
            await db.pgRun(createSql);
            console.log(`✅ Table '${tableName}' created successfully.`);
        } catch (err) {
            console.error(`❌ Failed to create table '${tableName}':`, err.message);
        }
    } 
    else {
        // --- 2. Table Exists -> Check for Missing Columns ---
        // This makes it "Dynamic" - adding a key to your schema adds a column to DB
        for (const [colName, colType] of Object.entries(columnsDef)) {
            if (!(await columnExists(tableName, colName))) {
                console.log(`🔄 Detected new field. Adding column '${colName}' to '${tableName}'...`);
                
                try {
                    // Clean up type for ALTER command 
                    // (ALTER TABLE cannot use 'SERIAL' or 'PRIMARY KEY' easily on existing data)
                    let cleanType = colType;
                    
                    if (colType.includes("PRIMARY KEY")) cleanType = colType.replace("PRIMARY KEY", "").trim();
                    if (colType.includes("SERIAL")) cleanType = "INTEGER"; 

                    await db.pgRun(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${cleanType};`);
                    console.log(`✅ Column '${colName}' added.`);
                } catch (err) {
                    console.error(`❌ Failed to add column '${colName}':`, err.message);
                }
            }
        }
    }
}