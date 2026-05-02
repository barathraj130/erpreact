
/**
 * Branch Inventory & Stock Request System Schema
 */

const branchSystemUpdates = [
    // 1. Branch Inventory (Per-product stock at each branch)
    `CREATE TABLE IF NOT EXISTS branch_inventory (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        branch_id INTEGER REFERENCES branches(id),
        product_id INTEGER REFERENCES products(id),
        current_stock DECIMAL(15,3) DEFAULT 0,
        min_stock DECIMAL(15,3) DEFAULT 5,
        max_stock_level DECIMAL(15,3) DEFAULT 100,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(branch_id, product_id)
    );`,

    // 2. Stock Requests (Branch asking Main for stock)
    `CREATE TABLE IF NOT EXISTS stock_requests (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        from_branch_id INTEGER REFERENCES branches(id),
        product_id INTEGER REFERENCES products(id),
        requested_qty DECIMAL(15,3) NOT NULL,
        urgency VARCHAR(20) DEFAULT 'Normal', -- 'Normal', 'Urgent'
        note TEXT,
        status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'TRANSFERRED', 'DECLINED'
        requested_by INTEGER REFERENCES users(id),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_by INTEGER REFERENCES users(id),
        responded_at TIMESTAMP,
        decline_reason TEXT,
        transferred_qty DECIMAL(15,3) DEFAULT 0
    );`,

    // 3. Stock Transfers (The actual movement log)
    `CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        from_branch_id INTEGER REFERENCES branches(id), -- NULL if from Main
        to_branch_id INTEGER REFERENCES branches(id),
        product_id INTEGER REFERENCES products(id),
        qty DECIMAL(15,3) NOT NULL,
        transferred_by INTEGER REFERENCES users(id),
        transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        reference_type VARCHAR(50), -- 'stock_request', 'manual_transfer'
        reference_id INTEGER
    );`,

    // 4. Bill Format Settings
    `CREATE TABLE IF NOT EXISTS bill_format_settings (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) UNIQUE,
        logo_url TEXT,
        business_name TEXT,
        address TEXT,
        gstin TEXT,
        phone TEXT,
        email TEXT,
        bill_title VARCHAR(100) DEFAULT 'Tax Invoice',
        show_hsn BOOLEAN DEFAULT TRUE,
        show_gst_breakup BOOLEAN DEFAULT TRUE,
        show_barcode BOOLEAN DEFAULT TRUE,
        show_branch_name BOOLEAN DEFAULT TRUE,
        footer_message TEXT,
        paper_size VARCHAR(50) DEFAULT 'A4', -- 'A4', 'A5', 'Thermal 80mm', 'Thermal 58mm'
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // 5. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        branch_id INTEGER REFERENCES branches(id), -- NULL for Main
        type VARCHAR(50), -- 'STOCK_REQUEST', 'TRANSFER_APPROVED', 'LOW_STOCK', etc.
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // 6. Branch Bill Sequence (To keep track of per-branch bill numbering)
    `ALTER TABLE branches ADD COLUMN IF NOT EXISTS bill_sequence INTEGER DEFAULT 1;`,
    `ALTER TABLE branches ADD COLUMN IF NOT EXISTS bill_prefix VARCHAR(10);`,

    // 7. Tagging bills with branch_id
    `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);`,
    // Assuming sales_bills or invoices table exists, adding branch_id there too
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);`
];

export default branchSystemUpdates;
