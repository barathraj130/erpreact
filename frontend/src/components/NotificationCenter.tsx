import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface Notification {
  id: number;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  info: "🔔",
  success: "✅",
  warning: "⚠️",
  danger: "🚨",
  payment: "💰",
  invoice: "🧾",
  expense: "💸",
  stock: "📦",
};

const TYPE_COLORS: Record<string, string> = {
  info: "var(--accent)",
  success: "var(--green)",
  warning: "var(--amber)",
  danger: "var(--red)",
  payment: "var(--green)",
  invoice: "var(--accent)",
  expense: "var(--red)",
  stock: "var(--amber)",
};

const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silent — notification center is non-critical
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id: number) => {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "relative",
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 15,
          padding: "6px 9px",
          display: "flex",
          alignItems: "center",
          color: "var(--text-2)",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "var(--red)",
              color: "#fff",
              borderRadius: "50%",
              width: 16,
              height: 16,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              width: 360,
              maxHeight: 480,
              overflowY: "auto",
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
              zIndex: 999,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-soft)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize: 12,
                    color: "var(--accent)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) window.location.href = n.link;
                    setOpen(false);
                  }}
                  style={{
                    padding: "12px 18px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-soft)",
                    background: n.is_read ? "transparent" : "var(--surface-2)",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      marginTop: 5,
                      background: n.is_read ? "transparent" : TYPE_COLORS[n.type] || "var(--accent)",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: "var(--text-1)" }}>
                      {TYPE_ICONS[n.type] || "🔔"} {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
