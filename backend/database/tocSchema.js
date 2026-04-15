// Theory of Constraints Database Schema

export const tocSchema = {
    // 1. CONSTRAINTS TRACKING
    constraints: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        constraint_name: "VARCHAR(255) NOT NULL",
        constraint_type: "VARCHAR(50)", // RESOURCE, MARKET, POLICY, PARADIGM
        area: "VARCHAR(50)", // PRODUCTION, SALES, FINANCE, INVENTORY
        description: "TEXT",
        identified_date: "DATE DEFAULT CURRENT_DATE",
        status: "VARCHAR(20) DEFAULT 'ACTIVE'", // ACTIVE, RESOLVED, ELEVATED
        capacity: "NUMERIC(12,2)", // Current capacity
        demand: "NUMERIC(12,2)", // Current demand
        utilization_percent: "NUMERIC(5,2)", // Calculated field
        priority: "INTEGER DEFAULT 1", // 1 = highest priority
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 2. THROUGHPUT ACCOUNTING METRICS
    throughput_metrics: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        period_start: "DATE NOT NULL",
        period_end: "DATE NOT NULL",
        // Throughput (T) = Sales - Totally Variable Costs
        total_sales: "NUMERIC(12,2) DEFAULT 0",
        totally_variable_costs: "NUMERIC(12,2) DEFAULT 0",
        throughput: "NUMERIC(12,2)", // T = Sales - TVC
        // Inventory/Investment (I)
        raw_materials: "NUMERIC(12,2) DEFAULT 0",
        work_in_process: "NUMERIC(12,2) DEFAULT 0",
        finished_goods: "NUMERIC(12,2) DEFAULT 0",
        total_investment: "NUMERIC(12,2)", // I = RM + WIP + FG
        // Operating Expense (OE)
        operating_expense: "NUMERIC(12,2) DEFAULT 0",
        // Key Metrics
        net_profit: "NUMERIC(12,2)", // NP = T - OE
        return_on_investment: "NUMERIC(5,2)", // ROI = NP / I
        productivity: "NUMERIC(5,2)", // P = T / OE
        investment_turns: "NUMERIC(5,2)", // IT = T / I
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 3. DBR (DRUM-BUFFER-ROPE) SCHEDULING
    dbr_schedules: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        product_name: "VARCHAR(255)",
        order_id: "INTEGER", // Link to sales order
        constraint_resource: "VARCHAR(255)", // The "Drum"
        scheduled_start: "TIMESTAMP",
        scheduled_end: "TIMESTAMP",
        buffer_time_minutes: "INTEGER", // Time buffer before constraint
        rope_release_date: "TIMESTAMP", // When to release materials
        actual_start: "TIMESTAMP",
        actual_end: "TIMESTAMP",
        status: "VARCHAR(20) DEFAULT 'SCHEDULED'", // SCHEDULED, IN_PROGRESS, COMPLETED, DELAYED
        buffer_penetration: "NUMERIC(5,2)", // % of buffer consumed
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 4. CONSTRAINT ACTIONS (5 Focusing Steps)
    constraint_actions: {
        id: "SERIAL PRIMARY KEY",
        constraint_id: "INTEGER",
        company_id: "INTEGER",
        step_number: "INTEGER", // 1-5 for TOC steps
        step_name: "VARCHAR(100)", // IDENTIFY, EXPLOIT, SUBORDINATE, ELEVATE, REPEAT
        action_description: "TEXT",
        assigned_to: "INTEGER", // User ID
        due_date: "DATE",
        completion_date: "DATE",
        status: "VARCHAR(20) DEFAULT 'PENDING'", // PENDING, IN_PROGRESS, COMPLETED
        notes: "TEXT",
        created_at: "TIMESTAMP DEFAULT NOW()",
        updated_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 5. BUFFER MANAGEMENT
    buffer_status: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        schedule_id: "INTEGER", // Link to dbr_schedules
        buffer_type: "VARCHAR(20)", // TIME, CAPACITY, STOCK
        buffer_zone: "VARCHAR(10)", // GREEN, YELLOW, RED
        zone_percentage: "NUMERIC(5,2)", // % into buffer
        alert_triggered: "BOOLEAN DEFAULT false",
        alert_date: "TIMESTAMP",
        resolution_date: "TIMESTAMP",
        created_at: "TIMESTAMP DEFAULT NOW()"
    },

    // 6. THROUGHPUT DOLLAR DAYS (TDD)
    throughput_dollar_days: {
        id: "SERIAL PRIMARY KEY",
        company_id: "INTEGER",
        order_id: "INTEGER",
        customer_id: "INTEGER",
        due_date: "DATE",
        completion_date: "DATE",
        throughput_value: "NUMERIC(12,2)",
        days_late: "INTEGER DEFAULT 0",
        tdd_value: "NUMERIC(12,2)", // TDD = Throughput × Days Late
        created_at: "TIMESTAMP DEFAULT NOW()"
    }
};
