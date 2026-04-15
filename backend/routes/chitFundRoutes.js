// backend/routes/chitFundRoutes.js
import express from 'express';
import pgModule from '../database/pg.js';
import { checkAuth } from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// ─── In-memory store (replace with DB table when ready) ───────────────────────
// Until you add a chit_funds table, we keep data in-memory per-process.
// To persist: create table chit_funds and chit_collections, then swap these arrays.
let chitFunds = [];
let collections = [];
let nextId = 1;
let nextColId = 1;

function computeStats(fund) {
  const fundCols = collections.filter((c) => c.chit_id === fund.id);
  const total_collected = fundCols.reduce((s, c) => s + Number(c.amount), 0);
  const auction_amount = fund.auction_amount || 0;
  const outstanding = Number(fund.chit_value) - total_collected;
  const months_completed = fundCols.length;
  return { ...fund, total_collected, auction_amount, outstanding, months_completed };
}

// GET /api/chit-fund/schemes
router.get('/schemes', checkAuth, (req, res) => {
  const result = chitFunds.map(computeStats);
  res.json(result);
});

// POST /api/chit-fund/schemes  — create a new chit
router.post('/schemes', checkAuth, (req, res) => {
  const {
    group_name,
    chit_value,
    monthly_contribution,
    total_members,
    duration_months,
    start_date,
    auction_type = 'OPEN',
    organizer_commission = 5,
    notes = '',
  } = req.body;

  if (!group_name || !chit_value || !monthly_contribution || !total_members) {
    return res.status(400).json({ error: 'group_name, chit_value, monthly_contribution, total_members are required' });
  }

  const fund = {
    id: nextId++,
    group_name,
    chit_value: Number(chit_value),
    monthly_contribution: Number(monthly_contribution),
    total_members: Number(total_members),
    duration_months: Number(duration_months) || Number(total_members),
    start_date: start_date || new Date().toISOString().split('T')[0],
    auction_type,
    organizer_commission: Number(organizer_commission),
    notes,
    status: 'ACTIVE',
    auction_amount: 0,
    created_at: new Date().toISOString(),
  };

  chitFunds.push(fund);
  res.status(201).json(computeStats(fund));
});

// PUT /api/chit-fund/schemes/:id  — update status / auction amount
router.put('/schemes/:id', checkAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = chitFunds.findIndex((f) => f.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const allowed = ['status', 'auction_amount', 'notes', 'organizer_commission'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) chitFunds[idx][key] = req.body[key];
  });
  res.json(computeStats(chitFunds[idx]));
});

// DELETE /api/chit-fund/schemes/:id
router.delete('/schemes/:id', checkAuth, (req, res) => {
  const id = parseInt(req.params.id);
  chitFunds = chitFunds.filter((f) => f.id !== id);
  collections = collections.filter((c) => c.chit_id !== id);
  res.json({ success: true });
});

// GET /api/chit-fund/schemes/:id/collections
router.get('/schemes/:id/collections', checkAuth, (req, res) => {
  const id = parseInt(req.params.id);
  res.json(collections.filter((c) => c.chit_id === id));
});

// POST /api/chit-fund/schemes/:id/collections  — record monthly payment
router.post('/schemes/:id/collections', checkAuth, (req, res) => {
  const chit_id = parseInt(req.params.id);
  const fund = chitFunds.find((f) => f.id === chit_id);
  if (!fund) return res.status(404).json({ error: 'Chit fund not found' });

  const { member_name, amount, month_number, payment_date, payment_mode = 'CASH', notes = '' } = req.body;
  if (!member_name || !amount || !month_number) {
    return res.status(400).json({ error: 'member_name, amount, month_number are required' });
  }

  const col = {
    id: nextColId++,
    chit_id,
    member_name,
    amount: Number(amount),
    month_number: Number(month_number),
    payment_date: payment_date || new Date().toISOString().split('T')[0],
    payment_mode,
    notes,
    created_at: new Date().toISOString(),
  };
  collections.push(col);
  res.status(201).json(col);
});

// DELETE /api/chit-fund/collections/:colId
router.delete('/collections/:colId', checkAuth, (req, res) => {
  const id = parseInt(req.params.colId);
  collections = collections.filter((c) => c.id !== id);
  res.json({ success: true });
});

export default router;