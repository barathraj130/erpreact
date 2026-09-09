import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../utils/api";
import { fetchProfile } from "../../../api/companyApi";
import "../../../styles/neo-neu-motion.css";

export interface FormMeta {
  id: string;
  title: string;
  tamil: string;
  icon: string;
  color: string;
  desc: string;
}

export const FORMS: FormMeta[] = [
  { id: "leave_request", title: "Leave Request Form", tamil: "விடுப்பு கோரிக்கை படிவம்", icon: "🏖️", color: "#F59E0B", desc: "For requesting casual, sick, or earned leave" },
  { id: "advance_request", title: "Salary Advance Request", tamil: "சம்பள முன்பணம் கோரிக்கை", icon: "💰", color: "#10B981", desc: "For requesting advance payment from salary" },
  { id: "expense_claim", title: "Expense Claim Form", tamil: "செலவு கோரிக்கை படிவம்", icon: "🧾", color: "#5B4BFF", desc: "For claiming work-related expenses" },
  { id: "complaint", title: "Complaint Form", tamil: "புகார் படிவம்", icon: "📢", color: "#EF4444", desc: "For raising a workplace complaint" },
  { id: "suggestion", title: "Suggestion Form", tamil: "ஆலோசனை படிவம்", icon: "💡", color: "#8B5CF6", desc: "For submitting improvement suggestions" },
  { id: "overtime_request", title: "Overtime Request", tamil: "கூடுதல் நேர கோரிக்கை", icon: "⏰", color: "#06B6D4", desc: "For requesting overtime approval" },
  { id: "work_from_home", title: "Work From Home Request", tamil: "வீட்டிலிருந்து பணி கோரிக்கை", icon: "🏠", color: "#F97316", desc: "For requesting work from home permission" },
  { id: "asset_request", title: "Asset Request Form", tamil: "சொத்து கோரிக்கை படிவம்", icon: "💼", color: "#64748B", desc: "For requesting company equipment or assets" },
];

interface FormDef { title: string; tamil: string; fields: string; }

