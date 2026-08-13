// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Job { id: number; title: string; job_type: string; status: string; expected_quantity?: number; unit?: string; due_date?: string; created_by_name?: string; assignment_count: number; }

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", assigned: "#5B4BFF", in_progress: "#F59E0B", submitted: "#8B5CF6",
  under_review: "#8B5CF6", verified: "#10B981", approved: "#10B981", rejected: "#EF4444", cancelled: "#94a3b8",
};

const emptyForm = { title: "", description: "", job_type: "general", expected_quantity: "", unit: "", due_date: "" };

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchJobs = async (status: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/work-accountability/jobs${status ? `?status=${status}` : ""}`);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(statusFilter); }, [statusFilter]);

  const submit = async () => {
    if (!form.title.trim()) { setErr("Job title is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await apiFetch("/work-accountability/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) { setShowModal(false); setForm(emptyForm); fetchJobs(statusFilter); }
      else setErr(data.error || "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Jobs</h1>
          <p>{jobs.length} jobs.</p>
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
            <FaPlus /> New Job
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20, padding: "4px 0" }}>
        {["", "draft", "assigned", "in_progress", "submitted", "under_review", "verified", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textTransform: "capitalize",
              border: "1.5px solid rgba(15,23,42,0.10)",
              borderRadius: 6,
              background: statusFilter === s ? "rgba(91,75,255,0.18)" : "transparent",
              color: statusFilter === s ? "#5B4BFF" : "#64748b",
              cursor: "pointer",
              transition: "all 150ms",
              fontFamily: "inherit",
            }}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="page-empty">No jobs found.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Job</th><th>Type</th><th>Expected Qty</th><th>Due</th><th>Assignments</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="font-bold">{j.title}</td>
                  <td>{j.job_type}</td>
                  <td>{j.expected_quantity ? `${j.expected_quantity} ${j.unit || ""}` : "—"}</td>
                  <td>{j.due_date?.slice(0, 10) || "—"}</td>
                  <td>{j.assignment_count}</td>
                  <td><span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[j.status]}18`, color: STATUS_COLOR[j.status] }}>{j.status.replace("_", " ").toUpperCase()}</span></td>
                  <td><Link to={`/work/jobs/${j.id}`} className="page-btn" style={{ padding: "4px 12px", fontSize: 12 }}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="page-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Job</h2>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}
            <label>Title *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <label>Description</label>
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <label>Job Type</label>
            <input value={form.job_type} onChange={(e) => setForm((p) => ({ ...p, job_type: e.target.value }))} placeholder="general / production / delivery / inspection" />
            <label>Expected Quantity</label>
            <input type="number" value={form.expected_quantity} onChange={(e) => setForm((p) => ({ ...p, expected_quantity: e.target.value }))} />
            <label>Unit</label>
            <input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder="pieces / kg / boxes" />
            <label>Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Create Job"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
