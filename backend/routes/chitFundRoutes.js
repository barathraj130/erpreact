
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

// Cross-chit auction history — every month across every chit group where
// the auction was won, newest first. Lets a member with several chit
// groups see all their wins in one place instead of opening each group.
router.get('/auction-history', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(`
            SELECT ci.id, ci.chit_group_id, cg.group_name, ci.payment_date,
                   ci.auction_amount_received, ci.notes
            FROM chit_installments ci
            JOIN chit_groups cg ON cg.id = ci.chit_group_id
            WHERE ci.company_id = $1 AND ci.is_auction_won = true
            ORDER BY ci.payment_date DESC
        `, [companyId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch auction history' });
    }
});

export default router;