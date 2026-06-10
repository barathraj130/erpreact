// backend/scripts/seedFinance.js
import * as db from '../database/pg.js';

const seed = async () => {
    const companyId = 1;
    console.log(`🌱 Seeding finance data for company ${companyId}...`);

    try {
        // 1. Ensure Standard Ledger Groups exist
        const groups = [
            { name: 'Bank Accounts', nature: 'Asset' },
            { name: 'Cash-in-Hand', nature: 'Asset' },
            { name: 'Direct Expenses', nature: 'Expense' },
            { name: 'Indirect Expenses', nature: 'Expense' },
            { name: 'Sales Accounts', nature: 'Income' },
            { name: 'Purchase Accounts', nature: 'Expense' },
            { name: 'Sundry Debtors', nature: 'Asset' },
            { name: 'Sundry Creditors', nature: 'Liability' }
        ];

        for (const g of groups) {
            const exists = await db.pgGet('SELECT id FROM ledger_groups WHERE name = $1 AND company_id = $2', [g.name, companyId]);
            if (!exists) {
                await db.pgRun('INSERT INTO ledger_groups (company_id, name, nature) VALUES ($1, $2, $3)', [companyId, g.name, g.nature]);
            }
        }

        // 2. Fetch group IDs
        const bankGroup = await db.pgGet('SELECT id FROM ledger_groups WHERE name = $1', ['Bank Accounts']);
        const cashGroup = await db.pgGet('SELECT id FROM ledger_groups WHERE name = $1', ['Cash-in-Hand']);
        const expenseGroup = await db.pgGet('SELECT id FROM ledger_groups WHERE name = $1', ['Direct Expenses']);

        // 3. Create Basic Ledgers
        const ledgers = [
            { name: 'Main Cash', group_id: cashGroup.id, opening_balance: 5000, is_dr: 1 },
            { name: 'ICICI Bank', group_id: bankGroup.id, opening_balance: 250000, is_dr: 1 },
            { name: 'Office Rent', group_id: expenseGroup.id, opening_balance: 0, is_dr: 1 },
            { name: 'Electricity Bill', group_id: expenseGroup.id, opening_balance: 0, is_dr: 1 }
        ];

        for (const l of ledgers) {
            const exists = await db.pgGet('SELECT id FROM ledgers WHERE name = $1 AND company_id = $2', [l.name, companyId]);
            if (!exists) {
                await db.pgRun(
                    'INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, $2, $3, $4, $5)',
                    [companyId, l.name, l.group_id, l.opening_balance, l.is_dr]
                );
            }
        }

        // 4. Add transactions for TODAY
        const today = new Date().toISOString().slice(0, 10);
        const cashLedger = await db.pgGet('SELECT id FROM ledgers WHERE name = $1', ['Main Cash']);
        const bankLedger = await db.pgGet('SELECT id FROM ledgers WHERE name = $1', ['ICICI Bank']);
        const rentLedger = await db.pgGet('SELECT id FROM ledgers WHERE name = $1', ['Office Rent']);

        const trans = [
            { desc: 'Cash Sales - General', amount: 1200, type: 'RECEIPT', ledger_id: cashLedger.id },
            { desc: 'Office Rent - Feb 2026', amount: 15000, type: 'PAYMENT', ledger_id: bankLedger.id },
            { desc: 'Tea & Snacks Exp', amount: 150, type: 'PAYMENT', ledger_id: cashLedger.id }
        ];

        for (const t of trans) {
            await db.pgRun(
                `INSERT INTO transactions (company_id, ledger_id, amount, description, type, date, category) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'General')`,
                [companyId, t.ledger_id, t.amount, t.desc, t.type, today]
            );
        }

        console.log('✅ Seeding complete!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        process.exit();
    }
};

seed();
