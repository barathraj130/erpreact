// backend/routes/aiQueryRoutes.js
import express from 'express';
import { transformNLToQuery } from '../services/aiQueryService.js';
import { executeStructuredQuery } from '../services/queryExecutor.js';
import { authMiddleware } from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// Apply Auth Middleware to all AI Query routes
router.use(authMiddleware);

/**
 * @route POST /api/ai-query/query
 * @desc Handle natural language report requests with tenant isolation.
 */
router.post('/query', async (req, res) => {
    try {
        const { query } = req.body;
        const companyId = req.user.active_company_id;
        
        if (!query) {
            return res.status(400).json({ error: "Missing query parameter" });
        }

        console.log(`🔍 [Tenant ${companyId}] Interpreting Query:`, query);

        // 1. Transform NL query to universal structure via AI
        const structuredQuery = await transformNLToQuery(query);

        // 2. Short-circuit if clarification is needed
        if (structuredQuery.error) {
            return res.status(200).json({ status: "CLARIFICATION", message: structuredQuery.error });
        }

        // 3. Execute structured query with company isolation
        const result = await executeStructuredQuery(structuredQuery, companyId);

        // 4. Return results with metadata
        res.json({
            status: "SUCCESS",
            data: result.data,
            meta: result.meta
        });

    } catch (err) {
        console.error("❌ AI Report Engine Error:", err);
        res.status(500).json({ 
            status: "ERROR", 
            error: "Failed to process AI report request", 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

export default router;
