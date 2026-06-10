
import * as db from "../database/pg.js";
import { createTransaction, getAccountByCode } from "../utils/accountingEngine.js";

/**
 * Record a notification in the database
 */
export async function createNotification(client, { company_id, branch_id, type, message }) {
    await client.query(
        `INSERT INTO notifications (company_id, branch_id, type, message) VALUES ($1, $2, $3, $4)`,
        [company_id, branch_id, type, message]
    );
}

/**
 * Atomic Stock Transfer
 *
 * branch_inventory is the SOLE SOURCE OF TRUTH for all stock levels.
 * This function operates purely on branch_inventory — the inventory table
 * is NOT used for stock counts. products.current_stock is a SUM cache and
 * does not change during a transfer (total stock is conserved).
 *
 * Callers must pass the actual from_branch_id (never null).
 * To transfer from the main hub, look up its branch ID first.
 */
export async function transferStock(client, { company_id, from_branch_id, to_branch_id, product_id, qty, userId, notes, reference_type, reference_id }) {
    const amount = parseFloat(qty);
    if (isNaN(amount) || amount <= 0) throw new Error("Transfer quantity must be a positive number");
    if (!from_branch_id) throw new Error("from_branch_id is required. Resolve the main hub branch ID before calling transferStock.");

    // 1. Deduct from source branch — only if sufficient stock exists
    const srcResult = await client.query(
        `UPDATE branch_inventory
         SET current_stock = current_stock - $1, last_updated = NOW()
         WHERE branch_id = $2 AND product_id = $3 AND current_stock >= $1
         RETURNING current_stock`,
        [amount, from_branch_id, product_id]
    );
    if (srcResult.rowCount === 0) {
        // Distinguish "no row" from "insufficient stock"
        const check = await client.query(
            `SELECT current_stock FROM branch_inventory WHERE branch_id = $1 AND product_id = $2`,
            [from_branch_id, product_id]
        );
        if (check.rowCount === 0) throw new Error(`Product has no stock in the source branch. Purchase inventory first.`);
        throw new Error(`Insufficient stock in source branch. Available: ${check.rows[0].current_stock}, Requested: ${amount}`);
    }

    // 2. Add to destination branch
    await client.query(
        `INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (branch_id, product_id)
         DO UPDATE SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()`,
        [company_id, to_branch_id, product_id, amount]
    );
    // Note: products.current_stock (the SUM cache) does not change — stock is conserved.

    // 3. Log the transfer record
    await client.query(
        `INSERT INTO stock_transfers (company_id, from_branch_id, to_branch_id, product_id, qty, transferred_by, notes, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [company_id, from_branch_id, to_branch_id, product_id, amount, userId, notes, reference_type, reference_id]
    );

    // 4. Log inventory movements (best-effort — table may not have all columns)
    try {
        await client.query(
            `INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_out, qty_in, reference_type, reference_id, note)
             VALUES ($1,$2,$3,'TRANSFER_OUT',$4,0,'stock_transfer',$5,$6)`,
            [company_id, from_branch_id, product_id, amount, reference_id || null, `Transfer out to branch ${to_branch_id}`]
        );
        await client.query(
            `INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_out, qty_in, reference_type, reference_id, note)
             VALUES ($1,$2,$3,'TRANSFER_IN',0,$4,'stock_transfer',$5,$6)`,
            [company_id, to_branch_id, product_id, amount, reference_id || null, `Transfer in from branch ${from_branch_id}`]
        );
    } catch (e) {
        console.warn('[transferStock] inventory_movements log failed (non-fatal):', e.message);
    }

    // 5. Notify destination branch (best-effort)
    try {
        await createNotification(client, {
            company_id,
            branch_id: to_branch_id,
            type: 'TRANSFER_RECEIVED',
            message: `✅ ${amount} units transferred to your branch.`
        });
    } catch (e) {
        console.warn('[transferStock] notification failed (non-fatal):', e.message);
    }

    return { success: true };
}

/**
 * Create Stock Request
 */
export async function createStockRequest({ company_id, from_branch_id, product_id, requested_qty, urgency, note, userId }) {
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        
        const res = await client.query(
            `INSERT INTO stock_requests (company_id, from_branch_id, product_id, requested_qty, urgency, note, requested_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [company_id, from_branch_id, product_id, requested_qty, urgency, note, userId]
        );

        // Notify Main Branch
        await createNotification(client, {
            company_id,
            branch_id: null, // Main
            type: 'STOCK_REQUEST',
            message: `${urgency === 'Urgent' ? '🔴 URGENT: ' : ''}Stock request for ${requested_qty} units from Branch #${from_branch_id}`
        });

        await client.query("COMMIT");
        return res.rows[0];
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Get Consolidated Inventory — branch_inventory is sole source of truth.
 */
export async function getConsolidatedInventory(companyId) {
    const products = await db.pgAll(
        `WITH main_branch AS (
            SELECT id FROM branches
            WHERE company_id = $1
            ORDER BY (LOWER(COALESCE(branch_type,'')) LIKE '%main%') DESC, id ASC
            LIMIT 1
        )
        SELECT
            p.id, p.name, p.sku, p.unit, p.selling_price,
            COALESCE(SUM(CASE WHEN bi.branch_id = mb.id THEN bi.current_stock ELSE 0 END), 0) AS main_stock,
            COALESCE(SUM(CASE WHEN bi.branch_id != mb.id THEN bi.current_stock ELSE 0 END), 0) AS total_branch_stock,
            COALESCE(SUM(bi.current_stock), 0) AS total_stock
        FROM products p
        LEFT JOIN branch_inventory bi ON p.id = bi.product_id
        CROSS JOIN main_branch mb
        WHERE p.company_id = $1 AND p.is_deleted = false
        GROUP BY p.id, mb.id`,
        [companyId]
    );
    return products;
}

/**
 * Get Product Stock Breakdown per branch
 */
export async function getProductStockBreakdown(productId) {
    const branches = await db.pgAll(
        `SELECT b.name as branch_name, COALESCE(bi.current_stock, 0) as stock
         FROM branches b
         LEFT JOIN branch_inventory bi ON b.id = bi.branch_id AND bi.product_id = $1
         WHERE b.is_deleted = false`,
        [productId]
    );
    return branches;
}
