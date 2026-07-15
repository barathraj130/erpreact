import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], description: "Open global search" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close any modal or search" },
  { keys: ["Ctrl", "N"], description: "New invoice" },
  { keys: ["Ctrl", "E"], description: "Record expense" },
  { keys: ["F2"], description: "Focus product search (billing screen)" },
  { keys: ["F8"], description: "Focus payment amount (billing screen)" },
  { keys: ["F9"], description: "Save bill (billing screen)" },
];

/**
 * Mounted once at the app root. Shows the shortcuts list on `?`, and also
 * owns the global Ctrl+N / Ctrl+E navigation shortcuts referenced in that
 * list (F2/F8/F9 already exist inside BranchBilling.tsx and are untouched).
 */
const KeyboardShortcuts: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !isTyping) {
        e.preventDefault();
        navigate("/invoices/new");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e" && !isTyping) {
        e.preventDefault();
        navigate("/expenses");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: "28px 32px",
          width: 480,
          maxWidth: "92vw",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-2)" }}
          >
            ×
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: i < SHORTCUTS.length - 1 ? "1px solid var(--border-soft)" : "none",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-1)" }}>{s.description}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {s.keys.map((k, ki) => (
                  <span
                    key={ki}
                    style={{
                      fontSize: 12,
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontFamily: "monospace",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-1)",
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-2)", textAlign: "center" }}>
          Press ? anywhere to show this again
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
