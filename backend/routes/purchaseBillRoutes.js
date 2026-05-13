import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as brokerService from "../services/brokerService.js";
import { createTransaction, getAccountByCode } from "../utils/accountingEngine.js";

const router = express.Router();

const sanitizeInt = (val) => {
    const p = parseInt(val);
    return isNaN(p) ? null : p;
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "uploads/purchase_bills/";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `bill_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// ─────────────────────────────────────────────────────────
// GET ALL BILLS
// ─────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { supplier, status, startDate, endDate } = req.query;

    try {
        let sql = `
            SELECT pb.*, s.name as supplier_name, s.gstin
            FROM purchase_bills pb
            JOIN suppliers s ON pb.supplier_id = s.id
            WHERE pb.company_id = $1 AND pb.is_deleted = false
        `;
        const params = [companyId];
        let pIndex = 2;

        if (supplier) {
            sql += ` AND (pb.supplier_name ILIKE $${pIndex} OR pb.supplier_id::text = $${pIndex})`;
            params.push(`%${supplier}%`);
            pIndex++;
        }
        if (status) {
            sql += ` AND pb.status = $${pIndex}`;
            params.push(status);
            pIndex++;
        }
        if (startDate) {
            sql += ` AND pb.bill_date >= $${pIndex}`;
            params.push(startDate);
            pIndex++;
        }
        if (endDate) {
            sql += ` AND pb.bill_date <= $${pIndex}`;
            params.push(endDate);
            pIndex++;
        }

        sql += ` ORDER BY pb.bill_date DESC`;
        const data = await db.pgAll(sql, params);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch purchase bills" });
    }
});

// ─────────────────────────────────────────────────────────
// GET SINGLE BILL
// ─────────────────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const bill = await db.pgGet(`SELECT * FROM purchase_bills WHERE id = $1`, [id]);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        const items = await db.pgAll(`SELECT * FROM purchase_bill_items WHERE bill_id = $1`, [id]);
        const expenses = await db.pgAll(`SELECT * FROM purchase_bill_expenses WHERE bill_id = $1`, [id]);

        res.json({ ...bill, items, expenses });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch bill" });
    }
});

// ─────────────────────────────────────────────────────────
// CREATE NEW BILL (Atomic with Inventory & Accounting)
// ─────────────────────────────────────────────────────────
router.post("/", upload.single("bill_file"), authMiddleware, async (req, res) => {
    const companyId = sanitizeInt(req.user.active_company_id);
    const branchId  = sanitizeInt(req.user.branch_id);
    const userId    = sanitizeInt(req.user.id);

    let data = req.body;
    if (typeof req.body.data === 'string') {
        try { data = JSON.parse(req.body.data); } catch(e) {}
    }

    const {
        supplier_id, supplier_name, bill_number, bill_date,
        paid_amount, payment_mode, bill_type, items, expenses,
        broker_id, broker_commission_rate, discount_amount, bill_category
    } = data;

    // Safety: ensure no NaN values reach the DB
    const safeSupplierId = sanitizeInt(supplier_id);
    const safeBrokerId = sanitizeInt(broker_id);
    const safeBrokerCommission = isNaN(parseFloat(broker_commission_rate)) ? 0 : parseFloat(broker_commission_rate);
    const safeBranchId = branchId;
    const safeUserId = userId;

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const fileUrl = req.file ? `/uploads/purchase_bills/${req.file.filename}` : null;

        const branchRes  = await client.query(`SELECT state, state_code FROM branches WHERE id = $1`, [branchId]);
        const supplierRes = supplier_id
            ? await client.query(`SELECT name, state, state_code FROM suppliers WHERE id = $1`, [supplier_id])
            : { rows: [{ name: supplier_name }] };

        const branchStateCode   = branchRes.rows[0]?.state_code;
        const supplierStateCode = supplierRes.rows[0]?.state_code;

        let gstType = "INTRA_STATE";
        if (branchStateCode && supplierStateCode && branchStateCode !== supplierStateCode) {
            gstType = "INTER_STATE";
        }

        let subTotal  = 0;
        let taxTotal  = 0;
        let cgstTotal = 0;
        let sgstTotal = 0;
        let igstTotal = 0;

        const isExpenseBill = bill_category === 'EXPENSE';

        const processedItems = (!isExpenseBill ? (items || []) : []).map(item => {
            const qty          = isNaN(parseFloat(item.quantity)) ? 0 : parseFloat(item.quantity);
            const price        = isNaN(parseFloat(item.unit_price)) ? 0 : parseFloat(item.unit_price);
            const lineSubtotal = qty * price;
            const taxRate      = isNaN(parseFloat(item.tax_percent)) ? 0 : parseFloat(item.tax_percent);

            let cgstR = 0, sgstR = 0, igstR = 0;
            let cgstA = 0, sgstA = 0, igstA = 0;

            if (bill_type === "TAX") {
                if (gstType === "INTRA_STATE") {
                    cgstR = taxRate / 2;
                    sgstR = taxRate / 2;
                    cgstA = (lineSubtotal * cgstR) / 100;
                    sgstA = (lineSubtotal * sgstR) / 100;
                } else {
                    igstR = taxRate;
                    igstA = (lineSubtotal * igstR) / 100;
                }
            }

            const lineTax   = cgstA + sgstA + igstA;
            const lineTotal = lineSubtotal + lineTax;

            subTotal  += lineSubtotal;
            taxTotal  += lineTax;
            cgstTotal += cgstA;
            sgstTotal += sgstA;
            igstTotal += igstA;

            return {
                ...item,
                quantity: qty,
                unit_price: price,
                line_subtotal: lineSubtotal,
                cgst_rate: cgstR, sgst_rate: sgstR, igst_rate: igstR,
                cgst_amount: cgstA, sgst_amount: sgstA, igst_amount: igstA,
                line_total: lineTotal
            };
        });

        const processedExpenses = (isExpenseBill ? (expenses || []) : []).map(exp => {
            const amount = parseFloat(exp.amount || 0);
            const taxRate = parseFloat(exp.tax_percent || 0);
            
            let cgstA = 0, sgstA = 0, igstA = 0;
            if (bill_type === "TAX") {
                if (gstType === "INTRA_STATE") {
                    cgstA = (amount * (taxRate / 2)) / 100;
                    sgstA = (amount * (taxRate / 2)) / 100;
                } else {
                    igstA = (amount * taxRate) / 100;
                }
            }
            const lineTotal = amount + cgstA + sgstA + igstA;

            subTotal  += amount;
            taxTotal  += (cgstA + sgstA + igstA);
            cgstTotal += cgstA;
            sgstTotal += sgstA;
            igstTotal += igstA;

            return { ...exp, cgst_amount: cgstA, sgst_amount: sgstA, igst_amount: igstA, total_amount: lineTotal };
        });

        const discount = isNaN(parseFloat(discount_amount)) ? 0 : parseFloat(discount_amount);
        const grossTotal = subTotal + taxTotal;
        const netAmount = grossTotal - discount;
        const paid = parseFloat(paid_amount || 0);
        const balance = Math.max(0, netAmount - paid);
        const status = paid >= netAmount ? "PAID" : (paid > 0 ? "PARTIAL" : "PENDING");

        const billRes = await client.query(`
            INSERT INTO purchase_bills
            (company_id, branch_id, supplier_id, supplier_name, bill_number, bill_date,
             sub_total, tax_total, cgst_total, sgst_total, igst_total, total_amount,
             discount_amount, gst_type, paid_amount, balance_amount, status, bill_type,
             file_url, broker_id, broker_commission_rate, bill_category, is_deleted)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,false)
            RETURNING id
        `, [
            companyId, safeBranchId, safeSupplierId,
            supplierRes.rows[0]?.name || supplier_name || "Unknown",
            bill_number, bill_date || new Date(),
            subTotal, taxTotal, cgstTotal, sgstTotal, igstTotal, netAmount,
            discount, gstType, paid, balance, status, bill_type || "TAX",
            fileUrl, safeBrokerId, safeBrokerCommission, bill_category || 'PRODUCT'
        ]);

        const billId = billRes.rows[0].id;

        for (const pItem of processedItems) {
            await client.query(`
                INSERT INTO purchase_bill_items
                (bill_id, product_id, description, hsn_code, quantity, unit_price, tax_percent,
                 cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, line_total)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            `, [
                billId, sanitizeInt(pItem.product_id), pItem.description || null,
                pItem.hsn_code || null, pItem.quantity, pItem.unit_price,
                pItem.tax_percent || 0, 
                pItem.cgst_rate, pItem.sgst_rate, pItem.igst_rate,
                pItem.cgst_amount, pItem.sgst_amount, pItem.igst_amount, pItem.line_total
            ]);

            if (pItem.product_id) {
                // Update product stock and last purchase price
                await client.query(`
                    UPDATE products 
                    SET current_stock = current_stock + $1, 
                        cost_price = $2
                    WHERE id = $3
                `, [pItem.quantity, pItem.unit_price, pItem.product_id]);

                // Sync with inventory table
                await client.query(`
                    UPDATE inventory 
                    SET current_stock = current_stock + $1, 
                        cost_price = $2,
                        last_updated = NOW()
                    WHERE product_id = $3
                `, [pItem.quantity, pItem.unit_price, pItem.product_id]);

                // Record inventory movement
                await client.query(`
                    INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_in, reference_type, reference_id, note)
                    VALUES ($1,$2,$3,'Purchase',$4,'purchase_bill',$5,$6)
                `, [companyId, safeBranchId, pItem.product_id, pItem.quantity, billId, `Purchased via Bill #${bill_number}`]);
            }
        }

        for (const exp of processedExpenses) {
            await client.query(`
                INSERT INTO purchase_bill_expenses
                (bill_id, expense_type, description, amount, tax_percent, cgst_amount, sgst_amount, igst_amount, total_amount)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            `, [
                billId, exp.expense_type, exp.description || null, exp.amount, exp.tax_percent || 0,
                exp.cgst_amount, exp.sgst_amount, exp.igst_amount, exp.total_amount
            ]);
        }

        if (safeSupplierId && balance > 0) {
            await client.query(
                `UPDATE suppliers SET current_balance = current_balance + $1 WHERE id = $2`,
                [balance, safeSupplierId]
            );
        }

        try {
            const inventoryAccount = await getAccountByCode(companyId, "1400");
            const apAccount        = await getAccountByCode(companyId, "2000");
            const gstInputAccount  = await getAccountByCode(companyId, "2200");
            const cashAccount      = await getAccountByCode(companyId, "1000");
            const discountAccount  = await getAccountByCode(companyId, "5100");

            const txLines = [];

            if (isExpenseBill) {
                const expenseTypeMap = {
                    'Freight / Transport': '5010', 'Labour Charges': '5020', 'Professional Fees': '5030',
                    'Rent': '5040', 'Electricity': '5050', 'Repair & Maintenance': '5060',
                    'Printing & Stationery': '5070', 'Advertisement': '5080', 'Bank Charges': '5090',
                    'Insurance': '5100', 'Other': '5999'
                };

                for (const exp of processedExpenses) {
                    const accCode = expenseTypeMap[exp.expense_type] || '5999';
                    const acc = await getAccountByCode(companyId, accCode);
                    if (acc) {
                        txLines.push({ account_id: acc.id, debit_amount: exp.amount, credit_amount: 0, description: `${exp.expense_type} - Bill #${bill_number}` });
                    }
                }
            } else {
                const purchaseAccount = await getAccountByCode(companyId, "5000");
                if (purchaseAccount) {
                    txLines.push({ account_id: purchaseAccount.id, debit_amount: subTotal, credit_amount: 0, description: `Purchase - Bill #${bill_number}` });
                }
            }

            const gstInputAccount = await getAccountByCode(companyId, "2200"); 
            if (taxTotal > 0 && gstInputAccount) {
                txLines.push({ account_id: gstInputAccount.id, debit_amount: taxTotal, credit_amount: 0, description: `GST Input - Bill #${bill_number}` });
            }

            if (apAccount) {
                txLines.push({ account_id: apAccount.id, debit_amount: 0, credit_amount: grossTotal, description: `Liability to Supplier - Bill #${bill_number}` });
                
                if (discount > 0) {
                    const discountReceivedAcc = await getAccountByCode(companyId, "5200");
                    if (discountReceivedAcc) {
                        txLines.push({ account_id: apAccount.id, debit_amount: discount, credit_amount: 0, description: `Discount on Bill #${bill_number}` });
                        txLines.push({ account_id: discountReceivedAcc.id, debit_amount: 0, credit_amount: discount, description: `Purchase Discount Received` });
                    }
                }

                // Handle Multiple Payments
                const finalPayments = Array.isArray(data.payments) ? data.payments : (paid > 0 ? [{ mode: payment_mode || 'CASH', amount: paid }] : []);
                
                for (const p of finalPayments) {
                    const pAmt = parseFloat(p.amount || 0);
                    if (pAmt <= 0) continue;
                    
                    const isBank = (p.mode || "").toUpperCase() !== "CASH";
                    const pAcc = isBank ? (await getAccountByCode(companyId, "1200")) : cashAccount; 
                    
                    const effectiveAcc = pAcc || cashAccount;
                    if (effectiveAcc) {
                        txLines.push({ account_id: apAccount.id, debit_amount: pAmt, credit_amount: 0, description: `Payment for Bill #${bill_number}` });
                        txLines.push({ account_id: effectiveAcc.id, debit_amount: 0, credit_amount: pAmt, description: `Payment out via ${p.mode}` });
                    }
                }
            }

            if (txLines.length > 0) {
                // Balance the transaction if needed due to precision
                const totalD = txLines.reduce((s, l) => s + (l.debit_amount || 0), 0);
                const totalC = txLines.reduce((s, l) => s + (l.credit_amount || 0), 0);
                if (Math.abs(totalD - totalC) > 0.001) {
                    const diff = totalD - totalC;
                    txLines[0].debit_amount = (txLines[0].debit_amount || 0) - diff; // Adjust first entry to balance
                }

                const txData = {
                    company_id:       companyId,
                    branch_id:        safeBranchId || 1,
                    transaction_date: bill_date || new Date(),
                    reference_type:   "PURCHASE_BILL",
                    reference_id:     billId,
                    description:      `${isExpenseBill ? 'Expense' : 'Purchase'} Bill #${bill_number}`,
                    created_by:       safeUserId,
                    bill_purpose:     req.body.bill_purpose || 'real'
                };
                await createTransaction(txData, txLines);
            }
        } catch (accErr) {
            console.error("❌ Purchase Accounting Engine Failure:", accErr.message);
        }

        if (safeBrokerId) {
            await brokerService.recordCommission(client, req.user, {
                broker_id: safeBrokerId, commission_rate: safeBrokerCommission, bill_id: billId,
                bill_number, bill_amount: netAmount, bill_type: "PURCHASE",
                date: bill_date || new Date(), line_items: processedItems
            });
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, id: billId, total: netAmount, balance, status });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Purchase creation error:", err);
        res.status(500).json({ error: "Failed to create purchase bill: " + err.message });
    } finally {
        if (client) client.release();
    }
});

