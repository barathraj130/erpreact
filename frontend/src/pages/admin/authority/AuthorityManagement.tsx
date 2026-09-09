import React, { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api";
import "../../../styles/neo-neu-motion.css";

interface Employee {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_decision_maker: boolean;
  display_title?: string | null;
  scope: "company" | "branch" | "team";
  scope_branch_id?: number | null;
  scope_branch_name?: string | null;
  can_approve_leave: boolean;
  can_approve_advance: boolean;
  can_approve_expense: boolean;
  can_approve_attendance: boolean;
  can_approve_complaint: boolean;
  can_approve_wfh: boolean;
  can_approve_overtime: boolean;
  can_approve_purchase: boolean;
  can_approve_asset: boolean;
  can_approve_suggestion: boolean;
}

const PERMISSION_LIST: { key: keyof Employee; label: string; icon: string }[] = [
  { key: "can_approve_leave", label: "Leave Requests", icon: "🏖️" },
  { key: "can_approve_advance", label: "Advance Requests", icon: "💰" },
  { key: "can_approve_expense", label: "Expense Claims", icon: "🧾" },
  { key: "can_approve_attendance", label: "Attendance", icon: "📅" },
  { key: "can_approve_complaint", label: "Complaints", icon: "📢" },
  { key: "can_approve_wfh", label: "WFH Requests", icon: "🏠" },
  { key: "can_approve_overtime", label: "Overtime", icon: "⏰" },
  { key: "can_approve_purchase", label: "Purchase Approvals", icon: "🛒" },
  { key: "can_approve_asset", label: "Asset Requests", icon: "💼" },
  { key: "can_approve_suggestion", label: "Suggestions", icon: "💡" },
];

type FormState = Partial<Employee>;

const AuthorityManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<{ total_employees?: number; decision_makers?: number; non_decision_makers?: number }>({});
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "dm">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, FormState>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [empRes, branchRes] = await Promise.all([apiFetch("/authority/all"), apiFetch("/branches")]);
      const empData = await empRes.json();
      setEmployees(empData.employees || []);
      setSummary(empData.summary || {});
      setBranches(branchRes.ok ? await branchRes.json() : []);
    } catch (err) {
      console.error("Failed to load authority data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getForm = (emp: Employee): FormState => forms[emp.id] || { ...emp };
  const setForm = (empId: number, patch: FormState) =>
    setForms((prev) => ({ ...prev, [empId]: { ...(prev[empId] || {}), ...patch } }));

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    if (!forms[emp.id]) setForm(emp.id, { ...emp });
  };

  const saveAuthority = async (employeeId: number) => {
    const form = forms[employeeId];
    if (!form) return;
    setSavingId(employeeId);
    try {
      const res = await apiFetch("/authority/set", {
        method: "PUT",
        body: JSON.stringify({ user_id: employeeId, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedId(employeeId);
        setTimeout(() => setSavedId(null), 2000);
        await load();
      } else {
        alert(data.error || "Failed to save.");
      }
    } catch {
      alert("Failed to save authority.");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = tab === "dm" ? employees.filter((e) => e.is_decision_maker) : employees;

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">🔐 Authority Management</h1>
          <p className="neo-page-sub">Admin controls who can make decisions, and exactly what they can decide.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="neo-kpi-card">
          <div className="neo-kpi-label">Total Employees</div>
          <div className="neo-kpi-value">{summary.total_employees ?? 0}</div>
        </div>
        <div className="neo-kpi-card">
          <div className="neo-kpi-label">Decision Makers</div>
          <div className="neo-kpi-value" style={{ color: "var(--neo-brand-2)" }}>{summary.decision_makers ?? 0}</div>
        </div>
        <div className="neo-kpi-card">
          <div className="neo-kpi-label">Non Decision Makers</div>
          <div className="neo-kpi-value">{summary.non_decision_makers ?? 0}</div>
        </div>
      </div>

      <div className="neo-tabs">
        <button className={`neo-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All Employees</button>
        <button className={`neo-tab ${tab === "dm" ? "active" : ""}`} onClick={() => setTab("dm")}>Decision Makers Only</button>
      </div>

      <div className="neo-table-wrap">
        <div className="neo-table-header">
          <div className="neo-table-title">Employees</div>
          <button className="neo-btn-secondary neo-btn-sm" onClick={load}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
        <div className="neo-table-scroll">
          <table className="neo-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Authority Status</th>
                <th>What They Can Decide</th>
                <th>Scope</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neu-text-muted)", padding: 32 }}>{loading ? "Loading…" : "No employees found."}</td></tr>
              ) : filtered.map((emp) => {
                const isEditing = editingId === emp.id;
                const form = getForm(emp);
                return (
                  <React.Fragment key={emp.id}>
                    <tr style={{
                      background: emp.is_decision_maker ? "rgba(91,75,255,0.06)" : "transparent",
                      borderLeft: emp.is_decision_maker ? "3px solid #5B4BFF" : "3px solid rgba(255,255,255,0.04)",
                    }}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: "var(--neu-text-muted)" }}>{emp.email}</div>
                        {emp.display_title && <div style={{ fontSize: 10, color: "var(--neo-brand-2)", fontWeight: 700, marginTop: 2 }}>{emp.display_title}</div>}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>{emp.role.replace(/_/g, " ")}</td>
                      <td>
                        {emp.is_decision_maker ? (
                          <span style={{ fontSize: 9, padding: "3px 10px", fontWeight: 800, background: "rgba(91,75,255,0.14)", color: "#7C6CFF", border: "1px solid rgba(91,75,255,0.30)", letterSpacing: "0.06em", display: "inline-block" }}>
                            ⚡ DECISION MAKER
                          </span>
                        ) : (
                          <span style={{ fontSize: 9, padding: "3px 10px", fontWeight: 700, background: "rgba(71,85,105,0.12)", color: "#64748B", border: "1px solid rgba(71,85,105,0.20)", letterSpacing: "0.06em", display: "inline-block" }}>
                            NON DECISION MAKER
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: 260, whiteSpace: "normal" }}>
                        {emp.is_decision_maker ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {PERMISSION_LIST.filter((p) => emp[p.key]).map((p) => (
                              <span key={String(p.key)} style={{ fontSize: 8, padding: "1px 6px", fontWeight: 700, background: "rgba(16,185,129,0.10)", color: "#10B981", border: "0.5px solid rgba(16,185,129,0.25)" }}>
                                {p.icon} {p.label}
                              </span>
                            ))}
                            {PERMISSION_LIST.filter((p) => emp[p.key]).length === 0 && (
                              <span style={{ fontSize: 9, color: "#EF4444" }}>⚠️ No permissions set — assign what they can decide</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--neu-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {emp.is_decision_maker ? (emp.scope === "branch" ? emp.scope_branch_name || "Branch" : emp.scope) : "—"}
                      </td>
                      <td>
                        <button className="neo-btn-secondary neo-btn-sm" onClick={() => (isEditing ? setEditingId(null) : startEdit(emp))}>
                          {isEditing ? "Close" : "Edit"}
                        </button>
                      </td>
                    </tr>

                    {isEditing && (
                      <tr>
                        <td colSpan={6} style={{ background: "rgba(91,75,255,0.03)", padding: 18 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                              <span
                                onClick={() => setForm(emp.id, { is_decision_maker: !form.is_decision_maker })}
                                style={{
                                  width: 40, height: 22, borderRadius: 999, position: "relative", cursor: "pointer",
                                  background: form.is_decision_maker ? "#5B4BFF" : "rgba(148,163,184,0.35)",
                                  transition: "background 150ms",
                                }}
                              >
                                <span style={{
                                  position: "absolute", top: 2, left: form.is_decision_maker ? 20 : 2,
                                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                                  transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                }} />
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-secondary)" }}>
                                {form.is_decision_maker ? "Decision Maker: ON" : "Decision Maker: OFF"}
                              </span>
                            </label>
                          </div>

                          {form.is_decision_maker && (
                            <>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 0" }}>
                                {PERMISSION_LIST.map((perm) => (
                                  <label
                                    key={String(perm.key)}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", cursor: "pointer",
                                      background: form[perm.key] ? "rgba(91,75,255,0.14)" : "rgba(255,255,255,0.04)",
                                      border: form[perm.key] ? "1.5px solid rgba(91,75,255,0.40)" : "1.5px solid rgba(255,255,255,0.08)",
                                      transition: "all 150ms",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!form[perm.key]}
                                      onChange={(e) => setForm(emp.id, { [perm.key]: e.target.checked } as FormState)}
                                      style={{ accentColor: "#5B4BFF", width: 12, height: 12 }}
                                    />
                                    <span style={{ fontSize: 10, fontWeight: 600 }}>{perm.icon}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: form[perm.key] ? "#7C6CFF" : "#64748B" }}>{perm.label}</span>
                                  </label>
                                ))}
                              </div>

                              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--neu-text-muted)" }}>SCOPE:</label>
                                <select
                                  className="neu-select"
                                  value={form.scope || "company"}
                                  onChange={(e) => setForm(emp.id, { scope: e.target.value as Employee["scope"] })}
                                  style={{ width: "auto", padding: "5px 10px", fontSize: 11 }}
                                >
                                  <option value="company">Entire Company</option>
                                  <option value="branch">Specific Branch Only</option>
                                  <option value="team">Their Team Only</option>
                                </select>
                                {form.scope === "branch" && (
                                  <select
                                    className="neu-select"
                                    value={form.scope_branch_id || ""}
                                    onChange={(e) => setForm(emp.id, { scope_branch_id: Number(e.target.value) || null })}
                                    style={{ width: "auto", padding: "5px 10px", fontSize: 11 }}
                                  >
                                    <option value="">Select branch...</option>
                                    {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                                  </select>
                                )}
                              </div>

                              <input
                                className="neu-input"
                                value={form.display_title || ""}
                                onChange={(e) => setForm(emp.id, { display_title: e.target.value })}
                                placeholder="e.g. HR Manager, Finance Head, Floor Supervisor..."
                                style={{ width: 260, marginTop: 10, fontSize: 11, padding: "7px 12px" }}
                              />
                            </>
                          )}

                          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                            <button className="neo-btn-primary neo-btn-sm" disabled={savingId === emp.id} onClick={() => saveAuthority(emp.id)}>
                              {savingId === emp.id ? "Saving…" : "Save Authority"}
                            </button>
                            {savedId === emp.id && <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>✓ Saved</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuthorityManagement;
