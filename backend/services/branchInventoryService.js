
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
 * branch_inventory stays the sole source of truth for TOTAL stock per
 * branch+product (Global Stock, Stock Requests, consolidated views all read
 * it) and is always kept in sync here exactly as before.
 *
 * Additionally, this now moves the same quantity between the branches'
 * `inventory` rows for the given stock_type ('fresh' or 'mistake') — that
 * table is what Branch Billing's Inventory tab actually reads, split by
 * quality. A transfer must move real fresh stock out of fresh (and mistake
 * out of mistake) at the source, not just decrement an untyped total —
 * otherwise the destination branch can't correctly bill it as the quality
 * it actually is.
 *
 * Callers must pass the actual from_branch_id (never null).
 * To transfer from the main hub, look up its branch ID first.
 */
export async function transferStock(client, { company_id, from_branch_id, to_branch_id, product_id, qty, userId, notes, reference_type, reference_id, stock_type }) {
    // TEMPORARY DIAGNOSTIC — records exactly what each step did/received, so
    // the caller can report it back without needing server log access.
    const trace = {
        input: { company_id, from_branch_id, to_branch_id, product_id, qty, stock_type },
    };

    const amount = parseFloat(qty);
    if (isNaN(amount) || amount <= 0) throw new Error("Transfer quantity must be a positive number");
    if (!from_branch_id) throw new Error("from_branch_id is required. Resolve the main hub branch ID before calling transferStock.");
    const type = (stock_type || "fresh").toLowerCase() === "mistake" ? "mistake" : "fresh";
    trace.parsed = { amount, from_branch_id_type: typeof from_branch_id, to_branch_id_type: typeof to_branch_id, product_id_type: typeof product_id, type };

    // 1. Deduct from source branch's total — only if sufficient stock exists
    const srcResult = await client.query(
        `UPDATE branch_inventory
         SET current_stock = current_stock - $1, last_updated = NOW()
         WHERE branch_id = $2 AND product_id = $3 AND current_stock >= $1
         RETURNING current_stock`,
        [amount, from_branch_id, product_id]
    );
    trace.step1_branch_inventory_deduct = { rowCount: srcResult.rowCount, resultingRows: srcResult.rows };
    if (srcResult.rowCount === 0) {
        // Distinguish "no row" from "insufficient stock"
        const check = await client.query(
            `SELECT current_stock FROM branch_inventory WHERE branch_id = $1 AND product_id = $2`,
            [from_branch_id, product_id]
        );
        if (check.rowCount === 0) throw new Error(`Product has no stock in the source branch. Purchase inventory first.`);
        throw new Error(`Insufficient stock in source branch. Available: ${check.rows[0].current_stock}, Requested: ${amount}`);
    }

    // 1b. Deduct the same amount from the source's inventory rows of this
    // stock_type — FIFO across lots, since a branch+product+type can have
    // multiple rows (one per purchase lot).
    let remaining = amount;
    const sourceLots = await client.query(
        `SELECT id, current_stock FROM inventory
         WHERE branch_id = $1 AND product_id = $2 AND stock_type = $3 AND current_stock > 0
         ORDER BY id ASC FOR UPDATE`,
        [from_branch_id, product_id, type]
    );
    const availableOfType = sourceLots.rows.reduce((s, r) => s + Number(r.current_stock), 0);
    trace.step1b_source_lots_found = sourceLots.rows;
    trace.step1b_available_of_type = availableOfType;
    if (availableOfType < amount) {
        throw new Error(
            `Insufficient ${type} stock in source branch. Available: ${availableOfType}, Requested: ${amount}. ` +
            `(Total stock at this branch may include the other quality — check Fresh vs Mistake.)`
        );
    }
    const deductedLots = [];
    for (const lot of sourceLots.rows) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(lot.current_stock));
        const r = await client.query(`UPDATE inventory SET current_stock = current_stock - $1, last_updated = NOW() WHERE id = $2 RETURNING id, current_stock`, [take, lot.id]);
        deductedLots.push({ lot_id: lot.id, took: take, resultRow: r.rows[0] });
        remaining -= take;
    }
    trace.step1b_deducted_lots = deductedLots;

    // 2. Add to destination branch's total
    const branchInvUpsert = await client.query(
        `INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (branch_id, product_id)
         DO UPDATE SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()
         RETURNING id, branch_id, product_id, current_stock`,
        [company_id, to_branch_id, product_id, amount]
    );
    trace.step2_branch_inventory_upsert = branchInvUpsert.rows[0];
    // Note: products.current_stock (the SUM cache) does not change — stock is conserved.

    // 2b. Add to destination branch's inventory (same stock_type), carrying
    // over product display fields so Branch Billing can render it without
    // relying on the products-table fallback.
    const product = await client.query(
        `SELECT name, sku, unit, hsn_code, gst_percent, selling_price, cost_price FROM products WHERE id = $1`,
        [product_id]
    );
    const p = product.rows[0] || {};
    trace.step2b_product_lookup = { found: !!product.rows[0], product_id, row: p };
    const destInsert = await client.query(
        `INSERT INTO inventory
            (company_id, branch_id, product_id, product_name, sku, unit, current_stock,
             cost_price, selling_price, hsn_code, gst_percent, stock_type, last_updated)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (product_id, COALESCE(branch_id,0), stock_type, COALESCE(lot_id,0))
         DO UPDATE SET
            current_stock = inventory.current_stock + EXCLUDED.current_stock,
            last_updated = NOW()
         RETURNING id, branch_id, product_id, stock_type, current_stock`,
        [company_id, to_branch_id, product_id, p.name || null, p.sku || null, p.unit || null,
         amount, p.cost_price || 0, p.selling_price || 0, p.hsn_code || null, p.gst_percent || 0, type]
    );
    trace.step2b_inventory_insert = destInsert.rows[0];

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

    return { success: true, trace };
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
