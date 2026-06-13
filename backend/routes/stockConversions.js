// backend/routes/stockConversions.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { triggerN8N } from '../utils/triggerN8N.js';

const router = express.Router();
const OWNER_PHONE = '9787580404';

// ─── GET /lot/:lotId  ────────────────────────────────────────────────────────
router.get('/lot/:lotId', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM stock_conversions WHERE lot_id = $1 ORDER BY conversion_date DESC`,
            [req.params.lotId]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── POST /  ─────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const {
            lot_id, mistake_qty_in, fresh_qty_out, rejected_qty,
            repair_cost_per_piece, repair_worker, payment_mode, notes
        } = req.body;

        const lotRes = await client.query(
            `SELECT * FROM stock_lots WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
            [lot_id, companyId]
        );
        const lot = lotRes.rows[0];
        if (!lot) throw new Error('Lot not found');

        const mistakeIn   = parseInt(mistake_qty_in) || 0;
        const freshOut    = parseInt(fresh_qty_out) || 0;
        const rejectedOut = parseInt(rejected_qty) || 0;

        // Validate: mistake_qty_in = fresh_qty_out + rejected_qty
        if (mistakeIn !== freshOut + rejectedOut) {
            throw new Error(
                `Validation error: mistake_qty_in (${mistakeIn}) must equal fresh_qty_out (${freshOut}) + rejected_qty (${rejectedOut})`
            );
        }

        // Get current mistake avg cost
        const mistakeRow = await client.query(
            `SELECT COALESCE(avg_cost, 0) AS avg_cost, COALESCE(quantity, 0) AS qty
             FROM stock_inventory WHERE lot_id = $1 AND stock_type = 'mistake'`,
            [lot_id]
        );
        const mistakeAvgCost = parseFloat(mistakeRow.rows[0]?.avg_cost || 0);
        const currentMistake = parseInt(mistakeRow.rows[0]?.qty || 0);

        if (mistakeIn > currentMistake) {
            throw new Error(`Cannot convert ${mistakeIn} pcs. Only ${currentMistake} mistake pcs available.`);
        }

        const repairCostPerPc  = parseFloat(repair_cost_per_piece) || 0;
        const totalRepairCost  = freshOut * repairCostPerPc;
        const mistakeCostIn    = mistakeIn * mistakeAvgCost;
        const repairedAvgCost  = freshOut > 0 ? (mistakeCostIn + totalRepairCost) / freshOut : 0;

        // Insert conversion record
        await client.query(`
            INSERT INTO stock_conversions
                (lot_id, conversion_date, mistake_qty_in, fresh_qty_out, rejected_qty,
                 repair_cost_per_piece, total_repair_cost, repair_worker, payment_mode, notes)
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [lot_id, mistakeIn, freshOut, rejectedOut, repairCostPerPc,
            totalRepairCost, repair_worker, payment_mode || 'cash', notes]);

        // Reduce mistake inventory
        await client.query(`
            UPDATE stock_inventory SET
                quantity   = GREATEST(0, quantity - $1),
                total_cost = GREATEST(0, total_cost - $2),
                last_updated = NOW()
            WHERE lot_id = $3 AND stock_type = 'mistake'
        `, [mistakeIn, mistakeCostIn, lot_id]);

        // UPSERT fresh_repaired inventory
        if (freshOut > 0) {
            const freshRepairedCost = freshOut * repairedAvgCost;
            await client.query(`
                INSERT INTO stock_inventory (lot_id, product_id, stock_type, quantity, avg_cost, total_cost)
                SELECT $1, product_id, 'fresh_repaired', $2, $3, $4 FROM stock_lots WHERE id = $1
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity   = stock_inventory.quantity   + $2,
                    total_cost = stock_inventory.total_cost + $4,
                    avg_cost   = (stock_inventory.total_cost + $4) / NULLIF(stock_inventory.quantity + $2, 0),
                    last_updated = NOW()
            `, [lot_id, freshOut, repairedAvgCost, freshRepairedCost]);

            await client.query(`
                INSERT INTO stock_transactions
                    (lot_id, product_id, transaction_type, stock_type_from, stock_type_to, quantity, rate, amount, notes)
                SELECT $1, product_id, 'conversion', 'mistake', 'fresh_repaired', $2, $3, $4, $5
                FROM stock_lots WHERE id = $1
            `, [lot_id, freshOut, repairedAvgCost, freshOut * repairedAvgCost, notes]);
        }

        // UPSERT rejected inventory
        if (rejectedOut > 0) {
            await client.query(`
                INSERT INTO stock_inventory (lot_id, product_id, stock_type, quantity)
                SELECT $1, product_id, 'rejected', $2 FROM stock_lots WHERE id = $1
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = stock_inventory.quantity + $2, last_updated = NOW()
            `, [lot_id, rejectedOut]);
        }

        // Check remaining mistake stock
        const remainingRes = await client.query(
            `SELECT COALESCE(quantity, 0) AS qty FROM stock_inventory WHERE lot_id = $1 AND stock_type = 'mistake'`,
            [lot_id]
        );
        const remaining = parseInt(remainingRes.rows[0]?.qty || 0);
        const newStatus = remaining <= 0 ? 'ready' : 'converting';

        // Update lot
        await client.query(`
            UPDATE stock_lots SET
                repaired_qty        = repaired_qty + $1,
                rejected_qty        = rejected_qty + $2,
                mistake_qty_current = GREATEST(0, mistake_qty_current - $3),
                total_repair_cost   = total_repair_cost + $4,
                status              = $5,
                updated_at = NOW()
            WHERE id = $6
        `, [freshOut, rejectedOut, mistakeIn, totalRepairCost, newStatus, lot_id]);

        // Ledger entries: Repair Expense
        if (totalRepairCost > 0) {
            const payAcct = (payment_mode === 'bank') ? 'Bank Account' : 'Cash Account';
            await client.query(`
                INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
                VALUES
                    ($1, 'Repair Expense', $2, 0, $3, 'stock_conversion', $4, CURRENT_DATE),
                    ($1, $5, 0, $2, $3, 'stock_conversion', $4, CURRENT_DATE)
            `, [companyId, totalRepairCost,
                `Repair cost lot ${lot.lot_number} — ${freshOut} pcs`,
                payment_mode || 'cash', payAcct]);

            // Capitalize repair cost: DR Inventory CR Repair Expense
            await client.query(`
                INSERT INTO ledger_entries (company_id, account_name, debit, credit, description, reference_type, payment_mode, transaction_date)
                VALUES
                    ($1, 'Inventory - Fresh Repaired', $2, 0, $3, 'stock_conversion_capitalize', 'internal', CURRENT_DATE),
                    ($1, 'Repair Expense', 0, $2, $3, 'stock_conversion_capitalize', 'internal', CURRENT_DATE)
            `, [companyId, totalRepairCost,
                `Capitalize repair cost lot ${lot.lot_number}`]);
        }

        await client.query('COMMIT');

        // WhatsApp after COMMIT
        const mistakePurchased = parseInt(lot.mistake_qty_purchased) || 0;
        const totalRepaired    = (parseInt(lot.repaired_qty) || 0) + freshOut;
        const efficiency       = mistakePurchased > 0 ? ((totalRepaired / mistakePurchased) * 100).toFixed(1) : 0;

        triggerN8N('whatsapp-send', {
            phone: OWNER_PHONE,
            message: `LOT ${lot.lot_number} CONVERSION DONE\nConverted: ${freshOut} pcs\nRepair Cost: ₹${totalRepairCost.toFixed(2)}\nAvg Cost: ₹${repairedAvgCost.toFixed(2)}/pc\nConversion Rate: ${efficiency}%`
        });

        res.json({
            success: true,
            repaired_avg_cost: repairedAvgCost,
            total_repair_cost: totalRepairCost,
            new_status: newStatus,
            message: `${freshOut} pcs converted to fresh. Avg cost ₹${repairedAvgCost.toFixed(2)}/pc`
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[stockConversions POST]', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

export default router;
