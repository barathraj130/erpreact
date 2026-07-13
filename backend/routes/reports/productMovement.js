// backend/routes/reports/productMovement.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

function resolveDateRange(query) {
    const { from, to, period } = query;
    const now = new Date();
    if (from && to) return { fromDate: from, toDate: to };
    if (period === 'today') {
        const d = now.toISOString().split('T')[0];
        return { fromDate: d, toDate: d };
    }
    if (period === 'week') {
        const w = new Date(now); w.setDate(now.getDate() - 7);
        return { fromDate: w.toISOString().split('T')[0], toDate: now.toISOString().split('T')[0] };
    }
    if (period === 'year') {
        return { fromDate: `${now.getFullYear()}-01-01`, toDate: now.toISOString().split('T')[0] };
    }
    return {
        fromDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        toDate: now.toISOString().split('T')[0],
    };
}

function newProductBucket(name) {
    return {
        product_name: name,
        total_sold_qty: 0, total_purchased_qty: 0, total_returned_qty: 0, total_converted_qty: 0,
        total_sale_amount: 0, total_purchase_amount: 0, total_return_amount: 0,
        fresh_sold: 0, mistake_sold: 0, fresh_purchased: 0, mistake_purchased: 0,
        good_returned: 0, mistake_returned: 0,
        sale_count: 0, purchase_count: 0, return_count: 0,
        branches: new Set(), invoice_types: new Set(), suppliers: new Set(), lot_numbers: new Set(),
        first_movement: null, last_movement: null,
    };
}

function mergeMovements(allMovements) {
    const productMap = {};
    allMovements.forEach((m) => {
        const key = (m.product_name || 'Unknown').toLowerCase().trim();
        if (!productMap[key]) productMap[key] = newProductBucket(m.product_name || 'Unknown');
        const p = productMap[key];

        if (m.movement_type === 'SALE') {
            p.total_sold_qty += parseFloat(m.total_qty || 0);
            p.total_sale_amount += parseFloat(m.total_amount || 0);
            p.fresh_sold += parseFloat(m.fresh_qty || 0);
            p.mistake_sold += parseFloat(m.mistake_qty || 0);
            p.sale_count += parseInt(m.transaction_count || 0);
            if (m.branches) m.branches.split(', ').forEach((b) => p.branches.add(b));
            if (m.invoice_types) m.invoice_types.split(', ').forEach((t) => p.invoice_types.add(t));
        } else if (m.movement_type === 'PURCHASE') {
            p.total_purchased_qty += parseFloat(m.total_qty || 0);
            p.total_purchase_amount += parseFloat(m.total_amount || 0);
            p.fresh_purchased += parseFloat(m.fresh_qty || 0);
            p.mistake_purchased += parseFloat(m.mistake_qty || 0);
            p.purchase_count += parseInt(m.transaction_count || 0);
            if (m.supplier_name) m.supplier_name.split(', ').forEach((s) => p.suppliers.add(s));
            if (m.lot_number) m.lot_number.split(', ').forEach((l) => p.lot_numbers.add(l));
        } else if (m.movement_type === 'RETURN') {
            p.total_returned_qty += parseFloat(m.total_qty || 0);
            p.total_return_amount += parseFloat(m.total_amount || 0);
            p.return_count += parseInt(m.transaction_count || 0);
            p.good_returned += parseFloat(m.good_qty || 0);
            p.mistake_returned += parseFloat(m.mistake_qty || 0);
        } else if (m.movement_type === 'CONVERSION') {
            p.total_converted_qty += parseFloat(m.total_qty || 0);
            if (m.lot_number) m.lot_number.split(', ').forEach((l) => p.lot_numbers.add(l));
        }

        const dates = [m.first_date, m.last_date].filter(Boolean).map((d) => String(d));
        dates.forEach((d) => {
            if (!p.first_movement || d < p.first_movement) p.first_movement = d;
            if (!p.last_movement || d > p.last_movement) p.last_movement = d;
        });
    });
    return productMap;
}

