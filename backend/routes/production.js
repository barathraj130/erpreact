// backend/routes/production.js
import express from 'express';
import * as db from '../database/pg.js';
import { authMiddleware } from '../middlewares/jwtAuthMiddleware.js';
import { checkSufficientBalance } from '../utils/balanceCheck.js';

const router = express.Router();

// ─── Ensure tables exist ──────────────────────────────────────────────────────
async function ensureTables() {
    await db.pgRun(`CREATE TABLE IF NOT EXISTS production_lots (
        id                    SERIAL PRIMARY KEY,
        company_id            INTEGER NOT NULL DEFAULT 1,
        lot_number            VARCHAR(50) NOT NULL,
        supplier_id           INTEGER,
        product_id            INTEGER,
        purchase_date         DATE DEFAULT CURRENT_DATE,
        fresh_qty_purchased   INTEGER DEFAULT 0,
        mistake_qty_purchased INTEGER DEFAULT 0,
        fresh_purchase_rate   NUMERIC(10,2) DEFAULT 0,
        mistake_purchase_rate NUMERIC(10,2) DEFAULT 0,
        fresh_purchase_cost   NUMERIC(12,2) DEFAULT 0,
        mistake_purchase_cost NUMERIC(12,2) DEFAULT 0,
        total_purchase_cost   NUMERIC(12,2) DEFAULT 0,
        transport_cost        NUMERIC(10,2) DEFAULT 0,
        total_repair_cost     NUMERIC(12,2) DEFAULT 0,
        fresh_qty_current     INTEGER DEFAULT 0,
        mistake_qty_current   INTEGER DEFAULT 0,
        converted_qty         INTEGER DEFAULT 0,
        rejected_qty          INTEGER DEFAULT 0,
        sold_fresh_qty        INTEGER DEFAULT 0,
        sold_mistake_qty      INTEGER DEFAULT 0,
        status                VARCHAR(30) DEFAULT 'received',
        notes                 TEXT,
        created_by            INTEGER,
        is_deleted            BOOLEAN DEFAULT false,
        created_at            TIMESTAMP DEFAULT NOW(),
        updated_at            TIMESTAMP DEFAULT NOW()
    )`).catch(() => {});

    await db.pgRun(`CREATE TABLE IF NOT EXISTS production_inventory (
        id           SERIAL PRIMARY KEY,
        lot_id       INTEGER REFERENCES production_lots(id),
        product_id   INTEGER,
        stock_type   VARCHAR(20) NOT NULL,
        quantity     INTEGER DEFAULT 0,
        avg_cost     NUMERIC(10,2) DEFAULT 0,
        total_cost   NUMERIC(12,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW(),
        UNIQUE(lot_id, stock_type)
    )`).catch(() => {});

    await db.pgRun(`CREATE TABLE IF NOT EXISTS production_inspections (
        id              SERIAL PRIMARY KEY,
        lot_id          INTEGER REFERENCES production_lots(id),
        inspection_date DATE DEFAULT CURRENT_DATE,
        inspector_name  VARCHAR(100),
        source_type     VARCHAR(20) DEFAULT 'mistake',
        qty_inspected   INTEGER DEFAULT 0,
        qty_ok          INTEGER DEFAULT 0,
        qty_rejected    INTEGER DEFAULT 0,
        notes           TEXT,
        inspected_by    INTEGER,
        created_at      TIMESTAMP DEFAULT NOW()
    )`).catch(() => {});

    await db.pgRun(`CREATE TABLE IF NOT EXISTS production_conversions (
        id                  SERIAL PRIMARY KEY,
        lot_id              INTEGER REFERENCES production_lots(id),
        product_id          INTEGER,
        conversion_date     DATE DEFAULT CURRENT_DATE,
        source_type         VARCHAR(20) DEFAULT 'mistake',
        qty_in              INTEGER DEFAULT 0,
        qty_out             INTEGER DEFAULT 0,
        rejected_qty        INTEGER DEFAULT 0,
        repair_cost_per_piece NUMERIC(10,2) DEFAULT 0,
        total_repair_cost   NUMERIC(12,2) DEFAULT 0,
        repair_worker       VARCHAR(100),
        payment_mode        VARCHAR(20) DEFAULT 'cash',
        converted_avg_cost  NUMERIC(10,2) DEFAULT 0,
        notes               TEXT,
        converted_by        INTEGER,
        created_at          TIMESTAMP DEFAULT NOW()
    )`).catch(() => {});

    await db.pgRun(`CREATE TABLE IF NOT EXISTS production_returns (
        id              SERIAL PRIMARY KEY,
        lot_id          INTEGER REFERENCES production_lots(id),
        invoice_id      INTEGER,
        customer_id     INTEGER,
        return_date     DATE DEFAULT CURRENT_DATE,
        total_returned  INTEGER DEFAULT 0,
        returned_ok     INTEGER DEFAULT 0,
        returned_mistake INTEGER DEFAULT 0,
        return_reason   TEXT,
        notes           TEXT,
        processed_by    INTEGER,
        created_at      TIMESTAMP DEFAULT NOW()
    )`).catch(() => {});

    await db.pgRun(`CREATE TABLE IF NOT EXISTS production_stock_transactions (
        id               SERIAL PRIMARY KEY,
        lot_id           INTEGER REFERENCES production_lots(id),
        product_id       INTEGER,
        transaction_type VARCHAR(30) NOT NULL,
        stock_type_from  VARCHAR(20),
        stock_type_to    VARCHAR(20),
        quantity         INTEGER NOT NULL,
        rate             NUMERIC(10,2) DEFAULT 0,
        amount           NUMERIC(12,2) DEFAULT 0,
        reference_type   VARCHAR(30),
        reference_id     INTEGER,
        notes            TEXT,
        created_by       INTEGER,
        created_at       TIMESTAMP DEFAULT NOW()
    )`).catch(() => {});
}

