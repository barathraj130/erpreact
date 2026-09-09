import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import "../../styles/neo-neu-motion.css";

interface HubForm {
  id: number;
  form_type: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "cancelled";
  form_data: Record<string, any>;
  response?: string | null;
  submitted_by_name?: string;
  submitted_to_name?: string;
  responded_by_name?: string;
  created_at: string;
  responded_at?: string | null;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "rgba(255,229,102,0.14)", color: "#B8860B", label: "⏳ PENDING" },
  under_review: { bg: "rgba(0,188,212,0.12)", color: "#0891B2", label: "👀 UNDER REVIEW" },
  approved: { bg: "rgba(0,230,118,0.12)", color: "#059669", label: "✅ APPROVED" },
  rejected: { bg: "rgba(255,59,59,0.12)", color: "#DC2626", label: "❌ REJECTED" },
  cancelled: { bg: "rgba(148,163,184,0.15)", color: "#64748B", label: "CANCELLED" },
};

const formDetails = (f: HubForm): string => {
  const d = f.form_data || {};
  switch (f.form_type) {
    case "leave_request": return `${d.leave_type || ""}: ${d.from_date || ""} → ${d.to_date || ""} (${d.total_days || "?"} days)`;
    case "advance_request": return `₹${d.amount || 0} — needed by ${d.needed_by || "?"}`;
    case "expense_claim": return `${d.expense_type || ""}: ₹${d.amount || 0} on ${d.expense_date || "?"}`;
    case "overtime_request": return `${d.date || "?"}: +${d.extra_hours || "?"} hrs`;
    case "complaint": return `${d.category || "Complaint"}${d.anonymous ? " (anonymous)" : ""}`;
    case "suggestion": return d.title || d.description || "";
    default: return d.description || d.reason || JSON.stringify(d).slice(0, 60);
  }
};

