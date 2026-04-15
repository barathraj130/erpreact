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
import { createTransaction, getAccountByCode } from "../utils/accountingEngine.js";

const router = express.Router();

/* ============================================================
   HELPER: Generate Smart Invoice Number
============================================================ */
async function generateInvoiceNumber(client, type, companyId) {
    const date = new Date();
    const monthStr = date.toLocaleString("default", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    const financial_month = `${year}-${monthStr}`;
    let prefix = "INV";
    if (type === "TAX_INVOICE") prefix = "TAX";
    else if (type === "NON_TAX_INVOICE") prefix = "NTAX";
    else if (type === "RETAIL_SALE") prefix = "RET";
    else if (type === "GIFTED_ITEM") prefix = "GFT";
    else if (type === "NOMINAL_TAX_INVOICE") prefix = "NM-TAX";

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
        amount_paid, discount_amount, balance_due, payment_status, payments,
        transport_details, bundles_count
    } = req.body;

    const discountAmt = Number(discount_amount) || 0;

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

        let totalAmount = Math.round(totalTaxable + totalGST);
        
        // Handle Nominal Tax (Only pay tax, goods are namesake/discounted)
        if (invoice_type === 'NOMINAL_TAX_INVOICE') {
            totalAmount = Math.round(totalGST);
        }

        // The effective amount customer owes = totalAmount - discount
        const effectiveTotal = Math.max(0, totalAmount - discountAmt);
        const finalAmountPaid = Number(amount_paid) || 0;

        const headerSQL = `
            INSERT INTO invoices (
                company_id, customer_id, invoice_number, invoice_type,
                financial_month, invoice_date, due_date, status, total_amount,
                paid_amount, discount_amount, notes, bundles_count,
                vehicle_number, transportation_mode, date_of_supply, reverse_charge,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            RETURNING id
        `;

        const result = await client.query(headerSQL, [
            companyId,
            customer_id || null,
            finalInvoiceNumber,
            invoice_type || 'TAX_INVOICE',
            financial_month,
            payment_status || 'UNPAID',
            totalAmount,
            finalAmountPaid,
            discountAmt,
            notes || null,
            bundles_count || 0,
            transport_details?.vehicle || null,
            transport_details?.mode || null,
            transport_details?.supply_date || null,
            transport_details?.reverse_charge || 'No'
        ]);

        const invoiceId = result.rows[0].id;

        // Line Items & Stock Deduction
        for (const item of processedItems) {
            if (item.product_id) {
                // Check stock
                const stockResult = await client.query('SELECT current_stock, name FROM products WHERE id = $1', [item.product_id]);
                if (stockResult.rows.length > 0) {
                    const currentStock = Number(stockResult.rows[0].current_stock);
                    if (currentStock < item.qty) {
                        throw new Error(`Insufficient stock for product: ${stockResult.rows[0].name}. Available: ${currentStock}, Required: ${item.qty}`);
                    }
                    // Deduct stock
                    await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.qty, item.product_id]);
                }
            }

            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, product_id, description, quantity, 
                    unit_price, taxable_value, line_total, gst_rate
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [invoiceId, item.product_id || null, item.name || item.desc || item.description || "Item", item.qty, item.rate, item.amount, item.amount, item.gstRate]
            );
        }

        if (customer_id) {
            await ensureCustomerLedgerMetadata(client, Number(customer_id), companyId);
            await createCustomerLedgerEvent(client, {
                companyId,
                branchId: req.user.branch_id || 1,
                customerId: Number(customer_id),
                type: "INVOICE",
                category: "SALES",
                amount: totalAmount,
                date: new Date().toISOString().split("T")[0],
                description: `Invoice #${finalInvoiceNumber}`,
                relatedInvoiceId: invoiceId,
                referenceType: "INVOICE",
                referenceId: invoiceId,
                createdBy: req.user.id,
            });
        }

        // Payments
        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                const pAmt = Number(p.amount) || 0;
                if (pAmt > 0) {
                    const pDate = p.payment_date || new Date();
                    const paymentRecord = await client.query(
                        `INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, reference_no)
                         VALUES ($1, $2, $3, $4, $5)`,
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
                            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', pDate]);
                    } else if (pMethod === 'BANK') {
                        await client.query(`
                            INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', p.bank_name || 'Bank', p.reference_no || p.bank_transaction_id || '-', pDate]);
                    }
                }
            }
        }


        // --- INTEGRATE WITH ACCOUNTING ENGINE ---
        
        const arAccount = await getAccountByCode(companyId, '1100'); // Accounts Receivable
        const salesAccount = await getAccountByCode(companyId, '4000'); // Sales Revenue
        const taxAccount = await getAccountByCode(companyId, '2100'); // GST Payable

        if (arAccount && salesAccount) {
            let txLines = [];
            
            if (invoice_type === 'NOMINAL_TAX_INVOICE') {
                // If it's a nominal tax bill, AR gets debited only for GST, and we only credit Tax payable. 
                // There's no actual sales revenue charged to customer.
                if (totalGST > 0 && taxAccount) {
                    txLines.push({ account_id: arAccount.id, debit_amount: totalAmount, credit_amount: 0, description: `Nominal GST on Inv #${finalInvoiceNumber}` });
                    txLines.push({ account_id: taxAccount.id, debit_amount: 0, credit_amount: totalGST, description: `GST on Inv #${finalInvoiceNumber}` });
                }
            } else {
                txLines.push({ account_id: arAccount.id, debit_amount: totalAmount, credit_amount: 0, description: `Sales to Customer #${customer_id}` });
                txLines.push({ account_id: salesAccount.id, debit_amount: 0, credit_amount: totalTaxable, description: `Sales Revenue from Inv #${finalInvoiceNumber}` });
                
                if (totalGST > 0 && taxAccount) {
                    txLines.push({ account_id: taxAccount.id, debit_amount: 0, credit_amount: totalGST, description: `GST on Inv #${finalInvoiceNumber}` });
                }
            }

            if (txLines.length > 0) {
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
        }

        if (customer_id) {
            await recomputeCustomerBalance(client, Number(customer_id), companyId);
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

        // 3. Replace Invoice Ledger Event
        if (oldCustId) {
            await deleteCustomerLedgerEvents(client, {
                companyId,
                customerId: oldCustId,
                type: "INVOICE",
                relatedInvoiceId: id,
            });
            await createCustomerLedgerEvent(client, {
                companyId,
                branchId: req.user.branch_id || 1,
                customerId: oldCustId,
                type: "INVOICE",
                category: "SALES",
                amount: totalAmount,
                date: new Date().toISOString().split("T")[0],
                description: `Invoice #${invoiceNumber}`,
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

                    if (oldCustId) {
                        await createCustomerLedgerEvent(client, {
                            companyId,
                            branchId: req.user.branch_id || 1,
                            customerId: Number(oldCustId),
                            type: "RECEIPT",
                            category: "PAYMENT",
                            amount: pAmt,
                            date: pDate,
                            description: `Payment for Invoice #${invoiceNumber}`,
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
                            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', pDate]);
                    } else if (pMethod === 'BANK') {
                        await client.query(`
                            INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', p.bank_name || 'Bank', p.reference_no || p.bank_transaction_id || '-', pDate]);
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

        if (oldCustId) {
            await recomputeCustomerBalance(client, oldCustId, companyId);
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

        const { customer_id } = inv.rows[0];

        // 2. Delete everything related
        await client.query(`DELETE FROM transactions WHERE reference_type = 'INVOICE' AND reference_id = $1`, [id]);
        await client.query(`DELETE FROM invoice_payments WHERE invoice_id = $1`, [id]);
        await client.query(`DELETE FROM invoice_line_items WHERE invoice_id = $1`, [id]);
        await client.query(`DELETE FROM invoices WHERE id = $1`, [id]);

        if (customer_id) {
            await recomputeCustomerBalance(client, customer_id, companyId);
        }

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
