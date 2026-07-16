// backend/routes/customerLedgerExport.js
// Customer ledger PDF export — combined "all customers" report + single-customer
// download. New, additive route file — does not modify any existing route,
// table, or component. Mounted at its own prefix (/api/customer-ledgers) so
// there is no ordering conflict with any existing :id-style route.
import express from "express";
import puppeteer from "puppeteer";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import checkPermission from "../middlewares/checkPermission.js";
import { buildCustomerLedgerStatement } from "../services/customerLedgerService.js";

const router = express.Router();

// ── Branding — same merge order as invoicePdfRoutes.js (bill_format_settings
// overrides the company row), so the letterhead matches the rest of the app
// instead of a hardcoded tenant name. ──────────────────────────────────────
async function resolveCompanyBranding(companyId) {
    const company = await db.pgGet(
        `SELECT company_name, address_line1, city_pincode, state, state_code, gstin, phone
         FROM companies WHERE id = $1`,
        [companyId]
    );
    // bill_format_settings / bank_details are optional overrides on top of the
    // companies row — some deployments may not have these tables migrated yet,
    // so fall back to company defaults rather than failing the whole export.
    const fmt = await db.pgGet(
        `SELECT * FROM bill_format_settings WHERE company_id = $1`,
        [companyId]
    ).catch(() => undefined);
    const defaultBank = await db.pgGet(
        `SELECT bank_name, account_number, ifsc_code
         FROM bank_details WHERE company_id = $1
         ORDER BY is_default DESC, id ASC LIMIT 1`,
        [companyId]
    ).catch(() => undefined);

    return {
        name: fmt?.business_name || company?.company_name || "",
        address: fmt?.address || company?.address_line1 || "",
        city: company?.city_pincode || "",
        state: fmt?.state || company?.state || "",
        gstin: fmt?.gstin || company?.gstin || "",
        phone: fmt?.phone || company?.phone || "",
        bank_name: fmt?.bank_name || defaultBank?.bank_name || "",
        bank_ac: fmt?.bank_account_no || defaultBank?.account_number || "",
        bank_ifsc: fmt?.bank_ifsc_code || defaultBank?.ifsc_code || "",
    };
}

