console.log("Testing PG...");
import * as db from "./database/pg.js";
console.log("Imported PG");
try {
    console.log("Running query...");
    const res = await db.pgGet("SELECT 1 as one");
    console.log("Result:", res);
} catch (e) {
    console.error("Error:", e);
}
console.log("Done");
process.exit(0);
