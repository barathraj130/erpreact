
import db from "./database/pg.js";

async function test() {
    console.log("Testing DB connection...");
    try {
        const result = await db.pgGet("SELECT NOW()");
        console.log("DB Success:", result);
    } catch (err) {
        console.error("DB Error:", err);
    }
    process.exit(0);
}

test();
