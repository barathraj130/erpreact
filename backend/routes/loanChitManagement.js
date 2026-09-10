// backend/routes/loanChitManagement.js
//
// CRUD for the employee loan and chit-fund management admin pages. New,
// standalone feature: only touches its own new tables (employee_loans,
// loan_repayments, chit_groups, chit_memberships). Mounted at
// /api/loan-chit in server.js (two added lines, nothing else touched).
//
// ESM + this codebase's db.pgAll/pgGet/getClient() pattern, authMiddleware,
// req.user.id / req.user.active_company_id / req.user.role. Admin-gated:
// these are back-office ledgers, not employee self-service.

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const isAdmin = (req) => req.user.role === "admin" || req.user.role === "superadmin";
const guard = (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return false; }
  return true;
};

// ── LOANS ──────────────────────────────────────────────────────────────────

router.get("/loans", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const { status } = req.query;
    const companyId = req.user.active_company_id;
    const rows = await db.pgAll(
      `SELECT el.*,
          COALESCE(u.nickname, u.username) AS employee_name,
          COALESCE(ap.nickname, ap.username) AS approved_by_name
       FROM employee_loans el
       LEFT JOIN users u ON u.id = el.employee_id
       LEFT JOIN users ap ON ap.id = el.approved_by
       WHERE el.company_id = $1 AND ($2::text IS NULL OR el.status = $2)
       ORDER BY el.created_at DESC`,
      [companyId, status || null]
    );
    res.json(rows);
  } catch (e) {
    console.error("[loan-chit/loans]", e.message);
    res.json([]);
  }
});

router.post("/loans", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const companyId = req.user.active_company_id;
    const {
      employee_id, hub_form_id, loan_amount, purpose, repayment_months,
      monthly_emi, interest_rate, guarantor_name, guarantor_phone, guarantor_relation, notes,
    } = req.body;
    if (!employee_id || !loan_amount || !purpose || !repayment_months) {
      return res.json({ success: false, error: "Employee, amount, purpose and repayment months are required" });
    }
    const row = await db.pgGet(
      `INSERT INTO employee_loans (
          company_id, employee_id, hub_form_id, loan_amount, purpose, repayment_months,
          monthly_emi, interest_rate, guarantor_name, guarantor_phone, guarantor_relation,
          balance_due, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$4,$12)
       RETURNING *`,
      [
        companyId, employee_id, hub_form_id || null, loan_amount, purpose, repayment_months,
        monthly_emi || null, interest_rate || 0, guarantor_name || null, guarantor_phone || null,
        guarantor_relation || null, notes || null,
      ]
    );
    res.json({ success: true, loan: row });
  } catch (e) {
    console.error("[loan-chit/loans create]", e.message);
    res.json({ success: false, error: e.message });
  }
});

router.put("/loans/:id", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const { status, approved_amount, monthly_emi, rejection_reason, notes } = req.body;
    const setApproved = status === "approved" || status === "active";
    const row = await db.pgGet(
      `UPDATE employee_loans SET
          status = COALESCE($1, status),
          approved_amount = COALESCE($2, approved_amount),
          monthly_emi = COALESCE($3, monthly_emi),
          rejection_reason = COALESCE($4, rejection_reason),
          notes = COALESCE($5, notes),
          approved_by = CASE WHEN $6 THEN $7 ELSE approved_by END,
          approved_at = CASE WHEN $6 AND approved_at IS NULL THEN NOW() ELSE approved_at END,
          balance_due = CASE WHEN $2 IS NOT NULL THEN $2 - COALESCE(total_repaid, 0) ELSE balance_due END,
          updated_at = NOW()
       WHERE id = $8 AND company_id = $9
       RETURNING *`,
      [status || null, approved_amount ?? null, monthly_emi ?? null, rejection_reason || null,
       notes || null, setApproved, req.user.id, req.params.id, req.user.active_company_id]
    );
    if (!row) return res.json({ success: false, error: "Loan not found" });
    res.json({ success: true, loan: row });
  } catch (e) {
    console.error("[loan-chit/loans update]", e.message);
    res.json({ success: false, error: e.message });
  }
});

