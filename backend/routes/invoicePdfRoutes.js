// backend/routes/invoicePdfRoutes.js
// GST Invoice PDF Generator — JBS KNIT WEAR style

import express from "express";
import puppeteer from "puppeteer";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Generate GST Invoice PDF
 * GET /api/invoice/:id/pdf
 */
router.get("/:id/pdf", authMiddleware, async (req, res) => {
    const invoiceId = Number(req.params.id);
    const companyId = parseInt(req.user.active_company_id);

    try {
        // 1. Fetch Invoice + Company + Customer
        const invoice = await db.pgGet(`
            SELECT i.*,
                   u.username as customer_name,
                   u.company  as customer_company,
                   u.address_line1 as customer_address,
                   u.city_pincode  as customer_city,
                   u.state         as customer_state,
                   u.gstin         as customer_gstin,
                   u.state_code    as customer_state_code,
                   u.phone         as customer_phone,
                   c.company_name,
                   c.address_line1 as company_address,
                   c.city_pincode  as company_city,
                   c.state         as company_state,
                   c.state_code    as company_state_code,
                   c.gstin         as company_gstin,
                   c.phone         as company_phone,
                   c.email         as company_email,
                   c.bank_name, c.bank_account_no, c.bank_ifsc_code
            FROM invoices i
            LEFT JOIN users u    ON i.customer_id = u.id
            LEFT JOIN companies c ON i.company_id  = c.id
            WHERE i.id = $1 AND i.company_id = $2
        `, [invoiceId, companyId]);

        if (!invoice) return res.status(404).json({ error: "Invoice not found" });

        // 2. Fetch bill format settings (overrides company defaults)
        const fmt = await db.pgGet(
            `SELECT * FROM bill_format_settings WHERE company_id = $1`, [companyId]
        );

        // 3. Fetch line items
        const items = await db.pgAll(
            `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id`, [invoiceId]
        );

        // 4. Build GST totals
        let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
        const isSameState = (invoice.company_state_code || '33') === (invoice.customer_state_code || '33');

        items.forEach(item => {
            const taxable = Number(item.taxable_value) || (Number(item.quantity) * Number(item.unit_price));
            const gstRate = Number(item.gst_rate) || 0;
            const gstAmt  = (taxable * gstRate) / 100;
            subtotal += taxable;
            if (isSameState) { cgst += gstAmt / 2; sgst += gstAmt / 2; }
            else              { igst += gstAmt; }
        });

        const grandTotal = subtotal + cgst + sgst + igst;

        // 5. Merge settings: fmt overrides company
        const co = {
            name:        fmt?.business_name  || invoice.company_name    || '',
            address:     fmt?.address        || invoice.company_address  || '',
            city:        invoice.company_city || '',
            state:       fmt?.state          || invoice.company_state    || '',
            state_code:  fmt?.state_code     || invoice.company_state_code || '33',
            gstin:       fmt?.gstin          || invoice.company_gstin    || '',
            phone:       fmt?.phone          || invoice.company_phone    || '',
            bank_name:   fmt?.bank_name      || invoice.bank_name        || '',
            bank_ac:     fmt?.bank_account_no|| invoice.bank_account_no  || '',
            bank_ifsc:   fmt?.bank_ifsc_code || invoice.bank_ifsc_code   || '',
            bill_title:  fmt?.bill_title     || 'INVOICE',
        };

        const html = generateInvoiceHTML(invoice, items, { subtotal, cgst, sgst, igst, grandTotal }, co, isSameState);

        // 6. Generate PDF via Puppeteer
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Invoice_${invoice.invoice_number}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(pdfBuffer);

    } catch (err) {
        console.error("PDF Generation Error:", err);
        res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// HTML TEMPLATE — matches JBS KNIT WEAR invoice format exactly
// ─────────────────────────────────────────────────────────────
function generateInvoiceHTML(invoice, items, totals, co, isSameState) {
    const n  = (v) => Number(v) || 0;
    const f  = (v) => n(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fi = (v) => Math.round(n(v)).toLocaleString('en-IN');

    const fmtDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
    };

    // Amount in words
    const toWords = (num) => {
        const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                   'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                   'Seventeen','Eighteen','Nineteen'];
        const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
        const crore = Math.floor(num / 10000000); num %= 10000000;
        const lakh  = Math.floor(num / 100000);   num %= 100000;
        const thou  = Math.floor(num / 1000);     num %= 1000;
        const hund  = Math.floor(num / 100);      num %= 100;
        let str = '';
        if (crore) str += (a[crore] || b[Math.floor(crore/10)]+' '+a[crore%10]) + ' Crore ';
        if (lakh)  str += (a[lakh]  || b[Math.floor(lakh/10)] +' '+a[lakh%10])  + ' Lakh ';
        if (thou)  str += (a[thou]  || b[Math.floor(thou/10)] +' '+a[thou%10])  + ' Thousand ';
        if (hund)  str += a[hund] + ' Hundred ';
        if (num)   str += (str ? 'and ' : '') + (a[num] || b[Math.floor(num/10)]+' '+a[num%10]);
        return (str.trim() || 'Zero') + ' Rupees Only';
    };

    // Calculate per-item GST
    const itemRows = [];
    let totalQty = 0, totalAmt = 0, totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalRow = 0;

    items.forEach((item, idx) => {
        const qty     = n(item.quantity);
        const rate    = n(item.unit_price);
        const amount  = qty * rate;
        const disc    = n(item.discount_amount) || 0;
        const taxable = n(item.taxable_value) || (amount - disc);
        const gstRate = n(item.gst_rate) || 0;
        const gstAmt  = (taxable * gstRate) / 100;
        const rowCGST = isSameState ? gstAmt / 2 : 0;
        const rowSGST = isSameState ? gstAmt / 2 : 0;
        const rowIGST = !isSameState ? gstAmt : 0;
        const total   = taxable + gstAmt;
        const cgstRate = isSameState ? gstRate / 2 : 0;

        totalQty     += qty;
        totalAmt     += amount;
        totalTaxable += taxable;
        totalCGST    += rowCGST;
        totalSGST    += rowSGST;
        totalIGST    += rowIGST;
        totalRow     += total;

        itemRows.push(`
        <tr>
            <td style="border:1px solid #000;text-align:center;padding:2px 1px;font-size:9px;">${idx+1}</td>
            <td style="border:1px solid #000;padding:2px 3px;font-size:9px;text-align:center;font-weight:600;">${(item.description||'').toUpperCase()}</td>
            <td style="border:1px solid #000;text-align:center;padding:2px 1px;font-size:9px;">${item.hsn_acs_code||''}</td>
            <td style="border:1px solid #000;text-align:center;padding:2px 1px;font-size:9px;">${item.uom||'Pcs'}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(qty)}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(rate)}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(amount)}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${disc ? fi(disc) : ''}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(taxable)}</td>
            <td style="border:1px solid #000;text-align:center;padding:2px 1px;font-size:9px;">${cgstRate||''}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${rowCGST ? fi(rowCGST) : '0'}</td>
            <td style="border:1px solid #000;text-align:center;padding:2px 1px;font-size:9px;">${cgstRate||''}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${rowSGST ? fi(rowSGST) : '0'}</td>
            <td style="border:1px solid #000;text-align:center;padding:2px 1px;font-size:9px;"></td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${rowIGST ? fi(rowIGST) : '0'}</td>
            <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;font-weight:600;">${fi(total)}</td>
        </tr>`);
    });

    // Fill empty rows up to 15
    for (let i = items.length; i < 15; i++) {
        itemRows.push(`
        <tr style="height:18px;">
            <td style="border:1px solid #000;font-size:9px;text-align:center;">${i+1}</td>
            <td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;text-align:center;font-size:9px;">Pcs</td>
            <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;text-align:right;font-size:9px;">0</td>
            <td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;text-align:right;font-size:9px;">0</td>
            <td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;text-align:right;font-size:9px;">0</td>
            <td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;text-align:right;font-size:9px;">0</td>
            <td style="border:1px solid #000;text-align:right;font-size:9px;">0</td>
        </tr>`);
    }

    const gstRate = items.length > 0 ? (n(items[0].gst_rate) / 2) : 0;
    const amtWords = toWords(Math.round(totals.grandTotal));
    const custAddr  = [invoice.customer_address, invoice.customer_city].filter(Boolean).join(', ');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; background: white; }
  .page { border: 2px solid #000; padding: 0; width: 100%; }
  .hdr { text-align: center; padding: 6px 4px 4px; border-bottom: 1px solid #000; }
  .hdr h1 { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
  .hdr .sub { font-size: 10px; margin-top: 2px; }
  .hdr .gstin { font-size: 10px; font-weight: 700; margin-top: 2px; }
  .inv-title { text-align: center; font-size: 16px; font-weight: 900; padding: 4px; border-bottom: 1px solid #000; position: relative; }
  .triplicate { position: absolute; right: 6px; top: 2px; font-size: 8px; text-align: right; line-height: 1.5; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
  .meta-left, .meta-right { padding: 4px 6px; }
  .meta-right { border-left: 1px solid #000; }
  .meta-row { display: flex; gap: 6px; padding: 1px 0; font-size: 9.5px; }
  .meta-label { font-weight: 700; min-width: 100px; }
  .party-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
  .party-left, .party-right { padding: 4px 6px; font-size: 9.5px; }
  .party-right { border-left: 1px solid #000; }
  .party-title { font-weight: 700; text-decoration: underline; font-size: 9px; margin-bottom: 3px; }
  .party-name { font-weight: 700; font-size: 10px; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { border: 1px solid #000; padding: 2px 2px; font-size: 8.5px; text-align: center; font-weight: 700; background: #fff; }
  table.items td { border: 1px solid #000; font-size: 9px; }
  .footer-grid { display: grid; grid-template-columns: 1.3fr 0.7fr; border-top: 1px solid #000; }
  .footer-left { padding: 6px; border-right: 1px solid #000; font-size: 9.5px; }
  .footer-right { padding: 6px; font-size: 9.5px; }
  .tax-row { display: flex; justify-content: space-between; padding: 1.5px 0; }
  .tax-total { font-weight: 900; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
  .sig-area { border-top: 1px solid #000; padding: 4px 6px; display: grid; grid-template-columns: 1fr 1fr; font-size: 9.5px; }
  .amount-words { font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 6px 0; line-height: 1.4; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <h1>${co.name.toUpperCase()}</h1>
    <div class="sub">${co.address}${co.city ? ', ' + co.city : ''}${co.state ? ' - ' + co.state : ''}</div>
    ${co.gstin ? `<div class="gstin">GSTIN No. : ${co.gstin}</div>` : ''}
  </div>

  <!-- INVOICE TITLE -->
  <div class="inv-title">
    INVOICE
    <div class="triplicate">
      <span style="color:red;">Original for Recipient</span><br>
      <span style="color:#1a56db;">Duplicate for Supplier / Transporter</span><br>
      <span style="color:green;">Triplicate for Supplier</span>
    </div>
  </div>

  <!-- META INFO -->
  <div class="meta-grid">
    <div class="meta-left">
      <div class="meta-row"><span class="meta-label">Reverse Charge</span><span>:</span><span>${invoice.reverse_charge||''}</span></div>
      <div class="meta-row"><span class="meta-label">Invoice No</span><span>:</span><span>${invoice.invoice_number||''}</span></div>
      <div class="meta-row"><span class="meta-label">Invoice Date</span><span>:</span><span>${fmtDate(invoice.invoice_date)}</span></div>
      <div class="meta-row"><span class="meta-label">State</span><span>:</span><span>${co.state||''}&nbsp;&nbsp;&nbsp;<b>State Code:</b>&nbsp;${co.state_code||''}</span></div>
    </div>
    <div class="meta-right">
      <div class="meta-row"><span class="meta-label">Transportation Mode</span><span>:</span><span>${invoice.transportation_mode||''}</span></div>
      <div class="meta-row"><span class="meta-label">Vehicle Number</span><span>:</span><span>${invoice.vehicle_number||''}</span></div>
      <div class="meta-row"><span class="meta-label">Date of Supply</span><span>:</span><span>${fmtDate(invoice.date_of_supply)}</span></div>
      <div class="meta-row"><span class="meta-label">Place of Supply</span><span>:</span><span>${invoice.customer_state||''}&nbsp;&nbsp;&nbsp;<b>State Code:</b>&nbsp;${invoice.customer_state_code||''}</span></div>
    </div>
  </div>

  <!-- PARTY DETAILS -->
  <div class="party-grid">
    <div class="party-left">
      <div class="party-title">Details of Receiver Billed To :</div>
      <div class="meta-row"><b style="min-width:55px;">Name</b><span>:</span><span class="party-name">&nbsp;${(invoice.customer_name||'').toUpperCase()}</span></div>
      <div class="meta-row"><b style="min-width:55px;">Address</b><span>:</span><span>&nbsp;${custAddr}</span></div>
      <div class="meta-row"><b style="min-width:55px;">GSTIN</b><span>:</span><span>&nbsp;<b>${invoice.customer_gstin||''}</b></span></div>
      <div class="meta-row"><b style="min-width:55px;">State</b><span>:</span><span>&nbsp;${invoice.customer_state||''}&nbsp;&nbsp;<b>State Code:</b>&nbsp;${invoice.customer_state_code||''}</span></div>
    </div>
    <div class="party-right">
      <div class="party-title">Details of Consignee :</div>
      <div class="meta-row"><b style="min-width:55px;">Name</b><span>:</span><span class="party-name">&nbsp;${co.name.toUpperCase()}</span></div>
      <div class="meta-row"><b style="min-width:55px;">Address</b><span>:</span><span>&nbsp;${co.address}</span></div>
      <div class="meta-row"><b style="min-width:55px;"></b><span></span><span>&nbsp;${co.city ? 'Pin-' + co.city : ''}</span></div>
      <div class="meta-row"><b style="min-width:55px;"></b><span></span><span>&nbsp;${co.phone ? 'PH-' + co.phone : ''}</span></div>
      <div class="meta-row"><b style="min-width:55px;">GSTIN</b><span>:</span><span>&nbsp;<b>${co.gstin}</b></span></div>
      <div class="meta-row"><b style="min-width:55px;">State</b><span>:</span><span>&nbsp;${co.state||''}&nbsp;&nbsp;<b>State Code:</b>&nbsp;${co.state_code||''}</span></div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items">
    <thead>
      <tr>
        <th rowspan="2" style="width:22px;">Sr.<br>No</th>
        <th rowspan="2" style="width:120px;">Name of Product / Service</th>
        <th rowspan="2" style="width:36px;">HSN<br>ACS</th>
        <th rowspan="2" style="width:24px;">Uom</th>
        <th rowspan="2" style="width:36px;">Qty</th>
        <th rowspan="2" style="width:40px;">Rate</th>
        <th rowspan="2" style="width:50px;">Amount</th>
        <th rowspan="2" style="width:40px;">Less:<br>Discount</th>
        <th rowspan="2" style="width:50px;">Taxable<br>Value</th>
        <th colspan="2" style="width:62px;">CGST</th>
        <th colspan="2" style="width:62px;">SGST</th>
        <th colspan="2" style="width:62px;">IGST</th>
        <th rowspan="2" style="width:52px;">Total</th>
      </tr>
      <tr>
        <th style="width:28px;">Rate</th><th style="width:34px;">Amount</th>
        <th style="width:28px;">Rate</th><th style="width:34px;">Amount</th>
        <th style="width:28px;">Rate</th><th style="width:34px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows.join('')}
    </tbody>
    <tfoot>
      <tr style="font-weight:900;background:#f9f9f9;">
        <td colspan="4" style="border:1px solid #000;text-align:center;padding:3px;font-size:9px;">Total</td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(totalQty)}</td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(totalAmt)}</td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(totalTaxable)}</td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(totalCGST)}</td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(totalSGST)}</td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;">${fi(totalIGST)}</td>
        <td style="border:1px solid #000;text-align:right;padding:2px 3px;font-size:9px;font-weight:900;">${fi(totalRow)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- FOOTER: words + bank + tax summary -->
  <div class="footer-grid">
    <div class="footer-left">
      <div style="font-size:9px;font-weight:700;margin-bottom:2px;">Total Invoice Amount in words</div>
      <div class="amount-words">${amtWords.toUpperCase()}</div>
      <div style="margin-top:8px;"><b>Bundles :</b>&nbsp;&nbsp;${invoice.bundles_count||''}</div>
      <div style="margin-top:8px;">
        <b style="text-decoration:underline;">Bank Details :</b><br>
        <div style="margin-top:3px;">
          ${co.bank_name  ? `<div>* <b>BANK NAME</b> : ${co.bank_name}</div>`  : ''}
          ${co.bank_ac    ? `<div>* <b>A/C NO</b>    : ${co.bank_ac}</div>`    : ''}
          ${co.bank_ifsc  ? `<div>* <b>IFSC NO</b>   : ${co.bank_ifsc}</div>`  : ''}
        </div>
      </div>
    </div>
    <div class="footer-right">
      <div class="tax-row"><span>Total Amount Before Tax</span><span>:&nbsp;<b>${fi(totals.subtotal)}</b></span></div>
      <div class="tax-row"><span>Add: CGST &nbsp;${gstRate}%</span><span>:&nbsp;<b>${fi(totals.cgst)}</b></span></div>
      <div class="tax-row"><span>Add: SGST &nbsp;${gstRate}%</span><span>:&nbsp;<b>${fi(totals.sgst)}</b></span></div>
      <div class="tax-row"><span>Add: IGST</span><span>:&nbsp;<b>${totals.igst ? fi(totals.igst) : ''}</b></span></div>
      <div class="tax-row"><span>Tax Amount: <b>GST</b></span><span>:&nbsp;<b>${fi(totals.cgst+totals.sgst+totals.igst)}</b></span></div>
      <div class="tax-row tax-total"><span>Total Amount After Tax</span><span>:&nbsp;${fi(totals.grandTotal)}</span></div>
      <div style="margin-top:6px;font-size:8.5px;"><b>GST Payable on Reverse Charge :</b>&nbsp;${invoice.reverse_charge||''}</div>
      <div style="margin-top:6px;font-size:8.5px;">Certified that the particulars given above are true &amp; correct.</div>
      <div style="margin-top:4px;font-size:9.5px;font-weight:700;text-align:right;">For, ${co.name.toUpperCase()}</div>
    </div>
  </div>

  <!-- SIGNATURE -->
  <div class="sig-area">
    <div style="text-align:center;padding-top:30px;">(Common Seal)</div>
    <div style="text-align:right;padding-top:30px;">
      <div style="font-weight:700;">Authorised Signatory</div>
      <div style="font-size:8.5px;margin-top:6px;">[E &amp; OE]</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

export default router;
