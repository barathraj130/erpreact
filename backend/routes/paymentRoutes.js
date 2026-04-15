// backend/routes/paymentRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import { checkAccess } from "../middlewares/checkAccess.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import {
    createCustomerLedgerEvent,
    deleteCustomerLedgerEvents,
    recomputeCustomerBalance,
} from "../services/customerLedgerService.js";

const router = express.Router();

/* ============================================================
   1. GET ALL PAYMENTS (with filters)
============================================================ */
router.get("/", authMiddleware, checkAccess('Sales', 'view_invoices'), async (req, res) => {
    const companyId = req.user.active_company_id;
    const { invoice_id, customer_id, start_date, end_date, payment_method } = req.query;

    let sql = `
        SELECT p.*, 
               i.invoice_number,
               i.invoice_category as invoice_type,
               u.username as customer_name
        FROM invoice_payments p
        LEFT JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN users u ON i.customer_id = u.id
        WHERE i.company_id = $1
    `;
    const params = [companyId];
    let paramIndex = 2;

    if (invoice_id) {
        sql += ` AND p.invoice_id = $${paramIndex++}`;
        params.push(invoice_id);
    }

    if (customer_id) {
        sql += ` AND i.customer_id = $${paramIndex++}`;
        params.push(customer_id);
    }

    if (start_date) {
        sql += ` AND p.payment_date >= $${paramIndex++}`;
        params.push(start_date);
    }

    if (end_date) {
        sql += ` AND p.payment_date <= $${paramIndex++}`;
        params.push(end_date);
    }

    if (payment_method) {
        sql += ` AND p.payment_method = $${paramIndex++}`;
        params.push(payment_method);
    }

    sql += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

    try {
        const rows = await db.pgAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("Payment list error:", err);
        res.status(500).json({ error: "Failed to fetch payments" });
    }
});

/* ============================================================
   2. GET PAYMENTS FOR SPECIFIC INVOICE
============================================================ */
router.get("/invoice/:invoiceId", authMiddleware, checkAccess('Sales', 'view_invoices'), async (req, res) => {
    const { invoiceId } = req.params;
    const companyId = req.user.active_company_id;

    try {
        const invoice = await db.pgGet(
            `SELECT i.*, u.username as customer_name 
             FROM invoices i 
             LEFT JOIN users u ON i.customer_id = u.id
             WHERE i.id = $1 AND i.company_id = $2`,
            [invoiceId, companyId]
        );

        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        const payments = await db.pgAll(
            `SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date ASC`,
            [invoiceId]
        );

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const invoiceTotal = Number(invoice.total_amount) || 0;

        res.json({
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            invoice_total: invoiceTotal,
            total_paid: totalPaid,
            balance_due: invoiceTotal - totalPaid,
            payment_count: payments.length,
            payments: payments,
            status: totalPaid >= invoiceTotal ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
        });

    } catch (err) {
        console.error("Get invoice payments error:", err);
        res.status(500).json({ error: "Failed to fetch invoice payments" });
    }
});

