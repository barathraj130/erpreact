
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    user: 'erpuser',
    host: '127.0.0.1',
    database: 'erpdb',
    password: 'erp123',
    port: 5432,
});

async function findAdossBranch() {
    await client.connect();
    try {
        const res = await client.query(`
            SELECT id, branch_name, branch_code, company_id
            FROM branches
            WHERE branch_name ILIKE '%ADOSS%'
        `);
        console.table(res.rows);

        if (res.rows.length > 0) {
            const users = await client.query(`
                SELECT username, role, branch_id
                FROM users
                WHERE branch_id = $1
            `, [res.rows[0].id]);
            console.log("Users for this branch:");
            console.table(users.rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findAdossBranch();
