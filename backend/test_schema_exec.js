console.log("Testing runSchemaUpdates execution...");
import { runSchemaUpdates } from "./database/schemaUpdates.js";
try {
    await runSchemaUpdates();
    console.log("runSchemaUpdates finished successfully");
} catch (err) {
    console.error("runSchemaUpdates failed:", err);
}
process.exit(0);
