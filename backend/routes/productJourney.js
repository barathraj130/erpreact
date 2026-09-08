// backend/routes/productJourney.js
//
// Product Journey ID tracking — a NEW, standalone feature. Every purchase
// batch of every product gets one Journey ID (PJ/YEAR/PRODUCTCODE/BATCH) that
// records its whole life: purchase, fresh/mistake split, mistake→fresh
// conversion, fresh sales, mistake sales, customer returns, re-sales, branch
// transfers — one chronological timeline per batch.
//
// This file only touches its own three new tables (product_journeys,
// product_journey_events, mistake_to_fresh_conversions). The one exception is
// the mistake→fresh conversion route, which — same as the existing "Convert"
// feature on the Inventory page — also updates the real `inventory` table so
// the converted stock is actually sellable, not just recorded here. It uses
// the same ON CONFLICT upsert shape as branchInventoryService.js's transferStock
// (keyed on product_id + branch_id + stock_type + lot_id), because a plain
// INSERT there is exactly what caused this session's Stock Transfer bug —
// inventory_unique_idx rejects a second plain insert into an existing slot.
//
// Mounted at /api/journey in server.js (two added lines, nothing else touched).

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Recomputes a journey's running totals (sold/returned/converted/revenue/
 * profit/remaining/status) from its full event history. Called after every
 * event is recorded, so product_journeys always reflects the truth of
 * product_journey_events rather than being incrementally (and fallibly)
 * patched event-by-event.
 */
const updateJourneyTotals = async (client, journeyDbId) => {
  const events = await client.query(
    `SELECT event_type, SUM(quantity) AS qty, SUM(total_value) AS val
     FROM product_journey_events WHERE journey_id = $1 GROUP BY event_type`,
    [journeyDbId]
  );

  const t = {
    fresh_sold: 0, mistake_sold: 0,
    fresh_returned: 0, mistake_returned: 0,
    fresh_revenue: 0, mistake_revenue: 0,
    converted_to_fresh: 0, conversion_cost: 0,
  };
  for (const e of events.rows) {
    const qty = parseInt(e.qty || 0);
    const val = parseFloat(e.val || 0);
    if (e.event_type === "fresh_sold" || e.event_type === "fresh_resold") {
      t.fresh_sold += qty; t.fresh_revenue += val;
    }
    if (e.event_type === "mistake_sold" || e.event_type === "mistake_resold") {
      t.mistake_sold += qty; t.mistake_revenue += val;
    }
    if (e.event_type === "customer_return_fresh") t.fresh_returned += qty;
    if (e.event_type === "customer_return_mistake") t.mistake_returned += qty;
    if (e.event_type === "mistake_to_fresh") { t.converted_to_fresh += qty; t.conversion_cost += val; }
  }

  const jRes = await client.query(`SELECT * FROM product_journeys WHERE id = $1`, [journeyDbId]);
  const j = jRes.rows[0];
  if (!j) return;

  const freshRemaining = Number(j.fresh_purchased) + t.converted_to_fresh + t.fresh_returned - t.fresh_sold;
  const mistakeRemaining = Number(j.mistake_purchased) - t.converted_to_fresh + t.mistake_returned - t.mistake_sold;
  const totalRevenue = t.fresh_revenue + t.mistake_revenue;
  const grossProfit = totalRevenue - parseFloat(j.total_purchase_cost || 0) - t.conversion_cost;
  const status =
    (freshRemaining <= 0 && mistakeRemaining <= 0) ? "exhausted"
    : (t.fresh_sold > 0 || t.mistake_sold > 0) ? "partial"
    : "active";

  await client.query(
    `UPDATE product_journeys SET
       fresh_remaining = $1, mistake_remaining = $2,
       fresh_sold = $3, mistake_sold = $4, total_sold = $3 + $4,
       fresh_returned = $5, mistake_returned = $6, total_returned = $5 + $6,
       total_converted_to_fresh = $7,
       fresh_revenue = $8, mistake_revenue = $9, total_revenue = $10,
       total_conversion_cost = $11, gross_profit = $12,
       status = $13, updated_at = NOW()
     WHERE id = $14`,
    [
      Math.max(0, freshRemaining), Math.max(0, mistakeRemaining),
      t.fresh_sold, t.mistake_sold,
      t.fresh_returned, t.mistake_returned,
      t.converted_to_fresh,
      t.fresh_revenue, t.mistake_revenue, totalRevenue,
      t.conversion_cost, grossProfit, status,
      journeyDbId,
    ]
  );
};

