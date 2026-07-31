// backend/routes/settlements.js
// Customer Debt Settlement module — new route file, mounted at /api/settlements.
// customer_id throughout refers to users(id): this schema has no separate
// customers table, customers are users rows with role IN ('user','customer').
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { recomputeCustomerBalance, createCustomerLedgerEvent } from "../services/customerLedgerService.js";
import { sendWhatsApp } from "../utils/whatsapp.js";

const router = express.Router();

const isAdmin = (req) => ["admin", "superadmin"].includes(String(req.user?.role || "").toLowerCase());

/**
 * Adds guideline-value-transfer tracking columns to debt_settlements. Idempotent —
 * safe to call on every request that touches these fields, matching the pattern
 * used elsewhere in this codebase (e.g. salesReturnRoutes.js's ensureTable()).
 */
const ensureGuidelineTransferColumns = async () => {
    await db.pgRun(`ALTER TABLE debt_settlements ADD COLUMN IF NOT EXISTS guideline_transfer_recorded BOOLEAN DEFAULT false`).catch(() => {});
    await db.pgRun(`ALTER TABLE debt_settlements ADD COLUMN IF NOT EXISTS guideline_transfer_amount NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE debt_settlements ADD COLUMN IF NOT EXISTS guideline_transfer_date DATE`).catch(() => {});
    await db.pgRun(`ALTER TABLE debt_settlements ADD COLUMN IF NOT EXISTS guideline_transfer_mode VARCHAR(20)`).catch(() => {});
    await db.pgRun(`ALTER TABLE debt_settlements ADD COLUMN IF NOT EXISTS guideline_transfer_reference VARCHAR(100)`).catch(() => {});
    await db.pgRun(`ALTER TABLE debt_settlements ADD COLUMN IF NOT EXISTS guideline_transfer_transaction_id INTEGER`).catch(() => {});
};

async function getUserName(queryable, userId) {
    if (!userId) return null;
    const res = await queryable.query(`SELECT COALESCE(nickname, username) AS name FROM users WHERE id = $1`, [userId]);
    return res.rows[0]?.name || null;
}

/**
 * Applies a settlement's total value as real invoice payments, then recomputes the
 * customer's balance via the same service the rest of the app already uses for that
 * (customer ledger page, ledger PDF export) — so this stays consistent with the rest
 * of the app instead of maintaining a second, parallel balance calculation.
 */
