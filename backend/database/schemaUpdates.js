// backend/database/schemaUpdates.js
import { syncTable } from "../utils/dbSchemaManager.js"; // Importing from UTILS
import { schemaDefinition } from "./schemaDef.js";

export async function runSchemaUpdates() {
    console.log("⏳ Syncing Database Schema...");
    
    const tables = Object.keys(schemaDefinition);
    
    for (const tableName of tables) {
        await syncTable(tableName, schemaDefinition[tableName]);
    }
    
    console.log("✨ Schema Sync Complete.");
}