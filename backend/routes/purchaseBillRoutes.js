// backend/routes/purchaseBillRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import * as brokerService from "../services/brokerService.js";
import { createTransaction, getAccountByCode } from "../utils/accountingEngine.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────
// GET ALL BILLS
// ─────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { supplier, status, startDate, endDate } = req.query;

    try {
        let sql = `
            SELECT pb.*, s.name AS supplier_display_name
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON s.id = pb.supplier_id
            WHERE pb.company_id = $1 AND pb.is_deleted = false
        `;
        let params = [companyId];
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
        const result = await db.pgAll(sql, params);
        res.json(result);
    } catch (err) {
        console.error("Fetch Bills Error:", err);
        res.status(500).json({ error: "Failed to fetch purchase bills" });
    }
});

// ─────────────────────────────────────────────────────────
// GET SINGLE BILL WITH ITEMS
// ─────────────────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { id } = req.params;
    try {
        const bill = await db.pgGet(
            `SELECT pb.*, s.name AS supplier_display_name
             FROM purchase_bills pb
             LEFT JOIN suppliers s ON s.id = pb.supplier_id
             WHERE pb.id = $1 AND pb.company_id = $2 AND pb.is_deleted = false`,
            [id, companyId]
        );
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        const items = await db.pgAll(`SELECT * FROM purchase_bill_items WHERE bill_id = $1`, [id]);
        res.json({ ...bill, items });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch bill" });
    }
});

