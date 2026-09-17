// frontend/src/utils/hubFormPrint.ts
//
// Printable FILLED version of a submitted HR Form / Team Hub request —
// distinct from HRFormsPrint.tsx, which only ever prints a blank paper
// form for someone to fill in by hand. This prints what was actually
// submitted: every field in form_data as a label/value grid (generic
// across all 16+ form types, so a new form type never needs its own
// template here), plus who submitted it, to whom, and the approval
// outcome. Reuses the same client-side print pattern and auto-generated
// company seal already used elsewhere (Delivery Challan, Purchase Bill,
// Expense Receipt).
import { fetchProfile } from "../api/companyApi";
import { FORMS } from "../pages/admin/hrforms/HRFormsPrint";

interface FilledForm {
  form_type: string;
  status: string;
  form_data: Record<string, any>;
  response?: string | null;
  submitted_by_name?: string;
  submitted_to_name?: string;
  responded_by_name?: string;
  created_at: string;
  responded_at?: string | null;
}

const escapeHtml = (s: string) =>
  (s ?? "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtDateTime = (d?: string | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const prettifyKey = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const prettifyValue = (val: any): string => {
  if (val === null || val === undefined || val === "") return "-";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
};

const STATUS_LABEL: Record<string, string> = {
  pending: "PENDING",
  under_review: "UNDER REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#b45309",
  under_review: "#0891b2",
  approved: "#16a34a",
  rejected: "#dc2626",
  cancelled: "#64748b",
};

export async function printFilledHubForm(form: FilledForm) {
  let companyName = "Company Name";
  let addressLine = "";
  try {
    const p = await fetchProfile();
    addressLine = [p.address_line1, p.city_pincode, p.state].filter(Boolean).join(", ");
    companyName = p.company_name || companyName;
  } catch {
    // Best-effort — print with a blank header rather than failing entirely.
  }

  const meta = FORMS.find((f) => f.id === form.form_type);
  const title = meta?.title || prettifyKey(form.form_type) + " Form";
  const tamil = meta?.tamil || "";

  const fieldRows = Object.entries(form.form_data || {})
    .filter(([k]) => k !== "send_to_id" && k !== "entered_from_paper_form")
    .map(([k, v]) => `
      <div class="field">
        <div class="field-label">${escapeHtml(prettifyKey(k))}</div>
        <div class="field-value">${escapeHtml(prettifyValue(v))}</div>
      </div>`).join("");

  const statusKey = (form.status || "pending").toLowerCase();

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Arial', sans-serif; background: white; color: #000; padding: 32px; max-width: 794px; margin: 0 auto; }
  .header { border: 3px solid #000; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: #333; margin-top: 2px; }
  .title-block { text-align: right; }
  .title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .title-tamil { font-size: 12px; color: #333; margin-top: 2px; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-bottom: 4px; }
  .meta-value { font-size: 13px; font-weight: 600; }
  .status-value { font-size: 13px; font-weight: 800; }
  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 14px; margin-top: 6px; }
  .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; margin-bottom: 20px; }
  .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; margin-bottom: 3px; }
  .field-value { font-size: 13px; font-weight: 600; border-bottom: 1px solid #ccc; padding-bottom: 4px; min-height: 18px; word-break: break-word; }
  .response-box { border: 1px solid #ccc; border-radius: 6px; padding: 12px 14px; font-size: 12.5px; color: #333; margin-bottom: 20px; background: #f8f8f8; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 32px; align-items: end; }
  .signature-block { text-align: center; }
  .signature-line { border-top: 1.5px solid #000; margin-bottom: 6px; padding-top: 48px; }
  .signature-label { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .seal-stamp { height: 84px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; transform: rotate(-7deg); }
  .footer-note { margin-top: 24px; font-size: 9px; color: #666; text-align: center; }
  @media print { body { padding: 20px; } @page { size: A4; margin: 15mm; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${escapeHtml(companyName)}</div>
      ${addressLine ? `<div class="company-sub">${escapeHtml(addressLine)}</div>` : ""}
    </div>
    <div class="title-block">
      <div class="title">${escapeHtml(title)}</div>
      ${tamil ? `<div class="title-tamil">${escapeHtml(tamil)}</div>` : ""}
    </div>
  </div>

  <div class="meta-row">
    <div>
      <div class="meta-label">Submitted By</div>
      <div class="meta-value">${escapeHtml(form.submitted_by_name || "-")}</div>
    </div>
    <div>
      <div class="meta-label">Sent To</div>
      <div class="meta-value">${escapeHtml(form.submitted_to_name || "-")}</div>
    </div>
    <div>
      <div class="meta-label">Status</div>
      <div class="status-value" style="color:${STATUS_COLOR[statusKey] || "#333"};">${escapeHtml(STATUS_LABEL[statusKey] || form.status.toUpperCase())}</div>
    </div>
  </div>
  <div class="meta-row">
    <div>
      <div class="meta-label">Submitted On</div>
      <div class="meta-value">${fmtDateTime(form.created_at)}</div>
    </div>
    ${form.responded_by_name ? `<div><div class="meta-label">Decided By</div><div class="meta-value">${escapeHtml(form.responded_by_name)}</div></div>` : "<div></div>"}
    ${form.responded_at ? `<div><div class="meta-label">Decided On</div><div class="meta-value">${fmtDateTime(form.responded_at)}</div></div>` : "<div></div>"}
  </div>

  <div class="section-title">Submitted Details</div>
  <div class="fields-grid">${fieldRows || `<div class="field-value" style="grid-column:1/-1;">No details recorded.</div>`}</div>

  ${form.response ? `
  <div class="section-title">Response</div>
  <div class="response-box">${escapeHtml(form.response)}</div>` : ""}

  <div class="signature-row">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Employee Signature</div></div>
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
          <text x="60" y="58" font-size="10" font-weight="800" fill="#1d4ed8" text-anchor="middle">${escapeHtml((STATUS_LABEL[statusKey] || "RECORDED").slice(0, 10))}</text>
          <text x="60" y="70" font-size="8" font-weight="600" fill="#1d4ed8" text-anchor="middle">${fmtDate(form.responded_at || form.created_at)}</text>
        </svg>
      </div>
      <div class="signature-label">${escapeHtml(companyName)}</div>
    </div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Admin Approval</div></div>
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
