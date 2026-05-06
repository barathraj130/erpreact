
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    user: 'erpuser',
    host: '127.0.0.1',
    database: 'erpdb',
    password: 'erp123',
    port: 5432,
});

async function findBranchCreds() {
    await client.connect();
    try {
        const res = await client.query(`
            SELECT u.username, b.branch_name, b.branch_code
            FROM users u
            JOIN branches b ON u.branch_id = b.id
            WHERE b.branch_name = 'ADOSS'
        `);
        console.log("Branch Credentials Found:");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findBranchCreds();
