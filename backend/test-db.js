import * as db from "./database/pg.js";
console.log("Testing DB connection...");
try {
    const res = await db.pgGet("SELECT NOW()");
    console.log("DB Success:", res.now);
    process.exit(0);
} catch (err) {
    console.error("DB Error:", err);
    process.exit(1);
}
