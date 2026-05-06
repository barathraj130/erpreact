import { runSchemaUpdates } from "./database/schemaUpdates.js";
runSchemaUpdates()
    .then(() => {
        console.log("✅ Migration Successful");
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ Migration Failed:", err);
        process.exit(1);
    });
