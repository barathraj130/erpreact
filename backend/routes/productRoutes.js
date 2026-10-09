// backend/routes/productRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as pgModule from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { addStock, resolveStockBranch } from "../utils/inventoryEngine.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "./uploads/products";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `prod_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

const router = express.Router();

router.post("/", upload.single("image"), authMiddleware, async (req, res) => {
    const companyId = parseInt(req.user?.active_company_id);
    // Resolve branch: use user's assigned branch, or find the main hub
    let branchId = parseInt(req.user?.branch_id);
    if (!branchId) {
        const mbRes = await pgModule.pgGet(
            `SELECT id FROM branches WHERE company_id = $1 ORDER BY (LOWER(COALESCE(branch_type,'')) LIKE '%main%') DESC, id ASC LIMIT 1`,
            [companyId]
        );
        branchId = mbRes?.id || null;
    }
    const userId = req.user?.id;

    const {
        name, selling_price, sku, brand, description, hsn_code, unit,
        cost_price, opening_stock, barcode, min_stock, max_stock_level,
        gst_percent, supplier_name, category, location,
        unit_type, pieces_per_bundle
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Product Name is required" });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;
    const finalSku = sku || `PROD-${Date.now().toString().slice(-6)}`;

    let client;
    try {
        client = await pgModule.getClient();
        await client.query("BEGIN");

        // 1. Save all form fields to products table
        const productSql = `
            INSERT INTO products (
                company_id, branch_id, name, selling_price, sku, brand, description, hsn_code, unit,
                cost_price, opening_stock, current_stock, barcode, min_stock, max_stock_level,
                gst_percent, supplier_name, category, location, image_url, is_active, is_deleted,
                unit_type, pieces_per_bundle
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, 1, false, $21, $22)
            RETURNING *;
        `;
        const product = (await client.query(productSql, [
            companyId, branchId, name, selling_price || 0, finalSku, brand || null, description || null,
            hsn_code || null, unit || "pcs", cost_price || 0,
            opening_stock || 0, opening_stock || 0, barcode || null,
            min_stock || 0, max_stock_level || 0, gst_percent || 0, supplier_name || null,
            category || "Other", location || null, imageUrl,
            unit_type === "BUNDLE" ? "BUNDLE" : "PCS", parseFloat(pieces_per_bundle) || 1
        ])).rows[0];

        // 2. Inventory Table (auto-created simultaneously)
        const inventorySql = `
            INSERT INTO inventory (
                company_id, branch_id, product_id, product_name, sku, unit,
                current_stock, min_stock_level, max_stock_level, cost_price, selling_price,
                hsn_code, gst_percent, category, location
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING *;
        `;
        await client.query(inventorySql, [
            companyId, branchId, product.id, name, finalSku, unit || "pcs",
            opening_stock || 0, min_stock || 0, max_stock_level || 0, cost_price || 0, selling_price || 0,
            hsn_code || null, gst_percent || 0, category || "Other", location || null
        ]);
        
        // 2.1 + 3. Opening Stock via centralized inventory engine
        // Stock is placed ONLY in the owning branch — never duplicated to other branches.
        if (branchId && parseFloat(opening_stock || 0) > 0) {
            await addStock(client, {
                companyId,
                branchId,
                productId: product.id,
                qty: parseFloat(opening_stock),
                movementType: 'Opening Stock',
                referenceType: 'product_creation',
                referenceId: product.id,
                note: 'Opening stock entered at product creation'
            });
        }

        // Ledger Entry for Opening Stock
        if (parseFloat(opening_stock || 0) > 0) {
            const inventoryAccount = await client.query(
                `SELECT id FROM chart_of_accounts WHERE (company_id = $1 OR company_id IS NULL) AND account_code = '1400' LIMIT 1`,
                [companyId]
            );
            const openingStockAdjAccount = await client.query(
                `SELECT id FROM chart_of_accounts WHERE (company_id = $1 OR company_id IS NULL) AND account_code = '3000' LIMIT 1`,
                [companyId]
            );

            if (inventoryAccount.rows[0] && openingStockAdjAccount.rows[0]) {
                const stockValue = parseFloat(cost_price || 0) * parseFloat(opening_stock);
                const { createTransaction } = await import("../utils/accountingEngine.js");

                await createTransaction({
                    company_id: companyId,
                    branch_id: branchId,
                    transaction_date: new Date(),
                    reference_type: 'OPENING_STOCK',
                    reference_id: product.id,
                    description: `Opening stock for ${name}`,
                    created_by: userId
                }, [
                    { account_id: inventoryAccount.rows[0].id, debit_amount: stockValue, credit_amount: 0, description: 'Opening stock debit' },
                    { account_id: openingStockAdjAccount.rows[0].id, debit_amount: 0, credit_amount: stockValue, description: 'Opening stock adjustment credit' }
                ]);
            }
        }

        await client.query("COMMIT");
        return res.status(201).json({ message: "Product created and synced with inventory", product });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Create Product Error:", err);
        return res.status(500).json({ error: "Failed to create product: " + err.message });
    } finally {
        if (client) client.release();
    }
});

// Quick-create a product by name (JSON, no image upload)
router.post("/quick", authMiddleware, async (req, res) => {
    const companyId = parseInt(req.user?.active_company_id);
    const { name, unit = "pcs", gst_percent = 0, supplier_name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Product name required" });

    try {
        const existing = await pgModule.pgGet(
            `SELECT id, name, supplier_name FROM products WHERE company_id = $1 AND LOWER(name) = LOWER($2) AND is_deleted = false LIMIT 1`,
            [companyId, name.trim()]
        );
        if (existing) return res.json({ success: true, product: existing, created: false });

        const sku = `PROD-${Date.now().toString().slice(-6)}`;
        // pending_review = true: this name didn't exactly match anything existing,
        // which is exactly how "LEE MEN'S R/N" got created as a duplicate of
        // "MEN'S TOP LEE R/N" — stranding real purchased stock on a product
        // nothing else ever sells from. Flagging it keeps it out of every
        // Sales-facing product list until an admin either merges it into the
        // real product or explicitly confirms it as genuinely new.
        // supplier_name is stamped from whichever supplier is selected on the
        // bill this was quick-added from, so two genuinely separate products
        // that happen to share a name (e.g. "MEN'S TOP" bought from two
        // different suppliers) can be told apart instead of looking identical.
        const product = await pgModule.pgGet(
            `INSERT INTO products (company_id, name, unit, gst_percent, sku, selling_price, cost_price, opening_stock, current_stock, category, is_active, is_deleted, pending_review, supplier_name)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 'Other', 1, false, true, $6) RETURNING id, name, pending_review, supplier_name`,
            [companyId, name.trim(), unit, parseFloat(gst_percent) || 0, sku, supplier_name?.trim() || null]
        );
        return res.status(201).json({ success: true, product, created: true, pending_review: true });
    } catch (err) {
        console.error("Quick create product error:", err);
        return res.status(500).json({ error: "Failed to create product" });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /products/merge-duplicate — admin only
// Folds a duplicate product record (e.g. created by mistyping a name
// into the quick-add combobox, which matches by exact name only) into
// the canonical product everything else actually references. Moves
// branch_inventory stock (summed, not overwritten), re-points every
// other table with a product_id column at the canonical id, recomputes
// the canonical product's stock cache, and soft-deletes + renames the
// duplicate so it can never be picked again and its own history
// (purchase bills, movements) stays intact for audit purposes.
// ─────────────────────────────────────────────────────────────
router.post("/merge-duplicate", authMiddleware, async (req, res) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin only.' });
    }
    const companyId = req.user.active_company_id;
    const fromId = parseInt(req.body.from_product_id);
    const intoId = parseInt(req.body.into_product_id);
    if (!fromId || !intoId) return res.status(400).json({ error: 'from_product_id and into_product_id are required' });
    if (fromId === intoId) return res.status(400).json({ error: 'Cannot merge a product into itself' });

    const client = await pgModule.getClient();
    try {
        await client.query('BEGIN');

        const fromRes = await client.query(`SELECT id, name, branch_id FROM products WHERE id = $1 AND company_id = $2 FOR UPDATE`, [fromId, companyId]);
        const intoRes = await client.query(`SELECT id, name FROM products WHERE id = $1 AND company_id = $2 FOR UPDATE`, [intoId, companyId]);
        const fromProduct = fromRes.rows[0];
        const intoProduct = intoRes.rows[0];
        if (!fromProduct) return res.status(404).json({ error: 'Product to merge from was not found' });
        if (!intoProduct) return res.status(404).json({ error: 'Target product was not found' });

        // 1. Move branch_inventory stock — summed into whatever the target
        // already has per branch, never overwritten (ON CONFLICT ... +).
        const fromStock = await client.query(`SELECT branch_id, current_stock FROM branch_inventory WHERE product_id = $1`, [fromId]);
        for (const row of fromStock.rows) {
            if (Number(row.current_stock) === 0) continue;
            await client.query(`
                INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (branch_id, product_id)
                DO UPDATE SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()
            `, [companyId, row.branch_id, intoId, row.current_stock]);
        }
        await client.query(`DELETE FROM branch_inventory WHERE product_id = $1`, [fromId]);

        // 2. Re-point every other table that references product_id, so past
        // purchase bills, invoice lines and movement history correctly show
        // under the canonical product from here on. branch_inventory and
        // products themselves are handled separately above/below.
        const tableRows = await client.query(`
            SELECT DISTINCT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'product_id'
              AND table_name NOT IN ('branch_inventory', 'products')
        `);
        const repointed = [];
        for (const { table_name } of tableRows.rows) {
            try {
                const r = await client.query(`UPDATE ${table_name} SET product_id = $1 WHERE product_id = $2`, [intoId, fromId]);
                if (r.rowCount > 0) repointed.push(`${table_name} (${r.rowCount})`);
            } catch (e) {
                console.warn(`[merge-duplicate] skipped ${table_name}: ${e.message}`);
            }
        }

        // 3. Recompute the canonical product's stock cache from scratch.
        await client.query(`
            UPDATE products SET current_stock = (SELECT COALESCE(SUM(current_stock), 0) FROM branch_inventory WHERE product_id = $1)
            WHERE id = $1
        `, [intoId]);

        // 4. Soft-delete + rename the duplicate — never hard-deleted, so any
        // row that couldn't be re-pointed above still resolves to a real
        // (if clearly marked) product rather than a dangling foreign key.
        await client.query(`
            UPDATE products SET is_deleted = true, is_active = false,
                name = name || ' [merged into #' || $1 || ']'
            WHERE id = $2
        `, [intoId, fromId]);

        // 5. Audit trail — a zero-quantity movement note, not a real stock change.
        await client.query(`
            INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_in, reference_type, reference_id, note)
            VALUES ($1, $2, $3, 'ADJUSTMENT', 0, 'PRODUCT_MERGE', $4, $5)
        `, [companyId, fromProduct.branch_id || null, intoId, fromId, `Merged duplicate "${fromProduct.name}" (#${fromId}) into this product`]).catch(() => {});

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Merged "${fromProduct.name}" into "${intoProduct.name}"`,
            repointed_tables: repointed,
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[merge-duplicate]', err.message);
        res.status(500).json({ error: err.message || 'Merge failed' });
    } finally {
        client.release();
    }
});

// POST /products/:id/confirm — admin only
// Clears pending_review once the admin has checked this is genuinely a new
// product, not a near-duplicate of an existing one. If it IS a duplicate,
// use /merge-duplicate instead — that already clears it too (the merged
// row is soft-deleted, so it never shows up in the review queue again).
// Optional `name`: lets the admin correct/standardize the name in the same
// step instead of a separate trip to Edit Product first.
router.post("/:id/confirm", authMiddleware, async (req, res) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin only.' });
    }
    const companyId = req.user.active_company_id;
    const id = parseInt(req.params.id);
    const newName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    try {
        const product = newName
            ? await pgModule.pgGet(
                `UPDATE products SET pending_review = false, name = $3 WHERE id = $1 AND company_id = $2 RETURNING id, name, pending_review`,
                [id, companyId, newName]
            )
            : await pgModule.pgGet(
                `UPDATE products SET pending_review = false WHERE id = $1 AND company_id = $2 RETURNING id, name, pending_review`,
                [id, companyId]
            );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        return res.json({ success: true, product });
    } catch (err) {
        console.error("Confirm Pending Product Error:", err);
        return res.status(500).json({ error: "Failed to confirm product: " + err.message });
    }
});

// POST /products/:id/flag-for-review — admin only
// Pulls a pre-existing product into the same Pending Review queue used for
// new purchase-quick-adds, for products that predate that feature (and so
// were never flagged) but turn out to have the same naming/duplicate issue.
// Does not touch stock, cost, or name — only the pending_review flag, so
// nothing changes until the admin actually acts on it in the queue.
router.post("/:id/flag-for-review", authMiddleware, async (req, res) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin only.' });
    }
    const companyId = req.user.active_company_id;
    const id = parseInt(req.params.id);
    try {
        const product = await pgModule.pgGet(
            `UPDATE products SET pending_review = true WHERE id = $1 AND company_id = $2 RETURNING id, name, pending_review`,
            [id, companyId]
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        return res.json({ success: true, product });
    } catch (err) {
        console.error("Flag Product For Review Error:", err);
        return res.status(500).json({ error: "Failed to flag product for review: " + err.message });
    }
});

// POST /products/create-set — admin only
// Defines (or updates) a Set's recipe — which real products it's made of and
// how many of each. A Set has NO stock of its own: it's a pure sales-side
// grouping. Selling N units of a Set deducts N * qty_per_set from each real
// component at the moment of sale (see inventoryEngine.js's
// deductStockForSale) — nothing is pre-assembled or deducted here. This only
// ever writes product_set_components rows (+ creates the Set product itself
// if new); branch_inventory is never touched by this endpoint.
// POST /products/backfill-surplus-stock — admin only, re-runnable
// Recovers stock stuck in the old Surplus/Lot purchase path (purchaseBillRoutes.js's
// is_surplus=true flow used to store product_id=NULL forever — never linked to a
// real product, never credited to branch_inventory, invisible on the Product List
// and undeductible from a sale). That flow is now fixed going forward; this is a
// one-time (but safe-to-repeat) recovery for everything purchased before the fix.
// Source of truth: product_journeys rows with product_id IS NULL — those are
// exactly the orphaned surplus lines, and already carry the typed product name,
// quantities, rate, branch and supplier. Resolves/creates a real product by exact
// name match (same dedupe pattern as the regular quick-add path, flagged
// pending_review=true when newly created) and credits branch_inventory. Safe to
// re-run: each journey is linked (product_id set) once processed, so a repeat run
// only picks up genuinely new orphans.
router.post("/backfill-surplus-stock", authMiddleware, async (req, res) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin only.' });
    }
    const companyId = req.user.active_company_id;
    const client = await pgModule.getClient();
    try {
        await client.query('BEGIN');

        const orphanJourneys = await client.query(`
            SELECT id, product_name, fresh_purchased, mistake_purchased, branch_id, purchase_rate, supplier_name
            FROM product_journeys
            WHERE company_id = $1 AND product_id IS NULL
            ORDER BY id ASC
        `, [companyId]);

        const results = [];
        for (const j of orphanJourneys.rows) {
            const name = (j.product_name || '').trim();
            const totalQty = Number(j.fresh_purchased || 0) + Number(j.mistake_purchased || 0);
            if (!name || totalQty <= 0) continue;

            let productId;
            const existing = await client.query(
                `SELECT id FROM products WHERE company_id = $1 AND LOWER(name) = LOWER($2) AND is_deleted = false LIMIT 1`,
                [companyId, name]
            );
            if (existing.rows[0]) {
                productId = existing.rows[0].id;
            } else {
                const created = await client.query(`
                    INSERT INTO products (company_id, name, unit, selling_price, cost_price, opening_stock, current_stock, category, is_active, is_deleted, pending_review, supplier_name)
                    VALUES ($1, $2, 'pcs', 0, $3, 0, 0, 'Other', 1, false, true, $4)
                    RETURNING id
                `, [companyId, name, j.purchase_rate || 0, j.supplier_name || null]);
                productId = created.rows[0].id;
            }

            const branchId = j.branch_id || await resolveStockBranch(client, { companyId, productId });
            if (!branchId) {
                results.push({ journey_id: j.id, product_name: name, skipped: true, reason: 'no branch resolved' });
                continue;
            }

            await addStock(client, {
                companyId, branchId, productId, qty: totalQty,
                movementType: 'PURCHASE_IN',
                referenceType: 'surplus_backfill', referenceId: j.id,
                note: `Backfilled from orphaned surplus purchase journey #${j.id}`,
            });

            await client.query(`UPDATE product_journeys SET product_id = $1 WHERE id = $2`, [productId, j.id]);

            results.push({ journey_id: j.id, product_name: name, product_id: productId, qty_credited: totalQty });
        }

        await client.query('COMMIT');
        res.json({ success: true, processed: results.length, results });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[backfill-surplus-stock]', err.message);
        res.status(500).json({ error: err.message || 'Backfill failed' });
    } finally {
        client.release();
    }
});

