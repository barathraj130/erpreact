// backend/utils/triggerN8N.js
// Fire-and-forget n8n webhook trigger.
// Never throws — a dead/unreachable n8n instance must not break ERP operations.

const N8N_BASE = process.env.N8N_WEBHOOK_BASE || 'https://festally-unretted-hipolito.ngrok-free.dev/webhook';

export const triggerN8N = async (path, data) => {
    try {
        await fetch(`${N8N_BASE}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(5000), // 5 s max — don't stall ERP
        });
    } catch (err) {
        // Log but never propagate — n8n is optional infrastructure
        console.warn(`[n8n] webhook "${path}" failed: ${err.message}`);
    }
};
