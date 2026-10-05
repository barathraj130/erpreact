// backend/services/notificationService.js
//
// Centralized notification engine. Every ERP module that wants to alert the
// admin calls createNotification() here — nothing sends SMS directly. This
// records the event, queues one SMS per active recipient
// (sms_notification_recipients), and a background sweep hands each queued
// message off to n8n's single generic 'notify-sms' webhook (one n8n chain —
// Webhook -> Split Out -> SMS provider — reused by every event type, instead
// of one n8n workflow per category).
//
// "Sent" here means "handed off to n8n successfully" (triggerN8N's fetch
// didn't throw) — there's no delivery receipt flowing back from the SMS
// provider, so this tracks hand-off, not final delivery.
import * as db from '../database/pg.js';
import { triggerN8N } from '../utils/triggerN8N.js';

const RETRY_BACKOFF_MINUTES = [1, 5, 15]; // attempt 1 -> wait 1m, attempt 2 -> wait 5m, attempt 3 -> wait 15m
const MAX_RETRIES = RETRY_BACKOFF_MINUTES.length;

let tablesEnsured = false;
async function ensureNotificationTables() {
    if (tablesEnsured) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS sms_notifications (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL,
            event_type       VARCHAR(50) NOT NULL,
            title            VARCHAR(200),
            message          TEXT NOT NULL,
            priority         VARCHAR(10) NOT NULL DEFAULT 'NORMAL'
                             CHECK (priority IN ('LOW','NORMAL','HIGH')),
            related_entity_type VARCHAR(50),
            related_entity_id   INTEGER,
            idempotency_key  VARCHAR(150),
            status           VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','QUEUED','SENDING','SENT','FAILED','CANCELLED')),
            created_at       TIMESTAMP DEFAULT NOW(),
            read_at          TIMESTAMP
        )
    `).catch(e => console.warn('[notificationService] sms_notifications guard:', e.message));

    await db.query(`CREATE INDEX IF NOT EXISTS idx_sms_notifications_idem ON sms_notifications (company_id, idempotency_key)`).catch(() => {});

    await db.query(`
        CREATE TABLE IF NOT EXISTS sms_messages (
            id               SERIAL PRIMARY KEY,
            notification_id  INTEGER REFERENCES sms_notifications(id) ON DELETE CASCADE,
            recipient        VARCHAR(20) NOT NULL,
            message          TEXT NOT NULL,
            status           VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','QUEUED','SENDING','SENT','FAILED','CANCELLED')),
            retry_count      INTEGER NOT NULL DEFAULT 0,
            next_retry_at    TIMESTAMP DEFAULT NOW(),
            sent_at          TIMESTAMP,
            failed_at        TIMESTAMP,
            error_message    TEXT,
            created_at       TIMESTAMP DEFAULT NOW()
        )
    `).catch(e => console.warn('[notificationService] sms_messages guard:', e.message));

    await db.query(`
        CREATE TABLE IF NOT EXISTS sms_notification_preferences (
            company_id          INTEGER PRIMARY KEY,
            sms_enabled         BOOLEAN NOT NULL DEFAULT true,
            notify_attendance   BOOLEAN NOT NULL DEFAULT true,
            notify_purchases    BOOLEAN NOT NULL DEFAULT true,
            notify_products     BOOLEAN NOT NULL DEFAULT true,
            notify_inventory    BOOLEAN NOT NULL DEFAULT true,
            notify_sales        BOOLEAN NOT NULL DEFAULT true,
            notify_customer_payments BOOLEAN NOT NULL DEFAULT true,
            notify_supplier_payments BOOLEAN NOT NULL DEFAULT true,
            notify_day_closing  BOOLEAN NOT NULL DEFAULT true,
            notify_ledger       BOOLEAN NOT NULL DEFAULT true,
            notify_security     BOOLEAN NOT NULL DEFAULT true,
            updated_at          TIMESTAMP DEFAULT NOW()
        )
    `).catch(e => console.warn('[notificationService] sms_notification_preferences guard:', e.message));

    tablesEnsured = true;
}

// Maps an event type to the preference column that gates it.
const CATEGORY_OF = {
    ATTENDANCE_MARKED: 'notify_attendance',
    PURCHASE_CREATED: 'notify_purchases', PURCHASE_PAYMENT_MADE: 'notify_purchases', PURCHASE_LARGE: 'notify_purchases',
    PRODUCT_ADDED: 'notify_products',
    STOCK_RECEIVED: 'notify_inventory', STOCK_LOW: 'notify_inventory', STOCK_OUT: 'notify_inventory', STOCK_ADJUSTED: 'notify_inventory',
    SALE_CREATED: 'notify_sales', SALE_CANCELLED: 'notify_sales', SALE_CREDIT: 'notify_sales',
    CUSTOMER_PAYMENT_RECEIVED: 'notify_customer_payments', CUSTOMER_OUTSTANDING: 'notify_customer_payments', CUSTOMER_OVERDUE: 'notify_customer_payments',
    SUPPLIER_OUTSTANDING: 'notify_supplier_payments', SUPPLIER_OVERDUE: 'notify_supplier_payments',
    DAY_CLOSING_PENDING: 'notify_day_closing', DAY_CLOSING_DONE: 'notify_day_closing', DAY_CLOSING_MISMATCH: 'notify_day_closing',
    LEDGER_ALERT: 'notify_ledger',
    SECURITY_ALERT: 'notify_security',
};

export async function getPreferences(companyId) {
    await ensureNotificationTables();
    const row = await db.pgGet(`SELECT * FROM sms_notification_preferences WHERE company_id = $1`, [companyId]);
    if (row) return row;
    return db.pgGet(
        `INSERT INTO sms_notification_preferences (company_id) VALUES ($1)
         ON CONFLICT (company_id) DO UPDATE SET company_id = EXCLUDED.company_id
         RETURNING *`,
        [companyId]
    );
}

export async function updatePreferences(companyId, fields) {
    await ensureNotificationTables();
    const allowed = ['sms_enabled', ...Object.values(CATEGORY_OF)];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (keys.length === 0) return getPreferences(companyId);
    await getPreferences(companyId); // ensure row exists
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await db.pgRun(
        `UPDATE sms_notification_preferences SET ${setClause}, updated_at = NOW() WHERE company_id = $1`,
        [companyId, ...keys.map(k => fields[k])]
    );
    return getPreferences(companyId);
}

/**
 * Records an event and queues one SMS per active recipient — the single
 * entry point every ERP module should call instead of sending SMS itself.
 * Fire-and-forget safe: never throws into the caller's transaction.
 */
export async function createNotification(companyId, {
    eventType, title = null, message, priority = 'NORMAL',
    entityType = null, entityId = null, idempotencyKey = null,
}) {
    try {
        await ensureNotificationTables();

        if (idempotencyKey) {
            const dup = await db.pgGet(
                `SELECT id FROM sms_notifications WHERE company_id = $1 AND idempotency_key = $2`,
                [companyId, idempotencyKey]
            );
            if (dup) return dup;
        }

        const prefs = await getPreferences(companyId);
        const categoryCol = CATEGORY_OF[eventType];
        const categoryEnabled = categoryCol ? prefs[categoryCol] !== false : true;
        if (!prefs.sms_enabled || !categoryEnabled) {
            // Still logged for history, just never queued for sending.
            return db.pgGet(
                `INSERT INTO sms_notifications (company_id, event_type, title, message, priority, related_entity_type, related_entity_id, idempotency_key, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CANCELLED') RETURNING *`,
                [companyId, eventType, title, message, priority, entityType, entityId, idempotencyKey]
            );
        }

        const notification = await db.pgGet(
            `INSERT INTO sms_notifications (company_id, event_type, title, message, priority, related_entity_type, related_entity_id, idempotency_key, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'QUEUED') RETURNING *`,
            [companyId, eventType, title, message, priority, entityType, entityId, idempotencyKey]
        );

        const recipients = await db.pgAll(
            `SELECT phone_number FROM sms_notification_recipients WHERE company_id = $1 AND is_active = true`,
            [companyId]
        );

        for (const r of recipients) {
            await db.pgRun(
                `INSERT INTO sms_messages (notification_id, recipient, message, status, next_retry_at)
                 VALUES ($1, $2, $3, 'PENDING', NOW())`,
                [notification.id, r.phone_number, message]
            );
        }

        // High priority: attempt immediate hand-off instead of waiting for the sweep.
        if (priority === 'HIGH') processQueueSweep(companyId).catch(() => {});

        return notification;
    } catch (e) {
        console.log('[notificationService] createNotification skipped:', e.message);
        return null;
    }
}

