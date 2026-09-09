import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import "../../styles/neo-neu-motion.css";

interface Announcement {
  id: number;
  content: string;
  sender_name: string;
  created_at: string;
  read_count: number;
  total_members: number;
  read_percent: number;
  read_by_me: boolean;
}

interface ReadMember { id: number; name: string; has_read: boolean; }

const HubAnnouncements: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuthUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [target, setTarget] = useState<"all" | "branch">("all");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [posting, setPosting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reads, setReads] = useState<{ read: ReadMember[]; unread: ReadMember[] } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/hub/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error("Failed to load announcements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isAdmin) apiFetch("/branches").then((r) => r.json()).then(setBranches).catch(() => {});
  }, [isAdmin]);

  const post = async () => {
    if (!title.trim() || !message.trim()) return alert("Title and message are required.");
    setPosting(true);
    try {
      const res = await apiFetch("/hub/announcements", {
        method: "POST",
        body: JSON.stringify({ title, message, priority, target, target_branch_id: target === "branch" ? targetBranchId : null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setShowNew(false);
      setTitle(""); setMessage(""); setPriority("normal"); setTarget("all"); setTargetBranchId("");
      load();
    } catch (err: any) {
      alert(err.message || "Failed to post announcement.");
    } finally {
      setPosting(false);
    }
  };

  const markRead = async (id: number) => {
    await apiFetch(`/hub/announcements/${id}/read`, { method: "POST" }).catch(() => {});
    load();
  };

  const viewReads = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setReads(null); return; }
    setExpandedId(id);
    const res = await apiFetch(`/hub/announcements/${id}/reads`);
    setReads(res.ok ? await res.json() : { read: [], unread: [] });
  };

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">📢 Announcements</h1>
          <p className="neo-page-sub">{isAdmin ? "Broadcast to all employees and track who has read it." : "Company-wide updates from admin."}</p>
        </div>
        <div className="neo-page-actions">
          <button className="neo-btn-secondary neo-btn-sm" onClick={() => navigate("/hub")}>← Back to Hub</button>
          {isAdmin && <button className="neo-btn-primary" onClick={() => setShowNew(true)}>+ New Announcement</button>}
        </div>
      </div>

      {isAdmin ? (
        <div className="neo-table-wrap">
          <div className="neo-table-scroll">
            <table className="neo-table">
              <thead>
                <tr><th>Title</th><th>Date</th><th>Read By</th><th>Total Members</th><th>Read %</th></tr>
              </thead>
              <tbody>
                {announcements.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neu-text-muted)", padding: 32 }}>{loading ? "Loading…" : "No announcements yet."}</td></tr>
                ) : announcements.map((a) => (
                  <React.Fragment key={a.id}>
                    <tr onClick={() => viewReads(a.id)} style={{ cursor: "pointer" }}>
                      <td style={{ maxWidth: 320, whiteSpace: "normal", fontWeight: 600 }}>{a.content.split("\n")[0]}</td>
                      <td>{new Date(a.created_at).toLocaleDateString("en-IN")}</td>
                      <td>{a.read_count}</td>
                      <td>{a.total_members}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: "rgba(148,163,184,0.25)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${a.read_percent}%`, height: "100%", background: "#5B4BFF" }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{a.read_percent}%</span>
                        </div>
                      </td>
                    </tr>
                    {expandedId === a.id && reads && (
                      <tr>
                        <td colSpan={5} style={{ background: "rgba(91,75,255,0.03)", padding: 16 }}>
                          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: "#10B981", marginBottom: 6 }}>✓ READ ({reads.read.length})</div>
                              {reads.read.map((m) => <div key={m.id} style={{ fontSize: 12, padding: "2px 0" }}>{m.name}</div>)}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", marginBottom: 6 }}>○ NOT READ ({reads.unread.length})</div>
                              {reads.unread.map((m) => <div key={m.id} style={{ fontSize: 12, padding: "2px 0", color: "var(--neu-text-muted)" }}>{m.name}</div>)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {announcements.length === 0 && <p style={{ color: "var(--neu-text-muted)" }}>{loading ? "Loading…" : "No announcements yet."}</p>}
          {announcements.map((a) => (
            <div
              key={a.id}
              className="neu-card"
              onClick={() => !a.read_by_me && markRead(a.id)}
              style={{ padding: 18, cursor: a.read_by_me ? "default" : "pointer", position: "relative" }}
            >
              {!a.read_by_me && <span style={{ position: "absolute", top: 16, right: 16, width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />}
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>{a.content}</div>
              <div style={{ fontSize: 11, color: "var(--neu-text-muted)", marginTop: 10 }}>
                {a.sender_name} · {new Date(a.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="neo-modal-overlay" onClick={() => setShowNew(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header">
              <h3 className="neo-modal-title">New Announcement</h3>
              <button className="neo-modal-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", display: "block", marginBottom: 4 }}>Title</label>
                <input className="neu-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Holiday Notice" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", display: "block", marginBottom: 4 }}>Message</label>
                <textarea className="neu-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Details…" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", display: "block", marginBottom: 4 }}>Priority</label>
                  <select className="neu-select" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", display: "block", marginBottom: 4 }}>Target</label>
                  <select className="neu-select" value={target} onChange={(e) => setTarget(e.target.value as any)}>
                    <option value="all">All Employees</option>
                    <option value="branch">Specific Branch</option>
                  </select>
                </div>
              </div>
              {target === "branch" && (
                <select className="neu-select" value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>
                  <option value="">Select branch…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              )}
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="neo-btn-primary" disabled={posting} onClick={post}>{posting ? "Posting…" : "Post"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubAnnouncements;