const FORM_FIELD_DEFS: Record<string, FormDef> = {
  leave_request: {
    title: "Leave Request Form",
    tamil: "விடுப்பு கோரிக்கை படிவம்",
    fields: `
      <div class="section-title">Leave Details / விடுப்பு விவரங்கள்</div>
      <div class="field-group">
        <div class="field-label">Type of Leave / விடுப்பு வகை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Casual Leave / சாதாரண விடுப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Sick Leave / நோய் விடுப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Earned Leave / ஈட்டிய விடுப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Unpaid Leave / ஊதியமற்ற விடுப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">From Date / தொடக்க தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">To Date / முடிவு தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Total Days / மொத்த நாட்கள்</div><div class="field-line"></div></div>
      </div>
      <div class="field-group">
        <div class="field-label">Reason for Leave / விடுப்பு காரணம்</div>
        <div class="field-label-tamil">(விளக்கமாக எழுதவும் — Write clearly)</div>
        <div class="field-textarea"></div>
      </div>
      <div class="field-group"><div class="field-label">Contact During Leave / விடுப்பில் தொடர்பு எண்</div><div class="field-line"></div></div>
      <div class="field-group"><div class="field-label">Work Handover to / பணி ஒப்படைக்கப்படும் நபர்</div><div class="field-line"></div></div>
    `,
  },
  advance_request: {
    title: "Salary Advance Request",
    tamil: "சம்பள முன்பணம் கோரிக்கை",
    fields: `
      <div class="section-title">Advance Details / முன்பணம் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Amount Requested / கோரும் தொகை (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Required By Date / தேவைப்படும் தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Current Salary / தற்போதைய சம்பளம் (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="field-group">
        <div class="field-label">Reason / காரணம்</div>
        <div class="field-label-tamil">(விளக்கமாக எழுதவும்)</div>
        <div class="field-textarea"></div>
      </div>
      <div class="field-group">
        <div class="field-label">Repayment Method / திரும்ப செலுத்தும் முறை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Deduct from Salary / சம்பளத்திலிருந்து கழிக்கவும்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Cash Return / பணமாக திரும்ப</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Repay in How Many Months / எத்தனை மாதத்தில் திரும்ப</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Monthly Deduction Amount / மாதாந்திர கழிவு தொகை (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Previous Advance Balance / முந்தைய முன்பண நிலுவை (₹)</div><div class="field-line"></div></div>
      </div>
    `,
  },
  expense_claim: {
    title: "Expense Claim Form",
    tamil: "செலவு கோரிக்கை படிவம்",
    fields: `
      <div class="section-title">Expense Details / செலவு விவரங்கள்</div>
      <div class="field-group">
        <div class="field-label">Expense Type / செலவு வகை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Travel / பயணம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Food / உணவு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Communication / தொடர்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Stationery / பேனா தாள்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="border:1.5px solid #000; padding:6px; text-align:left;">Date / தேதி</th>
            <th style="border:1.5px solid #000; padding:6px; text-align:left;">Description / விவரம்</th>
            <th style="border:1.5px solid #000; padding:6px; text-align:left;">Bill No.</th>
            <th style="border:1.5px solid #000; padding:6px; text-align:right;">Amount / தொகை (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${Array(5).fill(`
            <tr>
              <td style="border:1.5px solid #000; padding:18px 6px;"></td>
              <td style="border:1.5px solid #000; padding:18px 6px;"></td>
              <td style="border:1.5px solid #000; padding:18px 6px;"></td>
              <td style="border:1.5px solid #000; padding:18px 6px;"></td>
            </tr>
          `).join("")}
          <tr style="background:#f0f0f0;">
            <td colspan="3" style="border:1.5px solid #000; padding:8px 6px; font-weight:800; text-align:right;">TOTAL / மொத்தம்</td>
            <td style="border:1.5px solid #000; padding:8px 6px;"></td>
          </tr>
        </tbody>
      </table>
      <div class="field-group">
        <div class="field-label">Bill / Receipt Available / ரசீது உள்ளதா</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Yes / ஆம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> No / இல்லை</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Purpose / நோக்கம்</div><div class="field-textarea"></div></div>
    `,
  },
  complaint: {
    title: "Complaint Form",
    tamil: "புகார் படிவம்",
    fields: `
      <div class="section-title">Complaint Details / புகார் விவரங்கள்</div>
      <div class="field-group">
        <div class="field-label">Complaint Category / புகார் வகை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Salary Issue / சம்பள பிரச்சனை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Work Conditions / பணி சூழல்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Management / நிர்வாகம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Harassment / தொல்லை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Date of Incident / நிகழ்வு தேதி</div><div class="field-line"></div></div>
      <div class="field-group">
        <div class="field-label">Description of Complaint / புகாரின் விவரம்</div>
        <div class="field-label-tamil">(தெளிவாக விளக்கமாக எழுதவும்)</div>
        <div class="field-textarea" style="height:96px;"></div>
      </div>
      <div class="field-group"><div class="field-label">Persons Involved / சம்பந்தப்பட்டவர்கள்</div><div class="field-line"></div></div>
      <div class="field-group"><div class="field-label">Witnesses / சாட்சிகள் (if any / யாரேனும் இருந்தால்)</div><div class="field-line"></div></div>
      <div class="field-group">
        <div class="field-label">Anonymous Submission / பெயர் தெரியாமல் சமர்ப்பிக்கவுமா</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Yes — Keep my name confidential / ஆம் — பெயர் ரகசியமாக வையுங்கள்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> No — I agree to be identified / இல்லை</div>
        </div>
      </div>
    `,
  },
  suggestion: {
    title: "Suggestion Form",
    tamil: "ஆலோசனை படிவம்",
    fields: `
      <div class="section-title">Suggestion Details / ஆலோசனை விவரங்கள்</div>
      <div class="field-group"><div class="field-label">Suggestion Title / ஆலோசனை தலைப்பு</div><div class="field-line"></div></div>
      <div class="field-group">
        <div class="field-label">Which Area / எந்த பிரிவில்</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Work Process / பணி முறை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Safety / பாதுகாப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Customer Service / வாடிக்கையாளர் சேவை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Cost Saving / செலவு குறைப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Current Problem / தற்போதுள்ள பிரச்சனை</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">My Suggestion / என் ஆலோசனை</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">Expected Benefit / எதிர்பார்க்கும் பயன்</div><div class="field-textarea"></div></div>
    `,
  },
  overtime_request: {
    title: "Overtime Request Form",
    tamil: "கூடுதல் நேர கோரிக்கை படிவம்",
    fields: `
      <div class="section-title">Overtime Details / கூடுதல் நேர விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Date / தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Normal End Time / வழக்கமான முடிவு நேரம்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Overtime Until / கூடுதல் நேரம் வரை</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Total OT Hours / மொத்த கூடுதல் நேரம்</div><div class="field-line"></div></div>
        <div class="field-group">
          <div class="field-label">OT Type / கூடுதல் நேர வகை</div>
          <div class="checkbox-row" style="flex-direction:column; gap:6px;">
            <div class="checkbox-item"><div class="checkbox-box"></div> Regular OT</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Holiday OT</div>
          </div>
        </div>
        <div class="field-group"><div class="field-label">OT Amount (₹) / கூடுதல் நேர தொகை</div><div class="field-line"></div></div>
      </div>
      <div class="field-group"><div class="field-label">Reason / காரணம்</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">Work Done During OT / கூடுதல் நேரத்தில் செய்த பணி</div><div class="field-textarea"></div></div>
    `,
  },
  work_from_home: {
    title: "Work From Home Request",
    tamil: "வீட்டிலிருந்து பணி கோரிக்கை",
    fields: `
      <div class="section-title">WFH Details / வீட்டிலிருந்து பணி விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">From Date / தொடக்க தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">To Date / முடிவு தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Total Days / மொத்த நாட்கள்</div><div class="field-line"></div></div>
      </div>
      <div class="field-group"><div class="field-label">Reason for WFH / வீட்டிலிருந்து பணி காரணம்</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">Tasks to be completed / செய்யப்படும் பணிகள்</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">Contact Number During WFH / WFH நேரத்தில் தொடர்பு எண்</div><div class="field-line"></div></div>
    `,
  },
  asset_request: {
    title: "Asset Request Form",
    tamil: "சொத்து கோரிக்கை படிவம்",
    fields: `
      <div class="section-title">Asset Details / சொத்து விவரங்கள்</div>
      <div class="field-group">
        <div class="field-label">Asset Type / சொத்து வகை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Mobile Phone</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Laptop / Computer</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Vehicle / வாகனம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Tools / கருவிகள்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Uniform / சீருடை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Asset Name / சொத்தின் பெயர்</div><div class="field-line"></div></div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Quantity / எண்ணிக்கை</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Required By / தேவைப்படும் தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Estimated Cost / மதிப்பிடப்பட்ட செலவு (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="field-group"><div class="field-label">Purpose / நோக்கம்</div><div class="field-textarea"></div></div>
    `,
  },
};

