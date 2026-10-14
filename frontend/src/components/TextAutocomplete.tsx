import React, { useState, useRef, useEffect } from "react";

// Generic free-text input with a suggestions dropdown sourced from a fixed
// options list (not a self-fetching combobox) — lets a field like product
// Category or Age Group accept any typed value while still surfacing
// everything already in use, so the list grows from real entries instead
// of needing to be predefined. Used for products.category / products.age_group.
interface TextAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  style?: React.CSSProperties;
}

const TextAutocomplete: React.FC<TextAutocompleteProps> = ({
  value,
  onChange,
  options,
  placeholder = "Type or pick...",
  style,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = (value || "").trim()
    ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase().trim()))
    : options;
  const exactMatch = options.some((o) => o.toLowerCase() === (value || "").toLowerCase().trim());

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: "100%",
          padding: "7px 9px",
          borderRadius: 6,
          border: "0.5px solid #e2e8f0",
          fontSize: 12.5,
          boxSizing: "border-box",
          ...style,
        }}
      />
      {open && (filtered.length > 0 || ((value || "").trim() && !exactMatch)) && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 1200,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {filtered.slice(0, 20).map((o) => (
            <div
              key={o}
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
              style={{ padding: "7px 10px", fontSize: "0.8rem", cursor: "pointer", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              {o}
            </div>
          ))}
          {(value || "").trim() && !exactMatch && (
            <div
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
              style={{ padding: "7px 10px", fontSize: "0.75rem", color: "#4f46e5", fontWeight: 600, background: "#f5f3ff" }}
            >
              + Use "{value.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TextAutocomplete;
