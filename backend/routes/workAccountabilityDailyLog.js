// backend/routes/workAccountabilityDailyLog.js
// EOD job-site counting + Purchase Bill conversion — additive extension of
// Work Accountability. Mounted as a SECOND router at the existing
// /api/work-accountability prefix (server.js gets one extra app.use line);
// the original workAccountability.js is never modified.
//
// Reuses tables built earlier this session (work_job_groups, work_daily_logs,
// supplier_deal_terms — extended via ALTER TABLE ADD COLUMN IF NOT EXISTS,
// approved and run separately) plus one genuinely new table,
// work_daily_log_items. Existing work_daily_logs column is named
// marked_by_user_id (not marked_by) — used as-is here, no duplicate column.
//
// Purchase Bill conversion (POST /daily-logs/:id/confirm) intentionally
// duplicates only the minimal subset of routes/purchaseBillRoutes.js's
// writes (purchase_bills, purchase_bill_items, branch_inventory) rather
// than calling that route, per explicit decision — that file can't be
// imported as a function (it's a full Express handler with multer
// middleware) and must not be modified. No GST, broker, or file-upload
// handling here by design.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const isManager = (role) => ["admin", "superadmin", "manager", "branch_manager"].includes((role || "").toLowerCase());
const isAdmin = (role) => ["admin", "superadmin"].includes((role || "").toLowerCase());
const requireManager = (req, res, next) => (isManager(req.user.role) ? next() : res.status(403).json({ error: "Manager/Admin only" }));
const requireAdmin = (req, res, next) => (isAdmin(req.user.role) ? next() : res.status(403).json({ error: "Admin only" }));

// Shift ends 18:00. No OT rate exists anywhere in the codebase (confirmed
// by investigation) — ot_amount always stays 0 until a rate is provided.
const SHIFT_END_MINUTES = 18 * 60;
const computeOtHours = (checkOutTime) => {
    if (!checkOutTime) return 0;
    const [h, m] = checkOutTime.split(":").map(Number);
    const minutes = h * 60 + (m || 0);
    return minutes <= SHIFT_END_MINUTES ? 0 : Number(((minutes - SHIFT_END_MINUTES) / 60).toFixed(2));
};

