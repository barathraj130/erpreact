// backend/services/salesService.js
import * as db from "../database/pg.js";
import { logAction } from "./auditLogService.js";
import { deductStockOnSale } from "./inventoryService.js";

/**
 * Create sales quotation
 */
export const createQuotation = async (companyId, quotationData, userId) => {
    const {
        customer_id,
        quote_date,
        valid_until,
        line_items, // [{product_id, quantity, unit_price, tax_rate}]
        notes = null,
        terms_conditions = null
    } = quotationData;

    try {
        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;

        for (const item of line_items) {
            const itemAmount = item.quantity * item.unit_price;
            const itemTax = itemAmount * (item.tax_rate || 0) / 100;
            subtotal += itemAmount;
            totalTax += itemTax;
        }

        const totalAmount = subtotal + totalTax;

        // Create quotation
        const quotation = await db.pgRun(
            `INSERT INTO quotations
             (company_id, customer_id, quote_date, valid_until, subtotal, tax_amount, total_amount, notes, terms_conditions, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT')
             RETURNING id`,
            [companyId, customer_id, quote_date, valid_until, subtotal, totalTax, totalAmount, notes, terms_conditions]
        );

        // Create line items
        for (const item of line_items) {
            await db.pgRun(
                `INSERT INTO quotation_line_items
                 (quotation_id, product_id, quantity, unit_price, tax_rate, line_amount)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [quotation.id, item.product_id, item.quantity, item.unit_price, item.tax_rate || 0, item.quantity * item.unit_price]
            );
        }

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "SALES",
            action: "CREATE_QUOTATION",
            resource_type: "quotation",
            resource_id: quotation.id,
            new_data: quotationData,
            status: "success"
        });

        return { id: quotation.id, subtotal, tax_amount: totalTax, total_amount: totalAmount };
    } catch (err) {
        console.error("❌ Create quotation error:", err);
        throw err;
    }
};

/**
 * Convert quotation to invoice
 */
export const quotationToInvoice = async (quotationId, invoiceData, userId) => {
    const { invoice_date, due_date, terms_conditions } = invoiceData;

    try {
        // Get quotation details
        const quotation = await db.pgGet(
            `SELECT * FROM quotations WHERE id = $1`,
            [quotationId]
        );

        if (!quotation) throw new Error("Quotation not found");

        // Get line items
        const lineItems = await db.pgAll(
            `SELECT * FROM quotation_line_items WHERE quotation_id = $1`,
            [quotationId]
        );

        // Create invoice
        const invoice = await db.pgRun(
            `INSERT INTO invoices
             (company_id, customer_id, invoice_date, due_date, subtotal, tax_amount, total_amount, terms_conditions, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT')
             RETURNING id`,
            [
                quotation.company_id,
                quotation.customer_id,
                invoice_date,
                due_date,
                quotation.subtotal,
                quotation.tax_amount,
                quotation.total_amount,
                terms_conditions
            ]
        );

        // Copy line items to invoice
        for (const item of lineItems) {
            await db.pgRun(
                `INSERT INTO invoice_line_items
                 (invoice_id, product_id, quantity, unit_price, tax_rate, line_amount)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [invoice.id, item.product_id, item.quantity, item.unit_price, item.tax_rate, item.line_amount]
            );
        }

        // Update quotation status
        await db.pgRun("UPDATE quotations SET status = 'CONVERTED' WHERE id = $1", [quotationId]);

        await logAction({
            user_id: userId,
            company_id: quotation.company_id,
            module: "SALES",
            action: "CREATE_INVOICE",
            resource_type: "invoice",
            resource_id: invoice.id,
            new_data: { quotation_id: quotationId },
            status: "success"
        });

        return { invoice_id: invoice.id, quotation_id: quotationId };
    } catch (err) {
        console.error("❌ Quotation to invoice error:", err);
        throw err;
    }
};

/**
 * Create sales invoice
 */
export const createInvoice = async (companyId, invoiceData, userId) => {
    const {
        customer_id,
        invoice_date,
        due_date,
        line_items,
        notes = null,
        terms_conditions = null
    } = invoiceData;

    try {
        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;

        for (const item of line_items) {
            const itemAmount = item.quantity * item.unit_price;
            const itemTax = itemAmount * (item.tax_rate || 0) / 100;
            subtotal += itemAmount;
            totalTax += itemTax;
        }

        const totalAmount = subtotal + totalTax;

        // Generate invoice number
        const lastInvoice = await db.pgGet(
            `SELECT invoice_number FROM invoices WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [companyId]
        );

        const invoiceNumber = lastInvoice ? lastInvoice.invoice_number + 1 : 1001;

        // Create invoice
        const invoice = await db.pgRun(
            `INSERT INTO invoices
             (company_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, notes, terms_conditions, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT')
             RETURNING id`,
            [companyId, customer_id, invoiceNumber, invoice_date, due_date, subtotal, totalTax, totalAmount, notes, terms_conditions]
        );

        // Create line items
        for (const item of line_items) {
            await db.pgRun(
                `INSERT INTO invoice_line_items
                 (invoice_id, product_id, quantity, unit_price, tax_rate, line_amount)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [invoice.id, item.product_id, item.quantity, item.unit_price, item.tax_rate || 0, item.quantity * item.unit_price]
            );
        }

        // Deduct stock
        await deductStockOnSale(companyId, invoice.id, line_items, userId);

        // Create customer ledger entry
        await db.pgRun(
            `INSERT INTO customer_ledger (customer_id, invoice_id, amount, type, transaction_date)
             VALUES ($1, $2, $3, 'INVOICE', $4)`,
            [customer_id, invoice.id, totalAmount, invoice_date]
        );

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "SALES",
            action: "CREATE_INVOICE",
            resource_type: "invoice",
            resource_id: invoice.id,
            new_data: invoiceData,
            status: "success"
        });

        return { invoice_id: invoice.id, invoice_number: invoiceNumber, total_amount: totalAmount };
    } catch (err) {
        console.error("❌ Create invoice error:", err);
        throw err;
    }
};

