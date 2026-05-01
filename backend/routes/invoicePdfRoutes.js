// backend/routes/invoicePdfRoutes.js
// Professional PDF Invoice Generator using Puppeteer

import express from "express";
import puppeteer from "puppeteer";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Generate Professional GST Invoice PDF
 * GET /api/invoice/:id/pdf
 */
router.get("/:id/pdf", authMiddleware, async (req, res) => {
    const invoiceId = Number(req.params.id);
    const companyId = req.user.active_company_id;

    try {
        // 1. Fetch Invoice Data
        const invoiceSQL = `
            SELECT i.*, 
                   u.username as customer_name, 
                   u.company as customer_company,
                   u.address_line1 as customer_address, 
                   u.city_pincode as customer_city, 
                   u.state as customer_state, 
                   u.gstin as customer_gstin,
                   u.state_code as customer_state_code,
                   c.company_name, 
                   c.address_line1 as company_address, 
                   c.city_pincode as company_city, 
                   c.state as company_state, 
                   c.gstin as company_gstin,
                   c.state_code as company_state_code,
                   c.bank_name, 
                   c.bank_account_no, 
                   c.bank_ifsc_code, 
                   c.signature_url,
                   c.phone as company_phone,
                   c.email as company_email
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            LEFT JOIN companies c ON i.company_id = c.id
            WHERE i.id = $1 AND i.company_id = $2
        `;

        const invoice = await db.pgGet(invoiceSQL, [invoiceId, companyId]);
        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        // 2. Fetch Line Items
        const items = await db.pgAll(
            `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id`,
            [invoiceId]
        );

        // 3. Calculate GST Breakdown
        let subtotal = 0;
        let totalGST = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        items.forEach(item => {
            const amount = Number(item.taxable_value) || 0;
            const gstRate = Number(item.gst_rate) || 0;
            const gstAmount = (amount * gstRate) / 100;

            subtotal += amount;
            totalGST += gstAmount;

            // Intra-state: CGST + SGST, Inter-state: IGST
            if (invoice.company_state_code === invoice.customer_state_code) {
                cgst += gstAmount / 2;
                sgst += gstAmount / 2;
            } else {
                igst += gstAmount;
            }
        });

        const grandTotal = subtotal + totalGST;

        // 4. Generate HTML Template
        const html = generateInvoiceHTML(invoice, items, {
            subtotal,
            cgst,
            sgst,
            igst,
            grandTotal
        });

        // 5. Generate PDF using Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            }
        });

        await browser.close();

        // 6. Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Invoice_${invoice.invoice_number}.pdf"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.send(pdfBuffer);

    } catch (err) {
        console.error("PDF Generation Error:", err);
        res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    }
});

/**
 * Generate Professional Invoice HTML
 */
