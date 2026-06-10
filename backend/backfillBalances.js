// Backfill Balance Script
// Run this ONCE to update supplier and customer balances from existing bills/invoices

import * as db from './database/pg.js';

async function backfillBalances() {
    console.log("🔄 Starting balance backfill...");
    
    try {
        // 1. Update Supplier Balances from Purchase Bills
        console.log("\n📦 Updating supplier balances from purchase bills...");
        const updateSuppliersSql = `
            UPDATE lenders l
            SET current_balance = COALESCE((
                SELECT SUM(pb.total_amount)
                FROM purchase_bills pb
                WHERE pb.supplier_id = l.id
            ), 0)
        `;
        await db.pgRun(updateSuppliersSql);
        console.log("✅ Supplier balances updated");

        // 2. Update Customer Balances from Invoices
        console.log("\n📊 Updating customer balances from invoices...");
        const updateCustomersSql = `
            UPDATE users u
            SET initial_balance = COALESCE((
                SELECT SUM(i.total_amount)
                FROM invoices i
                WHERE i.customer_id = u.id
            ), 0)
        `;
        await db.pgRun(updateCustomersSql);
        console.log("✅ Customer balances updated");

        // 3. Backfill Transaction History for Purchase Bills
        console.log("\n📝 Creating transaction history for purchase bills...");
        const billTransactionsSql = `
            INSERT INTO transactions (company_id, lender_id, amount, type, category, date, description)
            SELECT 
                pb.company_id,
                pb.supplier_id,
                pb.total_amount,
                'BILL',
                'PURCHASE',
                pb.bill_date,
                CONCAT('Purchase Bill #', pb.bill_number)
            FROM purchase_bills pb
            WHERE NOT EXISTS (
                SELECT 1 FROM transactions t 
                WHERE t.type = 'BILL' 
                AND t.lender_id = pb.supplier_id 
                AND t.amount = pb.total_amount
                AND t.date = pb.bill_date
            )
        `;
        const billResult = await db.pgRun(billTransactionsSql);
        console.log(`✅ Created ${billResult.rowCount || 0} purchase bill transactions`);

        // 4. Backfill Transaction History for Invoices
        console.log("\n📝 Creating transaction history for invoices...");
        const invoiceTransactionsSql = `
            INSERT INTO transactions (company_id, user_id, amount, type, category, date, description, related_invoice_id)
            SELECT 
                i.company_id,
                i.customer_id,
                i.total_amount,
                'INVOICE',
                'SALES',
                i.invoice_date,
                CONCAT('Invoice #', i.invoice_number),
                i.id
            FROM invoices i
            WHERE NOT EXISTS (
                SELECT 1 FROM transactions t 
                WHERE t.type = 'INVOICE' 
                AND t.related_invoice_id = i.id
            )
        `;
        const invoiceResult = await db.pgRun(invoiceTransactionsSql);
        console.log(`✅ Created ${invoiceResult.rowCount || 0} invoice transactions`);

        // 5. Show summary
        console.log("\n📊 Balance Summary:");
        const suppliers = await db.pgAll("SELECT lender_name, current_balance FROM lenders ORDER BY lender_name");
        console.log("\nSuppliers:");
        suppliers.forEach(s => console.log(`  ${s.lender_name}: ₹${s.current_balance || 0}`));

        const customers = await db.pgAll("SELECT username, initial_balance FROM users WHERE role = 'customer' ORDER BY username");
        console.log("\nCustomers:");
        customers.forEach(c => console.log(`  ${c.username}: ₹${c.initial_balance || 0}`));

        console.log("\n✨ Backfill complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Backfill failed:", error);
        process.exit(1);
    }
}

backfillBalances();