async function applySettlementPayments(client, settlement, companyId) {
    const links = await client.query(`SELECT * FROM settlement_invoice_links WHERE settlement_id = $1`, [settlement.id]);

    for (const link of links.rows) {
        const invRes = await client.query(`SELECT paid_amount, total_amount FROM invoices WHERE id = $1 AND company_id = $2`, [link.invoice_id, companyId]);
        const inv = invRes.rows[0];
        if (!inv) continue;

        const newPaid = parseFloat(inv.paid_amount || 0) + parseFloat(link.amount_allocated || 0);
        const total = parseFloat(inv.total_amount || 0);
        const newStatus = newPaid >= total ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";

        await client.query(
            `UPDATE invoices SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3`,
            [newPaid, newStatus, link.invoice_id]
        );

        await client.query(
            `INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, notes, created_at)
             VALUES ($1, $2, CURRENT_DATE, 'SETTLEMENT', $3, NOW())`,
            [link.invoice_id, link.amount_allocated, `Debt settlement ${settlement.settlement_number}`]
        );
    }

    await recomputeCustomerBalance(client, settlement.customer_id, companyId);

    if (parseFloat(settlement.cash_amount || 0) > 0) {
        await client.query(
            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, notes, created_at)
             VALUES ($1, $2, 'SETTLEMENT_CASH', $3, 'in', CURRENT_DATE, $4, NOW())`,
            [companyId, settlement.branch_id, settlement.cash_amount, `Cash from settlement ${settlement.settlement_number}`]
        );
    }
}

// GET /api/settlements — list
router.get("/", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { customer_id, status } = req.query;
        const conditions = ["ds.company_id = $1"];
        const params = [companyId];

        if (customer_id) { params.push(customer_id); conditions.push(`ds.customer_id = $${params.length}`); }
        if (status) { params.push(status); conditions.push(`ds.status = $${params.length}`); }

        const rows = await db.pgAll(
            `SELECT ds.*,
                COALESCE(c.nickname, c.username) AS customer_name, c.phone AS customer_phone,
                COALESCE(u.nickname, u.username) AS recorded_by_name,
                COALESCE(a.nickname, a.username) AS approved_by_name
             FROM debt_settlements ds
             LEFT JOIN users c ON c.id = ds.customer_id
             LEFT JOIN users u ON u.id = ds.recorded_by
             LEFT JOIN users a ON a.id = ds.approved_by
             WHERE ${conditions.join(" AND ")}
             ORDER BY ds.created_at DESC`,
            params
        );
        res.json(rows);
    } catch (e) {
        console.error("Settlements list error:", e.message);
        res.json([]);
    }
});

// GET /api/settlements/customers/:id/outstanding — invoices eligible for settlement
router.get("/customers/:id/outstanding", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(
            `SELECT id, invoice_number, invoice_type, invoice_date, total_amount, paid_amount,
                    (total_amount - COALESCE(paid_amount, 0)) AS balance_amount, status
             FROM invoices
             WHERE customer_id = $1 AND company_id = $2
               AND COALESCE(is_deleted, false) = false AND COALESCE(is_nominal, false) = false
               AND (total_amount - COALESCE(paid_amount, 0)) > 0
               AND status <> 'PAID'
             ORDER BY invoice_date ASC`,
            [req.params.id, companyId]
        );
        res.json(rows);
    } catch (e) {
        console.error("Outstanding invoices error:", e.message);
        res.json([]);
    }
});

// GET /api/settlements/summary — counts/values for the list page's summary cards
router.get("/summary", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;

        const pending = await db.pgGet(
            `SELECT COUNT(*) AS count, COALESCE(SUM(total_value), 0) AS value
             FROM debt_settlements WHERE company_id = $1 AND status = 'pending'`,
            [companyId]
        );
        const conditional = await db.pgGet(
            `SELECT COUNT(*) AS count FROM debt_settlements
             WHERE company_id = $1 AND is_conditional = true AND legal_transfer_done = false AND status = 'approved'`,
            [companyId]
        );
        const chequesDue = await db.pgGet(
            `SELECT COUNT(*) AS count FROM settlement_cheque_items sc
             JOIN debt_settlements ds ON ds.id = sc.settlement_id
             WHERE ds.company_id = $1 AND sc.status = 'pending'
               AND sc.cheque_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`,
            [companyId]
        );

        res.json({
            pending_count: parseInt(pending?.count) || 0,
            pending_value: parseFloat(pending?.value) || 0,
            conditional_count: parseInt(conditional?.count) || 0,
            cheques_due_count: parseInt(chequesDue?.count) || 0,
        });
    } catch (e) {
        console.error("Settlements summary error:", e.message);
        res.json({ pending_count: 0, pending_value: 0, conditional_count: 0, cheques_due_count: 0 });
    }
});

// GET /api/settlements/:id — detail
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        await ensureGuidelineTransferColumns();
        const companyId = req.user.active_company_id;
        const settlement = await db.pgGet(
            `SELECT ds.*,
                COALESCE(c.nickname, c.username) AS customer_name, c.phone AS customer_phone, c.gstin,
                COALESCE(u.nickname, u.username) AS recorded_by_name,
                COALESCE(a.nickname, a.username) AS approved_by_name
             FROM debt_settlements ds
             LEFT JOIN users c ON c.id = ds.customer_id
             LEFT JOIN users u ON u.id = ds.recorded_by
             LEFT JOIN users a ON a.id = ds.approved_by
             WHERE ds.id = $1 AND ds.company_id = $2`,
            [req.params.id, companyId]
        );
        if (!settlement) return res.status(404).json({ error: "Settlement not found" });

        const [invoiceLinks, goods, assets, cheques, history] = await Promise.all([
            db.pgAll(`SELECT * FROM settlement_invoice_links WHERE settlement_id = $1`, [settlement.id]),
            db.pgAll(`SELECT * FROM settlement_goods_items WHERE settlement_id = $1 ORDER BY id`, [settlement.id]),
            db.pgAll(`SELECT * FROM settlement_assets_items WHERE settlement_id = $1 ORDER BY id`, [settlement.id]),
            db.pgAll(`SELECT * FROM settlement_cheque_items WHERE settlement_id = $1 ORDER BY id`, [settlement.id]),
            db.pgAll(
                `SELECT sh.*, COALESCE(u.nickname, u.username) AS done_by_name
                 FROM settlement_history sh
                 LEFT JOIN users u ON u.id = sh.done_by
                 WHERE sh.settlement_id = $1
                 ORDER BY sh.created_at ASC`,
                [settlement.id]
            ),
        ]);

        res.json({ settlement, invoice_links: invoiceLinks, goods, assets, cheques, history });
    } catch (e) {
        console.error("Settlement detail error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/settlements — create
router.post("/", authMiddleware, async (req, res) => {
    let client;
    try {
        const companyId = req.user.active_company_id;
        const {
            customer_id, settlement_date, settlement_type, notes,
            invoice_links, goods_items, asset_items, cheque_items, cash_amount
        } = req.body;

        if (!customer_id) return res.status(400).json({ success: false, error: "Customer required" });
        if (!invoice_links || invoice_links.length === 0) return res.status(400).json({ success: false, error: "Select at least one invoice" });

        const customer = await db.pgGet(
            `SELECT id, COALESCE(nickname, username) AS name, initial_balance
             FROM users WHERE id = $1 AND company_id = $2 AND role IN ('user', 'customer')`,
            [customer_id, companyId]
        );
        if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

        const goodsTotal = (goods_items || []).reduce((s, g) => s + parseFloat(g.total_value || 0), 0);
        const assetTotal = (asset_items || []).reduce((s, a) => s + parseFloat(a.agreed_value || 0), 0);
        const chequeTotal = (cheque_items || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
        const cashTotal = parseFloat(cash_amount || 0);
        const totalValue = goodsTotal + assetTotal + chequeTotal + cashTotal;

        if (totalValue <= 0) return res.status(400).json({ success: false, error: "Total settlement value must be greater than zero" });

        const totalAllocated = (invoice_links || []).reduce((s, l) => s + parseFloat(l.amount_allocated || 0), 0);
        if (Math.round(totalAllocated * 100) !== Math.round(totalValue * 100)) {
            return res.status(400).json({
                success: false,
                error: `Invoice allocation (₹${totalAllocated.toFixed(2)}) must equal total value (₹${totalValue.toFixed(2)})`,
            });
        }

        // Prevent double-pledging the same physical asset (by serial number) across active settlements
        for (const asset of (asset_items || []).filter((a) => a.serial_number)) {
            const dup = await db.pgGet(
                `SELECT sa.id, ds.settlement_number FROM settlement_assets_items sa
                 JOIN debt_settlements ds ON ds.id = sa.settlement_id
                 WHERE sa.serial_number = $1 AND ds.company_id = $2 AND ds.status NOT IN ('rejected', 'voided')`,
                [asset.serial_number, companyId]
            );
            if (dup) {
                return res.status(400).json({ success: false, error: `Serial number ${asset.serial_number} already in settlement ${dup.settlement_number}` });
            }
        }

        const hasLandOrProperty = (asset_items || []).some((a) => ["Land", "Property"].includes(a.asset_type) || a.needs_legal_transfer);

        client = await db.getClient();
        await client.query("BEGIN");

        const countRes = await client.query(`SELECT COUNT(*) FROM debt_settlements WHERE company_id = $1`, [companyId]);
        const num = `STL/${new Date().getFullYear()}/${String(parseInt(countRes.rows[0].count) + 1).padStart(4, "0")}`;

        const outstandingBefore = parseFloat(customer.initial_balance || 0);

        const settlRes = await client.query(
            `INSERT INTO debt_settlements (
                company_id, branch_id, settlement_number, customer_id, settlement_date, settlement_type,
                total_value, outstanding_before, outstanding_after,
                cash_amount, goods_amount, asset_amount, cheque_amount,
                is_conditional, status, notes, recorded_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending',$15,$16)
             RETURNING *`,
            [
                companyId, req.user.branch_id || null, num, customer_id,
                settlement_date || new Date().toISOString().split("T")[0], settlement_type,
                totalValue, outstandingBefore, Math.max(0, outstandingBefore - totalValue),
                cashTotal, goodsTotal, assetTotal, chequeTotal,
                hasLandOrProperty, notes || null, req.user.id,
            ]
        );
        const settlement = settlRes.rows[0];

        for (const link of invoice_links) {
            const invRes = await client.query(`SELECT invoice_number FROM invoices WHERE id = $1 AND company_id = $2`, [link.invoice_id, companyId]);
            await client.query(
                `INSERT INTO settlement_invoice_links (settlement_id, invoice_id, invoice_number, amount_allocated)
                 VALUES ($1,$2,$3,$4)`,
                [settlement.id, link.invoice_id, invRes.rows[0]?.invoice_number || "", link.amount_allocated]
            );
        }

        for (const g of (goods_items || [])) {
            await client.query(
                `INSERT INTO settlement_goods_items (settlement_id, description, quantity, unit, condition, rate, total_value, stock_type, notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [settlement.id, g.description, g.quantity || 1, g.unit || "pcs", g.condition || "good", g.rate || 0, g.total_value || 0, g.stock_type || "fresh", g.notes || null]
            );
        }

        for (const a of (asset_items || [])) {
            await client.query(
                `INSERT INTO settlement_assets_items (
                    settlement_id, asset_name, asset_type, condition, weight_grams, purity_percent, rate_per_gram,
                    customer_claimed_value, agreed_value, serial_number, document_number, needs_legal_transfer, notes
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [
                    settlement.id, a.asset_name, a.asset_type, a.condition || "good",
                    a.weight_grams || null, a.purity_percent || null, a.rate_per_gram || null,
                    a.customer_claimed_value || null, a.agreed_value,
                    a.serial_number || null, a.document_number || null,
                    a.needs_legal_transfer || false, a.notes || null,
                ]
            );
        }

        for (const c of (cheque_items || [])) {
            await client.query(
                `INSERT INTO settlement_cheque_items (settlement_id, bank_name, account_holder, cheque_number, cheque_date, amount)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [settlement.id, c.bank_name, c.account_holder || null, c.cheque_number, c.cheque_date, c.amount]
            );
        }

        const doneByName = await getUserName(client, req.user.id);
        await client.query(
            `INSERT INTO settlement_history (settlement_id, action, done_by, done_by_name, notes)
             VALUES ($1,'created',$2,$3,$4)`,
            [settlement.id, req.user.id, doneByName, `Settlement created for ₹${totalValue.toLocaleString("en-IN")}`]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            settlement_number: num,
            settlement_id: settlement.id,
            total_value: totalValue,
            is_conditional: hasLandOrProperty,
            message: hasLandOrProperty
                ? `Settlement ${num} created — pending approval. Note: Land/Property requires legal transfer before outstanding reduces.`
                : `Settlement ${num} created — pending admin approval`,
        });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Create settlement error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/:id/approve
router.post("/:id/approve", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const companyId = req.user.active_company_id;

        client = await db.getClient();
        await client.query("BEGIN");

        const sRes = await client.query(`SELECT * FROM debt_settlements WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
        const s = sRes.rows[0];
        if (!s) throw new Error("Settlement not found");
        if (s.status !== "pending") throw new Error(`Status is already ${s.status}`);

        await client.query(
            `UPDATE debt_settlements SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
            [req.user.id, s.id]
        );

        if (!s.is_conditional) {
            await applySettlementPayments(client, s, companyId);
        }

        const doneByName = await getUserName(client, req.user.id);
        await client.query(
            `INSERT INTO settlement_history (settlement_id, action, done_by, done_by_name, notes)
             VALUES ($1,'approved',$2,$3,$4)`,
            [
                s.id, req.user.id, doneByName,
                s.is_conditional
                    ? "Conditionally approved — outstanding reduces after legal transfer"
                    : `Approved — outstanding reduced by ₹${parseFloat(s.total_value).toLocaleString("en-IN")}`,
            ]
        );

        await client.query("COMMIT");

        // Best-effort WhatsApp notification — never blocks the response
        db.pgGet(`SELECT COALESCE(nickname, username) AS name, phone FROM users WHERE id = $1`, [s.customer_id])
            .then((cust) => {
                if (!cust?.phone) return;
                const msg = s.is_conditional
                    ? `Dear ${cust.name},\n\nYour settlement ${s.settlement_number} of ₹${parseFloat(s.total_value).toLocaleString("en-IN")} is approved in principle.\n\nOutstanding will reduce after legal transfer is confirmed.\n\nJBS Knit Wear`
                    : `Dear ${cust.name},\n\nYour settlement ${s.settlement_number} of ₹${parseFloat(s.total_value).toLocaleString("en-IN")} is approved.\n\nOutstanding reduced. Thank you!\nJBS Knit Wear`;
                return sendWhatsApp(cust.phone, msg);
            })
            .catch(() => {});

        res.json({
            success: true,
            conditional: s.is_conditional,
            message: s.is_conditional
                ? "Approved conditionally — outstanding reduces after legal transfer confirmation"
                : "Approved — invoices updated and outstanding reduced",
        });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Approve settlement error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/:id/reject
router.post("/:id/reject", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const { reason } = req.body;
        if (!reason || reason.trim().length < 3) return res.status(400).json({ success: false, error: "Reason required" });

        client = await db.getClient();
        await client.query("BEGIN");

        const sRes = await client.query(
            `SELECT id FROM debt_settlements WHERE id = $1 AND company_id = $2 AND status = 'pending'`,
            [req.params.id, req.user.active_company_id]
        );
        if (!sRes.rows[0]) throw new Error("Settlement not found or not pending");

        await client.query(
            `UPDATE debt_settlements SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2`,
            [reason.trim(), req.params.id]
        );

        const doneByName = await getUserName(client, req.user.id);
        await client.query(
            `INSERT INTO settlement_history (settlement_id, action, done_by, done_by_name, notes)
             VALUES ($1,'rejected',$2,$3,$4)`,
            [req.params.id, req.user.id, doneByName, reason.trim()]
        );

        await client.query("COMMIT");
        res.json({ success: true });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Reject settlement error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/:id/record-guideline-transfer
// Records a payment made TO the customer (e.g. govt guideline value on a land settlement)
// BEFORE the land settlement's legal transfer is confirmed. Must happen first so the
// customer's ledger shows this credit ahead of the land-outstanding-reduction entry.
router.post("/:id/record-guideline-transfer", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        await ensureGuidelineTransferColumns();
        const companyId = req.user.active_company_id;
        const { amount, payment_mode, payment_date, reference_number, paid_to, notes } = req.body;

        const parsedAmount = parseFloat(amount || 0);
        if (parsedAmount <= 0) return res.status(400).json({ success: false, error: "Transfer amount must be greater than zero" });
        if (!["cash", "bank", "upi", "cheque"].includes(String(payment_mode || "").toLowerCase())) {
            return res.status(400).json({ success: false, error: "Valid payment mode required (cash/bank/upi/cheque)" });
        }
        if (!payment_date) return res.status(400).json({ success: false, error: "Payment date required" });

        client = await db.getClient();
        await client.query("BEGIN");

        const sRes = await client.query(
            `SELECT ds.*, COALESCE(c.nickname, c.username) AS customer_name, c.phone AS customer_phone
             FROM debt_settlements ds
             LEFT JOIN users c ON c.id = ds.customer_id
             WHERE ds.id = $1 AND ds.company_id = $2`,
            [req.params.id, companyId]
        );
        const settlement = sRes.rows[0];
        if (!settlement) throw new Error("Settlement not found");
        if (settlement.guideline_transfer_recorded) {
            throw new Error(`Guideline transfer already recorded on ${settlement.guideline_transfer_date}`);
        }

        const mode = String(payment_mode).toLowerCase();

        await createCustomerLedgerEvent(client, {
            companyId,
            branchId: settlement.branch_id,
            customerId: settlement.customer_id,
            type: "GUIDELINE_TRANSFER",
            category: "PAYMENT_TO_CUSTOMER",
            amount: parsedAmount,
            date: payment_date,
            description: `Guideline value transfer for land settlement ${settlement.settlement_number}${reference_number ? ` — Ref: ${reference_number}` : ""}`,
            referenceType: "SETTLEMENT",
            referenceId: settlement.id,
            createdBy: req.user.id,
            meta: { payment_mode: mode, reference_number: reference_number || null, paid_to: paid_to || settlement.customer_name },
        });

        await recomputeCustomerBalance(client, settlement.customer_id, companyId);

        await client.query(
            `UPDATE debt_settlements SET
                guideline_transfer_recorded = true, guideline_transfer_amount = $1,
                guideline_transfer_date = $2, guideline_transfer_mode = $3,
                guideline_transfer_reference = $4, updated_at = NOW()
             WHERE id = $5`,
            [parsedAmount, payment_date, mode, reference_number || null, settlement.id]
        );

        const description = `Guideline transfer of ₹${parsedAmount.toLocaleString("en-IN")} paid to ${settlement.customer_name} via ${mode.toUpperCase()}`;
        if (mode === "cash") {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, notes, reference_id, created_at)
                 VALUES ($1,$2,'LAND_GUIDELINE_TRANSFER',$3,'out',$4,$5,$6,NOW())`,
                [companyId, settlement.branch_id, parsedAmount, payment_date, description, settlement.id]
            );
        } else {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, date, transaction_id, reference_id, created_at)
                 VALUES ($1,$2,'LAND_GUIDELINE_TRANSFER',$3,'out',$4,$5,$6,NOW())`,
                [companyId, settlement.branch_id, parsedAmount, payment_date, reference_number || null, settlement.id]
            );
        }

        const doneByName = await getUserName(client, req.user.id);
        await client.query(
            `INSERT INTO settlement_history (settlement_id, action, done_by, done_by_name, notes)
             VALUES ($1,'guideline_transfer_recorded',$2,$3,$4)`,
            [settlement.id, req.user.id, doneByName, `₹${parsedAmount.toLocaleString("en-IN")} transferred to ${settlement.customer_name} via ${mode.toUpperCase()}`]
        );

        await client.query("COMMIT");

        if (settlement.customer_phone) {
            sendWhatsApp(
                settlement.customer_phone,
                `Dear ${settlement.customer_name},\n\n₹${parsedAmount.toLocaleString("en-IN")} has been transferred to you as guideline value payment for settlement ${settlement.settlement_number}.\n\nDate: ${payment_date}\nMode: ${mode.toUpperCase()}${reference_number ? `\nRef: ${reference_number}` : ""}\n\nThis is reflected in your account statement.\n\nJBS Knit Wear, Tiruppur`
            ).catch(() => {});
        }

        res.json({
            success: true,
            amount_transferred: parsedAmount,
            message: `₹${parsedAmount.toLocaleString("en-IN")} guideline transfer recorded in ${settlement.customer_name}'s ledger and ${mode} ledger updated`,
        });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Record guideline transfer error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/:id/confirm-transfer — for conditional (land/property) settlements
router.post("/:id/confirm-transfer", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        await ensureGuidelineTransferColumns();
        const companyId = req.user.active_company_id;

        client = await db.getClient();
        await client.query("BEGIN");

        const sRes = await client.query(`SELECT * FROM debt_settlements WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
        const s = sRes.rows[0];
        if (!s) throw new Error("Settlement not found");
        if (!s.is_conditional) throw new Error("Not a conditional settlement");
        if (s.status !== "approved") throw new Error("Settlement must be approved first");
        if (s.legal_transfer_done) throw new Error("Already confirmed");

        await client.query(`UPDATE debt_settlements SET legal_transfer_done = true, updated_at = NOW() WHERE id = $1`, [s.id]);

        await applySettlementPayments(client, s, companyId);

        const doneByName = await getUserName(client, req.user.id);
        await client.query(
            `INSERT INTO settlement_history (settlement_id, action, done_by, done_by_name, notes)
             VALUES ($1,'legal_transfer_confirmed',$2,$3,'Legal transfer confirmed — outstanding reduced')`,
            [s.id, req.user.id, doneByName]
        );

        await client.query("COMMIT");
        res.json({ success: true, message: "Legal transfer confirmed — outstanding reduced now" });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Confirm transfer error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/cheques/:id/cleared
router.post("/cheques/:id/cleared", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const { cleared_date } = req.body;
        const companyId = req.user.active_company_id;

        client = await db.getClient();
        await client.query("BEGIN");

        const cRes = await client.query(
            `SELECT sc.*, ds.settlement_number, ds.company_id, ds.branch_id
             FROM settlement_cheque_items sc
             JOIN debt_settlements ds ON ds.id = sc.settlement_id
             WHERE sc.id = $1`,
            [req.params.id]
        );
        const cheque = cRes.rows[0];
        if (!cheque || cheque.company_id !== companyId) throw new Error("Cheque not found");
        if (cheque.status !== "pending") throw new Error(`Cheque already ${cheque.status}`);

        await client.query(
            `UPDATE settlement_cheque_items SET status = 'cleared', cleared_date = $1 WHERE id = $2`,
            [cleared_date || new Date().toISOString().split("T")[0], req.params.id]
        );

        await client.query(
            `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date, notes, created_at)
             VALUES ($1,$2,'SETTLEMENT_CHEQUE',$3,'in',$4,CURRENT_DATE,$5,NOW())`,
            [companyId, cheque.branch_id, cheque.amount, cheque.bank_name, `Cheque cleared: ${cheque.cheque_number} — ${cheque.settlement_number}`]
        );

        await client.query("COMMIT");
        res.json({ success: true, message: "Cheque cleared — bank ledger updated" });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Cheque clear error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/cheques/:id/bounced
router.post("/cheques/:id/bounced", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const { bounce_reason, bank_charges } = req.body;
        const companyId = req.user.active_company_id;

        client = await db.getClient();
        await client.query("BEGIN");

        const cRes = await client.query(
            `SELECT sc.*, ds.customer_id, ds.settlement_number, ds.company_id, ds.branch_id
             FROM settlement_cheque_items sc
             JOIN debt_settlements ds ON ds.id = sc.settlement_id
             WHERE sc.id = $1`,
            [req.params.id]
        );
        const cheque = cRes.rows[0];
        if (!cheque || cheque.company_id !== companyId) throw new Error("Cheque not found");
        if (cheque.status !== "pending") throw new Error(`Cheque already ${cheque.status}`);

        const charges = parseFloat(bank_charges || 0);
        const restoreAmount = parseFloat(cheque.amount) + charges;

        await client.query(
            `UPDATE settlement_cheque_items SET status = 'bounced', bounce_reason = $1, bank_charges = $2 WHERE id = $3`,
            [bounce_reason || null, charges, req.params.id]
        );

        // A bounced cheque means that portion of the settlement never actually materialized —
        // restore it directly on the customer's opening-balance baseline (the same field
        // recomputeCustomerBalance treats as a persistent adjustment layered under the
        // invoice/payment math), since the settlement's payment total isn't cleanly
        // separable back into cash/goods/asset/cheque portions at the invoice level.
        await client.query(
            `UPDATE users SET initial_balance = COALESCE(initial_balance, 0) + $1 WHERE id = $2`,
            [restoreAmount, cheque.customer_id]
        );

        if (charges > 0) {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, notes, created_at)
                 VALUES ($1,$2,'CHEQUE_BOUNCE_CHARGE',$3,'out',CURRENT_DATE,$4,NOW())`,
                [companyId, cheque.branch_id, charges, `Bank charges — bounced cheque ${cheque.cheque_number}`]
            );
        }

        await client.query("COMMIT");
        res.json({ success: true, restored_amount: restoreAmount, message: `Cheque bounced — ₹${restoreAmount.toLocaleString("en-IN")} restored to customer outstanding` });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Cheque bounce error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/settlements/assets/:id/dispose
router.post("/assets/:id/dispose", authMiddleware, async (req, res) => {
    let client;
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
        const { disposal_status, disposal_value, notes } = req.body;
        const companyId = req.user.active_company_id;

        client = await db.getClient();
        await client.query("BEGIN");

        const aRes = await client.query(
            `SELECT sa.*, ds.company_id, ds.branch_id
             FROM settlement_assets_items sa
             JOIN debt_settlements ds ON ds.id = sa.settlement_id
             WHERE sa.id = $1`,
            [req.params.id]
        );
        const asset = aRes.rows[0];
        if (!asset || asset.company_id !== companyId) throw new Error("Asset not found");

        await client.query(
            `UPDATE settlement_assets_items SET
                disposal_status = $1, disposal_value = $2,
                notes = CONCAT(COALESCE(notes, ''), ' | Disposal: ', $3::text)
             WHERE id = $4`,
            [disposal_status, disposal_value || 0, notes || "", req.params.id]
        );

        if (disposal_status === "sold" && parseFloat(disposal_value || 0) > 0) {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, notes, created_at)
                 VALUES ($1,$2,'ASSET_SALE',$3,'in',CURRENT_DATE,$4,NOW())`,
                [companyId, asset.branch_id, disposal_value, `Asset sold: ${asset.asset_name} — ${notes || ""}`]
            );
        }

        await client.query("COMMIT");
        res.json({ success: true, message: `Asset marked as ${disposal_status}` });
    } catch (e) {
        if (client) await client.query("ROLLBACK");
        console.error("Asset dispose error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
