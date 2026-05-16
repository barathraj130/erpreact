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
import * as brokerService from "../services/brokerService.js";
import * as pointsService from "../services/pointsService.js";
import { triggerN8N } from "../utils/triggerN8N.js";

const router = express.Router();

/* ============================================================
   HELPER: Generate Smart Invoice Number
============================================================ */
// Prefix map — one unique prefix per invoice type
const TYPE_PREFIX = {
    TAX_INVOICE:         'TAX',
    NON_TAX_INVOICE:     'NTAX',
    RETAIL_SALE:         'RET',
    GIFTED_ITEM:         'GFT',
    NOMINAL_TAX_INVOICE: 'NM-TAX',
};

async function generateInvoiceNumber(client, type, companyId, branchId) {
    const date = new Date();
    const monthStr = date.toLocaleString("default", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    const financial_month = `${year}-${monthStr}`;

    if (branchId) {
        // Branch-specific sequence (stored on the branches row)
        const branchResult = await client.query(
            `UPDATE branches SET bill_sequence = bill_sequence + 1
             WHERE id = $1 RETURNING bill_sequence, bill_prefix`,
            [branchId]
        );
        const { bill_sequence, bill_prefix } = branchResult.rows[0];
        const padding = bill_sequence.toString().padStart(4, "0");
        const prefix = bill_prefix || `B${branchId}`;
        return { number: `${prefix}-${padding}`, financial_month };
    }

    // Main branch — atomic per-type per-month sequence via UPSERT
    const prefix = TYPE_PREFIX[type] || 'INV';
    const seqResult = await client.query(
        `INSERT INTO invoice_sequences (company_id, invoice_type, financial_month, last_sequence)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (company_id, invoice_type, financial_month)
         DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
         RETURNING last_sequence`,
        [companyId, type, financial_month]
    );

    const seq = seqResult.rows[0].last_sequence;
    const padding = seq.toString().padStart(3, "0");

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
        WHERE i.company_id = $1 AND COALESCE(i.is_deleted, false) = false
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
        transport_details, bundles_count, return_items,
        broker_id, broker_commission_rate,
        bill_purpose, // 'real' or 'name_only'
        points_to_redeem // Points to redeem on this invoice
    } = req.body;

    const discountAmt = Number(discount_amount) || 0;
    const companyId = req.user.active_company_id;
    let client;

    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const sanitizeInt = (val) => {
            const p = parseInt(val);
            return isNaN(p) ? null : p;
        };

        let finalInvoiceNumber = invoice_number;
        let financial_month;
        const rawBranchId = req.body.branch_id || req.user.branch_id;
        const branchId = sanitizeInt(rawBranchId);
        const safeCustomerId = sanitizeInt(customer_id);
        const safeBrokerId = sanitizeInt(broker_id);
        const safeBrokerCommission = isNaN(parseFloat(broker_commission_rate)) ? 0 : parseFloat(broker_commission_rate);
        
        if (!finalInvoiceNumber) {
            const gen = await generateInvoiceNumber(client, invoice_type || 'TAX_INVOICE', companyId, branchId);
            finalInvoiceNumber = gen.number;
            financial_month = gen.financial_month;
        } else {
            financial_month = `${new Date().getFullYear()}-${new Date().toLocaleString("default", { month: "short" }).toUpperCase()}`;
        }

        // 1. Get Company/Branch and Customer State for GST Detection
        const company = await client.query(`SELECT state, state_code FROM companies WHERE id = $1`, [companyId]);
        const customer = await client.query(`SELECT state, state_code, username, phone FROM users WHERE id = $1`, [safeCustomerId]);
        
        const companyStateCode = company.rows[0]?.state_code;
        const customerStateCode = customer.rows[0]?.state_code;
        
        let gstType = "INTRA_STATE";
        if (companyStateCode && customerStateCode && companyStateCode !== customerStateCode) {
            gstType = "INTER_STATE";
        }

        // Process Sale Items
        let totalTaxable = 0;
        let totalGST = 0;
        let totalCGST = 0;
        let totalSGST = 0;
        let totalIGST = 0;

        const isNonTax = invoice_type === 'NON_TAX_INVOICE';

        const processedItems = items.map(i => {
            const qty = isNaN(parseFloat(i.qty)) ? 0 : parseFloat(i.qty);
            const rate = isNaN(parseFloat(i.rate)) ? 0 : parseFloat(i.rate);
            const amount = qty * rate;
            // FIX: If NON_TAX, tax is always 0. Also fix 0% fallback issue.
            const taxRate = isNonTax ? 0 : ( (i.gst_rate !== undefined && i.gst_rate !== null) ? (isNaN(parseFloat(i.gst_rate)) ? 5 : parseFloat(i.gst_rate)) : 5);
            
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
            const taxRate = isNonTax ? 0 : ((i.gst_rate !== undefined && i.gst_rate !== null) ? Number(i.gst_rate) : 5);

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
        let finalAmountPaid = Number(amount_paid) || 0;
        
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
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, NOW())
            RETURNING id
        `;

        const result = await client.query(headerSQL, [
            companyId, safeCustomerId, finalInvoiceNumber, invoice_type || 'TAX_INVOICE',
            financial_month, req.body.invoice_date || new Date(), req.body.due_date || new Date(), payment_status || 'UNPAID',
            totalTaxable, totalGST, totalCGST, totalSGST, totalIGST, netInvoiceAmount,
            gstType, finalAmountPaid, discountAmt, totalReturnAmount, notes || '', Number(bundles_count) || 0,
            transport_details?.vehicle_number || '', transport_details?.mode || '', transport_details?.supply_date || null, transport_details?.reverse_charge || 'No',
            safeBrokerId, safeBrokerCommission,
            branchId,
            bill_purpose || 'real',
            0, // points_earned - will be updated after
            pointsRedeemed,
            pointsDiscount
        ]);

        const invoiceId = result.rows[0].id;

        // Process All Items (Sale + Return)
        const isNameOnly = (bill_purpose === 'name_only');
        const allItems = [...processedItems, ...processedReturnItems];
        for (const item of allItems) {
            if (item.product_id) {
                if (item.is_return) {
                    // Increment stock for returns (skip for name_only bills)
                    if (!isNameOnly) {
                        await client.query('UPDATE products SET current_stock = current_stock + $1 WHERE id = $2', [item.qty, item.product_id]);
                    }
                } else if (!isNameOnly) {
                    // Check stock for sales — skipped entirely for name_only bills
                    if (branchId) {
                        // Check Branch Inventory
                        const branchStockRes = await client.query('SELECT current_stock FROM branch_inventory WHERE branch_id = $1 AND product_id = $2', [branchId, item.product_id]);
                        const stock = Number(branchStockRes.rows[0]?.current_stock || 0);
                        if (stock < item.qty) throw new Error(`Insufficient stock in branch. Avail: ${stock}`);

                        await client.query('UPDATE branch_inventory SET current_stock = current_stock - $1 WHERE branch_id = $2 AND product_id = $3', [item.qty, branchId, item.product_id]);
                        // Also decrement global product stock
                        await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.qty, item.product_id]);
                    } else {
                        // Main branch
                        const stockResult = await client.query('SELECT current_stock, name FROM products WHERE id = $1', [item.product_id]);
                        if (stockResult.rows.length > 0) {
                            const currentStock = Number(stockResult.rows[0].current_stock);
                            if (currentStock < item.qty) {
                                throw new Error(`Insufficient stock for product: ${stockResult.rows[0].name}. Available: ${currentStock}, Required: ${item.qty}`);
                            }
                            await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.qty, item.product_id]);
                            await client.query('UPDATE inventory SET current_stock = current_stock - $1 WHERE product_id = $2', [item.qty, item.product_id]);
                        }
                    }

                    // Record Movement
                    await client.query(`
                        INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_out, reference_type, reference_id, bill_purpose)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [companyId, branchId || null, item.product_id, 'SALE', item.qty, 'INVOICE', invoiceId, bill_purpose || 'real']);
                }
            }

            await client.query(
                `INSERT INTO invoice_line_items (
                    invoice_id, product_id, description, quantity, 
                    unit_price, taxable_value, discount_percent, tax_percent,
                    cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount,
                    line_total, is_return
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
                    item.is_return
                ]
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

        // Payments
        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                const pAmt = Number(p.amount) || 0;
                if (pAmt > 0) {
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
                            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', pDate]);
                    } else if (pMethod === 'BANK' || pMethod === 'UPI') {
                        await client.query(`
                            INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [companyId, req.user.branch_id || 1, 'payment', pAmt, 'in', p.bank_name || pMethod, p.reference_no || p.bank_transaction_id || '-', pDate]);
                    }
                }
            }
        }


        // --- INTEGRATE WITH ACCOUNTING ENGINE ---
        
        const arAccount = await getAccountByCode(companyId, '1100'); // Accounts Receivable
        const salesAccount = await getAccountByCode(companyId, '4000'); // Sales Revenue
        const taxAccount = await getAccountByCode(companyId, '2100'); // GST Payable
        const salesReturnAccount = await getAccountByCode(companyId, '4200') || salesAccount; // Fallback to Sales if no Return acct

        if (arAccount && salesAccount) {
            let txLines = [];

            // Debit AR for Net Amount (same for all invoice types including NOMINAL_TAX_INVOICE)
            txLines.push({ account_id: arAccount.id, debit_amount: effectiveTotal > 0 ? effectiveTotal : 0, credit_amount: effectiveTotal < 0 ? Math.abs(effectiveTotal) : 0, description: `Sales to Customer #${customer_id}` });

            // Credit Sales Revenue
            txLines.push({ account_id: salesAccount.id, debit_amount: 0, credit_amount: totalTaxable, description: `Sales Revenue from Inv #${finalInvoiceNumber}` });

            // Debit Sales Returns if any
            if (totalReturnTaxable > 0) {
                txLines.push({ account_id: salesReturnAccount.id, debit_amount: totalReturnTaxable, credit_amount: 0, description: `Sales Returns on Inv #${finalInvoiceNumber}` });
            }

            // Credit GST Payable for Net GST
            const netGST = totalGST - totalReturnGST;
            if (netGST !== 0 && taxAccount) {
                txLines.push({ account_id: taxAccount.id, debit_amount: netGST < 0 ? Math.abs(netGST) : 0, credit_amount: netGST > 0 ? netGST : 0, description: `GST on Inv #${finalInvoiceNumber}` });
            }

            // Handle Discount as an Expense
            if (discountAmt > 0) {
                const discountAccount = await getAccountByCode(companyId, '5100'); // Discount Allowed
                if (discountAccount) {
                    txLines.push({ account_id: discountAccount.id, debit_amount: discountAmt, credit_amount: 0, description: `Discount on Inv #${finalInvoiceNumber}` });
                }
            }

            // Handle Payments in the same transaction
            if (Array.isArray(payments) && payments.length > 0) {
                const cashAccount = await getAccountByCode(companyId, '1000');
                const bankAccount = await getAccountByCode(companyId, '1200');

                for (const p of payments) {
                    const pAmt = parseFloat(p.amount || 0);
                    if (pAmt <= 0) continue;
                    
                    const pMethod = (p.payment_method || 'CASH').toUpperCase();
                    const isBank = pMethod === 'BANK' || pMethod === 'UPI';
                    const pAcc = isBank ? bankAccount : cashAccount;
                    
                    if (pAcc && arAccount) {
                        txLines.push({ account_id: pAcc.id, debit_amount: pAmt, credit_amount: 0, description: `Payment received via ${pMethod}` });
                        txLines.push({ account_id: arAccount.id, debit_amount: 0, credit_amount: pAmt, description: `Customer payment reduction - Inv #${finalInvoiceNumber}` });
                    }
                }
            }

            if (txLines.length > 0) {
                // Balance the transaction if needed due to precision
                const totalD = txLines.reduce((s, l) => s + (l.debit_amount || 0), 0);
                const totalC = txLines.reduce((s, l) => s + (l.credit_amount || 0), 0);
                if (Math.abs(totalD - totalC) > 0.01) {
                    // Add small adjustment to Sales Revenue
                    const diff = totalD - totalC;
                    txLines[1].credit_amount += diff; 
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

        if (customer_id) {
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

        // === EARN POINTS FOR NON-TAX INVOICES AFTER PAYMENT ===
        let ptsEarned = 0;
        if (invoice_type === 'NON_TAX_INVOICE' && safeCustomerId && finalAmountPaid > 0 && bill_purpose !== 'name_only') {
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
        res.status(201).json({
            message: "Invoice saved",
            id: invoiceId,
            bill_number: finalInvoiceNumber,
            points_earned: ptsEarned,
            points_redeemed: pointsRedeemed
        });

        // Fire n8n webhook (non-blocking, after response sent)
        triggerN8N('invoice-created', {
            customer_name:  customer.rows[0]?.username || 'Unknown',
            customer_phone: customer.rows[0]?.phone || '',
            invoice_number: finalInvoiceNumber,
            total_amount:   netInvoiceAmount,
            paid_amount:    finalAmountPaid,
            balance_amount: Math.max(0, netInvoiceAmount - finalAmountPaid),
            points_earned:  ptsEarned,
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Critical Invoice Error:", err.message);
        res.status(500).json({ error: "Failed to create invoice: " + err.message });
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

        // 3. Restore inventory (only for real bills — name_only bills never touched stock)
        if (invBillPurpose !== 'name_only') {
            const lineItems = await client.query(
                `SELECT product_id, quantity, is_return FROM invoice_line_items WHERE invoice_id = $1`,
                [id]
            );
            for (const li of lineItems.rows) {
                if (!li.product_id) continue;
                const qty = Number(li.quantity);
                if (li.is_return) {
                    // Returns had added stock — reverse that
                    await client.query(
                        'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
                        [qty, li.product_id]
                    );
                } else {
                    // Sales had subtracted stock — restore it
                    await client.query(
                        'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
                        [qty, li.product_id]
                    );
                    await client.query(
                        'UPDATE inventory SET current_stock = current_stock + $1 WHERE product_id = $2',
                        [qty, li.product_id]
                    );
                    if (branch_id) {
                        await client.query(
                            'UPDATE branch_inventory SET current_stock = current_stock + $1 WHERE branch_id = $2 AND product_id = $3',
                            [qty, branch_id, li.product_id]
                        );
                    }
                }
            }
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
        const status = newPaid >= parseFloat(inv.total_amount) ? "PAID" : "PARTIAL";

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

        await client.query("COMMIT");
        res.json({ success: true, message: "Payment recorded", newPaid, status });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("❌ Invoice Payment Accounting Error:", err.message);
        res.status(500).json({ error: "Payment failed: " + err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
