// frontend/src/utils/monthlyStatementPrint.ts
//
// Printable version of the Monthly Statement — company header, period,
// In/Out/Net totals, and the full entry table. Same client-side print
// pattern (window.open + document.write + print()) already used for the
// Delivery Challan, Purchase Bill and Expense Receipt.
import { fetchProfile } from "../api/companyApi";

interface StatementEntry {
  id: number;
  ledger_type: "CASH" | "BANK";
  date: string;
  source: string;
  amount: number | string;
  direction: "in" | "out";
  notes?: string;
  party_name?: string;
}

const escapeHtml = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: string) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtMoney = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export async function printMonthlyStatement(
  entries: StatementEntry[],
  { startDate, endDate, totalIn, totalOut, openingBalance = 0 }: { startDate: string; endDate: string; totalIn: number; totalOut: number; openingBalance?: number }
) {
  // Open synchronously, before any await — once window.open() happens after an
  // awaited fetch it falls outside the click's user-activation window and
  // Chrome silently blocks it (no error, nothing visibly happens).
  const printWindow = window.open("", "_blank", "width=794,height=1123");
  if (printWindow) {
    printWindow.document.write("<p style=\"font-family:sans-serif;padding:24px;color:#64748b;\">Preparing statement…</p>");
  }

  let companyName = "Company Name";
  let addressLine = "";
  try {
    const p = await fetchProfile();
    addressLine = [p.address_line1, p.city_pincode, p.state].filter(Boolean).join(", ");
    companyName = p.company_name || companyName;
  } catch {
    // Best-effort — print with a blank header rather than failing entirely.
  }

  const closingBalance = openingBalance + totalIn - totalOut;

  const rowsHtml = entries.map(e => {
    const amt = Number(e.amount) || 0;
    return `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td>${escapeHtml(e.ledger_type)}</td>
        <td>${escapeHtml(e.source || "-")}</td>
        <td>${escapeHtml(e.party_name || "-")}</td>
        <td class="text-right" style="color:#16a34a;">${e.direction === "in" ? fmtMoney(amt) : "-"}</td>
        <td class="text-right" style="color:#b91c1c;">${e.direction === "out" ? fmtMoney(amt) : "-"}</td>
        <td style="font-size:10px;color:#555;">${escapeHtml(e.notes || "")}</td>
      </tr>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Monthly Statement ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Arial', sans-serif; background: white; color: #000; padding: 24px; max-width: 794px; margin: 0 auto; }
  .header { border: 3px solid #000; padding: 12px 18px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 19px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: #333; margin-top: 2px; }
  .title-block { text-align: right; }
  .title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .title-sub { font-size: 10px; color: #666; margin-top: 2px; }
  .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .summary-box { border: 1.5px solid #000; padding: 8px 12px; }
  .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-bottom: 3px; }
  .summary-value { font-size: 15px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { border: 1px solid #000; padding: 5px 7px; font-size: 10.5px; text-align: left; }
  th { background: #f1f1f1; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; }
  .text-right { text-align: right; }
  tfoot td { font-weight: 800; background: #f8f8f8; }
  .footer-note { margin-top: 14px; font-size: 9px; color: #666; text-align: center; }
  @media print { body { padding: 16px; } .no-print { display: none; } @page { size: A4; margin: 12mm; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${escapeHtml(companyName)}</div>
      ${addressLine ? `<div class="company-sub">${escapeHtml(addressLine)}</div>` : ""}
    </div>
    <div class="title-block">
      <div class="title">Monthly Statement</div>
      <div class="title-sub">${fmtDate(startDate)} to ${fmtDate(endDate)}</div>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-box">
      <div class="summary-label">Opening Balance</div>
      <div class="summary-value" style="color:${openingBalance >= 0 ? "#000" : "#b91c1c"};">${fmtMoney(openingBalance)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Total In</div>
      <div class="summary-value" style="color:#16a34a;">${fmtMoney(totalIn)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Total Out</div>
      <div class="summary-value" style="color:#b91c1c;">${fmtMoney(totalOut)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Closing Balance</div>
      <div class="summary-value" style="color:${closingBalance >= 0 ? "#16a34a" : "#b91c1c"};">${fmtMoney(closingBalance)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Date</th><th>Type</th><th>Source</th><th>Name</th><th class="text-right">In (+)</th><th class="text-right">Out (−)</th><th>Notes</th></tr>
    </thead>
    <tbody>
      <tr style="background:#f1f1f1;">
        <td colspan="6"><strong>Opening Balance (as of ${fmtDate(startDate)})</strong></td>
        <td class="text-right" style="font-weight:800;">${fmtMoney(openingBalance)}</td>
      </tr>
      ${rowsHtml || `<tr><td colspan="7" style="text-align:center;color:#666;">No movements for this period</td></tr>`}
    </tbody>
    <tfoot>
      <tr><td colspan="4" style="text-align:right;">TOTAL</td><td class="text-right" style="color:#16a34a;">${fmtMoney(totalIn)}</td><td class="text-right" style="color:#b91c1c;">${fmtMoney(totalOut)}</td><td></td></tr>
      <tr><td colspan="6" style="text-align:right;">CLOSING BALANCE</td><td class="text-right" style="color:${closingBalance >= 0 ? "#16a34a" : "#b91c1c"};">${fmtMoney(closingBalance)}</td></tr>
    </tfoot>
  </table>

  <div class="footer-note">This is a system-generated print from ${escapeHtml(companyName)}'s ERP.</div>
</body>
</html>`;

  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
