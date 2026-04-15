import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * Helper to organize rows into a Folder Structure
 */
const groupDocumentsByMonth = (rows, isSales) => {
    const folders = {};

    rows.forEach(row => {
        // Safe Date Parsing
        const d = new Date(row.doc_date);
        // Format: YYYY-MM (e.g., 2025-12)
        const monthKey = !isNaN(d.getTime()) 
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` 
            : 'Unknown Date';
        
        if (!folders[monthKey]) {
            folders[monthKey] = { 
                month: monthKey, 
                tax_files: [], 
                non_tax_files: [],
                total_count: 0 
            };
        }

        let isTaxDoc = false;
        if (isSales) {
            isTaxDoc = row.category === 'TAX_INVOICE';
        } else {
            isTaxDoc = String(row.category || row.bill_type || 'GST').toUpperCase() === 'GST';
        }

        const virtualLink = row.file_url ? row.file_url : `/invoices/${row.id}`;
        const isVirtual = !row.file_url; 

        const docObj = {
            id: row.id,
            number: row.doc_number,
            date: row.doc_date,
            amount: row.amount,
            party_name: row.party_name || 'Unknown Party',
            file_url: virtualLink,
            is_virtual: isVirtual,
            status: row.status || 'pending',
            category: isTaxDoc ? 'Tax Invoices' : 'Non-Tax Invoices'
        };

        if (isTaxDoc) {
            folders[monthKey].tax_files.push(docObj);
        } else {
            folders[monthKey].non_tax_files.push(docObj);
        }
        folders[monthKey].total_count++;
    });

    return Object.values(folders).sort((a, b) => b.month.localeCompare(a.month));
};

// GET /api/documents/sales
router.get("/sales", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        console.log(`📂 Fetching Sales Documents for Company ID: ${companyId}`);

        const sql = `
            SELECT 
                i.id, 
                i.invoice_number as doc_number, 
                i.invoice_date as doc_date, 
                i.total_amount as amount, 
                i.invoice_type as category, 
                i.file_url,
                i.status,
                u.username as party_name
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            WHERE i.company_id = $1
            ORDER BY i.invoice_date DESC
        `;
        const result = await db.pgAll(sql, [companyId]);
        console.log(`✅ Found ${result.length} sales documents.`);

        const tree = groupDocumentsByMonth(result, true);
        res.json(tree);
    } catch (err) {
        console.error("Document fetch error:", err);
        res.status(500).json({ error: "Failed to fetch sales documents" });
    }
});

// GET /api/documents/purchases
router.get("/purchases", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const sql = `
            SELECT 
                pb.id, 
                pb.bill_number as doc_number, 
                pb.bill_date as doc_date, 
                pb.total_amount as amount, 
                pb.bill_type as category,
                pb.file_url,
                pb.status,
                COALESCE(l.lender_name, pb.supplier_name) as party_name
            FROM purchase_bills pb
            LEFT JOIN lenders l ON pb.supplier_id = l.id
            WHERE pb.company_id = $1
            ORDER BY pb.bill_date DESC
        `;
        const result = await db.pgAll(sql, [companyId]);
        const tree = groupDocumentsByMonth(result, false);
        res.json(tree);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch purchase documents" });
    }
});

export default router;