// ── POST /api/journey/create — start a journey for a purchase batch ────────
router.post("/create", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const {
      product_id, product_name, product_code,
      purchase_bill_id, supplier_id, supplier_name,
      purchase_date, purchase_rate,
      total_purchased, fresh_purchased, mistake_purchased,
      branch_id, notes,
    } = req.body;

    if (!product_name || !purchase_bill_id) {
      throw new Error("Product name and purchase bill required");
    }

    const companyId = req.user.active_company_id || 1;

    const batchRes = await client.query(
      `SELECT COUNT(*) + 1 AS next_batch FROM product_journeys
       WHERE company_id = $1 AND product_id IS NOT DISTINCT FROM $2`,
      [companyId, product_id || null]
    );
    const batchNumber = parseInt(batchRes.rows[0].next_batch);
    const year = new Date().getFullYear();
    const code = (product_code || product_name).substring(0, 4).toUpperCase().replace(/\s/g, "");
    const journeyIdStr = `PJ/${year}/${code}/${String(batchNumber).padStart(3, "0")}`;
    const totalCost = parseFloat(purchase_rate || 0) * parseInt(total_purchased || 0);
    const freshQty = parseInt(fresh_purchased || total_purchased || 0);
    const mistakeQty = parseInt(mistake_purchased || 0);

    const result = await client.query(
      `INSERT INTO product_journeys (
          journey_id, company_id, product_id, product_name, product_code,
          purchase_bill_id, supplier_id, supplier_name,
          purchase_date, purchase_rate,
          total_purchased, fresh_purchased, mistake_purchased,
          fresh_remaining, mistake_remaining,
          batch_number, branch_id,
          total_purchase_cost, status, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$12,$13,$14,$15,$16,'active',$17)
       RETURNING *`,
      [
        journeyIdStr, companyId,
        product_id || null, product_name, code,
        purchase_bill_id,
        supplier_id || null, supplier_name || null,
        purchase_date || new Date().toISOString().split("T")[0],
        parseFloat(purchase_rate || 0),
        parseInt(total_purchased || 0),
        freshQty, mistakeQty,
        batchNumber,
        branch_id || null,
        totalCost,
        notes || null,
      ]
    );
    const journey = result.rows[0];

    await client.query(
      `INSERT INTO product_journey_events (
          journey_id, event_type, event_date,
          quantity, rate, total_value, stock_type,
          reference_type, reference_id,
          supplier_id, supplier_name, branch_id,
          running_fresh_balance, running_mistake_balance,
          description, recorded_by
       ) VALUES ($1,'purchased',$2,$3,$4,$5,'fresh','purchase_bill',$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        journey.id,
        purchase_date || new Date().toISOString().split("T")[0],
        parseInt(total_purchased || 0),
        parseFloat(purchase_rate || 0),
        totalCost,
        purchase_bill_id,
        supplier_id || null,
        supplier_name || null,
        branch_id || null,
        freshQty,
        mistakeQty,
        `Purchased ${total_purchased} pcs from ${supplier_name || "supplier"} @ ₹${purchase_rate}/pc. Fresh: ${freshQty} pcs, Mistake: ${mistakeQty} pcs`,
        req.user.id,
      ]
    );

    await client.query("COMMIT");
    res.json({ success: true, journey_id: journeyIdStr, journey_db_id: journey.id, journey });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[journey/create]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /api/journey/event — record any event on an existing journey ──────
router.post("/event", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const {
      journey_id, event_type, event_date,
      quantity, rate, stock_type,
      reference_type, reference_id, reference_number,
      customer_id, customer_name,
      supplier_id, supplier_name,
      branch_id, from_branch_id, to_branch_id,
      description,
    } = req.body;

    if (!journey_id || !event_type || !quantity) {
      throw new Error("Journey ID, event type and quantity required");
    }

    const journeyRes = await client.query(
      `SELECT * FROM product_journeys WHERE id::text = $1 OR journey_id = $1`,
      [String(journey_id)]
    );
    const journey = journeyRes.rows[0];
    if (!journey) throw new Error("Journey not found");

    const totalValue = parseFloat(rate || 0) * parseInt(quantity || 0);

    await client.query(
      `INSERT INTO product_journey_events (
          journey_id, event_type, event_date,
          quantity, rate, total_value, stock_type,
          reference_type, reference_id, reference_number,
          customer_id, customer_name,
          supplier_id, supplier_name,
          branch_id, from_branch_id, to_branch_id,
          running_fresh_balance, running_mistake_balance,
          description, recorded_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        journey.id, event_type,
        event_date || new Date().toISOString().split("T")[0],
        parseInt(quantity), parseFloat(rate || 0), totalValue,
        stock_type || "fresh",
        reference_type || null, reference_id || null, reference_number || null,
        customer_id || null, customer_name || null,
        supplier_id || null, supplier_name || null,
        branch_id || null, from_branch_id || null, to_branch_id || null,
        journey.fresh_remaining, journey.mistake_remaining,
        description || null, req.user.id,
      ]
    );

    await updateJourneyTotals(client, journey.id);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[journey/event]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /api/journey/convert-mistake-to-fresh ──────────────────────────────
router.post("/convert-mistake-to-fresh", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const {
      journey_id, product_id, product_name,
      branch_id, quantity_converted,
      conversion_type, reason, conversion_cost, notes,
    } = req.body;

    if (!journey_id) throw new Error("Journey ID required");
    if (!quantity_converted || parseInt(quantity_converted) <= 0) {
      throw new Error("Conversion quantity must be greater than zero");
    }
    if (!reason || reason.trim().length < 3) {
      throw new Error("Reason is required for conversion");
    }

    const companyId = req.user.active_company_id || 1;

    const journeyRes = await client.query(
      `SELECT * FROM product_journeys WHERE id::text = $1 OR journey_id = $1`,
      [String(journey_id)]
    );
    const journey = journeyRes.rows[0];
    if (!journey) throw new Error("Journey not found");

    if (parseInt(quantity_converted) > journey.mistake_remaining) {
      throw new Error(`Cannot convert ${quantity_converted} pcs — only ${journey.mistake_remaining} mistake pcs remaining`);
    }

    const beforeMistake = journey.mistake_remaining;
    const beforeFresh = journey.fresh_remaining;
    const afterMistake = beforeMistake - parseInt(quantity_converted);
    const afterFresh = beforeFresh + parseInt(quantity_converted);
    const convCost = parseFloat(conversion_cost || 0);

    const convRes = await client.query(
      `INSERT INTO mistake_to_fresh_conversions (
          journey_id, product_id, product_name,
          branch_id, company_id, conversion_date,
          quantity_converted, conversion_type, reason,
          before_mistake_qty, after_mistake_qty,
          before_fresh_qty, after_fresh_qty,
          conversion_cost, converted_by, notes
       ) VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        journey.id,
        product_id || journey.product_id,
        product_name || journey.product_name,
        branch_id || journey.branch_id,
        companyId,
        parseInt(quantity_converted),
        conversion_type || "other",
        reason,
        beforeMistake, afterMistake,
        beforeFresh, afterFresh,
        convCost,
        req.user.id,
        notes || null,
      ]
    );

    // Move real stock — mirrors the Inventory page's own "Convert" feature,
    // using the same ON CONFLICT upsert shape as transferStock() so a
    // repeat conversion into an already-populated fresh slot doesn't hit
    // inventory_unique_idx and roll back the whole transaction (the exact
    // bug that broke Stock Transfer earlier this session).
    const pid = product_id || journey.product_id;
    const bid = branch_id || journey.branch_id;
    if (pid && bid) {
      await client.query(
        `UPDATE inventory SET
           current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1),
           last_updated = NOW()
         WHERE product_id = $2 AND branch_id = $3 AND stock_type = 'mistake'`,
        [parseInt(quantity_converted), pid, bid]
      );

      const productRow = await client.query(
        `SELECT name, sku, unit, hsn_code, gst_percent, selling_price, cost_price FROM products WHERE id = $1`,
        [pid]
      );
      const p = productRow.rows[0] || {};

      await client.query(
        `INSERT INTO inventory
            (company_id, branch_id, product_id, product_name, sku, unit, current_stock,
             cost_price, selling_price, hsn_code, gst_percent, stock_type, last_updated)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'fresh',NOW())
         ON CONFLICT (product_id, COALESCE(branch_id,0), stock_type, COALESCE(lot_id,0))
         DO UPDATE SET
            current_stock = inventory.current_stock + EXCLUDED.current_stock,
            last_updated = NOW()`,
        [
          companyId, bid, pid, p.name || product_name || journey.product_name, p.sku || null,
          p.unit || null, parseInt(quantity_converted),
          p.cost_price || 0, p.selling_price || 0, p.hsn_code || null, p.gst_percent || 0,
        ]
      );
    }

    await client.query(
      `INSERT INTO product_journey_events (
          journey_id, event_type, event_date,
          quantity, rate, total_value, stock_type,
          reference_type, reference_id, branch_id,
          running_fresh_balance, running_mistake_balance,
          description, recorded_by
       ) VALUES ($1,'mistake_to_fresh',CURRENT_DATE,$2,0,$3,'mistake','conversion',$4,$5,$6,$7,$8,$9)`,
      [
        journey.id, parseInt(quantity_converted), convCost, convRes.rows[0].id,
        branch_id || journey.branch_id, afterFresh, afterMistake,
        `${quantity_converted} mistake pcs converted to fresh — Type: ${conversion_type || "other"} — ${reason}`,
        req.user.id,
      ]
    );

    await updateJourneyTotals(client, journey.id);

    await client.query("COMMIT");
    res.json({
      success: true,
      conversion_id: convRes.rows[0].id,
      quantity_converted: parseInt(quantity_converted),
      before: { fresh: beforeFresh, mistake: beforeMistake },
      after: { fresh: afterFresh, mistake: afterMistake },
      message: `${quantity_converted} mistake pcs successfully converted to fresh stock`,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[journey/convert-mistake-to-fresh]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/journey — list all journeys ────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { product_id, status, supplier_id, from, to, search } = req.query;
    const companyId = req.user.active_company_id || 1;
    let where = "WHERE pj.company_id = $1";
    const params = [companyId];
    let pc = 1;

    if (product_id) { pc++; where += ` AND pj.product_id = $${pc}`; params.push(product_id); }
    if (status) { pc++; where += ` AND pj.status = $${pc}`; params.push(status); }
    if (supplier_id) { pc++; where += ` AND pj.supplier_id = $${pc}`; params.push(supplier_id); }
    if (from) { pc++; where += ` AND pj.purchase_date >= $${pc}`; params.push(from); }
    if (to) { pc++; where += ` AND pj.purchase_date <= $${pc}`; params.push(to); }
    if (search) {
      pc++;
      where += ` AND (LOWER(pj.product_name) LIKE LOWER($${pc}) OR pj.journey_id LIKE $${pc})`;
      params.push(`%${search}%`);
    }

    const result = await db.pgAll(
      `SELECT pj.*,
          s.name AS supplier_ref_name,
          b.branch_name AS branch_name,
          COUNT(pje.id) AS total_events,
          COUNT(pje.id) FILTER (WHERE pje.event_type IN ('fresh_sold','fresh_resold','mistake_sold','mistake_resold')) AS sale_events,
          COUNT(pje.id) FILTER (WHERE pje.event_type IN ('customer_return_fresh','customer_return_mistake')) AS return_events,
          COUNT(pje.id) FILTER (WHERE pje.event_type = 'mistake_to_fresh') AS conversion_events
       FROM product_journeys pj
       LEFT JOIN suppliers s ON s.id = pj.supplier_id
       LEFT JOIN branches b ON b.id = pj.branch_id
       LEFT JOIN product_journey_events pje ON pje.journey_id = pj.id
       ${where}
       GROUP BY pj.id, s.name, b.branch_name
       ORDER BY pj.purchase_date DESC, pj.created_at DESC`,
      params
    );

    res.json(result);
  } catch (e) {
    console.error("[journey list]", e.message);
    res.json([]);
  }
});

// ── GET /api/journey/:id — full detail + complete timeline ─────────────────
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const journey = await db.pgGet(
      `SELECT pj.*,
          p.name AS product_ref_name, p.category, p.gst_percent,
          s.name AS supplier_ref_name, s.phone AS supplier_phone,
          b.branch_name AS branch_name,
          pb.bill_number AS purchase_bill_number
       FROM product_journeys pj
       LEFT JOIN products p ON p.id = pj.product_id
       LEFT JOIN suppliers s ON s.id = pj.supplier_id
       LEFT JOIN branches b ON b.id = pj.branch_id
       LEFT JOIN purchase_bills pb ON pb.id = pj.purchase_bill_id
       WHERE pj.id::text = $1 OR pj.journey_id = $1`,
      [req.params.id]
    );
    if (!journey) return res.json({ error: "Journey not found" });

    const timeline = await db.pgAll(
      `SELECT pje.*,
          COALESCE(c.nickname, c.username) AS customer_ref_name,
          c.phone AS customer_phone,
          b.branch_name AS branch_ref_name,
          fb.branch_name AS from_branch_name,
          tb.branch_name AS to_branch_name
       FROM product_journey_events pje
       LEFT JOIN users c ON c.id = pje.customer_id
       LEFT JOIN branches b ON b.id = pje.branch_id
       LEFT JOIN branches fb ON fb.id = pje.from_branch_id
       LEFT JOIN branches tb ON tb.id = pje.to_branch_id
       WHERE pje.journey_id = $1
       ORDER BY pje.event_date ASC, pje.created_at ASC`,
      [journey.id]
    );

    const customerSummary = await db.pgAll(
      `SELECT
          pje.customer_id,
          COALESCE(pje.customer_name, c.nickname, c.username) AS customer_name,
          c.phone AS customer_phone,
          SUM(CASE WHEN pje.event_type IN ('fresh_sold','fresh_resold') THEN pje.quantity ELSE 0 END) AS fresh_bought,
          SUM(CASE WHEN pje.event_type IN ('mistake_sold','mistake_resold') THEN pje.quantity ELSE 0 END) AS mistake_bought,
          SUM(CASE WHEN pje.event_type = 'customer_return_fresh' THEN pje.quantity ELSE 0 END) AS fresh_returned,
          SUM(CASE WHEN pje.event_type = 'customer_return_mistake' THEN pje.quantity ELSE 0 END) AS mistake_returned,
          SUM(CASE WHEN pje.event_type IN ('fresh_sold','fresh_resold','mistake_sold','mistake_resold') THEN pje.total_value ELSE 0 END) AS total_paid,
          MIN(pje.event_date) AS first_purchase,
          MAX(pje.event_date) AS last_activity,
          COUNT(DISTINCT pje.reference_id) FILTER (WHERE pje.reference_type = 'invoice') AS invoice_count
       FROM product_journey_events pje
       LEFT JOIN users c ON c.id = pje.customer_id
       WHERE pje.journey_id = $1 AND pje.customer_id IS NOT NULL
       GROUP BY pje.customer_id, pje.customer_name, c.nickname, c.username, c.phone
       ORDER BY total_paid DESC`,
      [journey.id]
    );

    const conversions = await db.pgAll(
      `SELECT mtf.*,
          COALESCE(u.nickname, u.username) AS converted_by_name,
          b.branch_name AS branch_name
       FROM mistake_to_fresh_conversions mtf
       LEFT JOIN users u ON u.id = mtf.converted_by
       LEFT JOIN branches b ON b.id = mtf.branch_id
       WHERE mtf.journey_id = $1
       ORDER BY mtf.conversion_date DESC`,
      [journey.id]
    );

    res.json({ journey, timeline, customer_summary: customerSummary, conversions });
  } catch (e) {
    console.error("[journey detail]", e.message);
    res.json({ error: e.message });
  }
});

// ── GET /api/journey/product/:productId ─────────────────────────────────────
router.get("/product/:productId", authMiddleware, async (req, res) => {
  try {
    const result = await db.pgAll(
      `SELECT pj.*, s.name AS supplier_name_ref, pb.bill_number, COUNT(pje.id) AS event_count
       FROM product_journeys pj
       LEFT JOIN suppliers s ON s.id = pj.supplier_id
       LEFT JOIN purchase_bills pb ON pb.id = pj.purchase_bill_id
       LEFT JOIN product_journey_events pje ON pje.journey_id = pj.id
       WHERE pj.product_id = $1 AND pj.company_id = $2
       GROUP BY pj.id, s.name, pb.bill_number
       ORDER BY pj.purchase_date DESC`,
      [req.params.productId, req.user.active_company_id || 1]
    );
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// ── GET /api/journey/customer/:customerId ───────────────────────────────────
router.get("/customer/:customerId", authMiddleware, async (req, res) => {
  try {
    const result = await db.pgAll(
      `SELECT pj.id, pj.journey_id, pj.product_name, pj.purchase_date, pj.purchase_rate, pj.status,
          SUM(pje.quantity) FILTER (WHERE pje.event_type IN ('fresh_sold','fresh_resold')) AS fresh_bought,
          SUM(pje.quantity) FILTER (WHERE pje.event_type IN ('mistake_sold','mistake_resold')) AS mistake_bought,
          SUM(pje.quantity) FILTER (WHERE pje.event_type IN ('customer_return_fresh','customer_return_mistake')) AS returned,
          SUM(pje.total_value) FILTER (WHERE pje.event_type IN ('fresh_sold','fresh_resold','mistake_sold','mistake_resold')) AS total_spent,
          COUNT(DISTINCT pje.reference_id) FILTER (WHERE pje.reference_type = 'invoice') AS invoice_count
       FROM product_journeys pj
       JOIN product_journey_events pje ON pje.journey_id = pj.id
       WHERE pje.customer_id = $1 AND pj.company_id = $2
       GROUP BY pj.id, pj.journey_id, pj.product_name, pj.purchase_date, pj.purchase_rate, pj.status
       ORDER BY pj.purchase_date DESC`,
      [req.params.customerId, req.user.active_company_id || 1]
    );
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// ── GET /api/journey/summary/dashboard ──────────────────────────────────────
router.get("/summary/dashboard", authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.active_company_id || 1;
    const row = await db.pgGet(
      `SELECT
          COUNT(*) AS total_batches,
          COUNT(*) FILTER (WHERE status = 'active') AS active_batches,
          COUNT(*) FILTER (WHERE status = 'partial') AS partial_batches,
          COUNT(*) FILTER (WHERE status = 'exhausted') AS exhausted_batches,
          COALESCE(SUM(total_purchase_cost), 0) AS total_invested,
          COALESCE(SUM(total_revenue), 0) AS total_revenue,
          COALESCE(SUM(gross_profit), 0) AS total_gross_profit,
          COALESCE(SUM(fresh_remaining), 0) AS total_fresh_remaining,
          COALESCE(SUM(mistake_remaining), 0) AS total_mistake_remaining,
          COALESCE(SUM(total_converted_to_fresh), 0) AS total_converted,
          COUNT(DISTINCT product_id) AS unique_products,
          COUNT(DISTINCT supplier_id) AS unique_suppliers
       FROM product_journeys WHERE company_id = $1`,
      [companyId]
    );
    res.json(row || {});
  } catch (e) {
    res.json({});
  }
});

export default router;