ensureTables();

// ─── Lot number generator ─────────────────────────────────────────────────────
async function generateLotNumber(client, companyId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    await client.query(`
        INSERT INTO invoice_number_series (company_id, bill_type, prefix, year, month, last_number)
        VALUES ($1, 'production_lot', 'PROD', $2, $3, 1)
        ON CONFLICT (company_id, bill_type, year, month)
        DO UPDATE SET last_number = invoice_number_series.last_number + 1
    `, [companyId, year, parseInt(month)]);

    const row = await client.query(`
        SELECT last_number FROM invoice_number_series
        WHERE company_id=$1 AND bill_type='production_lot' AND year=$2 AND month=$3
    `, [companyId, year, parseInt(month)]);

    const num = String(row.rows[0].last_number).padStart(3, '0');
    return `PROD/${year}/${month}/${num}`;
}

// ─── GET /lots ────────────────────────────────────────────────────────────────
router.get('/lots', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const statusFilter = req.query.status ? `AND pl.status = '${req.query.status}'` : '';
        const rows = await db.pgAll(`
            SELECT pl.*,
                p.name AS product_name,
                s.name AS supplier_name,
                COALESCE(pi_f.quantity, 0) AS fresh_available,
                COALESCE(pi_m.quantity, 0) AS mistake_available,
                COALESCE(pi_c.quantity, 0) AS converted_available,
                COALESCE(pi_r.quantity, 0) AS rejected_total,
                COALESCE(pi_f.quantity, 0) + COALESCE(pi_c.quantity, 0) AS total_fresh_available
            FROM production_lots pl
            LEFT JOIN products p ON p.id = pl.product_id
            LEFT JOIN suppliers s ON s.id = pl.supplier_id
            LEFT JOIN production_inventory pi_f ON pi_f.lot_id = pl.id AND pi_f.stock_type = 'fresh'
            LEFT JOIN production_inventory pi_m ON pi_m.lot_id = pl.id AND pi_m.stock_type = 'mistake'
            LEFT JOIN production_inventory pi_c ON pi_c.lot_id = pl.id AND pi_c.stock_type = 'fresh_converted'
            LEFT JOIN production_inventory pi_r ON pi_r.lot_id = pl.id AND pi_r.stock_type = 'rejected'
            WHERE pl.is_deleted = false AND pl.company_id = $1 ${statusFilter}
            ORDER BY pl.purchase_date DESC, pl.created_at DESC
        `, [companyId]);
        res.json(rows);
    } catch (e) {
        console.error('GET /production/lots', e.message);
        res.json([]);
    }
});

