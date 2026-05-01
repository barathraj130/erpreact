
import express from "express";
import * as analyticsService from "../services/analyticsService.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

router.get("/world-class", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const data = await analyticsService.getWorldClassMetrics(companyId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate futuristic report" });
    }
});

export default router;
