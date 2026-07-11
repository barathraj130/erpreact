// backend/routes/invoiceRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import { checkAccess } from "../middlewares/checkAccess.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import {
    createCustomerLedgerEvent,
    deleteCustomerLedgerEvents,
    ensureCustomerLedgerMetadata,
    recomputeCustomerBalance,
} from "../services/customerLedgerService.js";
import { createTransaction, createTransactionInternal, getAccountByCode } from "../utils/accountingEngine.js";
import { deductStock, addStock, resolveStockBranch, restoreStockForInvoice } from "../utils/inventoryEngine.js";
import * as brokerService from "../services/brokerService.js";
import * as pointsService from "../services/pointsService.js";
import { triggerN8N } from "../utils/triggerN8N.js";
import { generateInvoicePdf } from "../utils/invoicePdf.js";
import { determineGstType } from "../utils/gstCalculator.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
const INVOICES_DIR = path.join(__dirname, '../uploads/invoices');

const router = express.Router();

// One-time lazy migration for NSB GST tracking columns
let _nsbSchemaDone = false;
async function ensureNSBSchema(client) {
    if (_nsbSchemaDone) return;
    try {
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_nominal BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS walk_in_name VARCHAR(200)`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_liability_amount NUMERIC(10,2) DEFAULT 0`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_paid BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_paid_date DATE`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_paid_mode VARCHAR(20)`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS nsb_gst_payments (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER NOT NULL,
                invoice_number VARCHAR(50),
                gst_amount NUMERIC(10,2) DEFAULT 0,
                cgst_amount NUMERIC(10,2) DEFAULT 0,
                sgst_amount NUMERIC(10,2) DEFAULT 0,
                igst_amount NUMERIC(10,2) DEFAULT 0,
                payment_mode VARCHAR(20),
                payment_date DATE,
                payment_reference VARCHAR(100),
                notes TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        _nsbSchemaDone = true;
    } catch(e) { console.warn('[NSB] schema migration warning:', e.message); }
}

/* ============================================================
   HELPER: Invoice Number Series
   Format: PREFIX/YEAR/MM/NNN  e.g. TAX/2026/05/001
   Each bill type has its own independent counter, resets each month.
============================================================ */

// Map invoice_type → series prefix
// TAX_INVOICE → TAX | NOMINAL_TAX_INVOICE → NSB | NON_TAX_INVOICE → INV
// RETAIL_SALE → RET | GIFTED_ITEM → GFT
// Canonical status names: PAID | PARTIAL | PENDING
// Use this everywhere instead of hardcoded strings.
function getStatus(paid, total) {
    const p = parseFloat(paid) || 0;
    const t = parseFloat(total) || 0;
    if (p <= 0) return 'PENDING';
    if (p >= t) return 'PAID';
    return 'PARTIAL';
}

function resolveBillType(invoiceType, billPurpose) {
    if (billPurpose === 'name_only') return 'NSB';
    switch ((invoiceType || '').toUpperCase()) {
        case 'TAX_INVOICE':         return 'TAX';
        case 'NOMINAL_TAX_INVOICE': return 'NSB';
        case 'NON_TAX_INVOICE':     return 'INV';
        case 'RETAIL_SALE':         return 'RET';
        case 'GIFTED_ITEM':         return 'GFT';
        default:                    return 'INV';
    }
}

// Format: PREFIX/YEAR/MM/NNN  e.g. TAX/2026/05/001
// Each bill type has its own independent counter so TAX:1 and RET:1 coexist.
function formatInvoiceNumber(prefix, year, month, num) {
    return `${prefix}/${year}/${String(month).padStart(2, '0')}/${String(num).padStart(3, '0')}`;
}

async function generateInvoiceNumber(client, type, companyId, branchId, billPurpose) {
    const now = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const financial_month = `${year}-${String(month).padStart(2, '0')}`;

    if (branchId) {
        // Branch-specific sequence (stored on the branches row)
        const branchResult = await client.query(
            `UPDATE branches SET bill_sequence = bill_sequence + 1
             WHERE id = $1 RETURNING bill_sequence, bill_prefix`,
            [branchId]
        );
        const { bill_sequence, bill_prefix } = branchResult.rows[0];
        const prefix = bill_prefix || `B${branchId}`;
        return {
            number: formatInvoiceNumber(prefix, year, month, bill_sequence),
            financial_month,
            series_prefix: prefix,
            series_number: bill_sequence
        };
    }

    // Main branch — atomic counter per (company, bill_type, year, month).
    // Uses invoice_number_series table: INSERT on first bill of month, UPDATE on subsequent.
    // Fully independent per bill type — TAX:1, RET:1, INV:1 never clash.
    const prefix = resolveBillType(type, billPurpose);

    const { rows } = await client.query(
        `INSERT INTO invoice_number_series (company_id, bill_type, prefix, year, month, last_number)
         VALUES ($1, $2, $3, $4, $5, 1)
         ON CONFLICT (company_id, bill_type, year, month)
         DO UPDATE SET last_number = invoice_number_series.last_number + 1
         RETURNING last_number`,
        [companyId, prefix, prefix, year, month]
    );
    const num = rows[0].last_number;

    return {
        number: formatInvoiceNumber(prefix, year, month, num),
        financial_month,
        series_prefix: prefix,
        series_number: num,
    };
}

/* ============================================================
   0a. FULL RESET — delete ALL invoices & related data, reset sequences
   POST /invoice/full-reset   (admin/superadmin only)
============================================================ */
router.post("/full-reset", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const role = req.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({ error: "Admin only." });
    }
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // 1. Delete all invoice-related data for this company
        await client.query(`DELETE FROM invoice_payments    WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)`, [companyId]);
        await client.query(`DELETE FROM invoice_line_items  WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)`, [companyId]);
        await client.query(`DELETE FROM customer_ledger     WHERE company_id = $1`, [companyId]);
        await client.query(`DELETE FROM customer_points     WHERE customer_id IN (SELECT id FROM users WHERE active_company_id = $1)`, [companyId]).catch(() => {});
        await client.query(`DELETE FROM inventory_movements WHERE company_id = $1 AND reference_type = 'INVOICE'`, [companyId]).catch(() => {});
        await client.query(`DELETE FROM invoices            WHERE company_id = $1`, [companyId]);

        // 2. Reset invoice_number_series for this company
        await client.query(`DELETE FROM invoice_number_series WHERE company_id = $1`, [companyId]).catch(() => {});

        // 3. Restore stock to 0 for all products (since we wiped all invoice movements)
        await client.query(`UPDATE branch_inventory SET current_stock = 0 WHERE company_id = $1`, [companyId]).catch(() => {});
        await client.query(`UPDATE products SET current_stock = 0 WHERE company_id = $1`, [companyId]).catch(() => {});

        // 4. Drop the old global unique constraint on invoice_number — this is the
        //    root cause of "duplicate key violates unique constraint" errors.
        //    Each statement is separate so one failure doesn't abort the others.
        await client.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key`).catch(() => {});
        await client.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_invoice_number_key`).catch(() => {});
        await client.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_type_invoice_number_key`).catch(() => {});
        await client.query(`DROP INDEX IF EXISTS idx_invoices_company_number_active`).catch(() => {});
        await client.query(`DROP INDEX IF EXISTS idx_invoices_company_type_number`).catch(() => {});

        // 5. Reset the invoices table sequence so new IDs start from 1
        //    (only if this company was the only one using the table — safe for single-tenant)
        const remaining = await client.query(`SELECT COUNT(*) AS cnt FROM invoices`);
        if (Number(remaining.rows[0].cnt) === 0) {
            await client.query(`ALTER SEQUENCE invoices_id_seq RESTART WITH 1`).catch(() => {});
            await client.query(`ALTER SEQUENCE invoice_line_items_id_seq RESTART WITH 1`).catch(() => {});
            await client.query(`ALTER SEQUENCE invoice_payments_id_seq RESTART WITH 1`).catch(() => {});
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "All invoice data deleted. IDs and series reset to 1. Start creating fresh invoices." });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("[full-reset] Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   0. STOCK REPAIR — re-run deductions for invoices missing movements
   POST /invoice/repair-stock   (admin only, idempotent)
============================================================ */
router.post("/repair-stock", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // Find all active invoices for this company
        const invoices = await client.query(
            `SELECT i.id, i.branch_id, i.bill_purpose FROM invoices i
             WHERE i.company_id = $1 AND COALESCE(i.is_deleted, false) = false`,
            [companyId]
        );

        let repaired = 0;
        for (const inv of invoices.rows) {
            if (inv.bill_purpose === 'name_only') continue;

            // Find line items that have a product_id but no SALE_OUT movement
            const items = await client.query(
                `SELECT li.product_id, li.quantity
                 FROM invoice_line_items li
                 WHERE li.invoice_id = $1
                   AND li.product_id IS NOT NULL
                   AND COALESCE(li.is_return, false) = false
                   AND NOT EXISTS (
                       SELECT 1 FROM inventory_movements im
                       WHERE im.reference_type = 'INVOICE'
                         AND im.reference_id = $1
                         AND im.product_id = li.product_id
                         AND im.type = 'SALE_OUT'
                   )`,
                [inv.id]
            );

            for (const item of items.rows) {
                if (!item.product_id || !(item.quantity > 0)) continue;

                const branchId = await resolveStockBranch(client, {
                    companyId,
                    requestedBranchId: inv.branch_id || null,
                    productId: item.product_id,
                });

                if (!branchId) continue;

                try {
                    const result = await deductStock(client, {
                        companyId,
                        branchId,
                        productId: item.product_id,
                        qty: Number(item.quantity),
                        referenceType: 'INVOICE',
                        referenceId: inv.id,
                        note: 'Repaired by /repair-stock',
                    });
                    if (result.success) {
                        repaired++;
                        console.log(`[repair-stock] ✓ invoice#${inv.id} product#${item.product_id} −${item.quantity}`);
                    }
                } catch (e) {
                    console.warn(`[repair-stock] SKIP invoice#${inv.id} product#${item.product_id}: ${e.message}`);
                }
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, repaired, message: `Fixed ${repaired} missing stock deduction(s)` });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("[repair-stock] Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   0b. PREVIEW NEXT INVOICE NUMBER  (read-only, no side effects)
   GET /invoice/preview-number?type=TAX_INVOICE
============================================================ */
router.get("/preview-number", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const invoiceType = req.query.type || 'TAX_INVOICE';
    const billPurpose  = req.query.purpose || 'real';
    const prefix = resolveBillType(invoiceType, billPurpose);
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
        const result = await db.pgAll(
            `SELECT COALESCE(last_number, 0) + 1 AS next_num
             FROM invoice_number_series
             WHERE company_id = $1 AND bill_type = $2
               AND year = $3 AND month = $4
             LIMIT 1`,
            [companyId, prefix, year, month]
        );
        const nextNum = result[0] ? Number(result[0].next_num) : 1;
        res.json({ next_number: formatInvoiceNumber(prefix, year, month, nextNum) });
    } catch (err) {
        // If series table not ready yet, just show "001"
        res.json({ next_number: formatInvoiceNumber(prefix, year, month, 1) });
    }
});

