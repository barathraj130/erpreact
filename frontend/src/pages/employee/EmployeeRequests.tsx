import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowLeft, FaPlus, FaClipboardList, FaTimes } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface HubRequest {
  id: number;
  form_type: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "cancelled";
  form_data: Record<string, any>;
  response?: string | null;
  responded_at?: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  leave_request: "Leave Request",
  advance_request: "Advance Request",
  expense_claim: "Expense Claim",
  overtime_request: "Overtime Request",
  complaint: "Complaint",
  suggestion: "Suggestion",
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#fef3c7", color: "#b45309", label: "PENDING" },
  under_review: { bg: "#e0f2fe", color: "#0369a1", label: "UNDER REVIEW" },
  approved: { bg: "#dcfce7", color: "#15803d", label: "APPROVED" },
  rejected: { bg: "#fee2e2", color: "#dc2626", label: "REJECTED" },
  cancelled: { bg: "#f1f5f9", color: "#64748b", label: "CANCELLED" },
};

const summarize = (r: HubRequest): string => {
  const d = r.form_data || {};
  switch (r.form_type) {
    case "advance_request": return `₹${d.amount || 0} — ${d.reason || "no reason given"}`;
    case "expense_claim": return `${d.expense_type || "Expense"}: ₹${d.amount || 0}`;
    case "leave_request": return `${d.leave_type || ""}: ${d.from_date || "?"} → ${d.to_date || "?"}`;
    case "overtime_request": return `${d.date || "?"}: +${d.extra_hours || "?"} hrs`;
    default: return d.description || d.reason || "";
  }
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "10px",
  border: "1px solid #e2e8f0", fontSize: "14px", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px", display: "block" };

const EmployeeRequests: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<HubRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [formType, setFormType] = useState("advance_request");
  const [fields, setFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const token = () => localStorage.getItem("erp-employee-token");

  const authedFetch = (path: string, opts: RequestInit = {}) =>
    fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts.headers || {}) },
    });

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/employee-portal/requests");
      if (res.status === 401) { navigate("/employee-login"); return; }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setMsg("Failed to load your requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: any) => setFields((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await authedFetch("/employee-portal/requests", {
        method: "POST",
        body: JSON.stringify({ form_type: formType, form_data: fields }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowNew(false);
        setFields({});
        load();
      } else {
        setMsg(data.error || "Failed to submit request");
      }
    } catch {
      setMsg("Failed to submit request — check your connection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Satoshi', sans-serif" }}>
      <nav style={{ background: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate("/employee/dashboard")} style={{ border: "none", background: "#f1f5f9", borderRadius: "10px", padding: "10px", cursor: "pointer", color: "#475569" }}>
            <FaArrowLeft />
          </button>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>My Requests</h2>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ display: "flex", alignItems: "center", gap: "8px", border: "none", background: "#2563eb", color: "white", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontWeight: 700 }}
        >
          <FaPlus /> New Request
        </button>
      </nav>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#94a3b8", padding: "60px" }}>Loading…</p>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px", background: "white", borderRadius: "24px" }}>
            <FaClipboardList size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p>You haven't submitted any requests yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {requests.map((r) => {
              const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
              return (
                <div key={r.id} style={{ background: "white", padding: "18px 20px", borderRadius: "18px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>{TYPE_LABELS[r.form_type] || r.form_type}</p>
                      <p style={{ margin: "4px 0 0 0", color: "#475569", fontSize: "13px" }}>{summarize(r)}</p>
                      <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12px" }}>{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <span style={{ background: badge.bg, color: badge.color, padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}>{badge.label}</span>
                  </div>
                  {r.response && (
                    <p style={{ margin: "10px 0 0 0", padding: "10px", background: "#f8fafc", borderRadius: "10px", fontSize: "13px", color: "#475569" }}>
                      <strong>Response:</strong> {r.response}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: "white", borderRadius: "24px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>New Request</h3>
              <button onClick={() => setShowNew(false)} style={{ border: "none", background: "#f1f5f9", borderRadius: "10px", padding: "8px", cursor: "pointer" }}><FaTimes /></button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Request Type</label>
                <select style={inputStyle} value={formType} onChange={(e) => { setFormType(e.target.value); setFields({}); }}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {formType === "advance_request" && (
                <>
                  <div><label style={labelStyle}>Amount Needed (₹)</label><input type="number" style={inputStyle} value={fields.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} /></div>
                  <div><label style={labelStyle}>Reason</label><textarea style={{ ...inputStyle, minHeight: 70 }} value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></div>
                  <div><label style={labelStyle}>Needed By</label><input type="date" style={inputStyle} value={fields.needed_by || ""} onChange={(e) => set("needed_by", e.target.value)} /></div>
                </>
              )}
              {formType === "expense_claim" && (
                <>
                  <div>
                    <label style={labelStyle}>Expense Type</label>
                    <select style={inputStyle} value={fields.expense_type || ""} onChange={(e) => set("expense_type", e.target.value)}>
                      <option value="">Select…</option><option>Travel</option><option>Food</option><option>Communication</option><option>Stationery</option><option>Other</option>
                    </select>
                  </div>
                  <div><label style={labelStyle}>Amount (₹)</label><input type="number" style={inputStyle} value={fields.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} /></div>
                  <div><label style={labelStyle}>Date of Expense</label><input type="date" style={inputStyle} value={fields.expense_date || ""} onChange={(e) => set("expense_date", e.target.value)} /></div>
                  <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 70 }} value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
                </>
              )}
              {formType === "leave_request" && (
                <>
                  <div>
                    <label style={labelStyle}>Leave Type</label>
                    <select style={inputStyle} value={fields.leave_type || ""} onChange={(e) => set("leave_type", e.target.value)}>
                      <option value="">Select…</option><option value="Sick">Sick</option><option value="Casual">Casual</option><option value="Earned">Earned</option><option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={labelStyle}>From</label><input type="date" style={inputStyle} value={fields.from_date || ""} onChange={(e) => set("from_date", e.target.value)} /></div>
                    <div><label style={labelStyle}>To</label><input type="date" style={inputStyle} value={fields.to_date || ""} onChange={(e) => set("to_date", e.target.value)} /></div>
                  </div>
                  <div><label style={labelStyle}>Reason</label><textarea style={{ ...inputStyle, minHeight: 70 }} value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></div>
                </>
              )}
              {formType === "overtime_request" && (
                <>
                  <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={fields.date || ""} onChange={(e) => set("date", e.target.value)} /></div>
                  <div><label style={labelStyle}>Extra Hours</label><input type="number" style={inputStyle} value={fields.extra_hours || ""} onChange={(e) => set("extra_hours", Number(e.target.value))} /></div>
                </>
              )}
              {(formType === "complaint" || formType === "suggestion") && (
                <div><label style={labelStyle}>{formType === "complaint" ? "What happened?" : "Your suggestion"}</label><textarea style={{ ...inputStyle, minHeight: 90 }} value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
              )}

              {msg && <p style={{ color: "#dc2626", fontSize: "13px", margin: 0 }}>{msg}</p>}

              <button
                onClick={submit}
                disabled={saving}
                style={{ border: "none", background: saving ? "#94a3b8" : "#2563eb", color: "white", padding: "14px", borderRadius: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRequests;
