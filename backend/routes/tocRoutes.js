// Theory of Constraints Routes
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// ============================================================
// 1. CONSTRAINTS MANAGEMENT
// ============================================================

// GET all constraints
router.get('/constraints', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    
    try {
        const sql = `
            SELECT c.*, 
                   COUNT(ca.id) as action_count,
                   COUNT(CASE WHEN ca.status = 'COMPLETED' THEN 1 END) as completed_actions
            FROM constraints c
            LEFT JOIN constraint_actions ca ON c.id = ca.constraint_id
            WHERE c.company_id = $1
            GROUP BY c.id
            ORDER BY c.priority ASC, c.created_at DESC
        `;
        
        const constraints = await db.pgAll(sql, [companyId]);
        res.json(constraints);
    } catch (error) {
        console.error('Error fetching constraints:', error);
        res.status(500).json({ error: 'Failed to fetch constraints' });
    }
});

// POST create new constraint
router.post('/constraints', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const {
        constraint_name,
        constraint_type,
        area,
        description,
        capacity,
        demand,
        priority
    } = req.body;

    try {
        // Calculate utilization
        const utilization = capacity > 0 ? (demand / capacity) * 100 : 0;

        const sql = `
            INSERT INTO constraints (
                company_id, constraint_name, constraint_type, area, description,
                capacity, demand, utilization_percent, priority
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const result = await db.pgRun(sql, [
            companyId,
            constraint_name,
            constraint_type,
            area,
            description,
            capacity || 0,
            demand || 0,
            utilization,
            priority || 1
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating constraint:', error);
        res.status(500).json({ error: 'Failed to create constraint' });
    }
});

// PUT update constraint status
router.put('/constraints/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    const { status, capacity, demand, description } = req.body;

    try {
        const utilization = capacity > 0 ? (demand / capacity) * 100 : 0;

        const sql = `
            UPDATE constraints 
            SET status = $1,
                capacity = $2,
                demand = $3,
                description = $4,
                utilization_percent = $5,
                updated_at = NOW()
            WHERE id = $6 AND company_id = $7
            RETURNING *
        `;

        const result = await db.pgRun(sql, [
            status,
            capacity,
            demand,
            description,
            utilization,
            id,
            companyId
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Constraint not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating constraint:', error);
        res.status(500).json({ error: 'Failed to update constraint' });
    }
});

// ============================================================
// 2. THROUGHPUT ACCOUNTING
// ============================================================

// GET throughput metrics
router.get('/throughput', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { period_start, period_end } = req.query;

    try {
        let sql = `
            SELECT *
            FROM throughput_metrics
            WHERE company_id = $1
        `;
        const params = [companyId];

        if (period_start && period_end) {
            sql += ` AND period_start >= $2 AND period_end <= $3`;
            params.push(period_start, period_end);
        }

        sql += ` ORDER BY period_start DESC LIMIT 12`;

        const metrics = await db.pgAll(sql, params);
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching throughput metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// POST calculate and save throughput metrics
router.post('/throughput/calculate', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const {
        period_start,
        period_end,
        total_sales,
        totally_variable_costs,
        operating_expense,
        raw_materials,
        work_in_process,
        finished_goods
    } = req.body;

    try {
        // Calculate TOC metrics
        const throughput = total_sales - totally_variable_costs;
        const total_investment = raw_materials + work_in_process + finished_goods;
        const net_profit = throughput - operating_expense;
        const return_on_investment = total_investment > 0 ? (net_profit / total_investment) * 100 : 0;
        const productivity = operating_expense > 0 ? throughput / operating_expense : 0;
        const investment_turns = total_investment > 0 ? throughput / total_investment : 0;

        const sql = `
            INSERT INTO throughput_metrics (
                company_id, period_start, period_end,
                total_sales, totally_variable_costs, throughput,
                raw_materials, work_in_process, finished_goods, total_investment,
                operating_expense, net_profit, return_on_investment,
                productivity, investment_turns
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;

        const result = await db.pgRun(sql, [
            companyId,
            period_start,
            period_end,
            total_sales,
            totally_variable_costs,
            throughput,
            raw_materials || 0,
            work_in_process || 0,
            finished_goods || 0,
            total_investment,
            operating_expense,
            net_profit,
            return_on_investment,
            productivity,
            investment_turns
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error calculating throughput:', error);
        res.status(500).json({ error: 'Failed to calculate throughput metrics' });
    }
});

// ============================================================
// 3. CONSTRAINT ACTIONS (5 Focusing Steps)
// ============================================================

// GET actions for a constraint
router.get('/constraints/:id/actions', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    try {
        const sql = `
            SELECT ca.*, u.username as assigned_to_name
            FROM constraint_actions ca
            LEFT JOIN users u ON ca.assigned_to = u.id
            WHERE ca.constraint_id = $1 AND ca.company_id = $2
            ORDER BY ca.step_number ASC, ca.created_at ASC
        `;

        const actions = await db.pgAll(sql, [id, companyId]);
        res.json(actions);
    } catch (error) {
        console.error('Error fetching actions:', error);
        res.status(500).json({ error: 'Failed to fetch actions' });
    }
});

// POST create action for constraint
router.post('/constraints/:id/actions', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    const {
        step_number,
        step_name,
        action_description,
        assigned_to,
        due_date
    } = req.body;

    try {
        const sql = `
            INSERT INTO constraint_actions (
                constraint_id, company_id, step_number, step_name,
                action_description, assigned_to, due_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const result = await db.pgRun(sql, [
            id,
            companyId,
            step_number,
            step_name,
            action_description,
            assigned_to,
            due_date
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating action:', error);
        res.status(500).json({ error: 'Failed to create action' });
    }
});

// PUT update action status
router.put('/actions/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    const { status, notes, completion_date } = req.body;

    try {
        const sql = `
            UPDATE constraint_actions
            SET status = $1,
                notes = $2,
                completion_date = $3,
                updated_at = NOW()
            WHERE id = $4 AND company_id = $5
            RETURNING *
        `;

        const result = await db.pgRun(sql, [
            status,
            notes,
            completion_date || (status === 'COMPLETED' ? new Date() : null),
            id,
            companyId
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Action not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating action:', error);
        res.status(500).json({ error: 'Failed to update action' });
    }
});

// ============================================================
// 4. TOC DASHBOARD / ANALYTICS
// ============================================================

// GET TOC Dashboard Summary
router.get('/dashboard', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;

    try {
        // Get active constraints count
        const constraintsCount = await db.pgGet(
            `SELECT COUNT(*) as count FROM constraints WHERE company_id = $1 AND status = 'ACTIVE'`,
            [companyId]
        );

        // Get latest throughput metrics
        const latestMetrics = await db.pgGet(
            `SELECT * FROM throughput_metrics WHERE company_id = $1 ORDER BY period_end DESC LIMIT 1`,
            [companyId]
        );

        // Get pending actions count
        const pendingActions = await db.pgGet(
            `SELECT COUNT(*) as count FROM constraint_actions WHERE company_id = $1 AND status != 'COMPLETED'`,
            [companyId]
        );

        // Get top constraint by utilization
        const topConstraint = await db.pgGet(
            `SELECT * FROM constraints WHERE company_id = $1 AND status = 'ACTIVE' ORDER BY utilization_percent DESC LIMIT 1`,
            [companyId]
        );

        res.json({
            activeConstraints: constraintsCount?.count || 0,
            latestMetrics: latestMetrics || null,
            pendingActions: pendingActions?.count || 0,
            topConstraint: topConstraint || null
        });
    } catch (error) {
        console.error('Error fetching TOC dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

export default router;
