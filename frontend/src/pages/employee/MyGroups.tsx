import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface GroupRow {
  group_id: number;
  group_name: string;
  member_count: number;
  attendance_id: number | null;
  status: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  present: "#10B981",
  absent: "#EF4444",
  half_day: "#F59E0B",
  on_leave: "#8B5CF6",
};

const MyGroups: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [err, setErr] = useState<Record<number, string>>({});

  const token = localStorage.getItem("erp-employee-token");

  const fetchGroups = async () => {
    if (!token) { navigate("/employee-login"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employee-portal/my-groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { navigate("/employee-login"); return; }
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = async (group: GroupRow, status: "present" | "absent" | "half_day" | "on_leave") => {
    setSubmittingId(group.group_id);
    setErr((p) => ({ ...p, [group.group_id]: "" }));
    try {
      const res = await fetch(`${API_BASE}/employee-portal/mark-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ group_id: group.group_id, status }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Marked ${status.replace("_", " ")} for ${data.members_marked} member(s) of ${group.group_name}`);
        fetchGroups();
      } else {
        setErr((p) => ({ ...p, [group.group_id]: data.error || "Failed to mark attendance" }));
      }
    } catch (e: any) {
      setErr((p) => ({ ...p, [group.group_id]: e.message || "Failed to mark attendance" }));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Satoshi', sans-serif" }}>
      <nav style={{ background: "white", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate("/employee/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
          <FaArrowLeft size={16} />
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>My Groups & Attendance</h2>
      </nav>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading…</p>
        ) : groups.length === 0 ? (
          <div style={{ background: "white", borderRadius: 16, padding: 40, textAlign: "center", color: "#94a3b8" }}>
            You are not a member of any group yet. Contact head office.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => {
              const isMarked = !!g.attendance_id;
              return (
                <div key={g.group_id} style={{ background: "white", borderRadius: 20, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>{g.group_name}</div>
                      <div style={{ fontSize: 12.5, color: "#94a3b8" }}>{g.member_count} member{g.member_count === 1 ? "" : "s"}</div>
                    </div>
                    {isMarked && (
                      <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[g.status || ""]}18`, color: STATUS_COLOR[g.status || ""] }}>
                        {(g.status || "").replace("_", " ").toUpperCase()}
                      </span>
                    )}
                  </div>

                  {isMarked ? (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: "#94a3b8" }}>
                      Marked by <strong style={{ color: "#475569" }}>{g.marked_by_name}</strong>
                      {g.marked_at && <> at {new Date(g.marked_at).toLocaleTimeString()}</>}
                    </div>
                  ) : (
                    <>
                      {err[g.group_id] && (
                        <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginTop: 10 }}>
                          {err[g.group_id]}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        <button
                          disabled={submittingId === g.group_id}
                          onClick={() => mark(g, "present")}
                          style={{ flex: 1, padding: 16, borderRadius: 12, border: "none", background: "#10B981", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: submittingId === g.group_id ? 0.6 : 1 }}
                        >
                          ✓ MARK PRESENT
                        </button>
                        <button
                          disabled={submittingId === g.group_id}
                          onClick={() => mark(g, "absent")}
                          style={{ flex: 1, padding: 16, borderRadius: 12, border: "none", background: "#EF4444", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: submittingId === g.group_id ? 0.6 : 1 }}
                        >
                          ✕ MARK ABSENT
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyGroups;
