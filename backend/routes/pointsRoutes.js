import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { checkAccess } from '../middlewares/checkAccess.js';
import * as pointsService from '../services/pointsService.js';
import db from '../database/pg.js';

const router = express.Router();

// GET /customers/:id/points - Get customer points balance
router.get('/customers/:id/points', authMiddleware, checkAccess('Sales', 'view_customers'), async (req, res) => {
    try {
        const customerId = Number(req.params.id);
        const balance = await pointsService.getPointsBalance(customerId);
        res.json(balance);
    } catch (err) {
        console.error('Get points error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /customers/:id/points/history - Get points transaction history
router.get('/customers/:id/points/history', authMiddleware, checkAccess('Sales', 'view_customers'), async (req, res) => {
    try {
        const customerId = Number(req.params.id);
        const history = await pointsService.getPointsHistory(customerId);
        res.json(history);
    } catch (err) {
        console.error('Get points history error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /customers/:id/points/bonus - Add bonus points (Admin only)
router.post('/customers/:id/points/bonus', authMiddleware, checkAccess('Admin', 'manage_settings'), async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const customerId = Number(req.params.id);
        const { points, reason } = req.body;
        
        if (!points || points <= 0) {
            return res.status(400).json({ error: 'Points must be greater than 0' });
        }
        
        await pointsService.addBonusPoints(client, customerId, points, reason || 'Admin bonus');
        await client.query('COMMIT');
        res.json({ success: true, message: `Added ${points} bonus points` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Add bonus error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /points/redeem - Validate and calculate points redemption
router.post('/points/redeem', authMiddleware, async (req, res) => {
    try {
        const { customer_id, points, bill_total } = req.body;
        
        if (!customer_id || !points || !bill_total) {
            return res.status(400).json({ error: 'customer_id, points, and bill_total required' });
        }
        
        const available = await pointsService.getAvailablePoints(customer_id);
        const maxDiscount = Math.floor(bill_total * 0.20);
        const discount = Math.min(points, maxDiscount);
        
        res.json({
            available_points: available,
            points_redeemed: Math.floor(discount),
            discount_amount: discount
        });
    } catch (err) {
        console.error('Redeem validation error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;