// backend/routes/documentDrafts.js
//
// Generic "Save Draft (Continue Later)" storage for long forms (Purchase
// Bill, and any future one) — replaces browser localStorage, which is
// scoped to the exact origin and was silently losing every draft the
// moment the app redeployed to a new Vercel preview URL. One draft per
// (company, user, form_type); saving again overwrites the previous one,
// same behavior as the old single localStorage slot.
//
// Mounted at /api/document-drafts in server.js.

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// ── GET /api/document-drafts/:formType — fetch the saved draft, if any ─────
router.get("/:formType", authMiddleware, async (req, res) => {
  try {
    const row = await db.pgGet(
      `SELECT draft_data, updated_at FROM document_drafts
       WHERE company_id = $1 AND user_id = $2 AND form_type = $3`,
      [req.user.active_company_id, req.user.id, req.params.formType]
    );
    res.json(row || null);
  } catch (e) {
    console.error("[document-drafts get]", e.message);
    res.json(null);
  }
});

// ── PUT /api/document-drafts/:formType — save/overwrite the draft ──────────
router.put("/:formType", authMiddleware, async (req, res) => {
  try {
    await db.pgRun(
      `INSERT INTO document_drafts (company_id, user_id, form_type, draft_data, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (company_id, user_id, form_type)
       DO UPDATE SET draft_data = EXCLUDED.draft_data, updated_at = NOW()`,
      [req.user.active_company_id, req.user.id, req.params.formType, JSON.stringify(req.body || {})]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("[document-drafts save]", e.message);
    res.json({ success: false, error: e.message });
  }
});

// ── DELETE /api/document-drafts/:formType — discard the draft ──────────────
router.delete("/:formType", authMiddleware, async (req, res) => {
  try {
    await db.pgRun(
      `DELETE FROM document_drafts WHERE company_id = $1 AND user_id = $2 AND form_type = $3`,
      [req.user.active_company_id, req.user.id, req.params.formType]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("[document-drafts delete]", e.message);
    res.json({ success: false, error: e.message });
  }
});

export default router;
