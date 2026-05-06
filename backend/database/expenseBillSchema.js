
/**
 * Expense Bills Schema Updates
 */

const expenseBillUpdates = [
    // 1. Tag purchase bills with category
    `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS bill_category VARCHAR(20) DEFAULT 'PRODUCT';`, // 'PRODUCT', 'EXPENSE'

    // 2. Table for expense line items
    `CREATE TABLE IF NOT EXISTS purchase_bill_expenses (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES purchase_bills(id) ON DELETE CASCADE,
        expense_type VARCHAR(100) NOT NULL,
        description TEXT,
        amount DECIMAL(15,2) NOT NULL,
        tax_percent DECIMAL(5,2) DEFAULT 0,
        cgst_amount DECIMAL(15,2) DEFAULT 0,
        sgst_amount DECIMAL(15,2) DEFAULT 0,
        igst_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // 3. Ensure chart of accounts has common expense codes
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Freight & Cartage Expense', '5010', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Labour Charges Expense', '5020', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Professional Fees Expense', '5030', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Rent Expense', '5040', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Utilities Expense', '5050', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Repairs & Maintenance', '5060', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Printing & Stationery', '5070', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Advertisement Expense', '5080', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Bank Charges Expense', '5090', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Insurance Expense', '5100', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`,
    `INSERT INTO chart_of_accounts (company_id, name, account_code, account_type)
     SELECT c.id, 'Miscellaneous Expense', '5999', 'Expense' FROM companies c
     ON CONFLICT DO NOTHING;`
];

export default expenseBillUpdates;