// ─── POST /lots ───────────────────────────────────────────────────────────────
router.post('/lots', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const { supplier_id, product_id, purchase_date, notes } = req.body;
        const lotNumber = await generateLotNumber(client, companyId);
        const result = await client.query(`
            INSERT INTO production_lots (company_id, lot_number, supplier_id, product_id, purchase_date, status, notes, created_by)
            VALUES ($1,$2,$3,$4,$5,'received',$6,$7) RETURNING *
        `, [companyId, lotNumber, supplier_id || null, product_id || null,
            purchase_date || new Date().toISOString().split('T')[0], notes || null,
            req.user.user_id || null]);
        await client.query('COMMIT');
        res.json({ success: true, lot: result.rows[0] });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /production/lots', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── GET /lots/:id ────────────────────────────────────────────────────────────
router.get('/lots/:id', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const lotRes = await db.pgGet(`
            SELECT pl.*, p.name AS product_name, s.name AS supplier_name, s.phone AS supplier_phone
            FROM production_lots pl
            LEFT JOIN products p ON p.id = pl.product_id
            LEFT JOIN suppliers s ON s.id = pl.supplier_id
            WHERE pl.id = $1 AND pl.company_id = $2 AND pl.is_deleted = false
        `, [req.params.id, companyId]);

        if (!lotRes) return res.json({ success: false, error: 'Lot not found' });

        const [inventory, inspections, conversions, returns, transactions] = await Promise.all([
            db.pgAll('SELECT * FROM production_inventory WHERE lot_id=$1 ORDER BY stock_type', [req.params.id]),
            db.pgAll('SELECT * FROM production_inspections WHERE lot_id=$1 ORDER BY created_at DESC', [req.params.id]),
            db.pgAll('SELECT * FROM production_conversions WHERE lot_id=$1 ORDER BY created_at DESC', [req.params.id]),
            db.pgAll(`SELECT pr.*, u.name AS customer_name
                FROM production_returns pr
                LEFT JOIN users u ON u.id = pr.customer_id
                WHERE pr.lot_id = $1 ORDER BY pr.created_at DESC`, [req.params.id]),
            db.pgAll('SELECT * FROM production_stock_transactions WHERE lot_id=$1 ORDER BY created_at DESC', [req.params.id]),
        ]);

        res.json({ success: true, lot: lotRes, inventory, inspections, conversions, returns, transactions });
    } catch (e) {
        console.error('GET /production/lots/:id', e.message);
        res.json({ success: false, error: e.message });
    }
});

