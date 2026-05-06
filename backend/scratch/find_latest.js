
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    user: 'erpuser',
    host: '127.0.0.1',
    database: 'erpdb',
    password: 'erp123',
    port: 5432,
});

async function findLatest() {
    await client.connect();
    try {
        const companies = await client.query(`SELECT id, company_name FROM companies`);
        console.log("--- Companies ---");
        console.table(companies.rows);

        const branches = await client.query(`SELECT id, company_id, branch_name FROM branches ORDER BY id DESC LIMIT 5`);
        console.log("--- Latest Branches ---");
        console.table(branches.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findLatest();
