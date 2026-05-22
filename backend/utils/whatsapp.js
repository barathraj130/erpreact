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
 * Send a file (PDF, image, etc.) via Fonnte.
 * @param {string} phone   Recipient phone (digits only, without country code)
 * @param {string} fileUrl Publicly accessible URL to the file
 * @param {string} filename  e.g. "Invoice_5.pdf"
 * @param {string} [caption]  Optional caption message
 */
export const sendWhatsAppFile = async (phone, fileUrl, filename, caption = '') => {
    try {
        const raw    = String(phone).replace(/[^0-9]/g, '');
        const target = raw.startsWith('91') ? raw : '91' + raw;

        const response = await fetch('https://api.fonnte.com/send', {
            method:  'POST',
            headers: {
                'Authorization': FONNTE_TOKEN,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({
                target,
                countryCode: '91',
                url:         fileUrl,
                filename:    filename,
                message:     caption,
            }),
        });

        const data = await response.json();
        console.log(`[WhatsApp/file] → ${target} | ${filename} | status: ${data.status ?? 'unknown'}`);
    } catch (e) {
        console.log('[WhatsApp/file] failed silently:', e.message);
    }
};
