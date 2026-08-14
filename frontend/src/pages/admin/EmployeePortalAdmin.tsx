import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface PortalEmployee {
  user_id: number;
  username: string;
  role: string;
  is_active: boolean;
  employee_id: number;
  name: string;
  designation: string | null;
  phone: string | null;
  outstanding_advance: number;
}

interface UnlinkedEmployee {
  id: number;
  name: string;
  designation: string | null;
  phone: string | null;
}

interface Advance {
  id: number;
  employee_id: number;
  employee_name: string;
  amount: number;
  advance_date: string;
  reason: string;
  current_balance: number;
  status: string;
}

const TABS = ["Employees", "Give Advance", "All Advances"] as const;

const EmployeePortalAdmin: React.FC = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Employees");

  const [portalEmployees, setPortalEmployees] = useState<PortalEmployee[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedEmployee[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ employee_id: "", username: "", password: "", role: "field_employee" });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const [advanceForm, setAdvanceForm] = useState({ employee_id: "", amount: "", reason: "", repayment_type: "salary_deduction" });
  const [givingAdvance, setGivingAdvance] = useState(false);
  const [advanceErr, setAdvanceErr] = useState("");
  const [advanceMsg, setAdvanceMsg] = useState("");

  const [repayAmounts, setRepayAmounts] = useState<Record<number, string>>({});

  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ employee_name: string; username: string; email?: string; password: string }[] | null>(null);
  const [bulkFailed, setBulkFailed] = useState<{ name: string; error: string }[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [peRes, unRes, advRes] = await Promise.all([
        apiFetch("/employee-portal/admin/portal-employees"),
        apiFetch("/employee-portal/admin/unlinked-employees"),
        apiFetch("/employee-portal/admin/advances"),
      ]);
      setPortalEmployees(await peRes.json());
      setUnlinked(await unRes.json());
      setAdvances(await advRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const bulkCreateLogins = async () => {
    if (!window.confirm(`Create logins for all ${unlinked.length} employee(s) without one? Temporary passwords will be shown once — save them before closing.`)) return;
    setBulkCreating(true);
    try {
      const res = await apiFetch("/employee-portal/admin/create-logins-bulk", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setBulkResults(data.created || []);
        setBulkFailed(data.failed || []);
        fetchAll();
      } else {
        alert(data.error || "Bulk creation failed");
      }
    } finally {
      setBulkCreating(false);
    }
  };

  const createLogin = async () => {
    if (!createForm.employee_id || !createForm.username || !createForm.password) {
      setCreateErr("Employee, username and password are required");
      return;
    }
    setCreating(true);
    setCreateErr("");
    try {
      const res = await apiFetch("/employee-portal/admin/create-login", {
        method: "POST",
        body: { ...createForm, employee_id: Number(createForm.employee_id) },
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({ employee_id: "", username: "", password: "", role: "field_employee" });
        fetchAll();
      } else {
        setCreateErr(data.error || "Failed to create login");
      }
    } finally {
      setCreating(false);
    }
  };

  const giveAdvance = async () => {
    if (!advanceForm.employee_id || !advanceForm.amount || !advanceForm.reason) {
      setAdvanceErr("Employee, amount and reason are required");
      return;
    }
    setGivingAdvance(true);
    setAdvanceErr("");
    setAdvanceMsg("");
    try {
      const res = await apiFetch("/employee-portal/admin/advances", {
        method: "POST",
        body: { ...advanceForm, employee_id: Number(advanceForm.employee_id), amount: Number(advanceForm.amount) },
      });
      const data = await res.json();
      if (data.success) {
        setAdvanceForm({ employee_id: "", amount: "", reason: "", repayment_type: "salary_deduction" });
        setAdvanceMsg(`Advance of ₹${Number(data.advance.amount).toLocaleString("en-IN")} recorded.`);
        fetchAll();
      } else {
        setAdvanceErr(data.error || "Failed to give advance");
      }
    } finally {
      setGivingAdvance(false);
    }
  };

  const repay = async (advanceId: number) => {
    const amount = Number(repayAmounts[advanceId] || 0);
    if (!amount || amount <= 0) { alert("Enter a valid repayment amount"); return; }
    const res = await apiFetch(`/employee-portal/admin/advances/${advanceId}/repay`, { method: "POST", body: { amount } });
    const data = await res.json();
    if (data.success) {
      setRepayAmounts((p) => ({ ...p, [advanceId]: "" }));
      fetchAll();
    } else {
      alert(data.error || "Failed to record repayment");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Employee Portal</h1>
          <p>Field employee logins, groups & advance ledger — head office controls everything.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: 12,
              background: tab === t ? "#111827" : "#fff",
              color: tab === t ? "#fff" : "#111827",
              cursor: "pointer",
              transition: "all 150ms",
              fontFamily: "inherit",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-empty">Loading…</div>
      ) : tab === "Employees" ? (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {unlinked.length > 0 && (
              <button className="page-btn" disabled={bulkCreating} onClick={bulkCreateLogins}>
                {bulkCreating ? "Creating…" : `Create Logins for All Employees (${unlinked.length})`}
              </button>
            )}
            <button className="page-btn page-btn-primary" onClick={() => setShowCreateModal(true)}>+ Create Employee Login</button>
          </div>
          <div className="page-table-wrapper">
            {portalEmployees.length === 0 ? (
              <div className="page-empty">No portal logins created yet.</div>
            ) : (
              <table className="page-table">
                <thead><tr><th>Employee</th><th>Username</th><th>Designation</th><th>Phone</th><th className="text-right">Outstanding Advance</th></tr></thead>
                <tbody>
                  {portalEmployees.map((e) => (
                    <tr key={e.user_id}>
                      <td className="font-bold">{e.name}</td>
                      <td className="font-mono">{e.username}</td>
                      <td>{e.designation || "—"}</td>
                      <td>{e.phone || "—"}</td>
                      <td className="text-right" style={{ color: Number(e.outstanding_advance) > 0 ? "#dc2626" : "inherit", fontWeight: 700 }}>
                        ₹{Number(e.outstanding_advance).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : tab === "Give Advance" ? (
        <div className="page-modal" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h2>Give Salary Advance</h2>
          {advanceErr && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{advanceErr}</div>}
          {advanceMsg && <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{advanceMsg}</div>}
          <label>Employee *</label>
          <select
            value={advanceForm.employee_id}
            onChange={(e) => setAdvanceForm((p) => ({ ...p, employee_id: e.target.value }))}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}
          >
            <option value="">Select employee…</option>
            {portalEmployees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.username})</option>)}
          </select>
          <label>Amount (₹) *</label>
          <input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm((p) => ({ ...p, amount: e.target.value }))} />
          <label>Reason *</label>
          <input value={advanceForm.reason} onChange={(e) => setAdvanceForm((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. Medical emergency" />
          <label>Repayment Type</label>
          <select
            value={advanceForm.repayment_type}
            onChange={(e) => setAdvanceForm((p) => ({ ...p, repayment_type: e.target.value }))}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}
          >
            <option value="salary_deduction">Salary Deduction</option>
            <option value="cash_return">Cash Return</option>
            <option value="adjust_wages">Adjust Wages</option>
            <option value="other">Other</option>
          </select>
          <button className="page-modal-save" style={{ width: "100%" }} disabled={givingAdvance} onClick={giveAdvance}>
            {givingAdvance ? "Saving…" : "Give Advance"}
          </button>
        </div>
      ) : (
        <div className="page-table-wrapper">
          {advances.length === 0 ? (
            <div className="page-empty">No advances recorded yet.</div>
          ) : (
            <table className="page-table">
              <thead><tr><th>Date</th><th>Employee</th><th>Reason</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th>Status</th><th className="text-center">Repay</th></tr></thead>
              <tbody>
                {advances.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono">{a.advance_date?.slice(0, 10)}</td>
                    <td className="font-bold">{a.employee_name}</td>
                    <td>{a.reason}</td>
                    <td className="text-right">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                    <td className="text-right" style={{ color: Number(a.current_balance) > 0 ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                      ₹{Number(a.current_balance).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span className={`type-badge ${a.status === "ACTIVE" ? "type-badge-red" : "type-badge-green"}`}>{a.status}</span>
                    </td>
                    <td className="text-center">
                      {Number(a.current_balance) > 0 && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <input
                            type="number"
                            placeholder="₹"
                            value={repayAmounts[a.id] || ""}
                            onChange={(e) => setRepayAmounts((p) => ({ ...p, [a.id]: e.target.value }))}
                            style={{ width: 80, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)" }}
                          />
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => repay(a.id)}>Record</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {bulkResults && (
        <div className="page-modal-overlay">
          <div className="page-modal" style={{ maxWidth: 560 }}>
            <h2>Employee Logins Created</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: -8, marginBottom: 14 }}>
              These passwords are shown only once. Save or share them with each employee now — they cannot be recovered later, only reset.
            </p>
            {bulkResults.length === 0 ? (
              <div className="page-empty">No logins were created.</div>
            ) : (
              <div className="page-table-wrapper" style={{ marginBottom: 14 }}>
                <table className="page-table">
                  <thead><tr><th>Employee</th><th>Username</th><th>Email</th><th>Password</th></tr></thead>
                  <tbody>
                    {bulkResults.map((r) => (
                      <tr key={r.username}>
                        <td className="font-bold">{r.employee_name}</td>
                        <td className="font-mono">{r.username}</td>
                        <td className="font-mono">{r.email || "—"}</td>
                        <td className="font-mono">{r.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {bulkFailed.length > 0 && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                {bulkFailed.length} could not be created: {bulkFailed.map((f) => `${f.name} (${f.error})`).join(", ")}
              </div>
            )}
            <div className="page-modal-actions">
              <button className="page-modal-save" style={{ width: "100%" }} onClick={() => { setBulkResults(null); setBulkFailed([]); }}>
                I've saved these — Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="page-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Employee Login</h2>
            {createErr && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{createErr}</div>}
            <label>Employee *</label>
            <select
              value={createForm.employee_id}
              onChange={(e) => setCreateForm((p) => ({ ...p, employee_id: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}
            >
              <option value="">Select employee…</option>
              {unlinked.map((e) => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ""}</option>)}
            </select>
            {unlinked.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: -8, marginBottom: 14 }}>All employees already have a login, or none exist yet under Employees.</p>}
            <label>Username *</label>
            <input value={createForm.username} onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))} placeholder="e.g. arumugam" />
            <label>Password *</label>
            <input type="text" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} placeholder="Temporary password" />
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={creating} onClick={createLogin}>{creating ? "Creating…" : "Create Login"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeePortalAdmin;
