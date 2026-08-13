import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface GroupRow {
  group_id: number;
  group_name: string;
  member_count: number;
  attendance_id: number | null;
  status: string | null;
  marked_by: number | null;
  marked_at: string | null;
  marked_by_name: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  present: "#10B981",
  absent: "#EF4444",
  half_day: "#F59E0B",
  on_leave: "#8B5CF6",
};

const MarkAttendance: React.FC = () => {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [err, setErr] = useState<Record<number, string>>({});

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/work-attendance/my-groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  const resetOptionalFields = () => {
    setStartTime(""); setEndTime(""); setNotes(""); setPhotoUrl(""); setLocation(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo too large — please pick one under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const getLocation = () => {
    if (!navigator.geolocation) { alert("Location not supported on this device."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { alert("Could not get location."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mark = async (group: GroupRow, status: "present" | "absent" | "half_day" | "on_leave") => {
    setSubmittingId(group.group_id);
    setErr((p) => ({ ...p, [group.group_id]: "" }));
    try {
      const res = await apiFetch("/work-attendance/mark", {
        method: "POST",
        body: {
          group_id: group.group_id,
          status,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
          notes: notes || undefined,
          photo_url: photoUrl || undefined,
          location_lat: location?.lat,
          location_lng: location?.lng,
        },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `Attendance marked for ${data.members_count} members`);
        resetOptionalFields();
        setExpandedId(null);
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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Mark Group Attendance</h1>
          <p>{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {loading ? (
        <div className="page-empty">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="page-empty">You are not a member of any group yet. Ask an admin to add you to a group.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => {
            const isMarked = !!g.attendance_id;
            const isExpanded = expandedId === g.group_id;
            return (
              <div key={g.group_id} className="page-modal" style={{ maxWidth: "none", margin: 0, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{g.group_name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{g.member_count} member{g.member_count === 1 ? "" : "s"}</div>
                  </div>
                  {isMarked && (
                    <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[g.status || ""]}18`, color: STATUS_COLOR[g.status || ""] }}>
                      {(g.status || "").replace("_", " ").toUpperCase()}
                    </span>
                  )}
                </div>

                {isMarked ? (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-3)" }}>
                    Marked by <strong style={{ color: "var(--text-2)" }}>{g.marked_by_name}</strong>
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
                        style={{ flex: 1, padding: "16px", borderRadius: 12, border: "none", background: "#10B981", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: submittingId === g.group_id ? 0.6 : 1 }}
                      >
                        ✓ MARK PRESENT
                      </button>
                      <button
                        disabled={submittingId === g.group_id}
                        onClick={() => mark(g, "absent")}
                        style={{ flex: 1, padding: "16px", borderRadius: 12, border: "none", background: "#EF4444", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: submittingId === g.group_id ? 0.6 : 1 }}
                      >
                        ✕ MARK ABSENT
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                      <button disabled={submittingId === g.group_id} onClick={() => mark(g, "half_day")} className="page-btn" style={{ flex: 1 }}>Half Day</button>
                      <button disabled={submittingId === g.group_id} onClick={() => mark(g, "on_leave")} className="page-btn" style={{ flex: 1 }}>On Leave</button>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : g.group_id)}
                      style={{ marginTop: 10, background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      {isExpanded ? "− Hide optional details" : "+ Add optional details (time, notes, photo, location)"}
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Start Time</label>
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>End Time</label>
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box" }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Notes</label>
                          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <label className="page-btn" style={{ cursor: "pointer" }}>
                            📷 {photoUrl ? "Photo attached" : "Add Photo"}
                            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                          </label>
                          <button type="button" className="page-btn" onClick={getLocation} disabled={locating}>
                            📍 {locating ? "Locating…" : location ? "Location captured" : "Get Current Location"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;