function esc(v) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtMoney(n) {
    const num = Number(n) || 0;
    return "₹" + Math.abs(num).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_LABELS = {
    INVOICE: "Invoice",
    RETURN: "Return / Credit Note",
    RECEIPT: "Payment",
    ROUND_OFF: "Round Off",
    DISCOUNT: "Discount",
};

function renderCustomerSection(customer, summary, transactions, isFirst) {
    const rows = transactions.map((t) => {
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;
        const balColor = Number(t.running_balance) > 0 ? "#dc2626" : "#16a34a";
        return `
      <tr>
        <td>${esc(fmtDate(t.date))}</td>
        <td>${esc(t.description || "")}${t.invoice_number ? ` <span class="muted">#${esc(t.invoice_number)}</span>` : ""}</td>
        <td class="center">${esc(TYPE_LABELS[t.type] || t.type)}</td>
        <td class="right debit">${debit > 0 ? esc(fmtMoney(debit)) : "—"}</td>
        <td class="right credit">${credit > 0 ? esc(fmtMoney(credit)) : "—"}</td>
        <td class="right bold" style="color:${balColor}">${esc(fmtMoney(t.running_balance))}</td>
      </tr>`;
    }).join("");

    const closing = Number(summary.pending_amount) || 0;
    const closingColor = closing > 0 ? "#dc2626" : "#16a34a";

    return `
    <section class="customer-section"${isFirst ? "" : ' style="page-break-before: always;"'}>
      <div class="customer-header">
        <div class="avatar">${esc((customer.name || "?").charAt(0).toUpperCase())}</div>
        <div class="customer-info">
          <div class="customer-name">${esc(customer.name)}</div>
          <div class="customer-meta">
            ${customer.phone ? `<span>📞 ${esc(customer.phone)}</span>` : ""}
            ${customer.email ? `<span>✉ ${esc(customer.email)}</span>` : ""}
          </div>
        </div>
        <div class="closing-box">
          <div class="closing-label">${closing > 0 ? "Outstanding" : "Closing Balance"}</div>
          <div class="closing-value" style="color:${closingColor}">${esc(fmtMoney(closing))}</div>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card"><div class="s-label">Opening Balance</div><div class="s-value">${esc(fmtMoney(summary.opening_balance))}</div></div>
        <div class="summary-card"><div class="s-label">Total Billed</div><div class="s-value">${esc(fmtMoney(summary.total_billed))}</div></div>
        <div class="summary-card"><div class="s-label">Total Paid</div><div class="s-value" style="color:#16a34a">${esc(fmtMoney(summary.total_paid))}</div></div>
        <div class="summary-card"><div class="s-label">Total Returns</div><div class="s-value" style="color:#d97706">${esc(fmtMoney(summary.total_returns))}</div></div>
      </div>

      ${transactions.length === 0
        ? `<p class="empty-note">No transactions recorded for this customer.</p>`
        : `<table class="ledger-table">
            <thead>
              <tr>
                <th>Date</th><th>Description</th><th class="center">Type</th>
                <th class="right">Debit (Dr)</th><th class="right">Credit (Cr)</th><th class="right">Balance</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
      }
    </section>`;
}

function renderDocumentHTML(co, sections, { showCover, generatedDate, customerCount }) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10.5px; }
  .muted { color: #94a3b8; font-size: 9px; }
  .cover { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
  .cover h1 { font-size: 26px; color: #4f46e5; margin: 0 0 8px; }
  .cover h2 { font-size: 15px; color: #0f172a; margin: 0 0 6px; font-weight: 500; }
  .cover p { font-size: 11px; color: #64748b; margin: 2px 0; }
  .cover .rule { width: 140px; height: 2px; background: #4f46e5; margin: 16px 0; }
  .customer-section { padding: 24px 32px; }
  .customer-header { display: flex; align-items: center; gap: 14px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; flex-shrink: 0; }
  .customer-info { flex: 1; }
  .customer-name { font-size: 15px; font-weight: bold; }
  .customer-meta { font-size: 9.5px; color: #64748b; display: flex; gap: 12px; margin-top: 3px; }
  .closing-box { text-align: right; }
  .closing-label { font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .closing-value { font-size: 17px; font-weight: bold; }
  .summary-grid { display: flex; gap: 8px; margin-bottom: 14px; }
  .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
  .s-label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .s-value { font-size: 13px; font-weight: bold; margin-top: 2px; }
  .ledger-table { width: 100%; border-collapse: collapse; }
  .ledger-table thead { display: table-header-group; }
  .ledger-table th { background: #4f46e5; color: #fff; font-size: 8.5px; text-transform: uppercase; padding: 6px 8px; text-align: left; }
  .ledger-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9.5px; }
  .ledger-table tr { page-break-inside: avoid; }
  .right { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .debit { color: #dc2626; }
  .credit { color: #16a34a; }
  .empty-note { color: #94a3b8; text-align: center; padding: 24px 0; }
</style>
</head>
<body>
  ${showCover ? `
  <div class="cover">
    <h1>${esc(co.name || "Company")}</h1>
    <h2>Customer Ledger Report</h2>
    <p>Generated on ${esc(generatedDate)}</p>
    <p>Total Customers: ${customerCount}</p>
    <div class="rule"></div>
    ${co.address ? `<p>${esc(co.address)}${co.city ? ", " + esc(co.city) : ""}</p>` : ""}
    ${co.gstin ? `<p>GSTIN: ${esc(co.gstin)}</p>` : ""}
  </div>` : ""}
  ${sections.join("")}
</body>
</html>`;
}

async function renderPdf(html) {
    // --disable-dev-shm-usage matters here specifically: this endpoint can render a much
    // larger document (many customers, many transaction rows) than the existing single-invoice
    // PDF route, and Docker's default /dev/shm (~64MB) is too small for Chrome to use its normal
    // shared-memory path at that size — it needs to fall back to disk instead, or it crashes.
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    try {
        const page = await browser.newPage();
        // "load" (not "networkidle0") — this HTML is fully self-contained (inline CSS, no
        // images/fonts/external requests), and networkidle0 can hang indefinitely on
        // page.setContent() for larger documents when there's no real network activity
        // to go idle from.
        await page.setContent(html, { waitUntil: "load", timeout: 60000 });
        return await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" } });
    } finally {
        await browser.close();
    }
}

// GET /api/customer-ledgers/export-all-pdf — combined PDF, one section per customer
router.get("/export-all-pdf", authMiddleware, async (req, res) => {
    try {
        const role = req.user?.role?.toLowerCase();
        if (!["admin", "superadmin"].includes(role)) {
            return res.status(403).json({ error: "Admin only." });
        }

        const companyId = req.user.active_company_id;
        const customers = await db.pgAll(
            `SELECT id, username, nickname FROM users
             WHERE company_id = $1 AND role IN ('user', 'customer') AND is_active = true
               AND LOWER(username) <> 'admin'
             ORDER BY COALESCE(nickname, username) ASC`,
            [companyId]
        );

        const co = await resolveCompanyBranding(companyId);
        const generatedDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

        const sections = [];
        for (const customer of customers) {
            const statement = await buildCustomerLedgerStatement(companyId, customer.id);
            if (!statement) continue;
            sections.push(renderCustomerSection(statement.customer, statement.summary, statement.transactions, sections.length === 0));
        }

        const html = sections.length === 0
            ? `<!DOCTYPE html><html><body style="font-family:Helvetica;padding:60px;text-align:center;color:#94a3b8;">No customers found.</body></html>`
            : renderDocumentHTML(co, sections, { showCover: true, generatedDate, customerCount: customers.length });

        const pdfBuffer = await renderPdf(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="all-customer-ledgers-${new Date().toISOString().split("T")[0]}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error("Export all ledgers PDF error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    }
});

// GET /api/customer-ledgers/:id/pdf — single customer's ledger
router.get("/:id/pdf", authMiddleware, checkPermission("Sales", "view_invoices"), async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const statement = await buildCustomerLedgerStatement(companyId, Number(req.params.id));
        if (!statement) return res.status(404).json({ error: "Customer not found" });

        const co = await resolveCompanyBranding(companyId);
        const section = renderCustomerSection(statement.customer, statement.summary, statement.transactions, true);
        const html = renderDocumentHTML(co, [section], { showCover: false });

        const pdfBuffer = await renderPdf(html);
        const safeName = (statement.customer.name || "customer").replace(/[^a-z0-9]+/gi, "-");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}-ledger.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error("Single ledger PDF error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    }
});

export default router;