// ─── POST /lots/:id/purchase ──────────────────────────────────────────────────
router.post('/lots/:id/purchase', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const lotId = req.params.id;
        const { fresh_qty, mistake_qty, fresh_rate, mistake_rate, transport_cost, payment_mode, paid_amount } = req.body;

        const lotRes = await client.query('SELECT * FROM production_lots WHERE id=$1 AND company_id=$2', [lotId, companyId]);
        const lot = lotRes.rows[0];
        if (!lot) throw new Error('Lot not found');

        const fq = parseFloat(fresh_qty || 0);
        const mq = parseFloat(mistake_qty || 0);
        const fr = parseFloat(fresh_rate || 0);
        const mr = parseFloat(mistake_rate || 0);
        const tc = parseFloat(transport_cost || 0);
        const fresh_cost = fq * fr;
        const mistake_cost = mq * mr;
        const total_cost = fresh_cost + mistake_cost + tc;
        const paid = parseFloat(paid_amount || 0);

        await client.query(`
            UPDATE production_lots SET
                fresh_qty_purchased   = fresh_qty_purchased + $1,
                mistake_qty_purchased = mistake_qty_purchased + $2,
                fresh_qty_current     = fresh_qty_current + $1,
                mistake_qty_current   = mistake_qty_current + $2,
                fresh_purchase_rate   = $3,
                mistake_purchase_rate = $4,
                fresh_purchase_cost   = fresh_purchase_cost + $5,
                mistake_purchase_cost = mistake_purchase_cost + $6,
                total_purchase_cost   = total_purchase_cost + $7,
                transport_cost        = transport_cost + $8,
                updated_at            = NOW()
            WHERE id = $9
        `, [fq, mq, fr, mr, fresh_cost, mistake_cost, total_cost, tc, lotId]);

        if (fq > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity, avg_cost, total_cost)
                VALUES ($1,$2,'fresh',$3,$4,$5)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity   = production_inventory.quantity + $3,
                    total_cost = production_inventory.total_cost + $5,
                    avg_cost   = (production_inventory.total_cost + $5) / (production_inventory.quantity + $3),
                    last_updated = NOW()
            `, [lotId, lot.product_id, fq, fr, fresh_cost]);
        }

        if (mq > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity, avg_cost, total_cost)
                VALUES ($1,$2,'mistake',$3,$4,$5)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity   = production_inventory.quantity + $3,
                    total_cost = production_inventory.total_cost + $5,
                    avg_cost   = (production_inventory.total_cost + $5) / (production_inventory.quantity + $3),
                    last_updated = NOW()
            `, [lotId, lot.product_id, mq, mr, mistake_cost]);
        }

        if (fq > 0) {
            await client.query(`
                INSERT INTO production_stock_transactions (lot_id, product_id, transaction_type, stock_type_to, quantity, rate, amount, reference_type, notes, created_by)
                VALUES ($1,$2,'purchase','fresh',$3,$4,$5,'purchase','Fresh stock purchased',$6)
            `, [lotId, lot.product_id, fq, fr, fresh_cost, req.user.user_id || null]);
        }
        if (mq > 0) {
            await client.query(`
                INSERT INTO production_stock_transactions (lot_id, product_id, transaction_type, stock_type_to, quantity, rate, amount, reference_type, notes, created_by)
                VALUES ($1,$2,'purchase','mistake',$3,$4,$5,'purchase','Mistake stock purchased',$6)
            `, [lotId, lot.product_id, mq, mr, mistake_cost, req.user.user_id || null]);
        }

        if (paid > 0 && payment_mode && payment_mode !== 'personal') {
            const balCheck = await checkSufficientBalance(client, companyId, payment_mode, paid);
            if (!balCheck.sufficient) throw new Error(balCheck.message);

            const ledgerTable = payment_mode === 'cash' ? 'cash_ledger' : 'bank_ledger';
            await client.query(`
                INSERT INTO ${ledgerTable} (company_id, source, amount, direction, date, notes)
                VALUES ($1,'Production Purchase',$2,'out',CURRENT_DATE,$3)
            `, [companyId, paid, `Purchase payment for lot ${lot.lot_number}`]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Purchase recorded for lot ${lot.lot_number}` });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /production/lots/:id/purchase', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── POST /lots/:id/inspect ───────────────────────────────────────────────────
router.post('/lots/:id/inspect', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const lotId = req.params.id;
        const { inspector_name, source_type, qty_inspected, qty_ok, qty_rejected, notes } = req.body;

        const lotRes = await client.query('SELECT * FROM production_lots WHERE id=$1 AND company_id=$2', [lotId, companyId]);
        if (!lotRes.rows[0]) throw new Error('Lot not found');

        const srcType = source_type || 'mistake';
        const rejected = parseFloat(qty_rejected || 0);

        await client.query(`
            INSERT INTO production_inspections (lot_id, inspection_date, inspector_name, source_type, qty_inspected, qty_ok, qty_rejected, notes, inspected_by)
            VALUES ($1,CURRENT_DATE,$2,$3,$4,$5,$6,$7,$8)
        `, [lotId, inspector_name || '', srcType, qty_inspected || 0, qty_ok || 0, rejected, notes || '', req.user.user_id || null]);

        if (rejected > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity)
                SELECT $1, product_id, 'rejected', $2 FROM production_lots WHERE id=$1
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = production_inventory.quantity + $2, last_updated = NOW()
            `, [lotId, rejected]);

            await client.query(`
                UPDATE production_inventory SET quantity = GREATEST(0, quantity - $1), last_updated = NOW()
                WHERE lot_id = $2 AND stock_type = $3
            `, [rejected, lotId, srcType]);

            await client.query(`
                UPDATE production_lots SET rejected_qty = rejected_qty + $1, updated_at = NOW() WHERE id = $2
            `, [rejected, lotId]);

            await client.query(`
                INSERT INTO production_stock_transactions (lot_id, product_id, transaction_type, stock_type_from, stock_type_to, quantity, reference_type, notes, created_by)
                SELECT $1, product_id, 'rejection', $2, 'rejected', $3, 'inspection', $4, $5 FROM production_lots WHERE id=$1
            `, [lotId, srcType, rejected, notes || 'Rejected during inspection', req.user.user_id || null]);
        }

        await client.query(`UPDATE production_lots SET status='inspecting', updated_at=NOW() WHERE id=$1`, [lotId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /production/lots/:id/inspect', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── POST /lots/:id/convert ───────────────────────────────────────────────────
router.post('/lots/:id/convert', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const lotId = req.params.id;
        const { source_type, qty_in, qty_out, rejected_qty, repair_cost_per_piece, repair_worker, payment_mode, notes } = req.body;

        const lotRes = await client.query('SELECT * FROM production_lots WHERE id=$1 AND company_id=$2', [lotId, companyId]);
        const lot = lotRes.rows[0];
        if (!lot) throw new Error('Lot not found');

        const srcType = source_type || 'mistake';
        const qIn  = parseFloat(qty_in  || 0);
        const qOut = parseFloat(qty_out || 0);
        const qRej = parseFloat(rejected_qty || 0);
        const repairRate = parseFloat(repair_cost_per_piece || 0);

        const mistakeRes = await client.query(`
            SELECT COALESCE(avg_cost, 0) AS avg_cost, COALESCE(quantity, 0) AS quantity
            FROM production_inventory WHERE lot_id=$1 AND stock_type=$2
        `, [lotId, srcType]);

        const mistakeAvgCost = parseFloat(mistakeRes.rows[0]?.avg_cost || 0);
        const available = parseInt(mistakeRes.rows[0]?.quantity || 0);

        if (qIn > available) throw new Error(`Only ${available} pcs available in ${srcType} stock`);

        const total_repair_cost = qOut * repairRate;
        const total_mistake_cost = qIn * mistakeAvgCost;
        const converted_avg_cost = qOut > 0 ? (total_mistake_cost + total_repair_cost) / qOut : 0;

        if (total_repair_cost > 0 && payment_mode && payment_mode !== 'personal') {
            const balCheck = await checkSufficientBalance(client, companyId, payment_mode, total_repair_cost);
            if (!balCheck.sufficient) throw new Error(balCheck.message);
        }

        await client.query(`
            UPDATE production_inventory SET quantity = GREATEST(0, quantity - $1), last_updated = NOW()
            WHERE lot_id = $2 AND stock_type = $3
        `, [qIn, lotId, srcType]);

        if (qOut > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity, avg_cost, total_cost)
                VALUES ($1,$2,'fresh_converted',$3,$4,$5)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity   = production_inventory.quantity + $3,
                    total_cost = production_inventory.total_cost + $5,
                    avg_cost   = (production_inventory.total_cost + $5) / (production_inventory.quantity + $3),
                    last_updated = NOW()
            `, [lotId, lot.product_id, qOut, converted_avg_cost, qOut * converted_avg_cost]);
        }

        if (qRej > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity)
                VALUES ($1,$2,'rejected',$3)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = production_inventory.quantity + $3, last_updated = NOW()
            `, [lotId, lot.product_id, qRej]);
        }

        await client.query(`
            INSERT INTO production_conversions (lot_id, product_id, source_type, qty_in, qty_out, rejected_qty,
                repair_cost_per_piece, total_repair_cost, repair_worker, payment_mode, converted_avg_cost, notes, converted_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [lotId, lot.product_id, srcType, qIn, qOut, qRej,
            repairRate, total_repair_cost, repair_worker || '', payment_mode || 'cash',
            converted_avg_cost, notes || '', req.user.user_id || null]);

        await client.query(`
            UPDATE production_lots SET
                converted_qty       = converted_qty + $1,
                rejected_qty        = rejected_qty + $2,
                mistake_qty_current = GREATEST(0, mistake_qty_current - $3),
                total_repair_cost   = total_repair_cost + $4,
                status              = 'converting',
                updated_at          = NOW()
            WHERE id = $5
        `, [qOut, qRej, qIn, total_repair_cost, lotId]);

        await client.query(`
            INSERT INTO production_stock_transactions (lot_id, product_id, transaction_type, stock_type_from, stock_type_to, quantity, rate, amount, reference_type, notes, created_by)
            VALUES ($1,$2,'conversion',$3,'fresh_converted',$4,$5,$6,'conversion',$7,$8)
        `, [lotId, lot.product_id, srcType, qOut, converted_avg_cost, qOut * converted_avg_cost, notes || '', req.user.user_id || null]);

        if (total_repair_cost > 0 && payment_mode && payment_mode !== 'personal') {
            const ledgerTable = payment_mode === 'cash' ? 'cash_ledger' : 'bank_ledger';
            await client.query(`
                INSERT INTO ${ledgerTable} (company_id, source, amount, direction, date, notes)
                VALUES ($1,'Repair Cost',$2,'out',CURRENT_DATE,$3)
            `, [companyId, total_repair_cost, `Repair ${qOut} pcs — lot ${lot.lot_number}`]);
        }

        const mistakeLeft = await client.query(`
            SELECT COALESCE(quantity, 0) AS qty FROM production_inventory WHERE lot_id=$1 AND stock_type='mistake'
        `, [lotId]);
        if (parseInt(mistakeLeft.rows[0]?.qty || 0) <= 0) {
            await client.query(`UPDATE production_lots SET status='ready', updated_at=NOW() WHERE id=$1`, [lotId]);
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            converted_avg_cost,
            total_repair_cost,
            message: `${qOut} pcs converted to fresh at avg cost ₹${converted_avg_cost.toFixed(2)}/pc`
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /production/lots/:id/convert', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── POST /lots/:id/return ────────────────────────────────────────────────────
router.post('/lots/:id/return', authMiddleware, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const companyId = req.user.active_company_id;
        const lotId = req.params.id;
        const { invoice_id, customer_id, return_qty, returned_ok, returned_mistake, return_reason, notes } = req.body;

        const lotRes = await client.query('SELECT * FROM production_lots WHERE id=$1 AND company_id=$2', [lotId, companyId]);
        const lot = lotRes.rows[0];
        if (!lot) throw new Error('Lot not found');

        const rOk  = parseFloat(returned_ok      || 0);
        const rMis = parseFloat(returned_mistake  || 0);

        await client.query(`
            INSERT INTO production_returns (lot_id, invoice_id, customer_id, return_date, total_returned, returned_ok, returned_mistake, return_reason, notes, processed_by)
            VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,$9)
        `, [lotId, invoice_id || null, customer_id || null,
            return_qty || 0, rOk, rMis,
            return_reason || '', notes || '', req.user.user_id || null]);

        if (rOk > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity)
                VALUES ($1,$2,'fresh',$3)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = production_inventory.quantity + $3, last_updated = NOW()
            `, [lotId, lot.product_id, rOk]);

            await client.query(`
                INSERT INTO production_stock_transactions (lot_id, product_id, transaction_type, stock_type_to, quantity, reference_type, reference_id, notes, created_by)
                VALUES ($1,$2,'return_fresh','fresh',$3,'invoice',$4,$5,$6)
            `, [lotId, lot.product_id, rOk, invoice_id || null,
                `Customer return OK — ${return_reason || ''}`, req.user.user_id || null]);
        }

        if (rMis > 0) {
            await client.query(`
                INSERT INTO production_inventory (lot_id, product_id, stock_type, quantity)
                VALUES ($1,$2,'mistake',$3)
                ON CONFLICT (lot_id, stock_type) DO UPDATE SET
                    quantity = production_inventory.quantity + $3, last_updated = NOW()
            `, [lotId, lot.product_id, rMis]);

            await client.query(`
                INSERT INTO production_stock_transactions (lot_id, product_id, transaction_type, stock_type_to, quantity, reference_type, reference_id, notes, created_by)
                VALUES ($1,$2,'return_mistake','mistake',$3,'invoice',$4,$5,$6)
            `, [lotId, lot.product_id, rMis, invoice_id || null,
                `Customer return mistake — ${return_reason || ''}`, req.user.user_id || null]);

            await client.query(`
                UPDATE production_lots SET mistake_qty_current = mistake_qty_current + $1, updated_at = NOW() WHERE id = $2
            `, [rMis, lotId]);
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Return processed: ${rOk} pcs to fresh, ${rMis} pcs to mistake.`
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /production/lots/:id/return', e.message);
        res.json({ success: false, error: e.message });
    } finally { client.release(); }
});

// ─── GET /inventory ───────────────────────────────────────────────────────────
router.get('/inventory', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(`
            SELECT
                pl.id AS lot_id, pl.lot_number, pl.purchase_date, pl.status,
                p.name AS product_name, s.name AS supplier_name,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'fresh' THEN pi.quantity ELSE 0 END), 0)             AS fresh_qty,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'fresh_converted' THEN pi.quantity ELSE 0 END), 0)   AS converted_qty,
                COALESCE(SUM(CASE WHEN pi.stock_type IN ('fresh','fresh_converted') THEN pi.quantity ELSE 0 END), 0) AS total_fresh,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'mistake' THEN pi.quantity ELSE 0 END), 0)           AS mistake_qty,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'rejected' THEN pi.quantity ELSE 0 END), 0)          AS rejected_qty,
                COALESCE(SUM(pi.total_cost), 0)                                                             AS inventory_value,
                (NOW()::date - pl.purchase_date)                                                            AS days_old
            FROM production_lots pl
            JOIN production_inventory pi ON pi.lot_id = pl.id
            JOIN products p ON p.id = pl.product_id
            LEFT JOIN suppliers s ON s.id = pl.supplier_id
            WHERE pl.is_deleted = false AND pl.company_id = $1
            GROUP BY pl.id, pl.lot_number, pl.purchase_date, pl.status, p.name, s.name
            HAVING COALESCE(SUM(pi.quantity), 0) > 0
            ORDER BY pl.purchase_date DESC
        `, [companyId]);
        res.json(rows);
    } catch (e) {
        console.error('GET /production/inventory', e.message);
        res.json([]);
    }
});

// ─── GET /inventory/summary ───────────────────────────────────────────────────
router.get('/inventory/summary', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const row = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN pi.stock_type = 'fresh' THEN pi.quantity ELSE 0 END), 0)             AS total_fresh,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'fresh_converted' THEN pi.quantity ELSE 0 END), 0)   AS total_converted,
                COALESCE(SUM(CASE WHEN pi.stock_type IN ('fresh','fresh_converted') THEN pi.quantity ELSE 0 END), 0) AS total_fresh_available,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'mistake' THEN pi.quantity ELSE 0 END), 0)           AS total_mistake,
                COALESCE(SUM(CASE WHEN pi.stock_type = 'rejected' THEN pi.quantity ELSE 0 END), 0)          AS total_rejected,
                COALESCE(SUM(pi.total_cost), 0)                                                             AS total_inventory_value,
                COUNT(DISTINCT pl.id)                                                                       AS active_lots
            FROM production_inventory pi
            JOIN production_lots pl ON pl.id = pi.lot_id
            WHERE pl.is_deleted = false AND pl.company_id = $1
        `, [companyId]);
        res.json(row || { total_fresh: 0, total_converted: 0, total_fresh_available: 0, total_mistake: 0, total_rejected: 0, total_inventory_value: 0, active_lots: 0 });
    } catch (e) {
        console.error('GET /production/inventory/summary', e.message);
        res.json({ total_fresh: 0, total_converted: 0, total_fresh_available: 0, total_mistake: 0, total_rejected: 0, total_inventory_value: 0, active_lots: 0 });
    }
});

export default router;
