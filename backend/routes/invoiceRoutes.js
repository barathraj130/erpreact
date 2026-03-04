// backend/routes/invoiceRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import { checkAccess } from "../middlewares/checkAccess.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { createTransaction, getAccountByCode } from "../utils/accountingEngine.js";

const router = express.Router();

/**
 * AUTO-FIX: Ensure invoice_payments table exists
 * (Your run-migrations.js was missing this table)
 */
async function ensurePaymentsTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS invoice_payments (
            id SERIAL PRIMARY KEY,
            invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
            amount NUMERIC NOT NULL,
            payment_method VARCHAR(50),
            payment_date DATE DEFAULT CURRENT_DATE,
            reference_no TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    await db.pgRun(sql);
}
ensurePaymentsTable();

/* ============================================================
   HELPER: Generate Smart Invoice Number
============================================================ */
async function generateInvoiceNumber(client, type, companyId) {
    const date = new Date();
    const monthStr = date.toLocaleString("default", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    const financial_month = `${year}-${monthStr}`;
    const prefix = type === "TAX_INVOICE" ? "TAX" : "RET";

    const result = await client.query(
        `SELECT COUNT(*) AS count FROM invoices 
         WHERE company_id=$1 AND invoice_type=$2 AND financial_month=$3`,
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
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
});

/* ============================================================
   2. CREATE INVOICE (CRITICAL FIXES FOR COLUMN NAMES)
============================================================ */
router.post("/", authMiddleware, checkAccess('Sales', 'create_invoices'), async (req, res) => {
    const {
        invoice_number, invoice_type, customer_id, items, notes,
        amount_paid, balance_due, payment_status, payments,
        transport_details, bundles_count
    } = req.body;

    const companyId = req.user.active_company_id;
    let client;

    try {
        client = await db.getClient();
        await client.query("BEGIN");

        let finalInvoiceNumber = invoice_number;
        let financial_month;
        
        if (!finalInvoiceNumber) {
            const gen = await generateInvoiceNumber(client, invoice_type || 'TAX_INVOICE', companyId);
            finalInvoiceNumber = gen.number;
            financial_month = gen.financial_month;
        } else {
            financial_month = `${new Date().getFullYear()}-${new Date().toLocaleString("default", { month: "short" }).toUpperCase()}`;
        }

        let totalTaxable = 0;
        let totalGST = 0;
        const processedItems = (items || []).map(i => {
            const qty = Number(i.qty) || 0;
            const rate = Number(i.rate) || 0;
            const amount = qty * rate;
            const gstRate = Number(i.gst_rate) || 5;
            totalTaxable += amount;
            totalGST += (amount * (gstRate / 100));
            return { ...i, qty, rate, amount, gstRate };
        });

        const totalAmount = Math.round(totalTaxable + totalGST);

        // SQL: Matching your run-migrations.js exactly
        const headerSQL = `
            INSERT INTO invoices (
                company_id, customer_id, invoice_number, invoice_type,
                financial_month, invoice_date, due_date, status, total_amount,
                paid_amount, notes, bundles_count,
                vehicle_number, transportation_mode, date_of_supply, reverse_charge,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            RETURNING id
        `;

        const result = await client.query(headerSQL, [
            companyId,
            customer_id || null,
            finalInvoiceNumber,
            invoice_type || 'TAX_INVOICE',
            financial_month,
            payment_status || 'UNPAID', // In DB this is 'status'
            totalAmount,
            amount_paid || 0,           // In DB this is 'paid_amount'
            notes || null,
            bundles_count || 0,
            transport_details?.vehicle || null,
            transport_details?.mode || null,      // In DB this is 'transportation_mode'
            transport_details?.supply_date || null, // In DB this is 'date_of_supply'
            transport_details?.reverse_charge || 'No'
        ]);

        const invoiceId = result.rows[0].id;

        // Line Items
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, product_id, description, quantity, 
                    unit_price, taxable_value, line_total, gst_rate
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [invoiceId, item.product_id || null, item.name || "Item", item.qty, item.rate, item.amount, item.amount, item.gstRate]
            );
        }

        // Payments
        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                const pAmt = Number(p.amount) || 0;
                if (pAmt > 0) {
                    const pDate = p.payment_date || new Date();
                    await client.query(
                        `INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, reference_no)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [invoiceId, pAmt, p.payment_method || 'CASH', pDate, p.reference_no || null]
                    );

                    // RECORD TRANSACTION FOR PAYMENT (RECEIPT)
                    if (customer_id) {
                        await client.query(
                            `INSERT INTO transactions 
                            (company_id, user_id, amount, type, category, date, description, related_invoice_id) 
                            VALUES ($1, $2, $3, 'RECEIPT', 'PAYMENT', $4, $5, $6)`,
                            [
                                Number(companyId), 
                                Number(customer_id), 
                                pAmt, 
                                pDate, 
                                `Payment for Invoice #${finalInvoiceNumber}`, 
                                Number(invoiceId)
                            ]
                        );

                        // Subtract from customer balance
                        await client.query(
                            `UPDATE users SET initial_balance = COALESCE(initial_balance, 0) - $1 WHERE id = $2`,
                            [pAmt, Number(customer_id)]
                        );
                    }
                }
            }
        }


        // --- INTEGRATE WITH ACCOUNTING ENGINE ---
        
        const arAccount = await getAccountByCode(companyId, '1100'); // Accounts Receivable
        const salesAccount = await getAccountByCode(companyId, '4000'); // Sales Revenue
        const taxAccount = await getAccountByCode(companyId, '2100'); // GST Payable

        if (arAccount && salesAccount) {
            const txLines = [
                { account_id: arAccount.id, debit_amount: totalAmount, credit_amount: 0, description: `Sales to Customer #${customer_id}` },
                { account_id: salesAccount.id, debit_amount: 0, credit_amount: totalTaxable, description: `Sales Revenue from Inv #${finalInvoiceNumber}` }
            ];
            
            if (totalGST > 0 && taxAccount) {
                txLines.push({ account_id: taxAccount.id, debit_amount: 0, credit_amount: totalGST, description: `GST on Inv #${finalInvoiceNumber}` });
            }

            await createTransaction({
                company_id: companyId,
                branch_id: req.user.branch_id || 1, // Fallback to branch 1
                transaction_date: new Date(),
                reference_type: 'INVOICE',
                reference_id: invoiceId,
                description: `Invoice #${finalInvoiceNumber}`,
                created_by: req.user.id
            }, txLines);
        }

        await client.query("COMMIT");
        res.status(201).json({ message: "Invoice saved", id: invoiceId });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Critical Invoice Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
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
               u.username as customer_name, u.address_line1, u.city_pincode, u.state, u.gstin as customer_gstin, u.state_code as customer_state_code,
               c.company_name, c.address_line1 as c_address, c.city_pincode as c_city, c.state as c_state, c.gstin as c_gstin, c.state_code as company_state_code,
               c.bank_name, c.bank_account_no, c.bank_ifsc_code, c.signature_url
        FROM invoices i
        LEFT JOIN users u ON i.customer_id = u.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.id = $1 AND i.company_id = $2
    `;

    try {
        const invoice = await db.pgGet(sql, [id, companyId]);
        if (!invoice) return res.status(404).json({ error: "Invoice not found" });

        const items = await db.pgAll("SELECT * FROM invoice_line_items WHERE invoice_id = $1", [id]);
        res.json({ ...invoice, items });
    } catch (err) {
        console.error("Fetch Invoice Error:", err.message);
        res.status(500).json({ error: "Failed to fetch invoice" });
    }
});

/* ============================================================
   4. UPDATE INVOICE
============================================================ */
router.put("/:id", authMiddleware, checkAccess('Sales', 'edit_invoices'), async (req, res) => {
    const id = Number(req.params.id);
    const { items, notes, payments, customer_id, amount_paid, payment_status } = req.body;
    const companyId = req.user.active_company_id;

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // 0. Fetch Old Invoice for Balance Adjustment
        const oldInv = await client.query(`SELECT total_amount, customer_id, invoice_number FROM invoices WHERE id = $1`, [id]);
        if (oldInv.rows.length === 0) throw new Error("Invoice not found");
        const oldTotal = Number(oldInv.rows[0].total_amount);
        const oldCustId = oldInv.rows[0].customer_id;
        const invoiceNumber = oldInv.rows[0].invoice_number;

        // 1. Calculate New Totals
        let totalTaxable = 0;
        let totalGST = 0;
        const processedItems = (items || []).map(i => {
            const qty = Number(i.qty || i.quantity) || 0;
            const rate = Number(i.rate || i.unit_price) || 0;
            const amount = qty * rate;
            const gstRate = Number(i.gst_rate) || 5;
            totalTaxable += amount;
            totalGST += (amount * (gstRate / 100));
            return { 
                description: i.description || i.name, 
                hsn: i.hsn || i.hsn_acs_code, 
                qty, 
                rate, 
                amount, 
                gstRate 
            };
        });

        const totalAmount = Math.round(totalTaxable + totalGST);

        // 2. Update Header
        await client.query(
            `UPDATE invoices SET 
                notes = $1, 
                total_amount = $2, 
                paid_amount = $3,
                status = $4,
                updated_at = NOW() 
             WHERE id = $5 AND company_id = $6`,
            [notes || null, totalAmount, amount_paid || 0, payment_status || 'UNPAID', id, companyId]
        );

        // 3. Adjust Customer Balance for Invoice Amount Change
        if (oldCustId && totalAmount !== oldTotal) {
            const diff = totalAmount - oldTotal;
            await client.query(
                `UPDATE users SET initial_balance = COALESCE(initial_balance, 0) + $1 WHERE id = $2`,
                [diff, oldCustId]
            );

            // Record transaction for adjustment
            await client.query(
                `INSERT INTO transactions 
                 (company_id, user_id, amount, type, category, date, description, related_invoice_id) 
                 VALUES ($1, $2, $3, 'INVOICE', 'ADJUSTMENT', NOW(), $4, $5)`,
                [companyId, oldCustId, diff, `Adjustment for Invoice #${invoiceNumber}`, id]
            );
        }

        // 4. Process New Payments
        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                const pAmt = Number(p.amount) || 0;
                if (pAmt > 0) {
                    const pDate = p.payment_date || new Date();
                    
                    // Insert Payment Record
                    await client.query(
                        `INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, reference_no)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, pAmt, p.payment_method || 'CASH', pDate, p.reference_no || null]
                    );

                    // RECORD TRANSACTION FOR PAYMENT (RECEIPT)
                    if (oldCustId) {
                        await client.query(
                            `INSERT INTO transactions 
                             (company_id, user_id, amount, type, category, date, description, related_invoice_id) 
                             VALUES ($1, $2, $3, 'RECEIPT', 'PAYMENT', $4, $5, $6)`,
                            [
                                Number(companyId), 
                                Number(oldCustId), 
                                pAmt, 
                                pDate, 
                                `Payment for Invoice #${invoiceNumber}`, 
                                Number(id)
                            ]
                        );

                        // Subtract from customer balance
                        await client.query(
                            `UPDATE users SET initial_balance = COALESCE(initial_balance, 0) - $1 WHERE id = $2`,
                            [pAmt, Number(oldCustId)]
                        );
                    }
                }
            }
        }

        // 5. Sync Line Items
        await client.query("DELETE FROM invoice_line_items WHERE invoice_id = $1", [id]);

        for (const item of processedItems) {
            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, description, hsn_acs_code, quantity, 
                    unit_price, taxable_value, line_total, gst_rate
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, item.description, item.hsn, item.qty, item.rate, item.amount, item.amount, item.gstRate]
            );
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Invoice updated successfully" });

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

        // 1. Fetch info before deletion
        const inv = await client.query(`SELECT total_amount, paid_amount, customer_id FROM invoices WHERE id = $1 AND company_id = $2`, [id, companyId]);
        if (inv.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Invoice not found" });
        }

        const { total_amount, paid_amount, customer_id } = inv.rows[0];
        const outstanding = Number(total_amount || 0) - Number(paid_amount || 0);

        // 2. Adjust Balance (Subtract the remaining debt of this invoice)
        if (customer_id && outstanding !== 0) {
            await client.query(
                `UPDATE users SET initial_balance = COALESCE(initial_balance, 0) - $1 WHERE id = $2`,
                [outstanding, customer_id]
            );
        }

        // 3. Delete everything related
        await client.query(`DELETE FROM transactions WHERE related_invoice_id = $1`, [id]);
        await client.query(`DELETE FROM invoice_payments WHERE invoice_id = $1`, [id]);
        await client.query(`DELETE FROM invoice_line_items WHERE invoice_id = $1`, [id]);
        await client.query(`DELETE FROM invoices WHERE id = $1`, [id]);

        await client.query("COMMIT");
        res.json({ message: "Invoice and related data deleted successfully" });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Delete Invoice Error:", err.message);
        res.status(500).json({ error: "Delete failed" });
    } finally {
        if (client) client.release();
    }
});

export default router;