import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { FaPlus, FaEdit, FaKey, FaUserSlash, FaUserCheck, FaShieldAlt } from "react-icons/fa";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface Branch {
  id: number;
  branch_name: string;
  branch_code: string;
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:          { bg: "#ede9fe", color: "#6d28d9" },
  superadmin:     { bg: "#ede9fe", color: "#6d28d9" },
  branch_manager: { bg: "#d1fae5", color: "#065f46" },
  accountant:     { bg: "#fef3c7", color: "#92400e" },
  viewer:         { bg: "#f1f5f9", color: "#475569" },
  staff:          { bg: "#dbeafe", color: "#1e40af" },
};

const ROLES = ["admin", "branch_manager", "accountant", "viewer", "staff"];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers]     = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showResetModal, setShowResetModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    username: "", email: "", password: "", role: "branch_manager", branch_id: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        apiFetch("/users/staff"),
        apiFetch("/branches"),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (bRes.ok) setBranches(await bRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const openAdd = () => {
    setEditUser(null);
    setForm({ username: "", email: "", password: "", role: "branch_manager", branch_id: "" });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ username: u.username, email: u.email, password: "", role: u.role, branch_id: String(u.branch_id || "") });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = { username: form.username, email: form.email, role: form.role, branch_id: form.branch_id || null };
      if (!editUser) body.password = form.password;
      const res = await apiFetch(editUser ? `/users/staff/${editUser.id}` : "/users/staff", {
        method: editUser ? "PUT" : "POST",
        body,
      });
      const data = await res.json();
      if (res.ok) {
        flash(editUser ? "User updated" : "User created");
        setShowModal(false);
        load();
      } else {
        flash(data.error || "Failed", false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!showResetModal || !newPassword) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/users/staff/${showResetModal.id}/reset-password`, {
        method: "POST",
        body: { new_password: newPassword },
      });
      const data = await res.json();
      if (res.ok) { flash("Password reset successfully"); setShowResetModal(null); setNewPassword(""); }
      else flash(data.error || "Failed", false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    const res = await apiFetch(`/users/staff/${u.id}`, {
      method: "PUT",
      body: { is_active: !u.is_active },
    });
    if (res.ok) { flash(u.is_active ? "User deactivated" : "User activated"); load(); }
  };

  const RoleBadge = ({ role }: { role: string }) => {
    const style = ROLE_COLORS[role] || ROLE_COLORS.viewer;
    return (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: style.bg, color: style.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {role.replace("_", " ")}
      </span>
    );
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            Manage staff logins, roles and branch assignments
          </p>
        </div>
        <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
          background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600,
          fontSize: 14, cursor: "pointer" }}>
          <FaPlus size={12} /> Add User
        </button>
      </div>

      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.ok ? "#d1fae5" : "#fee2e2", color: msg.ok ? "#065f46" : "#dc2626" }}>
          {msg.text}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading users…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                {["Name", "Email", "Role", "Branch", "Last Login", "Status", "Permissions", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600,
                    color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 14 }}>{u.username}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>{u.email}</td>
                  <td style={{ padding: "14px 16px" }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                    {u.branch_name || <span style={{ color: "#9ca3af" }}>All branches</span>}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#6b7280" }}>{fmt(u.last_login)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: u.is_active ? "#d1fae5" : "#fee2e2",
                      color: u.is_active ? "#065f46" : "#dc2626" }}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button onClick={() => navigate(`/admin/users/${u.id}/permissions`)}
                      title="Manage Permissions"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                        borderRadius: 6, border: "0.5px solid #c7d2fe", background: "#eef2ff",
                        cursor: "pointer", color: "#4f46e5", fontSize: 12, fontWeight: 600 }}>
                      <FaShieldAlt size={11} /> Permissions
                    </button>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(u)} title="Edit"
                        style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid #e5e7eb",
                          background: "#f9fafb", cursor: "pointer", color: "#374151" }}>
                        <FaEdit size={12} />
                      </button>
                      <button onClick={() => { setShowResetModal(u); setNewPassword(""); }} title="Reset Password"
                        style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid #e5e7eb",
                          background: "#f9fafb", cursor: "pointer", color: "#374151" }}>
                        <FaKey size={12} />
                      </button>
                      <button onClick={() => toggleActive(u)}
                        title={u.is_active ? "Deactivate" : "Activate"}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid #e5e7eb",
                          background: "#f9fafb", cursor: "pointer",
                          color: u.is_active ? "#dc2626" : "#059669" }}>
                        {u.is_active ? <FaUserSlash size={12} /> : <FaUserCheck size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", width: 440,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 24px" }}>
              {editUser ? "Edit User" : "Add User"}
            </h2>
            <form onSubmit={handleSave}>
              {[
                { label: "Full Name", key: "username", type: "text", placeholder: "Ravi Kumar" },
                { label: "Email", key: "email", type: "email", placeholder: "ravi@jbsknitwear.com" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder} required
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                      border: "0.5px solid #d1d5db", boxSizing: "border-box" }} />
                </div>
              ))}

              {!editUser && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Password</label>
                  <input type="password" value={form.password} placeholder="Min 8 characters" required
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                      border: "0.5px solid #d1d5db", boxSizing: "border-box" }} />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                    border: "0.5px solid #d1d5db", boxSizing: "border-box" }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace("_", " ").toUpperCase()}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Branch {form.role === "branch_manager" ? "(Required)" : "(Optional)"}
                </label>
                <select value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}
                  required={form.role === "branch_manager"}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                    border: "0.5px solid #d1d5db", boxSizing: "border-box" }}>
                  <option value="">— All Branches (Admin) —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: "11px", borderRadius: 8, border: "0.5px solid #d1d5db",
                    background: "#f9fafb", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none",
                    background: "#4f46e5", color: "#fff", fontWeight: 600, fontSize: 14,
                    cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : editUser ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", width: 380,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Reset Password</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
              Setting new password for <strong>{showResetModal.username}</strong>
            </p>
            <input type="password" value={newPassword} placeholder="New password (min 8 chars)"
              onChange={e => setNewPassword(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                border: "0.5px solid #d1d5db", boxSizing: "border-box", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetModal(null)}
                style={{ flex: 1, padding: "11px", borderRadius: 8, border: "0.5px solid #d1d5db",
                  background: "#f9fafb", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleResetPassword} disabled={!newPassword || saving}
                style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none",
                  background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer",
                  opacity: !newPassword || saving ? 0.7 : 1 }}>
                {saving ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
