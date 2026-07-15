import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

interface SearchResult {
  type: string;
  type_label: string;
  id: number;
  title: string;
  subtitle: string;
  meta: string;
  url: string;
  icon: string;
}

const QUICK_ACTIONS = [
  { label: "New Invoice", path: "/invoices/new", icon: "🧾" },
  { label: "New Customer", path: "/customers", icon: "👥" },
  { label: "Record Expense", path: "/expenses", icon: "💸" },
  { label: "View Dashboard", path: "/dashboard", icon: "📊" },
  { label: "All Invoices", path: "/invoices", icon: "📋" },
  { label: "Finance Reports", path: "/reports/finance", icon: "📑" },
];

const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/search/global?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const closeSearch = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    closeSearch();
  };

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text-2)",
          fontSize: 13,
          cursor: "pointer",
          width: 220,
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 14 }}>🔍</span>
        <span>Search everything...</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          ⌘K
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 9999,
      }}
      onClick={closeSearch}
    >
      <div
        style={{
          width: 580,
          maxWidth: "92vw",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: results.length > 0 || loading ? "1px solid var(--border-soft)" : "none",
          }}
        >
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyNav}
            placeholder="Search invoices, customers, products, employees..."
            autoFocus
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              background: "transparent",
              color: "var(--text-1)",
              fontFamily: "inherit",
            }}
          />
          {loading && <span style={{ fontSize: 12, color: "var(--text-2)" }}>Searching...</span>}
          <button
            onClick={closeSearch}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              cursor: "pointer",
              fontSize: 12,
              padding: "3px 8px",
              borderRadius: 4,
              fontFamily: "inherit",
            }}
          >
            Esc
          </button>
        </div>

        {results.length > 0 && (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {results.map((result, i) => (
              <div
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                style={{
                  padding: "12px 18px",
                  cursor: "pointer",
                  background: i === selectedIndex ? "var(--surface-2)" : "transparent",
                  borderBottom: "1px solid var(--border-soft)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{result.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {result.title}
                  </div>
                  {result.subtitle && (
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{result.subtitle}</div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: "var(--surface-2)",
                    color: "var(--text-2)",
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  {result.type_label}
                </span>
                {result.meta && (
                  <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{result.meta}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-2)", fontSize: 14 }}>
            No results for "{query}"
          </div>
        )}

        {!query && (
          <div style={{ padding: "20px 18px" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-2)",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              QUICK ACTIONS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {QUICK_ACTIONS.map((action, i) => (
                <div
                  key={i}
                  onClick={() => {
                    navigate(action.path);
                    closeSearch();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "1px solid var(--border-soft)",
                    background: "var(--surface-2)",
                  }}
                >
                  <span>{action.icon}</span>
                  <span style={{ fontSize: 13, color: "var(--text-1)" }}>{action.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            padding: "8px 18px",
            borderTop: "1px solid var(--border-soft)",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--text-3)",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
