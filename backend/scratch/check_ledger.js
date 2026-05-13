import db from '../database/pg.js';
import { getAccountByCode } from '../utils/accountingEngine.js';

async function checkLedger() {
    try {
        // 1. Check ledger_entries joined to transactions for PURCHASE_BILL
        console.log("\n=== LEDGER ENTRIES FOR PURCHASE_BILL ===");
        const entries = await db.pgAll(`
            SELECT l.id, l.account_id, ca.name as account_name, ca.account_type,
                   l.debit, l.credit, l.entry_date, t.reference_type, t.reference_id
            FROM ledger_entries l
            JOIN transactions t ON l.transaction_id = t.id
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            WHERE t.reference_type = 'PURCHASE_BILL'
            ORDER BY l.id DESC LIMIT 20
        `);
        if (entries.length === 0) {
            console.log("❌ EMPTY — No ledger entries found for PURCHASE_BILL");
        } else {
            console.table(entries);
        }

        // 2. Check all transactions
        console.log("\n=== TRANSACTIONS WITH REFERENCE_TYPE=PURCHASE_BILL ===");
        const txs = await db.pgAll(`
            SELECT id, company_id, branch_id, reference_type, reference_id, description, status, created_at
            FROM transactions WHERE reference_type = 'PURCHASE_BILL' ORDER BY id DESC LIMIT 10
        `);
        if (txs.length === 0) {
            console.log("❌ EMPTY — No transactions with reference_type=PURCHASE_BILL");
        } else {
            console.table(txs);
        }

        // 3. Latest purchase bills
        console.log("\n=== LATEST PURCHASE BILLS ===");
        const bills = await db.pgAll(`
            SELECT id, bill_number, company_id, supplier_id, sub_total, tax_total, total_amount, paid_amount, status, created_at
            FROM purchase_bills ORDER BY id DESC LIMIT 10
        `);
        console.table(bills);

        // 4. Test getAccountByCode for critical codes (company_id=1)
        console.log("\n=== getAccountByCode CORRECTNESS TEST (company_id=1) ===");
        const testCodes = ['1000', '1200', '2000', '2200', '5000'];
        for (const code of testCodes) {
            const acc = await getAccountByCode(1, code);
            const expected = { '1000': 'ASSET', '1200': 'ASSET', '2000': 'LIABILITY', '2200': 'ASSET', '5000': 'EXPENSE' };
            const ok = acc && acc.account_type.toUpperCase() === expected[code];
            console.log(`Code ${code}: id=${acc?.id} name="${acc?.name}" type=${acc?.account_type} ${ok ? '✅' : '❌ WRONG TYPE'}`);
        }

        // 5. Chart of accounts for company_id=1
        console.log("\n=== CHART OF ACCOUNTS FOR COMPANY 1 (all codes) ===");
        const coa = await db.pgAll(`
            SELECT id, company_id, account_code, name, account_type, current_balance 
            FROM chart_of_accounts WHERE company_id = 1 
            AND account_code IN ('1000','1100','1200','2000','2100','2200','4000','5000')
            ORDER BY account_code, id
        `);
        console.table(coa);

    } catch (err) {
        console.error("Diagnostic error:", err.message, err.stack);
    } finally {
        process.exit(0);
    }
}

checkLedger();
