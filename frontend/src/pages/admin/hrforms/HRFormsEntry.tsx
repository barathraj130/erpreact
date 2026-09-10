import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../../utils/api";
import { FORMS, FormMeta } from "./HRFormsPrint";
import "../../../styles/neo-neu-motion.css";

interface HubUser { id: number; name: string; email: string; role: string; phone?: string; }
interface DecisionMaker { id: number; name: string; display_title?: string; }

const FORM_LABELS: Record<string, string> = {
  leave_request: "Leave Request", advance_request: "Advance Request", expense_claim: "Expense Claim",
  complaint: "Complaint", suggestion: "Suggestion", overtime_request: "Overtime Request",
  work_from_home: "Work From Home", asset_request: "Asset Request",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

const HRFormsEntry: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const formParam = searchParams.get("form");

  // Step 1 — employee
  const [employees, setEmployees] = useState<HubUser[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<HubUser | null>(null);

  // Step 2 — form type
  const [formType, setFormType] = useState<string | null>(formParam);

  // Step 3 — fields
  const [fields, setFields] = useState<Record<string, any>>({});

  // Step 4 — send to
  const [decisionMakers, setDecisionMakers] = useState<DecisionMaker[]>([]);
  const [sendToId, setSendToId] = useState<string>("");

  // Step 5 — submit
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ employeeName: string; decisionMakerName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/hub/users${employeeSearch ? `?search=${encodeURIComponent(employeeSearch)}` : ""}`)
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));
  }, [employeeSearch]);

  useEffect(() => {
    if (!formType) { setDecisionMakers([]); return; }
    apiFetch(`/authority/decision-makers?request_type=${formType}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDecisionMakers(list);
        if (list[0]) setSendToId(String(list[0].id));
      })
      .catch(() => setDecisionMakers([]));
  }, [formType]);

  const selectFormType = (id: string) => {
    setFormType(id);
    setFields({});
    setSearchParams({ form: id });
  };

  const set = (k: string, v: any) => setFields((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (formType === "leave_request" && fields.from_date && fields.to_date) {
      const days = Math.round((new Date(fields.to_date).getTime() - new Date(fields.from_date).getTime()) / 86400000) + 1;
      if (days > 0 && days !== fields.total_days) set("total_days", days);
    }
    if (formType === "work_from_home" && fields.from_date && fields.to_date) {
      const days = Math.round((new Date(fields.to_date).getTime() - new Date(fields.from_date).getTime()) / 86400000) + 1;
      if (days > 0 && days !== fields.total_days) set("total_days", days);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.from_date, fields.to_date]);

  const submit = async () => {
    if (!selectedEmployee) return setError("Select which employee this form is for.");
    if (!formType) return setError("Select a form type.");
    if (!sendToId) return setError("Select who to send this to.");
    setError(null);
    setSubmitting(true);
    try {
      const channelRes = await apiFetch("/hub/channels", {
        method: "POST",
        body: JSON.stringify({
          channel_type: "direct",
          member_ids: [Number(sendToId)],
          on_behalf_of_user_id: selectedEmployee.id,
        }),
      });
      const channelData = await channelRes.json();
      if (!channelData.success) throw new Error(channelData.error || "Failed to open a channel to the decision maker.");

      const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const msgRes = await apiFetch(`/hub/channels/${channelData.channel_id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message_type: "form",
          content: `📝 Entered by Admin from a paper form on ${today}.`,
          form_type: formType,
          form_data: { ...fields, send_to_id: Number(sendToId) },
          on_behalf_of_user_id: selectedEmployee.id,
        }),
      });
      const msgData = await msgRes.json();
      if (!msgData.success) throw new Error(msgData.error || "Failed to submit the form.");

      const dm = decisionMakers.find((d) => String(d.id) === sendToId);
      setSuccess({ employeeName: selectedEmployee.name, decisionMakerName: dm?.name || "the decision maker" });
    } catch (err: any) {
      setError(err.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setSelectedEmployee(null);
    setFormType(null);
    setFields({});
    setSendToId("");
    setSuccess(null);
    setError(null);
    setSearchParams({});
  };

  if (success) {
    return (
      <div className="neo-page">
        <div className="neu-card" style={{ padding: 32, maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--neu-text-primary)", marginBottom: 8 }}>
            Form entered successfully on behalf of {success.employeeName}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--neu-text-secondary)", marginBottom: 4 }}>
            They will be notified if they have the app.
          </div>
          <div style={{ fontSize: 12.5, color: "var(--neu-text-secondary)", marginBottom: 24 }}>
            Decision maker <b>{success.decisionMakerName}</b> has been notified.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="neo-btn-secondary" onClick={() => navigate("/admin/hr-forms")}>← Back to Print HR Forms</button>
            <button className="neo-btn-primary" onClick={resetAll}>Enter Another Form</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">✏️ Enter Paper Form Data</h1>
          <p className="neo-page-sub">Entering on behalf of an employee — recorded as if they submitted it themselves.</p>
        </div>
        <div className="neo-page-actions">
          <button className="neo-btn-secondary neo-btn-sm" onClick={() => navigate("/admin/hr-forms")}>← Back</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.3)", color: "#DC2626", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Step 1 — Employee */}
      <div className="neu-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--neu-text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 1 — Select Employee</div>
        {selectedEmployee ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(91,75,255,0.06)", border: "1px solid rgba(91,75,255,0.2)", borderRadius: 8, padding: "10px 14px" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{selectedEmployee.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--neu-text-muted)", textTransform: "capitalize" }}>{selectedEmployee.role.replace(/_/g, " ")}{selectedEmployee.phone ? ` · ${selectedEmployee.phone}` : ""}</div>
              </div>
              <button className="neo-btn-secondary neo-btn-sm" onClick={() => setSelectedEmployee(null)}>Change</button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--neu-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              📱 This employee has a login — they can also submit this form themselves from Team Hub. Entering the paper form here is one option.
            </div>
          </>
        ) : (
          <>
            <input className="neu-input" placeholder="Search employee by name…" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: 4 }}>
              {employees.map((emp) => (
                <div key={emp.id} onClick={() => setSelectedEmployee(emp)} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neu-surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <b>{emp.name}</b> <span style={{ color: "var(--neu-text-muted)", fontSize: 11.5, textTransform: "capitalize" }}>— {emp.role.replace(/_/g, " ")}</span>
                </div>
              ))}
              {employees.length === 0 && <div style={{ fontSize: 12, color: "var(--neu-text-muted)", padding: 8 }}>No employees found.</div>}
            </div>
          </>
        )}
      </div>

      {/* Step 2 — Form type */}
      <div className="neu-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--neu-text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 2 — Select Form Type</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {FORMS.map((f: FormMeta) => (
            <button
              key={f.id}
              onClick={() => selectFormType(f.id)}
              style={{
                padding: "12px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                border: formType === f.id ? `2px solid ${f.color}` : "1.5px solid var(--neu-border)",
                background: formType === f.id ? `${f.color}14` : "var(--neu-surface-2)",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--neu-text-primary)" }}>{f.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3 — Fields */}
      {formType && (
        <div className="neu-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--neu-text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Step 3 — Fill Form Data ({FORM_LABELS[formType] || formType})
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {formType === "leave_request" && (
              <>
                <Field label="Leave Type">
                  <select className="neu-select" value={fields.leave_type || ""} onChange={(e) => set("leave_type", e.target.value)}>
                    <option value="">Select…</option>
                    <option value="Casual">Casual</option><option value="Sick">Sick</option>
                    <option value="Earned">Earned</option><option value="Unpaid">Unpaid</option><option value="Other">Other</option>
                  </select>
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="From Date"><input type="date" className="neu-input" value={fields.from_date || ""} onChange={(e) => set("from_date", e.target.value)} /></Field>
                  <Field label="To Date"><input type="date" className="neu-input" value={fields.to_date || ""} onChange={(e) => set("to_date", e.target.value)} /></Field>
                </div>
                {fields.total_days && <div style={{ fontSize: 12, color: "var(--neu-text-muted)" }}>Total days: {fields.total_days}</div>}
                <Field label="Reason"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
                <Field label="Contact During Leave"><input className="neu-input" value={fields.contact_during_leave || ""} onChange={(e) => set("contact_during_leave", e.target.value)} /></Field>
                <Field label="Work Handover To"><input className="neu-input" value={fields.handover_to || ""} onChange={(e) => set("handover_to", e.target.value)} /></Field>
              </>
            )}
            {formType === "advance_request" && (
              <>
                <Field label="Amount Requested (₹)"><input type="number" className="neu-input" value={fields.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} /></Field>
                <Field label="Required By"><input type="date" className="neu-input" value={fields.needed_by || ""} onChange={(e) => set("needed_by", e.target.value)} /></Field>
                <Field label="Reason"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
                <Field label="Repayment Method">
                  <select className="neu-select" value={fields.repayment_plan || ""} onChange={(e) => set("repayment_plan", e.target.value)}>
                    <option value="">Select…</option><option value="Salary Deduction">Salary Deduction</option><option value="Cash Return">Cash Return</option><option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Repay Over (months)"><input type="number" className="neu-input" value={fields.repay_months || ""} onChange={(e) => set("repay_months", Number(e.target.value))} /></Field>
              </>
            )}
            {formType === "expense_claim" && (
              <>
                <Field label="Expense Type">
                  <select className="neu-select" value={fields.expense_type || ""} onChange={(e) => set("expense_type", e.target.value)}>
                    <option value="">Select…</option><option>Travel</option><option>Food</option><option>Communication</option><option>Stationery</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Amount (₹)"><input type="number" className="neu-input" value={fields.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} /></Field>
                <Field label="Date of Expense"><input type="date" className="neu-input" value={fields.expense_date || ""} onChange={(e) => set("expense_date", e.target.value)} /></Field>
                <Field label="Description"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
                <Field label="Bill Available?">
                  <select className="neu-select" value={fields.bill_available ? "Yes" : "No"} onChange={(e) => set("bill_available", e.target.value === "Yes")}>
                    <option value="Yes">Yes</option><option value="No">No</option>
                  </select>
                </Field>
              </>
            )}
            {formType === "complaint" && (
              <>
                <Field label="Category">
                  <select className="neu-select" value={fields.category || ""} onChange={(e) => set("category", e.target.value)}>
                    <option value="">Select…</option><option>Salary Issue</option><option>Work Conditions</option><option>Management</option><option>Harassment</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Date of Incident"><input type="date" className="neu-input" value={fields.incident_date || ""} onChange={(e) => set("incident_date", e.target.value)} /></Field>
                <Field label="Description"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
                <Field label="Persons Involved"><input className="neu-input" value={fields.persons_involved || ""} onChange={(e) => set("persons_involved", e.target.value)} /></Field>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={!!fields.anonymous} onChange={(e) => set("anonymous", e.target.checked)} /> Keep name confidential
                </label>
              </>
            )}
            {formType === "suggestion" && (
              <>
                <Field label="Title"><input className="neu-input" value={fields.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
                <Field label="Which Area">
                  <select className="neu-select" value={fields.area || ""} onChange={(e) => set("area", e.target.value)}>
                    <option value="">Select…</option><option>Work Process</option><option>Safety</option><option>Customer Service</option><option>Cost Saving</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Current Problem"><textarea className="neu-textarea" value={fields.problem || ""} onChange={(e) => set("problem", e.target.value)} /></Field>
                <Field label="My Suggestion"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
              </>
            )}
            {formType === "overtime_request" && (
              <>
                <Field label="Date"><input type="date" className="neu-input" value={fields.date || ""} onChange={(e) => set("date", e.target.value)} /></Field>
                <Field label="Total OT Hours"><input type="number" className="neu-input" value={fields.extra_hours || ""} onChange={(e) => set("extra_hours", Number(e.target.value))} /></Field>
                <Field label="Reason"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
              </>
            )}
            {formType === "work_from_home" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="From Date"><input type="date" className="neu-input" value={fields.from_date || ""} onChange={(e) => set("from_date", e.target.value)} /></Field>
                  <Field label="To Date"><input type="date" className="neu-input" value={fields.to_date || ""} onChange={(e) => set("to_date", e.target.value)} /></Field>
                </div>
                <Field label="Reason"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
              </>
            )}
            {formType === "asset_request" && (
              <>
                <Field label="Asset Type">
                  <select className="neu-select" value={fields.asset_type || ""} onChange={(e) => set("asset_type", e.target.value)}>
                    <option value="">Select…</option><option>Mobile Phone</option><option>Laptop / Computer</option><option>Vehicle</option><option>Tools</option><option>Uniform</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Asset Name"><input className="neu-input" value={fields.asset_name || ""} onChange={(e) => set("asset_name", e.target.value)} /></Field>
                <Field label="Required By"><input type="date" className="neu-input" value={fields.needed_by || ""} onChange={(e) => set("needed_by", e.target.value)} /></Field>
                <Field label="Purpose / Reason"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 4 — Send To */}
      {formType && (
        <div className="neu-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--neu-text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 4 — Send To</div>
          <select className="neu-select" value={sendToId} onChange={(e) => setSendToId(e.target.value)}>
            <option value="">Select decision maker…</option>
            {decisionMakers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.display_title ? ` — ${d.display_title}` : ""}</option>)}
          </select>
          <div style={{ padding: "8px 12px", background: "rgba(91,75,255,0.08)", border: "0.5px solid rgba(91,75,255,0.20)", fontSize: 10, color: "#7C6CFF", marginTop: 8 }}>
            ⚡ Only showing people with authority to decide this request type. Configured by Admin.
          </div>
        </div>
      )}

      {/* Step 5 — Submit */}
      {formType && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="neo-btn-primary" disabled={submitting} onClick={submit}>
            {submitting ? "Submitting…" : "Submit on Behalf"}
          </button>
        </div>
      )}
    </div>
  );
};

export default HRFormsEntry;
