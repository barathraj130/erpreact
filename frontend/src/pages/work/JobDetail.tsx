// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", assigned: "#5B4BFF", in_progress: "#F59E0B", submitted: "#8B5CF6",
  under_review: "#8B5CF6", verified: "#10B981", approved: "#10B981", rejected: "#EF4444", cancelled: "#94a3b8",
  pending: "#F59E0B", accepted: "#10B981", declined: "#EF4444", active: "#10B981", ended: "#94a3b8",
  reviewed: "#8B5CF6", corrected: "#F59E0B",
};

const Pill: React.FC<{ status: string }> = ({ status }) => (
  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[status] || "#94a3b8"}18`, color: STATUS_COLOR[status] || "#94a3b8" }}>
    {(status || "").replace("_", " ").toUpperCase()}
  </span>
);

const fmt = (n: any) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "duty" | "reports" | "evidence" | "quantity">("overview");

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/work-accountability/jobs/${id}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  // ── actions ──
  const assign = async () => {
    const employeeId = window.prompt("Assign to employee (user ID):");
    if (!employeeId) return;
    const res = await apiFetch(`/work-accountability/jobs/${id}/assign`, { method: "POST", body: { employee_id: employeeId } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const respondAssignment = async (assignmentId: number, action: "accept" | "decline") => {
    const res = await apiFetch(`/work-accountability/jobs/${id}/assignments/${assignmentId}/respond`, { method: "POST", body: { action } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const startDuty = async () => {
    const res = await apiFetch("/work-accountability/duty/start", { method: "POST", body: { job_id: id } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const endDuty = async (sessionId: number) => {
    const res = await apiFetch(`/work-accountability/duty/${sessionId}/end`, { method: "POST" });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const submitReport = async () => {
    const content = window.prompt("Report content:");
    if (!content) return;
    const reportDate = window.prompt("Report date (YYYY-MM-DD), leave blank for today:") || undefined;
    let backdatedReason: string | undefined;
    if (reportDate && reportDate < new Date().toISOString().split("T")[0]) {
      backdatedReason = window.prompt("This date is in the past — reason for the backdated report (required):") || undefined;
      if (!backdatedReason) { alert("Backdated reports require a reason."); return; }
    }
    const res = await apiFetch("/work-accountability/reports", { method: "POST", body: { job_id: id, content, report_date: reportDate, backdated_reason: backdatedReason } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const uploadEvidence = async () => {
    const fileUrl = window.prompt("Evidence file URL (photo/video/document link):");
    if (!fileUrl) return;
    const res = await apiFetch("/work-accountability/evidence", { method: "POST", body: { job_id: id, file_url: fileUrl, file_type: "photo" } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const verifyEvidence = async (evidenceId: number, status: "verified" | "rejected") => {
    const notes = window.prompt(`Notes for ${status}:`) || undefined;
    const res = await apiFetch(`/work-accountability/evidence/${evidenceId}/verify`, { method: "POST", body: { status, notes } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const submitQuantity = async () => {
    const qty = window.prompt("Reported quantity:");
    if (!qty) return;
    const unit = window.prompt("Unit:") || undefined;
    const res = await apiFetch("/work-accountability/quantity", { method: "POST", body: { job_id: id, reported_quantity: qty, unit } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const correctQuantity = async (quantityReportId: number) => {
    const corrected = window.prompt("Corrected quantity:");
    if (!corrected) return;
    const reason = window.prompt("Reason for correction (required):");
    if (!reason) { alert("A reason is required to request a correction."); return; }
    const res = await apiFetch(`/work-accountability/quantity/${quantityReportId}/correct`, { method: "POST", body: { corrected_quantity: corrected, reason } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const verifyJobOrReport = async (entityType: "job" | "daily_report", entityId: number, status: "verified" | "rejected") => {
    const notes = window.prompt(`Notes for ${status}:`) || undefined;
    const res = await apiFetch("/work-accountability/verify", { method: "POST", body: { entity_type: entityType, entity_id: entityId, status, notes } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  const approveJob = async (status: "approved" | "rejected") => {
    const notes = window.prompt(`Notes for ${status}:`) || undefined;
    const res = await apiFetch("/work-accountability/approve", { method: "POST", body: { entity_type: "job", entity_id: id, status, notes } });
    const d = await res.json();
    if (d.success) fetchDetail(); else alert(d.error);
  };

  if (loading) return <div className="page-container">Loading…</div>;
  if (!data || data.error) return <div className="page-container"><div className="page-empty">{data?.error || "Job not found"}</div></div>;

  const { job, assignments, duty_sessions: dutySessions, reports, evidence: evidenceList, quantity_reports: quantityReports } = data;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link to="/work/jobs" style={{ fontSize: 12, color: "#5B4BFF", fontWeight: 700 }}>← All Jobs</Link>
          <h1 style={{ marginTop: 6 }}>{job.title}</h1>
          <p>{job.description || "No description"} · <Pill status={job.status} /></p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn page-btn-primary" onClick={assign}>+ Assign</button>
          {job.status === "under_review" && (
            <>
              <button className="page-btn" style={{ color: "#166534" }} onClick={() => approveJob("approved")}>Approve Job</button>
              <button className="page-btn" style={{ color: "#991b1b" }} onClick={() => approveJob("rejected")}>Reject Job</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["overview", "duty", "reports", "evidence", "quantity"].map((t) => (
          <button key={t} onClick={() => setTab(t as any)} className="page-btn" style={{ textTransform: "capitalize", background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111827" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="page-table-wrapper">
          <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee" }}>Assignments</div>
          {assignments.length === 0 ? <div className="page-empty">No assignments yet.</div> : (
            <table className="page-table">
              <thead><tr><th>Assignee</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {assignments.map((a: any) => (
                  <tr key={a.id}>
                    <td className="font-bold">{a.employee_name || a.group_name || "—"}</td>
                    <td><Pill status={a.status} /></td>
                    <td>
                      {a.status === "pending" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#166534" }} onClick={() => respondAssignment(a.id, "accept")}>Accept</button>
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#991b1b" }} onClick={() => respondAssignment(a.id, "decline")}>Decline</button>
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

      {tab === "duty" && (
        <div className="page-table-wrapper">
          <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <span>Duty Sessions</span>
            <button className="page-btn page-btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={startDuty}>Start Duty</button>
          </div>
          {dutySessions.length === 0 ? <div className="page-empty">No duty sessions yet.</div> : (
            <table className="page-table">
              <thead><tr><th>Employee</th><th>Started</th><th>Ended</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {dutySessions.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-bold">{d.employee_name}</td>
                    <td>{new Date(d.started_at).toLocaleString("en-IN")}</td>
                    <td>{d.ended_at ? new Date(d.ended_at).toLocaleString("en-IN") : "—"}</td>
                    <td><Pill status={d.status} /></td>
                    <td>{d.status === "active" && <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => endDuty(d.id)}>End</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="page-table-wrapper">
          <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <span>Daily Reports</span>
            <button className="page-btn page-btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={submitReport}>Submit Report</button>
          </div>
          {reports.length === 0 ? <div className="page-empty">No reports yet.</div> : (
            <table className="page-table">
              <thead><tr><th>Employee</th><th>Date</th><th>Content</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.employee_name}</td>
                    <td>{r.report_date?.slice(0, 10)} {r.is_backdated && <span style={{ color: "#dc2626", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>BACKDATED</span>}</td>
                    <td style={{ maxWidth: 260 }}>{r.content}</td>
                    <td><Pill status={r.status} /></td>
                    <td>
                      {r.status === "submitted" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#166534" }} onClick={() => verifyJobOrReport("daily_report", r.id, "verified")}>Verify</button>
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#991b1b" }} onClick={() => verifyJobOrReport("daily_report", r.id, "rejected")}>Reject</button>
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

      {tab === "evidence" && (
        <div className="page-table-wrapper">
          <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <span>Evidence</span>
            <button className="page-btn page-btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={uploadEvidence}>Upload Evidence</button>
          </div>
          {evidenceList.length === 0 ? <div className="page-empty">No evidence uploaded yet.</div> : (
            <table className="page-table">
              <thead><tr><th>File</th><th>Type</th><th>Version</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {evidenceList.map((e: any) => (
                  <tr key={e.id}>
                    <td className="font-mono"><a href={e.file_url} target="_blank" rel="noreferrer" style={{ color: "#5B4BFF" }}>{e.file_url.slice(0, 40)}…</a></td>
                    <td>{e.file_type}</td>
                    <td>v{e.current_version}</td>
                    <td><Pill status={e.verification_status} /></td>
                    <td>
                      {e.verification_status === "pending" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#166534" }} onClick={() => verifyEvidence(e.id, "verified")}>Verify</button>
                          <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12, color: "#991b1b" }} onClick={() => verifyEvidence(e.id, "rejected")}>Reject</button>
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

      {tab === "quantity" && (
        <div className="page-table-wrapper">
          <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <span>Quantity Reports</span>
            <button className="page-btn page-btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={submitQuantity}>Submit Quantity</button>
          </div>
          {quantityReports.length === 0 ? <div className="page-empty">No quantity reports yet.</div> : (
            <table className="page-table">
              <thead><tr><th>Employee</th><th className="text-right">Quantity</th><th>Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {quantityReports.map((q: any) => (
                  <tr key={q.id}>
                    <td className="font-bold">{q.employee_name}</td>
                    <td className="text-right font-bold">{fmt(q.reported_quantity)} {q.unit}</td>
                    <td>{q.report_date?.slice(0, 10)}</td>
                    <td><Pill status={q.status} /></td>
                    <td>
                      {q.status === "submitted" && (
                        <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => correctQuantity(q.id)}>Request Correction</button>
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
  );
};

export default JobDetail;