/* ============================================================
   3. CREATE PAYMENT
============================================================ */
router.post("/", authMiddleware, checkAccess('Sales', 'create_invoices'), async (req, res) => {
    const {
        invoice_id,
        amount,
        payment_date,
        payment_method,
        reference_no,
        notes,
        bank_name,
        bank_transaction_id,
        bank_timestamp,
    } = req.body;

    const companyId = req.user.active_company_id;
    const userId = req.user.id;

    let client;

    try {
        client = await db.pool.connect();
        await client.query("BEGIN");

        const invoiceResult = await client.query(
            `SELECT * FROM invoices WHERE id = $1 AND company_id = $2`,
            [invoice_id, companyId]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        const invoice = invoiceResult.rows[0];
        const invoiceTotal = Number(invoice.total_amount) || 0;

        const paidResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) as total_paid FROM invoice_payments WHERE invoice_id = $1`,
            [invoice_id]
        );
        const currentPaid = Number(paidResult.rows[0].total_paid);
        const balanceDue = invoiceTotal - currentPaid;

        if (amount <= 0) {
            return res.status(400).json({ error: "Payment amount must be greater than 0" });
        }

        if (amount > balanceDue + 0.01) {
            return res.status(400).json({ 
                error: `Payment amount (${amount}) exceeds balance due (${balanceDue.toFixed(2)})` 
            });
        }

        const insertResult = await client.query(
            `INSERT INTO invoice_payments (
                invoice_id, amount, payment_date, payment_method, 
                reference_no, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *`,
            [
                invoice_id,
                amount,
                payment_date || new Date().toISOString().split('T')[0],
                payment_method || 'CASH',
                reference_no || null,
                notes || null
            ]
        );

        const newPayment = insertResult.rows[0];

        const newTotalPaid = currentPaid + Number(amount);
        let newStatus = 'UNPAID';
        
        if (newTotalPaid >= invoiceTotal) {
            newStatus = 'PAID';
        } else if (newTotalPaid > 0) {
            newStatus = 'PARTIAL';
        }

        await client.query(
            `UPDATE invoices 
             SET amount_paid = $1, 
                 balance_due = $2,
                 status = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [newTotalPaid, invoiceTotal - newTotalPaid, newStatus, invoice_id]
        );

        await createCustomerLedgerEvent(client, {
            companyId,
            branchId: req.user.branch_id || 1,
            customerId: invoice.customer_id,
            type: "RECEIPT",
            category: "PAYMENT",
            amount: Number(amount),
            date: payment_date || new Date().toISOString().split('T')[0],
            description: `Payment received for Invoice #${invoice.invoice_number}`,
            relatedInvoiceId: invoice_id,
            referenceType: "PAYMENT",
            referenceId: newPayment.id,
            createdBy: req.user.id,
            meta: {
                payment_method: payment_method || "CASH",
                reference_no: reference_no || null,
                bank_name: payment_method === "BANK" ? (bank_name || "Customer Bank") : null,
                bank_transaction_id: payment_method === "BANK" ? (bank_transaction_id || reference_no || `BNK-${Date.now()}`) : null,
                bank_timestamp: payment_method === "BANK" ? (bank_timestamp || new Date().toISOString()) : null,
            },
        });

        await recomputeCustomerBalance(client, invoice.customer_id, companyId);

        await client.query("COMMIT");

        res.status(201).json({
            message: "Payment recorded successfully",
            payment: newPayment,
            invoice_status: newStatus,
            new_balance_due: invoiceTotal - newTotalPaid
        });

    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Create payment error:", err);
        res.status(500).json({ error: "Failed to record payment" });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   4. UPDATE PAYMENT
============================================================ */
router.put("/:id", authMiddleware, checkAccess('Sales', 'edit_invoices'), async (req, res) => {
    const { id } = req.params;
    const { amount, payment_date, payment_method, reference_no, notes, bank_name, bank_transaction_id, bank_timestamp } = req.body;
    const companyId = req.user.active_company_id;

    let client;

    try {
        client = await db.pool.connect();
        await client.query("BEGIN");

        const paymentResult = await client.query(
            `SELECT p.*, i.company_id, i.customer_id, i.invoice_number, i.total_amount as invoice_total
             FROM invoice_payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE p.id = $1 AND i.company_id = $2`,
            [id, companyId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ error: "Payment not found" });
        }

        const existingPayment = paymentResult.rows[0];
        const oldAmt = Number(existingPayment.amount);
        const newAmt = Number(amount || oldAmt);
        const amountDiff = newAmt - oldAmt;
        const customerId = existingPayment.customer_id;
        const invoiceId = existingPayment.invoice_id;

        await client.query(
            `UPDATE invoice_payments 
             SET amount = COALESCE($1, amount),
                 payment_date = COALESCE($2, payment_date),
                 payment_method = COALESCE($3, payment_method),
                 reference_no = COALESCE($4, reference_no),
                 notes = COALESCE($5, notes)
             WHERE id = $6`,
            [amount, payment_date, payment_method, reference_no, notes, id]
        );

        if (customerId) {
            await client.query(
                `UPDATE transactions 
                 SET amount = $1,
                     date = $2,
                     transaction_date = $2,
                     description = $3,
                     meta = $4
                 WHERE user_id = $5 AND reference_type = 'PAYMENT' AND reference_id = $6`,
                [
                    newAmt,
                    payment_date || existingPayment.payment_date,
                    `Payment received for Invoice #${existingPayment.invoice_number}`,
                    JSON.stringify({
                        payment_method: payment_method || existingPayment.payment_method || "CASH",
                        reference_no: reference_no || existingPayment.reference_no || null,
                        bank_name: (payment_method || existingPayment.payment_method) === "BANK" ? (bank_name || "Customer Bank") : null,
                        bank_transaction_id: (payment_method || existingPayment.payment_method) === "BANK"
                            ? (bank_transaction_id || reference_no || existingPayment.reference_no || `BNK-${Date.now()}`)
                            : null,
                        bank_timestamp: (payment_method || existingPayment.payment_method) === "BANK"
                            ? (bank_timestamp || new Date().toISOString())
                            : null,
                    }),
                    customerId,
                    id,
                ]
            );
            await recomputeCustomerBalance(client, customerId, companyId);
        }

        if (amountDiff !== 0) {
            const invoiceTotal = Number(existingPayment.invoice_total);
            const paidResult = await client.query(
                `SELECT COALESCE(SUM(amount), 0) as total_paid FROM invoice_payments WHERE invoice_id = $1`,
                [invoiceId]
            );
            const newTotalPaid = Number(paidResult.rows[0].total_paid);

            let newStatus = 'UNPAID';
            if (newTotalPaid >= invoiceTotal) {
                newStatus = 'PAID';
            } else if (newTotalPaid > 0) {
                newStatus = 'PARTIAL';
            }

            await client.query(
                `UPDATE invoices 
                 SET amount_paid = $1, 
                     balance_due = $2,
                     status = $3,
                     updated_at = NOW()
                 WHERE id = $4`,
                [newTotalPaid, invoiceTotal - newTotalPaid, newStatus, invoiceId]
            );
        }

        await client.query("COMMIT");

        const updatedPayment = await db.pgGet(
            `SELECT * FROM invoice_payments WHERE id = $1`,
            [id]
        );

        res.json({
            message: "Payment updated successfully",
            payment: updatedPayment
        });

    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Update payment error:", err);
        res.status(500).json({ error: "Failed to update payment" });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   5. DELETE PAYMENT
============================================================ */
router.delete("/:id", authMiddleware, checkAccess('Sales', 'delete_invoices'), async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    let client;

    try {
        client = await db.pool.connect();
        await client.query("BEGIN");

        const paymentResult = await client.query(
            `SELECT p.*, i.company_id, i.customer_id, i.total_amount as invoice_total, i.invoice_number
             FROM invoice_payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE p.id = $1 AND i.company_id = $2`,
            [id, companyId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ error: "Payment not found" });
        }

        const payment = paymentResult.rows[0];
        const invoiceId = payment.invoice_id;
        const invoiceTotal = Number(payment.invoice_total);
        const customerId = payment.customer_id;
        const amount = Number(payment.amount);

        await client.query(`DELETE FROM invoice_payments WHERE id = $1`, [id]);

        if (customerId) {
            await deleteCustomerLedgerEvents(client, {
                companyId,
                customerId,
                type: "RECEIPT",
                referenceId: Number(id),
            });
            await recomputeCustomerBalance(client, customerId, companyId);
        }

        const paidResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) as total_paid FROM invoice_payments WHERE invoice_id = $1`,
            [invoiceId]
        );
        const newTotalPaid = Number(paidResult.rows[0].total_paid);

        let newStatus = 'UNPAID';
        if (newTotalPaid >= invoiceTotal) {
            newStatus = 'PAID';
        } else if (newTotalPaid > 0) {
            newStatus = 'PARTIAL';
        }

        await client.query(
            `UPDATE invoices 
             SET amount_paid = $1, 
                 balance_due = $2,
                 status = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [newTotalPaid, invoiceTotal - newTotalPaid, newStatus, invoiceId]
        );

        await client.query("COMMIT");

        res.json({ 
            message: "Payment deleted successfully",
            invoice_id: invoiceId,
            new_balance_due: invoiceTotal - newTotalPaid,
            new_status: newStatus
        });

    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Delete payment error:", err);
        res.status(500).json({ error: "Failed to delete payment" });
    } finally {
        if (client) client.release();
    }
});

/* ============================================================
   6. GET PAYMENT SUMMARY (Dashboard)
============================================================ */
router.get("/summary", authMiddleware, checkAccess('Sales', 'view_invoices'), async (req, res) => {
    const companyId = req.user.active_company_id;
    const { start_date, end_date } = req.query;

    try {
        let dateFilter = '';
        const params = [companyId];

        if (start_date && end_date) {
            dateFilter = `AND p.payment_date BETWEEN $2 AND $3`;
            params.push(start_date, end_date);
        }

        const byMethod = await db.pgAll(
            `SELECT p.payment_method, 
                    COUNT(*) as count,
                    SUM(p.amount) as total
             FROM invoice_payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE i.company_id = $1 ${dateFilter}
             GROUP BY p.payment_method
             ORDER BY total DESC`,
            params
        );

        const dailyTotals = await db.pgAll(
            `SELECT DATE(p.payment_date) as date,
                    COUNT(*) as count,
                    SUM(p.amount) as total
             FROM invoice_payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE i.company_id = $1 
               AND p.payment_date >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY DATE(p.payment_date)
             ORDER BY date DESC`,
            [companyId]
        );

        const totals = await db.pgGet(
            `SELECT COUNT(*) as total_payments,
                    COALESCE(SUM(p.amount), 0) as total_received
             FROM invoice_payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE i.company_id = $1 ${dateFilter}`,
            params
        );

        res.json({
            by_method: byMethod,
            daily_totals: dailyTotals,
            totals: totals
        });

    } catch (err) {
        console.error("Payment summary error:", err);
        res.status(500).json({ error: "Failed to fetch payment summary" });
    }
});

export default router;
