// backend/routes/purchasePdfRoutes.js
import express from "express";
import puppeteer from "puppeteer";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Generate Purchase Bill PDF (Internal Representation)
 * GET /api/purchase-pdf/:id
 */
router.get("/:id", authMiddleware, async (req, res) => {
    const billId = Number(req.params.id);
    const companyId = req.user.active_company_id;

    try {
        const billSQL = `
            SELECT pb.*, 
                   COALESCE(l.lender_name, pb.supplier_name) as supplier_name,
                   l.address as supplier_address, 
                   l.email as supplier_email,
                   l.phone as supplier_phone,
                   l.gstin as supplier_gstin,
                   c.company_name, 
                   c.address_line1 as company_address, 
                   c.city_pincode as company_city, 
                   c.state as company_state, 
                   c.gstin as company_gstin
            FROM purchase_bills pb
            LEFT JOIN suppliers l ON pb.supplier_id = l.id
            LEFT JOIN companies c ON pb.company_id = c.id
            WHERE pb.id = $1 AND pb.company_id = $2
        `;

        const bill = await db.pgGet(billSQL, [billId, companyId]);
        if (!bill) {
            return res.status(404).json({ error: "Bill not found" });
        }

        const items = await db.pgAll(
            `SELECT pbi.*, p.name as product_name, p.hsn_code 
             FROM purchase_bill_items pbi
             LEFT JOIN products p ON pbi.product_id = p.id
             WHERE pbi.bill_id = $1`,
            [billId]
        );

        const html = generatePurchaseHTML(bill, items);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (err) {
        console.error("Purchase PDF Error:", err);
        res.status(500).json({ error: "Failed to generate Purchase Bill" });
    }
});

function generatePurchaseHTML(bill, items) {
    const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    const rows = items.map((item, i) => `
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${i + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name || 'Manual Item'}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.hsn_code || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(item.unit_cost)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(item.taxable_value)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(item.total_amount)}</td>
        </tr>
    `).join('');

    return `
    <html>
    <body style="font-family: sans-serif; padding: 40px; color: #333;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px;">
            <div>
                <h1 style="margin: 0;">PURCHASE RECORD</h1>
                <p style="margin: 5px 0;">Internal Digital Representation</p>
            </div>
            <div style="text-align: right;">
                <h2 style="margin: 0;">${bill.company_name}</h2>
                <p style="margin: 5px 0;">GSTIN: ${bill.company_gstin}</p>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 30px;">
            <div style="width: 45%;">
                <h4 style="margin: 0; text-transform: uppercase; color: #666;">Supplier Details</h4>
                <p style="margin: 8px 0;"><strong>${bill.supplier_name}</strong></p>
                <p style="margin: 4px 0;">${bill.supplier_address || 'Address not registered'}</p>
                <p style="margin: 4px 0;">GSTIN: ${bill.supplier_gstin || 'N/A'}</p>
            </div>
            <div style="width: 45%; text-align: right;">
                <h4 style="margin: 0; text-transform: uppercase; color: #666;">Bill Info</h4>
                <p style="margin: 8px 0;">Bill No: <strong>${bill.bill_number}</strong></p>
                <p style="margin: 4px 0;">Date: ${new Date(bill.bill_date).toLocaleDateString()}</p>
                <p style="margin: 4px 0;">Type: ${bill.bill_type}</p>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
            <thead>
                <tr style="background: #f4f4f4;">
                    <th style="border: 1px solid #ddd; padding: 10px; width: 40px;">#</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Product</th>
                    <th style="border: 1px solid #ddd; padding: 10px;">HSN</th>
                    <th style="border: 1px solid #ddd; padding: 10px;">Qty</th>
                    <th style="border: 1px solid #ddd; padding: 10px;">Rate</th>
                    <th style="border: 1px solid #ddd; padding: 10px;">Taxable</th>
                    <th style="border: 1px solid #ddd; padding: 10px;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="font-weight: bold;">
                    <td colspan="5" style="border: 1px solid #ddd; padding: 10px; text-align: right;">Net Payable</td>
                    <td colspan="2" style="border: 1px solid #ddd; padding: 10px; text-align: right;">₹ ${fmt(bill.total_amount)}</td>
                </tr>
            </tfoot>
        </table>

        <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-size: 12px; color: #999;">This is a system-generated record of a manual purchase entry. It captures physical inventory increases and financial ledger updates automatically.</p>
        </div>
    </body>
    </html>`;
}

export default router;
