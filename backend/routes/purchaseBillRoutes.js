import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import * as brokerService from "../services/brokerService.js";
import { createTransaction, getAccountByCode } from "../utils/accountingEngine.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "./uploads/purchase_bills";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `bill_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

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
// CREATE NEW BILL (Atomic with Inventory & Accounting)
// ─────────────────────────────────────────────────────────
router.post("/", upload.single("bill_file"), authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id;
    const userId    = req.user.id;

    let data = req.body;
    if (typeof req.body.data === 'string') {
        try { data = JSON.parse(req.body.data); } catch(e) {}
    }

    const {
        supplier_id, supplier_name, bill_number, bill_date,
        paid_amount, payment_mode, bill_type, items,
        broker_id, broker_commission_rate, discount_amount
    } = data;

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

        const processedItems = (items || []).map(item => {
            const qty          = parseFloat(item.quantity || 0);
            const price        = parseFloat(item.unit_price || 0);
            const lineSubtotal = qty * price;
            const taxRate      = parseFloat(item.tax_percent || 0);

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

        const discount = parseFloat(discount_amount || 0);
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
             file_url, broker_id, broker_commission_rate, is_deleted)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,false)
            RETURNING id
        `, [
            companyId, branchId, supplier_id || null,
            supplierRes.rows[0]?.name || supplier_name || "Unknown",
            bill_number, bill_date || new Date(),
            subTotal, taxTotal, cgstTotal, sgstTotal, igstTotal, netAmount,
            discount, gstType, paid, balance, status, bill_type || "TAX",
            fileUrl, broker_id || null, broker_commission_rate || null
        ]);

        const billId = billRes.rows[0].id;

        for (const item of processedItems) {
            await client.query(`
                INSERT INTO purchase_bill_items
                (bill_id, product_id, description, hsn_code, quantity, unit_price,
                 tax_percent, cgst_rate, sgst_rate, igst_rate,
                 cgst_amount, sgst_amount, igst_amount, line_total)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            `, [
                billId, item.product_id || null, item.description || null,
                item.hsn_code || null, item.quantity, item.unit_price,
                item.tax_percent || 0, item.cgst_rate, item.sgst_rate, item.igst_rate,
                item.cgst_amount, item.sgst_amount, item.igst_amount, item.line_total
            ]);

            if (item.product_id) {
                const inv = await client.query(`SELECT current_stock, cost_price FROM inventory WHERE product_id = $1`, [item.product_id]);
                const currStock = parseFloat(inv.rows[0]?.current_stock || 0);
                const currCost = parseFloat(inv.rows[0]?.cost_price || 0);

                const newQty = currStock + item.quantity;
                const newVal = item.quantity * item.unit_price;
                const existingVal = currStock * currCost;
                const newWAC = newQty > 0 ? (existingVal + newVal) / newQty : item.unit_price;

                await client.query(
                    `UPDATE products SET current_stock = $1, cost_price = $2, updated_at = NOW() WHERE id = $3`,
                    [newQty, newWAC, item.product_id]
                );

                await client.query(
                    `UPDATE inventory SET current_stock = $1, cost_price = $2, last_updated = NOW() WHERE product_id = $3`,
                    [newQty, newWAC, item.product_id]
                );

                await client.query(`
                    INSERT INTO inventory_movements (company_id, branch_id, product_id, type, qty_in, reference_type, reference_id, note)
                    VALUES ($1,$2,$3,'Purchase',$4,'purchase_bill',$5,$6)
                `, [companyId, branchId, item.product_id, item.quantity, billId, `Purchased via Bill #${bill_number}`]);
            }
        }

        if (supplier_id && balance > 0) {
            await client.query(
                `UPDATE suppliers SET current_balance = current_balance + $1 WHERE id = $2`,
                [balance, supplier_id]
            );
        }

        try {
            const inventoryAccount = await getAccountByCode(companyId, "1400");
            const apAccount        = await getAccountByCode(companyId, "2000");
            const gstInputAccount  = await getAccountByCode(companyId, "2200");
            const cashAccount      = await getAccountByCode(companyId, "1000");
            const discountAccount  = await getAccountByCode(companyId, "5100");

            if (inventoryAccount && apAccount) {
                const txLines = [];
                txLines.push({ account_id: inventoryAccount.id, debit_amount: subTotal, credit_amount: 0, description: `Inventory Purchase - Bill #${bill_number}` });
                if (taxTotal > 0 && gstInputAccount) {
                    txLines.push({ account_id: gstInputAccount.id, debit_amount: taxTotal, credit_amount: 0, description: `GST Input - Bill #${bill_number}` });
                }
                txLines.push({ account_id: apAccount.id, debit_amount: 0, credit_amount: grossTotal, description: `Liability to ${supplierRes.rows[0]?.name || "Supplier"} - Bill #${bill_number}` });

                if (discount > 0 && discountAccount) {
                    txLines.push({ account_id: apAccount.id, debit_amount: discount, credit_amount: 0, description: `Discount on Bill #${bill_number}` });
                    txLines.push({ account_id: discountAccount.id, debit_amount: 0, credit_amount: discount, description: `Purchase Discount - Bill #${bill_number}` });
                }

                if (paid > 0 && cashAccount) {
                    txLines.push({ account_id: apAccount.id, debit_amount: paid, credit_amount: 0, description: `Payment for Bill #${bill_number}` });
                    txLines.push({ account_id: cashAccount.id, debit_amount: 0, credit_amount: paid, description: `Payment out via ${payment_mode} - Bill #${bill_number}` });
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
            console.warn("⚠️ Accounting failed:", accErr.message);
        }

        if (broker_id) {
            await brokerService.recordCommission(client, req.user, {
                broker_id, commission_rate: broker_commission_rate, bill_id: billId,
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
                    created_by:       req.user.id
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
