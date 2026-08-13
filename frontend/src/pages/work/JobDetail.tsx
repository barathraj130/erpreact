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

const emptyLogForm = { group_id: "", log_date: new Date().toISOString().slice(0, 10), check_in_time: "10:00", check_out_time: "18:00", fresh_pcs: "", mistake_pcs: "", notes: "" };

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "duty" | "reports" | "evidence" | "quantity" | "site_log">("overview");

  // ── Site log (work-daily-logs) state ──
  const [jobGroups, setJobGroups] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [jobPoDetails, setJobPoDetails] = useState<any>(null);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [assignGroupId, setAssignGroupId] = useState("");
  const [poForm, setPoForm] = useState({ supplier_id: "", purchase_bill_id: "", notes: "" });
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState(emptyLogForm);
  const [logErr, setLogErr] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const fetchSiteLog = async () => {
    const [groupsRes, logsRes, detailsRes] = await Promise.all([
      apiFetch(`/work-daily-logs/jobs/${id}/groups`),
      apiFetch(`/work-daily-logs/jobs/${id}/logs`),
      apiFetch(`/work-daily-logs/jobs/${id}/details`),
    ]);
    setJobGroups(await groupsRes.json());
    setDailyLogs(await logsRes.json());
    const details = await detailsRes.json();
    setJobPoDetails(details);
    if (details) setPoForm({ supplier_id: details.supplier_id || "", purchase_bill_id: details.purchase_bill_id || "", notes: details.notes || "" });
  };

  useEffect(() => {
    if (tab !== "site_log") return;
    fetchSiteLog();
    if (allGroups.length === 0) apiFetch("/work-accountability/groups").then((r) => r.json()).then(setAllGroups).catch(() => {});
    if (suppliers.length === 0) apiFetch("/suppliers").then((r) => r.json()).then((d) => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  const savePoDetails = async () => {
    const res = await apiFetch(`/work-daily-logs/jobs/${id}/details`, {
      method: "PUT",
      body: { supplier_id: poForm.supplier_id || undefined, purchase_bill_id: poForm.purchase_bill_id || undefined, notes: poForm.notes || undefined },
    });
    const d = await res.json();
    if (d.success) fetchSiteLog(); else alert(d.error);
  };

  const assignGroupToJob = async () => {
    if (!assignGroupId) return;
    const res = await apiFetch(`/work-daily-logs/jobs/${id}/groups`, { method: "POST", body: { group_id: Number(assignGroupId) } });
    const d = await res.json();
    if (d.success) { setAssignGroupId(""); fetchSiteLog(); } else alert(d.error);
  };

  const submitDailyLog = async () => {
    if (!logForm.group_id || !logForm.log_date) { setLogErr("Group and date are required"); return; }
    setSavingLog(true);
    setLogErr("");
    try {
      const res = await apiFetch("/work-daily-logs/logs", { method: "POST", body: { ...logForm, job_id: Number(id) } });
      const d = await res.json();
      if (d.success) { setShowLogModal(false); setLogForm(emptyLogForm); fetchSiteLog(); }
      else setLogErr(d.error || "Failed to save log");
    } finally {
      setSavingLog(false);
    }
  };

  const selectedSupplierForForm = jobPoDetails?.supplier_id;
  const mistakeNotAllowed = jobPoDetails && selectedSupplierForForm && !jobPoDetails.mistake_pcs_allowed;

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
        {["overview", "duty", "reports", "evidence", "quantity", "site_log"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            style={{
              padding: "7px 14px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
              textTransform: "capitalize", border: "1.5px solid rgba(15,23,42,0.10)", borderRadius: 6,
              background: tab === t ? "rgba(91,75,255,0.18)" : "transparent",
              color: tab === t ? "#5B4BFF" : "#64748b", cursor: "pointer", transition: "all 150ms", fontFamily: "inherit",
            }}
          >
            {t === "site_log" ? "Site Log" : t}
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
      {tab === "site_log" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Supplier / Purchase Bill link */}
          <div className="page-table-wrapper" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Supplier / Purchase Order</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Supplier</label>
                <select value={poForm.supplier_id} onChange={(e) => setPoForm((p) => ({ ...p, supplier_id: e.target.value }))} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 200 }}>
                  <option value="">Not linked</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Purchase Bill ID</label>
                <input type="number" value={poForm.purchase_bill_id} onChange={(e) => setPoForm((p) => ({ ...p, purchase_bill_id: e.target.value }))} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", width: 140 }} />
              </div>
              <button className="page-btn page-btn-primary" onClick={savePoDetails}>Save</button>
              {jobPoDetails?.supplier_id && (
                <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: 700, background: jobPoDetails.mistake_pcs_allowed ? "#f0fdf4" : "#fef2f2", color: jobPoDetails.mistake_pcs_allowed ? "#16a34a" : "#dc2626" }}>
                  {jobPoDetails.mistake_pcs_allowed ? "Mistake pcs allowed" : "Fresh only — mistake pcs not accepted"}
                </span>
              )}
            </div>
          </div>

          {/* Assigned groups */}
          <div className="page-table-wrapper" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Assigned Groups</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
              <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 200 }}>
                <option value="">Select a group to assign…</option>
                {allGroups.filter((g: any) => !jobGroups.some((jg) => jg.group_id === g.id)).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="page-btn" disabled={!assignGroupId} onClick={assignGroupToJob}>+ Assign Group</button>
            </div>
            {jobGroups.length === 0 ? <div className="page-empty">No groups assigned yet.</div> : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {jobGroups.map((g: any) => (
                  <span key={g.assignment_id} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "#f1f5f9", fontWeight: 600 }}>
                    {g.group_name} · {g.member_count} members
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Daily logs */}
          <div className="page-table-wrapper">
            <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Daily Site Log (10:00 AM – 6:00 PM shift)</span>
              <button className="page-btn page-btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} disabled={jobGroups.length === 0} onClick={() => { setLogForm(emptyLogForm); setLogErr(""); setShowLogModal(true); }}>
                + Mark Daily Log
              </button>
            </div>
            {dailyLogs.length === 0 ? <div className="page-empty">No daily logs yet.</div> : (
              <table className="page-table">
                <thead><tr><th>Date</th><th>Group</th><th>Marked By</th><th>Check-in</th><th>Check-out</th><th className="text-right">Fresh</th><th className="text-right">Mistake</th><th className="text-right">OT Hrs</th><th>Notes</th></tr></thead>
                <tbody>
                  {dailyLogs.map((l: any) => (
                    <tr key={l.id}>
                      <td className="font-mono">{l.log_date?.slice(0, 10)}</td>
                      <td className="font-bold">{l.group_name}</td>
                      <td>{l.marked_by_name}</td>
                      <td className="font-mono">{l.check_in_time?.slice(0, 5) || "—"}</td>
                      <td className="font-mono">{l.check_out_time?.slice(0, 5) || "—"}</td>
                      <td className="text-right">{l.fresh_pcs}</td>
                      <td className="text-right" style={{ color: Number(l.mistake_pcs) > 0 ? "#dc2626" : "inherit" }}>{l.mistake_pcs}</td>
                      <td className="text-right">{Number(l.ot_hours) > 0 ? l.ot_hours : "—"}</td>
                      <td style={{ maxWidth: 180 }}>{l.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="page-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Mark Daily Log</h2>
            {mistakeNotAllowed && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14, fontWeight: 600 }}>
                ⚠ This supplier's deal terms are Fresh Only — mistake pcs are not accepted.
              </div>
            )}
            {logErr && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{logErr}</div>}
            <label>Group *</label>
            <select value={logForm.group_id} onChange={(e) => setLogForm((p) => ({ ...p, group_id: e.target.value }))} style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}>
              <option value="">Select group…</option>
              {jobGroups.map((g: any) => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
            </select>
            <label>Date *</label>
            <input type="date" value={logForm.log_date} onChange={(e) => setLogForm((p) => ({ ...p, log_date: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label>Check-in</label>
                <input type="time" value={logForm.check_in_time} onChange={(e) => setLogForm((p) => ({ ...p, check_in_time: e.target.value }))} />
              </div>
              <div>
                <label>Check-out</label>
                <input type="time" value={logForm.check_out_time} onChange={(e) => setLogForm((p) => ({ ...p, check_out_time: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label>Fresh Pcs</label>
                <input type="number" value={logForm.fresh_pcs} onChange={(e) => setLogForm((p) => ({ ...p, fresh_pcs: e.target.value }))} />
              </div>
              <div>
                <label>Mistake Pcs</label>
                <input type="number" value={logForm.mistake_pcs} onChange={(e) => setLogForm((p) => ({ ...p, mistake_pcs: e.target.value }))} />
              </div>
            </div>
            <label>Notes</label>
            <input value={logForm.notes} onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))} />
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowLogModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={savingLog} onClick={submitDailyLog}>{savingLog ? "Saving…" : "Save Log"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