function generateInvoiceHTML(invoice, items, totals) {
    const val = (n) => Number(n) || 0;
    const fmt = (n) => val(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Format Date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-IN'); // DD/MM/YYYY
    };

    // Indian Number to Words
    const toWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const formatted = ('000000000' + num).substr(-9);
        const n = formatted.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);

        if (!n) return '';

        let str = '';
        const n1 = Number(n[1]);
        const n2 = Number(n[2]);
        const n3 = Number(n[3]);
        const n4 = Number(n[4]);
        const n5 = Number(n[5]);

        if (n1 !== 0) str += (a[n1] || b[Math.floor(n1 / 10)] + ' ' + a[n1 % 10]) + 'Crore ';
        if (n2 !== 0) str += (a[n2] || b[Math.floor(n2 / 10)] + ' ' + a[n2 % 10]) + 'Lakh ';
        if (n3 !== 0) str += (a[n3] || b[Math.floor(n3 / 10)] + ' ' + a[n3 % 10]) + 'Thousand ';
        if (n4 !== 0) str += (a[n4] || b[Math.floor(n4 / 10)] + ' ' + a[n4 % 10]) + 'Hundred ';
        if (n5 !== 0) str += (str !== '' ? 'and ' : '') + (a[n5] || b[Math.floor(n5 / 10)] + ' ' + a[n5 % 10]) + 'only ';

        return str;
    };

    // Prepare variables for template
    const invoiceDate = formatDate(invoice.invoice_date);
    const supplyDate = formatDate(invoice.date_of_supply);
    const companyName = invoice.company_name || 'My Company';
    const amountInWords = toWords(Math.round(totals.grandTotal));

    // Items content generation
    const itemsRows = items.map((item, i) => {
        const qty = val(item.quantity);
        const rate = val(item.unit_price);
        // Taxable calculation priority
        const taxable = val(item.taxable_value) || (qty * rate);
        const gstRate = val(item.gst_rate);

        // Calculate tax for this row
        const gstAmount = (taxable * gstRate) / 100;

        // Split tax
        const isSameState = invoice.company_state_code === invoice.customer_state_code;
        const cgst = isSameState ? (gstAmount / 2) : 0;
        const sgst = isSameState ? (gstAmount / 2) : 0;
        const igst = !isSameState ? gstAmount : 0;

        const lineTotal = taxable + gstAmount;
        const itemGST = cgst + sgst + igst;

        return `
            <tr style="height: 20px;">
                <td style="border-right: 1px solid #000; text-align: center; border-bottom: 1px solid #000; padding: 4px;">${i + 1}</td>
                <td style="border-right: 1px solid #000; text-align: left; border-bottom: 1px solid #000; padding: 4px; padding-left: 4px;">${item.description || ''}</td>
                <td style="border-right: 1px solid #000; text-align: center; border-bottom: 1px solid #000; padding: 4px;">${item.hsn_acs_code || ''}</td>
                <td style="border-right: 1px solid #000; text-align: center; border-bottom: 1px solid #000; padding: 4px;">Pcs</td>
                <td style="border-right: 1px solid #000; text-align: right; border-bottom: 1px solid #000; padding: 4px; padding-right: 4px;">${fmt(qty)}</td>
                <td style="border-right: 1px solid #000; text-align: right; border-bottom: 1px solid #000; padding: 4px; padding-right: 4px;">${fmt(rate)}</td>
                <td style="border-right: 1px solid #000; text-align: right; border-bottom: 1px solid #000; padding: 4px; padding-right: 4px;">${fmt(taxable)}</td>
                <td style="border-right: 1px solid #000; text-align: right; border-bottom: 1px solid #000; padding: 4px; padding-right: 4px;">${fmt(taxable)}</td>
                <td style="border-right: 1px solid #000; text-align: right; border-bottom: 1px solid #000; padding: 4px; padding-right: 4px;">${fmt(itemGST)}</td>
                <td style="text-align: right; border-bottom: 1px solid #000; padding: 4px; padding-right: 4px;">${fmt(lineTotal)}</td>
            </tr>
        `;
    }).join('');

    // Empty rows filler
    const emptyRowsCount = Math.max(0, 15 - items.length);
    let emptyRows = '';
    for (let i = 0; i < emptyRowsCount; i++) {
        emptyRows += `
            <tr style="height: 20px;">
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000; border-bottom: 1px solid #000;"></td>
                <td style="border-bottom: 1px solid #000;"></td>
            </tr>
        `;
    }

    return `
    <html>
    <head>
        <title>Invoice #${invoice.invoice_number}</title>
        <style>
            body { margin: 0; padding: 20px; font-family: 'Helvetica', Arial, sans-serif; font-size: 12px; }
            .container { width: 210mm; min-height: 297mm; background: white; padding: 10px; box-sizing: border-box; border: 1px solid #000; margin: 0 auto; position: relative; } 
            .header { text-align: center; padding: 10px 0; clear: both; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px; font-size: 11px; }
            th:last-child { border-right: none; }
            td { padding: 6px; font-size: 11px; }
            .triplicate { float: right; fontSize: 10px; textAlign: right; border: 1px solid #ccc; padding: 4px; margin-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            
            <!-- TRIPLICATE INDICATOR -->
            <div style="float: right; font-size: 10px; text-align: right; border: 1px solid #ccc; padding: 4px;">
                <div style="color: red;">Original for Recipient</div>
                <div style="color: blue;">Duplicate for Supplier</div>
                <div style="color: green;">Triplicate for Supplier</div>
            </div>

            <!-- Header -->
            <div style="text-align: center; padding: 10px 0 5px 0; clear: both;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${companyName}</h1>
                <p style="margin: 2px 0; font-size: 11px;">
                    ${invoice.company_address || '3/2B, Nesavalar Colony, 2nd Street, PN Road'}, ${invoice.company_city || 'TIRUPUR'} - ${invoice.company_pincode || '641602'}, ${invoice.company_state || 'TAMILNADU'}
                </p>
                <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: bold;">GSTIN No.: ${invoice.company_gstin || '33CKAPJ7513F1ZK'}</p>
            </div>

            <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; text-align: center; padding: 4px 5px; font-weight: 900; font-size: 14px; text-transform: uppercase;">
                TAX INVOICE
            </div>

            <!-- Metadata Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; font-size: 11px;">
                <div style="padding: 4px 0;">
                    <div style="display: grid; grid-template-columns: 100px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">Invoice No:</span><span>${invoice.invoice_number}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 100px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">Invoice Date:</span><span>${invoiceDate}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 100px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">State:</span><span>${invoice.company_state || 'TAMILNADU'}, <b style="margin-left: 4px;">State Code:</b> ${invoice.company_state_code || '33'}</span>
                    </div>
                </div>
                <div style="padding: 4px 0;">
                    <div style="display: grid; grid-template-columns: 135px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">Transportation Mode:</span><span>${invoice.transport_mode || 'N/A'}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 135px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">Vehicle Number:</span><span>${invoice.vehicle_number || 'N/A'}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 135px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">Date of Supply:</span><span>${supplyDate}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 135px 1fr; padding: 2px 10px;">
                        <span style="font-weight: bold;">Place of Supply:</span><span>${invoice.customer_state || invoice.state || 'KERALA'}, <b style="margin-left: 4px;">State Code:</b> ${invoice.customer_state_code || '32'}</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; font-size: 11px;">
                <div style="border-right: 1px solid #000; padding: 5px;">
                    <b style="text-decoration: underline;">Details of Receiver/Billed To:</b>
                    <div style="margin-top: 4px; font-weight: bold;">${invoice.customer_name || 'TIRUPPUR BAZAR'}</div>
                    <div>${invoice.customer_address || 'NEAR NEW ALMA HOSPITAL'}</div>
                    <div>${invoice.customer_city || 'MANNARKKAD'}</div>
                    <div><b>GSTIN:</b> ${invoice.customer_gstin || '32BMSPH6524B1ZA'}</div>
                    <div><b>State:</b> ${invoice.customer_state || 'KERALA'}, <b>Code:</b> ${invoice.customer_state_code || '32'}</div>
                </div>
                <div style="padding: 5px;">
                    <b style="text-decoration: underline;">Details of Consignee/Shipped To:</b>
                    <div style="margin-top: 4px; font-weight: bold;">${invoice.ship_to_name || invoice.customer_name || 'JBS KNITWEAR'}</div>
                    <div>${invoice.ship_to_address || '3/2B, Nesavalar Colony, 2nd Street, PN Road'}</div>
                    <div>${invoice.ship_to_city || 'TIRUPUR - 641602'}</div>
                    <div><b>PH:</b> ${invoice.customer_phone || ''}</div>
                    <div><b>GSTIN:</b> ${invoice.customer_gstin || '33CKAPJ7513F1ZK'}</div>
                    <div><b>State:</b> ${invoice.ship_to_state || 'TAMILNADU'}, <b>Code:</b> ${invoice.ship_to_state_code || '33'}</div>
                </div>
            </div>

            <!-- Main Items Table -->
            <div style="min-height: 380px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #000; border-top: 1px solid #000;">
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 35px; font-weight: bold;">Sr.</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; text-align: center; font-weight: bold;">Name of Product/Service</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 50px; font-weight: bold;">HSN</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 35px; font-weight: bold;">UOM</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 55px; font-weight: bold;">Qty</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 65px; font-weight: bold;">Rate</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 70px; font-weight: bold;">Amount</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 70px; font-weight: bold;">Taxable</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 65px; font-weight: bold;">GST</th>
                            <th style="padding: 4px 2px; width: 85px; font-weight: bold;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        \$\{itemsRows\}
                        \$\{emptyRows\}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000;">
                            <td colspan="4" style="border-right: 1px solid #000; text-align: right; padding-right: 6px;">Total</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(items.reduce((s, i) => s + val(i.quantity), 0))}</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;"></td>
                            <td style="border-right: 1px solid #000; text-align: center; padding: 4px;"></td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.subtotal)}</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.cgst + totals.sgst + totals.igst)}</td>
                            <td style="text-align: right; padding: 4px;">${fmt(totals.grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Final Footer -->
            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; font-size: 11px; min-height: 150px;">
                <div style="border-right: 1px solid #000; padding: 6px; display: flex; flex-direction: column;">
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; font-weight: bold;">
                        <span>Total Amount in words:</span>
                        <span style="text-transform: uppercase;">${amountInWords}</span>
                    </div>
                    <div style="margin-top: 16px; font-weight: bold;">
                        Bundles: ${invoice.bundles_count || "N/A"}
                    </div>
                    <div style="margin-top: 16px;">
                        <b style="text-decoration: underline;">Bank Details:</b><br />
                        <b>BANK NAME:</b> ${invoice.bank_name || 'ICICI Bank'}<br />
                        <b>A/C NO:</b> ${invoice.bank_account_no || '540305000194'}<br />
                        <b>IFSC NO:</b> ${invoice.bank_ifsc_code || 'ICIC0005403'}<br />
                    </div>
                    <div style="margin-top: 16px; font-weight: bold;">
                        Notes:
                        <div style="margin-top: 4px; font-weight: normal;">${invoice.notes || ""}</div>
                    </div>
                </div>
                <div style="padding: 6px 12px; display: flex; flex-direction: column; position: relative;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Total Amount Before Tax</span>
                        <span>${fmt(totals.subtotal)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Add: CGST</span>
                        <span>${fmt(totals.cgst)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Add: SGST</span>
                        <span>${fmt(totals.sgst)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 4px;">
                        <span>Add: IGST</span>
                        <span>${fmt(totals.igst)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold;">
                        <span>Total Amount After Tax</span>
                        <span>${fmt(totals.grandTotal)}</span>
                    </div>
                    
                    <div style="font-size: 10px; margin-top: 8px;"><b>GST Payable on Reverse Charge:</b> ${invoice.reverse_charge || 'No'}</div>
                    
                    <div style="margin-top: auto; text-align: right;">
                        <div style="font-size: 9px; font-style: italic; margin-bottom: 16px; text-align: center; width: 100%;">Certified that the particulars given above are true & correct.</div>
                    </div>
                </div>
            </div>

            <div style="padding: 4px; text-align: right; font-size: 9px; border-top: 1px solid #000;">
                [E & OE]
            </div>


        </div>
    </body>
    </html>`;
}

export default router;