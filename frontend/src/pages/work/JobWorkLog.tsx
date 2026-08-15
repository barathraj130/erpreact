import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

const CONVERSION_COLOR: Record<string, string> = { pending: "#F59E0B", converted: "#10B981", failed: "#EF4444" };
const REACHED_COLOR: Record<string, string> = { yes: "#10B981", partial: "#F59E0B", no: "#EF4444" };

const JobWorkLog: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);
  const [assignGroupId, setAssignGroupId] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [jobRes, groupsRes, allGroupsRes, logsRes] = await Promise.all([
        apiFetch(`/work-accountability/jobs/${jobId}`),
        apiFetch(`/work-accountability/jobs/${jobId}/groups`),
        apiFetch("/work-accountability/groups"),
        apiFetch(`/work-accountability/jobs/${jobId}/daily-logs`),
      ]);
      const jobData = await jobRes.json();
      setJob(jobData.job || null);
      setGroups(await groupsRes.json());
      setAllGroups(await allGroupsRes.json());
      setLogs(await logsRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignGroup = async () => {
    if (!assignGroupId) return;
    const res = await apiFetch(`/work-accountability/jobs/${jobId}/groups`, { method: "POST", body: { group_ids: [Number(assignGroupId)] } });
    const d = await res.json();
    if (d.success) { setAssignGroupId(""); fetchAll(); } else alert(d.error || "Failed to assign group");
  };

  const toggleLog = async (logId: number) => {
    if (expandedLogId === logId) { setExpandedLogId(null); setExpandedDetail(null); return; }
    setExpandedLogId(logId);
    const res = await apiFetch(`/work-accountability/daily-logs/${logId}`);
    setExpandedDetail(await res.json());
  };

  if (loading) return <div className="page-container">Loading…</div>;
  if (!job) return <div className="page-container"><div className="page-empty">Job not found.</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link to="/work/jobs" style={{ fontSize: 12, color: "#5B4BFF", fontWeight: 700 }}>← All Jobs</Link>
          <h1 style={{ marginTop: 6 }}>{job.title}</h1>
          <p>{job.description || "No description"} — Status: {job.status}</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn page-btn-primary" onClick={() => navigate(`/work/daily-log/new?job_id=${jobId}`)}>+ Mark Daily Log</button>
        </div>
      </div>

      {/* Assigned Groups */}
      <div className="page-table-wrapper" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Assigned Groups</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
          <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 220 }}>
            <option value="">Select a group to assign…</option>
            {allGroups.filter((g: any) => !groups.some((jg) => jg.group_id === g.id)).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="page-btn" disabled={!assignGroupId} onClick={assignGroup}>+ Add Group</button>
        </div>
        {groups.length === 0 ? <div className="page-empty">No groups assigned yet.</div> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {groups.map((g: any) => (
              <span key={g.assignment_id} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "#f1f5f9", fontWeight: 600 }}>
                {g.group_name} · {g.member_count} members
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Daily Logs Timeline */}
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Daily Logs</div>
      {logs.length === 0 ? (
        <div className="page-empty">No daily logs yet. Mark one from the button above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {logs.map((l: any) => (
            <div key={l.id} className="page-table-wrapper" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="font-mono" style={{ fontWeight: 700 }}>{l.log_date?.slice(0, 10)}</span>
                  <span className="font-bold">{l.group_name}</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${REACHED_COLOR[l.reached_status] || "#94a3b8"}18`, color: REACHED_COLOR[l.reached_status] || "#94a3b8" }}>
                    {l.reached_status === "yes" ? "REACHED" : l.reached_status === "partial" ? "PARTIAL" : "NOT REACHED"}
                  </span>
                  {l.ot_hours > 0 && <span style={{ fontSize: 12, color: "#64748b" }}>OT: {l.ot_hours}h</span>}
                  <span style={{ fontSize: 12, color: "#64748b" }}>{l.item_count} item{l.item_count === 1 ? "" : "s"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${CONVERSION_COLOR[l.conversion_status] || "#94a3b8"}18`, color: CONVERSION_COLOR[l.conversion_status] || "#94a3b8" }}>
                    {(l.conversion_status || "pending").toUpperCase()}
                  </span>
                  {l.admin_confirmed ? (
                    <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Confirmed</span>
                  ) : (
                    <button className="page-btn page-btn-primary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => navigate(`/work/daily-log/${l.id}/confirm`)}>Review & Confirm</button>
                  )}
                  <button className="page-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => toggleLog(l.id)}>{expandedLogId === l.id ? "Hide" : "Details"}</button>
                </div>
              </div>

              {expandedLogId === l.id && expandedDetail && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eee" }}>
                  {expandedDetail.items.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No product lines recorded.</div>
                  ) : (
                    <table className="page-table">
                      <thead><tr><th>Product</th><th className="text-right">Bundles</th><th className="text-right">Pcs/Bundle</th><th className="text-right">Total</th><th className="text-right">Fresh</th><th className="text-right">Mistake</th></tr></thead>
                      <tbody>
                        {expandedDetail.items.map((it: any) => (
                          <tr key={it.id}>
                            <td className="font-bold">{it.product_name_snapshot}</td>
                            <td className="text-right">{it.bundle_count}</td>
                            <td className="text-right">{it.pcs_per_bundle}</td>
                            <td className="text-right font-bold">{it.items_count}</td>
                            <td className="text-right">{it.fresh_pcs}</td>
                            <td className="text-right" style={{ color: it.mistake_pcs > 0 ? "#dc2626" : "inherit" }}>
                              {it.mistake_pcs}
                              {it.mistake_pcs > 0 && expandedDetail.supplier && !expandedDetail.supplier.mistake_pcs_allowed && (
                                <span title="Supplier deal is Fresh Only" style={{ marginLeft: 6, fontSize: 10, color: "#dc2626" }}>⚠</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobWorkLog;
