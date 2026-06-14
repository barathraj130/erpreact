import React, { useState, useRef, useEffect } from "react";
import { apiFetch } from "../utils/api";

interface Category {
  id: number;
  name: string;
  type: "income" | "expense" | "both";
  is_custom: boolean;
  usage_count: number;
}

const INCOME_KEYWORDS = [
  "sales", "income", "revenue", "receipt", "received", "refund", "interest", "service",
];
const EXPENSE_KEYWORDS = [
  "purchase", "rent", "salary", "salaries", "transport", "freight", "utilities",
  "maintenance", "supplies", "marketing", "tax", "gst", "expense", "raw", "material",
  "repair", "commission",
];

function detectType(name: string): "income" | "expense" | "both" {
  const n = name.toLowerCase();
  if (INCOME_KEYWORDS.some((k) => n.includes(k))) return "income";
  if (EXPENSE_KEYWORDS.some((k) => n.includes(k))) return "expense";
  return "both";
}

interface CategoryComboboxProps {
  value: string;
  onChange: (
    value: string,
    type?: "income" | "expense" | "both"
  ) => void;
  transactionType?: "RECEIPT" | "PAYMENT";
  placeholder?: string;
}

const typeColor = (t: string) =>
  t === "income" ? "#059669" : t === "expense" ? "#dc2626" : "#64748b";
const typeBg = (t: string) =>
  t === "income" ? "#f0fdf4" : t === "expense" ? "#fef2f2" : "#f8fafc";
const typeLabel = (t: string) =>
  t === "income" ? "Income" : t === "expense" ? "Expense" : "Both";

const CategoryCombobox: React.FC<CategoryComboboxProps> = ({
  value,
  onChange,
  transactionType,
  placeholder = "Category...",
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/api/transaction-categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filterType =
    transactionType === "RECEIPT"
      ? "income"
      : transactionType === "PAYMENT"
      ? "expense"
      : null;

  const filtered = categories.filter((c) => {
    const matchQuery =
      !query.trim() ||
      c.name.toLowerCase().includes(query.toLowerCase().trim());
    const matchType =
      !filterType || c.type === filterType || c.type === "both";
    return matchQuery && matchType;
  });

  const exactMatch = categories.some(
    (c) => c.name.toLowerCase() === query.toLowerCase().trim()
  );

  const saveUsage = (name: string, type: "income" | "expense" | "both") => {
    apiFetch("/api/transaction-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    }).catch(() => {});
  };

  const handleSelect = (cat: Category) => {
    setQuery(cat.name);
    onChange(cat.name, cat.type);
    setOpen(false);
    saveUsage(cat.name, cat.type);
  };

  const handleCustom = () => {
    if (!query.trim()) return;
    const detectedType = detectType(query.trim());
    onChange(query.trim(), detectedType);
    setOpen(false);
    saveUsage(query.trim(), detectedType);
  };

  const detectedType =
    query.trim() && !exactMatch ? detectType(query.trim()) : null;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          fontSize: "1rem",
          outline: "none",
          boxSizing: "border-box" as const,
          transition: "border-color 0.2s",
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1100,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: "240px",
            overflowY: "auto",
            marginTop: "4px",
          }}
        >
          {filtered.length === 0 && !query.trim() && (
            <div
              style={{
                padding: "10px 14px",
                fontSize: "0.85rem",
                color: "#94a3b8",
              }}
            >
              Type to search or create a category
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              onMouseDown={() => handleSelect(c)}
              style={{
                padding: "9px 14px",
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #f1f5f9",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f8fafc")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#fff")
              }
            >
              <span style={{ color: "#1e293b" }}>{c.name}</span>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  background: typeBg(c.type),
                  color: typeColor(c.type),
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {typeLabel(c.type)}
              </span>
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div
              onMouseDown={handleCustom}
              style={{
                padding: "9px 14px",
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f0fdf4",
                borderTop: filtered.length > 0 ? "1px solid #e2e8f0" : "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#dcfce7")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#f0fdf4")
              }
            >
              <span style={{ color: "#059669", fontWeight: 600 }}>
                + Use "{query.trim()}"
              </span>
              {detectedType && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: typeBg(detectedType),
                    color: typeColor(detectedType),
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {typeLabel(detectedType)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryCombobox;
