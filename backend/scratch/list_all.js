
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    user: 'erpuser',
    host: '127.0.0.1',
    database: 'erpdb',
    password: 'erp123',
    port: 5432,
});

async function listAll() {
    await client.connect();
    try {
        const branches = await client.query(`SELECT id, branch_name, branch_code FROM branches`);
        console.log("--- Branches ---");
        console.table(branches.rows);

        const users = await client.query(`SELECT username, role, branch_id FROM users`);
        console.log("--- Users ---");
        console.table(users.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

listAll();