/**
 * GET /api/reports/product-movement
 * Unified view of every product that moved: sales (incl. free-text invoice
 * items), purchases (both lot-based and itemized bills), sales returns
 * (stored as a JSONB items array), and mistake->fresh stock conversions.
 */
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { fromDate, toDate } = resolveDateRange(req.query);
    const { product_name, movement_type } = req.query;
    const namePattern = product_name ? `%${product_name}%` : null;

    try {
        const [
            salesRows,
            purchaseLotRows,
            purchaseItemRows,
            returnRows,
            conversionRows,
        ] = await Promise.all([
            db.pgAll(`
                SELECT
                    TRIM(ili.description) AS product_name,
                    'SALE' AS movement_type,
                    'out' AS direction,
                    SUM(ili.quantity) AS total_qty,
                    COALESCE(AVG(ili.unit_price), 0) AS avg_rate,
                    COALESCE(SUM(ili.line_total), 0) AS total_amount,
                    COUNT(DISTINCT i.id) AS transaction_count,
                    MIN(i.invoice_date) AS first_date,
                    MAX(i.invoice_date) AS last_date,
                    COALESCE(SUM(CASE WHEN ili.stock_type IS NULL OR ili.stock_type IN ('fresh_purchased','fresh_repaired') THEN ili.quantity ELSE 0 END), 0) AS fresh_qty,
                    COALESCE(SUM(CASE WHEN ili.stock_type = 'mistake' THEN ili.quantity ELSE 0 END), 0) AS mistake_qty,
                    STRING_AGG(DISTINCT COALESCE(b.branch_name, 'Main'), ', ') AS branches,
                    STRING_AGG(DISTINCT i.invoice_type, ', ') AS invoice_types,
                    bool_and(ili.product_id IS NULL) AS is_typed_product
                FROM invoice_line_items ili
                JOIN invoices i ON i.id = ili.invoice_id
                LEFT JOIN branches b ON b.id = i.branch_id
                WHERE i.company_id = $1
                  AND COALESCE(i.is_deleted, false) = false
                  AND COALESCE(i.is_nominal, false) = false
                  AND COALESCE(i.bill_purpose, 'real') != 'name_only'
                  AND COALESCE(ili.is_return, false) = false
                  AND ili.description IS NOT NULL AND TRIM(ili.description) != ''
                  AND ili.quantity > 0
                  AND i.invoice_date BETWEEN $2 AND $3
                  AND ($4::text IS NULL OR LOWER(ili.description) LIKE LOWER($4))
                GROUP BY TRIM(ili.description)
                ORDER BY total_qty DESC
            `, [companyId, fromDate, toDate, namePattern]).catch(() => []),

            // Lot-based purchases: purchase_bills carries fresh/mistake qty+rate directly, one bill = one lot
            db.pgAll(`
                SELECT
                    p.name AS product_name,
                    'PURCHASE' AS movement_type,
                    'in' AS direction,
                    COALESCE(SUM(pb.fresh_qty), 0) + COALESCE(SUM(pb.mistake_qty), 0) AS total_qty,
                    CASE WHEN (COALESCE(SUM(pb.fresh_qty),0) + COALESCE(SUM(pb.mistake_qty),0)) > 0
                        THEN (COALESCE(SUM(pb.fresh_qty * pb.fresh_rate),0) + COALESCE(SUM(pb.mistake_qty * pb.mistake_rate),0))
                             / (COALESCE(SUM(pb.fresh_qty),0) + COALESCE(SUM(pb.mistake_qty),0))
                        ELSE 0 END AS avg_rate,
                    COALESCE(SUM(pb.fresh_qty * pb.fresh_rate), 0) + COALESCE(SUM(pb.mistake_qty * pb.mistake_rate), 0) AS total_amount,
                    COUNT(DISTINCT pb.id) AS transaction_count,
                    MIN(pb.bill_date) AS first_date,
                    MAX(pb.bill_date) AS last_date,
                    COALESCE(SUM(pb.fresh_qty), 0) AS fresh_qty,
                    COALESCE(SUM(pb.mistake_qty), 0) AS mistake_qty,
                    STRING_AGG(DISTINCT COALESCE(s.name, pb.supplier_name), ', ') AS supplier_name,
                    STRING_AGG(DISTINCT pb.lot_number, ', ') AS lot_number
                FROM purchase_bills pb
                JOIN stock_lots sl ON sl.id = pb.lot_id
                JOIN products p ON p.id = sl.product_id
                LEFT JOIN suppliers s ON s.id = pb.supplier_id
                WHERE pb.company_id = $1
                  AND COALESCE(pb.is_deleted, false) = false
                  AND pb.lot_id IS NOT NULL
                  AND pb.bill_date BETWEEN $2 AND $3
                  AND ($4::text IS NULL OR LOWER(p.name) LIKE LOWER($4))
                GROUP BY p.name
                ORDER BY total_qty DESC
            `, [companyId, fromDate, toDate, namePattern]).catch(() => []),

            // Itemized GST purchase bills
            db.pgAll(`
                SELECT
                    TRIM(COALESCE(pbi.description, p.name, 'Unknown Product')) AS product_name,
                    'PURCHASE' AS movement_type,
                    'in' AS direction,
                    COALESCE(SUM(pbi.quantity), 0) AS total_qty,
                    COALESCE(AVG(pbi.unit_price), 0) AS avg_rate,
                    COALESCE(SUM(pbi.line_total), 0) AS total_amount,
                    COUNT(DISTINCT pb.id) AS transaction_count,
                    MIN(pb.bill_date) AS first_date,
                    MAX(pb.bill_date) AS last_date,
                    COALESCE(SUM(pbi.quantity), 0) AS fresh_qty,
                    0 AS mistake_qty,
                    STRING_AGG(DISTINCT COALESCE(s.name, pb.supplier_name), ', ') AS supplier_name,
                    NULL AS lot_number
                FROM purchase_bill_items pbi
                JOIN purchase_bills pb ON pb.id = pbi.bill_id
                LEFT JOIN products p ON p.id = pbi.product_id
                LEFT JOIN suppliers s ON s.id = pb.supplier_id
                WHERE pb.company_id = $1
                  AND COALESCE(pb.is_deleted, false) = false
                  AND COALESCE(pbi.is_deleted, false) = false
                  AND pb.bill_date BETWEEN $2 AND $3
                  AND ($4::text IS NULL OR LOWER(COALESCE(pbi.description, p.name, '')) LIKE LOWER($4))
                GROUP BY TRIM(COALESCE(pbi.description, p.name, 'Unknown Product'))
                ORDER BY total_qty DESC
            `, [companyId, fromDate, toDate, namePattern]).catch(() => []),

            // Sales returns: line items live in a JSONB array, not a child table.
            // Good/mistake split comes from a separate follow-up inspection step
            // (sales_return_inspections) — a return's qty is "ungraded" until then.
            db.pgAll(`
                SELECT
                    TRIM(item->>'description') AS product_name,
                    'RETURN' AS movement_type,
                    'in' AS direction,
                    COALESCE(SUM((item->>'qty')::numeric), 0) AS total_qty,
                    COALESCE(AVG((item->>'rate')::numeric), 0) AS avg_rate,
                    COALESCE(SUM((item->>'line_total')::numeric), 0) AS total_amount,
                    COUNT(DISTINCT sr.id) AS transaction_count,
                    MIN(sr.return_date) AS first_date,
                    MAX(sr.return_date) AS last_date,
                    COALESCE(SUM(insp.good_qty), 0) AS good_qty,
                    COALESCE(SUM(insp.mistake_qty), 0) AS mistake_qty
                FROM sales_returns sr
                CROSS JOIN LATERAL jsonb_array_elements(sr.items) AS item
                LEFT JOIN (
                    SELECT return_id, product_id, SUM(good_qty) AS good_qty, SUM(mistake_qty) AS mistake_qty
                    FROM sales_return_inspections
                    GROUP BY return_id, product_id
                ) insp ON insp.return_id = sr.id AND insp.product_id = (item->>'product_id')::int
                WHERE sr.company_id = $1
                  AND sr.return_date BETWEEN $2 AND $3
                  AND item->>'description' IS NOT NULL AND TRIM(item->>'description') != ''
                  AND ($4::text IS NULL OR LOWER(item->>'description') LIKE LOWER($4))
                GROUP BY TRIM(item->>'description')
                ORDER BY total_qty DESC
            `, [companyId, fromDate, toDate, namePattern]).catch(() => []),

            // Mistake -> fresh conversions (stock_conversions has no product_id itself, join via lot)
            db.pgAll(`
                SELECT
                    p.name AS product_name,
                    'CONVERSION' AS movement_type,
                    'in' AS direction,
                    COALESCE(SUM(sc.fresh_qty_out), 0) AS total_qty,
                    COALESCE(AVG(sc.repair_cost_per_piece), 0) AS avg_rate,
                    COALESCE(SUM(sc.total_repair_cost), 0) AS total_amount,
                    COUNT(sc.id) AS transaction_count,
                    MIN(sc.conversion_date) AS first_date,
                    MAX(sc.conversion_date) AS last_date,
                    COALESCE(SUM(sc.fresh_qty_out), 0) AS fresh_qty,
                    0 AS mistake_qty,
                    STRING_AGG(DISTINCT sl.lot_number, ', ') AS lot_number
                FROM stock_conversions sc
                JOIN stock_lots sl ON sl.id = sc.lot_id
                JOIN products p ON p.id = sl.product_id
                WHERE sl.company_id = $1
                  AND sc.conversion_date BETWEEN $2 AND $3
                  AND ($4::text IS NULL OR LOWER(p.name) LIKE LOWER($4))
                GROUP BY p.name
                ORDER BY total_qty DESC
            `, [companyId, fromDate, toDate, namePattern]).catch(() => []),
        ]);

        let allMovements = [
            ...salesRows, ...purchaseLotRows, ...purchaseItemRows, ...returnRows, ...conversionRows,
        ];
        if (movement_type && movement_type !== 'all') {
            allMovements = allMovements.filter((m) => m.movement_type === movement_type.toUpperCase());
        }

        const productMap = mergeMovements(allMovements);
        const productSummary = Object.values(productMap).map((p) => {
            // Net of returns: a returned piece was never really "sold" from the
            // business's point of view, so both qty and revenue exclude it here.
            const netSoldQty = p.total_sold_qty - p.total_returned_qty;
            const netSaleAmount = p.total_sale_amount - p.total_return_amount;
            return {
                product_name: p.product_name,
                total_sold_qty: netSoldQty,
                gross_sold_qty: p.total_sold_qty,
                total_purchased_qty: p.total_purchased_qty,
                total_returned_qty: p.total_returned_qty,
                total_converted_qty: p.total_converted_qty,
                net_movement: p.total_purchased_qty + p.total_converted_qty - netSoldQty,
                total_sale_amount: netSaleAmount,
                gross_sale_amount: p.total_sale_amount,
                total_purchase_amount: p.total_purchase_amount,
                total_return_amount: p.total_return_amount,
                gross_profit: netSaleAmount - p.total_purchase_amount,
                fresh_sold: p.fresh_sold,
                mistake_sold: p.mistake_sold,
                fresh_purchased: p.fresh_purchased,
                mistake_purchased: p.mistake_purchased,
                good_returned: p.good_returned,
                mistake_returned: p.mistake_returned,
                sale_count: p.sale_count,
                purchase_count: p.purchase_count,
                return_count: p.return_count,
                branches: Array.from(p.branches),
                invoice_types: Array.from(p.invoice_types),
                suppliers: Array.from(p.suppliers),
                lot_numbers: Array.from(p.lot_numbers),
                first_movement: p.first_movement,
                last_movement: p.last_movement,
                avg_selling_rate: netSoldQty > 0 ? netSaleAmount / netSoldQty : 0,
                avg_purchase_rate: p.total_purchased_qty > 0 ? p.total_purchase_amount / p.total_purchased_qty : 0,
            };
        }).sort((a, b) => b.total_sold_qty - a.total_sold_qty);

        const totalSoldQty = productSummary.reduce((s, p) => s + p.total_sold_qty, 0);
        const totalPurchasedQty = productSummary.reduce((s, p) => s + p.total_purchased_qty, 0);
        const totalReturnedQty = productSummary.reduce((s, p) => s + p.total_returned_qty, 0);
        const totalSaleAmount = productSummary.reduce((s, p) => s + p.total_sale_amount, 0);
        const totalPurchaseAmount = productSummary.reduce((s, p) => s + p.total_purchase_amount, 0);

        const typedOnlyProducts = productSummary
            .filter((p) => p.total_sold_qty > 0 && p.purchase_count === 0)
            .map((p) => p.product_name);

        res.json({
            period: { from: fromDate, to: toDate },
            summary: {
                total_products: productSummary.length,
                total_sold_qty: totalSoldQty,
                total_purchased_qty: totalPurchasedQty,
                total_returned_qty: totalReturnedQty,
                total_sale_amount: totalSaleAmount,
                total_purchase_amount: totalPurchaseAmount,
                gross_profit: totalSaleAmount - totalPurchaseAmount,
                typed_only_products: typedOnlyProducts.length,
            },
            products: productSummary,
            raw_movements: allMovements,
            typed_only_products: typedOnlyProducts,
        });
    } catch (e) {
        console.error('Product movement report error:', e.message);
        res.json({
            period: { from: fromDate, to: toDate },
            summary: { total_products: 0, total_sold_qty: 0, total_purchased_qty: 0, total_returned_qty: 0, total_sale_amount: 0, total_purchase_amount: 0, gross_profit: 0, typed_only_products: 0 },
            products: [], raw_movements: [], typed_only_products: [],
        });
    }
});

