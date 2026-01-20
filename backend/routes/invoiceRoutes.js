// backend/routes/invoiceRoutes.js
// COMPLETE VERSION - Fixed with proper getClient usage

import express from "express";
import * as db from "../database/pg.js";
import { checkAccess } from "../middlewares/checkAccess.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/* ============================================================
   HELPER: Generate Smart Invoice Number
   Format: TAX/2023/OCT/001 or RET/2023/OCT/001
============================================================ */
async function generateInvoiceNumber(client, type, companyId) {
    const date = new Date();
    const monthStr = date.toLocaleString("default", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    const financial_month = `${year}-${monthStr}`;

    const prefix = type === "TAX_INVOICE" ? "TAX" : "RET";

    // Count existing invoices for this month/type to generate next sequence
    const result = await client.query(
        `SELECT COUNT(*) AS count FROM invoices 
         WHERE company_id=$1 AND invoice_category=$2 AND financial_month=$3`,
        [companyId, type, financial_month]
    );

    const count = Number(result.rows[0].count) + 1;
    const padding = count.toString().padStart(3, "0");

    return {
        number: `${prefix}/${year}/${monthStr}/${padding}`,
        financial_month,
    };
}

/* ============================================================
   1. GET ALL INVOICES
   Permission: 'view_invoices'
============================================================ */
router.get("/", authMiddleware, checkAccess('Sales', 'view_invoices'), async (req, res) => {
    const companyId = req.user.active_company_id;

    const sql = `
        SELECT i.*, u.username as customer_name,
        COALESCE(json_agg(li.*) FILTER (WHERE li.id IS NOT NULL), '[]') AS line_items
        FROM invoices i
        LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
        LEFT JOIN users u ON i.customer_id = u.id
        WHERE i.company_id = $1
        GROUP BY i.id, u.username
        ORDER BY i.created_at DESC
    `;

    try {
        const rows = await db.pgAll(sql, [companyId]);
        res.json(rows);
    } catch (err) {
        console.error("Invoice list error:", err);
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
});

/* ============================================================
   2. GET SINGLE INVOICE (View/Print)
   Permission: 'view_invoices'
============================================================ */
router.get("/:id", authMiddleware, checkAccess('Sales', 'view_invoices'), async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    try {
        // 1. Fetch Invoice Header + Customer Details + Company Details
        const invoiceSql = `
            SELECT i.*, 
                   u.username as customer_name, u.address_line1, u.city_pincode, u.state, u.state_code, u.gstin as customer_gstin,
                   c.company_name, c.address_line1 as c_address, c.city_pincode as c_city, c.state as c_state, c.gstin as c_gstin,
                   c.bank_name, c.bank_account_no, c.bank_ifsc_code, c.signature_url
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            LEFT JOIN companies c ON i.company_id = c.id
            WHERE i.id = $1 AND i.company_id = $2
        `;
        const invoiceRes = await db.pgGet(invoiceSql, [id, companyId]);
        
        if (!invoiceRes) return res.status(404).json({ error: "Invoice not found" });

        // 2. Fetch Line Items
        const items = await db.pgAll(`SELECT * FROM invoice_line_items WHERE invoice_id = $1`, [id]);

        // 3. Fetch Payments
        const payments = await db.pgAll(`SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date`, [id]);

        // 4. Combine
        res.json({ ...invoiceRes, items, payments });

    } catch (err) {
        console.error("Get single invoice error:", err);
        res.status(500).json({ error: "Failed to fetch invoice" });
    }
});

/* ============================================================
   3. CREATE INVOICE (WITH MULTIPLE PAYMENTS SUPPORT)
   Permission: 'create_invoices'
============================================================ */
router.post("/", authMiddleware, checkAccess('Sales', 'create_invoices'), async (req, res) => {
    const {
        invoice_number,
        invoice_type,
        customer_id,
        items,
        notes,
        amount_paid,
        balance_due,
        payment_status,
        payments, // Array of payment objects
        transport_details,
        bundles_count
    } = req.body;

    const companyId = req.user.active_company_id;
    let client;

    try {
        // ✅ FIXED: Get client from pool for transaction
        client = await db.getClient();
        await client.query("BEGIN");

        // Generate Number if not provided
        let finalInvoiceNumber = invoice_number;
        let financial_month;
        
        if (!finalInvoiceNumber) {
            const generated = await generateInvoiceNumber(client, invoice_type, companyId);
            finalInvoiceNumber = generated.number;
            financial_month = generated.financial_month;
        } else {
            const date = new Date();
            const monthStr = date.toLocaleString("default", { month: "short" }).toUpperCase();
            const year = date.getFullYear();
            financial_month = `${year}-${monthStr}`;
        }

        // Calculate Totals from Items
        let totalTaxable = 0;
        let totalGST = 0;
        
        const processedItems = (items || []).map(i => {
            const qty = Number(i.qty) || 0;
            const rate = Number(i.rate) || 0;
            const amount = qty * rate;
            
            // GST calculation
            const gstRate = Number(i.gst_rate) || 5;
            const gstAmount = amount * (gstRate / 100);
            
            totalTaxable += amount;
            totalGST += gstAmount;
            
            return { ...i, qty, rate, amount, gstRate, gstAmount };
        });

        const totalAmount = Math.round(totalTaxable + totalGST);

        // Insert Invoice Header
        const headerSQL = `
            INSERT INTO invoices (
                company_id, customer_id, invoice_number, invoice_category,
                financial_month, invoice_date, due_date, status, total_amount,
                amount_paid, balance_due, payment_status,
                notes, bundles_count,
                vehicle_number, transport_mode, supply_date, reverse_charge,
                created_at
            ) VALUES (
                $1,$2,$3,$4,$5,NOW(),NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()
            ) RETURNING id
        `;

        const result = await client.query(headerSQL, [
            companyId,
            customer_id || null,
            finalInvoiceNumber,
            invoice_type || 'TAX_INVOICE',
            financial_month,
            payment_status || 'UNPAID',
            totalAmount,
            amount_paid || 0,
            balance_due || totalAmount,
            payment_status || 'UNPAID',
            notes || null,
            bundles_count || 0,
            transport_details?.vehicle || null,
            transport_details?.mode || null,
            transport_details?.supply_date || null,
            transport_details?.reverse_charge || 'No'
        ]);

        const invoiceId = result.rows[0].id;

        // Insert Line Items
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, product_id, description, hsn_acs_code, quantity, 
                    unit_price, line_total, gst_rate
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [
                    invoiceId,
                    item.product_id || null,
                    item.name || item.description || "Item",
                    item.hsn || null,
                    item.qty,
                    item.rate,
                    item.amount + item.gstAmount,
                    item.gstRate
                ]
            );

            // Deduct Stock (if product ID exists)
            if (item.product_id) {
                await client.query(
                    `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2 AND company_id = $3`,
                    [item.qty, item.product_id, companyId]
                );
            }
        }

        // Insert Multiple Payments
        if (payments && Array.isArray(payments) && payments.length > 0) {
            for (const payment of payments) {
                if (payment.amount > 0) {
                    await client.query(
                        `INSERT INTO invoice_payments (
                            invoice_id, amount, payment_method, payment_date, 
                            reference_no, notes, created_at
                        ) VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
                        [
                            invoiceId,
                            Number(payment.amount),
                            payment.payment_method || 'CASH',
                            payment.payment_date || new Date().toISOString().slice(0, 10),
                            payment.reference_no || null,
                            payment.notes || null
                        ]
                    );
                }
            }
        }

        await client.query("COMMIT");
        
        res.status(201).json({
            message: "Invoice Created Successfully",
            invoice_number: finalInvoiceNumber,
            id: invoiceId,
            total_amount: totalAmount,
            payments_count: payments?.length || 0
        });
        
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Invoice creation error:", err);
        res.status(500).json({ 
            error: "Failed to create invoice.",
            message: err.message 
        });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   4. UPDATE INVOICE
   Permission: 'edit_invoices'
============================================================ */
router.put("/:id", authMiddleware, checkAccess('Sales', 'edit_invoices'), async (req, res) => {
    const { id } = req.params;
    const { items, payment_mode, bank_ledger_id, transaction_ref, notes } = req.body;
    const companyId = req.user.active_company_id;

    let client;
    try {
        // ✅ FIXED: Get client for transaction
        client = await db.getClient();
        await client.query("BEGIN");

        // 1. Calculate New Totals
        let totalAmount = 0;
        
        const processedItems = (items || []).map(i => {
            const qty = Number(i.qty) || 0;
            const unitPrice = Number(i.unit_price || i.rate || i.price || 0); 
            const gstRate = Number(i.gst_rate) || 0;
            const lineTotal = qty * unitPrice;
            const gstAmount = lineTotal * (gstRate / 100);
            
            return { ...i, qty, unitPrice, lineTotal, gstAmount, gstRate };
        });

        processedItems.forEach(item => {
            totalAmount += item.lineTotal + item.gstAmount;
        });

        if(isNaN(totalAmount)) totalAmount = 0;

        // 2. Update Invoice Header
        await client.query(
            `UPDATE invoices 
             SET total_amount=$1, payment_mode=$2, bank_ledger_id=$3, transaction_ref=$4, notes=$5, updated_at=NOW()
             WHERE id=$6 AND company_id=$7`,
            [totalAmount, payment_mode, bank_ledger_id || null, transaction_ref || null, notes || null, id, companyId]
        );

        // 3. Delete Old Items
        await client.query(`DELETE FROM invoice_line_items WHERE invoice_id=$1`, [id]);

        // 4. Insert New Items
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, product_id, description, quantity, unit_price, line_total, gst_rate
                ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    id,
                    item.id || null,
                    item.description || "Item",
                    item.qty,
                    item.unitPrice,
                    item.lineTotal,
                    item.gstRate
                ]
            );
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Invoice updated successfully" });

    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Update invoice error:", err);
        res.status(500).json({ error: "Failed to update invoice" });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   5. DELETE INVOICE
   Permission: 'delete_invoices'
============================================================ */
router.delete("/:id", authMiddleware, checkAccess('Sales', 'delete_invoices'), async (req, res) => {
    const id = Number(req.params.id);
    const companyId = req.user.active_company_id;

    try {
        // Delete Payments first (if they exist)
        await db.pgRun(`DELETE FROM invoice_payments WHERE invoice_id=$1`, [id]);
        
        // Delete Invoice (Cascade deletes items)
        const r = await db.pgRun(
            `DELETE FROM invoices WHERE id=$1 AND company_id=$2 RETURNING id`,
            [id, companyId]
        );

        if (r.rowCount === 0)
            return res.status(404).json({ error: "Invoice not found" });

        // Optionally delete related transaction entries if any
        await db.pgRun(
            `DELETE FROM transactions WHERE related_invoice_id=$1`,
            [id]
        );

        res.json({ message: "Invoice deleted" });
    } catch (err) {
        console.error("Delete invoice error:", err);
        res.status(500).json({ error: "Failed to delete invoice" });
    }
});

export default router;