router.post("/create-set", authMiddleware, async (req, res) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin only.' });
    }
    const companyId = req.user.active_company_id;
    const components = Array.isArray(req.body.components) ? req.body.components : [];
    let setProductId = req.body.set_product_id ? parseInt(req.body.set_product_id) : null;
    const setName = (req.body.set_name || '').trim();

    if (components.length === 0) return res.status(400).json({ error: 'At least one component is required' });
    for (const c of components) {
        if (!c.product_id || !(Number(c.qty_per_set) > 0)) {
            return res.status(400).json({ error: 'Each component needs a product_id and a qty_per_set greater than 0' });
        }
    }
    if (!setProductId && !setName) {
        return res.status(400).json({ error: 'set_product_id or set_name is required' });
    }

    const client = await pgModule.getClient();
    try {
        await client.query('BEGIN');

        if (setProductId) {
            const existing = await client.query(`SELECT id, name FROM products WHERE id = $1 AND company_id = $2 FOR UPDATE`, [setProductId, companyId]);
            if (!existing.rows[0]) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Set product not found' });
            }
        } else {
            const created = await client.query(`
                INSERT INTO products (company_id, name, unit, gst_percent, selling_price, cost_price, opening_stock, current_stock, category, is_active, is_deleted, pending_review, is_set)
                VALUES ($1, $2, 'PCS', 0, 0, 0, 0, 0, 'Set', true, false, false, true)
                RETURNING id, name
            `, [companyId, setName]);
            setProductId = created.rows[0].id;
        }

        // Validate every component belongs to this company.
        for (const c of components) {
            const compRes = await client.query(`SELECT id, name FROM products WHERE id = $1 AND company_id = $2 FOR UPDATE`, [c.product_id, companyId]);
            if (!compRes.rows[0]) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: `Component product #${c.product_id} not found` });
            }
            if (Number(c.product_id) === Number(setProductId)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'A set product cannot be a component of itself' });
            }
        }

        const setProductRow = await client.query(`SELECT name FROM products WHERE id = $1`, [setProductId]);
        const setProductName = setProductRow.rows[0]?.name || `Product #${setProductId}`;

        // Replace the recipe wholesale — a component dropped from this save
        // should stop being part of the set, not linger from a previous save.
        await client.query(`DELETE FROM product_set_components WHERE set_product_id = $1`, [setProductId]);
        for (const c of components) {
            await client.query(`
                INSERT INTO product_set_components (company_id, set_product_id, component_product_id, qty_per_set)
                VALUES ($1, $2, $3, $4)
            `, [companyId, setProductId, c.product_id, c.qty_per_set]);
        }

        await client.query(`UPDATE products SET is_set = true WHERE id = $1`, [setProductId]);

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Saved "${setProductName}" with ${components.length} component(s)`,
            set_product_id: setProductId,
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[create-set]', err.message);
        res.status(400).json({ error: err.message || 'Set save failed' });
    } finally {
        client.release();
    }
});

router.get("/breakdown", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    try {
        // main_stock        = stock at the main hub branch (from branch_inventory)
        // branches_total_stock = stock at all SUB-branches (excluding main hub)
        // Grand total = main_stock + branches_total_stock
        const sql = `
            WITH main_branch AS (
                SELECT id FROM branches
                WHERE company_id = $1
                ORDER BY (LOWER(COALESCE(branch_type,'')) LIKE '%main%') DESC, id ASC
                LIMIT 1
            )
            SELECT
                p.id as product_id,
                p.name, p.sku, p.unit,
                p.min_stock as main_min_stock,
                COALESCE(SUM(CASE WHEN bi.branch_id = mb.id THEN bi.current_stock ELSE 0 END), 0) AS main_stock,
                COALESCE(SUM(CASE WHEN bi.branch_id != mb.id THEN bi.current_stock ELSE 0 END), 0) AS branches_total_stock,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'branch_id', b.id,
                        'branch_name', b.branch_name,
                        'stock', COALESCE(bi.current_stock, 0)
                    ) ORDER BY b.id
                ) FILTER (WHERE b.id IS NOT NULL) as branch_details
            FROM products p
            LEFT JOIN branch_inventory bi ON p.id = bi.product_id
            LEFT JOIN branches b ON bi.branch_id = b.id
            CROSS JOIN main_branch mb
            WHERE p.company_id = $1 AND p.is_deleted = false
            GROUP BY p.id, p.name, p.sku, p.unit, p.min_stock, mb.id
            ORDER BY p.name ASC
        `;
        const breakdown = await pgModule.pgAll(sql, [companyId]);
        return res.json(breakdown);
    } catch (err) {
        console.error("Inventory breakdown error:", err);
        return res.status(500).json({ error: "Failed to fetch inventory breakdown" });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    const companyId = req.user?.active_company_id;
    try {
        // Products created via quick-add during a purchase (which matches by exact
        // name only — see /quick below) are pending_review by default, and excluded
        // here UNLESS the caller explicitly opts in (?include_pending=true — the
        // admin Inventory page and the Purchase Bill product picker, which both
        // need to see them so a duplicate can be found and merged/confirmed).
        // Every Sales-facing or customer-facing product list goes through this
        // same endpoint with no param, so it's safe by default rather than
        // requiring every one of those call sites to remember to exclude them.
        const includePending = req.query.include_pending === 'true';
        // current_stock = SUM of branch_inventory for all branches (the single source of truth).
        // Falls back to products.current_stock if no branch_inventory rows exist yet.
        const sql = `
            SELECT p.*,
                   COALESCE(bi_sum.total_stock, p.current_stock, 0) AS total_stock
            FROM products p
            LEFT JOIN (
                SELECT product_id, SUM(current_stock) AS total_stock
                FROM branch_inventory
                WHERE company_id = $1
                GROUP BY product_id
            ) bi_sum ON bi_sum.product_id = p.id
            WHERE p.company_id = $1 AND p.is_deleted = false
              ${includePending ? '' : "AND COALESCE(p.pending_review, false) = false"}
            ORDER BY p.id DESC
        `;
        const list = await pgModule.pgAll(sql, [companyId]);
        return res.json((list || []).map(p => ({ ...p, current_stock: p.total_stock ?? p.current_stock })));
    } catch (err) {
        console.error("List Products Error:", err);
        return res.status(500).json({ error: "Failed to fetch products: " + err.message });
    }
});

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const sql = `SELECT * FROM products WHERE id = $1 AND company_id = $2 AND is_deleted = false`;
        const product = await pgModule.pgGet(sql, [parseInt(req.params.id), req.user.active_company_id]);
        if (!product) return res.status(404).json({ error: "Product not found" });
        return res.json(product);
    } catch (err) {
        console.error("Get Product Error:", err);
        return res.status(500).json({ error: "Failed to fetch product: " + err.message });
    }
});

router.put("/:id", upload.single("image"), authMiddleware, async (req, res) => {
    const body = req.body || {};
    const companyId = req.user.active_company_id;

    let updateFields = [];
    let values = [];
    let index = 1;

    for (const key in body) {
        if (key === 'id' || key === 'company_id') continue;
        updateFields.push(`${key} = $${index}`);
        values.push(body[key]);
        index++;
    }

    // A real cost price being entered/confirmed here — even ₹0 — means this product
    // is no longer "auto-created from a typed sale, cost unknown". Clears on its own,
    // no separate step needed from whoever fills it in.
    if (Object.prototype.hasOwnProperty.call(body, 'cost_price')) {
        updateFields.push(`cost_price_pending = false`);
        updateFields.push(`cost_price_updated_at = NOW()`);
    }

    if (req.file) {
        updateFields.push(`image_url = $${index}`);
        values.push(`/uploads/products/${req.file.filename}`);
        index++;
    }

    values.push(parseInt(req.params.id));
    values.push(companyId);

    const sql = `
        UPDATE products
        SET ${updateFields.join(", ")}, updated_at = NOW()
        WHERE id = $${index} AND company_id = $${index + 1} AND is_deleted = false
        RETURNING *;
    `;

    try {
        const updated = await pgModule.pgGet(sql, values);
        if (!updated) return res.status(404).json({ error: "Product not found" });
        return res.json({ message: "Updated", updated });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update product" });
    }
});

/**
 * RULE 1 — NO DELETION EVER
 * Using PATCH for Archiving
 */
router.patch("/:id/archive", authMiddleware, async (req, res) => {
    try {
        const sql = `
            UPDATE products
            SET is_deleted = true, deleted_at = NOW()
            WHERE id = $1 AND company_id = $2
            RETURNING id
        `;
        const deleted = await pgModule.pgGet(sql, [req.params.id, req.user.active_company_id]);
        if (!deleted) return res.status(404).json({ error: "Product not found" });
        return res.json({ message: "Product archived successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to archive product" });
    }
});

export default router;
