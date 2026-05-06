import { createTransaction, getAccountBalance } from "./utils/accountingEngine.js";
import * as db from "./database/pg.js";

async function testAccounting() {
    console.log("🚀 Testing Accounting Engine...");
    try {
        // 1. Get IDs for Cash and Sales
        const cashAcc = await db.pgGet("SELECT id FROM chart_of_accounts WHERE account_code = '1000'");
        const salesAcc = await db.pgGet("SELECT id FROM chart_of_accounts WHERE account_code = '4000'");

        if (!cashAcc || !salesAcc) {
            console.error("❌ Accounts not found. Please run seed script first.");
            process.exit(1);
        }

        console.log("✅ Found accounts:", { cashAcc, salesAcc });

        // 2. Create a Test Transaction (Cash Sale of 500)
        const txId = await createTransaction({
            company_id: 1,
            branch_id: 1,
            transaction_date: new Date(),
            description: "Test Cash Sale",
            reference_type: "TEST",
            reference_id: 999,
            created_by: 1
        }, [
            { account_id: cashAcc.id, debit_amount: 500, credit_amount: 0, description: "Received Cash" },
            { account_id: salesAcc.id, debit_amount: 0, credit_amount: 500, description: "Revenue Recognized" }
        ]);

        console.log("✅ Transaction Created. ID:", txId);

        // 3. Verify Balances
        const cashBalance = await getAccountBalance(cashAcc.id);
        const salesBalance = await getAccountBalance(salesAcc.id);

        console.log("📊 Balances after tx:", { cashBalance, salesBalance });

        if (parseFloat(cashBalance) === 500 && parseFloat(salesBalance) === -500) {
            console.log("✨ ACCOUNTING ENGINE VALIDATED!");
        } else {
            console.warn("⚠️ Balance mismatch. Check logic.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Test Failed:", err);
        process.exit(1);
    }
}

testAccounting();
