import { pgGet } from "./database/pg.js";
try {
    const res = await pgGet("SELECT 1 as one");
    console.log("DB OK:", res);
} catch (e) {
    console.error("DB Error:", e);
}
process.exit(0);
