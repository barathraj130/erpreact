import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as brokerService from "../services/brokerService.js";
import { createTransaction, createTransactionInternal, getAccountByCode } from "../utils/accountingEngine.js";
import { triggerN8N } from "../utils/triggerN8N.js";

const router = express.Router();

// ─── Auto-increment purchase bill number: PUR/YYYY/MM/NNN ────────────────────
async function generatePurchaseNumber(client) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const paddedMonth = String(month).padStart(2, '0');

    // Ensure the series table exists before using it (production may not have run migrations)
    await client.query(`SAVEPOINT sp_series_ddl`);
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS invoice_number_series (
                id        SERIAL PRIMARY KEY,
                bill_type VARCHAR(50) NOT NULL,
                prefix    VARCHAR(20),
                year      INTEGER     NOT NULL,
                month     INTEGER     NOT NULL,
                last_number INTEGER   NOT NULL DEFAULT 0,
                UNIQUE (bill_type, year, month)
            )
        `);
        await client.query(`RELEASE SAVEPOINT sp_series_ddl`);
    } catch (e) {
        await client.query(`ROLLBACK TO SAVEPOINT sp_series_ddl`);
        await client.query(`RELEASE SAVEPOINT sp_series_ddl`);
        // Table creation failed — fall back to timestamp-based number
        const ts = Date.now().toString().slice(-6);
        console.warn(`[purchaseBill] invoice_number_series unavailable, using fallback: ${ts}`);
        return `PUR/${year}/${paddedMonth}/${ts}`;
    }

    try {
        const result = await client.query(`
            INSERT INTO invoice_number_series (bill_type, prefix, year, month, last_number)
            VALUES ('purchase', 'PUR', $1, $2, 1)
            ON CONFLICT (bill_type, year, month)
            DO UPDATE SET last_number = invoice_number_series.last_number + 1
            RETURNING last_number
        `, [year, month]);
        const num = String(result.rows[0].last_number).padStart(3, '0');
        return `PUR/${year}/${paddedMonth}/${num}`;
    } catch (e) {
        const ts = Date.now().toString().slice(-6);
        console.warn(`[purchaseBill] series INSERT failed, fallback: ${ts}`);
        return `PUR/${year}/${paddedMonth}/${ts}`;
    }
}

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
// GET SINGLE BILL — with items (joined to products) + expenses
// ─────────────────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const bill = await db.pgGet(`
            SELECT pb.*, s.name AS supplier_name, s.gstin AS supplier_gstin, s.phone AS supplier_phone
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON s.id = pb.supplier_id
            WHERE pb.id = $1
        `, [id]);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        const items = await db.pgAll(`
            SELECT pbi.*,
                p.name AS product_name,
                p.hsn_code,
                p.unit
            FROM purchase_bill_items pbi
            LEFT JOIN products p ON p.id = pbi.product_id
            WHERE pbi.bill_id = $1
            ORDER BY pbi.id
        `, [id]);
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
    const branchId  = sanitizeInt(req.user.branch_id) || 1;
    const userId    = sanitizeInt(req.user.id) || 1;

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
        const paymentsArray = Array.isArray(data.payments) && data.payments.length > 0
            ? data.payments.filter(p => parseFloat(p.amount || 0) > 0)
            : [];
        // If a payments[] array is provided, use its sum; otherwise fall back to the
        // legacy scalar paid_amount field so old API calls still work.
        const paid = paymentsArray.length > 0
            ? Math.round(paymentsArray.reduce((s, p) => s + parseFloat(p.amount || 0), 0) * 100) / 100
            : parseFloat(paid_amount ?? data.total_paid ?? 0);
        const balance = Math.max(0, netAmount - paid);
        const status = paid >= netAmount ? "PAID" : (paid > 0 ? "PARTIAL" : "PENDING");

        const purchaseNumber = await generatePurchaseNumber(client);

        // Use the auto-generated purchaseNumber as the bill_number if none supplied.
        // purchase_number column may not exist in all deployments — omit it from
        // the base INSERT and add it via a best-effort SAVEPOINT UPDATE below.
        const finalBillNumber = bill_number || purchaseNumber;

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
            finalBillNumber, bill_date || new Date(),
            subTotal, taxTotal, cgstTotal, sgstTotal, igstTotal, netAmount,
            discount, gstType, paid, balance, status, bill_type || "TAX",
            fileUrl, safeBrokerId, safeBrokerCommission, bill_category || 'PRODUCT'
        ]);

        const billId = billRes.rows[0].id;

        // Best-effort: write purchase_number column if it exists in this deployment
        await client.query(`SAVEPOINT sp_purchase_number`);
        try {
            await client.query(
                `UPDATE purchase_bills SET purchase_number = $1 WHERE id = $2`,
                [purchaseNumber, billId]
            );
            await client.query(`RELEASE SAVEPOINT sp_purchase_number`);
        } catch (_) {
            await client.query(`ROLLBACK TO SAVEPOINT sp_purchase_number`);
            await client.query(`RELEASE SAVEPOINT sp_purchase_number`);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ITEM PROCESSING — every item must be fully persisted or the bill fails.
        // Product creation, bill_items, and inventory are all MANDATORY.
        // ═══════════════════════════════════════════════════════════════════════
        for (let pItem of processedItems) {

            // ── Step A: Ensure product exists ────────────────────────────────
            if (!pItem.product_id && (pItem.description || '').trim()) {
                // User typed a product name without selecting from dropdown.
                // Create the product now. This is MANDATORY — if it fails, the bill fails.
                // ON CONFLICT DO NOTHING + RETURNING handles the race where the same
                // product name was inserted concurrently.
                const productName = pItem.description.trim();
                const autoProduct = await client.query(`
                    INSERT INTO products
                        (company_id, branch_id, name, cost_price, selling_price,
                         current_stock, unit, hsn_code, gst_percent, is_active)
                    VALUES ($1, $2, $3, $4, $4, 0, $5, $6, $7, 1)
                    ON CONFLICT DO NOTHING
                    RETURNING id
                `, [
                    companyId, safeBranchId, productName,
                    pItem.unit_price, pItem.unit || 'pcs',
                    pItem.hsn_code || null, pItem.tax_percent || 0
                ]);

                if (autoProduct.rows.length > 0) {
                    pItem = { ...pItem, product_id: autoProduct.rows[0].id };
                    console.log(`[purchase-bill] Auto-created product '${productName}' → id=${pItem.product_id}`);
                } else {
                    // Row already exists (ON CONFLICT hit) — look it up by name + company
                    const existing = await client.query(
                        `SELECT id FROM products WHERE company_id=$1 AND name=$2 LIMIT 1`,
                        [companyId, productName]
                    );
                    if (existing.rows.length > 0) {
                        pItem = { ...pItem, product_id: existing.rows[0].id };
                        console.log(`[purchase-bill] Matched existing product '${productName}' → id=${pItem.product_id}`);
                    }
                    // If still no product_id the item will save without a product link (unusual)
                }
            }

            // ── Step B: Insert bill item row — MANDATORY ─────────────────────
            // schemaUpdates.js guarantees all columns exist; no fallback needed.
            await client.query(`
                INSERT INTO purchase_bill_items
                    (bill_id, product_id, description, hsn_code, unit, quantity, unit_price,
                     tax_percent, cgst_rate, sgst_rate, igst_rate,
                     cgst_amount, sgst_amount, igst_amount, line_total)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            `, [
                billId,
                sanitizeInt(pItem.product_id),
                pItem.description || null,
                pItem.hsn_code || null,
                pItem.unit || null,
                pItem.quantity,
                pItem.unit_price,
                pItem.tax_percent || 0,
                pItem.cgst_rate   || 0,
                pItem.sgst_rate   || 0,
                pItem.igst_rate   || 0,
                pItem.cgst_amount || 0,
                pItem.sgst_amount || 0,
                pItem.igst_amount || 0,
                pItem.line_total  || (pItem.quantity * pItem.unit_price)
            ]);

            // ── Step C: Update inventory — MANDATORY when product exists ─────
            if (pItem.product_id) {
                // 1. Update master product stock and cost price
                await client.query(`
                    UPDATE products
                    SET current_stock = current_stock + $1,
                        cost_price    = $2
                    WHERE id = $3
                `, [pItem.quantity, pItem.unit_price, pItem.product_id]);

                // 2. UPSERT main inventory table
                await client.query(`
                    INSERT INTO inventory
                        (company_id, branch_id, product_id, current_stock, cost_price, last_updated)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (product_id)
                    DO UPDATE SET
                        current_stock = inventory.current_stock + EXCLUDED.current_stock,
                        cost_price    = EXCLUDED.cost_price,
                        last_updated  = NOW()
                `, [companyId, safeBranchId, pItem.product_id, pItem.quantity, pItem.unit_price]);

                // 3. UPSERT branch-level inventory (best-effort — table may not exist)
                await client.query(`SAVEPOINT sp_branch_inv`);
                try {
                    await client.query(`
                        INSERT INTO branch_inventory
                            (company_id, branch_id, product_id, current_stock)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (branch_id, product_id)
                        DO UPDATE SET
                            current_stock = branch_inventory.current_stock + EXCLUDED.current_stock,
                            last_updated  = NOW()
                    `, [companyId, safeBranchId, pItem.product_id, pItem.quantity]);
                    await client.query(`RELEASE SAVEPOINT sp_branch_inv`);
                } catch (_) {
                    await client.query(`ROLLBACK TO SAVEPOINT sp_branch_inv`);
                    await client.query(`RELEASE SAVEPOINT sp_branch_inv`);
                }

                // 4. Stock movement ledger entry (best-effort — table may not exist)
                await client.query(`SAVEPOINT sp_inv_movement`);
                try {
                    await client.query(`
                        INSERT INTO inventory_movements
                            (company_id, branch_id, product_id, type, qty_in,
                             reference_type, reference_id, note)
                        VALUES ($1,$2,$3,'Purchase',$4,'purchase_bill',$5,$6)
                    `, [companyId, safeBranchId, pItem.product_id, pItem.quantity,
                        billId, `Purchased via Bill #${purchaseNumber}`]);
                    await client.query(`RELEASE SAVEPOINT sp_inv_movement`);
                } catch (_) {
                    await client.query(`ROLLBACK TO SAVEPOINT sp_inv_movement`);
                    await client.query(`RELEASE SAVEPOINT sp_inv_movement`);
                }
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
            // best-effort — supplier may not have current_balance column in older schemas
            await client.query(`SAVEPOINT sp_sup_balance`);
            try {
                await client.query(
                    `UPDATE suppliers SET current_balance = COALESCE(current_balance,0) + $1 WHERE id = $2`,
                    [balance, safeSupplierId]
                );
                await client.query(`RELEASE SAVEPOINT sp_sup_balance`);
            } catch (_) {
                await client.query(`ROLLBACK TO SAVEPOINT sp_sup_balance`);
                await client.query(`RELEASE SAVEPOINT sp_sup_balance`);
            }
        }

        // ============================================
        // CREATE LEDGER ENTRIES FOR PURCHASE BILL
        // ============================================
        // This is now inside the main transaction as requested
        const apAccount       = await getAccountByCode(companyId, "2000"); // Accounts Payable
        const gstInputAccount = await getAccountByCode(companyId, "2200"); // GST Input
        const cashAccount     = await getAccountByCode(companyId, "1000"); // Cash Account
        const stockAccount    = await getAccountByCode(companyId, "1400") || await getAccountByCode(companyId, "5000"); // Inventory/Purchases

        const txLines = [];

        // 1. STOCK RECEIVED (Debit)
        if (stockAccount) {
            txLines.push({ 
                account_id: stockAccount.id, 
                debit_amount: subTotal, 
                credit_amount: 0, 
                description: `Stock received - Bill #${bill_number}` 
            });
        }

        // 2 & 3. INPUT GST (Debit)
        if (bill_type === 'TAX' && taxTotal > 0 && gstInputAccount) {
            if (gstType === "INTRA_STATE") {
                const half = Math.round((taxTotal / 2) * 100) / 100;
                const remainder = Math.round((taxTotal - half) * 100) / 100;
                txLines.push({ account_id: gstInputAccount.id, debit_amount: half,      credit_amount: 0, description: `Input CGST - Bill #${bill_number}` });
                txLines.push({ account_id: gstInputAccount.id, debit_amount: remainder,  credit_amount: 0, description: `Input SGST - Bill #${bill_number}` });
            } else {
                txLines.push({ account_id: gstInputAccount.id, debit_amount: taxTotal, credit_amount: 0, description: `Input IGST - Bill #${bill_number}` });
            }
        }

        // 4. ACCOUNTS PAYABLE (Credit full amount)
        if (apAccount) {
            txLines.push({ 
                account_id: apAccount.id, 
                debit_amount: 0, 
                credit_amount: netAmount, 
                description: `Accounts Payable - Bill #${bill_number}` 
            });
        }

        // 5. IF PAID, RECORD PAYMENT (Debit AP, Credit Cash/Bank)
        if (paid > 0) {
            if (paymentsArray.length > 0) {
                for (const p of paymentsArray) {
                    const pAmount = parseFloat(p.amount || 0);
                    if (pAmount <= 0) continue;
                    const pMode = (p.mode || "CASH").toUpperCase();
                    const payAcct = pMode !== "CASH"
                        ? (await getAccountByCode(companyId, "1200") || await getAccountByCode(companyId, "1000"))
                        : await getAccountByCode(companyId, "1000");
                    if (apAccount && payAcct) {
                        txLines.push({ account_id: apAccount.id,  debit_amount: pAmount, credit_amount: 0,      description: `Payment for Bill #${bill_number}` });
                        txLines.push({ account_id: payAcct.id,    debit_amount: 0,       credit_amount: pAmount, description: `Paid via ${pMode} - Bill #${bill_number}` });
                    }
                }
            } else {
                const payAccount = (payment_mode || "CASH").toUpperCase() !== "CASH"
                    ? (await getAccountByCode(companyId, "1200") || await getAccountByCode(companyId, "1000"))
                    : await getAccountByCode(companyId, "1000");
                if (apAccount && payAccount) {
                    txLines.push({ account_id: apAccount.id,  debit_amount: paid, credit_amount: 0,    description: `Payment for Bill #${bill_number}` });
                    txLines.push({ account_id: payAccount.id, debit_amount: 0,    credit_amount: paid, description: `Paid via ${payment_mode || 'CASH'} - Bill #${bill_number}` });
                }
            }
        }

        // EXECUTE ACCOUNTING
        if (txLines.length > 0) {
            await createTransactionInternal(client, {
                company_id: companyId,
                branch_id: safeBranchId,
                transaction_date: bill_date || new Date(),
                reference_type: "PURCHASE_BILL",
                reference_id: billId,
                description: `Purchase Bill #${bill_number}`,
                created_by: userId,
                bill_purpose: 'real'
            }, txLines);
        }

        // Write initial payment to cash/bank ledger — best-effort (tables may not exist)
        if (paid > 0) {
            await client.query(`SAVEPOINT sp_ledger_payment`);
            try {
                if (paymentsArray.length > 0) {
                    for (const p of paymentsArray) {
                        const pAmount = parseFloat(p.amount || 0);
                        if (pAmount <= 0) continue;
                        const pMode = (p.mode || 'CASH').toUpperCase();
                        if (pMode === 'BANK') {
                            await client.query(
                                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                                 VALUES ($1, $2, 'PURCHASE_PAYMENT', $3, 'out', 'Main Account', $4)`,
                                [companyId, safeBranchId, pAmount, bill_date || new Date()]
                            );
                        } else {
                            await client.query(
                                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                                 VALUES ($1, $2, 'PURCHASE_PAYMENT', $3, 'out', $4)`,
                                [companyId, safeBranchId, pAmount, bill_date || new Date()]
                            );
                        }
                    }
                } else {
                    const pMode = (payment_mode || 'CASH').toUpperCase();
                    if (pMode === 'BANK') {
                        await client.query(
                            `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                             VALUES ($1, $2, 'PURCHASE_PAYMENT', $3, 'out', 'Main Account', $4)`,
                            [companyId, safeBranchId, paid, bill_date || new Date()]
                        );
                    } else {
                        await client.query(
                            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                             VALUES ($1, $2, 'PURCHASE_PAYMENT', $3, 'out', $4)`,
                            [companyId, safeBranchId, paid, bill_date || new Date()]
                        );
                    }
                }
                await client.query(`RELEASE SAVEPOINT sp_ledger_payment`);
            } catch (ledgerErr) {
                await client.query(`ROLLBACK TO SAVEPOINT sp_ledger_payment`);
                await client.query(`RELEASE SAVEPOINT sp_ledger_payment`);
                console.warn(`[purchase-bill] ledger payment entry skipped: ${(ledgerErr.message||'').split('\n')[0]}`);
            }
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, id: billId, purchase_number: purchaseNumber, total: netAmount, balance, status });

        // Fire n8n webhook (non-blocking, after response sent)
        triggerN8N('erp-alert', {
            event_type:     'purchase_received',
            supplier_name:  supplierRes.rows[0]?.name || supplier_name || 'Unknown',
            amount:         netAmount,
            bill_number:    purchaseNumber,
            items_count:    Array.isArray(items) ? items.length : 0,
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Purchase creation error:", err);
        res.status(500).json({ error: "Failed to create purchase bill: " + err.message });
    } finally {
        if (client) client.release();
    }
});

// ─────────────────────────────────────────────────────────
// HELPER — write one payment split to cash/bank ledger + accounting journal
// ─────────────────────────────────────────────────────────
async function recordPaymentSplit(client, { companyId, branchId, billId, billNumber, billPurpose, userId, payment_date, mode, amount, reference, apAccount }) {
    const pMode = (mode || "CASH").toUpperCase();
    if (pMode === "CASH") {
        await client.query(
            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
             VALUES ($1,$2,'BILL_PAYMENT',$3,'out',$4)`,
            [companyId, branchId, amount, payment_date || new Date()]
        );
    } else {
        await client.query(
            `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
             VALUES ($1,$2,'BILL_PAYMENT',$3,'out',$4,$5,$6)`,
            [companyId, branchId, amount, pMode,
             reference || `BPAY-${billId}-${Date.now()}`,
             payment_date || new Date()]
        );
    }

    if (apAccount) {
        const isBank = pMode !== "CASH";
        const payAccount = isBank
            ? (await getAccountByCode(companyId, "1200") || await getAccountByCode(companyId, "1000"))
            : await getAccountByCode(companyId, "1000");

        if (payAccount) {
            await createTransactionInternal(client, {
                company_id:       companyId,
                branch_id:        branchId,
                transaction_date: payment_date || new Date(),
                reference_type:   "PURCHASE_BILL",
                reference_id:     Number(billId),
                description:      `Payment (${pMode}) for Bill #${billNumber}`,
                created_by:       userId,
                bill_purpose:     billPurpose || 'real',
                amount
            }, [
                { account_id: apAccount.id,  debit_amount: amount, credit_amount: 0,      description: `AP Payment (${pMode}) - Bill #${billNumber}` },
                { account_id: payAccount.id, debit_amount: 0,      credit_amount: amount, description: `${isBank ? 'Bank' : 'Cash'} - Bill #${billNumber}` }
            ]);
        }
    }
}

// ─────────────────────────────────────────────────────────
// PAY FOR BILL  (supports both single and split payments)
//
// Request body:
//   Single:  { amount, payment_mode, payment_date, reference }
//   Split:   { payments: [{mode, amount, reference}], payment_date }
// ─────────────────────────────────────────────────────────
router.patch("/:id/pay", authMiddleware, async (req, res) => {
    const { id }    = req.params;
    const companyId = req.user.active_company_id;
    const { payment_date, payments: rawPayments, amount, payment_mode } = req.body;

    // Normalise to an array of {mode, amount, reference}
    let splits = Array.isArray(rawPayments) && rawPayments.length > 0
        ? rawPayments.filter(p => parseFloat(p.amount || 0) > 0)
        : [{ mode: payment_mode || "CASH", amount: Number(amount || 0), reference: req.body.reference || null }];

    const totalAmount = Math.round(splits.reduce((s, p) => s + parseFloat(p.amount || 0), 0) * 100) / 100;
    if (totalAmount <= 0) return res.status(400).json({ error: "Payment amount must be greater than 0" });

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const bill = await client.query(
            `SELECT * FROM purchase_bills WHERE id = $1 AND company_id = $2 FOR UPDATE`,
            [id, companyId]
        );
        if (!bill.rows[0]) throw new Error("Bill not found");

        const b = bill.rows[0];
        if (totalAmount > Number(b.balance_amount) + 0.01) {
            throw new Error(`Payment ₹${totalAmount} exceeds outstanding balance ₹${b.balance_amount}`);
        }

        const newPaid    = Math.round((Number(b.paid_amount) + totalAmount) * 100) / 100;
        const newBalance = Math.max(0, Math.round((Number(b.total_amount) - newPaid) * 100) / 100);
        const newStatus  = newBalance <= 0 ? "PAID" : "PARTIAL";

        await client.query(
            `UPDATE purchase_bills SET paid_amount=$1, balance_amount=$2, status=$3 WHERE id=$4`,
            [newPaid, newBalance, newStatus, id]
        );

        if (b.supplier_id) {
            await client.query(
                `UPDATE suppliers SET current_balance = GREATEST(0, current_balance - $1) WHERE id = $2`,
                [totalAmount, b.supplier_id]
            );
        }

        const apAccount = await getAccountByCode(companyId, "2000");

        for (const split of splits) {
            const splitAmt = Math.round(parseFloat(split.amount || 0) * 100) / 100;
            if (splitAmt <= 0) continue;
            await recordPaymentSplit(client, {
                companyId, branchId: b.branch_id || 1,
                billId: id, billNumber: b.bill_number,
                billPurpose: b.bill_purpose,
                userId: req.user.id,
                payment_date, mode: split.mode,
                amount: splitAmt, reference: split.reference,
                apAccount
            });
            console.log(`✅ Split payment (${split.mode}) ₹${splitAmt} → Bill #${b.bill_number}`);
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Payment recorded", newPaid, newBalance, newStatus, splits: splits.length });
    } catch (err) {
        if (client) { try { await client.query("ROLLBACK"); } catch (_) {} }
        res.status(500).json({ error: err.message || "Payment failed" });
    } finally {
        if (client) client.release();
    }
});

// ─────────────────────────────────────────────────────────
// POST /:id/payment — accepts same body as PATCH /:id/pay
// Normalises `mode` → `payment_mode` for backwards compatibility.
// ─────────────────────────────────────────────────────────
router.post("/:id/payment", authMiddleware, async (req, res) => {
    // Normalise legacy field name
    if (req.body.mode && !req.body.payment_mode) req.body.payment_mode = req.body.mode;
    // Re-use the shared PATCH handler implementation by making an identical call
    const { id }    = req.params;
    const companyId = req.user.active_company_id;
    const { payment_date, payments: rawPayments, amount, payment_mode } = req.body;

    let splits = Array.isArray(rawPayments) && rawPayments.length > 0
        ? rawPayments.filter(p => parseFloat(p.amount || 0) > 0)
        : [{ mode: payment_mode || "CASH", amount: Number(amount || 0), reference: req.body.reference || null }];

    const totalAmount = Math.round(splits.reduce((s, p) => s + parseFloat(p.amount || 0), 0) * 100) / 100;
    if (totalAmount <= 0) return res.status(400).json({ error: "Payment amount must be greater than 0" });

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        const bill = await client.query(
            `SELECT * FROM purchase_bills WHERE id = $1 AND company_id = $2 FOR UPDATE`,
            [id, companyId]
        );
        if (!bill.rows[0]) throw new Error("Bill not found");

        const b = bill.rows[0];
        if (totalAmount > Number(b.balance_amount) + 0.01) {
            throw new Error(`Payment ₹${totalAmount} exceeds outstanding balance ₹${b.balance_amount}`);
        }

        const newPaid    = Math.round((Number(b.paid_amount) + totalAmount) * 100) / 100;
        const newBalance = Math.max(0, Math.round((Number(b.total_amount) - newPaid) * 100) / 100);
        const newStatus  = newBalance <= 0 ? "PAID" : "PARTIAL";

        await client.query(
            `UPDATE purchase_bills SET paid_amount=$1, balance_amount=$2, status=$3 WHERE id=$4`,
            [newPaid, newBalance, newStatus, id]
        );
        if (b.supplier_id) {
            await client.query(
                `UPDATE suppliers SET current_balance = GREATEST(0, current_balance - $1) WHERE id = $2`,
                [totalAmount, b.supplier_id]
            );
        }

        const apAccount = await getAccountByCode(companyId, "2000");
        for (const split of splits) {
            const splitAmt = Math.round(parseFloat(split.amount || 0) * 100) / 100;
            if (splitAmt <= 0) continue;
            await recordPaymentSplit(client, {
                companyId, branchId: b.branch_id || 1,
                billId: id, billNumber: b.bill_number,
                billPurpose: b.bill_purpose, userId: req.user.id,
                payment_date, mode: split.mode, amount: splitAmt,
                reference: split.reference, apAccount
            });
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Payment recorded", newPaid, newBalance, newStatus, splits: splits.length });
    } catch (err) {
        if (client) { try { await client.query("ROLLBACK"); } catch (_) {} }
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
