// backend/migrations/add_purchase_bill_columns.js
// Run once: node backend/migrations/add_purchase_bill_columns.js

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  // purchase_bills – add missing columns
  `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS supplier_name TEXT`,
  `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0`,
  `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(15,2) DEFAULT 0`,
  `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,

  // Normalise status default
  `ALTER TABLE purchase_bills ALTER COLUMN status SET DEFAULT 'PENDING'`,

  // purchase_bill_items – add GST breakdown columns
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20)`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) DEFAULT 0`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) DEFAULT 0`,
  `ALTER TABLE purchase_bill_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15,2) DEFAULT 0`,
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of migrations) {
      console.log('▶', sql.slice(0, 80) + '...');
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('\n✅ Migration complete – all columns added to purchase_bills & purchase_bill_items');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
})();
