// backend/services/inventoryService.js
import * as db from "../database/pg.js";
import { logAction } from "./auditLogService.js";

/**
 * Add product stock
 */
export const addStockEntry = async (companyId, stockData, userId) => {
    const {
        product_id,
        warehouse_id = 1,
        quantity,
        entry_type, // "purchase", "transfer", "adjustment", "return"
        reference_id = null,
        cost_per_unit,
        notes = null
    } = stockData;

    try {
        // Get current stock
        const currentStock = await db.pgGet(
            `SELECT quantity, valuation FROM product_stock 
             WHERE product_id = $1 AND warehouse_id = $2`,
            [product_id, warehouse_id]
        );

        const newQuantity = (currentStock?.quantity || 0) + quantity;
        const newValuation = newQuantity * cost_per_unit;

        // Create or update stock
        if (currentStock) {
            await db.pgRun(
                `UPDATE product_stock 
                 SET quantity = $1, valuation = $2, updated_at = NOW()
                 WHERE product_id = $3 AND warehouse_id = $4`,
                [newQuantity, newValuation, product_id, warehouse_id]
            );
        } else {
            await db.pgRun(
                `INSERT INTO product_stock (product_id, warehouse_id, quantity, valuation)
                 VALUES ($1, $2, $3, $4)`,
                [product_id, warehouse_id, newQuantity, newValuation]
            );
        }

        // Create stock transaction log
        const transaction = await db.pgRun(
            `INSERT INTO stock_transactions 
             (product_id, warehouse_id, entry_type, quantity, cost_per_unit, total_value, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [product_id, warehouse_id, entry_type, quantity, cost_per_unit, quantity * cost_per_unit, reference_id, notes]
        );

        // Check low stock alert
        const product = await db.pgGet("SELECT reorder_level FROM products WHERE id = $1", [product_id]);
        if (product && newQuantity <= product.reorder_level) {
            await db.pgRun(
                `INSERT INTO stock_alerts (product_id, alert_type, quantity, message)
                 VALUES ($1, 'LOW_STOCK', $2, $3)`,
                [product_id, newQuantity, `Stock low: ${newQuantity} units remaining`]
            );
        }

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "INVENTORY",
            action: "ADD_STOCK",
            resource_type: "stock_transaction",
            resource_id: transaction.id,
            new_data: { ...stockData, new_quantity: newQuantity },
            status: "success"
        });

        return {
            product_id,
            new_quantity: newQuantity,
            valuation: newValuation,
            transaction_id: transaction.id
        };
    } catch (err) {
        console.error("❌ Add stock error:", err);
        throw err;
    }
};

/**
 * Deduct stock on sale
 */
export const deductStockOnSale = async (companyId, invoiceId, lineItems, userId) => {
    try {
        for (const item of lineItems) {
            const { product_id, quantity, warehouse_id = 1 } = item;

            // Get current stock
            const stock = await db.pgGet(
                `SELECT id, quantity FROM product_stock 
                 WHERE product_id = $1 AND warehouse_id = $2`,
                [product_id, warehouse_id]
            );

            if (!stock || stock.quantity < quantity) {
                throw new Error(`Insufficient stock for product ${product_id}`);
            }

            // Deduct stock
            const newQuantity = stock.quantity - quantity;
            const cost = await db.pgGet(
                `SELECT cost_price FROM products WHERE id = $1`,
                [product_id]
            );

            await db.pgRun(
                `UPDATE product_stock 
                 SET quantity = $1, valuation = $2, updated_at = NOW()
                 WHERE id = $3`,
                [newQuantity, newQuantity * (cost?.cost_price || 0), stock.id]
            );

            // Log stock transaction
            await db.pgRun(
                `INSERT INTO stock_transactions 
                 (product_id, warehouse_id, entry_type, quantity, reference_id, notes)
                 VALUES ($1, $2, 'SALE', -$3, $4, $5)`,
                [product_id, warehouse_id, quantity, invoiceId, `Sold: Invoice #${invoiceId}`]
            );
        }

        return { deducted: true, invoice_id: invoiceId };
    } catch (err) {
        console.error("❌ Deduct stock error:", err);
        throw err;
    }
};

/**
 * Get inventory valuation
 */