/* ============================================================
   1. GET ALL INVOICES
============================================================ */
router.get("/", authMiddleware, checkAccess('Sales', 'view_invoices'), async (req, res) => {
    const companyId = req.user.active_company_id;
    const sql = `
        SELECT i.id, i.invoice_number, i.invoice_type, i.invoice_date, i.status,
               i.customer_id, i.notes, i.paid_amount, i.discount_amount,
               i.cgst_total, i.sgst_total, i.igst_total, i.tax_total,
               i.sub_total, i.vehicle_number, i.transportation_mode, i.date_of_supply,
               i.reverse_charge, i.bundles_count, i.bill_purpose, i.series_prefix,
               i.walk_in_name,
               i.created_at, i.updated_at,
               COALESCE(u.nickname, u.username) as customer_name,
               CASE
                 WHEN UPPER(COALESCE(i.invoice_type,'')) IN ('NON_TAX_INVOICE','RETAIL_SALE','GIFTED_ITEM','NSB_INVOICE')
                    OR i.invoice_number LIKE 'INV/%'
                 THEN COALESCE(
                   (SELECT SUM(li2.taxable_value) FROM invoice_line_items li2 WHERE li2.invoice_id = i.id AND COALESCE(li2.is_return, false) = false),
                   i.sub_total,
                   i.total_amount
                 )
                 ELSE COALESCE(
                   (SELECT SUM(li2.line_total) FROM invoice_line_items li2 WHERE li2.invoice_id = i.id AND COALESCE(li2.is_return, false) = false),
                   i.total_amount
                 )
               END AS total_amount,
               COALESCE(json_agg(li.*) FILTER (WHERE li.id IS NOT NULL), '[]') AS line_items
        FROM invoices i
        LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
        LEFT JOIN users u ON i.customer_id = u.id
        WHERE i.company_id = $1 AND COALESCE(i.is_deleted, false) = false
        GROUP BY i.id, u.nickname, u.username
        ORDER BY i.created_at DESC
    `;
    try {
        const rows = await db.pgAll(sql, [companyId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
});

/* ============================================================
   2. CREATE INVOICE (CRITICAL FIXES FOR COLUMN NAMES)
============================================================ */
router.post("/", authMiddleware, checkAccess('Sales', 'create_invoices'), async (req, res) => {
    const {
        invoice_number, invoice_type, customer_id, items, notes,
        amount_paid, discount_amount, balance_due, payment_status, payments,
        transport_details, bundles_count, return_items,
        broker_id, broker_commission_rate,
        bill_purpose, // 'real' or 'name_only'
        points_to_redeem, // Points to redeem on this invoice
        tax_details,      // { cgst, sgst, igst, totalRate } — invoice-level GST from frontend
        delivery_order_id, // Links back to the delivery order that spawned this invoice
        walk_in_name,     // Retail walk-in customer name (no account required)
        credit_note_ids,  // Pending sales-return IDs to auto-settle in ledger (no line items needed)
    } = req.body;

    const discountAmt = Number(discount_amount) || 0;
    const companyId = req.user.active_company_id;
    let client;

    try {
        client = await db.getClient();
        await ensureNSBSchema(client);
        await client.query("BEGIN");

        const sanitizeInt = (val) => {
            const p = parseInt(val);
            return isNaN(p) ? null : p;
        };

        const headerBranchId = req.headers['x-branch-id'] !== 'all' ? req.headers['x-branch-id'] : null;
        const rawBranchId = req.body.branch_id || req.user.branch_id || headerBranchId;
        const branchId = sanitizeInt(rawBranchId);
        const safeCustomerId = sanitizeInt(customer_id);
        const safeBrokerId = sanitizeInt(broker_id);
        const safeBrokerCommission = isNaN(parseFloat(broker_commission_rate)) ? 0 : parseFloat(broker_commission_rate);

        // BranchBilling.tsx sends `quantity`; everything below (and CreateInvoice.tsx)
        // uses `qty`. Normalize in place so both frontends work through this one handler.
        (items || []).forEach(it => { it.qty = it.qty ?? it.quantity; });

        // ── Strict branch billing controls ──────────────────────────────────
        // Rule 1: branch billing can only sell products that exist in inventory
        // (no free-text/manual line items). Rule 3: no direct discount at branch
        // level — round-off must go through POST /roundoff/request + admin approval.
        // Gated on the AUTHENTICATED user's role (from the verified JWT), not on
        // anything the request body claims, so it can't be bypassed client-side.
        const isBranchBillingRole = req.user.role === 'billing_staff' || req.user.role === 'branch_manager';
        if (isBranchBillingRole) {
            if (discountAmt > 0) {
                throw new Error('Branch billing cannot apply a discount directly — use "Request Round Off", which requires head office approval');
            }
            for (const it of (items || [])) {
                if (!it.product_id) {
                    throw new Error(`"${it.description || it.desc || 'Item'}" is not from inventory — branch billing can only sell products that exist in inventory`);
                }
            }
            const productIds = (items || []).map(it => it.product_id).filter(Boolean);
            if (productIds.length > 0) {
                const stockRes = await client.query(
                    `SELECT product_id, stock_type, current_stock FROM inventory WHERE branch_id = $1 AND product_id = ANY($2::int[])`,
                    [branchId, productIds]
                );
                const stockMap = {};
                stockRes.rows.forEach(r => { stockMap[`${r.product_id}_${r.stock_type}`] = parseFloat(r.current_stock) || 0; });
                for (const it of items) {
                    const stockType = it.stock_type || 'fresh';
                    const available = stockMap[`${it.product_id}_${stockType}`] || 0;
                    if (parseFloat(it.qty || 0) > available) {
                        throw new Error(`${it.description || it.desc}: only ${available} ${stockType} pcs available in stock, cannot bill ${it.qty} pcs`);
                    }
                }
            }
        }

        // Always auto-generate — frontend invoice_number field is intentionally ignored.
        // Each bill type (TAX/NSB/INV/RET/GFT) has its own independent counter per month.
        let finalInvoiceNumber, financial_month, seriesPrefix, seriesNumber;
        const gen = await generateInvoiceNumber(client, invoice_type || 'TAX_INVOICE', companyId, branchId, bill_purpose);
        finalInvoiceNumber = gen.number;
        financial_month   = gen.financial_month;
        seriesPrefix      = gen.series_prefix;
        seriesNumber      = gen.series_number;

        // 1. Get Company/Branch and Customer State for GST Detection
        const company  = await client.query(`SELECT state, state_code FROM companies WHERE id = $1`, [companyId]);
        const customer = await client.query(`SELECT state, state_code, gstin, username, nickname, phone FROM users WHERE id = $1`, [safeCustomerId]);

        const custRow = customer.rows[0] || {};
        // Use utility — checks state_code, falls back to state name, then GSTIN prefix
        const gstType = determineGstType(custRow.state_code, custRow.state, custRow.gstin);

        // Process Sale Items
        let totalTaxable = 0;
        let totalGST = 0;
        let totalCGST = 0;
        let totalSGST = 0;
        let totalIGST = 0;

        // Bill type GST rules per spec:
        // NON_TAX_INVOICE  → NO GST at all
        // TAX_INVOICE      → GST always (CGST+SGST or IGST)
        // NOMINAL_TAX      → GST calculated (name-sake bill, no real cash movement)
        // RETAIL_SALE      → GST optional — per product's gst_rate (0 if product has none)
        // GIFTED_ITEM      → GST always (business pays deemed supply GST)
        const isNonTax  = invoice_type === 'NON_TAX_INVOICE';
        const isRetail  = invoice_type === 'RETAIL_SALE';
        const isGift    = invoice_type === 'GIFTED_ITEM';
        const isNameOnly = bill_purpose === 'name_only' || invoice_type === 'NOMINAL_TAX_INVOICE';

        // Invoice-level GST rate sent from frontend (e.g. 18 for 18% GST).
        // Used as fallback when a line item has no product-level GST rate (0 or null).
        const invoiceLevelGstRate = (tax_details && !isNaN(Number(tax_details.totalRate)) && Number(tax_details.totalRate) > 0)
            ? Number(tax_details.totalRate)
            : 5; // ultimate fallback: 5%

        const processedItems = items.map(i => {
            const qty = isNaN(parseFloat(i.qty)) ? 0 : parseFloat(i.qty);
            const rate = isNaN(parseFloat(i.rate)) ? 0 : parseFloat(i.rate);
            const amount = qty * rate;
            // Use per-item gst_rate if it's a positive number; otherwise fall back to the
            // invoice-level GST rate chosen by the user (tax_details.totalRate).
            const itemGstRate = parseFloat(i.gst_rate);
            const hasItemRate = !isNaN(itemGstRate) && itemGstRate > 0;
            const taxRate = isNonTax ? 0
                : isRetail ? (hasItemRate ? itemGstRate : 0)           // Retail: product-rate or zero
                : (hasItemRate ? itemGstRate : invoiceLevelGstRate);   // Others: fall back to invoice level
            
            let cgstR = 0, sgstR = 0, igstR = 0;
            let cgstA = 0, sgstA = 0, igstA = 0;
            
            if (gstType === "INTRA_STATE") {
                cgstR = taxRate / 2;
                sgstR = taxRate / 2;
                cgstA = (amount * cgstR) / 100;
                sgstA = (amount * sgstR) / 100;
            } else {
                igstR = taxRate;
                igstA = (amount * igstR) / 100;
            }

            const lineTax = cgstA + sgstA + igstA;
            totalTaxable += amount;
            totalGST += lineTax;
            totalCGST += cgstA;
            totalSGST += sgstA;
            totalIGST += igstA;

            return { 
                ...i, qty, rate, amount, 
                taxRate, cgstR, sgstR, igstR, 
                cgstA, sgstA, igstA, 
                lineTax, is_return: false 
            };
        });

        // Process Return Items
        let totalReturnTaxable = 0;
        let totalReturnGST = 0;
        let totalReturnCGST = 0;
        let totalReturnSGST = 0;
        let totalReturnIGST = 0;

        const processedReturnItems = (return_items || []).map(i => {
            const qty = Number(i.qty) || 0;
            const rate = Number(i.rate) || 0;
            const amount = qty * rate;
            // Same fix as processedItems: use per-item rate if > 0, else fall back to invoice-level rate
            const retItemRate = parseFloat(i.gst_rate);
            const hasRetRate = !isNaN(retItemRate) && retItemRate > 0;
            const taxRate = isNonTax ? 0
                : isRetail ? (hasRetRate ? retItemRate : 0)
                : (hasRetRate ? retItemRate : invoiceLevelGstRate);

            let cgstR = 0, sgstR = 0, igstR = 0;
            let cgstA = 0, sgstA = 0, igstA = 0;
            
            if (gstType === "INTRA_STATE") {
                cgstR = taxRate / 2;
                sgstR = taxRate / 2;
                cgstA = (amount * cgstR) / 100;
                sgstA = (amount * sgstR) / 100;
            } else {
                igstR = taxRate;
                igstA = (amount * igstR) / 100;
            }

            const lineTax = cgstA + sgstA + igstA;
            totalReturnTaxable += amount;
            totalReturnGST += lineTax;
            totalReturnCGST += cgstA;
            totalReturnSGST += sgstA;
            totalReturnIGST += igstA;

            return { 
                ...i, qty, rate, amount, 
                taxRate, cgstR, sgstR, igstR, 
                cgstA, sgstA, igstA, 
                lineTax, is_return: true 
            };
        });

        let totalSaleAmount = Math.round(totalTaxable + totalGST);
        let totalReturnAmount = Math.round(totalReturnTaxable + totalReturnGST);

        // Final Invoice Amount after Returns and Discount
        let netInvoiceAmount = totalSaleAmount - totalReturnAmount;
        const effectiveTotal = Math.max(0, netInvoiceAmount - discountAmt);
        // Use amount_paid from body; fall back to summing payments[] array if body value is 0
        const paymentsArrayTotal = Array.isArray(payments)
            ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
            : 0;
        let finalAmountPaid = Number(amount_paid) > 0 ? Number(amount_paid) : paymentsArrayTotal;
        
        // === POINTS REDEMPTION FOR NON-TAX INVOICES ===
        let pointsRedeemed = 0;
        let pointsDiscount = 0;
        
        if (isNonTax && safeCustomerId && Number(points_to_redeem) > 0) {
            try {
                const redeemResult = await pointsService.redeemPoints(
                    client,
                    safeCustomerId,
                    Number(points_to_redeem),
                    effectiveTotal,
                    null // Will be updated after invoice insert
                );
                pointsRedeemed = redeemResult.points_used;
                pointsDiscount = redeemResult.discount;
                
                // Apply discount to invoice total
                netInvoiceAmount = effectiveTotal - pointsDiscount;
            } catch (err) {
                // Don't fail invoice creation for points error, just log
                console.warn('Points redemption failed:', err.message);
            }
        }

        const headerSQL = `
            INSERT INTO invoices (
                company_id, customer_id, invoice_number, invoice_type,
                financial_month, invoice_date, due_date, status, 
                sub_total, tax_total, cgst_total, sgst_total, igst_total, total_amount,
                gst_type, paid_amount, discount_amount, return_amount, notes, bundles_count,
                vehicle_number, transportation_mode, date_of_supply, reverse_charge,
                broker_id, broker_commission_rate,
                branch_id,
                bill_purpose,
                points_earned, points_redeemed, points_discount,
                series_prefix, series_number,
                walk_in_name,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, NOW())
            RETURNING id
        `;

        // Insert invoice header — retry once if the invoice_number collides (stale pre-fetched number)
        let result;
        const buildParams = (invNum) => [
            companyId, safeCustomerId, invNum, invoice_type || 'TAX_INVOICE',
            financial_month, req.body.invoice_date || new Date(), req.body.due_date || new Date(),
            isNameOnly ? 'gst_pending' : (payment_status || 'PENDING'),
            totalTaxable, totalGST, totalCGST, totalSGST, totalIGST, netInvoiceAmount,
            gstType, isNameOnly ? 0 : finalAmountPaid, discountAmt, totalReturnAmount, notes || '', Number(bundles_count) || 0,
            transport_details?.vehicle_number || '', transport_details?.mode || '', transport_details?.supply_date || null, transport_details?.reverse_charge || 'No',
            safeBrokerId, safeBrokerCommission,
            branchId,
            bill_purpose || 'real',
            0, pointsRedeemed, pointsDiscount,
            seriesPrefix, seriesNumber,
            walk_in_name || null
        ];

        // Use SAVEPOINT so a duplicate-number failure can be recovered inside the transaction.
        // Without SAVEPOINT, a failed INSERT aborts the whole TX and all subsequent queries fail.
        await client.query('SAVEPOINT sp_invoice_hdr');
        try {
            result = await client.query(headerSQL, buildParams(finalInvoiceNumber));
            await client.query('RELEASE SAVEPOINT sp_invoice_hdr');
        } catch (insertErr) {
            // Always roll back to savepoint first — restores TX to healthy state
            await client.query('ROLLBACK TO SAVEPOINT sp_invoice_hdr');
            await client.query('RELEASE SAVEPOINT sp_invoice_hdr');

            // 23505 = unique_violation — auto-generated number went stale, regenerate and retry silently
            if (insertErr.code === '23505') {
                // Auto-generated number went stale — regenerate and retry silently
                console.warn(`[invoice] Duplicate auto-number "${finalInvoiceNumber}", regenerating…`);
                const gen = await generateInvoiceNumber(client, invoice_type || 'TAX_INVOICE', companyId, branchId, bill_purpose);
                finalInvoiceNumber = gen.number;
                financial_month   = gen.financial_month;
                seriesPrefix      = gen.series_prefix;
                seriesNumber      = gen.series_number;
                // Retry — transaction is healthy again after the savepoint rollback
                result = await client.query(headerSQL, buildParams(finalInvoiceNumber));
            } else {
                throw insertErr;
            }
        }

        const invoiceId = result.rows[0].id;

        // For NSB: mark is_nominal and store GST liability amount
        if (isNameOnly) {
            await client.query(
                `UPDATE invoices SET is_nominal=true, gst_liability_amount=$1 WHERE id=$2`,
                [totalGST, invoiceId]
            );
        }

        // isNameOnly already set above from bill_purpose / invoice_type

        // ── Resolve invoice-level branch via centralized engine ──
        // Priority: body.branch_id → JWT branch → x-branch-id header → product's branch → main hub
        const invoiceLevelBranchId = await resolveStockBranch(client, {
            companyId,
            requestedBranchId: branchId || null
        });

        console.log(`[invoice-create] invoiceLevelBranchId=${invoiceLevelBranchId} isNameOnly=${isNameOnly}`);
        const allItems = [...processedItems, ...processedReturnItems];
        // Ensure lot tracking columns exist (added after initial schema)
        await client.query(`ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS lot_id INTEGER`).catch(() => {});
        await client.query(`ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS stock_type VARCHAR(50)`).catch(() => {});
        await client.query(`ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS avg_cost NUMERIC(15,2)`).catch(() => {});
        await client.query(`ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS profit_per_piece NUMERIC(15,2)`).catch(() => {});
        await client.query(`ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS total_profit NUMERIC(15,2)`).catch(() => {});

        for (const item of allItems) {
            console.log(`[invoice-create] item: product_id=${item.product_id} desc=${item.desc || item.description} qty=${item.qty}`);
            if (item.product_id) {
                // Resolve per-item branch: invoice-level first, then fall back to product's own branch
                const itemBranchId = await resolveStockBranch(client, {
                    companyId,
                    requestedBranchId: invoiceLevelBranchId || null,
                    productId: item.product_id
                });
                console.log(`[invoice-create] deducting stock: product_id=${item.product_id} branch=${itemBranchId} qty=${item.qty}`);

                if (item.is_return) {
                    // Stock return: add back to branch (skip for name_only bills)
                    if (!isNameOnly) {
                        await addStock(client, {
                            companyId,
                            branchId: itemBranchId,
                            productId: item.product_id,
                            qty: item.qty,
                            movementType: 'SALE_RETURN',
                            referenceType: 'INVOICE',
                            referenceId: invoiceId,
                            note: `Return on invoice #${invoiceId}`
                        });
                    }
                } else if (!isNameOnly) {
                    // Stock sale: deduct via centralized engine (includes idempotency + negative-stock guard)
                    await deductStock(client, {
                        companyId,
                        branchId: itemBranchId,
                        productId: item.product_id,
                        qty: item.qty,
                        referenceType: 'INVOICE',
                        referenceId: invoiceId,
                        note: `Sale on invoice #${invoiceId}`
                    });
                }
            }

            const lineItemRes = await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, product_id, description, quantity,
                    unit_price, taxable_value, discount_percent, tax_percent,
                    cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount,
                    line_total, is_return,
                    lot_id, stock_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING id`,
                [
                    invoiceId,
                    item.product_id || null,
                    item.name || item.desc || item.description || "Item",
                    item.qty,
                    item.rate,
                    item.amount,
                    item.discount_percent || 0,
                    item.taxRate,
                    item.cgstR, item.sgstR, item.igstR,
                    item.cgstA, item.sgstA, item.igstA,
                    item.is_return ? -(item.amount + item.lineTax) : (item.amount + item.lineTax),
                    item.is_return,
                    item.lot_id || null,
                    item.stock_type || null,
                ]
            );

            // Stock lot integration — deduct from lot inventory and record profit
            if (item.lot_id && item.stock_type && !item.is_return) {
                try {
                    const avgCostRow = await client.query(
                        `SELECT COALESCE(avg_cost, 0) AS avg_cost FROM stock_inventory WHERE lot_id = $1 AND stock_type = $2`,
                        [item.lot_id, item.stock_type]
                    );
                    const avgCost       = parseFloat(avgCostRow.rows[0]?.avg_cost || 0);
                    const profitPerPiece = parseFloat(item.rate) - avgCost;
                    const totalProfit   = profitPerPiece * parseFloat(item.qty);

                    await client.query(
                        `UPDATE invoice_line_items SET avg_cost=$1, profit_per_piece=$2, total_profit=$3 WHERE id=$4`,
                        [avgCost, profitPerPiece, totalProfit, lineItemRes.rows[0].id]
                    );

                    await client.query(
                        `UPDATE stock_inventory SET quantity = GREATEST(0, quantity - $1), last_updated = NOW()
                         WHERE lot_id = $2 AND stock_type = $3`,
                        [item.qty, item.lot_id, item.stock_type]
                    );

                    await client.query(`
                        INSERT INTO stock_transactions (lot_id, product_id, transaction_type, stock_type_from, quantity, rate, amount, reference_type, reference_id, notes)
                        VALUES ($1, $2, 'sale', $3, $4, $5, $6, 'invoice', $7, 'Sale from lot')
                    `, [item.lot_id, item.product_id || null, item.stock_type, item.qty, item.rate, item.qty * item.rate, invoiceId]);

                    const freshField = (item.stock_type || '').includes('fresh') ? 'sold_fresh_qty' : 'sold_mistake_qty';
                    await client.query(
                        `UPDATE stock_lots SET ${freshField} = ${freshField} + $1, updated_at = NOW() WHERE id = $2`,
                        [item.qty, item.lot_id]
                    );

                    // COGS ledger entry
                    if (avgCost > 0) {
                        const cogDesc = `COGS lot ${item.lot_id} — ${item.qty} pcs`;
                        const invAcct = item.stock_type === 'mistake' ? 'Inventory - Mistake Stock' : 'Inventory - Fresh Stock';
                        await client.query(`
                            INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
                            VALUES
                                ($1, 'Cost of Goods Sold', $2, 0, $3, 'sale_cogs', 'sale', CURRENT_DATE),
                                ($1, $4, 0, $2, $3, 'sale_cogs', 'sale', CURRENT_DATE)
                        `, [companyId, avgCost * item.qty, cogDesc, invAcct]);
                    }

                    // Auto-update lot status after sale
                    await client.query(`
                        UPDATE stock_lots SET
                            status = CASE
                                WHEN (
                                    COALESCE((SELECT SUM(quantity) FROM stock_inventory WHERE lot_id=$1 AND stock_type IN ('fresh_purchased','fresh_repaired','mistake')), 0) <= 0
                                ) THEN 'sold_out'
                                WHEN (sold_fresh_qty + sold_mistake_qty) > 0 THEN 'partial_sold'
                                ELSE status
                            END,
                            updated_at = NOW()
                        WHERE id = $1
                    `, [item.lot_id]);
                } catch (lotErr) {
                    console.warn('[invoice lot integration]', lotErr.message);
                }
            }
        }

        if (customer_id) {
            await ensureCustomerLedgerMetadata(client, Number(customer_id), companyId);
            await createCustomerLedgerEvent(client, {
                companyId,
                branchId: req.user.branch_id || 1,
                customerId: Number(customer_id),
                type: "INVOICE",
                category: "SALES",
                amount: netInvoiceAmount,
                date: new Date().toISOString().split("T")[0],
                description: `Invoice #${finalInvoiceNumber}${totalReturnAmount > 0 ? ' (Includes Returns)' : ''}`,
                relatedInvoiceId: invoiceId,
                referenceType: "INVOICE",
                referenceId: invoiceId,
                createdBy: req.user.id,
                bill_purpose: bill_purpose || 'real'
            });
        }

        // Payments — sum here so WhatsApp uses the actual saved total, not amount_paid from body
        let totalPaidFromPayments = 0;
        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                const pAmt = Number(p.amount) || 0;
                if (pAmt > 0) {
                    totalPaidFromPayments += pAmt;
                    const pDate = p.payment_date || new Date();
                    const paymentRecord = await client.query(
                        `INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, reference_no)
                         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                        [invoiceId, pAmt, p.payment_method || 'CASH', pDate, p.reference_no || null]
                    );

                    if (customer_id) {
                        await createCustomerLedgerEvent(client, {
                            companyId,
                            branchId: req.user.branch_id || 1,
                            customerId: Number(customer_id),
                            type: "RECEIPT",
                            category: "PAYMENT",
                            amount: pAmt,
                            date: pDate,
                            description: `Payment for Invoice #${finalInvoiceNumber}`,
                            relatedInvoiceId: Number(invoiceId),
                            referenceType: "PAYMENT",
                            referenceId: paymentRecord.rows[0].id,
                            createdBy: req.user.id,
                            bill_purpose: bill_purpose || 'real',
                            meta: {
                                payment_method: p.payment_method || "CASH",
                                reference_no: p.reference_no || null,
                                bank_name: (p.payment_method === "BANK" || p.payment_method === "UPI") ? (p.bank_name || "Customer Bank") : null,
                                bank_transaction_id: (p.payment_method === "BANK" || p.payment_method === "UPI") ? (p.bank_transaction_id || p.reference_no || `TXN-${Date.now()}`) : null,
                                bank_timestamp: new Date().toISOString(),
                            },
                        });
                    }
                    
                    // --- Custom Ledgers Update ---
                    const pMethod = (p.payment_method || 'CASH').toUpperCase();
                    if (pMethod === 'CASH') {
                        await client.query(`
                            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, invoice_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', pDate, invoiceId]);
                    } else if (pMethod === 'BANK' || pMethod === 'UPI') {
                        await client.query(`
                            INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date, invoice_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', p.bank_name || pMethod, p.reference_no || p.bank_transaction_id || '-', pDate, invoiceId]);
                    } else if (pMethod === 'PROPRIETOR_AC') {
                        // Customer paid directly to proprietor's personal account
                        await client.query(`
                            INSERT INTO proprietor_transactions
                                (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by, reference_type, reference_id)
                            VALUES ($1, $2, 'PERSONAL_RECEIPT', $3, 'PROPRIETOR_AC', $4, $5, $6, 'INVOICE', $7)
                        `, [companyId, req.user.branch_id || 1, pAmt, pDate,
                            `Customer payment via Proprietor A/C — Invoice #${invoiceId}`,
                            req.user.id, invoiceId]);
                    }
                }
            }
        }


        // ── Auto-settle pending credit notes in the ledger ──────────────
        // Instead of adding return line items to the invoice, credit notes are
        // settled here as CREDIT_NOTE_APPLIED ledger events so the customer's
        // outstanding balance is reduced automatically.
        if (Array.isArray(credit_note_ids) && credit_note_ids.length > 0 && customer_id) {
            for (const cnId of credit_note_ids) {
                try {
                    const cn = await client.query(
                        `SELECT id, total_amount, applied_amount, return_number
                         FROM sales_returns WHERE id = $1 AND company_id = $2`,
                        [cnId, companyId]
                    );
                    if (!cn.rows.length) continue;
                    const row = cn.rows[0];
                    const remaining = Number(row.total_amount) - Number(row.applied_amount || 0);
                    if (remaining <= 0) continue;

                    // Mark the credit note as fully applied
                    await client.query(
                        `UPDATE sales_returns SET applied_amount = total_amount WHERE id = $1`,
                        [cnId]
                    );

                    // Create a ledger event that reduces the customer's outstanding
                    await createCustomerLedgerEvent(client, {
                        companyId,
                        branchId: req.user.branch_id || 1,
                        customerId: Number(customer_id),
                        type: "CREDIT_NOTE_APPLIED",
                        category: "CREDIT_NOTE",
                        amount: remaining,
                        date: new Date().toISOString().split("T")[0],
                        description: `Credit note ${row.return_number || '#' + cnId} applied to Invoice #${finalInvoiceNumber}`,
                        relatedInvoiceId: invoiceId,
                        referenceType: "SALES_RETURN",
                        referenceId: cnId,
                        createdBy: req.user.id,
                        bill_purpose: 'real',
                    });
                } catch (cnErr) {
                    console.warn('[invoice] credit note settlement failed for id', cnId, cnErr.message);
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        // ACCOUNTING ENGINE — per-bill-type ledger entries (spec-compliant)
        //
        // TAX_INVOICE:       DR AR  | CR Sales | CR GST
        // NOMINAL_TAX (NSB): (no AR, no Sales) | CR GST only — name-sake bill
        // NON_TAX_INVOICE:   DR AR  | CR Sales (no GST)
        // RETAIL_SALE:       DR Cash/UPI | CR Sales | CR GST (if any)
        // GIFTED_ITEM:       DR GiftExpense | DR GSTExpense | CR Inventory (no AR/Sales)
        // ─────────────────────────────────────────────────────────────────
        const arAccount        = await getAccountByCode(companyId, '1100'); // Accounts Receivable
        const salesAccount     = await getAccountByCode(companyId, '4000'); // Sales Revenue
        const taxAccount       = await getAccountByCode(companyId, '2100'); // GST Payable / Output GST
        const salesReturnAccount = await getAccountByCode(companyId, '4200') || salesAccount;
        const cashAccount      = await getAccountByCode(companyId, '1000'); // Cash
        const bankAccount      = await getAccountByCode(companyId, '1200'); // Bank
        const giftExpAccount   = await getAccountByCode(companyId, '5500') || await getAccountByCode(companyId, '5000'); // Gift/Promo Expense
        const inventoryAccount = await getAccountByCode(companyId, '1300') || await getAccountByCode(companyId, '1400'); // Inventory/Stock

        const netGST = totalGST - totalReturnGST;

        if (salesAccount || taxAccount) {
            let txLines = [];

            if (isGift) {
                // GIFTED ITEM: Expense + GST Expense, credit Inventory — NO AR, NO Sales Revenue
                if (giftExpAccount) {
                    txLines.push({ account_id: giftExpAccount.id, debit_amount: totalTaxable, credit_amount: 0,
                        description: `Gift/Promo Expense — Inv #${finalInvoiceNumber}` });
                }
                if (netGST > 0 && taxAccount) {
                    txLines.push({ account_id: taxAccount.id, debit_amount: netGST, credit_amount: 0,
                        description: `GST on gifted goods (deemed supply) — Inv #${finalInvoiceNumber}` });
                }
                if (inventoryAccount) {
                    txLines.push({ account_id: inventoryAccount.id, debit_amount: 0, credit_amount: totalTaxable,
                        description: `Stock gifted — Inv #${finalInvoiceNumber}` });
                }
            } else if (isNameOnly) {
                // NOMINAL TAX INVOICE: GST liability only — NO AR, NO Sales Revenue, NO customer balance change
                if (netGST > 0 && taxAccount) {
                    txLines.push({ account_id: taxAccount.id, debit_amount: 0, credit_amount: netGST,
                        description: `Output GST — NSB Inv #${finalInvoiceNumber}` });
                    // Suspense debit to keep double-entry balanced
                    const suspenseAccount = arAccount; // AR used as nominal suspense for name-only
                    if (suspenseAccount) {
                        txLines.push({ account_id: suspenseAccount.id, debit_amount: netGST, credit_amount: 0,
                            description: `GST nominal entry — NSB Inv #${finalInvoiceNumber}` });
                    }
                }
            } else {
                // TAX, NON-TAX, RETAIL — standard sales entries
                if (invoice_type === 'RETAIL_SALE') {
                    // Retail: debit Cash/UPI immediately (no outstanding)
                    const primaryPayMethod = payments && payments[0] ? (payments[0].payment_method || 'CASH').toUpperCase() : 'CASH';
                    const cashOrBank = (primaryPayMethod === 'BANK' || primaryPayMethod === 'UPI') ? bankAccount : cashAccount;
                    if (cashOrBank) {
                        txLines.push({ account_id: cashOrBank.id, debit_amount: effectiveTotal > 0 ? effectiveTotal : 0, credit_amount: 0,
                            description: `Retail cash/UPI received — Inv #${finalInvoiceNumber}` });
                    }
                } else {
                    // TAX / NON-TAX: debit Accounts Receivable
                    if (arAccount) {
                        txLines.push({ account_id: arAccount.id,
                            debit_amount:  effectiveTotal > 0 ? effectiveTotal : 0,
                            credit_amount: effectiveTotal < 0 ? Math.abs(effectiveTotal) : 0,
                            description: `Sales to Customer #${customer_id}` });
                    }
                }

                // Credit Sales Revenue
                if (salesAccount) {
                    txLines.push({ account_id: salesAccount.id, debit_amount: 0, credit_amount: totalTaxable,
                        description: `Sales Revenue — Inv #${finalInvoiceNumber}` });
                }

                // Debit Sales Returns
                if (totalReturnTaxable > 0 && salesReturnAccount) {
                    txLines.push({ account_id: salesReturnAccount.id, debit_amount: totalReturnTaxable, credit_amount: 0,
                        description: `Sales Returns — Inv #${finalInvoiceNumber}` });
                }

                // Credit GST Payable (only for GST bill types)
                if (netGST !== 0 && !isNonTax && taxAccount) {
                    txLines.push({ account_id: taxAccount.id,
                        debit_amount:  netGST < 0 ? Math.abs(netGST) : 0,
                        credit_amount: netGST > 0 ? netGST : 0,
                        description: `Output GST — Inv #${finalInvoiceNumber}` });
                }

                // Discount expense
                if (discountAmt > 0) {
                    const discountAccount = await getAccountByCode(companyId, '5100');
                    if (discountAccount) {
                        txLines.push({ account_id: discountAccount.id, debit_amount: discountAmt, credit_amount: 0,
                            description: `Discount — Inv #${finalInvoiceNumber}` });
                    }
                }

                // Payment receipts (non-retail only — retail already debited Cash above)
                if (invoice_type !== 'RETAIL_SALE' && Array.isArray(payments) && payments.length > 0) {
                    for (const p of payments) {
                        const pAmt = parseFloat(p.amount || 0);
                        if (pAmt <= 0) continue;
                        const pMethod = (p.payment_method || 'CASH').toUpperCase();
                        const isBank = pMethod === 'BANK' || pMethod === 'UPI';
                        const pAcc = isBank ? bankAccount : cashAccount;
                        if (pAcc && arAccount) {
                            txLines.push({ account_id: pAcc.id, debit_amount: pAmt, credit_amount: 0,
                                description: `Payment via ${pMethod}` });
                            txLines.push({ account_id: arAccount.id, debit_amount: 0, credit_amount: pAmt,
                                description: `Payment offset — Inv #${finalInvoiceNumber}` });
                        }
                    }
                }
            }

            if (txLines.length > 0) {
                // Balance the transaction if precision causes tiny drift
                const totalD = txLines.reduce((s, l) => s + (l.debit_amount || 0), 0);
                const totalC = txLines.reduce((s, l) => s + (l.credit_amount || 0), 0);
                if (Math.abs(totalD - totalC) > 0.01) {
                    const diff = totalD - totalC;
                    // Add diff to first credit line
                    const firstCredit = txLines.find(l => l.credit_amount > 0);
                    if (firstCredit) firstCredit.credit_amount += diff;
                }

                await createTransactionInternal(client, {
                    company_id: companyId,
                    branch_id: req.user.branch_id || 1,
                    transaction_date: new Date(),
                    reference_type: 'INVOICE',
                    reference_id: invoiceId,
                    description: `Invoice #${finalInvoiceNumber}`,
                    created_by: req.user.id,
                    bill_purpose: bill_purpose || 'real'
                }, txLines);
            }
        }

        // Recompute customer balance only for bill types that create real outstanding
        // NOMINAL_TAX and GIFTED_ITEM do not affect customer balance per spec
        if (customer_id && !isNameOnly && !isGift) {
            await recomputeCustomerBalance(client, Number(customer_id), companyId);
        }

        // Record Broker Commission
        if (broker_id) {
            await brokerService.recordCommission(client, req.user, {
                broker_id,
                commission_rate: broker_commission_rate,
                bill_id: invoiceId,
                bill_number: finalInvoiceNumber,
                bill_amount: netInvoiceAmount,
                bill_type: 'SALES',
                date: new Date().toISOString().split("T")[0],
                line_items: items || []
            });
        }

        // === EARN POINTS — NON-TAX and RETAIL SALE (₹100 paid = 1 point) ===
        let ptsEarned = 0;
        const pointsEligible = ['NON_TAX_INVOICE', 'RETAIL_SALE'].includes(invoice_type);
        if (pointsEligible && safeCustomerId && finalAmountPaid > 0 && bill_purpose !== 'name_only') {
            ptsEarned = await pointsService.earnPoints(
                client,
                safeCustomerId,
                invoiceId,
                finalAmountPaid,
                invoice_type,
                bill_purpose || 'real'
            );
            if (ptsEarned > 0) {
                // Update invoice with earned points
                await client.query(
                    'UPDATE invoices SET points_earned = $1 WHERE id = $2',
                    [ptsEarned, invoiceId]
                );
            }
        }

        await client.query("COMMIT");

        // Mark the source delivery order as invoiced (non-blocking)
        if (delivery_order_id) {
            db.pgRun(`
                UPDATE delivery_orders
                SET status = 'invoiced', converted_invoice_id = $1, converted_at = NOW(), updated_at = NOW()
                WHERE id = $2 AND company_id = $3 AND status != 'invoiced'
            `, [invoiceId, delivery_order_id, companyId]).catch(e =>
                console.error('Failed to mark delivery order as invoiced:', e.message)
            );
        }

        res.status(201).json({
            message: "Invoice saved",
            id: invoiceId,
            bill_number: finalInvoiceNumber,
            points_earned: ptsEarned,
            points_redeemed: pointsRedeemed
        });

        // ── Non-blocking post-commit notifications ─────────────────────────
        // Use finalAmountPaid — this is exactly what is stored in invoices.paid_amount.
        // totalPaidFromPayments only covers the payments[] array; if the frontend sends
        // amount_paid without a corresponding payments[] entry, it would show 0.
        const custPhone  = customer.rows[0]?.phone || '';
        const custName   = customer.rows[0]?.nickname || customer.rows[0]?.username || 'Customer';
        // effectiveTotal = netInvoiceAmount - discount (what customer actually owes)
        // Using netInvoiceAmount would show wrong balance when a discount/waiver exists.
        const waActualPaid = finalAmountPaid;
        const waBalance    = Math.max(0, effectiveTotal - waActualPaid);
        const waStatus     = getStatus(waActualPaid, effectiveTotal);

        // 1. N8N webhook
        triggerN8N('invoice-created', {
            customer_name:  custName,
            customer_phone: custPhone,
            invoice_number: finalInvoiceNumber,
            total_amount:   effectiveTotal,
            paid_amount:    waActualPaid,
            balance_amount: waBalance,
            points_earned:  ptsEarned,
        });

        // 2. WhatsApp to customer — text summary + PDF attachment
        try {
            const { sendWhatsApp, sendWhatsAppFile } = await import('../utils/whatsapp.js');
            const fmtN = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

            if (custPhone) {
                const textMsg =
`Dear ${custName},

✅ Invoice ${finalInvoiceNumber} created!

💰 Total:   ₹${fmtN(effectiveTotal)}
✅ Paid:    ₹${fmtN(waActualPaid)}
⏳ Balance: ₹${fmtN(waBalance)}
Status: ${waStatus}${ptsEarned > 0 ? '\n\n💎 Points Earned: +' + ptsEarned + ' pts' : ''}

Thank you for your business!
JBS Knit Wear, Tiruppur
📞 8148232205`;

                // Send text first
                await sendWhatsApp(custPhone, textMsg);

                // Generate PDF and send as file
                try {
                    // Fetch the full invoice data (with line_items) for PDF generation
                    const invForPdf = await db.pgGet(`
                        SELECT i.*,
                               COALESCE(u.nickname, u.username) as customer_name, u.address_line1, u.city_pincode,
                               u.state, u.gstin as customer_gstin, u.state_code as customer_state_code,
                               u.phone as customer_phone,
                               c.company_name, c.address_line1 as c_address, c.city_pincode as c_city,
                               c.state as c_state, c.gstin as c_gstin, c.state_code as company_state_code,
                               c.bank_name, c.bank_account_no, c.bank_ifsc_code, c.phone as c_phone,
                               COALESCE(json_agg(li.* ORDER BY li.id) FILTER (WHERE li.id IS NOT NULL), '[]') AS line_items
                        FROM invoices i
                        LEFT JOIN users     u  ON i.customer_id = u.id
                        LEFT JOIN companies c  ON i.company_id  = c.id
                        LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
                        WHERE i.id = $1
                        GROUP BY i.id, u.nickname, u.username, u.address_line1, u.city_pincode, u.state,
                                 u.gstin, u.state_code, u.phone,
                                 c.company_name, c.address_line1, c.city_pincode, c.state,
                                 c.gstin, c.state_code, c.bank_name, c.bank_account_no,
                                 c.bank_ifsc_code, c.phone
                    `, [invoiceId]);

                    if (invForPdf) {
                        const pdfBuffer = await generateInvoicePdf(invForPdf);
                        const filename  = `Invoice_${finalInvoiceNumber}.pdf`;
                        // Also save to disk for the download endpoint
                        try {
                            fs.writeFileSync(path.join(INVOICES_DIR, filename), pdfBuffer);
                        } catch (_) { /* disk write optional */ }
                        // Send buffer as base64 — no public URL dependency
                        await sendWhatsAppFile(custPhone, pdfBuffer, filename, `Invoice ${finalInvoiceNumber} — JBS Knit Wear`);
                        console.log(`[PDF] sent to ${custPhone}: ${filename}`);
                    }
                } catch (pdfErr) {
                    console.log('[PDF/WhatsApp] silent fail:', pdfErr.message);
                }
            }
        } catch (waErr) {
            console.log('[WhatsApp/invoice-create] silent fail:', waErr.message);
        }
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Critical Invoice Error:", err.message);
        res.status(500).json({ error: "Failed to create invoice: " + err.message });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   NSB GST PAYMENT ROUTES
============================================================ */

/**
 * GET /invoice/nsb/gst-pending
 * List all NSB invoices (both pending and paid GST)
 */
router.get("/nsb/gst-pending", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    let client;
    try {
        client = await db.getClient();
        await ensureNSBSchema(client);
        client.release();
        client = null;

        const rows = await db.pgAll(`
            SELECT i.id, i.invoice_number, i.invoice_date, i.total_amount,
                   i.tax_total, i.cgst_total, i.sgst_total, i.igst_total,
                   COALESCE(i.gst_liability_amount, i.tax_total, 0) AS gst_liability_amount,
                   COALESCE(i.gst_paid, false) AS gst_paid,
                   i.gst_paid_date, i.gst_paid_mode, i.status,
                   COALESCE(u.nickname, u.username) AS customer_name
            FROM invoices i
            LEFT JOIN users u ON u.id = i.customer_id
            WHERE i.company_id = $1
              AND (COALESCE(i.is_nominal, false) = true OR i.bill_purpose = 'name_only' OR i.invoice_type = 'NOMINAL_TAX_INVOICE')
              AND COALESCE(i.is_deleted, false) = false
            ORDER BY COALESCE(i.gst_paid, false) ASC, i.invoice_date DESC
        `, [companyId]);

        const pending = rows.filter(r => !r.gst_paid);
        const paid    = rows.filter(r => r.gst_paid);
        const pendingTotal = pending.reduce((s, r) => s + parseFloat(r.gst_liability_amount || 0), 0);

        res.json({
            data: rows,
            summary: {
                pending_count: pending.length,
                paid_count: paid.length,
                pending_gst_total: pendingTotal,
            },
        });
    } catch (err) {
        if (client) client.release();
        console.error('[nsb/gst-pending] error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /invoice/nsb/:id/mark-gst-paid
 * Mark GST as paid for an NSB invoice; deducts from cash/bank/proprietor
 */
router.post("/nsb/:id/mark-gst-paid", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const userId    = req.user.id;
    const invoiceId = parseInt(req.params.id);
    const { payment_mode, payment_date, payment_reference, notes } = req.body;

    let client;
    try {
        client = await db.getClient();
        await ensureNSBSchema(client);
        await client.query('BEGIN');

        const inv = await client.query(
            `SELECT * FROM invoices WHERE id=$1 AND company_id=$2
             AND (COALESCE(is_nominal,false)=true OR bill_purpose='name_only' OR invoice_type='NOMINAL_TAX_INVOICE')`,
            [invoiceId, companyId]
        );
        if (!inv.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'NSB invoice not found' });
        }
        const invoice = inv.rows[0];
        if (invoice.gst_paid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'GST already marked as paid for this invoice' });
        }

        const gstAmount = parseFloat(invoice.gst_liability_amount || invoice.tax_total || 0);
        if (gstAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No GST liability found on this invoice' });
        }

        const pMode = (payment_mode || 'CASH').toUpperCase();
        const pDate = payment_date || new Date().toISOString().split('T')[0];

        // Balance check for cash/bank
        if (pMode === 'CASH') {
            const bal = await client.query(
                `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS balance
                 FROM cash_ledger WHERE company_id=$1`,
                [companyId]
            );
            const cashBal = parseFloat(bal.rows[0]?.balance || 0);
            if (cashBal < gstAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Insufficient cash balance. Available: ₹${cashBal.toFixed(2)}, Required: ₹${gstAmount.toFixed(2)}` });
            }
        } else if (pMode === 'BANK' || pMode === 'UPI') {
            const bal = await client.query(
                `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS balance
                 FROM bank_ledger WHERE company_id=$1`,
                [companyId]
            );
            const bankBal = parseFloat(bal.rows[0]?.balance || 0);
            if (bankBal < gstAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Insufficient bank balance. Available: ₹${bankBal.toFixed(2)}, Required: ₹${gstAmount.toFixed(2)}` });
            }
        }

        // Mark invoice as GST paid
        await client.query(
            `UPDATE invoices SET gst_paid=true, gst_paid_date=$1, gst_paid_mode=$2, status='gst_paid' WHERE id=$3`,
            [pDate, pMode, invoiceId]
        );

        // Record in nsb_gst_payments
        await client.query(
            `INSERT INTO nsb_gst_payments
                (invoice_id, invoice_number, gst_amount, cgst_amount, sgst_amount, igst_amount,
                 payment_mode, payment_date, payment_reference, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
                invoiceId, invoice.invoice_number, gstAmount,
                invoice.cgst_total || 0, invoice.sgst_total || 0, invoice.igst_total || 0,
                pMode, pDate, payment_reference || null, notes || null, userId,
            ]
        );

        // Deduct from appropriate ledger
        if (pMode === 'CASH') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1,$2,'nsb_gst',$3,'out',$4)`,
                [companyId, branchId, gstAmount, pDate]
            );
        } else if (pMode === 'BANK' || pMode === 'UPI') {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                 VALUES ($1,$2,'nsb_gst',$3,'out','Business Account',$4,$5)`,
                [companyId, branchId, gstAmount, payment_reference || `NSB-${invoiceId}`, pDate]
            );
        } else if (pMode === 'PROPRIETOR') {
            const { recordProprietorCapital } = await import('../utils/proprietorLedger.js');
            await recordProprietorCapital(client, {
                companyId, branchId, userId, amount: gstAmount,
                description: `GST payment for NSB Invoice #${invoice.invoice_number}`,
                referenceType: 'NSB_GST',
                referenceId: invoiceId,
            });
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `GST of ₹${gstAmount.toFixed(2)} marked as paid via ${pMode} for invoice ${invoice.invoice_number}`,
            invoice_id: invoiceId,
            gst_amount: gstAmount,
            payment_mode: pMode,
            payment_date: pDate,
        });
    } catch (err) {
        if (client) { try { await client.query('ROLLBACK'); } catch(_) {} }
        console.error('[nsb/mark-gst-paid] error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   RETAIL SUMMARY — GET /invoices/retail-summary
   Aggregates all RETAIL_SALE / RET/ invoices for the company
   Must be placed before /:id to avoid route capture
============================================================ */
router.get('/retail-summary', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { from, to, period } = req.query;

        let fromDate, toDate;
        const now = new Date();

        if (from && to) {
            fromDate = from;
            toDate   = to;
        } else if (period === 'today') {
            fromDate = toDate = now.toISOString().split('T')[0];
        } else if (period === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            fromDate = weekStart.toISOString().split('T')[0];
            toDate   = now.toISOString().split('T')[0];
        } else {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            toDate   = now.toISOString().split('T')[0];
        }

        const retailFilter = `
            COALESCE(is_deleted, false) = false
            AND COALESCE(is_nominal, false) = false
            AND company_id = $1
            AND (
                UPPER(COALESCE(invoice_type, '')) = 'RETAIL_SALE'
                OR invoice_number ILIKE 'RET/%'
            )
            AND invoice_date BETWEEN $2 AND $3
        `;

        const [summary, daily, topProducts, recentBills, wholesaleRow, totalRow] = await Promise.all([

            db.pgGet(`
                SELECT
                    COUNT(*) AS total_bills,
                    COALESCE(SUM(total_amount), 0) AS total_revenue,
                    COALESCE(SUM(paid_amount), 0) AS total_collected,
                    COALESCE(SUM(GREATEST(0, total_amount - COALESCE(paid_amount, 0))), 0) AS total_pending,
                    COALESCE(AVG(total_amount), 0) AS avg_bill_value,
                    COUNT(CASE WHEN LOWER(COALESCE(status,'')) = 'paid'    THEN 1 END) AS paid_count,
                    COUNT(CASE WHEN LOWER(COALESCE(status,'')) = 'partial' THEN 1 END) AS partial_count,
                    COUNT(CASE WHEN LOWER(COALESCE(status,'')) IN ('pending','unpaid','') OR status IS NULL THEN 1 END) AS pending_count,
                    COALESCE(SUM(CASE WHEN LOWER(COALESCE(status,'')) = 'paid' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
                    COUNT(DISTINCT customer_id) AS unique_customers
                FROM invoices
                WHERE ${retailFilter}
            `, [companyId, fromDate, toDate]),

            db.pgAll(`
                SELECT
                    DATE(invoice_date) AS date,
                    COUNT(*) AS bills,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(paid_amount), 0) AS collected
                FROM invoices
                WHERE ${retailFilter}
                GROUP BY DATE(invoice_date)
                ORDER BY date ASC
            `, [companyId, fromDate, toDate]),

            db.pgAll(`
                SELECT
                    li.description AS product_name,
                    SUM(li.quantity) AS total_qty,
                    SUM(li.line_total) AS total_revenue,
                    COUNT(DISTINCT i.id) AS bill_count,
                    ROUND(AVG(li.unit_price), 2) AS avg_rate
                FROM invoice_line_items li
                JOIN invoices i ON i.id = li.invoice_id
                WHERE i.company_id = $1
                  AND COALESCE(i.is_deleted, false) = false
                  AND COALESCE(i.is_nominal, false) = false
                  AND (
                      UPPER(COALESCE(i.invoice_type, '')) = 'RETAIL_SALE'
                      OR i.invoice_number ILIKE 'RET/%'
                  )
                  AND i.invoice_date BETWEEN $2 AND $3
                  AND li.description IS NOT NULL
                  AND li.description != ''
                  AND COALESCE(li.is_return, false) = false
                GROUP BY li.description
                ORDER BY total_revenue DESC
                LIMIT 20
            `, [companyId, fromDate, toDate]),

            db.pgAll(`
                SELECT
                    i.id,
                    i.invoice_number,
                    i.invoice_date,
                    i.total_amount,
                    i.paid_amount,
                    GREATEST(0, i.total_amount - COALESCE(i.paid_amount, 0)) AS balance_amount,
                    i.status,
                    COALESCE(i.walk_in_name, u.nickname, u.username, 'Walk-in') AS customer_name,
                    COUNT(li.id) AS item_count,
                    COALESCE(SUM(li.quantity), 0) AS total_qty
                FROM invoices i
                LEFT JOIN users u ON u.id = i.customer_id
                LEFT JOIN invoice_line_items li ON li.invoice_id = i.id AND COALESCE(li.is_return, false) = false
                WHERE ${retailFilter.replace(/\$2/g, '$2').replace(/\$3/g, '$3')}
                GROUP BY i.id, i.invoice_number, i.invoice_date, i.total_amount,
                         i.paid_amount, i.status, i.walk_in_name, u.nickname, u.username
                ORDER BY i.invoice_date DESC, i.id DESC
                LIMIT 50
            `, [companyId, fromDate, toDate]),

            // Wholesale revenue (exclude retail, gift)
            db.pgGet(`
                SELECT COALESCE(SUM(total_amount), 0) AS wholesale_revenue
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(is_deleted, false) = false
                  AND COALESCE(is_nominal, false) = false
                  AND UPPER(COALESCE(invoice_type, '')) NOT IN ('RETAIL_SALE','GIFTED_ITEM','SALES_RETURN')
                  AND invoice_number NOT ILIKE 'RET/%'
                  AND invoice_number NOT ILIKE 'GFT/%'
                  AND invoice_date BETWEEN $2 AND $3
            `, [companyId, fromDate, toDate]),

            // All revenue for % calculation
            db.pgGet(`
                SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(is_deleted, false) = false
                  AND COALESCE(is_nominal, false) = false
                  AND UPPER(COALESCE(invoice_type, '')) != 'SALES_RETURN'
                  AND invoice_date BETWEEN $2 AND $3
            `, [companyId, fromDate, toDate]),
        ]);

        const retailRevenue   = parseFloat(summary?.total_revenue  || 0);
        const wholesaleRevenue = parseFloat(wholesaleRow?.wholesale_revenue || 0);
        const totalRevenue    = parseFloat(totalRow?.total_revenue  || 0);
        const retailPercent   = totalRevenue > 0
            ? ((retailRevenue / totalRevenue) * 100).toFixed(1)
            : '0.0';

        res.json({
            period:       { from: fromDate, to: toDate },
            summary: {
                total_bills:       parseInt(summary?.total_bills       || 0),
                total_revenue:     retailRevenue,
                total_collected:   parseFloat(summary?.total_collected || 0),
                total_pending:     parseFloat(summary?.total_pending   || 0),
                avg_bill_value:    parseFloat(summary?.avg_bill_value  || 0),
                paid_count:        parseInt(summary?.paid_count        || 0),
                partial_count:     parseInt(summary?.partial_count     || 0),
                pending_count:     parseInt(summary?.pending_count     || 0),
                paid_revenue:      parseFloat(summary?.paid_revenue    || 0),
                unique_customers:  parseInt(summary?.unique_customers  || 0),
                retail_percent:    retailPercent,
                wholesale_revenue: wholesaleRevenue,
                total_revenue_all: totalRevenue,
            },
            daily_trend:   daily        || [],
            top_products:  topProducts  || [],
            recent_bills:  recentBills  || [],
        });
    } catch (e) {
        console.error('GET /invoices/retail-summary error:', e.message);
        res.json({
            period: {},
            summary: {
                total_bills: 0, total_revenue: 0, total_collected: 0, total_pending: 0,
                avg_bill_value: 0, paid_count: 0, partial_count: 0, pending_count: 0,
                paid_revenue: 0, unique_customers: 0, retail_percent: '0.0',
                wholesale_revenue: 0, total_revenue_all: 0,
            },
            daily_trend: [], top_products: [], recent_bills: [],
        });
    }
});

