
import * as db from "../database/pg.js";

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
 */
export async function transferStock(client, { company_id, from_branch_id, to_branch_id, product_id, qty, userId, notes, reference_type, reference_id }) {
    const amount = parseFloat(qty);
    
    // 1. Decrease source stock (Main if from_branch_id is null)
    if (!from_branch_id) {
        // Main Inventory
        const mainInv = await client.query(
            `UPDATE inventory SET current_stock = current_stock - $1 WHERE product_id = $2 RETURNING current_stock`,
            [amount, product_id]
        );
        if (mainInv.rowCount === 0) throw new Error("Product not found in Main Inventory");
        
        // Also update products table (convenience)
        await client.query(`UPDATE products SET current_stock = current_stock - $1 WHERE id = $2`, [amount, product_id]);
    } else {
        // Branch Inventory
        const branchInv = await client.query(
            `UPDATE branch_inventory SET current_stock = current_stock - $1 WHERE branch_id = $2 AND product_id = $3 RETURNING current_stock`,
            [amount, from_branch_id, product_id]
        );
        if (branchInv.rowCount === 0) throw new Error("Product not found in Source Branch Inventory");
    }

    // 2. Increase destination stock
    const toBranchInv = await client.query(
        `INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (branch_id, product_id)
         DO UPDATE SET current_stock = branch_inventory.current_stock + $4, last_updated = NOW()
         RETURNING current_stock`,
        [company_id, to_branch_id, product_id, amount]
    );

    // 3. Log Transfer
    await client.query(
        `INSERT INTO stock_transfers (company_id, from_branch_id, to_branch_id, product_id, qty, transferred_by, notes, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [company_id, from_branch_id, to_branch_id, product_id, amount, userId, notes, reference_type, reference_id]
    );

    // 4. Log Inventory Movement (Global log)
    await client.query(
        `INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_out, qty_in, reference_type, reference_id, note)
         VALUES ($1, $2, $3, 'Transfer', $4, 0, 'stock_transfer', NULL, $5)`,
        [company_id, from_branch_id || 0, product_id, amount, `Transfer to branch ${to_branch_id}`]
    );
    await client.query(
        `INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_out, qty_in, reference_type, reference_id, note)
         VALUES ($1, $2, $3, 'Transfer', 0, $4, 'stock_transfer', NULL, $5)`,
        [company_id, to_branch_id, product_id, amount, `Received from branch ${from_branch_id || 'Main'}`]
    );

    // 5. Notify destination branch
    await createNotification(client, {
        company_id,
        branch_id: to_branch_id,
        type: 'TRANSFER_RECEIVED',
        message: `✅ ${amount} units of product transferred to your branch.`
    });

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
 * Get Consolidated Inventory (Main + Branches)
 */
export async function getConsolidatedInventory(companyId) {
    const products = await db.pgAll(
        `SELECT p.id, p.name, p.sku, p.unit, p.selling_price, 
                inv.current_stock as main_stock,
                COALESCE(SUM(bi.current_stock), 0) as total_branch_stock,
                (inv.current_stock + COALESCE(SUM(bi.current_stock), 0)) as total_stock
         FROM products p
         LEFT JOIN inventory inv ON p.id = inv.product_id
         LEFT JOIN branch_inventory bi ON p.id = bi.product_id
         WHERE p.company_id = $1 AND p.is_deleted = false
         GROUP BY p.id, inv.current_stock`,
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
