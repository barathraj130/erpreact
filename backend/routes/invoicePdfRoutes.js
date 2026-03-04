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

        return `
            <tr>
                <td style="border-right: 1px solid #000; text-align: center; padding: 4px;">${i+1}</td>
                <td style="border-right: 1px solid #000; padding: 4px;"><b>${item.description || ''}</b></td>
                <td style="border-right: 1px solid #000; text-align: center; padding: 4px;">${item.hsn_acs_code || ''}</td>
                <td style="border-right: 1px solid #000; text-align: center; padding: 4px;">Pcs</td>
                <td style="border-right: 1px solid #000; text-align: center; padding: 4px;">${qty}</td>
                <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(rate)}</td>
                <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(taxable)}</td>
                <td style="border-right: 1px solid #000; text-align: center; padding: 4px;">0.00</td>
                <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(taxable)}</td>
                <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(cgst)}</td>
                <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(sgst)}</td>
                <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(igst)}</td>
                <td style="text-align: right; padding: 4px; font-weight: bold;">${fmt(lineTotal)}</td>
            </tr>
        `;
    }).join('');

    // Empty rows filler
    const emptyRowsCount = Math.max(0, 15 - items.length);
    let emptyRows = '';
    for(let i=0; i<emptyRowsCount; i++) {
        emptyRows += `
            <tr style="height: 20px;">
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="border-right: 1px solid #000;"></td>
                <td></td>
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
            th { border-bottom: 1px solid #000; border-right: 1px solid #000; background: #f3f4f6; padding: 2px; font-size: 11px; }
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
            <div style="text-align: center; padding: 15px 0 0 0; clear: both;">
                <h1 style="margin: 0; font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">${companyName}</h1>
                <p style="margin: 4px 0; font-size: 11px;">
                    ${invoice.company_address || ''}${invoice.company_city ? ', ' + invoice.company_city : ''}
                </p>
                <p style="margin: 3px 0; font-size: 12px; font-weight: bold;">TAMILNADU</p>
                <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: bold;">GSTIN No. : ${invoice.company_gstin || 'N/A'}</p>
            </div>

            <div style="text-align: center; border: 1px solid #000; border-bottom: none; padding: 2px 5px; font-weight: 900; font-size: 13px; text-transform: uppercase;">
                INVOICE
            </div>

            <!-- Metadata Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; border-bottom: none; font-size: 11px;">
                <div style="border-right: 1px solid #000;">
                    <div style="display: grid; grid-template-columns: 160px 1fr; border-bottom: 1px solid #000; padding: 2px 5px;">
                        <span>Reverse Charge</span><span>: ${invoice.reverse_charge || 'No'}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; border-bottom: 1px solid #000; padding: 2px 5px;">
                        <span>Invoice No</span><span>: <b>${invoice.invoice_number}</b></span>
                    </div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; border-bottom: 1px solid #000; padding: 2px 5px;">
                        <span>Invoice Date</span><span>: <b>${invoiceDate}</b></span>
                    </div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; padding: 2px 5px;">
                        <span>State</span><span>: ${invoice.company_state || 'TAMILNADU'} Code: ${invoice.company_state_code || '33'}</span>
                    </div>
                </div>
                <div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; border-bottom: 1px solid #000; padding: 2px 5px;">
                        <span>Transport Mode</span><span>: ${invoice.transport_mode || 'By Road'}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; border-bottom: 1px solid #000; padding: 2px 5px;">
                        <span>Vehicle Number</span><span>: ${invoice.vehicle_number || '-'}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; border-bottom: 1px solid #000; padding: 2px 5px;">
                        <span>Date of Supply</span><span>: ${supplyDate}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 160px 1fr; padding: 2px 5px;">
                        <span>Place of Supply</span><span>: ${invoice.customer_state || invoice.state || '-'} Code: ${invoice.customer_state_code || '33'}</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; border-bottom: none; font-size: 11px;">
                <div style="border-right: 1px solid #000; padding: 5px;">
                    <strong style="text-decoration: underline;">Details of Receiver Billed To :</strong>
                    <div style="margin-top: 3px;">Name : <b>${invoice.customer_name}</b></div>
                    <div>Address : ${invoice.customer_address || ''}, ${invoice.customer_city || ''}</div>
                    <div>GSTIN : ${invoice.customer_gstin || 'Unregistered'}</div>
                    <div>State : ${invoice.customer_state || ''} Code : ${invoice.customer_state_code || '33'}</div>
                </div>
                <div style="padding: 5px;">
                    <strong style="text-decoration: underline;">Details of Consignee :</strong>
                    <div style="margin-top: 3px;">Name : <b>${invoice.customer_name}</b></div>
                    <div>Address : ${invoice.customer_address || ''}, ${invoice.customer_city || ''}</div>
                    <div>GSTIN : ${invoice.customer_gstin || 'Unregistered'}</div>
                    <div>State : ${invoice.customer_state || ''} Code : ${invoice.customer_state_code || '33'}</div>
                </div>
            </div>

            <!-- Main Items Table -->
            <div style="border: 1px solid #000; min-height: 400px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                    <thead>
                        <tr style="border-bottom: 1px solid #000; background: #f9fafb;">
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 35px; font-size: 9px; font-weight: bold;">Sr.No</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; text-align: left; font-size: 9px; font-weight: bold;">Name of Product</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 50px; font-size: 9px; font-weight: bold;">HSN</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 35px; font-size: 9px; font-weight: bold;">Uom</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 35px; font-size: 9px; font-weight: bold;">Qty</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 70px; font-size: 9px; font-weight: bold;">Rate</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 75px; font-size: 9px; font-weight: bold;">Amount</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 60px; font-size: 9px; font-weight: bold;">Discount</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 75px; font-size: 9px; font-weight: bold;">Taxable</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 55px; font-size: 9px; font-weight: bold;">CGST</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 55px; font-size: 9px; font-weight: bold;">SGST</th>
                            <th style="border-right: 1px solid #000; padding: 4px 2px; width: 55px; font-size: 9px; font-weight: bold;">IGST</th>
                            <th style="padding: 4px 2px; width: 85px; font-size: 9px; font-weight: bold;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                        ${emptyRows}
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 1px solid #000; font-weight: bold; background: #f1f5f9;">
                            <td colspan="6" style="border-right: 1px solid #000; text-align: right; padding: 4px;">Total</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.subtotal)}</td>
                            <td style="border-right: 1px solid #000; text-align: center; padding: 4px;">0.00</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.subtotal)}</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.cgst)}</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.sgst)}</td>
                            <td style="border-right: 1px solid #000; text-align: right; padding: 4px;">${fmt(totals.igst)}</td>
                            <td style="text-align: right; padding: 4px;">${fmt(totals.grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Final Footer -->
            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; border: 1px solid #000; border-top: none; font-size: 11px;">
                <div style="padding: 6px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <b>Total Invoice Amount in words</b><br />
                        <div style="margin-top: 2px; text-transform: capitalize; font-weight: bold;">${amountInWords}</div>
                        
                        <div style="margin-top: 10px;">
                            Bundles : ${invoice.bundles_count || 0}
                        </div>
                    </div>

                    <div style="margin-top: 10px;">
                        <b style="text-decoration: underline;">Bank Details :</b><br />
                        * BANK NAME : ${invoice.bank_name || 'N/A'}<br />
                        * A/C NO : ${invoice.bank_account_no || 'N/A'}<br />
                        * IFSC NO : ${invoice.bank_ifsc_code || 'N/A'}<br /><br />
                        <b>(Common Seal)</b>
                    </div>
                </div>
                <div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <tbody>
                            <tr>
                                <td style="padding: 4px; border-bottom: 1px solid #000;">Total Before Tax</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #000; font-weight: bold; border-left: 1px solid #000; width: 100px;">${fmt(totals.subtotal)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px; border-bottom: 1px solid #000;">Add: CGST</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #000; border-left: 1px solid #000;">${fmt(totals.cgst)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px; border-bottom: 1px solid #000;">Add: SGST</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #000; border-left: 1px solid #000;">${fmt(totals.sgst)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px; border-bottom: 1px solid #000;">Add: IGST</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #000; border-left: 1px solid #000;">${fmt(totals.igst)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px; border-bottom: 1px solid #000;">Tax Amount: GST</td>
                                <td style="text-align: right; padding: 4px; border-bottom: 1px solid #000; border-left: 1px solid #000; font-weight: bold;">${fmt(totals.cgst + totals.sgst + totals.igst)}</td>
                            </tr>
                            <tr style="background: #f3f4f6; font-weight: bold; font-size: 12px;">
                                <td style="padding: 6px;">Total After Tax</td>
                                <td style="text-align: right; padding: 6px; border-left: 1px solid #000;">${fmt(totals.grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div style="padding: 6px; border-top: 1px solid #000; font-size: 10px;">
                        <div>GST on Reverse Charge : ${invoice.reverse_charge || 'No'}</div>
                        <div style="margin-top: 3px; font-style: italic; font-size: 9px;">Certified that particulars are true & correct.</div>
                        
                        <div style="margin-top: 10px; text-align: right; font-weight: bold; font-size: 11px; padding-right: 10px;">
                            For, ${companyName}
                            <div style="height: 45px; display: flex; align-items: center; justify-content: flex-end;">
                                ${invoice.signature_url ? '<img src="http://localhost:3000' + invoice.signature_url + '" style="height: 35px;" alt="Sig" />' : ''}
                            </div>
                            <div style="border-top: 1px dotted #000; display: inline-block; min-width: 150px; text-align: center;">Authorised Signatory</div>
                        </div>
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