/**
 * Record payment against invoice
 */
export const recordInvoicePayment = async (companyId, paymentData, userId) => {
    const {
        invoice_id,
        amount_paid,
        payment_date,
        payment_method,
        reference_no = null
    } = paymentData;

    try {
        // Get invoice
        const invoice = await db.pgGet("SELECT total_amount FROM invoices WHERE id = $1", [invoice_id]);

        if (!invoice) throw new Error("Invoice not found");

        // Create payment record
        const payment = await db.pgRun(
            `INSERT INTO invoice_payments (invoice_id, amount_paid, payment_date, payment_method, reference_no, status)
             VALUES ($1, $2, $3, $4, $5, 'COMPLETED')
             RETURNING id`,
            [invoice_id, amount_paid, payment_date, payment_method, reference_no]
        );

        // Update customer ledger
        await db.pgRun(
            `INSERT INTO customer_ledger (invoice_id, amount, type, transaction_date)
             VALUES ($1, -$2, 'PAYMENT', $3)`,
            [invoice_id, amount_paid, payment_date]
        );

        // Check if invoice fully paid
        const totalPaid = await db.pgGet(
            `SELECT COALESCE(SUM(amount_paid), 0) as total FROM invoice_payments WHERE invoice_id = $1`,
            [invoice_id]
        );

        const status = totalPaid.total >= invoice.total_amount ? "PAID" : "PARTIAL";
        await db.pgRun("UPDATE invoices SET status = $1 WHERE id = $2", [status, invoice_id]);

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "SALES",
            action: "RECORD_PAYMENT",
            resource_type: "invoice_payment",
            resource_id: payment.id,
            new_data: paymentData,
            status: "success"
        });

        return { payment_id: payment.id, invoice_status: status };
    } catch (err) {
        console.error("❌ Record payment error:", err);
        throw err;
    }
};

/**
 * Get sales summary
 */
export const getSalesSummary = async (companyId, startDate, endDate) => {
    try {
        const invoices = await db.pgAll(
            `SELECT 
                DATE(invoice_date) as date,
                COUNT(*) as invoice_count,
                SUM(total_amount) as total_sales
             FROM invoices
             WHERE company_id = $1 AND invoice_date BETWEEN $2 AND $3
             GROUP BY DATE(invoice_date)
             ORDER BY date DESC`,
            [companyId, startDate, endDate]
        );

        const outstanding = await db.pgGet(
            `SELECT 
                COUNT(*) as count,
                COALESCE(SUM(total_amount - COALESCE(
                    (SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = i.id), 0
                )), 0) as amount
             FROM invoices i
             WHERE company_id = $1 AND status IN ('DRAFT', 'PARTIAL', 'SENT')`,
            [companyId]
        );

        return {
            daily_sales: invoices,
            outstanding_invoices: outstanding
        };
    } catch (err) {
        console.error("❌ Get sales summary error:", err);
        return { daily_sales: [], outstanding_invoices: {} };
    }
};

export default {
    createQuotation,
    quotationToInvoice,
    createInvoice,
    recordInvoicePayment,
    getSalesSummary
};
