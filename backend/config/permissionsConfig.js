// backend/config/permissionsConfig.js

export const SYSTEM_ROLES = ['admin', 'manager', 'staff', 'accountant', 'sales', 'viewer'];

export const ALL_PERMISSIONS = [
    // --- SALES / CUSTOMERS ---
    { module: 'Sales', action: 'view_customers', description: 'View Customers List' },
    { module: 'Sales', action: 'manage_customers', description: 'Add/Edit Customers' },
    { module: 'Sales', action: 'view_invoices', description: 'View Invoices' },
    { module: 'Sales', action: 'create_invoices', description: 'Create Invoices' },
    { module: 'Sales', action: 'edit_invoices', description: 'Edit Invoices' },
    { module: 'Sales', action: 'delete_invoices', description: 'Delete Invoices' },

    // --- PURCHASES ---
    { module: 'Purchases', action: 'view_bills', description: 'View Purchase Bills' },
    { module: 'Purchases', action: 'create_bills', description: 'Record Purchase Bills' },

    // --- INVENTORY ---
    { module: 'Inventory', action: 'view_products', description: 'View Inventory' },
    { module: 'Inventory', action: 'manage_stock', description: 'Add/Edit Products' },

    // --- FINANCE ---
    { module: 'Finance', action: 'view_ledger', description: 'View Ledgers & Transactions' },
    { module: 'Finance', action: 'manage_transactions', description: 'Record Journal/Receipts' },

    // --- HR ---
    { module: 'HR', action: 'view_employees', description: 'View Employee List' },
    { module: 'HR', action: 'manage_employees', description: 'Add/Edit Employees' },

    // --- SETTINGS ---
    { module: 'Settings', action: 'access_settings', description: 'Access System Settings' },
];

// Default logic: Admin gets everything automatically in the seeder.
// We DO NOT define hardcoded defaults for others anymore. 
// We let the Database (Matrix UI) decide.
export const ROLE_DEFAULTS = {
    'admin': ALL_PERMISSIONS
};