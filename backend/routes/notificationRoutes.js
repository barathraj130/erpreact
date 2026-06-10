// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

// GET /api/notifications - Fetch user notifications
router.get('/', checkAuth, async (req, res) => {
    const userId = req.user?.id;

    try {
        const notifications = await pgModule.pgAll('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error.message);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
});

module.exports = router;