router.get("/loans/:id/repayments", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const rows = await db.pgAll(
      `SELECT lr.*, COALESCE(u.nickname, u.username) AS recorded_by_name
       FROM loan_repayments lr
       LEFT JOIN users u ON u.id = lr.recorded_by
       WHERE lr.loan_id = $1 ORDER BY lr.repayment_date DESC, lr.id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

router.post("/loans/:id/repayment", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { amount, repayment_date, repayment_mode, notes } = req.body;
    if (!amount || Number(amount) <= 0) throw new Error("Repayment amount must be greater than zero");

    const loanRes = await client.query(
      `SELECT * FROM employee_loans WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.active_company_id]
    );
    const loan = loanRes.rows[0];
    if (!loan) throw new Error("Loan not found");

    await client.query(
      `INSERT INTO loan_repayments (loan_id, company_id, employee_id, amount, repayment_date, repayment_mode, recorded_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        loan.id, req.user.active_company_id, loan.employee_id, amount,
        repayment_date || new Date().toISOString().split("T")[0],
        repayment_mode || "salary_deduction", req.user.id, notes || null,
      ]
    );

    const newRepaid = Number(loan.total_repaid || 0) + Number(amount);
    const principal = Number(loan.approved_amount || loan.loan_amount);
    const newBalance = Math.max(0, principal - newRepaid);
    const newStatus = newBalance <= 0 ? "closed" : (loan.status === "approved" ? "active" : loan.status);

    await client.query(
      `UPDATE employee_loans SET total_repaid = $1, balance_due = $2, status = $3, updated_at = NOW() WHERE id = $4`,
      [newRepaid, newBalance, newStatus, loan.id]
    );

    await client.query("COMMIT");
    res.json({ success: true, total_repaid: newRepaid, balance_due: newBalance, status: newStatus });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[loan-chit/repayment]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── CHIT GROUPS ────────────────────────────────────────────────────────────

router.get("/chit-groups", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const companyId = req.user.active_company_id;
    const groups = await db.pgAll(
      `SELECT cg.*,
          COALESCE(m.nickname, m.username) AS managed_by_name,
          COUNT(cm.id) AS member_count,
          COALESCE(SUM(cm.total_paid), 0) AS total_collected
       FROM chit_groups cg
       LEFT JOIN users m ON m.id = cg.managed_by
       LEFT JOIN chit_memberships cm ON cm.chit_group_id = cg.id
       WHERE cg.company_id = $1
       GROUP BY cg.id, m.nickname, m.username
       ORDER BY cg.created_at DESC`,
      [companyId]
    );
    res.json(groups);
  } catch (e) {
    console.error("[loan-chit/chit-groups]", e.message);
    res.json([]);
  }
});

router.post("/chit-groups", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const companyId = req.user.active_company_id;
    const { group_name, chit_type, monthly_amount, duration_months, total_chit_value, start_date, notes } = req.body;
    if (!group_name?.trim() || !monthly_amount || !duration_months) {
      return res.json({ success: false, error: "Group name, monthly amount and duration are required" });
    }
    const row = await db.pgGet(
      `INSERT INTO chit_groups (company_id, group_name, chit_type, monthly_amount, duration_months, total_chit_value, start_date, managed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        companyId, group_name.trim(), chit_type === "external" ? "external" : "internal",
        monthly_amount, duration_months,
        total_chit_value || (Number(monthly_amount) * Number(duration_months)),
        start_date || null, req.user.id, notes || null,
      ]
    );
    res.json({ success: true, group: row });
  } catch (e) {
    console.error("[loan-chit/chit-groups create]", e.message);
    res.json({ success: false, error: e.message });
  }
});

router.get("/chit-groups/:id/members", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const rows = await db.pgAll(
      `SELECT cm.*, COALESCE(u.nickname, u.username) AS employee_name
       FROM chit_memberships cm
       LEFT JOIN users u ON u.id = cm.employee_id
       WHERE cm.chit_group_id = $1
       ORDER BY cm.ticket_number NULLS LAST, cm.id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

router.post("/chit-groups/:id/members", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { employee_id, hub_form_id, monthly_contribution, ticket_number } = req.body;
    if (!employee_id) throw new Error("Select an employee");

    const groupRes = await client.query(`SELECT * FROM chit_groups WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
    const group = groupRes.rows[0];
    if (!group) throw new Error("Chit group not found");

    await client.query(
      `INSERT INTO chit_memberships (company_id, chit_group_id, employee_id, hub_form_id, monthly_contribution, ticket_number, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [
        req.user.active_company_id, group.id, employee_id, hub_form_id || null,
        monthly_contribution || group.monthly_amount, ticket_number || null,
      ]
    );
    await client.query(`UPDATE chit_groups SET total_members = (SELECT COUNT(*) FROM chit_memberships WHERE chit_group_id = $1) WHERE id = $1`, [group.id]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[loan-chit/chit members add]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// Record a bid / contribution / status change on one membership
router.put("/chit-memberships/:id", authMiddleware, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const {
      bid_amount, bid_month, received_chit, received_amount, received_date,
      add_contribution, status, notes,
    } = req.body;
    const row = await db.pgGet(
      `UPDATE chit_memberships SET
          bid_amount = COALESCE($1, bid_amount),
          bid_month = COALESCE($2, bid_month),
          received_chit = COALESCE($3, received_chit),
          received_amount = COALESCE($4, received_amount),
          received_date = COALESCE($5, received_date),
          total_paid = total_paid + COALESCE($6, 0),
          status = COALESCE($7, status),
          notes = COALESCE($8, notes)
       WHERE id = $9 AND company_id = $10
       RETURNING *`,
      [
        bid_amount ?? null, bid_month ?? null, received_chit ?? null, received_amount ?? null,
        received_date || null, add_contribution ?? null, status || null, notes || null,
        req.params.id, req.user.active_company_id,
      ]
    );
    if (!row) return res.json({ success: false, error: "Membership not found" });
    res.json({ success: true, membership: row });
  } catch (e) {
    console.error("[loan-chit/chit membership update]", e.message);
    res.json({ success: false, error: e.message });
  }
});

export default router;
