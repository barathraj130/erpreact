import * as db from '../backend/database/pg.js';
import { createTransaction, getAccountByCode } from '../backend/utils/accountingEngine.js';

async function testAccounting() {
    try {
        console.log("--- 🧪 Testing Accounting Engine ---");
        const companyId = 1;
        const branchId = 1;
        
        const cashAcc = await getAccountByCode(companyId, '1000');
        const salesAcc = await getAccountByCode(companyId, '4000');
        
        if (!cashAcc || !salesAcc) {
            console.error("Essential accounts missing:", { cashAcc, salesAcc });
            return;
        }

        const txData = {
            company_id: companyId,
            branch_id: branchId,
            transaction_date: new Date(),
            reference_type: 'TEST_TX',
            reference_id: 999,
            description: 'Test Accounting Entry',
            created_by: 1
        };

        const lines = [
            { account_id: cashAcc.id, debit_amount: 100, credit_amount: 0, description: 'Cash In' },
            { account_id: salesAcc.id, debit_amount: 0, credit_amount: 100, description: 'Sales Revenue' }
        ];

        console.log("Creating transaction...");
        const result = await createTransaction(txData, lines);
        console.log("Result:", result);

    } catch (err) {
        console.error("❌ Accounting Test Failed:", err);
    }
}

testAccounting();
