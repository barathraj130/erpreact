
import express from 'express';
import * as brokerService from '../services/brokerService.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const brokers = await brokerService.getBrokers(req.user.active_company_id);
        res.json(brokers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch brokers' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const broker = await brokerService.createBroker(req.user, req.body);
        res.status(201).json(broker);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const summary = await brokerService.getBrokerSummary(req.user.active_company_id);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

router.get('/ledger/:brokerId', authMiddleware, async (req, res) => {
    try {
        const ledger = await brokerService.getBrokerLedger(req.user.active_company_id, req.params.brokerId);
        res.json(ledger);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch ledger' });
    }
});

router.post('/payment', authMiddleware, async (req, res) => {
    try {
        const result = await brokerService.recordBrokerPayment(req.user, req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:brokerId/rates', authMiddleware, async (req, res) => {
    try {
        const rates = await brokerService.getBrokerProductRates(req.user.active_company_id, req.params.brokerId);
        res.json(rates);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch product rates' });
    }
});

router.post('/:brokerId/rates', authMiddleware, async (req, res) => {
    try {
        const { product_id, percentage } = req.body;
        const result = await brokerService.setBrokerProductRate(req.user.active_company_id, req.params.brokerId, product_id, percentage);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save product rate' });
    }
});

router.delete('/rates/:rateId', authMiddleware, async (req, res) => {
    try {
        await brokerService.removeBrokerProductRate(req.user.active_company_id, req.params.rateId);
        res.json({ message: 'Rate removed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove rate' });
    }
});

export default router;
