import React, { useState, useRef, useEffect } from "react";

interface Product {
  id: string | number;
  name: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  productName: string;
  onSelect: (product: { id: string; name: string }) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

const ProductCombobox: React.FC<ProductComboboxProps> = ({
  products,
  value,
  productName,
  onSelect,
  style,
  placeholder = "Type or select product...",
}) => {
  const [query, setQuery] = useState(productName || "");
  const [open, setOpen] = useState(false);
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

  const handleSelect = (product: Product) => {
    onSelect({ id: String(product.id), name: product.name });
    setQuery(product.name);
    setOpen(false);
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
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
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
        </div>
      )}
    </div>
  );
};

export default ProductCombobox;
