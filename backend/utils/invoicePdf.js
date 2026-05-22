// backend/utils/invoicePdf.js
// Generates a PDF buffer from invoice data using Puppeteer.
// Mirrors the exact same HTML as frontend/src/pages/InvoiceDetails.tsx → buildPrintHTML.

import puppeteer from 'puppeteer';

// ── helpers ───────────────────────────────────────────────────────────────────
const STATE_CODES = {
    "ANDHRA PRADESH":"28","ARUNACHAL PRADESH":"12","ASSAM":"18","BIHAR":"10",
    "CHHATTISGARH":"22","GOA":"30","GUJARAT":"24","HARYANA":"06",
    "HIMACHAL PRADESH":"02","JAMMU AND KASHMIR":"01","J&K":"01","JHARKHAND":"20",
    "KARNATAKA":"29","KERALA":"32","LADAKH":"38","MADHYA PRADESH":"23","MP":"23",
    "MAHARASHTRA":"27","MANIPUR":"14","MEGHALAYA":"17","MIZORAM":"15",
    "NAGALAND":"13","ODISHA":"21","PUNJAB":"03","RAJASTHAN":"08","SIKKIM":"11",
    "TAMIL NADU":"33","TN":"33","TAMILNADU":"33","TELANGANA":"36","TRIPURA":"16",
    "UTTAR PRADESH":"09","UP":"09","UTTARAKHAND":"05","WEST BENGAL":"19","WB":"19",
    "ANDAMAN AND NICOBAR":"35","CHANDIGARH":"04","DADRA AND NAGAR HAVELI":"26",
    "DAMAN AND DIU":"25","DELHI":"07","LAKSHADWEEP":"31","PUDUCHERRY":"34",
};

function resolveStateCode(stateName, existingCode) {
    if (existingCode) return String(existingCode);
    if (!stateName) return '';
    return STATE_CODES[String(stateName).toUpperCase().trim()] || '';
}