async function sendOne(msg) {
    try {
        await db.pgRun(`UPDATE sms_messages SET status = 'SENDING' WHERE id = $1`, [msg.id]);
        await triggerN8N('notify-sms', { recipients: [msg.recipient], message: msg.message });
        await db.pgRun(`UPDATE sms_messages SET status = 'SENT', sent_at = NOW() WHERE id = $1`, [msg.id]);
    } catch (e) {
        const nextRetryCount = msg.retry_count + 1;
        if (nextRetryCount > MAX_RETRIES) {
            await db.pgRun(
                `UPDATE sms_messages SET status = 'FAILED', failed_at = NOW(), error_message = $1, retry_count = $2 WHERE id = $3`,
                [e.message, nextRetryCount, msg.id]
            );
        } else {
            const waitMinutes = RETRY_BACKOFF_MINUTES[nextRetryCount - 1];
            await db.pgRun(
                `UPDATE sms_messages SET status = 'PENDING', retry_count = $1, next_retry_at = NOW() + ($2 || ' minutes')::interval, error_message = $3 WHERE id = $4`,
                [nextRetryCount, waitMinutes, e.message, msg.id]
            );
        }
    }
}

/** Picks up every due PENDING message (any company) and attempts to send it. */
export async function processQueueSweep() {
    await ensureNotificationTables();
    const due = await db.pgAll(
        `SELECT * FROM sms_messages WHERE status = 'PENDING' AND next_retry_at <= NOW() ORDER BY id ASC LIMIT 50`
    );
    for (const msg of due) {
        await sendOne(msg);
    }
}

let sweepStarted = false;
export function startQueueWorker() {
    if (sweepStarted) return;
    sweepStarted = true;
    setInterval(() => { processQueueSweep().catch(() => {}); }, 30_000);
}

export async function getNotificationHistory(companyId, { status, eventType, limit = 100 } = {}) {
    await ensureNotificationTables();
    const conditions = ['n.company_id = $1'];
    const params = [companyId];
    if (status) { params.push(status); conditions.push(`n.status = $${params.length}`); }
    if (eventType) { params.push(eventType); conditions.push(`n.event_type = $${params.length}`); }
    params.push(limit);
    return db.pgAll(
        `SELECT n.*,
            (SELECT COUNT(*) FROM sms_messages m WHERE m.notification_id = n.id) AS recipient_count,
            (SELECT COUNT(*) FROM sms_messages m WHERE m.notification_id = n.id AND m.status = 'SENT') AS sent_count,
            (SELECT COUNT(*) FROM sms_messages m WHERE m.notification_id = n.id AND m.status = 'FAILED') AS failed_count
         FROM sms_notifications n
         WHERE ${conditions.join(' AND ')}
         ORDER BY n.created_at DESC
         LIMIT $${params.length}`,
        params
    );
}