const HubForms: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuthUser();
  const [isDecisionMaker, setIsDecisionMaker] = useState(false);
  const [view, setView] = useState<"mine" | "inbox">("mine");
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [forms, setForms] = useState<HubForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [respondAction, setRespondAction] = useState<"approved" | "rejected" | null>(null);

  const canSeeInbox = isAdmin || isDecisionMaker;

  useEffect(() => {
    apiFetch("/authority/my-authority").then((r) => r.json()).then((d) => setIsDecisionMaker(!!d.is_decision_maker)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/hub/forms?view=${view}`);
      setForms(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Failed to load forms", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [view]);

  const filtered = forms.filter((f) => {
    if (statusTab === "all") return true;
    if (statusTab === "pending") return f.status === "pending" || f.status === "under_review";
    return f.status === statusTab;
  });

  const pendingCount = forms.filter((f) => f.status === "pending" || f.status === "under_review").length;

  const openRespond = (id: number, action: "approved" | "rejected") => {
    setRespondingId(id);
    setRespondAction(action);
    setResponseText("");
  };

  const submitResponse = async () => {
    if (!respondingId || !respondAction) return;
    if (respondAction === "rejected" && !responseText.trim()) {
      alert("A response is required when rejecting a request.");
      return;
    }
    try {
      const res = await apiFetch(`/hub/forms/${respondingId}/respond`, {
        method: "PUT",
        body: JSON.stringify({ status: respondAction, response: responseText.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setRespondingId(null);
      setRespondAction(null);
      load();
    } catch (err: any) {
      alert(err.message || "Failed to respond.");
    }
  };

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">📋 HR Forms & Requests</h1>
          <p className="neo-page-sub">Leave, advance, expense, and other requests submitted from Team Hub.</p>
        </div>
        <div className="neo-page-actions">
          {isAdmin && (
            <button className="neo-btn-secondary neo-btn-sm" onClick={() => navigate("/admin/hr-forms")}>🖨️ Print Blank Forms</button>
          )}
          <button className="neo-btn-secondary neo-btn-sm" onClick={() => navigate("/hub")}>← Back to Hub</button>
        </div>
      </div>

      {canSeeInbox && (
        <div className="neo-tabs">
          <button className={`neo-tab ${view === "mine" ? "active" : ""}`} onClick={() => setView("mine")}>My Requests</button>
          <button className={`neo-tab ${view === "inbox" ? "active" : ""}`} onClick={() => setView("inbox")}>
            Inbox{pendingCount > 0 && view !== "inbox" ? "" : ""} {pendingCount > 0 && <span className="neo-badge neo-badge-warning" style={{ marginLeft: 6 }}>{pendingCount}</span>}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            className={`neo-btn-secondary neo-btn-sm ${statusTab === t ? "active" : ""}`}
            style={statusTab === t ? { background: "rgba(91,75,255,0.14)", borderColor: "#5B4BFF", color: "#7C6CFF" } : {}}
            onClick={() => setStatusTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="neo-table-wrap">
        <div className="neo-table-scroll">
          <table className="neo-table">
            <thead>
              <tr>
                {view === "inbox" && <th>Employee</th>}
                <th>Form Type</th>
                <th>Details</th>
                {view === "inbox" && <th>Response</th>}
                {view !== "inbox" && <th>Sent To</th>}
                <th>Status</th>
                <th>Date</th>
                {view === "inbox" && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neu-text-muted)", padding: 32 }}>{loading ? "Loading…" : "No requests found."}</td></tr>
              ) : filtered.map((f) => {
                const badge = STATUS_BADGE[f.status] || STATUS_BADGE.pending;
                const isPending = f.status === "pending" || f.status === "under_review";
                return (
                  <tr key={f.id}>
                    {view === "inbox" && <td style={{ fontWeight: 700 }}>{f.submitted_by_name}</td>}
                    <td style={{ textTransform: "capitalize" }}>{f.form_type.replace(/_/g, " ")}</td>
                    <td style={{ maxWidth: 260, whiteSpace: "normal" }}>{formDetails(f)}</td>
                    {view === "inbox" && <td style={{ maxWidth: 200, whiteSpace: "normal", color: "var(--neu-text-muted)" }}>{f.response || "—"}</td>}
                    {view !== "inbox" && <td>{f.submitted_to_name || "—"}</td>}
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", background: badge.bg, color: badge.color, display: "inline-block" }}>
                        {badge.label}
                      </span>
                    </td>
                    <td>{new Date(f.created_at).toLocaleDateString("en-IN")}</td>
                    {view === "inbox" && (
                      <td>
                        {isPending ? (
                          respondingId === f.id ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="neo-btn-success neo-btn-sm" onClick={submitResponse}>Confirm</button>
                              <button className="neo-btn-secondary neo-btn-sm" onClick={() => setRespondingId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="neo-btn-success neo-btn-sm" onClick={() => openRespond(f.id, "approved")}>Approve</button>
                              <button className="neo-btn-danger neo-btn-sm" onClick={() => openRespond(f.id, "rejected")}>Reject</button>
                            </div>
                          )
                        ) : <span style={{ color: "var(--neu-text-muted)", fontSize: 11 }}>Resolved</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {respondingId && respondAction && createPortal(
        <div className="neo-modal-overlay" onClick={() => setRespondingId(null)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header">
              <h3 className="neo-modal-title">{respondAction === "approved" ? "Approve Request" : "Reject Request"}</h3>
              <button className="neo-modal-close" onClick={() => setRespondingId(null)}>×</button>
            </div>
            <div className="neo-modal-body">
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", display: "block", marginBottom: 6 }}>
                Response {respondAction === "rejected" ? "(required)" : "(optional)"}
              </label>
              <textarea
                className="neu-textarea"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder={respondAction === "approved" ? "Any notes for the employee…" : "Explain why this is being rejected…"}
              />
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setRespondingId(null)}>Cancel</button>
              <button className={respondAction === "approved" ? "neo-btn-success" : "neo-btn-danger"} onClick={submitResponse}>
                Confirm {respondAction === "approved" ? "Approval" : "Rejection"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HubForms;
