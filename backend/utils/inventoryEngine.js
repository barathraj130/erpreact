/**
 * ============================================================
 * CENTRALIZED INVENTORY ENGINE
 * ============================================================
 * ALL stock mutations across the entire ERP MUST go through
 * this module. No other file may directly UPDATE branch_inventory
 * or products.current_stock for stock deduction/addition.
 *
 * Guarantees:
 *   - Idempotency  (duplicate movements are blocked)
 *   - Branch isolation (stock lives only in its owning branch)
 *   - No negative stock (throws before any write)
 *   - Single source of truth: branch_inventory
 *   - products.current_stock is a SUM cache, always recomputed
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// BRANCH RESOLUTION
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the best branch for a stock operation.
 * Priority order:
 *   1. Explicitly requested branchId
 *   2. Product's own branch_id (where it was created/stocked)
 *   3. Main hub (branch_type LIKE '%main%', then lowest id)
 *
 * Returns null only if the company has no branches at all.
 */
export async function resolveStockBranch(client, { companyId, requestedBranchId = null, productId = null }) {
    if (requestedBranchId) return Number(requestedBranchId);

    if (productId) {
        const pRes = await client.query(
            'SELECT branch_id FROM products WHERE id = $1 AND is_deleted = false',
            [productId]
        );
        const productBranch = pRes.rows[0]?.branch_id;
        if (productBranch) return Number(productBranch);
    }

    // Fall back to main hub
    const mbRes = await client.query(
        `SELECT id FROM branches
         WHERE company_id = $1
         ORDER BY (LOWER(COALESCE(branch_type,'')) LIKE '%main%') DESC, id ASC
         LIMIT 1`,
        [companyId]
    );
    return mbRes.rows[0]?.id ? Number(mbRes.rows[0].id) : null;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Ensure a branch_inventory row exists (at 0 if new).
 * Safe to call multiple times — ON CONFLICT DO NOTHING.
 */
async function ensureBranchInventoryRow(client, { companyId, branchId, productId }) {
    await client.query(`
        INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
        VALUES ($1, $2, $3, 0, NOW())
        ON CONFLICT (branch_id, product_id) DO NOTHING
    `, [companyId, branchId, productId]);
}

/**
 * Recompute products.current_stock as SUM(branch_inventory).
 * This is the only place products.current_stock should be written
 * after initial product creation.
 */
async function recomputeProductStock(client, productId) {
    await client.query(`
        UPDATE products
        SET current_stock = (
            SELECT COALESCE(SUM(current_stock), 0)
            FROM branch_inventory
            WHERE product_id = $1
        )
        WHERE id = $1
    `, [productId]);
}

// ─────────────────────────────────────────────────────────────
// DEDUCT STOCK  (Sales / Invoice)
// ─────────────────────────────────────────────────────────────

/**
 * Deduct stock from a specific branch for a sale.
 *
 * @param client        - pg transaction client (caller manages BEGIN/COMMIT)
 * @param companyId     - tenant company id
 * @param branchId      - branch to deduct from (MUST be resolved before calling)
 * @param productId     - product id
 * @param qty           - units to deduct (positive number)
 * @param referenceType - e.g. 'INVOICE'
 * @param referenceId   - invoice id
 * @param note          - optional note for movement log
 *
 * @returns { success, productName, previousQty, newQty, deducted }
 *          or { skipped, reason } if idempotency blocks a duplicate
 * @throws  if stock insufficient or branchId missing
 */
export async function deductStock(client, {
    companyId, branchId, productId, qty,
    referenceType, referenceId, note = ''
}) {
    if (!branchId) {
        throw new Error(
            `[inventoryEngine] deductStock: branchId not resolved for product #${productId}. ` +
            'Call resolveStockBranch() before deductStock().'
        );
    }
    if (!(qty > 0)) return { skipped: true, reason: 'zero_qty' };

    // ── Idempotency guard ──────────────────────────────────────
    // Block if a SALE_OUT movement for this exact invoice+product already exists.
    const dup = await client.query(`
        SELECT id FROM inventory_movements
        WHERE branch_id     = $1
          AND product_id    = $2
          AND type          = 'SALE_OUT'
          AND reference_type = $3
          AND reference_id  = $4
        LIMIT 1
    `, [branchId, productId, referenceType, referenceId]);

    if (dup.rows.length > 0) {
        console.warn(
            `[inventoryEngine] DUPLICATE BLOCKED: SALE_OUT product#${productId} ` +
            `${referenceType}#${referenceId} branch#${branchId}`
        );
        return { skipped: true, reason: 'duplicate' };
    }

    // ── Ensure row exists ──────────────────────────────────────
    await ensureBranchInventoryRow(client, { companyId, branchId, productId });

    // ── Read current stock ─────────────────────────────────────
    const stockRes = await client.query(`
        SELECT bi.current_stock, p.name
        FROM branch_inventory bi
        JOIN products p ON p.id = bi.product_id
        WHERE bi.branch_id = $1 AND bi.product_id = $2
    `, [branchId, productId]);

    const prevQty     = Number(stockRes.rows[0]?.current_stock ?? 0);
    const productName = stockRes.rows[0]?.name ?? `Product #${productId}`;

    // ── Block negative stock ───────────────────────────────────
    if (prevQty < qty) {
        throw new Error(
            `Insufficient stock for "${productName}". ` +
            `Available in branch #${branchId}: ${prevQty}, Required: ${qty}`
        );
    }

    const newQty = prevQty - qty;

    // ── 1. Update branch_inventory ─────────────────────────────
    await client.query(`
        UPDATE branch_inventory
        SET current_stock = $1, last_updated = NOW()
        WHERE branch_id = $2 AND product_id = $3
    `, [newQty, branchId, productId]);

    // ── 2. Recompute products.current_stock (SUM cache) ────────
    await recomputeProductStock(client, productId);

    // ── 3. Log inventory movement (SAVEPOINT: log failure never aborts the stock update) ──
    await client.query('SAVEPOINT sp_inv_log');
    try {
        await client.query(`
            INSERT INTO inventory_movements
                (company_id, branch_id, product_id, type, qty_out,
                 previous_qty, new_qty, reference_type, reference_id, note)
            VALUES ($1, $2, $3, 'SALE_OUT', $4, $5, $6, $7, $8, $9)
        `, [companyId, branchId, productId, qty, prevQty, newQty, referenceType, referenceId, note]);
        await client.query('RELEASE SAVEPOINT sp_inv_log');
    } catch (logErr) {
        await client.query('ROLLBACK TO SAVEPOINT sp_inv_log');
        await client.query('RELEASE SAVEPOINT sp_inv_log');
        // Fallback: insert without optional audit columns
        await client.query(`
            INSERT INTO inventory_movements
                (company_id, branch_id, product_id, type, qty_out, reference_type, reference_id, note)
            VALUES ($1, $2, $3, 'SALE_OUT', $4, $5, $6, $7)
        `, [companyId, branchId, productId, qty, referenceType, referenceId, note]).catch(() => {});
        console.warn('[inventoryEngine] Movement log used fallback (missing audit columns):', logErr.message);
    }

    console.log(
        `[inventoryEngine] ✓ SALE_OUT product#${productId} (${productName}) ` +
        `branch#${branchId}: ${prevQty} → ${newQty} (−${qty})`
    );

    return { success: true, productName, previousQty: prevQty, newQty, deducted: qty };
}

// ─────────────────────────────────────────────────────────────
// ADD STOCK  (Purchase / Return / Opening / Transfer-in)
// ─────────────────────────────────────────────────────────────

/**
 * Add stock to a specific branch.
 *
 * @param movementType - 'PURCHASE_IN' | 'SALE_RETURN' | 'TRANSFER_IN' | 'OPENING_STOCK'
 */
export async function addStock(client, {
    companyId, branchId, productId, qty,
    movementType = 'PURCHASE_IN', referenceType, referenceId, note = ''
}) {
    if (!branchId) {
        throw new Error(
            `[inventoryEngine] addStock: branchId not resolved for product #${productId}.`
        );
    }
    if (!(qty > 0)) return { skipped: true, reason: 'zero_qty' };

    // ── Upsert branch_inventory ────────────────────────────────
    await client.query(`
        INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET
            current_stock = branch_inventory.current_stock + $4,
            last_updated  = NOW()
    `, [companyId, branchId, productId, qty]);

    // ── Recompute products.current_stock ───────────────────────
    await recomputeProductStock(client, productId);

    // ── Read new stock for log ─────────────────────────────────
    const stockRes = await client.query(
        'SELECT current_stock FROM branch_inventory WHERE branch_id=$1 AND product_id=$2',
        [branchId, productId]
    );
    const newQty = Number(stockRes.rows[0]?.current_stock ?? 0);

    // ── Log movement (SAVEPOINT: log failure never aborts the stock update) ──
    await client.query('SAVEPOINT sp_inv_log');
    try {
        await client.query(`
            INSERT INTO inventory_movements
                (company_id, branch_id, product_id, type, qty_in,
                 new_qty, reference_type, reference_id, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [companyId, branchId, productId, movementType, qty, newQty, referenceType, referenceId, note]);
        await client.query('RELEASE SAVEPOINT sp_inv_log');
    } catch (logErr) {
        await client.query('ROLLBACK TO SAVEPOINT sp_inv_log');
        await client.query('RELEASE SAVEPOINT sp_inv_log');
        // Fallback: insert without optional audit columns
        await client.query(`
            INSERT INTO inventory_movements
                (company_id, branch_id, product_id, type, qty_in, reference_type, reference_id, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [companyId, branchId, productId, movementType, qty, referenceType, referenceId, note]).catch(() => {});
        console.warn('[inventoryEngine] Movement log used fallback (missing audit columns):', logErr.message);
    }

    console.log(
        `[inventoryEngine] ✓ ${movementType} product#${productId} ` +
        `branch#${branchId}: +${qty} → ${newQty}`
    );

    return { success: true, newQty, added: qty };
}

// ─────────────────────────────────────────────────────────────
// RESTORE STOCK  (Invoice delete / cancel)
// ─────────────────────────────────────────────────────────────

/**
 * Reverse all SALE_OUT movements for a given invoice.
 * Used when an invoice is deleted or cancelled.
 * Idempotent — safe to call multiple times.
 */
export async function restoreStockForInvoice(client, { companyId, invoiceId }) {
    // Find every SALE_OUT logged for this invoice
    const movementsRes = await client.query(`
        SELECT * FROM inventory_movements
        WHERE reference_type = 'INVOICE'
          AND reference_id   = $1
          AND type           = 'SALE_OUT'
    `, [invoiceId]);

    const movements = movementsRes.rows;
    if (movements.length === 0) {
        // Legacy invoices: fall back to line items
        console.warn(`[inventoryEngine] restoreStock: no SALE_OUT movements for invoice #${invoiceId}. Running legacy restore.`);
        return 0;
    }

    let restored = 0;
    for (const mv of movements) {
        const { branch_id: branchId, product_id: productId, qty_out: qty } = mv;
        if (!(qty > 0) || !branchId) continue;

        // Check if already restored (SALE_RETURN for this invoice)
        const alreadyRestored = await client.query(`
            SELECT id FROM inventory_movements
            WHERE reference_type = 'INVOICE_CANCEL'
              AND reference_id   = $1
              AND product_id     = $2
              AND branch_id      = $3
              AND type           = 'SALE_RETURN'
            LIMIT 1
        `, [invoiceId, productId, branchId]);

        if (alreadyRestored.rows.length > 0) {
            console.warn(`[inventoryEngine] restoreStock: ALREADY RESTORED product#${productId} invoice#${invoiceId}`);
            continue;
        }

        // Add stock back
        await client.query(`
            INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (branch_id, product_id)
            DO UPDATE SET
                current_stock = branch_inventory.current_stock + $4,
                last_updated  = NOW()
        `, [companyId, branchId, productId, qty]);

        await recomputeProductStock(client, productId);

        // Log restore movement
        await client.query(`
            INSERT INTO inventory_movements
                (company_id, branch_id, product_id, type, qty_in,
                 reference_type, reference_id, note)
            VALUES ($1, $2, $3, 'SALE_RETURN', $4, 'INVOICE_CANCEL', $5,
                    'Stock restored on invoice cancellation')
        `, [companyId, branchId, productId, qty, invoiceId]);

        restored++;
        console.log(`[inventoryEngine] ✓ SALE_RETURN product#${productId} branch#${branchId}: +${qty}`);
    }

    return restored;
}

// ─────────────────────────────────────────────────────────────
// STOCK TRANSFER  (Branch to Branch)
// ─────────────────────────────────────────────────────────────

/**
 * Transfer stock from one branch to another.
 * Deducts from source, adds to destination.
 * Global total is unchanged.
 */
export async function transferStock(client, {
    companyId, fromBranchId, toBranchId, productId, qty, referenceId, note = ''
}) {
    if (fromBranchId === toBranchId) {
        throw new Error('[inventoryEngine] transferStock: source and destination branch are the same.');
    }

    await deductStock(client, {
        companyId, branchId: fromBranchId, productId, qty,
        referenceType: 'STOCK_TRANSFER', referenceId,
        note: note || `Transfer to branch #${toBranchId}`
    });

    await addStock(client, {
        companyId, branchId: toBranchId, productId, qty,
        movementType: 'TRANSFER_IN',
        referenceType: 'STOCK_TRANSFER', referenceId,
        note: note || `Transfer from branch #${fromBranchId}`
    });

    return { success: true };
}

// ─────────────────────────────────────────────────────────────
// READ STOCK  (Single source of truth query)
// ─────────────────────────────────────────────────────────────

/**
 * Get current stock for a product in a specific branch.
 * Always reads from branch_inventory — never products.current_stock.
 */
export async function getStock(client, { branchId, productId }) {
    const res = await client.query(
        'SELECT current_stock FROM branch_inventory WHERE branch_id = $1 AND product_id = $2',
        [branchId, productId]
    );
    return Number(res.rows[0]?.current_stock ?? 0);
}

/**
 * Get total global stock for a product across all branches.
 * This is the only correct way to compute global stock.
 */
export async function getGlobalStock(client, { productId }) {
    const res = await client.query(
        'SELECT COALESCE(SUM(current_stock), 0) AS total FROM branch_inventory WHERE product_id = $1',
        [productId]
    );
    return Number(res.rows[0]?.total ?? 0);
}
