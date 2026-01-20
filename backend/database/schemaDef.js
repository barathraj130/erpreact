// backend/database/schemaDef.js

export const schemaDefinition = {
    // --- 1. CORE COMPANY SETUP ---
    companies: {
        id: "SERIAL PRIMARY KEY",
        company_name: "VARCHAR(255) NOT NULL UNIQUE",
        gstin: "VARCHAR(20) UNIQUE",
        address_line1: "TEXT",
        address_line2: "TEXT",
        city_pincode: "TEXT",
        state: "TEXT",
        state_code: "VARCHAR(5)",
        phone: "VARCHAR(20)",
        email: "VARCHAR(255)",
        bank_name: "TEXT",
        bank_account_no: "TEXT",
        bank_ifsc_code: "TEXT",
        logo_url: "TEXT",
        signature_url: "TEXT",
        default_tax_rate: "NUMERIC(5,2) DEFAULT 18",
        tax_filing_period: "VARCHAR(20) DEFAULT 'Monthly'",
        invoice_prefix: "VARCHAR(10) DEFAULT 'INV'",
        currency_symbol: "VARCHAR(5) DEFAULT '₹'",
        theme_color: "VARCHAR(20) DEFAULT 'blue'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 2. USERS (Auth + Customers) ---
    users: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER", 
        active_company_id: "INTEGER",
        employee_id: "INTEGER",
        username: "VARCHAR(255) NOT NULL UNIQUE", 
        nickname: "TEXT", 
        email: "VARCHAR(255)",
        password_hash: "TEXT",
        role_id: "INTEGER",
        role: "VARCHAR(50) NOT NULL DEFAULT 'user'",
        phone: "VARCHAR(20)",
        address_line1: "TEXT",
        address_line2: "TEXT",
        city_pincode: "TEXT",
        state: "TEXT",
        state_code: "VARCHAR(10)",
        gstin: "VARCHAR(20)",
        initial_balance: "NUMERIC(12,2) DEFAULT 0",
        bank_name: "TEXT",
        bank_account_no: "TEXT",
        bank_ifsc_code: "TEXT",
        signature_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 3. HR / EMPLOYEES ---
    employees: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        name: "VARCHAR(255) NOT NULL",
        designation: "VARCHAR(100)",
        email: "VARCHAR(255)",
        phone: "VARCHAR(20)",
        salary: "NUMERIC(12,2) DEFAULT 0",
        salary_type: "VARCHAR(20) DEFAULT 'Monthly'",
        joining_date: "DATE",
        status: "VARCHAR(20) DEFAULT 'Active'",
        signature_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 3A. SALARY ADVANCES
    salary_advances: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        employee_id: "INTEGER",
        amount: "NUMERIC(12,2) NOT NULL",
        advance_date: "DATE NOT NULL",
        reason: "TEXT",
        repayment_type: "VARCHAR(20)",
        installment_amount: "NUMERIC(12,2) DEFAULT 0",
        current_balance: "NUMERIC(12,2) NOT NULL",
        status: "VARCHAR(20) DEFAULT 'ACTIVE'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 3B. ADVANCE REPAYMENTS
    advance_repayments: {
        id: "SERIAL PRIMARY KEY",
        advance_id: "INTEGER", 
        payroll_id: "INTEGER",
        amount_deducted: "NUMERIC(12,2)",
        transaction_date: "DATE",
        type: "VARCHAR(20) DEFAULT 'DEDUCTION'",
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // ✅ NEW: 3C. ATTENDANCE LOGS (Updated with work_assigned)
    attendance_logs: {
        id: "SERIAL PRIMARY KEY",
        employee_id: "INTEGER",
        company_id: "INTEGER",
        date: "DATE NOT NULL",
        check_in_time: "TIME",
        check_out_time: "TIME",
        status: "VARCHAR(20) DEFAULT 'PRESENT'", // PRESENT, OD, LEAVE
        work_assigned: "TEXT", // ✅ Added Field
        method: "VARCHAR(20) DEFAULT 'QR_SCAN'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 3D. PAYROLL RUNS
    payroll_runs: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        employee_id: "INTEGER",
        month_year: "VARCHAR(20)",
        base_salary: "NUMERIC(12,2)",
        attendance_days: "NUMERIC(5,2)",
        gross_earnings: "NUMERIC(12,2)",
        total_deductions: "NUMERIC(12,2)",
        advance_deduction: "NUMERIC(12,2)",
        net_pay: "NUMERIC(12,2)",
        status: "VARCHAR(20) DEFAULT 'GENERATED'",
        generated_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 4. RBAC (Roles & Permissions) ---
    roles: {
        id: "SERIAL PRIMARY KEY",
        name: "VARCHAR(50) NOT NULL UNIQUE",
        description: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    permissions: {
        id: "SERIAL PRIMARY KEY",
        module: "VARCHAR(50) NOT NULL",
        action: "VARCHAR(50) NOT NULL",
        description: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    role_permissions: {
        role_id: "INTEGER NOT NULL",
        permission_id: "INTEGER NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 5. SUPPLIERS (Lenders) ---
    lenders: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        lender_name: "VARCHAR(255) NOT NULL",
        entity_type: "VARCHAR(50) DEFAULT 'General'",
        phone: "VARCHAR(20)",
        email: "VARCHAR(255)",
        contact_person: "TEXT",
        notes: "TEXT",
        initial_payable_balance: "NUMERIC(12,2) DEFAULT 0",
        bank_name: "TEXT",
        bank_account_no: "TEXT",
        bank_ifsc_code: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 6. TAX & COMPLIANCE ---
    tax_rates: {
        id: "SERIAL PRIMARY KEY",
        name: "VARCHAR(50)",
        type: "VARCHAR(20)",
        rate_percentage: "NUMERIC(5,2) NOT NULL",
        is_active: "BOOLEAN DEFAULT TRUE"
    },
    tax_filings: {
        id: "SERIAL PRIMARY KEY",
        period: "VARCHAR(20)",
        filing_type: "VARCHAR(20)",
        status: "VARCHAR(20)",
        filed_date: "DATE",
        acknowledgement_no: "TEXT",
        tax_amount_paid: "NUMERIC(12,2)",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 7. SYSTEM CONFIGS ---
    system_configs: {
        id: "SERIAL PRIMARY KEY",
        key: "VARCHAR(100) UNIQUE NOT NULL",
        value: "TEXT",
        category: "VARCHAR(50)",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 8. ACCOUNTING ---
    ledger_groups: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        name: "VARCHAR(255) NOT NULL",
        parent_id: "INTEGER",
        nature: "VARCHAR(50) NOT NULL",
        is_default: "BOOLEAN DEFAULT FALSE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    ledgers: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        name: "VARCHAR(255) NOT NULL",
        group_id: "INTEGER",
        opening_balance: "NUMERIC(12,2) DEFAULT 0",
        is_dr: "INTEGER DEFAULT 1",
        gstin: "VARCHAR(20)",
        state: "VARCHAR(100)",
        is_default: "BOOLEAN DEFAULT FALSE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    transactions: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        user_id: "INTEGER",
        lender_id: "INTEGER",
        ledger_id: "INTEGER",
        agreement_id: "INTEGER",
        related_invoice_id: "INTEGER",
        amount: "NUMERIC(12,2) NOT NULL",
        type: "VARCHAR(10) NOT NULL",
        description: "TEXT",
        category: "TEXT",
        date: "DATE NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 9. INVENTORY ---
    stock_units: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        name: "VARCHAR(50) NOT NULL"
    },
    products: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        name: "TEXT NOT NULL",
        sku: "TEXT",
        brand: "TEXT",
        hsn_code: "TEXT",
        unit: "TEXT",
        unit_id: "INTEGER",
        cost_price: "NUMERIC(12,2) DEFAULT 0",
        selling_price: "NUMERIC(12,2) NOT NULL DEFAULT 0",
        current_stock: "NUMERIC(12,2) DEFAULT 0",
        opening_stock: "NUMERIC(12,2) DEFAULT 0",
        min_stock: "NUMERIC(12,2)",
        low_stock_threshold: "INTEGER DEFAULT 0",
        reorder_level: "INTEGER DEFAULT 0",
        gst_percent: "NUMERIC(5,2)",
        barcode: "TEXT",
        is_active: "INTEGER DEFAULT 1",
        image_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },
    product_suppliers: {
        id: "SERIAL PRIMARY KEY",
        product_id: "INTEGER",
        supplier_id: "INTEGER",
        supplier_sku: "VARCHAR(50)",
        purchase_price: "NUMERIC(12,2)",
        is_preferred: "INTEGER DEFAULT 0",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 10. SALES (Invoices) ---
    invoices: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        customer_id: "INTEGER",
        bank_ledger_id: "INTEGER",
        invoice_number: "VARCHAR(100) UNIQUE NOT NULL",
        invoice_date: "DATE NOT NULL",
        due_date: "DATE",
        financial_month: "VARCHAR(20)",
        total_amount: "NUMERIC(12,2) DEFAULT 0",
        paid_amount: "NUMERIC(12,2) DEFAULT 0",
        amount_before_tax: "NUMERIC(12,2) DEFAULT 0",
        total_cgst_amount: "NUMERIC(12,2) DEFAULT 0",
        total_sgst_amount: "NUMERIC(12,2) DEFAULT 0",
        total_igst_amount: "NUMERIC(12,2) DEFAULT 0",
        status: "VARCHAR(50) DEFAULT 'Draft'",
        invoice_type: "VARCHAR(50) DEFAULT 'TAX_INVOICE'",
        invoice_category: "VARCHAR(50)",
        payment_mode: "VARCHAR(50)",
        transaction_ref: "TEXT",
        vehicle_number: "VARCHAR(50)",
        transport_mode: "VARCHAR(50)",
        place_of_supply: "TEXT",
        notes: "TEXT",
        is_digital_signed: "BOOLEAN DEFAULT FALSE",
        watermark_text: "TEXT",
        file_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },
    invoice_line_items: {
        id: "SERIAL PRIMARY KEY",
        invoice_id: "INTEGER REFERENCES invoices(id) ON DELETE CASCADE",
        product_id: "INTEGER",
        description: "TEXT",
        hsn_acs_code: "VARCHAR(50)",
        quantity: "NUMERIC(12,2) NOT NULL",
        unit_price: "NUMERIC(12,2) NOT NULL",
        taxable_value: "NUMERIC(12,2) DEFAULT 0",
        gst_rate: "NUMERIC(5,2) DEFAULT 0",
        cgst_rate: "NUMERIC(5,2) DEFAULT 0",
        sgst_rate: "NUMERIC(5,2) DEFAULT 0",
        igst_rate: "NUMERIC(5,2) DEFAULT 0",
        cgst_amount: "NUMERIC(12,2) DEFAULT 0",
        sgst_amount: "NUMERIC(12,2) DEFAULT 0",
        igst_amount: "NUMERIC(12,2) DEFAULT 0",
        line_total: "NUMERIC(12,2) NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 11. PURCHASES ---
    purchase_bills: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        supplier_id: "INTEGER",
        bill_number: "VARCHAR(100)",
        bill_date: "DATE",
        due_date: "DATE",
        total_amount: "NUMERIC(12,2) DEFAULT 0",
        status: "VARCHAR(50) DEFAULT 'PENDING'",
        file_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // --- 12. UTILS ---
    bank_details: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        bank_name: "VARCHAR(255) NOT NULL",
        account_number: "VARCHAR(50) NOT NULL",
        ifsc_code: "VARCHAR(20)",
        branch_name: "TEXT",
        account_type: "VARCHAR(50) DEFAULT 'Current'",
        is_default: "BOOLEAN DEFAULT FALSE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    notifications: {
        id: "SERIAL PRIMARY KEY",
        user_id: "INTEGER",
        message: "TEXT NOT NULL",
        type: "VARCHAR(50) DEFAULT 'info'",
        link: "TEXT",
        is_read: "BOOLEAN DEFAULT FALSE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    audit_log: {
        id: "SERIAL PRIMARY KEY",
        user_id_acting: "INTEGER",
        action: "VARCHAR(100)",
        entity_type: "VARCHAR(100)",
        entity_id: "INTEGER",
        details_after: "TEXT",
        ip_address: "VARCHAR(50)",
        timestamp: "TIMESTAMP DEFAULT NOW()"
    },
    business_agreements: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        lender_id: "INTEGER",
        agreement_type: "VARCHAR(50)",
        total_amount: "NUMERIC(12,2) NOT NULL",
        interest_rate: "NUMERIC(5,2) DEFAULT 0",
        emi_amount: "NUMERIC(12,2) DEFAULT 0",
        duration_months: "INTEGER DEFAULT 0",
        start_date: "DATE",
        status: "VARCHAR(50) DEFAULT 'Active'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    }
};