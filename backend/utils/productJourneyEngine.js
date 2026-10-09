// backend/utils/productJourneyEngine.js
//
// Shared journey-creation logic, extracted so it has exactly one
// implementation whether a journey is created manually (productJourney.js's
// /create route, kept as a rare manual-fix path), automatically the moment
// a purchase bill is saved (purchaseBillRoutes.js), or backfilled once for
// stock that already existed before this feature did (productJourney.js's
// /backfill-opening-stock route). All three need the same batch-numbering
// and journey_id format — duplicating that logic risked them drifting out
// of sync (e.g. two different batch-number queries disagreeing).
//
// Takes an already-open transaction client so the caller controls the
// transaction boundary (this never calls BEGIN/COMMIT itself).

/**
 * @param {import('pg').PoolClient} client
 * @param {object} p
 * @returns {Promise<object>} the created product_journeys row
 */
export async function createJourneyForPurchase(client, p) {
  const {
    companyId, userId,
    product_id, product_name, product_code,
    purchase_bill_id, supplier_id, supplier_name,
    purchase_date, purchase_rate,
    total_purchased, fresh_purchased, mistake_purchased,
    branch_id, notes,
    event_type = "purchased",
    event_description,
    reference_type = "purchase_bill",
  } = p;

  if (!product_name) throw new Error("Product name required to create a journey");

  const year = new Date(purchase_date || Date.now()).getFullYear();
  const code = (product_code || product_name).substring(0, 4).toUpperCase().replace(/\s/g, "");

  // The batch number must be counted per (company, year, code) — the exact
  // components embedded in journey_id below — not per product_id. `code` is
  // only the first ~4 letters of the product name, so two DIFFERENT products
  // (e.g. "L/K FROCK" and "L/K PANT" both truncate to "L/K") can share it;
  // counting per product_id let each independently compute "batch 1" and
  // collide on product_journeys' unique journey_id constraint. The advisory
  // lock (keyed the same way) additionally serializes two concurrent
  // transactions allocating a batch number for the same code before either
  // commits — a plain COUNT alone doesn't close that race.
  await client.query(`SELECT pg_advisory_xact_lock($1, hashtext($2))`, [companyId, `${year}:${code}`]);
  const batchRes = await client.query(
    `SELECT COUNT(*) + 1 AS next_batch FROM product_journeys
     WHERE company_id = $1 AND journey_id LIKE $2`,
    [companyId, `PJ/${year}/${code}/%`]
  );
  const batchNumber = parseInt(batchRes.rows[0].next_batch);
  const journeyIdStr = `PJ/${year}/${code}/${String(batchNumber).padStart(3, "0")}`;

  const totalQty = parseInt(total_purchased || 0);
  const freshQty = parseInt(fresh_purchased ?? total_purchased ?? 0);
  const mistakeQty = parseInt(mistake_purchased || 0);
  const rate = parseFloat(purchase_rate || 0);
  const totalCost = rate * totalQty;

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
      purchase_bill_id || null,
      supplier_id || null, supplier_name || null,
      purchase_date || new Date().toISOString().split("T")[0],
      rate,
      totalQty, freshQty, mistakeQty,
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
     ) VALUES ($1,$2,$3,$4,$5,$6,'fresh',$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      journey.id, event_type,
      purchase_date || new Date().toISOString().split("T")[0],
      totalQty, rate, totalCost,
      reference_type, purchase_bill_id || null,
      supplier_id || null, supplier_name || null,
      branch_id || null,
      freshQty, mistakeQty,
      event_description ||
        `Purchased ${totalQty} pcs from ${supplier_name || "supplier"} @ ₹${rate}/pc. Fresh: ${freshQty} pcs, Mistake: ${mistakeQty} pcs`,
      userId || null,
    ]
  );

  return journey;
}

/**
 * Recomputes a journey's running totals (sold/returned/converted/revenue/
 * profit/remaining/status) from its full event history. Called after every
 * event is recorded, so product_journeys always reflects the truth of
 * product_journey_events rather than being incrementally (and fallibly)
 * patched event-by-event. Shared by productJourney.js's manual routes and
 * recordSaleForJourney below — one implementation, not two drifting copies.
 */
export const updateJourneyTotals = async (client, journeyDbId) => {
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

/**
 * Records a sale against a product's open journeys — this is what was
 * entirely missing: invoice creation deducted real stock but never touched
 * product_journeys, so Product Journey's "Fresh Left"/"Total Sold"/"Revenue"
 * columns stayed frozen at the purchased amount forever, regardless of how
 * much was actually sold.
 *
 * Consumes FIFO (oldest purchase_date/id first) across every journey with
 * fresh_remaining > 0 for this product, splitting one sale across multiple
 * batches if the oldest batch alone doesn't cover it. Always treated as
 * FRESH stock — the invoice flow has no fresh/mistake distinction at sale
 * time (that split only exists pre-sale, via the separate `inventory`
 * table), so mistake stock must go through Convert Mistake first to be
 * sellable at all, same as the rest of this app's existing workflow.
 * If the sale exceeds every known open journey's remaining fresh stock
 * (e.g. stock added before this feature, or outside any journey), the
 * uncovered remainder is simply left unallocated rather than forced onto
 * the wrong batch — best-effort, same as every other journey write in this
 * file: never blocks the actual sale if journey bookkeeping can't keep up.
 *
 * @returns {Promise<{allocated: number, unallocated: number}>}
 */
export async function recordSaleForJourney(client, {
  companyId, productId, qty, rate,
  referenceType, referenceId, branchId,
  customerId, customerName, note,
}) {
  if (!(qty > 0) || !productId) return { allocated: 0, unallocated: qty || 0 };

  await client.query(`ALTER TABLE product_journey_events ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
  await client.query(`ALTER TABLE product_journey_events ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)`);

  const openJourneys = await client.query(
    `SELECT id, fresh_remaining FROM product_journeys
     WHERE company_id = $1 AND product_id = $2 AND fresh_remaining > 0
     ORDER BY purchase_date ASC, id ASC`,
    [companyId, productId]
  );

  let remaining = qty;
  for (const journey of openJourneys.rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(journey.fresh_remaining));
    if (take <= 0) continue;

    await client.query(
      `INSERT INTO product_journey_events (
          journey_id, event_type, event_date, quantity, rate, total_value, stock_type,
          reference_type, reference_id, branch_id, customer_id, customer_name, description
       ) VALUES ($1,'fresh_sold',CURRENT_DATE,$2,$3,$4,'fresh',$5,$6,$7,$8,$9,$10)`,
      [
        journey.id, take, rate || 0, take * (rate || 0),
        referenceType, referenceId || null, branchId || null,
        customerId || null, customerName || null,
        note || `Sold ${take} pcs${customerName ? ` to ${customerName}` : ""}`,
      ]
    );
    await updateJourneyTotals(client, journey.id);
    remaining -= take;
  }

  return { allocated: qty - remaining, unallocated: remaining };
}
