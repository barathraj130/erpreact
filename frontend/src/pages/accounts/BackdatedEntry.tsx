import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import CustomSelect from "../../components/CustomSelect";
import "../PageShared.css";

const TYPES: { value: string; label: string; emoji: string }[] = [
  { value: "cash_in",          label: "Cash Received",    emoji: "💵" },
  { value: "cash_out",         label: "Cash Paid",        emoji: "💸" },
  { value: "bank_in",          label: "Bank Received",    emoji: "🏦" },
  { value: "bank_out",         label: "Bank Paid",        emoji: "🏧" },
  { value: "sale",             label: "Sale",              emoji: "🧾" },
  { value: "purchase",         label: "Purchase",          emoji: "📦" },
  { value: "expense",          label: "Expense",           emoji: "🧮" },
  { value: "payment_received", label: "Payment Received",  emoji: "✅" },
  { value: "payment_made",     label: "Payment Made",      emoji: "➡️" },
  { value: "opening_balance",  label: "Opening Balance",   emoji: "📊" },
  { value: "adjustment",       label: "Adjustment",        emoji: "⚖️" },
  { value: "other",            label: "Other",              emoji: "📝" },
];

const REASON_EXAMPLES = [
  "Entry missed during busy season",
  "Cash collected by field employee, submitted late",
  "Bill received after month end closing",
];

const daysAgo = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return "1 day ago";
  if (diff > 1) return `${diff} days ago`;
  return "";
};

