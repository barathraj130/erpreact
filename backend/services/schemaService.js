// backend/services/schemaService.js
import { pgAll } from '../database/pg.js';

/**
 * Dynamically retrieves the database schema including tables, columns, and relationships.
 * This is used to feed the AI context about the ERP structure.
 */
export const getDynamicSchema = async () => {
    try {
        // 1. Get all user tables (excluding system tables)
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `;
        const tables = await pgAll(tablesQuery);

        const schema = {};

        // 2. For each table, get columns and details
        for (const table of tables) {
            const tableName = table.table_name;
            
            const columnsQuery = `
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_name = $1
            `;
            const columns = await pgAll(columnsQuery, [tableName]);
            
            // 3. Get Foreign Key relationships for this table
            const relationshipsQuery = `
                SELECT
                    kcu.column_name, 
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;
            `;
            const relationships = await pgAll(relationshipsQuery, [tableName]);

            schema[tableName] = {
                columns: columns.map(col => ({
                    name: col.column_name,
                    type: col.data_type,
                    nullable: col.is_nullable === 'YES'
                })),
                relationships: relationships.map(rel => ({
                    column: rel.column_name,
                    referencesTable: rel.foreign_table_name,
                    referencesColumn: rel.foreign_column_name
                }))
            };
        }

        return schema;
    } catch (err) {
        console.error("Error fetching dynamic schema:", err);
        throw err;
    }
};
