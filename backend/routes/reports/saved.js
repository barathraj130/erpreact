// backend/routes/reports/saved.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

const ensureTables = async () => {
  try {
    await db.pgRun(`
      CREATE TABLE IF NOT EXISTS saved_report_filters (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        report_name VARCHAR(100) NOT NULL,
        filter_name VARCHAR(100) NOT NULL,
        filters JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.pgRun(`
      CREATE TABLE IF NOT EXISTS favorite_reports (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        report_name VARCHAR(100) NOT NULL,
        report_path VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, report_name)
      )
    `);
  } catch (err) {
    console.error('ensureTables error:', err.message);
  }
};

/**
 * POST /api/reports/filters/save
 */
router.post('/filters/save', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { report_name, filter_name, filters } = req.body;
  try {
    await ensureTables();
    await db.pgRun(
      `INSERT INTO saved_report_filters (company_id, report_name, filter_name, filters) VALUES ($1, $2, $3, $4)`,
      [companyId, report_name, filter_name, JSON.stringify(filters || {})]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('filters/save error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reports/filters/:report_name
 */
router.get('/filters/:report_name', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { report_name } = req.params;
  try {
    await ensureTables();
    const data = await db.pgAll(
      `SELECT * FROM saved_report_filters WHERE company_id=$1 AND report_name=$2 ORDER BY created_at DESC`,
      [companyId, report_name]
    );
    res.json({ data: data || [] });
  } catch (err) {
    console.error('filters GET error:', err.message);
    res.json({ data: [] });
  }
});

/**
 * DELETE /api/reports/filters/:id
 */
router.delete('/filters/:id', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { id } = req.params;
  try {
    await db.pgRun(`DELETE FROM saved_report_filters WHERE id=$1 AND company_id=$2`, [id, companyId]);
    res.json({ success: true });
  } catch (err) {
    console.error('filters DELETE error:', err.message);
    res.json({ success: false });
  }
});

/**
 * POST /api/reports/favorites
 */
router.post('/favorites', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { report_name, report_path } = req.body;
  try {
    await ensureTables();
    await db.pgRun(
      `INSERT INTO favorite_reports (company_id, report_name, report_path) VALUES ($1, $2, $3)
       ON CONFLICT (company_id, report_name) DO NOTHING`,
      [companyId, report_name, report_path]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('favorites POST error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reports/favorites
 */
router.get('/favorites', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    await ensureTables();
    const data = await db.pgAll(
      `SELECT * FROM favorite_reports WHERE company_id=$1 ORDER BY created_at DESC`,
      [companyId]
    );
    res.json({ data: data || [] });
  } catch (err) {
    console.error('favorites GET error:', err.message);
    res.json({ data: [] });
  }
});

/**
 * DELETE /api/reports/favorites/:id
 */
router.delete('/favorites/:id', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { id } = req.params;
  try {
    await db.pgRun(`DELETE FROM favorite_reports WHERE id=$1 AND company_id=$2`, [id, companyId]);
    res.json({ success: true });
  } catch (err) {
    console.error('favorites DELETE error:', err.message);
    res.json({ success: false });
  }
});

export default router;
