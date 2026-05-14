// backend/database/schemaDef.js

export const schemaDefinition = {
    // --- LOYALTY POINTS (Retail Customer Only) ---
    customer_points: {
        id: "SERIAL PRIMARY KEY",
        customer_id: "INTEGER NOT NULL",
        transaction_type: "VARCHAR(20) NOT NULL", // 'earned' / 'redeemed' / 'expired' / 'bonus'
        points: "INTEGER NOT NULL", // positive for earned/bonus, negative for redeemed/expired
        reference_id: "INTEGER", // invoice id
        description: "TEXT",
        balance_after: "INTEGER NOT NULL",
        expires_at: "TIMESTAMP",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    // --- 0. SUBSCRIPTIONS (ERP OWNER CONTROL) ---
    subscriptions: {
        id: "SERIAL PRIMARY KEY",
        plan_name: "VARCHAR(100) NOT NULL DEFAULT 'Enterprise'",
        enabled_modules: "TEXT", 
        max_branches: "INTEGER DEFAULT 1",
        max_users: "INTEGER DEFAULT 5",
        ai_enabled: "BOOLEAN DEFAULT FALSE",
        analytics_enabled: "BOOLEAN DEFAULT FALSE",
        storage_limit_gb: "INTEGER DEFAULT 1",
        expiry_date: "TIMESTAMP",
        status: "VARCHAR(20) DEFAULT 'ACTIVE'", 
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    companies: {
        id: "SERIAL PRIMARY KEY",
        company_name: "VARCHAR(255) NOT NULL UNIQUE",
        company_code: "VARCHAR(50) UNIQUE",
        subscription_id: "INTEGER",
        is_active: "BOOLEAN DEFAULT TRUE",
        status: "VARCHAR(20) DEFAULT 'ACTIVE'",
        gstin: "VARCHAR(20) UNIQUE",
        pan_number: "VARCHAR(20)", // Added
        company_type: "VARCHAR(50)", // Added
        financial_year_start_month: "INTEGER DEFAULT 4", // Added (1-12)
        default_currency: "VARCHAR(10) DEFAULT 'INR'", // Added
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

    branches: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_name: "VARCHAR(255) NOT NULL",
        branch_code: "VARCHAR(50)",
        location: "TEXT",
        address_line1: "TEXT", // Added
        city_pincode: "TEXT", // Added
        state: "TEXT", // Added
        state_code: "VARCHAR(5)", // Added
        manager_user_id: "INTEGER",
        is_active: "BOOLEAN DEFAULT TRUE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    users: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
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
        is_active: "BOOLEAN DEFAULT TRUE",
        failed_attempts: "INTEGER DEFAULT 0",
        lock_until: "TIMESTAMP",
        last_login: "TIMESTAMP",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    employees: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
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

    salary_advances: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
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

    attendance_logs: {
        id: "SERIAL PRIMARY KEY",
        employee_id: "INTEGER",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        date: "DATE NOT NULL",
        check_in_time: "TIME",
        check_out_time: "TIME",
        status: "VARCHAR(20) DEFAULT 'PRESENT'",
        work_assigned: "TEXT",
        method: "VARCHAR(20) DEFAULT 'QR_SCAN'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    payroll_runs: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
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

    salaries: {
        id: "SERIAL PRIMARY KEY",
        employee_id: "INTEGER",
        month: "VARCHAR(20)",
        base_salary: "NUMERIC(12,2)",
        bonus: "NUMERIC(12,2) DEFAULT 0",
        deductions: "NUMERIC(12,2) DEFAULT 0",
        advance_deducted: "NUMERIC(12,2) DEFAULT 0",
        final_salary: "NUMERIC(12,2)",
        status: "VARCHAR(20) DEFAULT 'UNPAID'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    salary_payments: {
        id: "SERIAL PRIMARY KEY",
        employee_id: "INTEGER",
        salary_id: "INTEGER", // Link to salary record
        amount: "NUMERIC(12,2)",
        mode: "VARCHAR(20)", // Cash / Bank
        transaction_id: "TEXT",
        bank_name: "TEXT",
        date: "DATE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

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
        opening_balance: "NUMERIC(15,2) DEFAULT 0",
        is_dr: "INTEGER DEFAULT 1",
        is_default: "BOOLEAN DEFAULT FALSE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    user_companies: {
        user_id: "INTEGER NOT NULL",
        company_id: "INTEGER NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    cash_ledger: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        source: "VARCHAR(50)", 
        amount: "NUMERIC(15,2)",
        direction: "VARCHAR(10)", 
        date: "DATE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    bank_ledger: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        bank_account_id: "INTEGER", // Reference to bank_details
        source: "VARCHAR(50)",
        amount: "NUMERIC(15,2)",
        direction: "VARCHAR(10)", 
        bank_name: "TEXT",
        transaction_id: "TEXT",
        date: "DATE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    lenders: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER",
        lender_name: "VARCHAR(255) NOT NULL",
        lender_type: "VARCHAR(50) DEFAULT 'Bank'", // Bank, Private Person, NBFC, Chit Company, Other
        contact_person: "VARCHAR(255)",
        phone: "VARCHAR(20)",
        email: "VARCHAR(255)",
        address: "TEXT",
        state: "VARCHAR(100)",
        state_code: "VARCHAR(10)",
        opening_balance: "NUMERIC(15,2) DEFAULT 0",
        current_balance: "NUMERIC(15,2) DEFAULT 0",
        notes: "TEXT",
        is_active: "BOOLEAN DEFAULT TRUE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    suppliers: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER",
        name: "VARCHAR(255) NOT NULL",
        contact_person: "VARCHAR(255)",
        phone: "VARCHAR(20)",
        email: "VARCHAR(255)",
        address: "TEXT",
        state: "VARCHAR(100)",
        state_code: "VARCHAR(10)",
        gstin: "VARCHAR(20)",
        opening_balance: "NUMERIC(15,2) DEFAULT 0",
        current_balance: "NUMERIC(15,2) DEFAULT 0",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    loans: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER",
        lender_id: "INTEGER REFERENCES lenders(id)",
        principal_amount: "NUMERIC(15,2) NOT NULL",
        interest_rate: "NUMERIC(5,2) NOT NULL",
        start_date: "DATE NOT NULL",
        repayment_cycle: "VARCHAR(20) DEFAULT 'MONTHLY'", // MONTHLY, WEEKLY
        status: "VARCHAR(20) DEFAULT 'ACTIVE'", // ACTIVE, CLOSED
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    loan_payments: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        loan_id: "INTEGER REFERENCES loans(id)",
        payment_date: "DATE NOT NULL",
        total_amount: "NUMERIC(15,2) NOT NULL",
        interest_component: "NUMERIC(15,2) DEFAULT 0",
        principal_component: "NUMERIC(15,2) DEFAULT 0",
        payment_mode: "VARCHAR(20) DEFAULT 'CASH'",
        transaction_id: "INTEGER", // Reference to transactions table
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

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

    system_configs: {
        id: "SERIAL PRIMARY KEY",
        key: "VARCHAR(100) UNIQUE NOT NULL",
        value: "TEXT",
        category: "VARCHAR(50)",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    chart_of_accounts: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        account_code: "VARCHAR(50) NOT NULL",
        name: "VARCHAR(255) NOT NULL",
        account_type: "VARCHAR(50) NOT NULL",
        parent_account_id: "INTEGER",
        opening_balance: "NUMERIC(15,2) DEFAULT 0",
        current_balance: "NUMERIC(15,2) DEFAULT 0",
        is_active: "BOOLEAN DEFAULT TRUE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    transactions: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER NOT NULL",
        transaction_date: "DATE NOT NULL",
        reference_type: "VARCHAR(50)",
        reference_id: "INTEGER",
        description: "TEXT",
        lender_id: "INTEGER",
        created_by: "INTEGER",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    transaction_lines: {
        id: "SERIAL PRIMARY KEY",
        transaction_id: "INTEGER REFERENCES transactions(id) ON DELETE CASCADE",
        account_id: "INTEGER REFERENCES chart_of_accounts(id)",
        debit_amount: "NUMERIC(15,2) DEFAULT 0",
        credit_amount: "NUMERIC(15,2) DEFAULT 0",
        description: "TEXT"
    },

    ledger_entries: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER NOT NULL",
        account_id: "INTEGER NOT NULL",
        transaction_id: "INTEGER NOT NULL",
        entry_date: "DATE NOT NULL",
        debit: "NUMERIC(15,2) DEFAULT 0",
        credit: "NUMERIC(15,2) DEFAULT 0",
        running_balance: "NUMERIC(15,2)",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    stock_units: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        name: "VARCHAR(50) NOT NULL"
    },
    products: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER",
        name: "TEXT NOT NULL",
        description: "TEXT",
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
        supplier_name: "TEXT",
        barcode: "TEXT",
        is_active: "INTEGER DEFAULT 1",
        image_url: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },
    product_suppliers: {
        id: "SERIAL PRIMARY KEY",
        product_id: "INTEGER",
        supplier_id: "INTEGER REFERENCES suppliers(id)",
        supplier_sku: "VARCHAR(50)",
        purchase_price: "NUMERIC(12,2)",
        is_preferred: "INTEGER DEFAULT 0",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    invoices: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        customer_id: "INTEGER",
        bank_ledger_id: "INTEGER",
        invoice_number: "VARCHAR(100) UNIQUE NOT NULL",
        invoice_date: "DATE NOT NULL",
        due_date: "DATE",
        sub_total: "NUMERIC(15,2) DEFAULT 0",
        tax_total: "NUMERIC(15,2) DEFAULT 0",
        cgst_total: "NUMERIC(15,2) DEFAULT 0",
        sgst_total: "NUMERIC(15,2) DEFAULT 0",
        igst_total: "NUMERIC(15,2) DEFAULT 0",
        total_amount: "NUMERIC(15,2) NOT NULL",
        gst_type: "VARCHAR(20)", // INTRA_STATE, INTER_STATE
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
        broker_id: "INTEGER",
        broker_commission_rate: "NUMERIC(5,2)",
        points_earned: "INTEGER DEFAULT 0",
        points_redeemed: "INTEGER DEFAULT 0",
        points_discount: "NUMERIC(10,2) DEFAULT 0",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },
    invoice_line_items: {
        id: "SERIAL PRIMARY KEY",
        invoice_id: "INTEGER REFERENCES invoices(id) ON DELETE CASCADE",
        product_id: "INTEGER",
        description: "TEXT",
        hsn_code: "VARCHAR(20)",
        quantity: "NUMERIC(12,2) NOT NULL",
        unit_price: "NUMERIC(15,2) NOT NULL",
        discount_percent: "NUMERIC(5,2) DEFAULT 0",
        tax_percent: "NUMERIC(5,2) DEFAULT 0",
        cgst_rate: "NUMERIC(5,2) DEFAULT 0",
        sgst_rate: "NUMERIC(5,2) DEFAULT 0",
        igst_rate: "NUMERIC(5,2) DEFAULT 0",
        cgst_amount: "NUMERIC(15,2) DEFAULT 0",
        sgst_amount: "NUMERIC(15,2) DEFAULT 0",
        igst_amount: "NUMERIC(15,2) DEFAULT 0",
        line_total: "NUMERIC(15,2) NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    invoice_payments: {
        id: "SERIAL PRIMARY KEY",
        invoice_id: "INTEGER REFERENCES invoices(id) ON DELETE CASCADE",
        amount: "NUMERIC NOT NULL",
        amount_paid: "NUMERIC DEFAULT 0",
        payment_method: "VARCHAR(50)",
        payment_date: "DATE DEFAULT CURRENT_DATE",
        reference_no: "TEXT",
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    purchase_bills: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        supplier_id: "INTEGER REFERENCES suppliers(id)",
        supplier_name: "TEXT",                          // Denormalized for display
        bill_number: "VARCHAR(100)",
        bill_date: "DATE",
        due_date: "DATE",
        sub_total: "NUMERIC(15,2) DEFAULT 0",
        tax_total: "NUMERIC(15,2) DEFAULT 0",
        cgst_total: "NUMERIC(15,2) DEFAULT 0",
        sgst_total: "NUMERIC(15,2) DEFAULT 0",
        igst_total: "NUMERIC(15,2) DEFAULT 0",
        total_amount: "NUMERIC(15,2) NOT NULL DEFAULT 0",
        gst_type: "VARCHAR(20)",                        // INTRA_STATE, INTER_STATE
        paid_amount: "NUMERIC(15,2) DEFAULT 0",
        balance_amount: "NUMERIC(15,2) DEFAULT 0",
        status: "VARCHAR(20) DEFAULT 'PENDING'",         // PENDING, PARTIAL, PAID
        bill_type: "VARCHAR(20) DEFAULT 'GST'",
        file_url: "TEXT",
        broker_id: "INTEGER",
        broker_commission_rate: "NUMERIC(5,2)",
        is_deleted: "BOOLEAN DEFAULT FALSE",
        deleted_at: "TIMESTAMPTZ",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },
    purchase_bill_items: {
        id: "SERIAL PRIMARY KEY",
        bill_id: "INTEGER REFERENCES purchase_bills(id) ON DELETE CASCADE",
        product_id: "INTEGER",
        description: "TEXT",
        hsn_code: "VARCHAR(20)",
        quantity: "NUMERIC(12,2) NOT NULL",
        unit_price: "NUMERIC(12,2) NOT NULL",
        tax_percent: "NUMERIC(5,2) DEFAULT 0",
        cgst_rate: "NUMERIC(5,2) DEFAULT 0",
        sgst_rate: "NUMERIC(5,2) DEFAULT 0",
        igst_rate: "NUMERIC(5,2) DEFAULT 0",
        cgst_amount: "NUMERIC(15,2) DEFAULT 0",
        sgst_amount: "NUMERIC(15,2) DEFAULT 0",
        igst_amount: "NUMERIC(15,2) DEFAULT 0",
        line_total: "NUMERIC(12,2) NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    bank_details: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        bank_name: "VARCHAR(255) NOT NULL",
        account_number: "VARCHAR(50) NOT NULL",
        ifsc_code: "VARCHAR(20)",
        branch_name: "TEXT",
        account_type: "VARCHAR(50) DEFAULT 'Current'",
        upi_id: "VARCHAR(255)", // Added
        opening_balance: "NUMERIC(15,2) DEFAULT 0", // Added
        current_balance: "NUMERIC(15,2) DEFAULT 0", // Added
        purpose: "VARCHAR(50)", // e.g. 'SALARY', 'PURCHASE', 'DEFAULT'
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
        branch_id: "INTEGER",
        lender_id: "INTEGER",
        agreement_type: "VARCHAR(50)",
        total_amount: "NUMERIC(12,2) NOT NULL",
        interest_rate: "NUMERIC(5,2) DEFAULT 0",
        emi_amount: "NUMERIC(12,2) DEFAULT 0",
        duration_months: "INTEGER DEFAULT 0",
        start_date: "DATE",
        status: "VARCHAR(50) DEFAULT 'Active'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    constraints: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        constraint_name: "VARCHAR(255) NOT NULL",
        constraint_type: "VARCHAR(50)",
        area: "VARCHAR(50)",
        description: "TEXT",
        identified_date: "DATE DEFAULT CURRENT_DATE",
        status: "VARCHAR(20) DEFAULT 'ACTIVE'",
        capacity: "NUMERIC(12,2)",
        demand: "NUMERIC(12,2)",
        utilization_percent: "NUMERIC(5,2)",
        priority: "INTEGER DEFAULT 1",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    throughput_metrics: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        period_start: "DATE NOT NULL",
        period_end: "DATE NOT NULL",
        total_sales: "NUMERIC(12,2) DEFAULT 0",
        totally_variable_costs: "NUMERIC(12,2) DEFAULT 0",
        throughput: "NUMERIC(12,2)",
        raw_materials: "NUMERIC(12,2) DEFAULT 0",
        work_in_process: "NUMERIC(12,2) DEFAULT 0",
        finished_goods: "NUMERIC(12,2) DEFAULT 0",
        total_investment: "NUMERIC(12,2)",
        operating_expense: "NUMERIC(12,2) DEFAULT 0",
        net_profit: "NUMERIC(12,2)",
        return_on_investment: "NUMERIC(5,2)",
        productivity: "NUMERIC(5,2)",
        investment_turns: "NUMERIC(5,2)",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    constraint_actions: {
        id: "SERIAL PRIMARY KEY",
        constraint_id: "INTEGER",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        step_number: "INTEGER",
        step_name: "VARCHAR(100)",
        action_description: "TEXT",
        assigned_to: "INTEGER",
        due_date: "DATE",
        completion_date: "DATE",
        status: "VARCHAR(20) DEFAULT 'PENDING'",
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    refresh_tokens: {
        id: "SERIAL PRIMARY KEY",
        user_id: "INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE",
        token: "TEXT NOT NULL",
        expires_at: "TIMESTAMP NOT NULL",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    daily_ledger_closings: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER NOT NULL",
        closing_date: "DATE NOT NULL",
        ledger_type: "VARCHAR(20) NOT NULL", // 'CASH' or 'BANK'
        bank_account_id: "INTEGER", // Link to bank_details if type is 'BANK'
        closing_balance: "NUMERIC(15,2) DEFAULT 0",
        closed_by: "INTEGER REFERENCES users(id)",
        is_verified: "BOOLEAN DEFAULT FALSE",
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    user_permissions: {
        id: "SERIAL PRIMARY KEY",
        user_id: "INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE",
        permission_id: "INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE",
        is_granted: "BOOLEAN DEFAULT TRUE", // TRUE = override to grant, FALSE = override to revoke
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    chit_groups: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER",
        group_name: "VARCHAR(255) NOT NULL",
        total_value: "NUMERIC(15,2) NOT NULL",
        monthly_installment: "NUMERIC(15,2) NOT NULL",
        duration_months: "INTEGER NOT NULL",
        start_date: "DATE NOT NULL",
        status: "VARCHAR(20) DEFAULT 'ACTIVE'", // ACTIVE, CLOSED
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    chit_installments: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        chit_group_id: "INTEGER REFERENCES chit_groups(id)",
        payment_date: "DATE NOT NULL",
        amount: "NUMERIC(15,2) NOT NULL",
        is_auction_won: "BOOLEAN DEFAULT FALSE",
        auction_amount_received: "NUMERIC(15,2) DEFAULT 0",
        transaction_id: "INTEGER", // Reference to transactions table
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    brokers: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        branch_id: "INTEGER",
        name: "VARCHAR(255) NOT NULL",
        phone: "VARCHAR(20)",
        address: "TEXT",
        broker_type: "VARCHAR(20) DEFAULT 'BOTH'", // PURCHASE, SALES, BOTH
        commission_rate: "NUMERIC(5,2) DEFAULT 0", // Global fallback if needed
        status: "VARCHAR(20) DEFAULT 'ACTIVE'",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    broker_product_rates: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        broker_id: "INTEGER REFERENCES brokers(id) ON DELETE CASCADE",
        product_id: "INTEGER", // Reference to products table
        commission_percentage: "NUMERIC(5,2) DEFAULT 0",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    broker_commissions: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER NOT NULL",
        broker_id: "INTEGER REFERENCES brokers(id)",
        transaction_id: "INTEGER", // Reference to transactions table
        bill_type: "VARCHAR(20)", // PURCHASE, SALES
        bill_id: "INTEGER",
        bill_amount: "NUMERIC(15,2)",
        commission_amount: "NUMERIC(15,2)",
        line_items_breakdown: "JSONB", // Array of { product_id, qty, unit_price, commission_rate, commission_amount }
        is_paid: "BOOLEAN DEFAULT FALSE",
        payment_date: "DATE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    employee_qr_codes: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        employee_id: "INTEGER",
        qr_code_string: "TEXT UNIQUE NOT NULL",
        generated_date: "DATE DEFAULT CURRENT_DATE",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    attendance: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        employee_id: "INTEGER",
        date: "DATE NOT NULL",
        status: "VARCHAR(20) DEFAULT 'Present'",
        od_location: "TEXT",
        confirmed_by: "INTEGER",
        confirmed_at: "TIMESTAMP",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    employee_ledger: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        employee_id: "INTEGER",
        advance_balance: "NUMERIC(12,2) DEFAULT 0",
        salary_paid: "NUMERIC(12,2) DEFAULT 0",
        last_payment_date: "DATE",
        present_days: "INTEGER DEFAULT 0",
        absent_days: "INTEGER DEFAULT 0",
        od_days: "INTEGER DEFAULT 0",
        month_year: "VARCHAR(20)",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    day_operations: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        date: "DATE NOT NULL",
        status: "VARCHAR(20) DEFAULT 'open'",
        opened_by: "INTEGER",
        closed_by: "INTEGER",
        closing_summary: "JSONB",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    daily_expenses: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        branch_id: "INTEGER",
        date: "DATE NOT NULL",
        expense_type: "VARCHAR(100)",
        amount: "NUMERIC(12,2) NOT NULL",
        ledger_reference_id: "INTEGER",
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()"
    }
};
