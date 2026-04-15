import pkg from "pg";
const { Client } = pkg;
const client = new Client({
    user: 'erpuser',
    host: '127.0.0.1',
    database: 'erpdb',
    password: 'erp123',
    port: 5432,
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
