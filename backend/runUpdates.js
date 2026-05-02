// backend/runUpdates.js
import { runSchemaUpdates } from "./database/schemaUpdates.js";

async function main() {
    await runSchemaUpdates();
    process.exit(0);
}

main();
