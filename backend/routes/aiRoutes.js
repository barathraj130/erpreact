// backend/routes/aiRoutes.js
import express from 'express';
import multer from 'multer';
import { saveForTraining, scanBillWithAI } from '../services/aiService.js';

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

        res.json(result);
    } catch (err) {
        console.error("AI Route Error:", err);
        res.status(500).json({ error: "Brain engine failed", details: err.message });
    }
});

/**
 * @route POST /api/ai/feedback
 * @desc Save corrected data for model training (Supervised Learning)
 */
router.post('/feedback', async (req, res) => {
    try {
        const { scanId, correctedData } = req.body;
        // This is where you would trigger a fine-tuning job or log to a vector DB
        await saveForTraining(null, { scanId, ...correctedData, isCorrection: true });
        res.json({ status: "Success", message: "Feedback saved for next training cycle" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save feedback" });
    }
});

export default router;
