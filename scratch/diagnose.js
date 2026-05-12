
import * as db from '../backend/database/pg.js';

async function diagnose() {
    const companyId = 1; // change if needed

    console.log("=== INVOICE TABLE RAW DATA ===");
    const rawCount = await db.pgGet("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM invoices WHERE company_id = $1", [companyId]);
    console.log("ALL invoices (no filter):", rawCount);

    const isDeletedCheck = await db.pgGet("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM invoices WHERE company_id = $1 AND COALESCE(is_deleted, false) = false", [companyId]);
    console.log("With COALESCE(is_deleted,false)=false:", isDeletedCheck);

    const isDeletedStrictCheck = await db.pgGet("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM invoices WHERE company_id = $1 AND is_deleted = false", [companyId]);
    console.log("With is_deleted = false (strict):", isDeletedStrictCheck);

    const billPurposeCheck = await db.pgGet("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM invoices WHERE company_id = $1 AND COALESCE(bill_purpose,'') != 'name_only'", [companyId]);
    console.log("With bill_purpose filter:", billPurposeCheck);

    const isDeletedDistinct = await db.pgAll("SELECT is_deleted, COUNT(*) as cnt FROM invoices WHERE company_id = $1 GROUP BY is_deleted", [companyId]);
    console.log("is_deleted value distribution:", isDeletedDistinct);

    const branchCheck = await db.pgAll("SELECT branch_id, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM invoices WHERE company_id = $1 GROUP BY branch_id", [companyId]);
    console.log("By branch_id:", branchCheck);

    console.log("\n=== CASH LEDGER ===");
    const cash = await db.pgGet("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) as balance FROM cash_ledger WHERE company_id = $1", [companyId]);
    console.log("cash_ledger balance:", cash);

    const bank = await db.pgGet("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) as balance FROM bank_ledger WHERE company_id = $1", [companyId]);
    console.log("bank_ledger balance:", bank);

    console.log("\n=== OUTSTANDING ===");
    const outstanding = await db.pgGet("SELECT COALESCE(SUM(total_amount - paid_amount),0) as outstanding FROM invoices WHERE company_id = $1 AND total_amount > paid_amount", [companyId]);
    console.log("outstanding (no filters):", outstanding);
}

diagnose();
