import React, { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

interface Product {
  id: string | number;
  name: string;
  cost_price?: number;
  gst_percent?: number;
  unit?: string;
  hsn_code?: string;
  image_url?: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  productName: string;
  onSelect: (product: { id: string; name: string }) => void;
  onProductCreated?: (product: { id: string; name: string }) => void;
  onNameChange?: (name: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

const ProductCombobox: React.FC<ProductComboboxProps> = ({
  products,
  value,
  productName,
  onSelect,
  onProductCreated,
  onNameChange,
  style,
  placeholder = "Type product name",
}) => {
  const [query, setQuery] = useState(productName || "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const skipBlur = useRef(false);

  useEffect(() => {
    setQuery(productName || "");
    if (productName) setSaved(false);
  }, [productName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase().trim())
      ).slice(0, 8)
    : products.slice(0, 8);

  const exactMatch = products.find(
    (p) => p.name.toLowerCase() === query.toLowerCase().trim()
  );

  const commitProduct = useCallback(
    async (name: string) => {
      if (!name.trim() || saving) return;

      const exact = products.find(
        (p) => p.name.toLowerCase() === name.toLowerCase().trim()
      );
      if (exact) {
        onSelect({ id: String(exact.id), name: exact.name });
        setQuery(exact.name);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        return;
      }

      setSaving(true);
      try {
        const res = await apiFetch(
          "/api/products/quick",
          { method: "POST", body: JSON.stringify({ name: name.trim() }) },
          true
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        if (data.product) {
          const p = { id: String(data.product.id), name: data.product.name };
          onSelect(p);
          setQuery(p.name);
          if (data.created) onProductCreated?.(p);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } catch (err: any) {
        console.error("Product save failed:", err.message);
      } finally {
        setSaving(false);
      }
    },
    [products, onSelect, onProductCreated, saving]
  );

  const handleSelect = (product: Product) => {
    skipBlur.current = true;
    onSelect({ id: String(product.id), name: product.name });
    setQuery(product.name);
    setOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      if (query.trim()) {
        skipBlur.current = true;
        setOpen(false);
        commitProduct(query);
        if (e.key === "Enter") e.preventDefault();
      }
    }
    if (e.key === "Escape") setOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (skipBlur.current) {
        skipBlur.current = false;
        return;
      }
      setOpen(false);
      if (query.trim() && !value) {
        commitProduct(query);
      }
    }, 150);
  };

  const borderColor = saving
    ? "#f59e0b"
    : saved || value
    ? "#10b981"
    : query.trim()
    ? "#f59e0b"
    : "#ef4444";

  const baseInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 28px 7px 8px",
    borderRadius: "8px",
    border: `1.5px solid ${borderColor}`,
    fontSize: "0.82rem",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    ...style,
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setSaved(false);
            onNameChange?.(v);
            if (!v.trim()) onSelect({ id: "", name: "" });
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={baseInputStyle}
        />
        <div
          style={{
            position: "absolute",
            right: 7,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          {saving ? (
            <span style={{ color: "#f59e0b" }}>...</span>
          ) : saved || value ? (
            <span style={{ color: "#10b981" }}>✓</span>
          ) : null}
        </div>
      </div>

      {!value && query.trim() && !saving && !saved && (
        <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2, paddingLeft: 2 }}>
          Press Enter or Tab to save "{query.trim()}"
        </div>
      )}

      {open && (filtered.length > 0 || (query.trim() && !exactMatch)) && (
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
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {filtered.map((p) => (
            <div
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(p);
              }}
              style={{
                padding: "8px 12px",
                fontSize: "0.82rem",
                cursor: "pointer",
                background: String(p.id) === value ? "#eff6ff" : "#fff",
                color: "#1e293b",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  String(p.id) === value ? "#eff6ff" : "#fff")
              }
            >
              <span style={{ fontSize: 10, color: "#10b981" }}>✓</span>
              {p.name}
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                commitProduct(query);
              }}
              style={{
                padding: "9px 12px",
                fontSize: "0.82rem",
                cursor: "pointer",
                color: "#4f46e5",
                fontWeight: 600,
                background: "#f5f3ff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderTop: filtered.length > 0 ? "1px solid #e2e8f0" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ede9fe")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f3ff")}
            >
              <span style={{ fontSize: 14 }}>+</span>
              Add "{query.trim()}" as new product
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductCombobox;
