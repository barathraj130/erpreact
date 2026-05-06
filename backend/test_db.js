
import pkg from 'pg';
const { Client } = pkg;

async function test() {
    const client = new Client({
        user: 'erpuser',
        password: 'erp123',
        host: '127.0.0.1',
        database: 'erpdb',
        port: 5432,
    });
    await client.connect();
    
    const companyId = 3;
    const branchId = 4;
    
    console.log("--- Testing Company 3, Branch 4 ---");
    
    const invoiceRes = await client.query(`
        SELECT 
            SUM(total_amount) as total_invoice,
            SUM(paid_amount) as total_payments
        FROM invoices WHERE company_id=$1 AND branch_id=$2
    `, [companyId, branchId]);
    console.log("Invoices:", invoiceRes.rows[0]);
    
    const cashRes = await client.query(`
        SELECT direction, SUM(amount) as total FROM cash_ledger WHERE company_id=$1 AND branch_id=$2 GROUP BY direction
    `, [companyId, branchId]);
    console.log("Cash:", cashRes.rows);
    
    const branchesRes = await client.query(`
        SELECT * FROM branches WHERE company_id = $1
    `, [companyId]);
    console.log("Branches Count:", branchesRes.rowCount);
    
    await client.end();
}

test();
