import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../utils/api";

interface PermModule {
  module_key: string;
  display_name: string;
  category: string;
  description: string;
}

interface UserPerm {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Template {
  id: number;
  name: string;
  description: string;
}

const ACTIONS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
type Action = typeof ACTIONS[number];

const ACTION_LABEL: Record<Action, string> = {
  can_view:   "View",
  can_create: "Create",
  can_edit:   "Edit",
  can_delete: "Delete",
};

const ACTION_COLOR: Record<Action, string> = {
  can_view:   "#3b82f6",
  can_create: "#10b981",
  can_edit:   "#f59e0b",
  can_delete: "#ef4444",
};

const UserPermissionsEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [username, setUsername]   = useState("");
  const [modules, setModules]     = useState<PermModule[]>([]);
  const [perms, setPerms]         = useState<Record<string, UserPerm>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTpl, setSelectedTpl] = useState("");
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);
  const [applying, setApplying]   = useState(false);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tplRes, permRes] = await Promise.all([
          apiFetch("/admin/permission-templates"),
          apiFetch(`/admin/users/${id}/permissions`),
        ]);
        if (tplRes.ok) setTemplates(await tplRes.json());
        if (permRes.ok) {
          const data = await permRes.json();
          setUsername(data.username || "");
          setModules(data.modules || []);
          const map: Record<string, UserPerm> = {};
          (data.permissions || []).forEach((p: UserPerm) => { map[p.module_key] = p; });
          setPerms(map);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggle = (moduleKey: string, action: Action) => {
    setPerms(prev => {
      const cur = prev[moduleKey] || { module_key: moduleKey, can_view: false, can_create: false, can_edit: false, can_delete: false };
      const updated = { ...cur, [action]: !cur[action] };
      // Enabling create/edit/delete auto-enables view
      if (action !== "can_view" && updated[action]) updated.can_view = true;
      // Disabling view disables everything
      if (action === "can_view" && !updated.can_view) {
        updated.can_create = false; updated.can_edit = false; updated.can_delete = false;
      }
      return { ...prev, [moduleKey]: updated };
    });
  };

  const toggleAll = (moduleKey: string, grant: boolean) => {
    setPerms(prev => ({
      ...prev,
      [moduleKey]: {
        module_key: moduleKey,
        can_view:   grant,
        can_create: grant,
        can_edit:   grant,
        can_delete: grant,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permissions = modules.map(m => ({
        module_key: m.module_key,
        ...(perms[m.module_key] || { can_view: false, can_create: false, can_edit: false, can_delete: false }),
      }));
      const res = await apiFetch(`/admin/users/${id}/permissions`, { method: "POST", body: { permissions } });
      if (res.ok) flash("Permissions saved successfully");
      else { const d = await res.json(); flash(d.error || "Failed to save", false); }
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = async () => {
    if (!selectedTpl) return;
    if (!window.confirm("This will replace all current permissions. Continue?")) return;
    setApplying(true);
    try {
      const res = await apiFetch(`/admin/users/${id}/apply-template`, {
        method: "POST", body: { template_id: Number(selectedTpl) },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Re-fetch to get updated permissions
        const permRes = await apiFetch(`/admin/users/${id}/permissions`);
        if (permRes.ok) {
          const d = await permRes.json();
          const map: Record<string, UserPerm> = {};
          (d.permissions || []).forEach((p: UserPerm) => { map[p.module_key] = p; });
          setPerms(map);
        }
        flash("Template applied — review and save");
      } else {
        flash(data.error || "Failed", false);
      }
    } finally {
      setApplying(false);
    }
  };

  // Group modules by category
  const categories = [...new Set(modules.map(m => m.category))];

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate("/admin/users")}
          style={{ padding: "8px 14px", borderRadius: 8, border: "0.5px solid #d1d5db",
            background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          ← Back
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Permissions — {username}
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "3px 0 0" }}>
            Control which modules this user can view, create, edit, or delete
          </p>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.ok ? "#d1fae5" : "#fee2e2", color: msg.ok ? "#065f46" : "#dc2626" }}>
          {msg.text}
        </div>
      )}

      {/* Template quick-apply */}
      <div style={{ background: "#f8fafc", border: "0.5px solid #e5e7eb", borderRadius: 10,
        padding: "16px 20px", marginBottom: 24, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Quick Apply Template:</span>
        <select value={selectedTpl} onChange={e => setSelectedTpl(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 7, border: "0.5px solid #d1d5db",
            fontSize: 13, minWidth: 200 }}>
          <option value="">— select a template —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={applyTemplate} disabled={!selectedTpl || applying}
          style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#6366f1",
            color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
            opacity: !selectedTpl || applying ? 0.6 : 1 }}>
          {applying ? "Applying…" : "Apply"}
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Templates pre-fill permissions; review before saving.</span>
      </div>

      {/* Module permission matrix */}
      {categories.map(cat => {
        const catModules = modules.filter(m => m.category === cat);
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
              letterSpacing: "0.08em", margin: "0 0 10px", padding: "0 4px" }}>{cat}</h3>
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", width: "35%" }}>
                      Module
                    </th>
                    {ACTIONS.map(a => (
                      <th key={a} style={{ padding: "10px 12px", textAlign: "center", fontSize: 11,
                        fontWeight: 600, color: ACTION_COLOR[a], textTransform: "uppercase",
                        letterSpacing: "0.05em", width: "12%" }}>
                        {ACTION_LABEL[a]}
                      </th>
                    ))}
                    <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 600,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>All</th>
                  </tr>
                </thead>
                <tbody>
                  {catModules.map((mod, i) => {
                    const p = perms[mod.module_key] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
                    const allOn = ACTIONS.every(a => p[a]);
                    return (
                      <tr key={mod.module_key}
                        style={{ borderBottom: i < catModules.length - 1 ? "0.5px solid #f3f4f6" : "none" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{mod.display_name}</div>
                          {mod.description && (
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{mod.description}</div>
                          )}
                        </td>
                        {ACTIONS.map(a => (
                          <td key={a} style={{ padding: "12px", textAlign: "center" }}>
                            <label style={{ display: "inline-flex", cursor: "pointer", position: "relative" }}>
                              <input type="checkbox" checked={!!p[a]} onChange={() => toggle(mod.module_key, a)}
                                style={{ display: "none" }} />
                              <span style={{
                                width: 20, height: 20, borderRadius: 5, border: `2px solid ${p[a] ? ACTION_COLOR[a] : "#d1d5db"}`,
                                background: p[a] ? ACTION_COLOR[a] : "#fff",
                                display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                              }}>
                                {p[a] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>}
                              </span>
                            </label>
                          </td>
                        ))}
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <button onClick={() => toggleAll(mod.module_key, !allOn)}
                            style={{ padding: "4px 10px", borderRadius: 5, border: "0.5px solid #d1d5db",
                              background: allOn ? "#fee2e2" : "#d1fae5",
                              color: allOn ? "#dc2626" : "#065f46",
                              fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            {allOn ? "Clear" : "All"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Save bar */}
      <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)", padding: "16px 0", borderTop: "0.5px solid #e5e7eb",
        display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
        <button onClick={() => navigate("/admin/users")}
          style={{ padding: "11px 24px", borderRadius: 8, border: "0.5px solid #d1d5db",
            background: "#f9fafb", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "11px 28px", borderRadius: 8, border: "none",
            background: "#4f46e5", color: "#fff", fontWeight: 600, fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Permissions"}
        </button>
      </div>
    </div>
  );
};

export default UserPermissionsEditor;