export const getFormDefinition = (formId: string): FormDef => FORM_FIELD_DEFS[formId] || FORM_FIELD_DEFS.leave_request;

interface CompanyHeader { name: string; addressLine: string; }

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const generatePrintHTML = (form: FormDef, company: CompanyHeader) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${form.title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Sans Tamil', 'Arial', sans-serif; background: white; color: #000; padding: 32px; max-width: 794px; margin: 0 auto; }
  .form-header { border: 3px solid #000; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: #333; margin-top: 2px; }
  .form-title-block { text-align: right; }
  .form-title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .form-title-tamil { font-size: 13px; color: #333; margin-top: 3px; }
  .form-number { font-size: 10px; color: #666; margin-top: 4px; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .field-group { margin-bottom: 14px; }
  .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-bottom: 4px; }
  .field-label-tamil { font-size: 10px; color: #555; margin-bottom: 4px; display: block; }
  .field-line { border: none; border-bottom: 1.5px solid #000; width: 100%; height: 28px; display: block; }
  .field-box { border: 1.5px solid #000; width: 100%; height: 32px; display: block; }
  .field-textarea { border: 1.5px solid #000; width: 100%; height: 72px; display: block; }
  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 12px; margin-top: 18px; }
  .checkbox-row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 12px; }
  .checkbox-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .checkbox-box { width: 14px; height: 14px; border: 1.5px solid #000; display: inline-block; flex-shrink: 0; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 32px; }
  .signature-block { text-align: center; }
  .signature-line { border-top: 1.5px solid #000; margin-bottom: 6px; padding-top: 48px; }
  .signature-label { font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .signature-label-tamil { font-size: 10px; color: #555; margin-top: 2px; }
  .instructions { background: #f5f5f5; border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 16px; font-size: 10px; color: #333; }
  @media print { body { padding: 20px; } .no-print { display: none; } @page { size: A4; margin: 15mm; } }
</style>
</head>
<body>
  <div class="form-header">
    <div>
      <div class="company-name">${escapeHtml(company.name)}</div>
      ${company.addressLine ? `<div class="company-sub">${escapeHtml(company.addressLine)}</div>` : ""}
    </div>
    <div class="form-title-block">
      <div class="form-title">${form.title}</div>
      <div class="form-title-tamil">${form.tamil}</div>
      <div class="form-number">Form No: _______ &nbsp; Date: ___________</div>
    </div>
  </div>
  <div class="instructions">
    <strong>Instructions / வழிமுறைகள்:</strong> Please fill all fields clearly in capital letters. Submit this form to your supervisor or admin.
    அனைத்து தகவல்களையும் தெளிவாக பெரிய எழுத்துக்களில் நிரப்பவும். இந்த படிவத்தை உங்கள் மேற்பார்வையாளரிடம் சமர்ப்பிக்கவும்.
  </div>
  <div class="section-title">Employee Details / பணியாளர் விவரங்கள்</div>
  <div class="meta-row">
    <div class="field-group"><div class="field-label">Employee Name</div><div class="field-label-tamil">பணியாளர் பெயர்</div><div class="field-line"></div></div>
    <div class="field-group"><div class="field-label">Employee ID</div><div class="field-label-tamil">பணியாளர் எண்</div><div class="field-line"></div></div>
    <div class="field-group"><div class="field-label">Department / Branch</div><div class="field-label-tamil">பிரிவு / கிளை</div><div class="field-line"></div></div>
  </div>
  <div class="meta-row">
    <div class="field-group"><div class="field-label">Phone Number</div><div class="field-label-tamil">தொலைபேசி எண்</div><div class="field-line"></div></div>
    <div class="field-group"><div class="field-label">Date of Submission</div><div class="field-label-tamil">சமர்ப்பிக்கும் தேதி</div><div class="field-line"></div></div>
    <div class="field-group"><div class="field-label">Designation</div><div class="field-label-tamil">பதவி</div><div class="field-line"></div></div>
  </div>
  ${form.fields}
  <div class="signature-row">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Employee Signature</div><div class="signature-label-tamil">பணியாளர் கையொப்பம்</div></div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Supervisor</div><div class="signature-label-tamil">மேற்பார்வையாளர்</div></div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Admin Approval</div><div class="signature-label-tamil">நிர்வாக ஒப்புதல்</div></div>
  </div>
  <div style="margin-top:24px; border-top:1px dashed #999; padding-top:12px; font-size:9px; color:#666; text-align:center">
    For office use only / அலுவலக பயன்பாட்டிற்கு மட்டும் · Entered in ERP: _______ · Entered by: _______ · Date: _______
  </div>
</body>
</html>
`;

const HRFormsPrint: React.FC = () => {
  const navigate = useNavigate();
  const [todayCount, setTodayCount] = useState(0);
  const [company, setCompany] = useState<CompanyHeader>({ name: "Company Name", addressLine: "" });

  useEffect(() => {
    apiFetch("/hub/forms?view=inbox")
      .then((r) => r.json())
      .then((forms: any[]) => {
        const today = new Date().toDateString();
        const count = (Array.isArray(forms) ? forms : []).filter(
          (f) => f.form_data?.entered_from_paper_form && new Date(f.created_at).toDateString() === today
        ).length;
        setTodayCount(count);
      })
      .catch(() => {});

    fetchProfile()
      .then((p) => {
        const addressLine = [p.address_line1, p.city_pincode, p.state].filter(Boolean).join(", ");
        setCompany({ name: p.company_name || "Company Name", addressLine });
      })
      .catch(() => {});
  }, []);

  const printForm = (formId: string) => {
    const form = getFormDefinition(formId);
    const printWindow = window.open("", "_blank", "width=794,height=1123");
    if (!printWindow) { alert("Please allow popups to print."); return; }
    printWindow.document.write(generatePrintHTML(form, company));
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">🖨️ Print HR Forms</h1>
          <p className="neo-page-sub">For employees without smartphones — print blank forms, collect filled forms, enter data on their behalf.</p>
        </div>
        <div className="neo-page-actions">
          {todayCount > 0 && (
            <span className="neo-badge neo-badge-success">📋 {todayCount} entered today</span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
        {FORMS.map((form) => (
          <div key={form.id} className="neu-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{form.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--neu-text-primary)", marginBottom: 2 }}>{form.title}</div>
            <div style={{ fontSize: 11, color: "var(--neu-text-secondary)", marginBottom: 10 }}>{form.tamil}</div>
            <div style={{ fontSize: 10, color: "var(--neu-text-muted)", marginBottom: 14, minHeight: 28 }}>{form.desc}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => printForm(form.id)} className="neo-btn-primary neo-btn-sm" style={{ flex: 1, background: form.color, boxShadow: `2px 2px 0px #000` }}>
                🖨️ Print
              </button>
              <button onClick={() => navigate(`/admin/hr-forms/entry?form=${form.id}`)} className="neo-btn-secondary neo-btn-sm" style={{ flex: 1 }}>
                ✏️ Enter Data
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HRFormsPrint;
