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

  const batchRes = await client.query(
    `SELECT COUNT(*) + 1 AS next_batch FROM product_journeys
     WHERE company_id = $1 AND product_id IS NOT DISTINCT FROM $2`,
    [companyId, product_id || null]
  );
  const batchNumber = parseInt(batchRes.rows[0].next_batch);
  const year = new Date(purchase_date || Date.now()).getFullYear();
  const code = (product_code || product_name).substring(0, 4).toUpperCase().replace(/\s/g, "");
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
