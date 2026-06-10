import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const client = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});
console.log("Connecting...");
try {
    await client.connect();
    console.log("Connected!");
    const res = await client.query('SELECT 1 as one');
    console.log("Result:", res.rows[0]);
    await client.end();
} catch (err) {
    console.error("Error:", err);
}
process.exit(0);
