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
  category?: "employee" | "customer";
}

export const FORMS: FormMeta[] = [
  { id: "leave_request", title: "Leave Request Form", tamil: "விடுப்பு கோரிக்கை படிவம்", icon: "🏖️", color: "#F59E0B", desc: "For requesting casual, sick, or earned leave", category: "employee" },
  { id: "advance_request", title: "Salary Advance Request", tamil: "சம்பள முன்பணம் கோரிக்கை", icon: "💰", color: "#10B981", desc: "For requesting advance payment from salary", category: "employee" },
  { id: "expense_claim", title: "Expense Claim Form", tamil: "செலவு கோரிக்கை படிவம்", icon: "🧾", color: "#5B4BFF", desc: "For claiming work-related expenses", category: "employee" },
  { id: "complaint", title: "Complaint Form", tamil: "புகார் படிவம்", icon: "📢", color: "#EF4444", desc: "For raising a workplace complaint", category: "employee" },
  { id: "suggestion", title: "Suggestion Form", tamil: "ஆலோசனை படிவம்", icon: "💡", color: "#8B5CF6", desc: "For submitting improvement suggestions", category: "employee" },
  { id: "overtime_request", title: "Overtime Request", tamil: "கூடுதல் நேர கோரிக்கை", icon: "⏰", color: "#06B6D4", desc: "For requesting overtime approval", category: "employee" },
  { id: "work_from_home", title: "Work From Home Request", tamil: "வீட்டிலிருந்து பணி கோரிக்கை", icon: "🏠", color: "#F97316", desc: "For requesting work from home permission", category: "employee" },
  { id: "asset_request", title: "Asset Request Form", tamil: "சொத்து கோரிக்கை படிவம்", icon: "💼", color: "#64748B", desc: "For requesting company equipment or assets", category: "employee" },
  { id: "loan_request", title: "Employee Loan Request", tamil: "பணியாளர் கடன் கோரிக்கை", icon: "🏦", color: "#DC2626", desc: "For requesting a company loan with EMI repayment", category: "employee" },
  { id: "chit_fund_join", title: "Chit Fund Enrollment", tamil: "சீட்டு நிதி சேர்க்கை", icon: "🎫", color: "#7C3AED", desc: "For joining internal or external chit fund", category: "employee" },
  { id: "chit_bid_request", title: "Chit Bid Request", tamil: "சீட்டு ஏல கோரிக்கை", icon: "🔨", color: "#9333EA", desc: "For bidding to take the chit amount this month", category: "employee" },
  { id: "customer_complaint", title: "Customer Complaint", tamil: "வாடிக்கையாளர் புகார்", icon: "😤", color: "#EF4444", desc: "Customer complaint about product or service", category: "customer" },
  { id: "customer_feedback", title: "Customer Feedback", tamil: "வாடிக்கையாளர் கருத்து", icon: "⭐", color: "#F59E0B", desc: "Customer rating and satisfaction feedback", category: "customer" },
  { id: "customer_registration", title: "New Customer Registration", tamil: "புதிய வாடிக்கையாளர் பதிவு", icon: "🆕", color: "#10B981", desc: "Register a new customer met during field visit", category: "customer" },
  { id: "customer_visit_report", title: "Customer Visit Report", tamil: "வாடிக்கையாளர் சந்திப்பு அறிக்கை", icon: "🤝", color: "#3B82F6", desc: "Report of customer visit by field employee", category: "customer" },
  { id: "customer_credit_request", title: "Customer Credit Request", tamil: "வாடிக்கையாளர் கடன் வரம்பு", icon: "💳", color: "#6366F1", desc: "Request to increase customer credit limit", category: "customer" },
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
  loan_request: {
    title: "Employee Loan Request",
    tamil: "பணியாளர் கடன் கோரிக்கை படிவம்",
    fields: `
      <div class="section-title">Loan Details / கடன் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Loan Amount Requested / கோரும் கடன் தொகை (₹)</div><div class="field-line"></div></div>
        <div class="field-group">
          <div class="field-label">Repayment Period / திரும்ப செலுத்தும் காலம்</div>
          <div class="checkbox-row" style="flex-wrap:wrap; gap:8px;">
            <div class="checkbox-item"><div class="checkbox-box"></div> 3 Months</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> 6 Months</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> 12 Months</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Other: _______</div>
          </div>
        </div>
        <div class="field-group"><div class="field-label">Monthly EMI / மாதாந்திர தவணை (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="field-group">
        <div class="field-label">Purpose of Loan / கடன் நோக்கம்</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Medical / மருத்துவம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> House Repair / வீடு சரி செய்தல்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Marriage / திருமணம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Education / படிப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Vehicle / வாகனம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Detailed Reason / விளக்கமான காரணம்</div><div class="field-textarea"></div></div>
      <div class="section-title">Current Employment Details / தற்போதைய பணி விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Years of Service / பணி ஆண்டுகள்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Current Monthly Salary / தற்போதைய மாத சம்பளம் (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Existing Advance Balance / தற்போதைய முன்பண நிலுவை (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="section-title">Guarantor Details / உத்தரவாதி விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Guarantor Name / உத்தரவாதி பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Relation / உறவு முறை</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Guarantor Phone / தொலைபேசி</div><div class="field-line"></div></div>
      </div>
      <div class="field-group">
        <div class="field-label">I agree that the loan amount will be deducted from my salary as per the approved schedule / அங்கீகரிக்கப்பட்ட அட்டவணைப்படி கடன் தொகை என் சம்பளத்திலிருந்து கழிக்கப்படும் என்று ஒப்புக்கொள்கிறேன்</div>
        <div class="checkbox-row"><div class="checkbox-item"><div class="checkbox-box"></div> I Agree / ஒப்புக்கொள்கிறேன்</div></div>
      </div>
      <div class="section-title">For Office Use Only / அலுவலக பயன்பாட்டிற்கு மட்டும்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Approved Amount (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Approved EMI (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Approval Date</div><div class="field-line"></div></div>
      </div>
    `,
  },
  chit_fund_join: {
    title: "Chit Fund Enrollment Form",
    tamil: "சீட்டு நிதி சேர்க்கை படிவம்",
    fields: `
      <div class="section-title">Chit Fund Details / சீட்டு நிதி விவரங்கள்</div>
      <div class="field-group">
        <div class="field-label">Chit Type / சீட்டு வகை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Company Internal Chit / நிறுவன உள் சீட்டு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> External Chit (Outside company) / வெளி சீட்டு</div>
        </div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Chit Group Name / சீட்டு குழு பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Monthly Contribution / மாதாந்திர பங்களிப்பு (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Duration / காலம் (Months)</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Total Chit Value / மொத்த சீட்டு மதிப்பு (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Start Date / தொடக்க தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Ticket Number / சீட்டு எண் (if assigned)</div><div class="field-line"></div></div>
      </div>
      <div class="field-group">
        <div class="field-label">Payment Method / கட்டண முறை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Salary Deduction / சம்பளத்தில் கழித்தல்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Cash Payment / பணமாக செலுத்துவேன்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Bank Transfer / வங்கி பரிமாற்றம்</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Reason for Joining / சேர்வதற்கான காரணம்</div><div class="field-textarea"></div></div>
      <div class="section-title">External Chit Details (fill only if external) / வெளி சீட்டு விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Chit Company Name / சீட்டு நிறுவன பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Organizer Name / ஏற்பாட்டாளர் பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Organizer Phone</div><div class="field-line"></div></div>
      </div>
      <div class="field-group">
        <div class="field-label">Declaration / உறுதிமொழி</div>
        <div class="checkbox-row"><div class="checkbox-item"><div class="checkbox-box"></div> I agree to pay the monthly chit contribution on time and understand the terms / நான் மாதாந்திர சீட்டு பங்களிப்பை சரியான நேரத்தில் செலுத்துவேன் என்று உறுதியளிக்கிறேன்</div></div>
      </div>
    `,
  },
  chit_bid_request: {
    title: "Chit Bid Request Form",
    tamil: "சீட்டு ஏல கோரிக்கை படிவம்",
    fields: `
      <div class="section-title">Bid Details / ஏல விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Chit Group / சீட்டு குழு</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Ticket Number / சீட்டு எண்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Bid Month / ஏல மாதம்</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Total Chit Value / மொத்த சீட்டு மதிப்பு (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">My Bid Amount / என் ஏல தொகை (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Expected Receive Amount / கிடைக்கும் தொகை (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="field-group"><div class="field-label">Reason for Taking Chit Now / இப்போது சீட்டு எடுக்கும் காரணம்</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">How will you use the amount / தொகையை எவ்வாறு பயன்படுத்துவீர்கள்</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">Remaining months to pay after taking chit / சீட்டு எடுத்த பிறகு செலுத்த வேண்டிய மாதங்கள்</div><div class="field-line"></div></div>
    `,
  },
  customer_complaint: {
    title: "Customer Complaint Form",
    tamil: "வாடிக்கையாளர் புகார் படிவம்",
    fields: `
      <div class="section-title">Customer Details / வாடிக்கையாளர் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Customer Name / வாடிக்கையாளர் பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Phone / தொலைபேசி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Invoice Number / விலைப்பட்டியல் எண்</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Purchase Date / வாங்கிய தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Complaint Date / புகார் தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">City / நகரம்</div><div class="field-line"></div></div>
      </div>
      <div class="section-title">Complaint Details / புகார் விவரங்கள்</div>
      <div class="field-group">
        <div class="field-label">Complaint Type / புகார் வகை</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Product Quality / தயாரிப்பு தரம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Wrong Item / தவறான பொருள்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Short Quantity / குறைவான அளவு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Delivery Issue / டெலிவரி பிரச்சனை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Billing Issue / கட்டண பிரச்சனை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Staff Behaviour / ஊழியர் நடத்தை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Product Name / பொருளின் பெயர்</div><div class="field-line"></div></div>
      <div class="field-group"><div class="field-label">Complaint Description / புகாரின் விளக்கம்</div><div class="field-textarea" style="height:96px;"></div></div>
      <div class="field-group">
        <div class="field-label">Expected Resolution / எதிர்பார்க்கும் தீர்வு</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Replace Product / பொருள் மாற்றம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Refund / பணம் திரும்ப</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Credit Note / கடன் குறிப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Apology / மன்னிப்பு</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Other / மற்றவை</div>
        </div>
      </div>
    `,
  },
  customer_feedback: {
    title: "Customer Feedback Form",
    tamil: "வாடிக்கையாளர் கருத்து படிவம்",
    fields: `
      <div class="section-title">Customer Details / வாடிக்கையாளர் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Customer Name / வாடிக்கையாளர் பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Phone / தொலைபேசி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">City / நகரம்</div><div class="field-line"></div></div>
      </div>
      <div class="section-title">Ratings / மதிப்பீடு (Circle your answer / உங்கள் பதிலை வட்டமிடவும்)</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="border:1.5px solid #000; padding:8px; text-align:left; width:50%;">Question / கேள்வி</th>
            <th style="border:1.5px solid #000; padding:8px; text-align:center;">Poor / மோசம் 1</th>
            <th style="border:1.5px solid #000; padding:8px; text-align:center;">Average / சாதாரண 2</th>
            <th style="border:1.5px solid #000; padding:8px; text-align:center;">Good / நல்லது 3</th>
            <th style="border:1.5px solid #000; padding:8px; text-align:center;">Excellent / மிகவும் நல்லது 4</th>
          </tr>
        </thead>
        <tbody>
          ${[
            "Product Quality / தயாரிப்பு தரம்",
            "Pricing / விலை",
            "Staff Behaviour / ஊழியர் நடத்தை",
            "Delivery Speed / டெலிவரி வேகம்",
            "Overall Satisfaction / மொத்த திருப்தி",
          ].map((q) => `
            <tr>
              <td style="border:1.5px solid #000; padding:10px 8px;">${q}</td>
              <td style="border:1.5px solid #000; padding:10px; text-align:center; font-size:14px;">○</td>
              <td style="border:1.5px solid #000; padding:10px; text-align:center; font-size:14px;">○</td>
              <td style="border:1.5px solid #000; padding:10px; text-align:center; font-size:14px;">○</td>
              <td style="border:1.5px solid #000; padding:10px; text-align:center; font-size:14px;">○</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="field-group"><div class="field-label">What did you like most / மிகவும் பிடித்தது என்ன</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">What can we improve / என்ன மேம்படுத்தலாம்</div><div class="field-textarea"></div></div>
      <div class="field-group">
        <div class="field-label">Will you recommend us / எங்களை பரிந்துரைப்பீர்களா</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> Yes / ஆம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> No / இல்லை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Maybe / ஒருவேளை</div>
        </div>
      </div>
    `,
  },
  customer_registration: {
    title: "New Customer Registration Form",
    tamil: "புதிய வாடிக்கையாளர் பதிவு படிவம்",
    fields: `
      <div class="section-title">Business Details / வணிக விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Business / Shop Name / கடை பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Owner Name / உரிமையாளர் பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Business Type / வணிக வகை</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Phone 1 / தொலைபேசி 1</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Phone 2 / தொலைபேசி 2</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">WhatsApp Number</div><div class="field-line"></div></div>
      </div>
      <div class="field-group"><div class="field-label">Full Address / முழு முகவரி</div><div class="field-textarea" style="height:56px;"></div></div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">City / நகரம்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">State / மாநிலம்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Pincode / அஞ்சல் குறியீடு</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">GSTIN (if any)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Aadhar / PAN Number</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Email</div><div class="field-line"></div></div>
      </div>
      <div class="section-title">Purchase Details / கொள்முதல் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Products Interested In / தேவைப்படும் பொருட்கள்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Estimated Monthly Purchase / மாத கொள்முதல் மதிப்பு (₹)</div><div class="field-line"></div></div>
        <div class="field-group">
          <div class="field-label">Payment Preference / கட்டண விருப்பம்</div>
          <div class="checkbox-row" style="flex-direction:column; gap:4px;">
            <div class="checkbox-item"><div class="checkbox-box"></div> Cash</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Credit / கடன்</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Online</div>
          </div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Credit Limit Requested / கடன் வரம்பு கோரிக்கை (₹)</div><div class="field-line"></div></div>
      <div class="field-group"><div class="field-label">Reference / யாரால் அறியப்பட்டீர்கள்</div><div class="field-line"></div></div>
      <div class="section-title">Visited By / சந்தித்த பணியாளர் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Our Employee Name</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Visit Date / சந்தித்த தேதி</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Follow Up Date / மீண்டும் தொடர்பு கொள்ள</div><div class="field-line"></div></div>
      </div>
    `,
  },
  customer_visit_report: {
    title: "Customer Visit Report",
    tamil: "வாடிக்கையாளர் சந்திப்பு அறிக்கை",
    fields: `
      <div class="section-title">Visit Details / சந்திப்பு விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Customer Name / வாடிக்கையாளர் பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Customer Phone</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Visit Date / சந்திப்பு தேதி</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Visit Time From / தொடக்க நேரம்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Visit Time To / முடிவு நேரம்</div><div class="field-line"></div></div>
        <div class="field-group">
          <div class="field-label">Visit Purpose / சந்திப்பின் நோக்கம்</div>
          <div class="checkbox-row" style="flex-direction:column; gap:4px;">
            <div class="checkbox-item"><div class="checkbox-box"></div> Sales / விற்பனை</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Collection / வசூல்</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Complaint / புகார்</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Follow Up</div>
          </div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Discussion Summary / விவாதத்தின் சுருக்கம்</div><div class="field-textarea" style="height:80px;"></div></div>
      <div class="meta-row">
        <div class="field-group">
          <div class="field-label">Order Taken / ஆர்டர் எடுக்கப்பட்டதா</div>
          <div class="checkbox-row"><div class="checkbox-item"><div class="checkbox-box"></div> Yes</div><div class="checkbox-item"><div class="checkbox-box"></div> No</div></div>
        </div>
        <div class="field-group"><div class="field-label">Order Amount (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Payment Collected (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="field-group"><div class="field-label">Customer Outstanding Balance / நிலுவை தொகை (₹)</div><div class="field-line"></div></div>
      <div class="field-group"><div class="field-label">Next Action / அடுத்த நடவடிக்கை</div><div class="field-textarea"></div></div>
      <div class="field-group"><div class="field-label">Next Follow Up Date / மீண்டும் தொடர்பு கொள்ள</div><div class="field-line"></div></div>
    `,
  },
  customer_credit_request: {
    title: "Customer Credit Limit Request",
    tamil: "வாடிக்கையாளர் கடன் வரம்பு கோரிக்கை",
    fields: `
      <div class="section-title">Customer Details / வாடிக்கையாளர் விவரங்கள்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Customer Name / பெயர்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Phone</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">City / நகரம்</div><div class="field-line"></div></div>
      </div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Current Credit Limit / தற்போதைய கடன் வரம்பு (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Requested New Limit / கோரும் புதிய வரம்பு (₹)</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Current Outstanding / தற்போதைய நிலுவை (₹)</div><div class="field-line"></div></div>
      </div>
      <div class="section-title">Business Verification / வணிக சரிபார்ப்பு</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Years as Customer / வாடிக்கையாளராக உள்ள ஆண்டுகள்</div><div class="field-line"></div></div>
        <div class="field-group"><div class="field-label">Average Monthly Purchase / சராசரி மாத கொள்முதல் (₹)</div><div class="field-line"></div></div>
        <div class="field-group">
          <div class="field-label">Payment History / கட்டண வரலாறு</div>
          <div class="checkbox-row" style="flex-direction:column; gap:4px;">
            <div class="checkbox-item"><div class="checkbox-box"></div> Always on time / எப்போதும் சரியான நேரத்தில்</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Sometimes delayed / சில நேரம் தாமதம்</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Often delayed / அடிக்கடி தாமதம்</div>
          </div>
        </div>
      </div>
      <div class="field-group"><div class="field-label">Reason for Credit Increase / வரம்பு அதிகரிக்க காரணம்</div><div class="field-textarea"></div></div>
      <div class="field-group">
        <div class="field-label">Supporting Documents / ஆவணங்கள் (Check if available)</div>
        <div class="checkbox-row">
          <div class="checkbox-item"><div class="checkbox-box"></div> GSTIN Certificate</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Shop License / கடை உரிமம்</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Bank Statement / வங்கி அறிக்கை</div>
          <div class="checkbox-item"><div class="checkbox-box"></div> Aadhar / PAN</div>
        </div>
      </div>
      <div class="section-title">Recommended By / பரிந்துரைத்தவர் விவரம்</div>
      <div class="meta-row">
        <div class="field-group"><div class="field-label">Sales Person / விற்பனையாளர்</div><div class="field-line"></div></div>
        <div class="field-group">
          <div class="field-label">Recommendation / பரிந்துரை</div>
          <div class="checkbox-row">
            <div class="checkbox-item"><div class="checkbox-box"></div> Approve / ஒப்புக்கொள்</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Partial / பகுதி</div>
            <div class="checkbox-item"><div class="checkbox-box"></div> Reject / நிராகரி</div>
          </div>
        </div>
        <div class="field-group"><div class="field-label">Recommended Amount (₹)</div><div class="field-line"></div></div>
      </div>
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
          <p className="neo-page-sub">For employees who can't (or would rather not) use the app — print blank forms, collect filled forms, enter data on their behalf. Anyone with a login can also submit these from Team Hub themselves.</p>
        </div>
        <div className="neo-page-actions">
          {todayCount > 0 && (
            <span className="neo-badge neo-badge-success">📋 {todayCount} entered today</span>
          )}
        </div>
      </div>

      {([
        { key: "employee", label: "Employee Forms", tamil: "பணியாளர் படிவங்கள்", color: "#7C3AED" },
        { key: "customer", label: "Customer Forms", tamil: "வாடிக்கையாளர் படிவங்கள்", color: "#3B82F6" },
      ] as const).map((section) => (
        <div key={section.key} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: section.color, marginBottom: 14, letterSpacing: "0.02em" }}>
            {section.label} <span style={{ fontWeight: 500, opacity: 0.75 }}>/ {section.tamil}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
            {FORMS.filter((f) => (f.category || "employee") === section.key).map((form) => (
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
      ))}
    </div>
  );
};

export default HRFormsPrint;