const fmt = (n: any) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const BackdatedEntry: React.FC = () => {
  const { user } = useAuthUser();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    transaction_date: "",
    transaction_type: "",
    amount: "",
    description: "",
    reference_number: "",
    party_name: "",
    party_type: "",
    party_id: "",
    account_type: "cash",
    payment_mode: "cash",
    category: "",
    branch_id: "",
    notes: "",
    backdated_reason: "",
  });
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; branch_name: string }[]>([]);

  // Real party list for whichever party_type is selected — so this entry can
  // actually be linked (party_id) to a real customer/supplier/employee and
  // show up in their own ledger, instead of just a free-text label nothing
  // else can match against.
  const [parties, setParties] = useState<{ id: number; label: string }[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(false);

  useEffect(() => {
    apiFetch("/branches").then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : (d.branches || []))).catch(() => {});
  }, []);

  useEffect(() => {
    setParties([]);
    setForm(f => ({ ...f, party_id: "", party_name: "" }));
    if (form.party_type === "customer") {
      setPartiesLoading(true);
      apiFetch("/users?scope=all").then(r => r.json())
        .then(d => setParties((Array.isArray(d) ? d : []).map((c: any) => ({ id: c.id, label: c.nickname || c.username }))))
        .catch(() => {}).finally(() => setPartiesLoading(false));
    } else if (form.party_type === "supplier") {
      setPartiesLoading(true);
      apiFetch("/suppliers").then(r => r.json())
        .then(d => setParties((Array.isArray(d) ? d : []).map((s: any) => ({ id: s.id, label: s.name }))))
        .catch(() => {}).finally(() => setPartiesLoading(false));
    } else if (form.party_type === "employee") {
      setPartiesLoading(true);
      apiFetch("/employees").then(r => r.json())
        .then(d => setParties((Array.isArray(d) ? d : (d.employees || [])).map((e: any) => ({ id: e.id, label: e.name }))))
        .catch(() => {}).finally(() => setPartiesLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.party_type]);

  const today = new Date().toISOString().split("T")[0];
  const dateError = form.transaction_date && form.transaction_date >= today
    ? "Backdated entries must be for a past date — use the normal Transactions page for today or future dates."
    : "";

  const selectedType = TYPES.find(t => t.value === form.transaction_type);

  const canSubmit = useMemo(() => {
    return !!form.transaction_date && !dateError
      && !!form.transaction_type
      && Number(form.amount) > 0
      && form.description.trim().length >= 5
      && form.backdated_reason.trim().length >= 10
      && confirm1 && confirm2;
  }, [form, dateError, confirm1, confirm2]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await apiFetch("/backdated/create", {
        method: "POST",
        body: {
          ...form,
          amount: Number(form.amount),
          branch_id: form.branch_id || undefined,
          party_type: form.party_type || undefined,
          party_id: form.party_id ? Number(form.party_id) : undefined,
        },
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || "Failed to save"); return; }
      setSuccessId(data.transaction_id);
    } catch {
      alert("Failed to record backdated entry");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      transaction_date: "", transaction_type: "", amount: "", description: "",
      reference_number: "", party_name: "", party_type: "", party_id: "", account_type: "cash",
      payment_mode: "cash", category: "", branch_id: "", notes: "", backdated_reason: "",
    });
    setConfirm1(false);
    setConfirm2(false);
    setSuccessId(null);
  };

  if (!user || !["admin", "superadmin"].includes((user.role || "").toLowerCase())) {
    return (
      <div className="page-container">
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>
          This page is restricted to admin.
        </div>
      </div>
    );
  }

  if (successId !== null) {
    return (
      <div className="page-container">
        <div className="page-table-wrapper" style={{ padding: "48px 32px", textAlign: "center", maxWidth: "480px", margin: "60px auto" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
          <h2 style={{ margin: "0 0 8px 0" }}>Backdated Entry Recorded</h2>
          <p style={{ color: "var(--text-3)", marginBottom: "4px" }}>Transaction ID: <strong>#{successId}</strong></p>
          <p style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: "28px" }}>
            It will appear in historical reports for the date you chose. Your current balance is unchanged.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={resetForm} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #4f46e5", background: "#eef2ff", color: "#4338ca", fontWeight: 700, cursor: "pointer" }}>Record Another</button>
            <button onClick={() => navigate("/accounts/backdated")} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, cursor: "pointer" }}>View All Backdated Entries</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Record Backdated Transaction</h1>
          <p>For transactions that genuinely happened in the past but were missed at the time</p>
        </div>
      </div>

      <div style={{ padding: "14px 18px", background: "rgba(245,158,11,0.08)", border: "2px solid rgba(245,158,11,0.25)", borderLeft: "4px solid #F59E0B", marginBottom: 24, borderRadius: "10px", fontSize: "12px", color: "#92400e", lineHeight: 1.6 }}>
        This entry will appear in historical reports for the date you select. It will <strong>NOT</strong> change your current balance.
        Use this only for transactions that genuinely occurred in the past but were missed.
      </div>

      <div style={{ display: "grid", gap: "20px", maxWidth: "720px" }}>
        {/* Step 1 */}
        <div className="page-table-wrapper" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "12px" }}>Step 1 — When did this happen</div>
          <input
            type="date" max={new Date(Date.now() - 86400000).toISOString().split("T")[0]}
            value={form.transaction_date}
            onChange={e => setForm({ ...form, transaction_date: e.target.value })}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
          />
          {form.transaction_date && !dateError && (
            <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-3)", fontWeight: 600 }}>{daysAgo(form.transaction_date)}</span>
          )}
          {dateError && <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "8px", fontWeight: 600 }}>{dateError}</div>}
        </div>

        {/* Step 2 */}
        <div className="page-table-wrapper" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "12px" }}>Step 2 — What type</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setForm({ ...form, transaction_type: t.value })}
                style={{
                  padding: "14px 10px", borderRadius: "10px", cursor: "pointer", textAlign: "center",
                  border: form.transaction_type === t.value ? "2px solid #4f46e5" : "1px solid var(--border)",
                  background: form.transaction_type === t.value ? "#eef2ff" : "var(--surface)",
                  fontWeight: form.transaction_type === t.value ? 700 : 500,
                }}>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>{t.emoji}</div>
                <div style={{ fontSize: "12px" }}>{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 */}
        <div className="page-table-wrapper" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "12px" }}>Step 3 — Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Reference Number</label>
              <input type="text" value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="Invoice no, receipt no…" style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Description *</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Party Type</label>
              <select value={form.party_type} onChange={e => setForm({ ...form, party_type: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                <option value="">—</option>
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="employee">Employee</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>
                {form.party_type === "customer" ? "Customer" : form.party_type === "supplier" ? "Supplier" : form.party_type === "employee" ? "Employee" : "Party Name"}
                {["customer", "supplier", "employee"].includes(form.party_type) && (
                  <span style={{ fontWeight: 500, color: "var(--text-3)", textTransform: "none" }}> — pick from your existing list so this links to their ledger</span>
                )}
              </label>
              {["customer", "supplier", "employee"].includes(form.party_type) ? (
                <CustomSelect
                  value={form.party_id}
                  onChange={(e: any) => {
                    const id = e.target.value;
                    const picked = parties.find(p => String(p.id) === String(id));
                    setForm(f => ({ ...f, party_id: id, party_name: picked?.label || "" }));
                  }}
                  placeholder={partiesLoading ? "Loading…" : `Search ${form.party_type}s…`}
                >
                  {parties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </CustomSelect>
              ) : (
                <input type="text" value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} placeholder="Name (optional)" style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Account</label>
              <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Payment Mode</label>
              <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="neft">NEFT</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Category</label>
              <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
            </div>
            {branches.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Branch</label>
                <select value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <option value="">—</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", marginBottom: "4px" }}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="page-table-wrapper" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "12px" }}>Step 4 — Why backdated *</div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>Why was this not entered at the time?</label>
          <textarea
            value={form.backdated_reason}
            onChange={e => setForm({ ...form, backdated_reason: e.target.value })}
            rows={3}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box", fontFamily: "inherit", fontSize: "13px" }}
          />
          <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-3)" }}>
            Examples: {REASON_EXAMPLES.map((ex, i) => <span key={i} style={{ fontStyle: "italic" }}>"{ex}"{i < REASON_EXAMPLES.length - 1 ? " · " : ""}</span>)}
          </div>
        </div>

        {/* Preview */}
        {form.transaction_date && selectedType && Number(form.amount) > 0 && form.description && (
          <div className="page-table-wrapper" style={{ padding: "20px 24px", background: "#f8fafc" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "12px" }}>Preview</div>
            <div style={{ fontSize: "13px", lineHeight: 2 }}>
              <div><strong>Transaction Date:</strong> {new Date(form.transaction_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ({daysAgo(form.transaction_date)})</div>
              <div><strong>Type:</strong> {selectedType.emoji} {selectedType.label}</div>
              <div><strong>Amount:</strong> {fmt(form.amount)}</div>
              {form.party_name && <div><strong>From/To:</strong> {form.party_name}</div>}
              <div><strong>Description:</strong> {form.description}</div>
              {form.backdated_reason && <div><strong>Reason:</strong> {form.backdated_reason}</div>}
            </div>

            <div style={{ marginTop: "18px", display: "grid", gap: "10px" }}>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={confirm1} onChange={e => setConfirm1(e.target.checked)} style={{ marginTop: "2px" }} />
                I confirm this transaction genuinely occurred on the date shown
              </label>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={confirm2} onChange={e => setConfirm2(e.target.checked)} style={{ marginTop: "2px" }} />
                I understand this will appear in past reports but NOT change current balance
              </label>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              style={{ marginTop: "18px", width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: canSubmit ? "#4f46e5" : "#cbd5e1", color: "#fff", fontWeight: 800, fontSize: "14px", cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {saving ? "Recording…" : "Record Backdated Entry"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackdatedEntry;
