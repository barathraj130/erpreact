import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// GET /api/delivery-orders
router.get('/', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const rows = await db.pgAll(`
      SELECT
        dord.id, dord.order_number, dord.order_date, dord.status,
        dord.converted_invoice_id, dord.created_at,
        u.username AS customer_name,
        COUNT(doi.id) AS item_count,
        COALESCE(SUM(doi.total_pieces), 0) AS total_pieces,
        inv.invoice_number AS converted_invoice_number
      FROM delivery_orders dord
      LEFT JOIN users u ON u.id = dord.customer_id
      LEFT JOIN delivery_order_items doi ON doi.delivery_order_id = dord.id
      LEFT JOIN invoices inv ON inv.id = dord.converted_invoice_id
      WHERE dord.company_id = $1
      GROUP BY dord.id, u.username, inv.invoice_number
      ORDER BY dord.created_at DESC
    `, [companyId]);
    res.json({ success: true, orders: rows });
  } catch (e) {
    console.error('delivery-orders list error:', e.message);
    res.json({ success: false, error: e.message });
  }
});

// POST /api/delivery-orders
router.post('/', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { customer_id, order_date, items } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const countRow = await client.query(
      `SELECT COUNT(*) AS cnt FROM delivery_orders WHERE company_id = $1`,
      [companyId]
    );
    const seq = (parseInt(countRow.rows[0].cnt) + 1).toString().padStart(3, '0');
    const dateStr = (order_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const orderNumber = `DO-${dateStr}-${seq}`;

    const orderRes = await client.query(`
      INSERT INTO delivery_orders (company_id, customer_id, order_number, order_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'draft', NOW(), NOW())
      RETURNING *
    `, [companyId, customer_id || null, orderNumber, order_date || new Date().toISOString().split('T')[0]]);

    const orderId = orderRes.rows[0].id;

    for (const item of (items || [])) {
      const bundleLines = JSON.stringify(item.bundle_lines || []);
      const totalPieces = (item.bundle_lines || []).reduce((sum, b) => sum + (Number(b.total) || 0), 0);
      const totalBundles = (item.bundle_lines || []).reduce((sum, b) => sum + (Number(b.bundles) || 0), 0);
      await client.query(`
        INSERT INTO delivery_order_items
          (delivery_order_id, product_id, product_name, bundle_lines, total_bundles, total_pieces, is_confirmed, is_cancelled)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, false, false)
      `, [orderId, item.product_id || null, item.product_name, bundleLines, totalBundles, totalPieces]);
    }

    await client.query('COMMIT');
    res.json({ success: true, order_id: orderId, order_number: orderNumber });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('delivery-orders create error:', e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/delivery-orders/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const orderRes = await db.pgGet(`
      SELECT dord.*, u.username AS customer_name, inv.invoice_number AS converted_invoice_number
      FROM delivery_orders dord
      LEFT JOIN users u ON u.id = dord.customer_id
      LEFT JOIN invoices inv ON inv.id = dord.converted_invoice_id
      WHERE dord.id = $1 AND dord.company_id = $2
    `, [req.params.id, companyId]);

    if (!orderRes) return res.json({ success: false, error: 'Not found' });

    const itemsRes = await db.pgAll(`
      SELECT doi.*, p.gst_percent AS product_gst_percent
      FROM delivery_order_items doi
      LEFT JOIN products p ON p.id = doi.product_id
      WHERE doi.delivery_order_id = $1
      ORDER BY doi.id ASC
    `, [req.params.id]);

    const items = itemsRes.map(item => ({
      ...item,
      gst_percent: item.gst_percent || item.product_gst_percent || 0,
      bundle_lines: typeof item.bundle_lines === 'string'
        ? JSON.parse(item.bundle_lines)
        : (item.bundle_lines || [])
    }));

    res.json({ success: true, order: { ...orderRes, items } });
  } catch (e) {
    console.error('delivery-orders get error:', e.message);
    res.json({ success: false, error: e.message });
  }
});

// POST /api/delivery-orders/:id/confirm-item
router.post('/:id/confirm-item', authMiddleware, async (req, res) => {
  const { item_id } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE delivery_order_items SET is_confirmed = true, confirmed_at = NOW()
      WHERE id = $1
    `, [item_id]);

    const allItems = await client.query(`
      SELECT * FROM delivery_order_items
      WHERE delivery_order_id = $1 AND is_cancelled = false
    `, [req.params.id]);

    const allConfirmed = allItems.rows.length > 0 && allItems.rows.every(i => i.is_confirmed);

    if (allConfirmed) {
      await client.query(`
        UPDATE delivery_orders SET status = 'ready', updated_at = NOW()
        WHERE id = $1
      `, [req.params.id]);
    }

    await client.query('COMMIT');
    res.json({ success: true, all_confirmed: allConfirmed });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('confirm-item error:', e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/delivery-orders/:id/confirm-all
router.post('/:id/confirm-all', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE delivery_order_items SET is_confirmed = true, confirmed_at = NOW()
      WHERE delivery_order_id = $1 AND is_cancelled = false
    `, [req.params.id]);

    await client.query(`
      UPDATE delivery_orders SET status = 'ready', updated_at = NOW()
      WHERE id = $1
    `, [req.params.id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('confirm-all error:', e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/delivery-orders/:id/cancel-item
router.post('/:id/cancel-item', authMiddleware, async (req, res) => {
  const { item_id } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE delivery_order_items SET is_cancelled = true
      WHERE id = $1
    `, [item_id]);

    const allItems = await client.query(`
      SELECT * FROM delivery_order_items
      WHERE delivery_order_id = $1 AND is_cancelled = false
    `, [req.params.id]);

    const allConfirmed = allItems.rows.length > 0 && allItems.rows.every(i => i.is_confirmed);
    if (allConfirmed) {
      await client.query(`
        UPDATE delivery_orders SET status = 'ready', updated_at = NOW()
        WHERE id = $1
      `, [req.params.id]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('cancel-item error:', e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

export default router;