// ─────────────────────────────────────────────────────────
// PAY FOR BILL
// ─────────────────────────────────────────────────────────
router.patch("/:id/pay", authMiddleware, async (req, res) => {
    const { id }     = req.params;
    const companyId  = req.user.active_company_id;
    const { amount, payment_date, payment_mode } = req.body;
    const payAmount  = Number(amount || 0);

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const bill = await client.query(
            `SELECT * FROM purchase_bills WHERE id = $1 AND company_id = $2 FOR UPDATE`,
            [id, companyId]
        );
        if (!bill.rows[0]) throw new Error("Bill not found");

        const b          = bill.rows[0];
        const newPaid    = Number(b.paid_amount) + payAmount;
        const newBalance = Math.max(0, Number(b.total_amount) - newPaid);
        const newStatus  = newPaid >= Number(b.total_amount) ? "PAID" : "PARTIAL";

        await client.query(`
            UPDATE purchase_bills
            SET paid_amount = $1, balance_amount = $2, status = $3
            WHERE id = $4
        `, [newPaid, newBalance, newStatus, id]);

        if (b.supplier_id) {
            await client.query(
                `UPDATE suppliers SET current_balance = current_balance - $1 WHERE id = $2`,
                [payAmount, b.supplier_id]
            );
        }

        const pMode = (payment_mode || "CASH").toUpperCase();
        if (pMode === "CASH") {
            await client.query(`
                INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                VALUES ($1,$2,'BILL_PAYMENT',$3,'out',$4)
            `, [companyId, b.branch_id, payAmount, payment_date || new Date()]);
        } else {
            await client.query(`
                INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                VALUES ($1,$2,'BILL_PAYMENT',$3,'out',$4,$5,$6)
            `, [
                companyId, b.branch_id, payAmount,
                pMode, `BPAY-${id}-${Date.now()}`,
                payment_date || new Date()
            ]);
        }

        try {
            const apAccount   = await getAccountByCode(companyId, "2000");
            const cashAccount = await getAccountByCode(companyId, "1000");
            if (apAccount && cashAccount) {
                await createTransaction({
                    company_id:       companyId,
                    branch_id:        b.branch_id,
                    transaction_date: payment_date || new Date(),
                    reference_type:   "PURCHASE_PAYMENT",
                    reference_id:     Number(id),
                    description:      `Payment for Bill #${b.bill_number}`,
                    created_by:       req.user.id,
                    bill_purpose:     b.bill_purpose || 'real'
                }, [
                    { account_id: apAccount.id,   debit_amount: payAmount, credit_amount: 0,          description: `Settle Bill #${b.bill_number}` },
                    { account_id: cashAccount.id, debit_amount: 0,         credit_amount: payAmount,   description: `Cash outflow Bill #${b.bill_number}` }
                ]);
            }
        } catch (accErr) {
            console.warn("⚠️ Payment accounting failed:", accErr.message);
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Payment recorded", newPaid, newBalance, newStatus });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        res.status(500).json({ error: err.message || "Payment failed" });
    } finally {
        if (client) client.release();
    }
});

// ─────────────────────────────────────────────────────────
// ARCHIVE BILL (SOFT DELETE)
// ─────────────────────────────────────────────────────────
router.patch("/:id/archive", authMiddleware, async (req, res) => {
    try {
        await db.pgRun(
            `UPDATE purchase_bills SET is_deleted = true, deleted_at = NOW() WHERE id = $1 AND company_id = $2`,
            [req.params.id, req.user.active_company_id]
        );
        res.json({ success: true, message: "Bill archived" });
    } catch (err) {
        res.status(500).json({ error: "Archive failed" });
    }
});

export default router;