export const getInventoryValuation = async (companyId) => {
    try {
        const valuation = await db.pgAll(
            `SELECT 
                p.id, p.product_name, p.product_code,
                ps.warehouse_id,
                ps.quantity,
                p.cost_price,
                (ps.quantity * p.cost_price) as stock_value
             FROM products p
             LEFT JOIN product_stock ps ON p.id = ps.product_id
             WHERE p.company_id = $1 AND p.is_active = TRUE
             ORDER BY p.product_name`,
            [companyId]
        );

        const totalValue = valuation.reduce((sum, item) => sum + (item.stock_value || 0), 0);

        return {
            items: valuation,
            total_inventory_value: totalValue,
            total_units: valuation.reduce((sum, item) => sum + (item.quantity || 0), 0)
        };
    } catch (err) {
        console.error("❌ Get inventory valuation error:", err);
        return { items: [], total_inventory_value: 0 };
    }
};

/**
 * Get stock levels
 */
export const getStockLevels = async (companyId) => {
    try {
        const stocks = await db.pgAll(
            `SELECT 
                p.id, p.product_name, p.product_code, p.reorder_level,
                COALESCE(ps.quantity, 0) as current_stock,
                CASE 
                    WHEN ps.quantity IS NULL OR ps.quantity <= 0 THEN 'OUT_OF_STOCK'
                    WHEN ps.quantity <= p.reorder_level THEN 'LOW_STOCK'
                    ELSE 'OK'
                END as status
             FROM products p
             LEFT JOIN product_stock ps ON p.id = ps.product_id
             WHERE p.company_id = $1 AND p.is_active = TRUE
             ORDER BY p.product_name`,
            [companyId]
        );

        const lowStocks = stocks.filter(s => s.status === "LOW_STOCK");
        const outOfStocks = stocks.filter(s => s.status === "OUT_OF_STOCK");

        return {
            all_stocks: stocks,
            low_stock_items: lowStocks,
            out_of_stock_items: outOfStocks,
            critical_count: lowStocks.length + outOfStocks.length
        };
    } catch (err) {
        console.error("❌ Get stock levels error:", err);
        return { all_stocks: [], low_stock_items: [], out_of_stock_items: [] };
    }
};

/**
 * Generate stock movement report
 */
export const getStockMovement = async (productId, startDate, endDate) => {
    try {
        const movements = await db.pgAll(
            `SELECT 
                st.id, st.entry_type, st.quantity, st.cost_per_unit,
                st.total_value, st.reference_id, st.created_at
             FROM stock_transactions st
             WHERE st.product_id = $1
             AND st.created_at BETWEEN $2 AND $3
             ORDER BY st.created_at DESC`,
            [productId, startDate, endDate]
        );

        const inwardMovement = movements
            .filter(m => ["purchase", "adjustment", "transfer"].includes(m.entry_type))
            .reduce((sum, m) => sum + m.quantity, 0);

        const outwardMovement = movements
            .filter(m => m.entry_type === "sale")
            .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

        return {
            movements,
            summary: {
                inward: inwardMovement,
                outward: outwardMovement,
                net: inwardMovement - outwardMovement
            }
        };
    } catch (err) {
        console.error("❌ Get stock movement error:", err);
        return { movements: [], summary: {} };
    }
};

/**
 * Get purchase orders pending
 */
export const getPendingPurchaseOrders = async (companyId) => {
    try {
        const orders = await db.pgAll(
            `SELECT po.*, s.supplier_name, 
                COUNT(poi.id) as item_count,
                SUM(poi.quantity * poi.unit_price) as total_amount
             FROM purchase_orders po
             JOIN suppliers s ON po.supplier_id = s.id
             LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
             WHERE po.company_id = $1 AND po.status IN ('PENDING', 'PARTIAL')
             GROUP BY po.id, s.id, s.supplier_name
             ORDER BY po.po_date DESC`,
            [companyId]
        );

        return orders;
    } catch (err) {
        console.error("❌ Get pending POs error:", err);
        return [];
    }
};

export default {
    addStockEntry,
    deductStockOnSale,
    getInventoryValuation,
    getStockLevels,
    getStockMovement,
    getPendingPurchaseOrders
};