const val   = (n) => Number(n) || 0;
const fmt   = (n) => val(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => val(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function toWords(num) {
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ',
        'Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ',
        'Seventeen ','Eighteen ','Nineteen '];
    const b = ['','','Twenty ','Thirty ','Forty ','Fifty ','Sixty ','Seventy ','Eighty ','Ninety '];
    const s = ('000000000' + Math.floor(num)).substr(-9);
    const n = s.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return 'ZERO';
    const p = (x) => x < 20 ? a[x] : b[Math.floor(x / 10)] + a[x % 10];
    let str = '';
    if (+n[1]) str += p(+n[1]) + 'Crore ';
    if (+n[2]) str += p(+n[2]) + 'Lakh ';
    if (+n[3]) str += p(+n[3]) + 'Thousand ';
    if (+n[4]) str += p(+n[4]) + 'Hundred ';
    if (+n[5]) str += (str ? 'And ' : '') + p(+n[5]);
    return (str.trim() + ' Rupees Only').toUpperCase();
}

// ── compute rows + totals from raw invoice data ───────────────────────────────
function computeInvoiceRows(data) {
    const isNonTax = ['NON_TAX_INVOICE', 'NON-TAX'].includes(data.invoice_type);
    const companyStateCode   = resolveStateCode(data.c_state, data.company_state_code) || '33';
    const customerStateCode  = resolveStateCode(data.state || data.customer_state, data.customer_state_code || data.state_code) || '33';
    const isSameState = companyStateCode === customerStateCode;

    const items = Array.isArray(data.line_items || data.items) ? (data.line_items || data.items) : [];

    let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalQty = 0;

    const rows = items.map((item) => {
        const isReturn = item.is_return === true || item.is_return === 1 || Number(item.quantity || item.qty) < 0;
        const qty      = val(item.quantity || item.qty);
        const rate     = val(item.unit_price || item.rate);
        const taxable  = Math.abs(qty) * rate;

        const storedCgstRate = val(item.cgst_rate);
        const storedSgstRate = val(item.sgst_rate);
        const storedIgstRate = val(item.igst_rate);
        const storedLineRate = val(item.tax_percent || item.gst_rate || (storedCgstRate + storedSgstRate + storedIgstRate));
        const gstRate = isNonTax ? 0 : storedLineRate;
        const gstAmt  = (taxable * gstRate) / 100;

        const cgst = val(item.cgst_amount) || (isSameState && !isNonTax ? gstAmt / 2 : 0);
        const sgst = val(item.sgst_amount) || (isSameState && !isNonTax ? gstAmt / 2 : 0);
        const igst = val(item.igst_amount) || (!isSameState && !isNonTax ? gstAmt : 0);

        if (!isReturn) {
            totalTaxable += taxable; totalCGST += cgst; totalSGST += sgst; totalIGST += igst;
            totalQty += Math.abs(qty);
        }
        return {
            name: item.description || item.name || '',
            hsn:  item.hsn_acs_code || item.hsn || '',
            uom:  item.uom || 'Pcs',
            qty: Math.abs(qty), rate, taxable, gstRate, cgst, sgst, igst, isReturn,
            lineTotal: taxable + cgst + sgst + igst,
        };
    });

    const totalGST  = totalCGST + totalSGST + totalIGST;
    const grandTotal = totalTaxable + totalGST;

    return { rows, isNonTax, isSameState, totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, grandTotal, totalQty };
}

// ── HTML builder (mirrors frontend buildPrintHTML exactly) ────────────────────
export function buildInvoiceHtml(data) {
    const { rows, isNonTax, isSameState, totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, grandTotal, totalQty }
        = computeInvoiceRows(data);

    const cgstRate = totalTaxable > 0 ? ((totalCGST / totalTaxable) * 100).toFixed(2) : '0.00';
    const sgstRate = totalTaxable > 0 ? ((totalSGST / totalTaxable) * 100).toFixed(2) : '0.00';
    const igstRate = totalTaxable > 0 ? ((totalIGST / totalTaxable) * 100).toFixed(2) : '0.00';

    const invoiceTypeLabel =
        data.invoice_type === 'TAX_INVOICE'         ? 'TAX INVOICE' :
        data.invoice_type === 'NOMINAL_TAX_INVOICE' ? 'TAX INVOICE' :
        'INVOICE';

    const EMPTY_ROWS = 15;
    const emptyCount = Math.max(0, EMPTY_ROWS - rows.length);
    const colCount   = isNonTax ? 8 : 16;

    const itemRowsHTML = rows.map((r, i) => {
        const itemCGSTRate = (!isNonTax && isSameState)  ? r.gstRate / 2 : 0;
        const itemSGSTRate = (!isNonTax && isSameState)  ? r.gstRate / 2 : 0;
        const itemIGSTRate = (!isNonTax && !isSameState) ? r.gstRate : 0;
        if (isNonTax) {
            return `<tr style="font-size:10px">
          <td style="text-align:center;border:1px solid #000;padding:2px 3px">${i + 1}</td>
          <td style="text-align:left;border:1px solid #000;padding:2px 4px;font-weight:500">${r.name}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px">${r.hsn}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px">${r.uom}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.qty)}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.rate)}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.taxable)}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 4px;font-weight:600">${fmtInt(r.lineTotal)}</td>
        </tr>`;
        }
        return `<tr style="font-size:10px">
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${i + 1}</td>
        <td style="text-align:left;border:1px solid #000;padding:2px 4px;font-weight:500">${r.name}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${r.hsn}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${r.uom}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.qty)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.rate)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.taxable)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px"></td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.taxable)}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${itemCGSTRate || 0}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.cgst)}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${itemSGSTRate || 0}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.sgst)}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${itemIGSTRate || 0}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.igst)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px;font-weight:600">${fmtInt(r.lineTotal)}</td>
      </tr>`;
    }).join('');

    const emptyRowsHTML = Array(emptyCount).fill(
        `<tr style="height:18px">${Array(colCount).fill('<td style="border:1px solid #000;padding:2px 3px"></td>').join('')}</tr>`
    ).join('');

    const totalRowHTML = isNonTax
        ? `<tr style="font-weight:700;background:#f5f5f5;font-size:10px">
        <td colspan="4" style="border:1px solid #000;padding:3px 4px;text-align:center">Total</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalQty)}</td>
        <td style="border:1px solid #000;padding:3px 4px"></td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalTaxable)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-weight:700">${fmtInt(grandTotal)}</td>
      </tr>`
        : `<tr style="font-weight:700;background:#f5f5f5;font-size:10px">
        <td colspan="4" style="border:1px solid #000;padding:3px 4px;text-align:center">Total</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalQty)}</td>
        <td style="border:1px solid #000;padding:3px 4px"></td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalTaxable)}</td>
        <td style="border:1px solid #000;padding:3px 4px"></td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalTaxable)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">—</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalCGST)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">—</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalSGST)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">—</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalIGST)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-weight:700">${fmtInt(grandTotal)}</td>
      </tr>`;

    const theadHTML = isNonTax
        ? `<tr style="background:#f0f0f0">
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:28px;font-size:9px">Sr.<br>No</th>
        <th style="border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px">Name of Product / Service</th>
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">HSN ACS</th>
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:28px;font-size:9px">Uom</th>
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:50px;font-size:9px">Qty</th>
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:60px;font-size:9px">Rate</th>
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:70px;font-size:9px">Amount</th>
        <th style="border:1px solid #000;padding:3px 2px;text-align:center;width:80px;font-size:9px">Total</th>
      </tr>`
        : `<tr style="background:#f0f0f0">
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:28px;font-size:9px">Sr.<br>No</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px">Name of Product / Service</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">HSN ACS</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:28px;font-size:9px">Uom</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:40px;font-size:9px">Qty</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:42px;font-size:9px">Rate</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:50px;font-size:9px">Amount</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:46px;font-size:9px">Less:<br>Discount</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">Taxable<br>Value</th>
        <th colspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;font-size:9px">CGST</th>
        <th colspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;font-size:9px">SGST</th>
        <th colspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;font-size:9px">IGST</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">Total</th>
      </tr>
      <tr style="background:#f0f0f0">
        <th style="border:1px solid #000;padding:2px;text-align:center;width:34px;font-size:9px">Rate</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:48px;font-size:9px">Amount</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:34px;font-size:9px">Rate</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:48px;font-size:9px">Amount</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:34px;font-size:9px">Rate</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:48px;font-size:9px">Amount</th>
      </tr>`;

    const invoiceDate = data.invoice_date
        ? new Date(data.invoice_date).toLocaleDateString('en-GB') : '';
    const supplyDate  = data.date_of_supply
        ? new Date(data.date_of_supply).toLocaleDateString('en-GB') : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${data.invoice_number || ''}</title>
  <style>
    * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; box-sizing:border-box; margin:0; padding:0; }
    @page { size: A4; margin: 8mm 10mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: white; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
<div style="border:1.5px solid #000;width:100%;position:relative">

  <!-- HEADER -->
  <div style="padding:6px 10px;text-align:center;border-bottom:1px solid #000;position:relative">
    <div style="position:absolute;top:4px;right:4px;font-size:8px;line-height:1.5;text-align:right;border:1px solid #999;padding:3px 6px;background:white">
      <div style="color:#cc0000;font-weight:700">Original for Receipient</div>
      <div style="color:#0000cc;font-weight:700">Duplicate for Supplier / Transporter</div>
      <div style="color:#007700;font-weight:700">Triplicate for Supplier</div>
    </div>
    <div style="font-size:22px;font-weight:700;letter-spacing:0.5px">${data.company_name || 'JBS KNIT WEAR'}</div>
    <div style="font-size:10px;margin-top:2px">${data.c_address || ''}${data.c_city ? ', ' + data.c_city : ''}</div>
    <div style="font-size:10px">${data.c_state || 'TAMILNADU'}</div>
    <div style="font-size:10.5px;font-weight:700;margin-top:2px">GSTIN No. : ${data.c_gstin || ''}</div>
  </div>

  <!-- INVOICE TITLE -->
  <div style="padding:4px;text-align:center;border-bottom:1px solid #000">
    <span style="font-size:18px;font-weight:700;letter-spacing:2px">${invoiceTypeLabel}</span>
  </div>

  <!-- META INFO -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;font-size:10px">
    <div style="border-right:1px solid #000;padding:4px 8px">
      <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:2px"><span>Reverse Charge</span><span>: ${data.reverse_charge || ''}</span></div>
      <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:2px"><span><b>Invoice No</b></span><span>: <b>${data.invoice_number || ''}</b></span></div>
      <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:2px"><span>Invoice Date</span><span>: ${invoiceDate}</span></div>
      <div style="display:grid;grid-template-columns:110px 1fr"><span>State</span><span>: ${data.c_state || ''} &nbsp; <b>Code:</b> ${resolveStateCode(data.c_state, data.company_state_code) || '33'}</span></div>
    </div>
    <div style="padding:4px 8px">
      <div style="display:grid;grid-template-columns:130px 1fr;margin-bottom:2px"><span>Transportation Mode</span><span>: ${data.transportation_mode || data.transport_mode || ''}</span></div>
      <div style="display:grid;grid-template-columns:130px 1fr;margin-bottom:2px"><span>Vehicle Number</span><span>: ${data.vehicle_number || ''}</span></div>
      <div style="display:grid;grid-template-columns:130px 1fr;margin-bottom:2px"><span>Date of Supply</span><span>: ${supplyDate}</span></div>
      <div style="display:grid;grid-template-columns:130px 1fr"><span><b>Place of Supply</b></span><span>: ${data.state || data.customer_state || ''} &nbsp; <b>Code:</b> ${resolveStateCode(data.state || data.customer_state, data.customer_state_code || data.state_code) || '33'}</span></div>
    </div>
  </div>

  <!-- PARTY DETAILS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;font-size:10px">
    <div style="border-right:1px solid #000">
      <div style="background:#f0f0f0;border-bottom:1px solid #ccc;padding:2px 8px;font-weight:700;font-size:9px;text-align:center">Details of Receiver Billed To :</div>
      <div style="padding:4px 8px">
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Name</span><span>: <b>${data.customer_name || ''}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Address</span><span>: ${data.address_line1 || ''}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span></span><span>: ${data.city_pincode || ''}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>GSTIN</span><span>: <b>${data.customer_gstin || ''}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr"><span>State</span><span>: ${data.state || ''} &nbsp; <b>Code:</b> ${resolveStateCode(data.state, data.customer_state_code || data.state_code)}</span></div>
      </div>
    </div>
    <div>
      <div style="background:#f0f0f0;border-bottom:1px solid #ccc;padding:2px 8px;font-weight:700;font-size:9px;text-align:center">Details of Consignee</div>
      <div style="padding:4px 8px">
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Name</span><span>: <b>${data.company_name || ''}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Address</span><span>: ${data.c_address || ''}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span></span><span>${data.c_phone ? ': PH-' + data.c_phone : ''}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>GSTIN</span><span>: <b>${data.c_gstin || ''}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr"><span>State</span><span>: ${data.c_state || ''} &nbsp; <b>Code:</b> ${resolveStateCode(data.c_state, data.company_state_code) || '33'}</span></div>
      </div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;font-size:10px">
    <thead>${theadHTML}</thead>
    <tbody>
      ${itemRowsHTML}
      ${emptyRowsHTML}
      ${totalRowHTML}
    </tbody>
  </table>

  <!-- FOOTER -->
  <div style="display:grid;grid-template-columns:1.15fr 1fr;border-top:1px solid #000;font-size:10px">
    <div style="border-right:1px solid #000;padding:6px 8px;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:9px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:2px">Total Invoice Amount in words</div>
      <div style="font-size:12px;font-style:italic;font-weight:600;line-height:1.4;min-height:32px">${toWords(Math.round(grandTotal))}</div>
      <div style="margin-top:4px"><b>Bundles</b> : ${data.bundles_count || ''}</div>
      <div style="margin-top:8px;font-size:9px;font-weight:700;text-decoration:underline;letter-spacing:0.3px;">&#9654; Bank Details</div>
      <table style="border-collapse:collapse;font-size:9px;margin-top:3px;width:100%;">
        ${data.bank_name       ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;white-space:nowrap;">Bank Name</td><td style="padding:1px 4px;">:</td><td style="padding:1px 0;font-weight:700;">${data.bank_name}</td></tr>` : ''}
        ${data.bank_account_no ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;white-space:nowrap;">Account No</td><td style="padding:1px 4px;">:</td><td style="padding:1px 0;font-weight:700;">${data.bank_account_no}</td></tr>` : ''}
        ${data.bank_ifsc_code  ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;white-space:nowrap;">IFSC Code</td><td style="padding:1px 4px;">:</td><td style="padding:1px 0;font-weight:700;">${data.bank_ifsc_code}</td></tr>` : ''}
      </table>
      ${data.notes ? `<div style="margin-top:4px;font-size:9px;color:#444">${data.notes}</div>` : ''}
      <div style="margin-top:auto;padding-top:20px;text-align:center;font-size:9px;color:#666">(Common Seal)</div>
    </div>

    <div style="padding:6px 10px;display:flex;flex-direction:column">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <tr><td style="padding:2px 4px">Total Amount Before Tax</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalTaxable)}</td></tr>
        ${!isNonTax && isSameState ? `
        <tr><td style="padding:2px 4px">Add: CGST ${cgstRate}%</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalCGST)}</td></tr>
        <tr><td style="padding:2px 4px">Add: SGST ${sgstRate}%</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalSGST)}</td></tr>
        <tr><td style="padding:2px 4px">Add: IGST</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right"></td></tr>` : ''}
        ${!isNonTax && !isSameState ? `
        <tr><td style="padding:2px 4px">Add: CGST</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right"></td></tr>
        <tr><td style="padding:2px 4px">Add: SGST</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right"></td></tr>
        <tr><td style="padding:2px 4px">Add: IGST ${igstRate}%</td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalIGST)}</td></tr>` : ''}
        ${!isNonTax ? `<tr style="border-top:1px solid #ccc"><td style="padding:2px 4px"><b>Tax Amount: GST</b></td><td style="padding:2px 4px;text-align:center">:</td><td style="padding:2px 4px;text-align:right;font-weight:700">${fmtInt(totalGST)}</td></tr>` : ''}
        <tr style="border-top:1.5px solid #000">
          <td style="padding:3px 4px;font-weight:700">Total Amount After Tax</td>
          <td style="padding:3px 4px;text-align:center;font-weight:700">:</td>
          <td style="padding:3px 4px;text-align:right;font-weight:700;font-size:12px">${fmtInt(grandTotal)}</td>
        </tr>
      </table>
      <div style="margin-top:6px;border-top:1px solid #ddd;padding-top:4px">
        <div>GST Payable on Reverse Charge : ${data.reverse_charge || ''}</div>
        <div style="margin-top:4px;font-size:9px;font-style:italic">Certified that the particulars given above are true &amp; correct.</div>
        <div style="margin-top:4px;font-weight:700">For, ${data.company_name || ''}</div>
      </div>
      <div style="margin-top:auto;padding-top:30px;text-align:right">
        <div style="font-weight:700;font-size:11px">Authorised Signatory</div>
        <div style="font-size:9px;margin-top:2px">[E &amp; OE]</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ── PDF generation ─────────────────────────────────────────────────────────────
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

/**
 * Generate a PDF buffer from invoice data.
 * @param {object} invoiceData  Full invoice row with line_items/items joined in.
 * @returns {Buffer} PDF bytes
 */
export async function generateInvoicePdf(invoiceData) {
    const html = buildInvoiceHtml(invoiceData);
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '8mm', right: '10mm', bottom: '8mm', left: '10mm' },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await page.close();
    }
}
