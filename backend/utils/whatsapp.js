/**
 * whatsapp.js
 * Send WhatsApp messages via Fonnte API.
 * Always silent-fail so a WA error never breaks a transaction.
 */

const FONNTE_TOKEN = '6722Sz6ELeN3HhiGbrst';
const OWNER_PHONE  = '918148232205'; // JBS Knit Wear owner

export const sendWhatsApp = async (phone, message) => {
    try {
        const raw    = String(phone).replace(/[^0-9]/g, '');
        const target = raw.startsWith('91') ? raw : '91' + raw;

        const response = await fetch('https://api.fonnte.com/send', {
            method:  'POST',
            headers: {
                'Authorization': FONNTE_TOKEN,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ target, countryCode: '91', message }),
        });

        const data = await response.json();
        console.log(`[WhatsApp] → ${target} | status: ${data.status ?? 'unknown'}`);
    } catch (e) {
        console.log('[WhatsApp] failed silently:', e.message);
    }
};

/** Shortcut — always sends to owner's number */
export const notifyOwner = (message) => sendWhatsApp(OWNER_PHONE, message);

/**
 * Send a PDF (or any file) via Fonnte.
 * Accepts either a Buffer (sent as base64) or a public URL string.
 * Base64 is preferred — it avoids Railway filesystem/URL issues.
 *
 * @param {string}        phone     Recipient phone (digits, without country code)
 * @param {Buffer|string} fileOrUrl PDF Buffer  OR  public URL string
 * @param {string}        filename  e.g. "Invoice_5.pdf"
 * @param {string}        [caption] Optional caption message
 */
export const sendWhatsAppFile = async (phone, fileOrUrl, filename, caption = '') => {
    try {
        const raw    = String(phone).replace(/[^0-9]/g, '');
        const target = raw.startsWith('91') ? raw : '91' + raw;

        let body;
        if (Buffer.isBuffer(fileOrUrl)) {
            // Send as base64 — no public URL required
            const b64 = fileOrUrl.toString('base64');
            body = {
                target,
                countryCode: '91',
                file:        `data:application/pdf;base64,${b64}`,
                filename,
                message:     caption,
            };
        } else {
            // Fall back to URL mode
            body = {
                target,
                countryCode: '91',
                url:         fileOrUrl,
                filename,
                message:     caption,
            };
        }

        const response = await fetch('https://api.fonnte.com/send', {
            method:  'POST',
            headers: {
                'Authorization': FONNTE_TOKEN,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        console.log(`[WhatsApp/file] → ${target} | ${filename} | status: ${data.status ?? 'unknown'} | detail: ${JSON.stringify(data)}`);
    } catch (e) {
        console.log('[WhatsApp/file] failed silently:', e.message);
    }
};
