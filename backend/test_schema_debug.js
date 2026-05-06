import { schemaDefinition } from "./database/schemaDef.js";
import { syncTable } from "./utils/dbSchemaManager.js";

async function runSchemaUpdatesDebug() {
    console.log("⏳ Syncing Database Schema (DEBUG)...");
    
    const tables = Object.keys(schemaDefinition);
    
    for (const tableName of tables) {
        console.log(`   🔸 Syncing table: ${tableName}`);
        try {
            await syncTable(tableName, schemaDefinition[tableName]);
            console.log(`   🔹 Finished syncing: ${tableName}`);
        } catch (err) {
            console.error(`   ❌ Error syncing ${tableName}:`, err);
        }
    }
    
    console.log("✨ Schema Sync Complete.");
}

console.log("Starting debug execution...");
try {
    await runSchemaUpdatesDebug();
    console.log("Done");
} catch (err) {
    console.error("Exec Error:", err);
}
process.exit(0);
