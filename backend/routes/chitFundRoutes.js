
import express from 'express';
import * as financeService from '../services/financeService.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';

const router = express.Router();

router.get('/groups', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const groups = await db.pgAll(`
            SELECT * FROM chit_groups WHERE company_id = $1 ORDER BY start_date DESC
        `, [companyId]);
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chit groups' });
    }
});

router.post('/groups', authMiddleware, async (req, res) => {
    try {
        const group = await financeService.createChitGroup(req.user, req.body);
        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/installments/:groupId', authMiddleware, async (req, res) => {
    try {
        const installments = await db.pgAll(`
            SELECT * FROM chit_installments 
            WHERE chit_group_id = $1 AND company_id = $2
            ORDER BY payment_date DESC
        `, [req.params.groupId, req.user.active_company_id]);
        res.json(installments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch installments' });
    }
});

router.post('/installments', authMiddleware, async (req, res) => {
    try {
        const installment = await financeService.recordChitInstallment(req.user, req.body);
        res.status(201).json(installment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;