/**
 * GET /api/reports/product-movement/detail/:productName
 * Full transaction-level drill-down for one product name (matches free-text
 * descriptions and inventory-linked names the same way).
 */
router.get('/detail/:productName', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const productName = decodeURIComponent(req.params.productName);
    const { fromDate, toDate } = resolveDateRange(req.query);
    const namePattern = `%${productName}%`;

    try {
        const [sales, purchaseLots, purchaseItems, returns] = await Promise.all([
            db.pgAll(`
                SELECT
                    i.invoice_number, i.invoice_date, i.invoice_type,
                    ili.quantity, ili.unit_price AS rate, ili.line_total AS amount, ili.stock_type,
                    COALESCE(u.nickname, u.username, 'Walk-in') AS customer_name,
                    u.phone AS customer_phone,
                    b.branch_name AS branch_name
                FROM invoice_line_items ili
                JOIN invoices i ON i.id = ili.invoice_id
                LEFT JOIN users u ON u.id = i.customer_id
                LEFT JOIN branches b ON b.id = i.branch_id
                WHERE i.company_id = $1
                  AND COALESCE(i.is_deleted, false) = false
                  AND LOWER(ili.description) LIKE LOWER($2)
                  AND i.invoice_date BETWEEN $3 AND $4
                ORDER BY i.invoice_date DESC
            `, [companyId, namePattern, fromDate, toDate]).catch(() => []),

            db.pgAll(`
                SELECT
                    pb.bill_number, pb.bill_date,
                    pb.fresh_qty, pb.mistake_qty, pb.fresh_rate, pb.mistake_rate,
                    (COALESCE(pb.fresh_qty,0) * COALESCE(pb.fresh_rate,0)) + (COALESCE(pb.mistake_qty,0) * COALESCE(pb.mistake_rate,0)) AS total_amount,
                    COALESCE(s.name, pb.supplier_name) AS supplier_name,
                    pb.lot_number
                FROM purchase_bills pb
                JOIN stock_lots sl ON sl.id = pb.lot_id
                JOIN products p ON p.id = sl.product_id
                LEFT JOIN suppliers s ON s.id = pb.supplier_id
                WHERE pb.company_id = $1
                  AND COALESCE(pb.is_deleted, false) = false
                  AND LOWER(p.name) LIKE LOWER($2)
                  AND pb.bill_date BETWEEN $3 AND $4
                ORDER BY pb.bill_date DESC
            `, [companyId, namePattern, fromDate, toDate]).catch(() => []),

            db.pgAll(`
                SELECT
                    pb.bill_number, pb.bill_date,
                    pbi.quantity AS fresh_qty, 0 AS mistake_qty,
                    pbi.unit_price AS fresh_rate, 0 AS mistake_rate,
                    pbi.line_total AS total_amount,
                    COALESCE(s.name, pb.supplier_name) AS supplier_name,
                    NULL AS lot_number
                FROM purchase_bill_items pbi
                JOIN purchase_bills pb ON pb.id = pbi.bill_id
                LEFT JOIN products p ON p.id = pbi.product_id
                LEFT JOIN suppliers s ON s.id = pb.supplier_id
                WHERE pb.company_id = $1
                  AND COALESCE(pb.is_deleted, false) = false
                  AND COALESCE(pbi.is_deleted, false) = false
                  AND LOWER(COALESCE(pbi.description, p.name, '')) LIKE LOWER($2)
                  AND pb.bill_date BETWEEN $3 AND $4
                ORDER BY pb.bill_date DESC
            `, [companyId, namePattern, fromDate, toDate]).catch(() => []),

            db.pgAll(`
                SELECT
                    sr.return_number, sr.return_date,
                    (item->>'qty')::numeric AS quantity,
                    (item->>'rate')::numeric AS rate,
                    (item->>'line_total')::numeric AS amount,
                    COALESCE(u.nickname, u.username, sr.customer_name, 'Walk-in') AS customer_name,
                    COALESCE(insp.good_qty, 0) AS good_qty,
                    COALESCE(insp.mistake_qty, 0) AS mistake_qty,
                    CASE
                        WHEN insp.total_inspected IS NULL THEN 'ungraded'
                        WHEN insp.total_inspected >= (item->>'qty')::numeric THEN 'graded'
                        ELSE 'partial'
                    END AS inspection_status
                FROM sales_returns sr
                CROSS JOIN LATERAL jsonb_array_elements(sr.items) AS item
                LEFT JOIN users u ON u.id = sr.customer_id
                LEFT JOIN (
                    SELECT return_id, product_id, SUM(good_qty) good_qty, SUM(mistake_qty) mistake_qty, SUM(total_qty_inspected) total_inspected
                    FROM sales_return_inspections GROUP BY return_id, product_id
                ) insp ON insp.return_id = sr.id AND insp.product_id = (item->>'product_id')::int
                WHERE sr.company_id = $1
                  AND LOWER(item->>'description') LIKE LOWER($2)
                  AND sr.return_date BETWEEN $3 AND $4
                ORDER BY sr.return_date DESC
            `, [companyId, namePattern, fromDate, toDate]).catch(() => []),
        ]);

        const purchases = [...purchaseLots, ...purchaseItems];

        res.json({
            product_name: productName,
            period: { from: fromDate, to: toDate },
            sales,
            purchases,
            returns,
            summary: {
                total_sold: sales.reduce((s, r) => s + parseFloat(r.quantity || 0), 0),
                total_purchased: purchases.reduce((s, r) => s + parseFloat(r.fresh_qty || 0) + parseFloat(r.mistake_qty || 0), 0),
                total_returned: returns.reduce((s, r) => s + parseFloat(r.quantity || 0), 0),
                sale_revenue: sales.reduce((s, r) => s + parseFloat(r.amount || 0), 0),
                purchase_cost: purchases.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0),
            },
        });
    } catch (e) {
        console.error('Product movement detail error:', e.message);
        res.json({ product_name: productName, sales: [], purchases: [], returns: [], summary: {} });
    }
});

export default router;
