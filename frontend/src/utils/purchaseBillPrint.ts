// frontend/src/utils/purchaseBillPrint.ts
//
// Printable record of a purchase bill — company header, supplier, items or
// expenses, totals and payment status. Reuses the same client-side print
// pattern (window.open + document.write + print()) and auto-generated
// company seal already used for the Delivery Challan and Expense Receipt,
// rather than adding a backend PDF route.
import { fetchProfile } from "../api/companyApi";

interface PrintItem { product_name?: string; description?: string; hsn_code?: string | null; quantity: number; unit?: string; unit_price: number; tax_percent?: number; line_total?: number; }
interface PrintExpense { expense_type?: string; description?: string; tax_percent?: number; amount: number; total_amount?: number; }

interface BillForPrint {
  bill_number: string;
  bill_date: string;
  supplier_name?: string | null;
  bill_category?: string | null;
  total_amount: number | string;
  paid_amount?: number | string;
  balance_amount?: number | string;
  status?: string | null;
  notes?: string | null;
}

const escapeHtml = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: string) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtMoney = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export async function printPurchaseBill(bill: BillForPrint, items: PrintItem[], expenses: PrintExpense[]) {
  let companyName = "Company Name";
  let addressLine = "";
  try {
    const p = await fetchProfile();
    addressLine = [p.address_line1, p.city_pincode, p.state].filter(Boolean).join(", ");
    companyName = p.company_name || companyName;
  } catch {
    // Best-effort — print with a blank header rather than failing entirely.
  }

  const isExpense = (bill.bill_category || "").toUpperCase() === "EXPENSE";
  const total = Number(bill.total_amount) || 0;
  const paid = Number(bill.paid_amount) || 0;
  const balance = Number(bill.balance_amount ?? (total - paid));

  const rowsHtml = isExpense
    ? expenses.map((e, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(e.expense_type || "Expense")}</td>
        <td>${escapeHtml(e.description || "-")}</td>
        <td class="text-center">${e.tax_percent || 0}%</td>
        <td class="text-right">${fmtMoney(Number(e.total_amount ?? e.amount))}</td>
      </tr>`).join("")
    : items.map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(it.product_name || it.description || `Item #${idx + 1}`)}</td>
        <td>${escapeHtml(it.hsn_code || "-")}</td>
        <td class="text-center">${Number(it.quantity).toLocaleString("en-IN")} ${escapeHtml(it.unit || "")}</td>
        <td class="text-right">${fmtMoney(Number(it.unit_price))}</td>
        <td class="text-center">${it.tax_percent || 0}%</td>
        <td class="text-right">${fmtMoney(Number(it.line_total ?? (it.quantity * it.unit_price)))}</td>
      </tr>`).join("");

  const headCols = isExpense
    ? `<th style="width:32px;">#</th><th>Expense Type</th><th>Description</th><th class="text-center">GST%</th><th class="text-right">Amount</th>`
    : `<th style="width:32px;">#</th><th>Product</th><th>HSN</th><th class="text-center">Qty</th><th class="text-right">Rate</th><th class="text-center">GST%</th><th class="text-right">Total</th>`;
  const colSpan = isExpense ? 4 : 6;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Purchase Bill ${escapeHtml(bill.bill_number)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Arial', sans-serif; background: white; color: #000; padding: 32px; max-width: 794px; margin: 0 auto; }
  .header { border: 3px solid #000; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: #333; margin-top: 2px; }
  .title-block { text-align: right; }
  .title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .title-sub { font-size: 10px; color: #666; margin-top: 2px; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-bottom: 4px; }
  .meta-value { font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { border: 1px solid #000; padding: 8px 10px; font-size: 12px; text-align: left; }
  th { background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  tfoot td { font-weight: 800; background: #f8f8f8; }
  .status-paid { color: #16a34a; }
  .status-partial { color: #b45309; }
  .status-pending { color: #b91c1c; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 48px; align-items: end; }
  .signature-block { text-align: center; }
  .signature-line { border-top: 1.5px solid #000; margin-bottom: 6px; padding-top: 48px; }
  .signature-label { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .seal-stamp { height: 84px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; transform: rotate(-7deg); }
  .footer-note { margin-top: 24px; font-size: 9px; color: #666; text-align: center; }
  @media print { body { padding: 20px; } .no-print { display: none; } @page { size: A4; margin: 15mm; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${escapeHtml(companyName)}</div>
      ${addressLine ? `<div class="company-sub">${escapeHtml(addressLine)}</div>` : ""}
    </div>
    <div class="title-block">
      <div class="title">Purchase Bill</div>
      <div class="title-sub">Ref: ${escapeHtml(bill.bill_number)}</div>
      <div class="title-sub">Date: ${fmtDate(bill.bill_date)}</div>
    </div>
  </div>

  <div class="meta-row">
    <div>
      <div class="meta-label">Supplier</div>
      <div class="meta-value">${escapeHtml(bill.supplier_name || "-")}</div>
    </div>
    <div>
      <div class="meta-label">Bill Category</div>
      <div class="meta-value">${isExpense ? "Expense Bill" : "Product Bill"}</div>
    </div>
    <div>
      <div class="meta-label">Status</div>
      <div class="meta-value ${balance <= 0 ? "status-paid" : paid > 0 ? "status-partial" : "status-pending"}">${escapeHtml((bill.status || (balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING")).toUpperCase())}</div>
    </div>
  </div>

  ${bill.notes ? `<div class="meta-row"><div style="grid-column:1/-1;"><div class="meta-label">Items Entered</div><div class="meta-value" style="font-weight:500;">${escapeHtml(bill.notes)}</div></div></div>` : ""}

  <table>
    <thead><tr>${headCols}</tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="${colSpan + 1}" style="text-align:center;color:#666;">No line items</td></tr>`}</tbody>
    <tfoot>
      <tr><td colspan="${colSpan}" style="text-align:right;">TOTAL</td><td class="text-right">${fmtMoney(total)}</td></tr>
    </tfoot>
  </table>

  <div class="meta-row">
    <div>
      <div class="meta-label">Total Amount</div>
      <div class="meta-value">${fmtMoney(total)}</div>
    </div>
    <div>
      <div class="meta-label">Paid</div>
      <div class="meta-value" style="color:#16a34a;">${fmtMoney(paid)}</div>
    </div>
    <div>
      <div class="meta-label">Balance</div>
      <div class="meta-value" style="color:${balance > 0 ? "#b91c1c" : "#16a34a"};">${fmtMoney(Math.max(0, balance))}</div>
    </div>
  </div>

  <div class="signature-row">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Received By</div></div>
    <div class="signature-block">
      <div class="seal-stamp">
        <svg viewBox="0 0 120 120" width="92" height="92">
          <defs>
            <path id="sealTopCurve" d="M 12,64 A 48,48 0 0 1 108,64" fill="none" />
            <path id="sealBottomCurve" d="M 22,72 A 38,38 0 0 0 98,72" fill="none" />
          </defs>
          <circle cx="60" cy="60" r="53" fill="none" stroke="#1d4ed8" stroke-width="2.5" />
          <circle cx="60" cy="60" r="45" fill="none" stroke="#1d4ed8" stroke-width="1" />
          <text font-size="9.5" font-weight="700" letter-spacing="1.2" fill="#1d4ed8">
            <textPath href="#sealTopCurve" startOffset="50%" text-anchor="middle">${escapeHtml(companyName.toUpperCase())}</textPath>
          </text>
          <text font-size="7" font-weight="700" letter-spacing="1.5" fill="#1d4ed8">
            <textPath href="#sealBottomCurve" startOffset="50%" text-anchor="middle">AUTHORIZED SEAL</textPath>
          </text>
          <text x="60" y="58" font-size="10" font-weight="800" fill="#1d4ed8" text-anchor="middle">PURCHASED</text>
          <text x="60" y="70" font-size="8" font-weight="600" fill="#1d4ed8" text-anchor="middle">${fmtDate(bill.bill_date)}</text>
        </svg>
      </div>
      <div class="signature-label">${escapeHtml(companyName)}</div>
    </div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Approved By</div></div>
  </div>

  <div class="footer-note">This is a system-generated print from ${escapeHtml(companyName)}'s ERP.</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=794,height=1123");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
