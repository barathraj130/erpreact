// backend/utils/triggerN8N.js
// Fire-and-forget n8n webhook trigger.
// Never throws — a dead/unreachable n8n instance must not break ERP operations.

const N8N_BASE = process.env.N8N_WEBHOOK_BASE || 'https://festally-unretted-hipolito.ngrok-free.dev';

export const triggerN8N = async (path, data) => {
    try {
        await fetch(`${N8N_BASE}/webhook/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(5000), // 5 s max — never stalls ERP
        });
    } catch (e) {
        console.log('N8N trigger failed silently:', e.message);
    }
};
