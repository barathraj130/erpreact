// backend/config/permissionModulesSeed.js
// Canonical list of permission modules shown on the User Permissions matrix.
// Shared between the startup schema seeder (schemaUpdates.js) and the
// self-healing fallback in adminRoutes.js so both stay in sync.

export const PERMISSION_MODULES = [
    { module_key: 'dashboard',            module_name: 'Dashboard',              category: 'Overview',   display_order: 1 },
    { module_key: 'invoices',             module_name: 'Invoices / Sales',       category: 'Sales',      display_order: 2 },
    { module_key: 'customers',            module_name: 'Customers',              category: 'Sales',      display_order: 3 },
    { module_key: 'sales_returns',        module_name: 'Sales Returns',          category: 'Sales',      display_order: 4 },
    { module_key: 'delivery_orders',      module_name: 'Delivery Orders',        category: 'Sales',      display_order: 5 },
    { module_key: 'branch_billing',       module_name: 'Branch Billing',         category: 'Sales',      display_order: 6 },
    { module_key: 'brokers',              module_name: 'Brokers',                category: 'Sales',      display_order: 7 },
    { module_key: 'purchase_bills',       module_name: 'Purchase Bills',         category: 'Purchases',  display_order: 8 },
    { module_key: 'suppliers',            module_name: 'Suppliers',              category: 'Purchases',  display_order: 9 },
    { module_key: 'inventory',            module_name: 'Inventory',              category: 'Stock',      display_order: 10 },
    { module_key: 'stock_management',     module_name: 'Stock Management',       category: 'Stock',      display_order: 11 },
    { module_key: 'production_lots',      module_name: 'Production Lots',        category: 'Stock',      display_order: 12 },
    { module_key: 'production_inventory', module_name: 'Production Inventory',   category: 'Stock',      display_order: 13 },
    { module_key: 'cash_ledger',          module_name: 'Cash Ledger',            category: 'Finance',    display_order: 14 },
    { module_key: 'bank_ledger',          module_name: 'Bank Ledger',            category: 'Finance',    display_order: 15 },
    { module_key: 'ledgers',              module_name: 'Ledgers',                category: 'Finance',    display_order: 16 },
    { module_key: 'receipts',             module_name: 'Receipts',               category: 'Finance',    display_order: 17 },
    { module_key: 'finance_reports',      module_name: 'Finance Reports',        category: 'Finance',    display_order: 18 },
    { module_key: 'loans',                module_name: 'Loans',                  category: 'Finance',    display_order: 19 },
    { module_key: 'lenders',              module_name: 'Lenders',                category: 'Finance',    display_order: 20 },
    { module_key: 'chits',                module_name: 'Chits',                  category: 'Finance',    display_order: 21 },
    { module_key: 'proprietor_account',   module_name: 'Proprietor Account',     category: 'Finance',    display_order: 22 },
    { module_key: 'transactions',         module_name: 'Transactions',           category: 'Finance',    display_order: 23 },
    { module_key: 'approve_expenses',     module_name: 'Approve Expenses',       category: 'Finance',    display_order: 24 },
    { module_key: 'employees',            module_name: 'Employees',              category: 'HR',         display_order: 24 },
    { module_key: 'attendance',           module_name: 'Attendance',             category: 'HR',         display_order: 25 },
    { module_key: 'salary',               module_name: 'Salary / Payroll',       category: 'HR',         display_order: 26 },
    { module_key: 'reports',              module_name: 'Reports',                category: 'Analytics',  display_order: 27 },
    { module_key: 'gst_reports',          module_name: 'GST Reports',            category: 'Analytics',  display_order: 28 },
    { module_key: 'user_management',      module_name: 'User Management',        category: 'System',     display_order: 29 },
    { module_key: 'admin_setup',          module_name: 'Admin Setup',            category: 'System',     display_order: 30 },
];

/**
 * Idempotently inserts PERMISSION_MODULES into permission_modules.
 * Safe to call repeatedly — existing rows (matched by module_key) are left untouched.
 * @param {{ pgRun: Function }} db
 */
export const seedPermissionModules = async (db) => {
    for (const m of PERMISSION_MODULES) {
        await db.pgRun(
            `INSERT INTO permission_modules (module_key, module_name, category, display_order)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (module_key) DO NOTHING`,
            [m.module_key, m.module_name, m.category, m.display_order]
        );
    }
};

const SYSTEM_TEMPLATES = [
    { name: 'Full Admin',     desc: 'Complete access to everything' },
    { name: 'Sales Staff',    desc: 'Invoices, customers, returns only' },
    { name: 'Purchase Staff', desc: 'Purchase bills, suppliers, inventory only' },
    { name: 'Accountant',     desc: 'Finance, reports, ledgers only' },
    { name: 'Branch Cashier', desc: 'Billing interface only, no admin panel' },
];

const SYSTEM_TEMPLATE_ITEMS = [
    { template: 'Sales Staff',    modules: ['dashboard', 'invoices', 'customers', 'sales_returns', 'delivery_orders'], can_edit: true },
    { template: 'Purchase Staff', modules: ['dashboard', 'purchase_bills', 'suppliers', 'inventory', 'production_lots', 'production_inventory'], can_edit: true },
    { template: 'Accountant',     modules: ['dashboard', 'cash_ledger', 'bank_ledger', 'finance_reports', 'loans', 'lenders', 'proprietor_account', 'transactions', 'reports', 'gst_reports'], can_edit: true },
    { template: 'Branch Cashier', modules: ['invoices', 'customers'], can_edit: false },
];

/**
 * Idempotently inserts the system permission_templates and their permission_template_items.
 * Requires permission_modules to already be seeded (template items reference module_key).
 * @param {{ pgRun: Function, pgGet: Function, pgAll: Function }} db
 */
export const seedPermissionTemplates = async (db) => {
    for (const t of SYSTEM_TEMPLATES) {
        const existing = await db.pgGet(
            `SELECT id FROM permission_templates WHERE template_name = $1 AND is_system = true`,
            [t.name]
        );
        if (existing) continue;
        await db.pgRun(
            `INSERT INTO permission_templates (template_name, description, is_system) VALUES ($1, $2, true)`,
            [t.name, t.desc]
        );
    }

    for (const item of SYSTEM_TEMPLATE_ITEMS) {
        const template = await db.pgGet(
            `SELECT id FROM permission_templates WHERE template_name = $1 AND is_system = true`,
            [item.template]
        );
        if (!template) continue;

        const existing = await db.pgGet(
            `SELECT 1 FROM permission_template_items WHERE template_id = $1 LIMIT 1`,
            [template.id]
        );
        if (existing) continue;

        for (const moduleKey of item.modules) {
            const moduleExists = await db.pgGet(
                `SELECT 1 FROM permission_modules WHERE module_key = $1`,
                [moduleKey]
            );
            if (!moduleExists) continue;
            await db.pgRun(
                `INSERT INTO permission_template_items
                    (template_id, module_key, can_view, can_create, can_edit, can_delete)
                 VALUES ($1, $2, true, true, $3, false)`,
                [template.id, moduleKey, item.can_edit]
            );
        }
    }
};
