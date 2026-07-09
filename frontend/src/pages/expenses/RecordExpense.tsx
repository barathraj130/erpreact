import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface CategoryItem {
  key: string;
  label: string;
  icon: string;
}
interface CategoryGroup {
  group: string;
  items: CategoryItem[];
}

const BLOCKED_PAID_TO = new Set(["person", "someone", "misc", "other", "unknown", "na", "n/a", "nobody"]);

const AMOUNT_WARNING_THRESHOLDS: Record<string, number> = {
  daily_wage: 50000,
  food: 5000,
  printing: 3000,
  transport: 20000,
  misc: 10000,
};

// Local calendar date, not toISOString() (which is UTC and can show yesterday's
// date in timezones ahead of UTC during early morning hours).
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  display: "block",
  marginBottom: 6,
};
const errorStyle: React.CSSProperties = { fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 };
const fieldWrap: React.CSSProperties = { marginBottom: 18 };

const RecordExpense: React.FC = () => {
  const navigate = useNavigate();
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);

  const [form, setForm] = useState({
    expense_date: today(),
    category: "",
    sub_category: "",
    amount: "",
    payment_mode: "",
    paid_to: "",
    contact_phone: "",
    description: "",
    receipt_number: "",
    admin_notes: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<any>(null);

  useEffect(() => {
    apiFetch("/expense-entries/categories")
      .then((r) => r.json())
      .then((d) => setCategoryGroups(d.groups || []))
      .catch(() => setCategoryGroups([]));
  }, []);

  const set = (name: string, value: string) => setForm((f) => ({ ...f, [name]: value }));
  const markTouched = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.expense_date) e.expense_date = "Required";
    else if (form.expense_date > today()) e.expense_date = "Cannot be a future date";

    if (!form.category) e.category = "Select a category";

    if (!form.sub_category.trim()) e.sub_category = "Required";
    else if (form.sub_category.trim().length < 3) e.sub_category = "Minimum 3 characters required";

    const amt = parseFloat(form.amount);
    if (!form.amount) e.amount = "Required";
    else if (isNaN(amt) || amt <= 0) e.amount = "Enter a valid amount";

    if (!form.payment_mode) e.payment_mode = "Select a payment mode";

    const paidToNorm = form.paid_to.trim().toLowerCase();
    if (!form.paid_to.trim()) e.paid_to = "Required";
    else if (form.paid_to.trim().length < 3) e.paid_to = "Minimum 3 characters required";
    else if (BLOCKED_PAID_TO.has(paidToNorm)) e.paid_to = "Please enter the actual name of the person or business";

    if (!form.description.trim()) e.description = "Required";
    else if (form.description.trim().length < 20)
      e.description = `Too short — ${20 - form.description.trim().length} more characters needed`;

    return e;
  }, [form]);

  const amountWarning = useMemo(() => {
    const amt = parseFloat(form.amount);
    if (!amt || !form.category) return null;
    const threshold = AMOUNT_WARNING_THRESHOLDS[form.category];
    if (threshold && amt > threshold) {
      return `₹${amt.toLocaleString("en-IN")} seems high for this category — double check before submitting`;
    }
    if (amt > 100000) return `₹${amt.toLocaleString("en-IN")} is above ₹1 lakh — double check before submitting`;
    return null;
  }, [form.amount, form.category]);

  const requiredFields = ["expense_date", "category", "sub_category", "amount", "payment_mode", "paid_to", "description"];
  const filledCount = requiredFields.filter((f) => (form as any)[f] && (form as any)[f].toString().trim().length > 0).length;
  const progress = Math.round((filledCount / requiredFields.length) * 100);
  const isValid = Object.keys(errors).length === 0;

  const selectedCategory = categoryGroups
    .flatMap((g) => g.items)
    .find((c) => c.key === form.category);

  const handleContinue = () => {
    setTouched(Object.fromEntries(requiredFields.map((f) => [f, true])));
    if (isValid) setShowPreview(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch("/expense-entries", {
        method: "POST",
        body: {
          ...form,
          amount: parseFloat(form.amount),
        },
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to record expense");
      }
      setSubmitted(data.data);
    } catch (err: any) {
      setSubmitError(err.message || "Network error");
      setShowPreview(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container" style={{ maxWidth: 560, margin: "40px auto" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700 }}>Expense Recorded</h2>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
            Reference: <strong>{submitted.reference_number}</strong>
            {submitted.cash_ledger_ref || submitted.bank_ledger_ref ? " — posted to ledger" : " — personal, no ledger impact"}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => {
                setSubmitted(null);
                setShowPreview(false);
                setForm({ expense_date: today(), category: "", sub_category: "", amount: "", payment_mode: "", paid_to: "", contact_phone: "", description: "", receipt_number: "", admin_notes: "" });
                setTouched({});
              }}
              style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Record Another
            </button>
            <button
              onClick={() => navigate("/expenses")}
              style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              View Expense List →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Record Expense</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
        Every rupee going out gets recorded here with full detail — who, what, why, and how it was paid.
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Form Completion</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: progress === 100 ? "#16a34a" : "#64748b" }}>
            {progress}% — {filledCount}/{requiredFields.length} required fields
          </span>
        </div>
        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 3,
              transition: "width 0.3s ease",
              background: progress === 100 ? "#16a34a" : progress >= 60 ? "#f59e0b" : "#ef4444",
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {!showPreview && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
          {/* Expense Date */}
          <div style={fieldWrap}>
            <label style={labelStyle}>EXPENSE DATE</label>
            <input
              type="date"
              max={today()}
              value={form.expense_date}
              onChange={(e) => set("expense_date", e.target.value)}
              onBlur={() => markTouched("expense_date")}
              style={inputStyle}
            />
            {touched.expense_date && errors.expense_date && <div style={errorStyle}>{errors.expense_date}</div>}
          </div>

          {/* Category */}
          <div style={fieldWrap}>
            <label style={labelStyle}>CATEGORY</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              onBlur={() => markTouched("category")}
              style={inputStyle}
            >
              <option value="">Select category...</option>
              {categoryGroups.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {touched.category && errors.category && <div style={errorStyle}>{errors.category}</div>}
          </div>

          {/* Sub category */}
          <div style={fieldWrap}>
            <label style={labelStyle}>SUB CATEGORY / SPECIFIC TYPE</label>
            <input
              type="text"
              placeholder="Be specific — e.g. June rent, Morning shift wages, ICICI EMI #5"
              value={form.sub_category}
              onChange={(e) => set("sub_category", e.target.value)}
              onBlur={() => markTouched("sub_category")}
              style={inputStyle}
            />
            {touched.sub_category && errors.sub_category && <div style={errorStyle}>{errors.sub_category}</div>}
          </div>

          {/* Amount */}
          <div style={fieldWrap}>
            <label style={labelStyle}>AMOUNT (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 3380"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              onBlur={() => markTouched("amount")}
              style={inputStyle}
            />
            {touched.amount && errors.amount && <div style={errorStyle}>{errors.amount}</div>}
            {!errors.amount && amountWarning && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 4, fontWeight: 600 }}>⚠ {amountWarning}</div>
            )}
          </div>

          {/* Payment mode */}
          <div style={fieldWrap}>
            <label style={labelStyle}>PAYMENT MODE</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["cash", "bank", "upi", "personal"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    set("payment_mode", mode);
                    markTouched("payment_mode");
                  }}
                  style={{
                    flex: "1 1 80px",
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: "1.5px solid",
                    borderColor: form.payment_mode === mode ? "#4f46e5" : "#e2e8f0",
                    background: form.payment_mode === mode ? "#4f46e5" : "#f8fafc",
                    color: form.payment_mode === mode ? "#fff" : "#374151",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {mode === "cash" ? "💵 CASH" : mode === "bank" ? "🏦 BANK" : mode === "upi" ? "📱 UPI" : "👤 PERSONAL"}
                </button>
              ))}
            </div>
            {form.payment_mode === "personal" && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                Personal — paid from proprietor's own pocket, no company cash/bank ledger entry will be created.
              </div>
            )}
            {touched.payment_mode && errors.payment_mode && <div style={errorStyle}>{errors.payment_mode}</div>}
          </div>

          {/* Paid to */}
          <div style={fieldWrap}>
            <label style={labelStyle}>PAID TO (Who received this money)</label>
            <input
              type="text"
              placeholder="Full name of person or business — e.g. Kumar Electricals, Rajan (driver), ICICI Bank"
              value={form.paid_to}
              onChange={(e) => set("paid_to", e.target.value)}
              onBlur={() => markTouched("paid_to")}
              style={inputStyle}
            />
            {touched.paid_to && errors.paid_to && <div style={errorStyle}>{errors.paid_to}</div>}
          </div>

          {/* Phone */}
          <div style={fieldWrap}>
            <label style={labelStyle}>PHONE / CONTACT (optional)</label>
            <input
              type="text"
              placeholder="Vendor phone number if available"
              value={form.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div style={fieldWrap}>
            <label style={labelStyle}>DESCRIPTION (What exactly was this for)</label>
            <textarea
              rows={3}
              placeholder="Write full detail — e.g. Electricity bill for main showroom for month of June 2026, bill number EB-2847. Paid to TNEB counter. Includes ₹200 fine for late payment."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              onBlur={() => markTouched("description")}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: form.description.trim().length >= 20 ? "#16a34a" : "#94a3b8", marginTop: 4, fontWeight: 600 }}>
              {form.description.trim().length} / 20 minimum
            </div>
            {touched.description && errors.description && <div style={errorStyle}>{errors.description}</div>}
          </div>

          {/* Receipt number */}
          <div style={fieldWrap}>
            <label style={labelStyle}>RECEIPT NUMBER (optional)</label>
            <input
              type="text"
              placeholder="Bill number, voucher number, receipt number if you have it"
              value={form.receipt_number}
              onChange={(e) => set("receipt_number", e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Admin notes */}
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>NOTES FOR ADMIN (optional)</label>
            <textarea
              rows={2}
              placeholder="Any additional context the admin should know"
              value={form.admin_notes}
              onChange={(e) => set("admin_notes", e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background: isValid ? "#4f46e5" : "#cbd5e1",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: isValid ? "pointer" : "not-allowed",
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {showPreview && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Review Before Submitting</div>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {[
                ["Date", form.expense_date],
                ["Category", `${selectedCategory?.icon || ""} ${selectedCategory?.label || form.category}`],
                ["Specific Type", form.sub_category],
                ["Amount", `₹${parseFloat(form.amount).toLocaleString("en-IN")}`],
                ["Payment Mode", form.payment_mode.toUpperCase()],
                ["Paid To", form.paid_to],
                ["Phone", form.contact_phone || "Not provided"],
                ["Description", form.description],
                ["Receipt No", form.receipt_number || "Not provided"],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: "6px 0", color: "#64748b", width: "35%", fontWeight: 500, verticalAlign: "top" }}>{label}</td>
                  <td style={{ padding: "6px 0", color: "#0f172a", fontWeight: 600 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {submitError && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
              {submitError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              ← Edit
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              style={{ flex: 2, padding: "10px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Recording…" : "✓ Confirm & Record Expense"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordExpense;
