// tsxToPdf.js
// Run this script from the workspace root to generate a single PDF containing
// the contents of all .tsx files under frontend/src.
// Requires puppeteer and glob packages:
//    npm install puppeteer glob
// then execute `node tsxToPdf.js`.

const fs = require('fs');
const path = require('path');
// glob doesn't export a default when used with ESM, use require
const glob = require('glob');
const puppeteer = require('puppeteer');

async function buildHtml() {
    const pattern = path.join(__dirname, 'frontend/src/**/*.tsx');
    const files = glob.sync(pattern, { nodir: true });
    let html = '<!doctype html><html><head><meta charset="utf-8"><title>TSX Sources</title>' +
        '<style>body{font-family:monospace;white-space:pre;word-break:break-word} h1{page-break-before:always;margin-top:40px;}</style>' +
        '</head><body>';

    for (const file of files) {
        const rel = path.relative(__dirname, file);
        const content = fs.readFileSync(file, 'utf8');
        html += `<h1>${rel}</h1><pre>${escapeHtml(content)}</pre>`;
    }

    html += '</body></html>';
    return html;
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

(async () => {
    try {
        const html = await buildHtml();
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        // setContent without heavy network expectations (all content is inline)
        await page.setContent(html, { waitUntil: 'load' });
        const pdfPath = path.join(__dirname, 'all-tsx-files.pdf');
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();
        console.log('PDF generated at', pdfPath);
    } catch (err) {
        console.error('Failed to generate PDF:', err);
        process.exit(1);
    }
})();