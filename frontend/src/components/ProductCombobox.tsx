import React, { useState, useRef, useEffect } from "react";
import { apiFetch } from "../utils/api";

interface Product {
  id: string | number;
  name: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  productName: string;
  onSelect: (product: { id: string; name: string }) => void;
  onProductCreated?: (product: { id: string; name: string }) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

const ProductCombobox: React.FC<ProductComboboxProps> = ({
  products,
  value,
  productName,
  onSelect,
  onProductCreated,
  style,
  placeholder = "Type or select product...",
}) => {
  const [query, setQuery] = useState(productName || "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(productName || "");
  }, [productName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  const filtered = query.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase().trim())
      )
    : products;

  const exactMatch = products.some(
    (p) => p.name.toLowerCase() === query.toLowerCase().trim()
  );

  const handleSelect = (product: Product) => {
    onSelect({ id: String(product.id), name: product.name });
    setQuery(product.name);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!query.trim() || creating) return;
    setCreating(true);
    try {
      // Use the existing multipart endpoint — works on current Railway deployment
      const fd = new FormData();
      fd.append("name", query.trim());
      fd.append("unit", "pcs");
      fd.append("gst_percent", "0");
      const res = await apiFetch("/api/products", { method: "POST", body: fd }, false);
      let data: any = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`);
      if (data.product) {
        const newProduct = { id: String(data.product.id), name: data.product.name };
        onSelect(newProduct);
        onProductCreated?.(newProduct);
        setQuery(data.product.name);
        setOpen(false);
      }
    } catch (err: any) {
      alert(`Failed to create product: ${err?.message || "Please try again."}`);
    } finally {
      setCreating(false);
    }
  };

  const baseInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 8px",
    borderRadius: "8px",
    border: !value ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
    fontSize: "0.82rem",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
    ...style,
  };

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
        style={baseInputStyle}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1200,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
            maxHeight: "220px",
            overflowY: "auto",
            marginTop: "2px",
          }}
        >
          {filtered.length === 0 && query.trim() && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: "0.8rem",
                color: "#64748b",
              }}
            >
              No products found
            </div>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              style={{
                padding: "8px 12px",
                fontSize: "0.82rem",
                cursor: "pointer",
                background: String(p.id) === value ? "#eff6ff" : "#fff",
                color: "#1e293b",
                borderBottom: "1px solid #f1f5f9",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f8fafc")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  String(p.id) === value ? "#eff6ff" : "#fff")
              }
            >
              {p.name}
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div
              onMouseDown={handleCreate}
              style={{
                padding: "8px 12px",
                fontSize: "0.82rem",
                cursor: creating ? "wait" : "pointer",
                background: "#f0fdf4",
                color: "#059669",
                fontWeight: 600,
                borderTop: filtered.length > 0 ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {creating ? "Creating..." : `+ Create "${query.trim()}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductCombobox;
