// backend/database/schemaUpdates.js
import { syncTable } from "../utils/dbSchemaManager.js";
import { schemaDefinition } from "./schemaDef.js";

export async function runSchemaUpdates() {
    console.log("⏳ Syncing Database Schema...");
    
    const tables = Object.keys(schemaDefinition);
    
    for (const tableName of tables) {
        console.log(`   🔸 Syncing table: ${tableName}`);
        await syncTable(tableName, schemaDefinition[tableName]);
        console.log(`   🔹 Finished syncing: ${tableName}`);
    }
    
    console.log("✨ Schema Sync Complete.");
}

// Check if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runSchemaUpdates()
        .then(() => {
            console.log("✅ Standalone Migration Successful");
            process.exit(0);
        })
        .catch(err => {
            console.error("❌ Standalone Migration Failed:", err);
            process.exit(1);
        });
}