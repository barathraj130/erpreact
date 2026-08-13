import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface TodayGroup {
  group_id: number;
  group_name: string;
  member_count: number;
  attendance_id: number | null;
  status: string | null;
  marked_by: number | null;
  marked_at: string | null;
  start_time: string | null;
  end_time: string | null;
  marked_by_name: string | null;
  is_marked: boolean;
}

interface HistoryRow {
  id: number;
  attendance_date: string;
  status: string;
  marked_by_name: string;
  marked_at: string;
  member_count: number;
  notes: string | null;
  photo_url: string | null;
  location_address: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  present: "#10B981",
  absent: "#EF4444",
  half_day: "#F59E0B",
  on_leave: "#8B5CF6",
};

const AttendanceDashboard: React.FC = () => {
  const [summary, setSummary] = useState<{ total?: number; marked?: number; present?: number; absent?: number; unmarked?: number }>({});
  const [groups, setGroups] = useState<TodayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchToday = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/work-attendance/today");
      const data = await res.json();
      setSummary(data.summary || {});
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchToday(); }, []);

  const toggleGroup = async (groupId: number) => {
    if (expandedGroup === groupId) { setExpandedGroup(null); return; }
    setExpandedGroup(groupId);
    setHistoryLoading(true);
    try {
      const res = await apiFetch(`/work-attendance/group/${groupId}?month=${historyMonth}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (expandedGroup) toggleGroup(expandedGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyMonth]);

  const exportCsv = () => {
    const header = ["Group", "Members", "Status", "Marked By", "Marked At", "Start", "End"];
    const rows = groups.map((g) => [
      g.group_name, g.member_count, g.status || "not marked", g.marked_by_name || "", g.marked_at || "", g.start_time || "", g.end_time || "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { label: "Total Groups", value: summary.total ?? 0, color: "#5B4BFF" },
    { label: "Marked", value: summary.marked ?? 0, color: "#0EA5E9" },
    { label: "Present", value: summary.present ?? 0, color: "#10B981" },
    { label: "Absent", value: summary.absent ?? 0, color: "#EF4444" },
    { label: "Not Marked Yet", value: summary.unmarked ?? 0, color: "#F59E0B" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Attendance Report</h1>
          <p>Group attendance for {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: 8 }}>
          <button className="page-btn" onClick={fetchToday}>Refresh</button>
          <button className="page-btn page-btn-primary" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", borderLeft: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="page-empty">No groups found. Create a group under Work Accountability first.</div>
        ) : (
          <table className="page-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Members</th>
                <th>Status</th>
                <th>Marked By</th>
                <th>Marked At</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.group_id}>
                  <tr>
                    <td className="font-bold">{g.group_name}</td>
                    <td>{g.member_count}</td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
                        background: g.is_marked ? `${STATUS_COLOR[g.status || ""]}18` : "#fef9c318",
                        color: g.is_marked ? STATUS_COLOR[g.status || ""] : "#a16207",
                      }}>
                        {g.is_marked ? (g.status || "").replace("_", " ").toUpperCase() : "NOT MARKED"}
                      </span>
                    </td>
                    <td>{g.marked_by_name || "—"}</td>
                    <td className="font-mono">{g.marked_at ? new Date(g.marked_at).toLocaleTimeString() : "—"}</td>
                    <td className="text-center">
                      <button className="page-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => toggleGroup(g.group_id)}>
                        {expandedGroup === g.group_id ? "Hide" : "History"}
                      </button>
                    </td>
                  </tr>
                  {expandedGroup === g.group_id && (
                    <tr>
                      <td colSpan={6} style={{ background: "#f8fafc", padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Month</label>
                          <input type="month" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
                        </div>
                        {historyLoading ? (
                          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Loading…</div>
                        ) : history.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No attendance recorded for this month.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {history.map((h) => (
                              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px", flexWrap: "wrap" }}>
                                <span className="font-mono" style={{ fontSize: 12, minWidth: 90 }}>{h.attendance_date?.slice(0, 10)}</span>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[h.status]}18`, color: STATUS_COLOR[h.status] }}>
                                  {h.status.replace("_", " ").toUpperCase()}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--text-3)" }}>by {h.marked_by_name}</span>
                                {h.notes && <span style={{ fontSize: 12, color: "var(--text-3)" }}>· {h.notes}</span>}
                                {h.photo_url && (
                                  <a href={h.photo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>View photo</a>
                                )}
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
    </div>
  );
};

export default AttendanceDashboard;
