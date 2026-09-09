import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import HubChannel from "./HubChannel";
import "../../styles/neo-neu-motion.css";

interface Channel {
  id: number;
  channel_type: "direct" | "group" | "announcement" | "task";
  name?: string;
  display_name?: string;
  description?: string;
  member_count?: number;
  unread_count?: number;
  last_message_preview?: string;
  last_message_at?: string;
  task_reference_number?: string;
}
interface HubUser { id: number; name: string; email: string; role: string; phone?: string; }

const initials = (name?: string) => (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const TeamHub: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthUser();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [users, setUsers] = useState<HubUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelMembers, setNewChannelMembers] = useState<number[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/hub/channels");
      setChannels(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Failed to load channels", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Light 30s poll for the channel list itself (unread badges), separate from
  // HubChannel's own 5s in-conversation poll — same "no WebSockets" approach.
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const openUserPicker = async () => {
    try {
      const res = await apiFetch(`/hub/users${userSearch ? `?search=${encodeURIComponent(userSearch)}` : ""}`);
      setUsers(res.ok ? await res.json() : []);
    } catch {
      setUsers([]);
    }
  };

  const startDM = async (otherId: number) => {
    try {
      const res = await apiFetch("/hub/channels", { method: "POST", body: JSON.stringify({ channel_type: "direct", member_ids: [otherId] }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setShowNewDM(false);
      setSelectedId(data.channel_id);
      load();
    } catch (err: any) {
      alert(err.message || "Failed to start conversation.");
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return alert("Channel name is required.");
    try {
      const res = await apiFetch("/hub/channels", {
        method: "POST",
        body: JSON.stringify({ channel_type: "group", name: newChannelName.trim(), member_ids: newChannelMembers }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setShowNewChannel(false);
      setNewChannelName("");
      setNewChannelMembers([]);
      setSelectedId(data.channel_id);
      load();
    } catch (err: any) {
      alert(err.message || "Failed to create channel.");
    }
  };

  const dms = channels.filter((c) => c.channel_type === "direct" && (!search || (c.display_name || "").toLowerCase().includes(search.toLowerCase())));
  const groups = channels.filter((c) => c.channel_type === "group" && (!search || (c.display_name || c.name || "").toLowerCase().includes(search.toLowerCase())));
  const selected = channels.find((c) => c.id === selectedId);

  const ChannelRow: React.FC<{ c: Channel }> = ({ c }) => (
    <div
      onClick={() => setSelectedId(c.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", cursor: "pointer", borderRadius: 8,
        background: selectedId === c.id ? "rgba(91,75,255,0.10)" : "transparent",
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.channel_type === "direct" ? "#7C6CFF" : "#5B4BFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
        {initials(c.display_name || c.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.display_name || c.name}</div>
        <div style={{ fontSize: 11, color: "var(--neu-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.last_message_preview || (c.channel_type === "group" ? `${c.member_count || 0} members` : "No messages yet")}
        </div>
      </div>
      {!!c.unread_count && <span className="neo-badge neo-badge-brand" style={{ fontSize: 9, padding: "1px 7px" }}>{c.unread_count}</span>}
    </div>
  );

  const leftColumn = (
    <div style={{ width: isMobile ? "100%" : 260, flexShrink: 0, borderRight: isMobile ? "none" : "2px solid var(--neu-border)", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 14px" }}>
        <input className="neu-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: 12.5 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 6px 4px" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--neu-text-muted)", letterSpacing: "0.06em" }}>DIRECT MESSAGES</span>
          <button onClick={() => { setShowNewDM(true); openUserPicker(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5B4BFF", fontWeight: 800, fontSize: 14 }}>+</button>
        </div>
        {dms.length === 0 && <div style={{ fontSize: 11, color: "var(--neu-text-muted)", padding: "4px 6px" }}>No conversations yet.</div>}
        {dms.map((c) => <ChannelRow key={c.id} c={c} />)}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 6px 4px" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--neu-text-muted)", letterSpacing: "0.06em" }}>GROUP CHANNELS</span>
          {isAdmin && <button onClick={() => setShowNewChannel(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5B4BFF", fontWeight: 800, fontSize: 14 }}>+</button>}
        </div>
        {groups.length === 0 && <div style={{ fontSize: 11, color: "var(--neu-text-muted)", padding: "4px 6px" }}>No channels yet.</div>}
        {groups.map((c) => <ChannelRow key={c.id} c={c} />)}

        <div style={{ padding: "16px 6px 10px" }}>
          <button onClick={() => navigate("/hub/announcements")} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--neu-text-secondary)", padding: "6px 0" }}>
            📢 Announcements
          </button>
          <button onClick={() => navigate("/hub/forms")} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--neu-text-secondary)", padding: "6px 0" }}>
            📋 HR Forms
          </button>
        </div>
      </div>
    </div>
  );

  const middleColumn = selectedId ? (
    <HubChannel channelId={selectedId} onClose={isMobile ? () => setSelectedId(null) : undefined} />
  ) : (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "var(--neu-text-muted)" }}>
      <div style={{ fontSize: 48 }}>💬</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Select a conversation or start a new one</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="neo-btn-secondary neo-btn-sm" onClick={() => { setShowNewDM(true); openUserPicker(); }}>New DM</button>
        {isAdmin && <button className="neo-btn-secondary neo-btn-sm" onClick={() => setShowNewChannel(true)}>New Channel</button>}
        <button className="neo-btn-secondary neo-btn-sm" onClick={() => navigate("/hub/forms")}>Submit a Form</button>
      </div>
    </div>
  );

  const rightColumn = selected && !isMobile ? (
    <div style={{ width: 280, flexShrink: 0, borderLeft: "2px solid var(--neu-border)", padding: 18, overflowY: "auto" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#5B4BFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, margin: "0 auto 12px" }}>
        {initials(selected.display_name || selected.name)}
      </div>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14 }}>{selected.display_name || selected.name}</div>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--neu-text-muted)", marginTop: 2, textTransform: "capitalize" }}>{selected.channel_type}</div>
      {selected.channel_type === "group" && (
        <>
          <div style={{ marginTop: 18, fontSize: 10, fontWeight: 800, color: "var(--neu-text-muted)", letterSpacing: "0.06em" }}>MEMBERS</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>{selected.member_count || 0} people</div>
          {selected.description && (
            <>
              <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, color: "var(--neu-text-muted)", letterSpacing: "0.06em" }}>DESCRIPTION</div>
              <div style={{ fontSize: 12, marginTop: 6, color: "var(--neu-text-secondary)" }}>{selected.description}</div>
            </>
          )}
        </>
      )}
      {selected.task_reference_number && (
        <div style={{ marginTop: 18 }}>
          <span className="neo-badge neo-badge-brand">🔗 {selected.task_reference_number}</span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="neo-page" style={{ padding: 0 }}>
      <div style={{ padding: "18px 24px 12px" }}>
        <h1 className="neo-page-title">💬 Team Hub</h1>
        <p className="neo-page-sub">Direct messages, group channels, announcements, and HR requests — all in one place.</p>
      </div>
      <div style={{ display: "flex", height: "calc(100vh - 190px)", minHeight: 500, border: "2px solid var(--neu-border)", background: "var(--neu-surface)", margin: "0 24px 24px", borderRadius: 4, overflow: "hidden" }}>
        {(!isMobile || !selectedId) && leftColumn}
        {(!isMobile || selectedId) && middleColumn}
        {rightColumn}
      </div>

      {showNewDM && createPortal(
        <div className="neo-modal-overlay" onClick={() => setShowNewDM(false)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header"><h3 className="neo-modal-title">New Message</h3><button className="neo-modal-close" onClick={() => setShowNewDM(false)}>×</button></div>
            <div className="neo-modal-body">
              <input className="neu-input" placeholder="Search people…" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); openUserPicker(); }} style={{ marginBottom: 10 }} />
              <div style={{ maxHeight: 300, overflowY: "auto", display: "grid", gap: 4 }}>
                {users.map((u) => (
                  <div key={u.id} onClick={() => startDM(u.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer", borderRadius: 8 }} className="neo-hover-row">
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#7C6CFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{initials(u.name)}</div>
                    <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{u.name}</div><div style={{ fontSize: 10.5, color: "var(--neu-text-muted)", textTransform: "capitalize" }}>{u.role.replace(/_/g, " ")}</div></div>
                  </div>
                ))}
                {users.length === 0 && <div style={{ fontSize: 12, color: "var(--neu-text-muted)", padding: 8 }}>No people found.</div>}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showNewChannel && createPortal(
        <div className="neo-modal-overlay" onClick={() => setShowNewChannel(false)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header"><h3 className="neo-modal-title">New Channel</h3><button className="neo-modal-close" onClick={() => setShowNewChannel(false)}>×</button></div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 12 }}>
              <input className="neu-input" placeholder="Channel name (e.g. Sales, Warehouse)" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} />
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", display: "block", marginBottom: 6 }}>Add members</label>
                <input className="neu-input" placeholder="Search people…" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); openUserPicker(); }} style={{ marginBottom: 8 }} />
                <div style={{ maxHeight: 200, overflowY: "auto", display: "grid", gap: 4 }}>
                  {users.map((u) => (
                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 2px" }}>
                      <input
                        type="checkbox"
                        checked={newChannelMembers.includes(u.id)}
                        onChange={(e) => setNewChannelMembers((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setShowNewChannel(false)}>Cancel</button>
              <button className="neo-btn-primary" onClick={createChannel}>Create Channel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TeamHub;
