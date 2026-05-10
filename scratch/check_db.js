
import * as db from '../backend/database/pg.js';

async function check() {
    try {
        const invCount = await db.pgGet('SELECT COUNT(*) FROM invoices');
        const invBranchCount = await db.pgAll('SELECT branch_id, COUNT(*) FROM invoices GROUP BY branch_id');
        const cashCount = await db.pgGet('SELECT COUNT(*) FROM cash_ledger');
        const bankCount = await db.pgGet('SELECT COUNT(*) FROM bank_ledger');
        
        const productCount = await db.pgGet('SELECT COUNT(*) FROM products');
        const activeProductCount = await db.pgGet('SELECT COUNT(*) FROM products WHERE is_active = 1');
        
        console.log("Total Invoices:", invCount.count);
        console.log("Invoices by Branch:", invBranchCount);
        console.log("Cash Ledger Entries:", cashCount.count);
        console.log("Bank Ledger Entries:", bankCount.count);
        console.log("Total Products:", productCount.count);
        console.log("Active Products:", activeProductCount.count);



    } catch (err) {
        console.error(err);
    }
}
check();
