import React, { useEffect, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Group {
  id: number;
  name: string;
  leader_id: number | null;
  leader_name: string | null;
  member_count: number;
  is_active: boolean;
}

interface StaffUser {
  id: number;
  username: string;
  role: string;
}

interface Member {
  employee_id: number;
  username: string;
  role: string;
}

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [onDutyStaff, setOnDutyStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/work-accountability/groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const [staffRes, portalRes] = await Promise.all([
        apiFetch("/users/staff"),
        apiFetch("/employee-portal/admin/portal-employees").catch(() => null),
      ]);
      const staffData = await staffRes.json();
      const portalData = portalRes ? await portalRes.json().catch(() => []) : [];
      const merged: StaffUser[] = Array.isArray(staffData) ? [...staffData] : [];
      if (Array.isArray(portalData)) {
        for (const p of portalData) {
          if (!merged.some((s) => s.id === p.user_id)) {
            merged.push({ id: p.user_id, username: p.username, role: p.role });
          }
        }
      }
      setStaff(merged);
    } catch { setStaff([]); }
  };

  // Separate from `staff` (used by the Leader picker below, which should
  // still list everyone) — this is only for the "Add Member" dropdown.
  const fetchOnDutyStaff = async () => {
    try {
      const res = await apiFetch("/employee-portal/admin/on-duty-employees");
      const data = await res.json();
      setOnDutyStaff(Array.isArray(data) ? data : []);
    } catch { setOnDutyStaff([]); }
  };

  useEffect(() => { fetchGroups(); fetchStaff(); fetchOnDutyStaff(); }, []);

  const createGroup = async () => {
    if (!name.trim()) { setErr("Group name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await apiFetch("/work-accountability/groups", {
        method: "POST",
        body: { name, leader_id: leaderId || undefined },
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setName(""); setLeaderId("");
        fetchGroups();
      } else {
        setErr(data.error || "Failed to create group");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = async (groupId: number) => {
    if (expandedId === groupId) { setExpandedId(null); return; }
    setExpandedId(groupId);
    setMembersLoading(true);
    try {
      const res = await apiFetch(`/work-accountability/groups/${groupId}/members`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } finally {
      setMembersLoading(false);
    }
  };

  const addMember = async (groupId: number) => {
    if (!addMemberId) return;
    setAddingMember(true);
    try {
      const res = await apiFetch(`/work-accountability/groups/${groupId}/members`, {
        method: "POST",
        body: { employee_id: Number(addMemberId) },
      });
      const data = await res.json();
      if (data.success) {
        setAddMemberId("");
        const res2 = await apiFetch(`/work-accountability/groups/${groupId}/members`);
        const data2 = await res2.json();
        setMembers(Array.isArray(data2) ? data2 : []);
        fetchGroups();
      } else {
        alert(data.error || "Failed to add member");
      }
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (groupId: number, employeeId: number) => {
    if (!window.confirm("Remove this member from the group?")) return;
    await apiFetch(`/work-accountability/groups/${groupId}/members/${employeeId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.employee_id !== employeeId));
    fetchGroups();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p>Employee groups used for job assignment and group attendance.</p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 12, fontWeight: 600, fontSize: 13,
              whiteSpace: "nowrap", border: "1px solid transparent",
              background: "#6366f1", color: "#fff",
              cursor: "pointer", transition: "all 150ms",
            }}
          >
            <FaPlus /> New Group
          </button>
        </div>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="page-empty">No groups yet. Create one to start assigning jobs and marking group attendance.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Group</th><th>Leader</th><th>Members</th><th></th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.id}>
                  <tr>
                    <td className="font-bold">{g.name}</td>
                    <td>{g.leader_name || "—"}</td>
                    <td>{g.member_count}</td>
                    <td className="text-center">
                      <button className="page-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => toggleGroup(g.id)}>
                        {expandedId === g.id ? "Hide" : "Manage Members"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === g.id && (
                    <tr>
                      <td colSpan={4} style={{ background: "#f8fafc", padding: "16px 20px" }}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            value={addMemberId}
                            onChange={(e) => setAddMemberId(e.target.value)}
                            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 220 }}
                          >
                            <option value="">Select on-duty staff to add…</option>
                            {onDutyStaff
                              .filter((s) => !members.some((m) => m.employee_id === s.id))
                              .map((s) => <option key={s.id} value={s.id}>{s.username} ({s.role})</option>)}
                          </select>
                          <button className="page-btn page-btn-primary" disabled={!addMemberId || addingMember} onClick={() => addMember(g.id)}>
                            {addingMember ? "Adding…" : "Add Member"}
                          </button>
                        </div>

                        {membersLoading ? (
                          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Loading members…</div>
                        ) : members.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No members yet.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {members.map((m) => (
                              <div key={m.employee_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px" }}>
                                <span style={{ fontSize: 13 }}>{m.username} <span style={{ color: "var(--text-3)", fontSize: 11.5 }}>({m.role})</span></span>
                                <button onClick={() => removeMember(g.id, m.employee_id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 4 }} aria-label="Remove member">
                                  <FaTrash size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="page-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Group</h2>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}
            <label>Group Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Packing Team A" />
            <label>Leader (optional)</label>
            <select value={leaderId} onChange={(e) => setLeaderId(e.target.value)} style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}>
              <option value="">No leader</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.username} ({s.role})</option>)}
            </select>
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={saving} onClick={createGroup}>{saving ? "Saving…" : "Create Group"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
