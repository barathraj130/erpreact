// backend/routes/dashboardRoutes.js
import express from "express";
import { authMiddleware, checkAuth } from "../middlewares/jwtAuthMiddleware.js";
import * as dashboardService from "../services/dashboardService.js";

const router = express.Router();

// Protect all routes
router.use(authMiddleware);
router.use(checkAuth);

/**
 * GET /api/dashboard
 * Get complete dashboard
 */
router.get("/", async (req, res) => {
    try {
        const { user } = req;
        const dashboard = await dashboardService.getCompleteDashboard(user.company_id);
        res.json({ success: true, data: dashboard });
    } catch (err) {
        console.error("❌ Dashboard error:", err);
        res.status(500).json({ error: "Failed to fetch dashboard" });
    }
});

/**
 * GET /api/dashboard/finance
 * Get financial dashboard
 */
router.get("/finance", async (req, res) => {
    try {
        const { user } = req;
        const { startDate, endDate } = req.query;

        const start = new Date(startDate || new Date().setDate(1));
        const end = new Date(endDate || new Date());

        const dashboard = await dashboardService.getFinancialDashboard(user.company_id, start, end);
        res.json({ success: true, data: dashboard });
    } catch (err) {
        console.error("❌ Financial dashboard error:", err);
        res.status(500).json({ error: "Failed to fetch financial dashboard" });
    }
});

/**
 * GET /api/dashboard/customers
 * Get customer analytics
 */
router.get("/customers", async (req, res) => {
    try {
        const { user } = req;
        const analytics = await dashboardService.getCustomerAnalytics(user.company_id);
        res.json({ success: true, data: analytics });
    } catch (err) {
        console.error("❌ Customer analytics error:", err);
        res.status(500).json({ error: "Failed to fetch customer analytics" });
    }
});

/**
 * GET /api/dashboard/suppliers
 * Get supplier analytics
 */
router.get("/suppliers", async (req, res) => {
    try {
        const { user } = req;
        const analytics = await dashboardService.getSupplierAnalytics(user.company_id);
        res.json({ success: true, data: analytics });
    } catch (err) {
        console.error("❌ Supplier analytics error:", err);
        res.status(500).json({ error: "Failed to fetch supplier analytics" });
    }
});

/**
 * GET /api/dashboard/kpis
 * Get KPI summary
 */
router.get("/kpis", async (req, res) => {
    try {
        const { user } = req;
        const kpis = await dashboardService.getKPISummary(user.company_id);
        res.json({ success: true, data: kpis });
    } catch (err) {
        console.error("❌ KPI summary error:", err);
        res.status(500).json({ error: "Failed to fetch KPIs" });
    }
});

export default router;