/* ============================================================
   2b. GET /invoice/:id/pdf  — generate & download PDF
============================================================ */
router.get("/:id/pdf", authMiddleware, async (req, res) => {
    const id        = Number(req.params.id);
    const companyId = req.user.active_company_id;
    try {
        const invoiceData = await db.pgGet(`
            SELECT i.*,
                   COALESCE(u.nickname, u.username) as customer_name, u.address_line1, u.city_pincode,
                   u.state, u.gstin as customer_gstin, u.state_code as customer_state_code,
                   u.phone as customer_phone,
                   c.company_name, c.address_line1 as c_address, c.city_pincode as c_city,
                   c.state as c_state, c.gstin as c_gstin, c.state_code as company_state_code,
                   c.bank_name, c.bank_account_no, c.bank_ifsc_code, c.phone as c_phone,
                   COALESCE(json_agg(li.* ORDER BY li.id) FILTER (WHERE li.id IS NOT NULL), '[]') AS line_items
            FROM invoices i
            LEFT JOIN users     u  ON i.customer_id = u.id
            LEFT JOIN companies c  ON i.company_id  = c.id
            LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
            WHERE i.id = $1 AND i.company_id = $2
            GROUP BY i.id, u.nickname, u.username, u.address_line1, u.city_pincode, u.state,
                     u.gstin, u.state_code, u.phone,
                     c.company_name, c.address_line1, c.city_pincode, c.state,
                     c.gstin, c.state_code, c.bank_name, c.bank_account_no,
                     c.bank_ifsc_code, c.phone
        `, [id, companyId]);

        if (!invoiceData) return res.status(404).json({ error: 'Invoice not found' });

        const pdfBuffer = await generateInvoicePdf(invoiceData);
        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="Invoice_${invoiceData.invoice_number || id}.pdf"`,
            'Content-Length':      pdfBuffer.length,
        });
        res.end(pdfBuffer);
    } catch (err) {
        console.error('[PDF] generation error:', err.message);
        res.status(500).json({ error: 'PDF generation failed: ' + err.message });
    }
});

/* ============================================================
   2c. POST /invoices/:id/send-pdf — generate PDF & send via WhatsApp
============================================================ */
router.post("/:id/send-pdf", authMiddleware, async (req, res) => {
    const id        = Number(req.params.id);
    const companyId = req.user.active_company_id;
    try {
        // Fetch full invoice data including customer phone
        const invoiceData = await db.pgGet(`
            SELECT i.*,
                   COALESCE(u.nickname, u.username) as customer_name,
                   u.address_line1, u.city_pincode, u.state,
                   u.gstin as customer_gstin, u.state_code as customer_state_code,
                   u.phone as customer_phone,
                   c.company_name, c.address_line1 as c_address, c.city_pincode as c_city,
                   c.state as c_state, c.gstin as c_gstin, c.state_code as company_state_code,
                   c.bank_name, c.bank_account_no, c.bank_ifsc_code, c.phone as c_phone,
                   COALESCE(json_agg(li.* ORDER BY li.id) FILTER (WHERE li.id IS NOT NULL), '[]') AS line_items
            FROM invoices i
            LEFT JOIN users     u  ON i.customer_id = u.id
            LEFT JOIN companies c  ON i.company_id  = c.id
            LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
            WHERE i.id = $1 AND i.company_id = $2
            GROUP BY i.id, u.nickname, u.username, u.address_line1, u.city_pincode, u.state,
                     u.gstin, u.state_code, u.phone,
                     c.company_name, c.address_line1, c.city_pincode, c.state,
                     c.gstin, c.state_code, c.bank_name, c.bank_account_no,
                     c.bank_ifsc_code, c.phone
        `, [id, companyId]);

        if (!invoiceData) return res.status(404).json({ error: 'Invoice not found' });

        const phone = invoiceData.customer_phone;
        if (!phone) return res.status(400).json({ error: 'Customer has no phone number saved. Add a phone number first.' });

        // Generate PDF
        const { generateInvoicePdf } = await import('../utils/invoicePdf.js');
        const pdfBuffer = await generateInvoicePdf(invoiceData);
        const filename  = `Invoice_${invoiceData.invoice_number || id}.pdf`;

        // Send via WhatsApp
        const { sendWhatsAppFile, sendWhatsApp } = await import('../utils/whatsapp.js');
        const companyName = invoiceData.company_name || 'JBS Knit Wear';
        const companyPhone = invoiceData.c_phone || '9791902205';

        const caption =
`Dear ${invoiceData.customer_name},

Please find your invoice attached.

📋 *Invoice: ${invoiceData.invoice_number}*
💰 *Amount: ₹${Number(invoiceData.total_amount || 0).toLocaleString('en-IN')}*
📅 Date: ${new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}

For queries, contact us:
📞 ${companyPhone}
*${companyName}*`;

        await sendWhatsAppFile(phone, pdfBuffer, filename, caption);

        res.json({ success: true, message: `Invoice PDF sent to ${phone} via WhatsApp.` });
    } catch (err) {
        console.error('[send-pdf]', err.message);
        res.status(500).json({ error: 'Failed to send PDF: ' + err.message });
    }
});

/* ============================================================
   3. GET SINGLE INVOICE (FOR DETAILS & EDIT)
============================================================ */
router.get("/:id", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    const companyId = req.user.active_company_id;

    const sql = `
        SELECT i.*,
               COALESCE(u.nickname, u.username) as customer_name, u.address_line1, u.city_pincode, u.state, u.gstin as customer_gstin, u.state_code as customer_state_code,
               c.company_name, c.address_line1 as c_address, c.city_pincode as c_city, c.state as c_state, c.gstin as c_gstin, c.state_code as company_state_code,
               c.bank_name, c.bank_account_no, c.bank_ifsc_code, c.signature_url, c.phone as c_phone
        FROM invoices i
        LEFT JOIN users u ON i.customer_id = u.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.id = $1 AND i.company_id = $2
    `;

    try {
        const invoice = await db.pgGet(sql, [id, companyId]);
        if (!invoice) return res.status(404).json({ error: "Invoice not found" });

        const items = await db.pgAll("SELECT * FROM invoice_line_items WHERE invoice_id = $1", [id]);

        // Fetch default bank account from Finance & Banking setup
        const defaultBank = await db.pgGet(
            `SELECT bank_name, account_number, ifsc_code, upi_id
             FROM bank_details
             WHERE company_id = $1
             ORDER BY is_default DESC, id ASC
             LIMIT 1`,
            [companyId]
        );

        // Merge: bank_details (admin setup) wins over companies table columns
        const bankDetails = {
            bank_name:      defaultBank?.bank_name      || invoice.bank_name       || '',
            bank_account_no: defaultBank?.account_number || invoice.bank_account_no || '',
            bank_ifsc_code:  defaultBank?.ifsc_code      || invoice.bank_ifsc_code  || '',
            bank_upi_id:     defaultBank?.upi_id         || '',
        };

        res.json({ ...invoice, ...bankDetails, items });
    } catch (err) {
        console.error("Fetch Invoice Error:", err.message);
        res.status(500).json({ error: "Failed to fetch invoice" });
    }
});

/* ============================================================
   3b. POST /invoices/:id/mark-nominal — mark a real invoice as nominal (name_only)
        so it is excluded from outstanding / Sales Reports
============================================================ */
router.post("/:id/mark-nominal", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    const companyId = req.user.active_company_id;
    try {
        const inv = await db.pgGet(
            `SELECT id, bill_purpose FROM invoices WHERE id=$1 AND company_id=$2 AND COALESCE(is_deleted,false)=false`,
            [id, companyId]
        );
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });
        await db.pgRun(
            `UPDATE invoices SET bill_purpose='name_only', is_nominal=true WHERE id=$1 AND company_id=$2`,
            [id, companyId]
        );
        res.json({ success: true, message: 'Invoice marked as nominal — excluded from outstanding reports' });
    } catch (err) {
        console.error('mark-nominal error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/* ============================================================
   4. UPDATE INVOICE
============================================================ */
router.put("/:id", authMiddleware, checkAccess('Sales', 'edit_invoices'), async (req, res) => {
    const id = Number(req.params.id);
    const {
        items, notes, payments,
        customer_id, amount_paid, payment_status,
        invoice_number: newInvoiceNumber,
        invoice_date: newInvoiceDate,
        transport_details,
        bundles_count,
        tax_details,      // { cgst, sgst, igst, totalRate } — invoice-level GST rate
        invoice_type: editInvoiceType,
        discount_amount: editDiscountAmount,
        walk_in_name: editWalkInName,
    } = req.body;
    const companyId = req.user.active_company_id;

    let client;
    try {
        client = await db.getClient();
        await ensureNSBSchema(client);
        await client.query("BEGIN");

        // 0. Fetch Old Invoice for Balance Adjustment (only active, same company)
        const oldInv = await client.query(
            `SELECT total_amount, customer_id, invoice_number, invoice_type FROM invoices
             WHERE id = $1 AND company_id = $2 AND COALESCE(is_deleted, false) = false`,
            [id, companyId]
        );
        if (oldInv.rows.length === 0) throw new Error("Invoice not found or already deleted");
        const oldTotal = Number(oldInv.rows[0].total_amount);
        const oldCustId = oldInv.rows[0].customer_id;
        const oldInvoiceNumber = oldInv.rows[0].invoice_number;

        // If user changed the invoice number, verify the new number is not already taken
        const finalInvoiceNumber = (newInvoiceNumber && newInvoiceNumber.trim())
            ? newInvoiceNumber.trim().toUpperCase()
            : oldInvoiceNumber;

        // Also fetch the old invoice_type to scope the duplicate check
        const oldInvoiceType = oldInv.rows[0].invoice_type || editInvoiceType || 'TAX_INVOICE';

        if (finalInvoiceNumber !== oldInvoiceNumber) {
            const dup = await client.query(
                `SELECT i.id, i.invoice_date, COALESCE(u.nickname, u.username) AS customer_name
                 FROM invoices i
                 LEFT JOIN users u ON i.customer_id = u.id
                 WHERE i.invoice_number = $1 AND i.company_id = $2
                   AND i.invoice_type = $3
                   AND COALESCE(i.is_deleted,false) = false AND i.id <> $4
                 LIMIT 1`,
                [finalInvoiceNumber, companyId, oldInvoiceType, id]
            );
            if (dup.rows.length > 0) {
                const ex = dup.rows[0];
                const dateStr = ex.invoice_date ? new Date(ex.invoice_date).toLocaleDateString('en-GB') : 'unknown date';
                const custStr = ex.customer_name || 'unknown customer';
                await client.query('ROLLBACK');
                client.release();
                return res.status(409).json({ error: `Invoice number "${finalInvoiceNumber}" is already used by invoice #${ex.id} (${custStr}, ${dateStr}). Please use a different number.` });
            }
        }

        const effectiveCustomerId = (customer_id && !isNaN(Number(customer_id))) ? Number(customer_id) : oldCustId;

        // 1. Calculate New Totals
        // Determine GST type (intra vs inter state) from company + customer
        const editCompany = await client.query(`SELECT state_code FROM companies WHERE id = $1`, [companyId]);
        const editCustId = (customer_id && !isNaN(Number(customer_id))) ? Number(customer_id) : oldCustId;
        const editCustomer = editCustId ? await client.query(`SELECT state_code FROM users WHERE id = $1`, [editCustId]) : null;
        const editCompanyCode = editCompany.rows[0]?.state_code;
        const editCustomerCode = editCustomer?.rows[0]?.state_code;
        const editIsInterState = editCompanyCode && editCustomerCode && editCompanyCode !== editCustomerCode;
        const editIsNonTax = ['NON_TAX_INVOICE', 'RETAIL_SALE', 'GIFTED_ITEM'].includes((editInvoiceType || '').toUpperCase())
            || ['NON_TAX_INVOICE', 'RETAIL_SALE', 'GIFTED_ITEM'].includes(editInvoiceType || '');

        // Invoice-level GST rate fallback (from the GST selector in EditInvoice UI)
        const editInvoiceLevelGst = (tax_details && !isNaN(Number(tax_details.totalRate)) && Number(tax_details.totalRate) > 0)
            ? Number(tax_details.totalRate)
            : 5;

        let totalTaxable = 0;
        let totalGST = 0;
        let totalCGST_edit = 0;
        let totalSGST_edit = 0;
        let totalIGST_edit = 0;
        const processedItems = (items || []).map(i => {
            const qty = Number(i.qty || i.quantity) || 0;
            const rate = Number(i.rate || i.unit_price) || 0;
            const amount = qty * rate;
            // Use per-item gst_rate if > 0; fall back to invoice-level GST rate
            const itemRate = parseFloat(i.gst_rate);
            const gstRate = editIsNonTax ? 0 : ((!isNaN(itemRate) && itemRate > 0) ? itemRate : editInvoiceLevelGst);

            let cgstR = 0, sgstR = 0, igstR = 0;
            let cgstA = 0, sgstA = 0, igstA = 0;
            if (!editIsNonTax) {
                if (!editIsInterState) {
                    cgstR = gstRate / 2; sgstR = gstRate / 2;
                    cgstA = (amount * cgstR) / 100;
                    sgstA = (amount * sgstR) / 100;
                } else {
                    igstR = gstRate;
                    igstA = (amount * igstR) / 100;
                }
            }
            totalTaxable += amount;
            totalGST += cgstA + sgstA + igstA;
            totalCGST_edit += cgstA;
            totalSGST_edit += sgstA;
            totalIGST_edit += igstA;
            return {
                description: i.description || i.name,
                hsn: i.hsn || i.hsn_acs_code,
                qty, rate, amount, gstRate,
                cgstR, sgstR, igstR, cgstA, sgstA, igstA,
            };
        });

        const totalAmount = Math.round(totalTaxable + totalGST);

        // 2. Update Header — persist ALL editable fields
        await client.query(
            `UPDATE invoices SET
                invoice_number     = $1,
                customer_id        = $2,
                notes              = $3,
                total_amount       = $4,
                sub_total          = $5,
                paid_amount        = $6,
                status             = $7,
                invoice_type       = COALESCE($8, invoice_type),
                invoice_date       = COALESCE($9::date, invoice_date),
                vehicle_number     = COALESCE($10, vehicle_number),
                transportation_mode = COALESCE($11, transportation_mode),
                date_of_supply     = COALESCE($12::date, date_of_supply),
                reverse_charge     = COALESCE($13, reverse_charge),
                bundles_count      = COALESCE($14, bundles_count),
                discount_amount    = COALESCE($17, 0),
                walk_in_name       = $18,
                updated_at         = NOW()
             WHERE id = $15 AND company_id = $16`,
            [
                finalInvoiceNumber,
                effectiveCustomerId,
                notes || null,
                totalAmount,
                totalTaxable,          // sub_total = taxable amount (no GST), always correct
                amount_paid || 0,
                payment_status || 'PENDING',
                editInvoiceType || null,  // save the bill type if provided
                newInvoiceDate || null,
                transport_details?.vehicle || null,
                transport_details?.mode   || null,
                transport_details?.supply_date || null,
                transport_details?.reverse_charge || null,
                bundles_count != null ? Number(bundles_count) : null,
                id,
                companyId,
                editDiscountAmount != null ? Number(editDiscountAmount) : null,
                editWalkInName || null,
            ]
        );

        // 3. Replace Invoice Ledger Event
        if (oldCustId) {
            await deleteCustomerLedgerEvents(client, {
                companyId,
                customerId: oldCustId,
                type: "INVOICE",
                relatedInvoiceId: id,
            });
        }
        if (effectiveCustomerId) {
            await createCustomerLedgerEvent(client, {
                companyId,
                branchId: req.user.branch_id || 1,
                customerId: effectiveCustomerId,
                type: "INVOICE",
                category: "SALES",
                amount: totalAmount,
                date: new Date().toISOString().split("T")[0],
                description: `Invoice #${finalInvoiceNumber}`,
                relatedInvoiceId: id,
                referenceType: "INVOICE",
                referenceId: id,
                createdBy: req.user.id,
            });
        }

        // 4. Process New Payments
        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                const pAmt = Number(p.amount) || 0;
                if (pAmt > 0) {
                    const pDate = p.payment_date || new Date();
                    
                    // Insert Payment Record
                    const paymentResult = await client.query(
                        `INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, reference_no)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, pAmt, p.payment_method || 'CASH', pDate, p.reference_no || null]
                    );

                    if (effectiveCustomerId) {
                        await createCustomerLedgerEvent(client, {
                            companyId,
                            branchId: req.user.branch_id || 1,
                            customerId: Number(effectiveCustomerId),
                            type: "RECEIPT",
                            category: "PAYMENT",
                            amount: pAmt,
                            date: pDate,
                            description: `Payment for Invoice #${finalInvoiceNumber}`,
                            relatedInvoiceId: Number(id),
                            referenceType: "PAYMENT",
                            referenceId: paymentResult.rows[0].id,
                            createdBy: req.user.id,
                            meta: {
                                payment_method: p.payment_method || "CASH",
                                reference_no: p.reference_no || null,
                                bank_name: p.payment_method === "BANK" ? (p.bank_name || "Customer Bank") : null,
                                bank_transaction_id: p.payment_method === "BANK" ? (p.bank_transaction_id || p.reference_no || `BNK-${Date.now()}`) : null,
                                bank_timestamp: p.payment_method === "BANK" ? (p.bank_timestamp || new Date().toISOString()) : null,
                            },
                        });
                    }

                    // --- Custom Ledgers Update ---
                    const pMethod = (p.payment_method || 'CASH').toUpperCase();
                    if (pMethod === 'CASH') {
                        await client.query(`
                            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, invoice_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', pDate, id]);
                    } else if (pMethod === 'BANK') {
                        await client.query(`
                            INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date, invoice_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', p.bank_name || 'Bank', p.reference_no || p.bank_transaction_id || '-', pDate, id]);
                    } else if (pMethod === 'PROPRIETOR_AC') {
                        await client.query(`
                            INSERT INTO proprietor_transactions
                                (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by, reference_type, reference_id)
                            VALUES ($1, $2, 'PERSONAL_RECEIPT', $3, 'PROPRIETOR_AC', $4, $5, $6, 'INVOICE', $7)
                        `, [companyId, req.user.branch_id || 1, pAmt, pDate,
                            `Customer payment via Proprietor A/C — Invoice #${id}`,
                            req.user.id, Number(id)]);
                    }
                }
            }
        }

        // 5. Sync Line Items — store full GST breakdown so print preview works correctly
        await client.query("DELETE FROM invoice_line_items WHERE invoice_id = $1", [id]);

        for (const item of processedItems) {
            const lineTax = item.cgstA + item.sgstA + item.igstA;
            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, description, hsn_acs_code, quantity,
                    unit_price, taxable_value, tax_percent,
                    cgst_rate, sgst_rate, igst_rate,
                    cgst_amount, sgst_amount, igst_amount,
                    line_total
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    id, item.description, item.hsn, item.qty, item.rate, item.amount,
                    item.gstRate,
                    item.cgstR, item.sgstR, item.igstR,
                    item.cgstA, item.sgstA, item.igstA,
                    item.amount + lineTax,
                ]
            );
        }

        // Also update invoice header GST totals
        await client.query(
            `UPDATE invoices SET cgst_total = $1, sgst_total = $2, igst_total = $3, tax_total = $4 WHERE id = $5`,
            [Math.round(totalCGST_edit), Math.round(totalSGST_edit), Math.round(totalIGST_edit), Math.round(totalGST), id]
        );

        // Recompute balance for old AND new customer (handles customer change)
        const custIdsToRecompute = [...new Set([oldCustId, effectiveCustomerId].filter(Boolean))];
        for (const cid of custIdsToRecompute) {
            await recomputeCustomerBalance(client, cid, companyId);
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Invoice updated successfully" });

        // ── Post-commit: WhatsApp thank-you for new payments (non-blocking) ──
        const newPaymentTotal = Array.isArray(payments)
            ? payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
            : 0;
        if (newPaymentTotal > 0) {
            try {
                const { sendWhatsApp, notifyOwner } = await import('../utils/whatsapp.js');
                const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

                const custRow = effectiveCustomerId
                    ? await db.pgGet(`SELECT username, nickname, phone FROM users WHERE id = $1`, [effectiveCustomerId])
                    : null;
                const custName  = custRow?.nickname || custRow?.username || 'Customer';
                const custPhone = custRow?.phone || '';

                const updInv = await db.pgGet(
                    `SELECT paid_amount, total_amount FROM invoices WHERE id = $1`, [id]
                );
                const updPaid    = parseFloat(updInv?.paid_amount || 0);
                const updTotal   = parseFloat(updInv?.total_amount || 0);
                const updBalance = Math.max(0, updTotal - updPaid);

                if (custPhone) {
                    await sendWhatsApp(custPhone,
`Dear ${custName},

🙏 Thank you for your payment!

Invoice No : ${finalInvoiceNumber}
Amount Received : ₹${fmt(newPaymentTotal)}
Total Paid : ₹${fmt(updPaid)}
Balance Due : ₹${fmt(updBalance)}
${updBalance <= 0 ? '✅ Payment complete — Thank you!' : '⏳ Partial payment received'}

JBS Knit Wear, Tiruppur
📞 8148232205`);
                }

                await notifyOwner(
`✅ Payment Received!

Customer : ${custName}
Invoice  : ${finalInvoiceNumber}
Amount   : ₹${fmt(newPaymentTotal)}
Balance  : ₹${fmt(updBalance)}`);
            } catch (waErr) {
                console.log('[WhatsApp/edit-payment] silent fail:', waErr.message);
            }
        }

    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Update Invoice Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   5. DELETE INVOICE
============================================================ */
router.delete("/:id", authMiddleware, checkAccess('Sales', 'delete_invoices'), async (req, res) => {
    const id = Number(req.params.id);
    const companyId = req.user.active_company_id;
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // 1. Fetch invoice + line items before marking deleted
        const inv = await client.query(
            `SELECT i.customer_id, i.branch_id, i.bill_purpose,
                    COALESCE(i.is_deleted, false) AS is_deleted
             FROM invoices i
             WHERE i.id = $1 AND i.company_id = $2`,
            [id, companyId]
        );
        if (inv.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Invoice not found" });
        }
        const { customer_id, branch_id, bill_purpose: invBillPurpose, is_deleted } = inv.rows[0];
        if (is_deleted) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Invoice already cancelled" });
        }

        // 2. Soft-delete the invoice (preserves audit trail)
        await client.query(
            `UPDATE invoices SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
            [id]
        );

        // 3. Restore inventory via centralized engine (only for real bills)
        if (invBillPurpose !== 'name_only') {
            const restoredCount = await restoreStockForInvoice(client, { companyId, invoiceId: id });
            console.log(`[invoiceDelete] Restored stock for ${restoredCount} item(s) on invoice #${id}`);
        }

        // 4. Remove financial entries so balances recompute correctly
        await client.query(
            `DELETE FROM ledger_entries WHERE transaction_id IN (
                SELECT id FROM transactions WHERE reference_type = 'INVOICE' AND reference_id = $1
             )`,
            [id]
        );
        await client.query(
            `DELETE FROM transactions WHERE reference_type = 'INVOICE' AND reference_id = $1`,
            [id]
        );
        await client.query(`DELETE FROM invoice_payments WHERE invoice_id = $1`, [id]);

        // 4b. Remove cash/bank ledger entries tied to this invoice
        await client.query(`DELETE FROM cash_ledger WHERE invoice_id = $1`, [id]);
        await client.query(`DELETE FROM bank_ledger WHERE invoice_id = $1`, [id]);

        // 5. Remove customer ledger events for this invoice
        if (customer_id) {
            await deleteCustomerLedgerEvents(client, {
                companyId,
                customerId: customer_id,
                relatedInvoiceId: id,
            });
        }

        // 6. Recompute customer balance
        if (customer_id) {
            await recomputeCustomerBalance(client, customer_id, companyId);
        }

        await client.query("COMMIT");
        res.json({ message: "Invoice cancelled successfully" });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Delete Invoice Error:", err.message);
        res.status(500).json({ error: "Delete failed" });
    } finally {
        if (client) client.release();
    }
});

