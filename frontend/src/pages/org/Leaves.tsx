// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Leave {
  id: number;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string;
  status: string;
}
interface Employee { id: number; name: string; }

const TABS = ["all", "pending", "approved", "rejected"] as const;

const OrgLeaves: React.FC = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type: "casual", from_date: "", to_date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const qs = tab === "all" ? "" : `?status=${tab}`;
      const [leaveRes, empRes] = await Promise.all([
        apiFetch(`/org/leaves${qs}`).then((r) => r.json()),
        apiFetch("/org/employees?status=active").then((r) => r.json()),
      ]);
      setLeaves(Array.isArray(leaveRes) ? leaveRes : []);
      setEmployees(Array.isArray(empRes) ? empRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [tab]);

  const submit = async () => {
    if (!form.employee_id || !form.from_date || !form.to_date) { setErr("Employee, from and to date are required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await apiFetch("/org/leaves", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setForm({ employee_id: "", leave_type: "casual", from_date: "", to_date: "", reason: "" });
        fetchAll();
      } else {
        setErr(data.error || "Failed to apply leave");
      }
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: number, action: "approve" | "reject") => {
    if (action === "reject" && !window.confirm("Reject this leave request?")) return;
    await apiFetch(`/org/leaves/${id}/approve`, { method: "POST", body: { action } });
    fetchAll();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Leaves</h1>
          <p>Leave requests for Fluxora staff.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn page-btn-primary" onClick={() => setShowModal(true)}><FaPlus /> Apply Leave</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="page-btn" style={{ textTransform: "capitalize", background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111827" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : leaves.length === 0 ? (
          <div className="page-empty">No leave requests here.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th className="text-right">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td className="font-bold">{l.employee_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{l.leave_type}</td>
                  <td>{l.from_date?.slice(0, 10)}</td>
                  <td>{l.to_date?.slice(0, 10)}</td>
                  <td className="text-right">{l.total_days}</td>
                  <td style={{ maxWidth: 200 }}>{l.reason || "—"}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, textTransform: "uppercase", background: l.status === "approved" ? "#dcfce7" : l.status === "rejected" ? "#fee2e2" : "#fef9c3", color: l.status === "approved" ? "#166534" : l.status === "rejected" ? "#991b1b" : "#854d0e" }}>
                      {l.status}
                    </span>
                  </td>
                  <td>
                    {l.status === "pending" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#166534" }} onClick={() => decide(l.id, "approve")}>Approve</button>
                        <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#991b1b" }} onClick={() => decide(l.id, "reject")}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="page-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Apply Leave</h2>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}
            <label>Employee *</label>
            <select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}>
              <option value="">— Select —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <label>Leave Type</label>
            <select value={form.leave_type} onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))}>
              {["casual", "sick", "earned", "maternity", "paternity", "unpaid", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label>From *</label>
            <input type="date" value={form.from_date} onChange={(e) => setForm((p) => ({ ...p, from_date: e.target.value }))} />
            <label>To *</label>
            <input type="date" value={form.to_date} onChange={(e) => setForm((p) => ({ ...p, to_date: e.target.value }))} />
            <label>Reason</label>
            <input value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgLeaves;
