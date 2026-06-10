// backend/routes/aiRoutes.js
import express from 'express';
import multer from 'multer';
import { saveForTraining, scanBillWithAI } from '../services/aiService.js';
import { runAIPoweredReport } from '../services/aiReportingService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route POST /api/ai/scan
 * @desc World-class bill scanning endpoint
 */
router.post('/scan', upload.single('bill'), async (req, res) => {
    console.log("📥 AI Scan Request Received:", req.file?.originalname);
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No bill file uploaded" });
        }

        const result = await scanBillWithAI(req.file.buffer, req.file.mimetype);
        
        // Auto-save for future model training (Self-Learning architecture)
        await saveForTraining(req.file.buffer, result);

        if (!result.has_usable_data) {
            return res.status(422).json({
                error: result.error || "No product details could be extracted from this bill.",
                result
            });
        }

        res.json(result);
    } catch (err) {
        console.error("AI Route Error:", err);
        res.status(500).json({ error: "Brain engine failed", details: err.message });
    }
});

/**
 * @route POST /api/ai/feedback
 * @desc Save corrected data for model training
 */
router.post('/feedback', async (req, res) => {
    try {
        const { scanId, correctedData } = req.body;
        await saveForTraining(null, { scanId, ...correctedData, isCorrection: true });
        res.json({ status: "Success", message: "Feedback saved" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save feedback" });
    }
});

/**
 * 📡 @route POST /api/ai/reports
 * 🧠 THE AI ANALYTICS ENGINE
 */
router.post('/reports', async (req, res) => {
    const { query, userContext } = req.body;
    console.log("🚀 [AI EXPLORER] Prompt Requested:", query);

    try {
        if (!query) return res.status(400).json({ error: "No query provided" });

        // User Context from token
        // In a real app, use auth middleware, but we take it from body for simplicity here
        const result = await runAIPoweredReport(query, userContext || { company_id: 1, role: 'admin' });

        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("❌ AI Reports Engine Error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Intelligence services failed to process your data request.",
            details: err.message 
        });
    }
});

export default router;