/**
 * 💰 COLLECT PAYMENT FOR INVOICE
 */
router.post("/:id/payment", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { amount, mode, payment_date, notes } = req.body;
    const companyId = req.user.active_company_id;

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const invoice = await client.query("SELECT * FROM invoices WHERE id = $1 AND company_id = $2 FOR UPDATE", [id, companyId]);
        if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found" });

        const inv = invoice.rows[0];
        const newPaid = parseFloat(inv.paid_amount) + parseFloat(amount);
        const status = getStatus(newPaid, inv.total_amount);

        await client.query("UPDATE invoices SET paid_amount = $1, status = $2 WHERE id = $3", [newPaid, status, id]);

        // Ledger Entry logic (simplified for test completion)
        const cashAcc = await getAccountByCode(companyId, "1000");
        const arAcc = await getAccountByCode(companyId, "1100");
        
        if (cashAcc && arAcc) {
            const pMethod = (mode || "CASH").toUpperCase();
            const isBank = pMethod === "BANK" || pMethod === "UPI";
            const bankAcc = await getAccountByCode(companyId, "1200");
            const effectiveAcc = isBank ? (bankAcc || cashAcc) : cashAcc;

            await createTransactionInternal(client, {
                company_id: companyId,
                branch_id: inv.branch_id || 1,
                transaction_date: payment_date || new Date(),
                reference_type: "INVOICE_PAYMENT",
                reference_id: id,
                description: `Payment for Invoice #${inv.invoice_number}`,
                created_by: req.user.id
            }, [
                { account_id: effectiveAcc.id, debit_amount: amount, credit_amount: 0, description: `Received via ${mode}` },
                { account_id: arAcc.id, debit_amount: 0, credit_amount: amount, description: `Customer balance reduction` }
            ]);
        }

        // ── Insert into cash_ledger or bank_ledger ──
        const ledgerBranchId = inv.branch_id || req.user.branch_id || 1;
        const ledgerDate = payment_date || new Date().toISOString().split('T')[0];
        const ledgerMode = (mode || 'CASH').toUpperCase();
        const ledgerNote = `Payment for Invoice #${inv.invoice_number}`;

        if (ledgerMode === 'CASH') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, invoice_id, notes)
                 SELECT $1,$2,'Payment',$3,'in',$4,$5,$6
                 WHERE NOT EXISTS (
                     SELECT 1 FROM cash_ledger
                     WHERE company_id=$1 AND invoice_id=$5 AND amount=$3 AND date=$4
                 )`,
                [companyId, ledgerBranchId, amount, ledgerDate, id, ledgerNote]
            );
        } else if (['BANK','UPI','CHEQUE','NEFT','RTGS','IMPS'].includes(ledgerMode)) {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, date, invoice_id, notes)
                 SELECT $1,$2,'Payment',$3,'in',$4,$5,$6
                 WHERE NOT EXISTS (
                     SELECT 1 FROM bank_ledger
                     WHERE company_id=$1 AND invoice_id=$5 AND amount=$3 AND date=$4
                 )`,
                [companyId, ledgerBranchId, amount, ledgerDate, id, ledgerNote]
            );
        }

        await client.query("COMMIT");

        // Capture final values after commit for WhatsApp (newPaid and status are already correct)
        const waInvNumber  = inv.invoice_number;
        const waTotal      = parseFloat(inv.total_amount);
        const waNewPaid    = newPaid;
        const waNewBalance = Math.max(0, waTotal - waNewPaid);
        const waStatus     = status;
        const waMode       = mode || 'CASH';

        res.json({ success: true, message: "Payment recorded", newPaid: waNewPaid, status: waStatus });

        // ── Post-commit: WhatsApp receipt to customer + owner alert (non-blocking) ──
        try {
            const { sendWhatsApp, notifyOwner } = await import('../utils/whatsapp.js');
            const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

            // Fetch customer name + phone after commit (non-blocking read)
            const custRow = inv.customer_id
                ? (await db.pgGet(`SELECT username, nickname, phone FROM users WHERE id = $1`, [inv.customer_id]))
                : null;

            const custName  = custRow?.nickname || custRow?.username || 'Customer';
            const custPhone = custRow?.phone || '';

            // Customer thank-you receipt
            if (custPhone) {
                await sendWhatsApp(custPhone,
`Dear ${custName},

🙏 *Thank you for your payment!*

Invoice No  : ${waInvNumber}
Amount Paid : ₹${fmt(amount)} (via ${waMode})
Total Paid  : ₹${fmt(waNewPaid)}
Balance Due : ₹${fmt(waNewBalance)}
${waNewBalance <= 0
    ? '✅ Your account is fully settled. We appreciate your promptness!'
    : '⏳ Partial payment received. Balance of ₹' + fmt(waNewBalance) + ' is pending.'}

Thank you for choosing JBS Knit Wear, Tiruppur.
📞 8148232205`);
            }

            // Owner alert
            await notifyOwner(
`✅ Payment Collected!

Customer: ${custName}
Invoice: ${waInvNumber}
Amount: ₹${fmt(amount)} via ${waMode}
Total Paid: ₹${fmt(waNewPaid)} / ₹${fmt(waTotal)}
Balance: ₹${fmt(waNewBalance)}
Status: ${waStatus}`);

        } catch (waErr) {
            console.log('[WhatsApp/payment] silent fail:', waErr.message);
        }

    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Invoice Payment Accounting Error:", err.message);
        res.status(500).json({ error: "Payment failed: " + err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
