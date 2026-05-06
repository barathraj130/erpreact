// backend/scripts/seedERP.js
import * as db from '../database/pg.js';

async function seedERP() {
    console.log("🚀 Seeding ERP Subscription Plans and Initial Branches...");

    try {
        // 1. Create Default Plans
        const plans = [
            {
                plan_name: 'Starter Plan',
                enabled_modules: 'sales,inventory,reports',
                max_branches: 1,
                max_users: 5,
                ai_enabled: false,
                analytics_enabled: false,
                storage_limit_gb: 1,
                expiry_date: '2030-01-01',
                status: 'ACTIVE'
            },
            {
                plan_name: 'Professional Plan',
                enabled_modules: 'sales,inventory,finance,hr,reports',
                max_branches: 5,
                max_users: 25,
                ai_enabled: false,
                analytics_enabled: true,
                storage_limit_gb: 10,
                expiry_date: '2030-01-01',
                status: 'ACTIVE'
            },
            {
                plan_name: 'Enterprise Plan',
                enabled_modules: 'sales,inventory,finance,hr,reports,ai,analytics',
                max_branches: 100,
                max_users: 1000,
                ai_enabled: true,
                analytics_enabled: true,
                storage_limit_gb: 100,
                expiry_date: '2030-01-01',
                status: 'ACTIVE'
            }
        ];

        for (const plan of plans) {
            const exists = await db.pgGet('SELECT id FROM subscriptions WHERE plan_name = $1', [plan.plan_name]);
            if (!exists) {
                await db.pgRun(`
                    INSERT INTO subscriptions (plan_name, enabled_modules, max_branches, max_users, ai_enabled, analytics_enabled, storage_limit_gb, expiry_date, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [plan.plan_name, plan.enabled_modules, plan.max_branches, plan.max_users, plan.ai_enabled, plan.analytics_enabled, plan.storage_limit_gb, plan.expiry_date, plan.status]);
                console.log(`✅ Created plan: ${plan.plan_name}`);
            }
        }

        // 2. Assign Enterprise Plan to Company 1 (Default)
        const enterprisePlan = await db.pgGet('SELECT id FROM subscriptions WHERE plan_name = $1', ['Enterprise Plan']);
        if (enterprisePlan) {
            await db.pgRun('UPDATE companies SET subscription_id = $1 WHERE id = 1', [enterprisePlan.id]);
            console.log("✅ Assigned Enterprise Plan to Company 1");
        }

        // 3. Create Initial Branches for Company 1
        const branches = [
            { name: 'Headquarters', code: 'HQ-01', location: 'Main Street, Tech Park' },
            { name: 'North Branch', code: 'BR-NO', location: 'Industrial Area Phase 1' },
            { name: 'Warehouse A', code: 'WH-A', location: 'Suburban Logistics Hub' }
        ];

        for (const branch of branches) {
            const exists = await db.pgGet('SELECT id FROM branches WHERE branch_code = $1 AND company_id = 1', [branch.code]);
            if (!exists) {
                await db.pgRun(`
                    INSERT INTO branches (company_id, branch_name, branch_code, location, is_active)
                    VALUES (1, $1, $2, $3, TRUE)
                `, [branch.name, branch.code, branch.location]);
                console.log(`✅ Created branch: ${branch.name}`);
            }
        }

        // 4. Create Standard Chart of Accounts for Company 1
        const accounts = [
            // ASSETS
            { code: '1000', name: 'Cash in Hand', type: 'ASSET' },
            { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
            { code: '1200', name: 'Inventory Asset', type: 'ASSET' },
            { code: '1300', name: 'Bank Account - Main', type: 'ASSET' },
            // LIABILITIES
            { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
            { code: '2100', name: 'GST Payable', type: 'LIABILITY' },
            { code: '2200', name: 'Salary Payable', type: 'LIABILITY' },
            // EQUITY
            { code: '3000', name: "Owner's Equity", type: 'EQUITY' },
            { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
            // INCOME
            { code: '4000', name: 'Sales Revenue', type: 'INCOME' },
            { code: '4100', name: 'Other Income', type: 'INCOME' },
            // EXPENSES
            { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
            { code: '5100', name: 'Office Rent', type: 'EXPENSE' },
            { code: '5200', name: 'Electricity Expense', type: 'EXPENSE' },
            { code: '5300', name: 'Wages & Salaries', type: 'EXPENSE' }
        ];

        for (const account of accounts) {
            const exists = await db.pgGet('SELECT id FROM chart_of_accounts WHERE account_code = $1 AND company_id = 1', [account.code]);
            if (!exists) {
                await db.pgRun(`
                    INSERT INTO chart_of_accounts (company_id, account_code, name, account_type, opening_balance, current_balance)
                    VALUES (1, $1, $2, $3, 0, 0)
                `, [account.code, account.name, account.type]);
                console.log(`✅ Created account: ${account.name}`);
            }
        }

        console.log("✨ ERP Seeding Complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding Failed:", error);
        process.exit(1);
    }
}

seedERP();
