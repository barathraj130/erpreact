// backend/utils/generateLedgerPDF.js
// Generates a ledger statement PDF using Puppeteer (same approach as invoicePdf.js).

import { generateInvoicePdf } from './invoicePdf.js'; // reuse the shared browser instance

// Re-export the browser getter pattern
import puppeteer from 'puppeteer';

let _browser = null;
async function getBrowser() {
    if (_browser && _browser.connected) return _browser;
    _browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--no-zygote',
            '--single-process',
        ],
    });
    return _browser;
}

const fmtINR = (n) => {
    const num = parseFloat(n) || 0;
    return '₹' + Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function buildLedgerHtml({ partyName, partyType, entries, summary, phone = '' }) {
    const now   = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // ── Summary boxes ────────────────────────────────────────────────────────
    const summaryEntries = Object.entries(summary || {});
    const boxWidth = summaryEntries.length > 0 ? Math.floor(100 / summaryEntries.length) - 1 : 100;
    const summaryBoxesHtml = summaryEntries.map(([key, val]) => `
        <div style="display:inline-block;width:${boxWidth}%;border:1px solid #dde3f0;border-radius:6px;padding:8px 10px;margin-right:1%;background:#f8faff;vertical-align:top">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${key.replace(/_/g,' ')}</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${fmtINR(val)}</div>
        </div>`).join('');

    // ── Compute running balance for table ────────────────────────────────────
    let running = 0;
    const rowsHtml = entries.map((e, i) => {
        const debit  = parseFloat(e.debit  || e.dr || 0);
        const credit = parseFloat(e.credit || e.cr || 0);
        running += debit - credit;
        const bg = i % 2 === 0 ? '#ffffff' : '#f8faff';
        return `
        <tr style="background:${bg};font-size:10px">
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">${e.entry_date || e.date ? new Date(e.entry_date || e.date).toLocaleDateString('en-IN') : '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">${e.tx_desc || e.description || '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:center">${e.reference_type || e.type || '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;color:${debit > 0 ? '#dc2626' : '#9ca3af'}">${debit > 0 ? fmtINR(debit) : '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;color:${credit > 0 ? '#16a34a' : '#9ca3af'}">${credit > 0 ? fmtINR(credit) : '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:${running >= 0 ? '#1e293b' : '#16a34a'}">${fmtINR(Math.abs(running))}${running < 0 ? ' Cr' : ' Dr'}</td>
        </tr>`;
    }).join('');

    const totalDebit  = entries.reduce((s, e) => s + parseFloat(e.debit  || e.dr || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit || e.cr || 0), 0);
    const closingBal  = parseFloat(entries[entries.length - 1]?.running_balance ?? running);

    const emptyRowHtml = entries.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;font-size:12px">No transactions found</td></tr>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${partyType} Ledger — ${partyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4; margin: 10mm 12mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; background: white; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>

<!-- ── HEADER ── -->
<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:16px 20px;border-radius:8px 8px 0 0;margin-bottom:0">
  <div style="text-align:center">
    <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px">JBS KNIT WEAR</div>
    <div style="font-size:10px;color:#bfdbfe;margin-top:3px">3/2B Nesavalar Colony, 2nd Street, P.N.Road, Tiruppur - 641602, Tamil Nadu</div>
    <div style="font-size:10px;color:#bfdbfe">GSTIN: 33CKAPJ7513F1ZK &nbsp;|&nbsp; Ph: 8148232205</div>
  </div>
</div>

<!-- ── TITLE BAND ── -->
<div style="background:#f1f5f9;padding:8px 20px;border-left:4px solid #2563eb;margin-bottom:14px">
  <div style="font-size:14px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:1px">${partyType} Ledger Statement</div>
  <div style="display:flex;justify-content:space-between;margin-top:4px">
    <div style="font-size:11px;color:#475569"><b>Name:</b> ${partyName}${phone ? `&nbsp;&nbsp;<b>Phone:</b> ${phone}` : ''}</div>
    <div style="font-size:10px;color:#94a3b8">Generated: ${dateStr} at ${timeStr}</div>
  </div>
</div>

<!-- ── SUMMARY BOXES ── -->
${summaryEntries.length > 0 ? `
<div style="padding:0 0 14px 0">
  ${summaryBoxesHtml}
</div>` : ''}

<!-- ── TABLE ── -->
<table>
  <thead>
    <tr style="background:#2563eb">
      <th style="padding:7px 8px;text-align:left;color:#fff;font-size:10px;font-weight:700;width:80px">Date</th>
      <th style="padding:7px 8px;text-align:left;color:#fff;font-size:10px;font-weight:700">Particulars</th>
      <th style="padding:7px 8px;text-align:center;color:#fff;font-size:10px;font-weight:700;width:80px">Type</th>
      <th style="padding:7px 8px;text-align:right;color:#fff;font-size:10px;font-weight:700;width:85px">Debit (Dr)</th>
      <th style="padding:7px 8px;text-align:right;color:#fff;font-size:10px;font-weight:700;width:85px">Credit (Cr)</th>
      <th style="padding:7px 8px;text-align:right;color:#fff;font-size:10px;font-weight:700;width:90px">Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#eff6ff;font-size:10px;font-weight:700">
      <td style="padding:5px 8px;border-bottom:1px solid #dbeafe">—</td>
      <td style="padding:5px 8px;border-bottom:1px solid #dbeafe;color:#2563eb">Opening Balance</td>
      <td style="padding:5px 8px;border-bottom:1px solid #dbeafe;text-align:center">B/F</td>
      <td style="padding:5px 8px;border-bottom:1px solid #dbeafe;text-align:right">—</td>
      <td style="padding:5px 8px;border-bottom:1px solid #dbeafe;text-align:right">—</td>
      <td style="padding:5px 8px;border-bottom:1px solid #dbeafe;text-align:right">${fmtINR(summary?.opening_balance || 0)}</td>
    </tr>
    ${rowsHtml}
    ${emptyRowHtml}
  </tbody>
  <tfoot>
    <tr style="background:#1e3a5f;font-weight:700">
      <td colspan="2" style="padding:7px 8px;color:#fff;font-size:10px">TOTALS &amp; CLOSING BALANCE</td>
      <td style="padding:7px 8px;color:#fff;font-size:10px;text-align:center"></td>
      <td style="padding:7px 8px;color:#fca5a5;font-size:11px;text-align:right">${fmtINR(totalDebit)}</td>
      <td style="padding:7px 8px;color:#86efac;font-size:11px;text-align:right">${fmtINR(totalCredit)}</td>
      <td style="padding:7px 8px;color:#fde68a;font-size:12px;text-align:right;font-weight:700">${fmtINR(Math.abs(closingBal))}${closingBal < 0 ? ' Cr' : ' Dr'}</td>
    </tr>
  </tfoot>
</table>

<!-- ── FOOTER ── -->
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0">
  <div style="font-size:9px;color:#94a3b8;font-style:italic">
    This is a system generated statement — Fluxora ERP<br/>
    Printed on: ${now.toLocaleString('en-IN')}
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#475569">For JBS Knit Wear</div>
    <div style="margin-top:28px;border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#94a3b8">Authorised Signatory</div>
  </div>
</div>

</body>
</html>`;
}

/**
 * Generate a ledger PDF buffer.
 * @param {object} opts - { partyName, partyType, entries, summary, phone }
 * @returns {Buffer}
 */
export async function generateLedgerPdf(opts) {
    const html    = buildLedgerHtml(opts);
    const browser = await getBrowser();
    const page    = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '12mm', bottom: '10mm', left: '12mm' },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await page.close();
    }
}
