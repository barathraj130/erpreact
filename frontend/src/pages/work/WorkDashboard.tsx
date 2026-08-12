// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Job { id: number; title: string; status: string; job_type: string; created_at: string; }
interface Alert { id: number; alert_type: string; severity: string; message: string; created_at: string; }

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", assigned: "#5B4BFF", in_progress: "#F59E0B", submitted: "#8B5CF6",
  under_review: "#8B5CF6", verified: "#10B981", approved: "#10B981", rejected: "#EF4444", cancelled: "#94a3b8",
};

const WorkDashboard: React.FC = () => {
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mine, all, alertRes] = await Promise.all([
          apiFetch("/work-accountability/jobs?assigned_to_me=true").then((r) => r.json()),
          apiFetch("/work-accountability/jobs").then((r) => r.json()),
          apiFetch("/work-accountability/audit-alerts?resolved=false").then((r) => r.json()).catch(() => []),
        ]);
        setMyJobs(Array.isArray(mine) ? mine : []);
        setAllJobs(Array.isArray(all) ? all : []);
        setAlerts(Array.isArray(alertRes) ? alertRes : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = allJobs.reduce((acc: Record<string, number>, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {});

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Work Accountability</h1>
          <p>Jobs, duty tracking, reports, evidence, and approvals.</p>
        </div>
        <div className="page-header-actions">
          <Link to="/work/jobs" className="page-btn page-btn-primary">View All Jobs</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        {["draft", "assigned", "in_progress", "submitted", "verified", "approved"].map((s) => (
          <div key={s} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>{s.replace("_", " ")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[s] }}>{counts[s] || 0}</div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>⚠️ Open Audit Alerts</div>
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} style={{ background: a.severity === "critical" || a.severity === "high" ? "#fef2f2" : "#fffbeb", border: `1px solid ${a.severity === "critical" || a.severity === "high" ? "#fecaca" : "#fde68a"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#374151" }}>
              <strong style={{ textTransform: "uppercase", fontSize: 10, marginRight: 8, color: a.severity === "critical" || a.severity === "high" ? "#dc2626" : "#92400e" }}>{a.severity}</strong>
              {a.message}
            </div>
          ))}
        </div>
      )}

      <div className="page-table-wrapper">
        <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee" }}>My Assigned Jobs</div>
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : myJobs.length === 0 ? (
          <div className="page-empty">No jobs assigned to you.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Job</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {myJobs.map((j) => (
                <tr key={j.id}>
                  <td className="font-bold">{j.title}</td>
                  <td>{j.job_type}</td>
                  <td><span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[j.status]}18`, color: STATUS_COLOR[j.status] }}>{j.status.replace("_", " ").toUpperCase()}</span></td>
                  <td><Link to={`/work/jobs/${j.id}`} className="page-btn" style={{ padding: "4px 12px", fontSize: 12 }}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WorkDashboard;
