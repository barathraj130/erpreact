import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import "../../styles/neo-neu-motion.css";

interface Reaction { emoji: string; count: number; reacted: boolean; }
interface HubMessage {
  id: number;
  channel_id: number;
  sender_id: number;
  sender_name: string;
  message_type: "text" | "image" | "document" | "voice" | "system" | "form";
  content?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  reply_to_id?: number | null;
  reply_content?: string | null;
  reply_sender_name?: string | null;
  is_deleted: boolean;
  form_type?: string | null;
  form_data?: Record<string, any> | null;
  form_status: string;
  form_id?: number | null;
  live_form_status?: string | null;
  form_submitted_to?: number | null;
  reactions?: Reaction[] | null;
  read_count?: number;
  created_at: string;
}

const FORM_TYPES: { type: string; icon: string; label: string }[] = [
  { type: "leave_request", icon: "🏖️", label: "Leave Request" },
  { type: "advance_request", icon: "💰", label: "Advance Request" },
  { type: "expense_claim", icon: "🧾", label: "Expense Claim" },
  { type: "asset_request", icon: "💼", label: "Asset Request" },
  { type: "work_from_home", icon: "🏠", label: "Work From Home" },
  { type: "overtime_request", icon: "⏰", label: "Overtime Request" },
  { type: "complaint", icon: "📢", label: "Complaint" },
  { type: "suggestion", icon: "💡", label: "Suggestion" },
  { type: "other", icon: "📝", label: "Other Request" },
];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏"];

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const dateLabel = (d: string) => {
  const date = new Date(d); const today = new Date(); const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yest)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const initials = (name?: string) => (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

interface Props { channelId?: string | number; onClose?: () => void; }

const HubChannel: React.FC<Props> = ({ channelId: propChannelId, onClose }) => {
  const params = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthUser();
  const channelId = propChannelId ?? params.id;

  const [channelInfo, setChannelInfo] = useState<any>(null);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<HubMessage | null>(null);
  const [showFormsPanel, setShowFormsPanel] = useState(false);
  const [activeFormType, setActiveFormType] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<Record<string, any>>({});
  const [sendToOptions, setSendToOptions] = useState<any[]>([]);
  const [sendToId, setSendToId] = useState<string>("");
  const [submittingForm, setSubmittingForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!channelId) return;
    try {
      const [msgRes, chRes] = await Promise.all([
        apiFetch(`/hub/channels/${channelId}/messages`),
        apiFetch(`/hub/channels?type=`).then((r) => r.json()).catch(() => []),
      ]);
      const msgs = msgRes.ok ? await msgRes.json() : [];
      setMessages(msgs);
      const info = Array.isArray(chRes) ? chRes.find((c: any) => String(c.id) === String(channelId)) : null;
      if (info) setChannelInfo(info);
    } catch (err) {
      console.error("Failed to load channel", err);
    }
  }, [channelId]);

  useEffect(() => { load(); }, [load]);

  // Poll every 5s while the tab is visible, per spec — no WebSockets.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") load(); };
    pollRef.current = window.setInterval(tick, 5000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [load]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length]);

  const sendMessage = async (extra: Partial<HubMessage> = {}) => {
    if (!channelId) return;
    const body: any = {
      content: extra.content !== undefined ? extra.content : input.trim() || null,
      message_type: extra.message_type || "text",
      reply_to_id: replyTo?.id || null,
      ...extra,
    };
    if (!body.content && !body.file_url && !body.form_data) return;
    try {
      const res = await apiFetch(`/hub/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setInput("");
      setReplyTo(null);
      load();
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/hub/upload", { method: "POST", body: fd }, false);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");
      const isImage = file.type.startsWith("image/");
      await sendMessage({
        message_type: isImage ? "image" : "document",
        content: null,
        file_url: data.file_url, file_name: data.file_name, file_size: data.file_size, file_type: data.file_type,
      });
    } catch (err: any) {
      alert(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, `voice_${Date.now()}.webm`);
          const res = await apiFetch("/hub/upload", { method: "POST", body: fd }, false);
          const data = await res.json();
          if (!data.success) throw new Error(data.error);
          await sendMessage({ message_type: "voice", content: null, file_url: data.file_url, file_name: data.file_name, file_size: data.file_size, file_type: data.file_type });
        } catch (err: any) {
          alert(err.message || "Voice upload failed.");
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const openForm = async (type: string) => {
    setActiveFormType(type);
    setShowFormsPanel(false);
    setFormFields({});
    setSendToId("");
    try {
      const res = await apiFetch(`/authority/decision-makers?request_type=${type}`);
      const options = res.ok ? await res.json() : [];
      setSendToOptions(options);
      if (options[0]) setSendToId(String(options[0].id));
    } catch {
      setSendToOptions([]);
    }
  };

  const submitForm = async () => {
    if (!activeFormType) return;
    setSubmittingForm(true);
    try {
      await sendMessage({
        message_type: "form",
        content: null,
        form_type: activeFormType,
        form_data: { ...formFields, send_to_id: sendToId ? Number(sendToId) : null },
      });
      setActiveFormType(null);
      setFormFields({});
    } finally {
      setSubmittingForm(false);
    }
  };

  const react = async (messageId: number, emoji: string) => {
    await apiFetch(`/hub/messages/${messageId}/react`, { method: "POST", body: JSON.stringify({ emoji }) }).catch(() => {});
    load();
  };

  const deleteMessage = async (messageId: number) => {
    if (!confirm("Delete this message?")) return;
    await apiFetch(`/hub/messages/${messageId}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const respondToForm = async (formId: number, status: "approved" | "rejected") => {
    const response = status === "rejected" ? prompt("Reason for rejecting (required):") : prompt("Optional note:");
    if (status === "rejected" && !response?.trim()) return;
    const res = await apiFetch(`/hub/forms/${formId}/respond`, { method: "PUT", body: JSON.stringify({ status, response: response || undefined }) });
    const data = await res.json();
    if (!data.success) alert(data.error || "Failed to respond.");
    load();
  };

  let lastDate = "";

  if (!channelId) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--neu-text-muted)" }}>No conversation selected.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{`
        .hub-hover-action { opacity: 0; transition: opacity 120ms; }
        .hub-msg-row:hover .hub-hover-action { opacity: 1; }
      `}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "2px solid var(--neu-border)", background: "var(--neu-surface)" }}>
        {onClose && <button className="neo-btn-secondary neo-btn-sm" onClick={onClose}>←</button>}
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#5B4BFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
          {initials(channelInfo?.display_name || channelInfo?.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{channelInfo?.display_name || channelInfo?.name || "Conversation"}</div>
          <div style={{ fontSize: 11, color: "var(--neu-text-muted)" }}>
            {channelInfo?.channel_type === "group" ? `${channelInfo?.member_count || 0} members` : channelInfo?.channel_type === "direct" ? "Direct message" : channelInfo?.channel_type}
          </div>
        </div>
        {channelInfo?.task_reference_number && (
          <span className="neo-badge neo-badge-brand">🔗 {channelInfo.task_reference_number}</span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4, minHeight: 0 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", color: "var(--neu-text-muted)", padding: 40, fontSize: 13 }}>No messages yet — say hello 👋</div>}
        {messages.map((m) => {
          const isMe = m.sender_id === user?.id;
          const showDateSep = dateLabel(m.created_at) !== lastDate;
          lastDate = dateLabel(m.created_at);

          return (
            <React.Fragment key={m.id}>
              {showDateSep && (
                <div style={{ textAlign: "center", margin: "12px 0 4px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--neu-text-muted)", background: "var(--neu-surface-2)", padding: "3px 12px", borderRadius: 999 }}>{lastDate}</span>
                </div>
              )}

              {m.message_type === "form" ? (
                <FormCard message={m} isMe={isMe} isAdmin={isAdmin} currentUserId={user?.id} onRespond={respondToForm} />
              ) : (
                <div style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end", marginBottom: 6 }} className="hub-msg-row">
                  {!isMe && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#7C6CFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                      {initials(m.sender_name)}
                    </div>
                  )}
                  <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    {!isMe && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--neu-text-muted)", marginBottom: 2 }}>{m.sender_name}</div>}
                    <div
                      style={{
                        background: isMe ? "#5B4BFF" : "var(--neu-surface)",
                        color: isMe ? "#fff" : "var(--neu-text-primary)",
                        border: isMe ? "none" : "1.5px solid var(--neu-border)",
                        borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        padding: "9px 13px",
                        fontSize: 13.5,
                        wordBreak: "break-word",
                        position: "relative",
                      }}
                    >
                      {m.reply_to_id && (
                        <div style={{ borderLeft: "2px solid rgba(255,255,255,0.5)", paddingLeft: 6, marginBottom: 4, fontSize: 11, opacity: 0.85 }}>
                          <b>{m.reply_sender_name}</b>: {m.reply_content?.slice(0, 60)}
                        </div>
                      )}
                      {m.message_type === "image" && m.file_url && (
                        <img src={m.file_url} alt={m.file_name || "image"} style={{ maxWidth: 220, borderRadius: 8, display: "block", marginBottom: m.content ? 6 : 0 }} />
                      )}
                      {m.message_type === "document" && m.file_url && (
                        <a href={m.file_url} target="_blank" rel="noreferrer" style={{ color: "inherit", display: "flex", alignItems: "center", gap: 6, textDecoration: "underline" }}>
                          📎 {m.file_name || "Document"}
                        </a>
                      )}
                      {m.message_type === "voice" && m.file_url && (
                        <audio controls src={m.file_url} style={{ maxWidth: 220 }} />
                      )}
                      {m.content && <div>{m.content}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 9.5, color: "var(--neu-text-muted)" }}>{fmtTime(m.created_at)}</span>
                      {isMe && <span style={{ fontSize: 9.5, color: m.read_count && m.read_count > 1 ? "#5B4BFF" : "var(--neu-text-muted)" }}>{m.read_count && m.read_count > 1 ? "✓✓" : "✓"}</span>}
                      <button className="hub-hover-action" onClick={() => setReplyTo(m)} title="Reply" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--neu-text-muted)" }}>↩</button>
                      {isMe && <button className="hub-hover-action" onClick={() => deleteMessage(m.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#EF4444" }}>🗑</button>}
                      {REACTION_EMOJIS.map((e) => (
                        <button key={e} className="hub-hover-action" onClick={() => react(m.id, e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10 }}>{e}</button>
                      ))}
                    </div>
                    {!!m.reactions?.length && (
                      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                        {m.reactions.map((r) => (
                          <span key={r.emoji} onClick={() => react(m.id, r.emoji)} style={{ fontSize: 11, cursor: "pointer", background: r.reacted ? "rgba(91,75,255,0.15)" : "var(--neu-surface-2)", padding: "1px 6px", borderRadius: 999 }}>
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 18px", background: "rgba(91,75,255,0.06)", borderTop: "1px solid var(--neu-border)", fontSize: 12 }}>
          <span>Replying to <b>{replyTo.sender_name}</b>: {(replyTo.content || "").slice(0, 50)}</span>
          <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* Input area */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "2px solid var(--neu-border)", background: "var(--neu-surface)" }}>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
        <button className="neo-btn-secondary neo-btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file">📎</button>
        <button className="neo-btn-secondary neo-btn-sm" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={() => recording && stopRecording()} title="Hold to record" style={recording ? { background: "#FF3B3B", color: "#fff" } : {}}>🎤</button>
        <button className="neo-btn-secondary neo-btn-sm" onClick={() => setShowFormsPanel(true)} title="Submit a form">📋</button>
        <input
          className="neu-input"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={uploading ? "Uploading…" : "Type a message…"}
          disabled={uploading}
        />
        <button className="neo-btn-primary neo-btn-sm" onClick={() => sendMessage()} disabled={uploading}>Send</button>
      </div>

      {/* Forms panel */}
      {showFormsPanel && (
        <div className="neo-modal-overlay" onClick={() => setShowFormsPanel(false)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header">
              <h3 className="neo-modal-title">Submit a Form</h3>
              <button className="neo-modal-close" onClick={() => setShowFormsPanel(false)}>×</button>
            </div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 8 }}>
              {FORM_TYPES.map((f) => (
                <button
                  key={f.type}
                  onClick={() => openForm(f.type)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--neu-surface-2)", border: "1.5px solid var(--neu-border)", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left", color: "var(--neu-text-primary)" }}
                >
                  <span style={{ fontSize: 18 }}>{f.icon}</span> {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Form field modal */}
      {activeFormType && (
        <FormFieldModal
          formType={activeFormType}
          fields={formFields}
          setFields={setFormFields}
          sendToOptions={sendToOptions}
          sendToId={sendToId}
          setSendToId={setSendToId}
          submitting={submittingForm}
          onCancel={() => setActiveFormType(null)}
          onSubmit={submitForm}
        />
      )}
    </div>
  );
};

// ── Form card rendered inline in the message list ───────────────────────────
const FORM_LABELS: Record<string, string> = {
  leave_request: "LEAVE REQUEST", advance_request: "ADVANCE REQUEST", expense_claim: "EXPENSE CLAIM",
  asset_request: "ASSET REQUEST", work_from_home: "WORK FROM HOME", overtime_request: "OVERTIME REQUEST",
  complaint: "COMPLAINT", suggestion: "SUGGESTION", other: "REQUEST",
};
const STATUS_COLORS: Record<string, string> = { pending: "#D97706", under_review: "#0891B2", approved: "#059669", rejected: "#DC2626", cancelled: "#64748B" };
const STATUS_LABEL: Record<string, string> = { pending: "⏳ PENDING", under_review: "👀 UNDER REVIEW", approved: "✅ APPROVED", rejected: "❌ REJECTED", cancelled: "CANCELLED" };

const FormCard: React.FC<{ message: HubMessage; isMe: boolean; isAdmin: boolean; currentUserId?: number; onRespond: (id: number, status: "approved" | "rejected") => void }> = ({ message, isMe, isAdmin, currentUserId, onRespond }) => {
  const d = message.form_data || {};
  const status = message.live_form_status || message.form_status || "pending";
  const color = STATUS_COLORS[status] || "#D97706";
  const canDecide = (isAdmin || message.form_submitted_to === currentUserId) && (status === "pending" || status === "under_review");

  const detail = () => {
    switch (message.form_type) {
      case "leave_request": return `From: ${d.from_date || "?"} → ${d.to_date || "?"} (${d.total_days || "?"} days)\nType: ${d.leave_type || "?"}\nReason: ${d.reason || "—"}`;
      case "advance_request": return `Amount: ₹${d.amount || 0}\nNeeded by: ${d.needed_by || "?"}\nReason: ${d.reason || "—"}`;
      case "expense_claim": return `${d.expense_type || "?"}: ₹${d.amount || 0} on ${d.expense_date || "?"}\n${d.description || ""}`;
      case "overtime_request": return `Date: ${d.date || "?"}\nExtra hours: ${d.extra_hours || "?"}\nReason: ${d.reason || "—"}`;
      case "work_from_home": return `${d.from_date || "?"} → ${d.to_date || "?"}\nReason: ${d.reason || "—"}`;
      case "complaint": return `Category: ${d.category || "Other"}${d.anonymous ? " (anonymous)" : ""}\n${d.description || ""}`;
      case "suggestion": return `${d.title || ""}\n${d.description || ""}`;
      case "asset_request": return `${d.asset_name || d.description || "—"}\nReason: ${d.reason || "—"}`;
      default: return d.description || "—";
    }
  };

  return (
    <div style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: 320, margin: "6px 0" }}>
      <div className="neu-card" style={{ borderLeft: `4px solid ${color}`, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", marginBottom: 8 }}>📋 {FORM_LABELS[message.form_type || "other"]}</div>
        <div style={{ borderTop: "1px dashed var(--neu-border)", margin: "6px 0" }} />
        <div style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.6, color: "var(--neu-text-secondary)" }}>{detail()}</div>
        <div style={{ borderTop: "1px dashed var(--neu-border)", margin: "8px 0" }} />
        <div style={{ fontSize: 11, fontWeight: 800, color }}>Status: {STATUS_LABEL[status]}</div>
        {canDecide && message.form_id && (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="neo-btn-success neo-btn-sm" onClick={() => onRespond(message.form_id!, "approved")}>Approve</button>
            <button className="neo-btn-danger neo-btn-sm" onClick={() => onRespond(message.form_id!, "rejected")}>Reject</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Per-form-type field modal ────────────────────────────────────────────────
const FormFieldModal: React.FC<{
  formType: string; fields: Record<string, any>; setFields: (f: Record<string, any>) => void;
  sendToOptions: any[]; sendToId: string; setSendToId: (v: string) => void;
  submitting: boolean; onCancel: () => void; onSubmit: () => void;
}> = ({ formType, fields, setFields, sendToOptions, sendToId, setSendToId, submitting, onCancel, onSubmit }) => {
  const set = (k: string, v: any) => setFields({ ...fields, [k]: v });

  useEffect(() => {
    if (formType === "leave_request" && fields.from_date && fields.to_date) {
      const days = Math.round((new Date(fields.to_date).getTime() - new Date(fields.from_date).getTime()) / 86400000) + 1;
      if (days > 0 && days !== fields.total_days) set("total_days", days);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.from_date, fields.to_date]);

  const label = FORM_LABELS[formType] || "REQUEST";

  return (
    <div className="neo-modal-overlay" onClick={onCancel}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="neo-modal-header">
          <h3 className="neo-modal-title">{label.charAt(0) + label.slice(1).toLowerCase()}</h3>
          <button className="neo-modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="neo-modal-body" style={{ display: "grid", gap: 12 }}>
          {formType === "leave_request" && (
            <>
              <Field label="Leave Type">
                <select className="neu-select" value={fields.leave_type || ""} onChange={(e) => set("leave_type", e.target.value)}>
                  <option value="">Select…</option>
                  <option value="Casual">Casual</option><option value="Sick">Sick</option>
                  <option value="Earned">Earned</option><option value="Maternity">Maternity</option><option value="Unpaid">Unpaid</option>
                </select>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="From Date"><input type="date" className="neu-input" value={fields.from_date || ""} onChange={(e) => set("from_date", e.target.value)} /></Field>
                <Field label="To Date"><input type="date" className="neu-input" value={fields.to_date || ""} onChange={(e) => set("to_date", e.target.value)} /></Field>
              </div>
              <Field label={`Total Days${fields.total_days ? ` (${fields.total_days})` : ""}`}><div style={{ fontSize: 12, color: "var(--neu-text-muted)" }}>Auto-calculated from dates</div></Field>
              <Field label="Reason (required)"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
              <Field label="Contact During Leave (optional)"><input className="neu-input" value={fields.contact_during_leave || ""} onChange={(e) => set("contact_during_leave", e.target.value)} /></Field>
            </>
          )}
          {formType === "advance_request" && (
            <>
              <Field label="Amount Needed (₹)"><input type="number" className="neu-input" value={fields.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} /></Field>
              <Field label="Reason (required)"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
              <Field label="When Needed By"><input type="date" className="neu-input" value={fields.needed_by || ""} onChange={(e) => set("needed_by", e.target.value)} /></Field>
              <Field label="Repayment Plan">
                <select className="neu-select" value={fields.repayment_plan || ""} onChange={(e) => set("repayment_plan", e.target.value)}>
                  <option value="">Select…</option><option value="Salary Deduction">Salary Deduction</option><option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Notes"><textarea className="neu-textarea" value={fields.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
            </>
          )}
          {formType === "expense_claim" && (
            <>
              <Field label="Expense Type">
                <select className="neu-select" value={fields.expense_type || ""} onChange={(e) => set("expense_type", e.target.value)}>
                  <option value="">Select…</option><option>Travel</option><option>Food</option><option>Communication</option><option>Stationery</option><option>Other</option>
                </select>
              </Field>
              <Field label="Amount (₹)"><input type="number" className="neu-input" value={fields.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} /></Field>
              <Field label="Date of Expense"><input type="date" className="neu-input" value={fields.expense_date || ""} onChange={(e) => set("expense_date", e.target.value)} /></Field>
              <Field label="Description (required)"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Bill Available?">
                <select className="neu-select" value={fields.bill_available ? "Yes" : "No"} onChange={(e) => set("bill_available", e.target.value === "Yes")}>
                  <option value="Yes">Yes</option><option value="No">No</option>
                </select>
              </Field>
            </>
          )}
          {formType === "asset_request" && (
            <>
              <Field label="Asset Needed"><input className="neu-input" value={fields.asset_name || ""} onChange={(e) => set("asset_name", e.target.value)} /></Field>
              <Field label="Reason (required)"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
            </>
          )}
          {formType === "work_from_home" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="From Date"><input type="date" className="neu-input" value={fields.from_date || ""} onChange={(e) => set("from_date", e.target.value)} /></Field>
                <Field label="To Date"><input type="date" className="neu-input" value={fields.to_date || ""} onChange={(e) => set("to_date", e.target.value)} /></Field>
              </div>
              <Field label="Reason (required)"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
            </>
          )}
          {formType === "overtime_request" && (
            <>
              <Field label="Date"><input type="date" className="neu-input" value={fields.date || ""} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Extra Hours"><input type="number" className="neu-input" value={fields.extra_hours || ""} onChange={(e) => set("extra_hours", Number(e.target.value))} /></Field>
              <Field label="Reason"><textarea className="neu-textarea" value={fields.reason || ""} onChange={(e) => set("reason", e.target.value)} /></Field>
            </>
          )}
          {formType === "complaint" && (
            <>
              <Field label="Category">
                <select className="neu-select" value={fields.category || ""} onChange={(e) => set("category", e.target.value)}>
                  <option value="">Select…</option><option>Harassment</option><option>Salary Issue</option><option>Work Conditions</option><option>Management</option><option>Other</option>
                </select>
              </Field>
              <Field label="Description (required)"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={!!fields.anonymous} onChange={(e) => set("anonymous", e.target.checked)} /> Submit anonymously
              </label>
            </>
          )}
          {formType === "suggestion" && (
            <>
              <Field label="Title"><input className="neu-input" value={fields.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <Field label="Description"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Department (optional)"><input className="neu-input" value={fields.department || ""} onChange={(e) => set("department", e.target.value)} /></Field>
            </>
          )}
          {formType === "other" && (
            <Field label="Description"><textarea className="neu-textarea" value={fields.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
          )}

          <Field label="Send To">
            <select className="neu-select" value={sendToId} onChange={(e) => setSendToId(e.target.value)}>
              <option value="">Select decision maker…</option>
              {sendToOptions.map((o) => <option key={o.id} value={o.id}>{o.name}{o.display_title ? ` — ${o.display_title}` : ""}</option>)}
            </select>
          </Field>
          <div style={{ padding: "8px 12px", background: "rgba(91,75,255,0.08)", border: "0.5px solid rgba(91,75,255,0.20)", fontSize: 10, color: "#7C6CFF" }}>
            ⚡ Only showing people with authority to decide this request type. Configured by Admin.
          </div>
        </div>
        <div className="neo-modal-footer">
          <button className="neo-btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="neo-btn-primary" disabled={submitting} onClick={onSubmit}>{submitting ? "Submitting…" : "Submit"}</button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--neu-text-muted)", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

export default HubChannel;