// ─────────────────────────────────────────────────────────
// CREATE NEW BILL  (Full Accounting Engine Integration)
// ─────────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    const userId    = req.user.id;

    const {
        supplier_id, supplier_name, bill_number, bill_date, due_date,
        paid_amount, payment_mode, bill_type, items,
        broker_id, broker_commission_rate
    } = req.body;

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // ── 1. Detect GST Type (Intra vs Inter State) ──────────────────
        const branchRes  = await client.query(`SELECT state, state_code FROM branches  WHERE id = $1`, [branchId]);
        const supplierRes = supplier_id
            ? await client.query(`SELECT state, state_code FROM suppliers WHERE id = $1`, [supplier_id])
            : { rows: [{}] };

        const branchStateCode   = branchRes.rows[0]?.state_code;
        const supplierStateCode = supplierRes.rows[0]?.state_code;

        let gstType = "INTRA_STATE";
        if (branchStateCode && supplierStateCode && branchStateCode !== supplierStateCode) {
            gstType = "INTER_STATE";
        }

        // ── 2. Process Line Items with GST Split ───────────────────────
        let subTotal  = 0;
        let taxTotal  = 0;
        let cgstTotal = 0;
        let sgstTotal = 0;
        let igstTotal = 0;

        const processedItems = (items || []).map(item => {
            const qty          = Number(item.quantity || 0);
            const price        = Number(item.unit_price || 0);
            const lineSubtotal = qty * price;
            const taxRate      = Number(item.tax_percent || 18); // default 18%

            let cgstR = 0, sgstR = 0, igstR = 0;
            let cgstA = 0, sgstA = 0, igstA = 0;

            if (gstType === "INTRA_STATE") {
                cgstR = taxRate / 2;
                sgstR = taxRate / 2;
                cgstA = (lineSubtotal * cgstR) / 100;
                sgstA = (lineSubtotal * sgstR) / 100;
            } else {
                igstR = taxRate;
                igstA = (lineSubtotal * igstR) / 100;
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
                line_subtotal: lineSubtotal,
                cgst_rate: cgstR, sgst_rate: sgstR, igst_rate: igstR,
                cgst_amount: cgstA, sgst_amount: sgstA, igst_amount: igstA,
                line_total: lineTotal
            };
        });

        const finalTotal  = subTotal + taxTotal;
        const paid        = Number(paid_amount || 0);
        const balance     = Math.max(0, finalTotal - paid);
        const status      = paid >= finalTotal ? "PAID" : (paid > 0 ? "PARTIAL" : "PENDING");

        // ── 3. Insert Purchase Bill Header ─────────────────────────────
        const billRes = await client.query(`
            INSERT INTO purchase_bills
            (company_id, branch_id, supplier_id, supplier_name, bill_number, bill_date, due_date,
             sub_total, tax_amount, cgst_amount, sgst_amount, igst_amount, total_amount,
             gst_type, paid_amount, balance_amount, status, bill_type,
             broker_id, broker_commission_rate, is_deleted)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,false)
            RETURNING id
        `, [
            companyId, branchId, supplier_id || null,
            supplier_name || supplierRes.rows[0]?.name || null,
            bill_number, bill_date || new Date(), due_date || null,
            subTotal, taxTotal, cgstTotal, sgstTotal, igstTotal, finalTotal,
            gstType, paid, balance, status, bill_type || "GST",
            broker_id || null, broker_commission_rate || null
        ]);

        const billId = billRes.rows[0].id;

        // ── 4. Insert Line Items & Update Inventory ────────────────────
        for (const item of processedItems) {
            await client.query(`
                INSERT INTO purchase_bill_items
                (bill_id, product_id, description, hsn_code, quantity, unit_price,
                 tax_percent, cgst_rate, sgst_rate, igst_rate,
                 cgst_amount, sgst_amount, igst_amount, line_total)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            `, [
                billId,
                item.product_id || null,
                item.description || null,
                item.hsn_code    || null,
                item.quantity,
                item.unit_price,
                item.tax_percent || 18,
                item.cgst_rate, item.sgst_rate, item.igst_rate,
                item.cgst_amount, item.sgst_amount, item.igst_amount,
                item.line_total
            ]);

            // Stock IN for purchased products
            if (item.product_id) {
                await client.query(
                    `UPDATE products SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2`,
                    [item.quantity, item.product_id]
                );
            }
        }

        // ── 5. Update Supplier Balance (Outstanding Payable) ───────────
        if (supplier_id && balance > 0) {
            await client.query(
                `UPDATE suppliers SET current_balance = current_balance + $1 WHERE id = $2`,
                [balance, supplier_id]
            );
        }

        // ── 6. Post Cash / Bank Ledger for Immediate Payment ──────────
        if (paid > 0) {
            const pMode = (payment_mode || "CASH").toUpperCase();
            if (pMode === "CASH") {
                await client.query(`
                    INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                    VALUES ($1,$2,'PURCHASE_PAYMENT',$3,'out',$4)
                `, [companyId, branchId, paid, bill_date || new Date()]);
            } else {
                await client.query(`
                    INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                    VALUES ($1,$2,'PURCHASE_PAYMENT',$3,'out',$4,$5,$6)
                `, [
                    companyId, branchId, paid,
                    pMode, `BILL-${billId}`,
                    bill_date || new Date()
                ]);
            }
        }

        // ── 7. Double-Entry Accounting via COA ────────────────────────
        //   DR  5000 – Purchases / COGS (expense)
        //   DR  2200 – GST Input (tax receivable / input credit)
        //   CR  2000 – Accounts Payable / Sundry Creditors (liability)
        //   CR  1000 – Cash / Bank (if paid immediately)
        try {
            const purchasesAccount = await getAccountByCode(companyId, "5000");
            const apAccount        = await getAccountByCode(companyId, "2000"); // Accounts Payable
            const gstInputAccount  = await getAccountByCode(companyId, "2200"); // GST Input Tax Credit
            const cashAccount      = await getAccountByCode(companyId, "1000"); // Cash/Bank

            if (purchasesAccount && apAccount) {
                const txLines = [];

                // DR Purchases for sub-total
                txLines.push({
                    account_id: purchasesAccount.id,
                    debit_amount: subTotal,
                    credit_amount: 0,
                    description: `Purchase from Bill #${bill_number}`
                });

                // DR GST Input Credit for tax paid
                if (taxTotal > 0 && gstInputAccount) {
                    txLines.push({
                        account_id: gstInputAccount.id,
                        debit_amount: taxTotal,
                        credit_amount: 0,
                        description: `GST Input Credit – Bill #${bill_number} (${gstType})`
                    });
                }

                // CR Accounts Payable for the full bill (payable to supplier)
                txLines.push({
                    account_id: apAccount.id,
                    debit_amount: 0,
                    credit_amount: finalTotal,
                    description: `Payable to ${supplier_name || "Supplier"} – Bill #${bill_number}`
                });

                // If paid immediately: DR AP & CR Cash (settle the payable)
                if (paid > 0 && cashAccount) {
                    // DR Accounts Payable (reduce liability)
                    txLines.push({
                        account_id: apAccount.id,
                        debit_amount: paid,
                        credit_amount: 0,
                        description: `Payment for Bill #${bill_number}`
                    });
                    // CR Cash / Bank (reduce asset)
                    txLines.push({
                        account_id: cashAccount.id,
                        debit_amount: 0,
                        credit_amount: paid,
                        description: `Cash outflow for Bill #${bill_number}`
                    });
                }

                // Validate and balance (absorb rounding into AP)
                const totalD = txLines.reduce((s, l) => s + (l.debit_amount  || 0), 0);
                const totalC = txLines.reduce((s, l) => s + (l.credit_amount || 0), 0);
                const diff   = Math.abs(totalD - totalC);
                if (diff > 0 && diff < 1) {
                    // Adjust AP credit entry
                    const apCredit = txLines.find(l => l.account_id === apAccount.id && l.credit_amount > 0);
                    if (apCredit) apCredit.credit_amount += (totalD - totalC);
                }

                await createTransaction({
                    company_id:       companyId,
                    branch_id:        branchId,
                    transaction_date: bill_date || new Date(),
                    reference_type:   "PURCHASE_BILL",
                    reference_id:     billId,
                    description:      `Purchase Bill #${bill_number}`,
                    created_by:       userId
                }, txLines);
            }
        } catch (accErr) {
            // Non-fatal: log but don't rollback the bill
            console.warn("⚠️ Accounting engine posting failed (non-fatal):", accErr.message);
        }

        // ── 8. Broker Commission ───────────────────────────────────────
        if (broker_id) {
            await brokerService.recordCommission(client, req.user, {
                broker_id,
                commission_rate: broker_commission_rate,
                bill_id:         billId,
                bill_number,
                bill_amount:     finalTotal,
                bill_type:       "PURCHASE",
                date:            bill_date || new Date(),
                line_items:      items || []
            });
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, id: billId, total: finalTotal, balance, status, gst_type: gstType });
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

        // Reduce supplier outstanding balance
        if (b.supplier_id) {
            await client.query(
                `UPDATE suppliers SET current_balance = current_balance - $1 WHERE id = $2`,
                [payAmount, b.supplier_id]
            );
        }

        // Cash / Bank Ledger
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

        // Accounting: DR Accounts Payable, CR Cash
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
                    created_by:       req.user.id
                }, [
                    { account_id: apAccount.id,   debit_amount: payAmount, credit_amount: 0,          description: `Settle Bill #${b.bill_number}` },
                    { account_id: cashAccount.id, debit_amount: 0,         credit_amount: payAmount,   description: `Cash outflow Bill #${b.bill_number}` }
                ]);
            }
        } catch (accErr) {
            console.warn("⚠️ Payment accounting failed (non-fatal):", accErr.message);
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
