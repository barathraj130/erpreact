// frontend/src/utils/expenseReceiptPrint.ts
//
// A printable payment voucher/receipt for a single expense entry — the
// paper proof that cash/bank money left the company for a specific
// purpose, handed to whoever received the payment (or filed for audit).
// Reuses the same client-side print pattern as deliveryChallanPrint.ts
// and the auto-generated ink-stamp seal from that file (no blank space
// waiting for a physical stamp).
import { fetchProfile } from "../api/companyApi";

interface ExpenseForReceipt {
  reference_number: string;
  expense_date: string;
  category_label: string;
  sub_category: string;
  amount: string | number;
  payment_mode: string;
  paid_to: string;
  contact_phone?: string | null;
  description: string;
  receipt_number?: string | null;
  status: string;
  recorded_by_name?: string | null;
  approved_by_name?: string | null;
}

const escapeHtml = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: string) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtMoney = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigitsToWords(n: number): string {
  if (n < 100) return twoDigitsToWords(n);
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigitsToWords(n % 100) : "");
}

// Indian numbering system: crore / lakh / thousand.
function amountToWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(threeDigitsToWords(crore) + " Crore");
  if (lakh) parts.push(threeDigitsToWords(lakh) + " Lakh");
  if (thousand) parts.push(threeDigitsToWords(thousand) + " Thousand");
  if (hundred) parts.push(threeDigitsToWords(hundred));

  let words = (parts.join(" ") || "Zero") + " Rupees";
  if (paise) words += " and " + twoDigitsToWords(paise) + " Paise";
  return words + " Only";
}

export async function printExpenseReceipt(expense: ExpenseForReceipt) {
  let companyName = "Company Name";
  let addressLine = "";
  let phone = "";
  try {
    const p = await fetchProfile();
    addressLine = [p.address_line1, p.city_pincode, p.state].filter(Boolean).join(", ");
    companyName = p.company_name || companyName;
    phone = p.phone || "";
  } catch {
    // Best-effort — print with a blank header rather than failing entirely.
  }

  const amount = Number(expense.amount) || 0;
  const modeLabel = (expense.payment_mode || "").toUpperCase();

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt ${escapeHtml(expense.reference_number)}</title>
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
  .amount-box { border: 2px solid #000; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; background: #f8f8f8; }
  .amount-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; }
  .amount-value { font-size: 26px; font-weight: 900; color: #b91c1c; }
  .amount-words { font-size: 11.5px; font-style: italic; color: #333; margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 12px; margin-top: 4px; }
  .desc-box { border: 1px solid #ccc; border-radius: 6px; padding: 12px 14px; font-size: 12.5px; color: #333; margin-bottom: 20px; min-height: 40px; }
  .status-approved { color: #16a34a; }
  .status-pending { color: #b45309; }
  .declaration { font-size: 11.5px; color: #333; margin-bottom: 36px; line-height: 1.6; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 12px; align-items: end; }
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
      ${phone ? `<div class="company-sub">Ph: ${escapeHtml(phone)}</div>` : ""}
    </div>
    <div class="title-block">
      <div class="title">Payment Receipt</div>
      <div class="title-sub">Ref: ${escapeHtml(expense.reference_number)}</div>
      <div class="title-sub">Date: ${fmtDate(expense.expense_date)}</div>
    </div>
  </div>

  <div class="meta-row">
    <div>
      <div class="meta-label">Paid To</div>
      <div class="meta-value">${escapeHtml(expense.paid_to || "-")}</div>
    </div>
    <div>
      <div class="meta-label">Category</div>
      <div class="meta-value">${escapeHtml(expense.category_label || "-")} — ${escapeHtml(expense.sub_category || "-")}</div>
    </div>
    <div>
      <div class="meta-label">Payment Mode</div>
      <div class="meta-value">${escapeHtml(modeLabel || "-")}</div>
    </div>
  </div>
  ${expense.contact_phone || expense.receipt_number ? `
  <div class="meta-row">
    ${expense.contact_phone ? `<div><div class="meta-label">Contact</div><div class="meta-value">${escapeHtml(expense.contact_phone)}</div></div>` : "<div></div>"}
    ${expense.receipt_number ? `<div><div class="meta-label">Bill / Receipt No.</div><div class="meta-value">${escapeHtml(expense.receipt_number)}</div></div>` : "<div></div>"}
    <div>
      <div class="meta-label">Status</div>
      <div class="meta-value ${expense.status === "pending" ? "status-pending" : "status-approved"}">${escapeHtml((expense.status || "").toUpperCase())}</div>
    </div>
  </div>` : ""}

  <div class="amount-box">
    <div class="amount-label">Amount Paid</div>
    <div class="amount-value">${fmtMoney(amount)}</div>
  </div>
  <div class="amount-words">Rupees in words: ${escapeHtml(amountToWords(amount))}</div>

  <div class="section-title">Particulars / Description</div>
  <div class="desc-box">${escapeHtml(expense.description || "-")}</div>

  <div class="declaration">
    Received the above sum of <strong>${fmtMoney(amount)}</strong> from <strong>${escapeHtml(companyName)}</strong>
    towards the purpose described above, in full and final settlement of this claim.
  </div>

  <div class="signature-row">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Paid By</div></div>
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
          <text x="60" y="58" font-size="10" font-weight="800" fill="#1d4ed8" text-anchor="middle">PAID</text>
          <text x="60" y="70" font-size="8" font-weight="600" fill="#1d4ed8" text-anchor="middle">${fmtDate(expense.expense_date)}</text>
        </svg>
      </div>
      <div class="signature-label">${escapeHtml(companyName)}</div>
    </div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Received By</div></div>
  </div>

  <div class="footer-note">
    Recorded by ${escapeHtml(expense.recorded_by_name || "-")}${expense.approved_by_name ? ` · Approved by ${escapeHtml(expense.approved_by_name)}` : ""} · This is a system-generated receipt from ${escapeHtml(companyName)}'s ERP.
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=794,height=1123");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
