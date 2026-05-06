
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    user: 'erpuser',
    host: '127.0.0.1',
    database: 'erpdb',
    password: 'erp123',
    port: 5432,
});

async function findAdoss() {
    await client.connect();
    try {
        const res = await client.query(`
            SELECT u.id, u.username, u.role, u.branch_id, u.company_id, c.company_name, b.branch_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE u.username ILIKE '%Adoss%'
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findAdoss();
