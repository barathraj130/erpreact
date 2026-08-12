// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
//
// Read-only view. This page never calls an update/delete endpoint on
// audit_events — the backend exposes none, keeping the trail append-only.
import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface AuditEvent {
  id: number;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number;
  reason?: string;
  risk_level: string;
  created_at: string;
}
interface AuditAlert {
  id: number;
  alert_type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

const RISK_COLOR: Record<string, string> = { low: "#94a3b8", medium: "#F59E0B", high: "#EF4444", critical: "#DC2626" };

const AuditTimeline: React.FC = () => {
  const [tab, setTab] = useState<"events" | "alerts">("events");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [eventRes, alertRes] = await Promise.all([
        apiFetch("/work-accountability/audit-events").then((r) => r.json()),
        apiFetch("/work-accountability/audit-alerts").then((r) => r.json()),
      ]);
      setEvents(Array.isArray(eventRes) ? eventRes : []);
      setAlerts(Array.isArray(alertRes) ? alertRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const resolveAlert = async (id: number) => {
    await apiFetch(`/work-accountability/audit-alerts/${id}/resolve`, { method: "POST" });
    fetchAll();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Audit Timeline</h1>
          <p>Immutable event log for every Work Accountability action. Nothing here can be edited or deleted.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="page-btn" onClick={() => setTab("events")} style={{ background: tab === "events" ? "#111827" : "#fff", color: tab === "events" ? "#fff" : "#111827" }}>Events</button>
        <button className="page-btn" onClick={() => setTab("alerts")} style={{ background: tab === "alerts" ? "#111827" : "#fff", color: tab === "alerts" ? "#fff" : "#111827" }}>Alerts</button>
      </div>

      {tab === "events" && (
        <div className="page-table-wrapper">
          {loading ? <div className="page-empty">Loading…</div> : events.length === 0 ? <div className="page-empty">No audit events yet.</div> : (
            <table className="page-table">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th><th>Risk</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.created_at).toLocaleString("en-IN")}</td>
                    <td className="font-bold">{e.actor_name || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{e.action.replace(/_/g, " ")}</td>
                    <td className="font-mono">{e.entity_type} #{e.entity_id}</td>
                    <td style={{ maxWidth: 200 }}>{e.reason || "—"}</td>
                    <td>
                      <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${RISK_COLOR[e.risk_level]}18`, color: RISK_COLOR[e.risk_level] }}>
                        {e.risk_level.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="page-table-wrapper">
          {loading ? <div className="page-empty">Loading…</div> : alerts.length === 0 ? <div className="page-empty">No alerts.</div> : (
            <table className="page-table">
              <thead><tr><th>When</th><th>Type</th><th>Severity</th><th>Message</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString("en-IN")}</td>
                    <td style={{ textTransform: "capitalize" }}>{a.alert_type.replace(/_/g, " ")}</td>
                    <td>
                      <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${RISK_COLOR[a.severity]}18`, color: RISK_COLOR[a.severity] }}>
                        {a.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: 320 }}>{a.message}</td>
                    <td>{a.is_resolved ? "Resolved" : "Open"}</td>
                    <td>{!a.is_resolved && <button className="page-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => resolveAlert(a.id)}>Resolve</button>}</td>
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

export default AuditTimeline;