const logAudit = (req, { entityType, entityId = null, action, oldValue = null, newValue = null, jobId = null, groupId = null }) =>
    db.pgRun(
        `INSERT INTO audit_events (company_id, branch_id, actor_user_id, job_id, group_id, entity_type, entity_id, action, old_value, new_value, reason, risk_level, ip_address, session_info)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
            req.user.active_company_id, req.user.branch_id || null, req.user.id, jobId, groupId,
            entityType, entityId, action,
            oldValue !== null ? JSON.stringify(oldValue) : null,
            newValue !== null ? JSON.stringify(newValue) : null,
            null, "low", req.ip || null, req.headers["user-agent"] || null,
        ]
    ).catch((e) => console.error("audit_events insert failed:", e.message));

// ============================================================
// GROUPS ↔ JOB
// ============================================================
router.post("/jobs/:jobId/groups", authMiddleware, requireManager, async (req, res) => {
    try {
        const { group_ids } = req.body;
        if (!Array.isArray(group_ids) || group_ids.length === 0) return res.json({ success: false, error: "group_ids array required" });

        const job = await db.pgGet(`SELECT id FROM jobs WHERE id = $1 AND company_id = $2`, [req.params.jobId, req.user.active_company_id]);
        if (!job) return res.json({ success: false, error: "Job not found" });

        const assigned = [];
        for (const groupId of group_ids) {
            const group = await db.pgGet(`SELECT id, name FROM employee_groups WHERE id = $1 AND company_id = $2 AND is_active = true`, [groupId, req.user.active_company_id]);
            if (!group) continue;
            const result = await db.pgRun(
                `INSERT INTO work_job_groups (company_id, job_id, group_id, assigned_by, is_active)
                 VALUES ($1,$2,$3,$4,true)
                 ON CONFLICT (job_id, group_id) DO UPDATE SET is_active = true
                 RETURNING *`,
                [req.user.active_company_id, req.params.jobId, groupId, req.user.id]
            );
            await logAudit(req, { entityType: "work_job_groups", entityId: result.rows[0].id, action: "group_assigned_to_job", newValue: { group_id: groupId }, jobId: Number(req.params.jobId), groupId: Number(groupId) });
            assigned.push({ ...result.rows[0], group_name: group.name });
        }
        res.json({ success: true, assigned });
    } catch (e) {
        console.error("assign groups error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

router.get("/jobs/:jobId/groups", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT wjg.id AS assignment_id, wjg.group_id, eg.name AS group_name,
                    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = eg.id AND gm.is_active = true) AS member_count
             FROM work_job_groups wjg
             JOIN employee_groups eg ON eg.id = wjg.group_id
             WHERE wjg.job_id = $1 AND wjg.company_id = $2 AND wjg.is_active = true
             ORDER BY eg.name`,
            [req.params.jobId, req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

// ============================================================
// DAILY LOGS — read-only / admin-review here. Creation and item
// submission are EMPLOYEE actions now (corrected permission model)
// and live under /api/employee-portal (employeePortalRoutes.js),
// using employeeAuth/req.employee — a completely different auth
// token shape than this file's authMiddleware/req.user. See that
// file's "MY DAILY LOGS" section for POST /my-daily-logs and
// POST /my-daily-logs/:id/items.
// ============================================================
router.get("/jobs/:jobId/daily-logs", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT wdl.*, eg.name AS group_name, u.username AS marked_by_name,
                    (SELECT COUNT(*) FROM work_daily_log_items i WHERE i.daily_log_id = wdl.id) AS item_count
             FROM work_daily_logs wdl
             JOIN employee_groups eg ON eg.id = wdl.group_id
             LEFT JOIN users u ON u.id = wdl.marked_by_user_id
             WHERE wdl.job_id = $1 AND wdl.company_id = $2
             ORDER BY wdl.log_date DESC, eg.name`,
            [req.params.jobId, req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

router.get("/daily-logs/:id", authMiddleware, async (req, res) => {
    try {
        const log = await db.pgGet(
            `SELECT wdl.*, eg.name AS group_name, u.username AS marked_by_name, j.title AS job_title
             FROM work_daily_logs wdl
             JOIN employee_groups eg ON eg.id = wdl.group_id
             JOIN jobs j ON j.id = wdl.job_id
             LEFT JOIN users u ON u.id = wdl.marked_by_user_id
             WHERE wdl.id = $1 AND wdl.company_id = $2`,
            [req.params.id, req.user.active_company_id]
        );
        if (!log) return res.status(404).json({ error: "Log not found" });

        const items = await db.pgAll(`SELECT * FROM work_daily_log_items WHERE daily_log_id = $1 ORDER BY sort_order, id`, [log.id]);

        let members = [];
        if (Array.isArray(log.member_snapshot)) {
            members = await db.pgAll(`SELECT id, username FROM users WHERE id = ANY($1::int[])`, [log.member_snapshot]);
        }

        const jobDetails = await db.pgGet(
            `SELECT wjd.supplier_id, s.name AS supplier_name, sdt.mistake_pcs_allowed, sdt.fresh_only_strict
             FROM work_job_details wjd
             LEFT JOIN suppliers s ON s.id = wjd.supplier_id
             LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = wjd.supplier_id
             WHERE wjd.job_id = $1`,
            [log.job_id]
        );

        res.json({ log, items, members, supplier: jobDetails || null });
    } catch (e) {
        console.error("daily log detail error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// SUPPLIER DEAL TERMS
// ============================================================
router.get("/supplier-deal-terms/:supplierId", authMiddleware, async (req, res) => {
    try {
        const term = await db.pgGet(`SELECT * FROM supplier_deal_terms WHERE supplier_id = $1`, [req.params.supplierId]);
        res.json(term || { supplier_id: Number(req.params.supplierId), mistake_pcs_allowed: false, fresh_only_strict: true, notes: null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put("/supplier-deal-terms/:supplierId", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { mistake_pcs_allowed, fresh_only_strict, notes } = req.body;
        const supplier = await db.pgGet(`SELECT id FROM suppliers WHERE id = $1 AND company_id = $2`, [req.params.supplierId, req.user.active_company_id]);
        if (!supplier) return res.json({ success: false, error: "Supplier not found" });

        const result = await db.pgRun(
            `INSERT INTO supplier_deal_terms (company_id, supplier_id, mistake_pcs_allowed, fresh_only_strict, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (supplier_id) DO UPDATE SET mistake_pcs_allowed = $3, fresh_only_strict = $4, notes = $5, updated_at = NOW()
             RETURNING *`,
            [req.user.active_company_id, req.params.supplierId, !!mistake_pcs_allowed, fresh_only_strict !== false, notes || null, req.user.id]
        );
        res.json({ success: true, term: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ============================================================
// CONFIRM EOD REPORT → convert to Purchase Bill
// ============================================================
router.post("/daily-logs/:id/confirm", authMiddleware, requireAdmin, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        const companyId = req.user.active_company_id;
        const branchId = req.user.branch_id || 1;

        const logRes = await client.query(`SELECT * FROM work_daily_logs WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
        const log = logRes.rows[0];
        if (!log) throw new Error("Log not found");
        if (log.admin_confirmed) throw new Error("Already confirmed");
        if (!["yes", "partial"].includes(log.reached_status)) throw new Error("reached_status must be yes or partial to confirm");

        const itemsRes = await client.query(`SELECT * FROM work_daily_log_items WHERE daily_log_id = $1`, [log.id]);
        if (itemsRes.rows.length === 0) throw new Error("Items list must not be empty");

        await client.query(
            `UPDATE work_daily_logs SET admin_confirmed = true, confirmed_by = $1, confirmed_at = NOW(), updated_at = NOW() WHERE id = $2`,
            [req.user.id, log.id]
        );
        await logAudit(req, { entityType: "work_daily_logs", entityId: log.id, action: "eod_confirmed", jobId: log.job_id, groupId: log.group_id });

        await client.query("COMMIT");

        // Conversion happens as a SEPARATE step/transaction — a failure here
        // must not undo the confirmation itself (matches the explicit
        // decision that conversion failure ≠ rollback of the confirm).
        try {
            const jobDetails = await db.pgGet(
                `SELECT wjd.supplier_id, s.name AS supplier_name, sdt.mistake_pcs_allowed
                 FROM work_job_details wjd
                 LEFT JOIN suppliers s ON s.id = wjd.supplier_id
                 LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = wjd.supplier_id
                 WHERE wjd.job_id = $1`,
                [log.job_id]
            );
            if (!jobDetails?.supplier_id) throw new Error("This job has no supplier/PO linked — cannot convert to a Purchase Bill");

            const items = itemsRes.rows;
            const mistakeAllowed = !!jobDetails.mistake_pcs_allowed;

            const client2 = await db.getClient();
            try {
                await client2.query("BEGIN");

                let subTotal = 0;
                const lineData = [];
                for (const item of items) {
                    const qty = Number(item.fresh_pcs || 0) + (mistakeAllowed ? Number(item.mistake_pcs || 0) : 0);
                    if (qty <= 0) continue;
                    let unitPrice = 0;
                    if (item.product_id) {
                        const product = await client2.query(`SELECT cost_price FROM products WHERE id = $1`, [item.product_id]);
                        unitPrice = Number(product.rows[0]?.cost_price || 0);
                    }
                    const lineTotal = qty * unitPrice;
                    subTotal += lineTotal;
                    lineData.push({ ...item, qty, unitPrice, lineTotal });
                }

                const billNumber = `WA-EOD-${log.id}`;
                const billRes = await client2.query(
                    `INSERT INTO purchase_bills
                        (company_id, branch_id, supplier_id, supplier_name, bill_number, bill_date,
                         sub_total, tax_total, cgst_total, sgst_total, igst_total, total_amount,
                         discount_amount, gst_type, paid_amount, balance_amount, status, bill_type,
                         file_url, broker_id, broker_commission_rate, bill_category, is_deleted, notes)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,0,$7,0,'INTRA_STATE',0,$7,'pending','TAX',NULL,NULL,0,'PRODUCT',false,$8)
                     RETURNING id`,
                    [companyId, branchId, jobDetails.supplier_id, jobDetails.supplier_name, billNumber, log.log_date, subTotal, `Converted from Work Accountability Daily Log ID ${log.id}`]
                );
                const billId = billRes.rows[0].id;

                for (const line of lineData) {
                    await client2.query(
                        `INSERT INTO purchase_bill_items
                            (bill_id, product_id, description, hsn_code, unit, quantity, unit_price,
                             tax_percent, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, line_total)
                         VALUES ($1,$2,$3,NULL,'pcs',$4,$5,0,0,0,0,0,0,0,$6)`,
                        [billId, line.product_id || null, line.product_name_snapshot, line.qty, line.unitPrice, line.lineTotal]
                    );
                    if (line.product_id) {
                        await client2.query(
                            `INSERT INTO branch_inventory (company_id, branch_id, product_id, current_stock, last_updated)
                             VALUES ($1,$2,$3,$4,NOW())
                             ON CONFLICT (branch_id, product_id) DO UPDATE SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock, last_updated = NOW()`,
                            [companyId, branchId, line.product_id, line.qty]
                        );
                    }
                }

                await client2.query("COMMIT");
                await db.pgRun(`UPDATE work_daily_logs SET converted_to_purchase_id = $1, conversion_status = 'converted' WHERE id = $2`, [billId, log.id]);
                return res.json({ success: true, admin_confirmed: true, conversion_status: "converted", purchase_bill_id: billId, purchase_bill_number: billNumber });
            } catch (convErr) {
                await client2.query("ROLLBACK").catch(() => {});
                throw convErr;
            } finally {
                client2.release();
            }
        } catch (convErr) {
            console.error("EOD → Purchase conversion failed:", convErr.message);
            await db.pgRun(`UPDATE work_daily_logs SET conversion_status = 'failed' WHERE id = $1`, [log.id]);
            return res.json({ success: true, admin_confirmed: true, conversion_status: "failed", conversion_error: convErr.message });
        }
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

export default router;
