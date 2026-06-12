import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaSave } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { useUsers } from "../hooks/useUsers";
import { fetchProducts, Product } from "../api/productApi";
import "./PageShared.css";

interface BundleLine {
  bundles: number;
  pieces_per_bundle: number;
  total: number;
}

interface DOItem {
  id: number;
  product_id: number | null;
  product_name: string;
  bundle_lines: BundleLine[];
}

const emptyBundleLine = (): BundleLine => ({ bundles: 1, pieces_per_bundle: 0, total: 0 });

const CreateDeliveryOrder: React.FC = () => {
  const navigate = useNavigate();
  const { customers } = useUsers();
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<DOItem[]>([
    { id: Date.now(), product_id: null, product_name: "", bundle_lines: [emptyBundleLine()] },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts().then(p => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);

  const totalPieces = (bundleLines: BundleLine[]) =>
    bundleLines.reduce((s, b) => s + (b.total || 0), 0);

  const updateBundleLine = (itemIdx: number, lineIdx: number, key: keyof BundleLine, val: number) => {
    setItems(prev => {
      const next = prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const lines = item.bundle_lines.map((l, j) => {
          if (j !== lineIdx) return l;
          const updated = { ...l, [key]: val };
          updated.total = (updated.bundles || 0) * (updated.pieces_per_bundle || 0);
          return updated;
        });
        return { ...item, bundle_lines: lines };
      });
      return next;
    });
  };

  const addBundleLine = (itemIdx: number) => {
    setItems(prev => prev.map((item, i) =>
      i === itemIdx
        ? { ...item, bundle_lines: [...item.bundle_lines, emptyBundleLine()] }
        : item
    ));
  };

  const removeBundleLine = (itemIdx: number, lineIdx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      const lines = item.bundle_lines.filter((_, j) => j !== lineIdx);
      return { ...item, bundle_lines: lines.length ? lines : [emptyBundleLine()] };
    }));
  };

  const updateItemProduct = (itemIdx: number, productId: number) => {
    const prod = products.find(p => p.id === productId);
    setItems(prev => prev.map((item, i) =>
      i === itemIdx
        ? { ...item, product_id: productId, product_name: prod?.name || "" }
        : item
    ));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Date.now(),
      product_id: null,
      product_name: "",
      bundle_lines: [emptyBundleLine()],
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!customerId) return setError("Select a customer.");
    const validItems = items.filter(i => i.product_id && totalPieces(i.bundle_lines) > 0);
    if (validItems.length === 0) return setError("Add at least one product with bundle lines.");
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch("/delivery-orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          order_date: orderDate,
          items: validItems.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            bundle_lines: item.bundle_lines,
            total_bundles: item.bundle_lines.reduce((s, b) => s + (b.bundles || 0), 0),
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        navigate(`/delivery-orders/${data.order_id}`);
      } else {
        setError(data.error || "Failed to save.");
      }
    } catch (e: any) {
      setError(e.message || "Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="page-btn-round-sm" onClick={() => navigate("/delivery-orders")}>
            <FaArrowLeft size={13} />
          </button>
          <div>
            <h1>New Delivery Order</h1>
            <p>Record bundle quantities — rates will be entered when creating the invoice.</p>
          </div>
        </div>
        <button
          className="page-btn-round page-btn-round-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <FaSave size={12} /> {saving ? "Saving..." : "Save Delivery Order"}
        </button>
      </div>

      {error && (
        <div style={{
          background: "#fee2e2", color: "#991b1b", padding: "10px 16px",
          borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
        }}>{error}</div>
      )}

      {/* Order Details */}
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border-1)",
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginBottom: 14 }}>
          Order Details
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>
              Customer *
            </label>
            <select
              value={customerId}
              onChange={e => setCustomerId(Number(e.target.value))}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid var(--border-1)", background: "var(--surface-2)",
                color: "var(--text-1)", fontSize: 13,
              }}
            >
              <option value="">Select customer...</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>
              Order Date
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid var(--border-1)", background: "var(--surface-2)",
                color: "var(--text-1)", fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border-1)",
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Products</div>
          <button
            onClick={addItem}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, border: "1.5px solid var(--primary)",
              background: "transparent", color: "var(--primary)", fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}
          >
            <FaPlus size={11} /> Add Product
          </button>
        </div>

        {items.map((item, itemIdx) => (
          <div
            key={item.id}
            style={{
              border: "1px solid var(--border-1)", borderRadius: 10, padding: 16, marginBottom: 14,
              background: "var(--surface-2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ flex: 1, marginRight: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 5 }}>
                  Product
                </label>
                <select
                  value={item.product_id || ""}
                  onChange={e => updateItemProduct(itemIdx, Number(e.target.value))}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8,
                    border: "1px solid var(--border-1)", background: "var(--surface-1)",
                    color: "var(--text-1)", fontSize: 13,
                  }}
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(itemIdx)}
                  style={{
                    padding: "6px 8px", borderRadius: 7, border: "none",
                    background: "#fee2e2", color: "#dc2626", cursor: "pointer", marginTop: 18,
                  }}
                  title="Remove product"
                >
                  <FaTrash size={12} />
                </button>
              )}
            </div>

            {/* Bundle Lines */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 36px",
                gap: 8, marginBottom: 6,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>Bundles</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>Pcs / Bundle</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>Total Pcs</div>
                <div />
              </div>
              {item.bundle_lines.map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 36px",
                    gap: 8, marginBottom: 6,
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    value={line.bundles || ""}
                    onChange={e => updateBundleLine(itemIdx, lineIdx, "bundles", Number(e.target.value))}
                    placeholder="0"
                    style={{
                      padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border-1)",
                      background: "var(--surface-1)", color: "var(--text-1)", fontSize: 13, width: "100%",
                    }}
                  />
                  <input
                    type="number"
                    min={1}
                    value={line.pieces_per_bundle || ""}
                    onChange={e => updateBundleLine(itemIdx, lineIdx, "pieces_per_bundle", Number(e.target.value))}
                    placeholder="0"
                    style={{
                      padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border-1)",
                      background: "var(--surface-1)", color: "var(--text-1)", fontSize: 13, width: "100%",
                    }}
                  />
                  <div style={{
                    padding: "7px 10px", borderRadius: 7, background: "#f0fdf4",
                    color: "#166534", fontSize: 13, fontWeight: 700,
                  }}>
                    {line.total || 0} pcs
                  </div>
                  <button
                    onClick={() => removeBundleLine(itemIdx, lineIdx)}
                    disabled={item.bundle_lines.length === 1}
                    style={{
                      padding: "6px 8px", borderRadius: 7, border: "none",
                      background: item.bundle_lines.length === 1 ? "transparent" : "#fee2e2",
                      color: item.bundle_lines.length === 1 ? "#d1d5db" : "#dc2626",
                      cursor: item.bundle_lines.length === 1 ? "default" : "pointer",
                    }}
                  >
                    <FaTrash size={11} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => addBundleLine(itemIdx)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 7, border: "1px dashed var(--border-1)",
                  background: "transparent", color: "var(--text-3)", fontSize: 12, cursor: "pointer",
                }}
              >
                <FaPlus size={9} /> Add Line
              </button>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
                Total: <span style={{ color: "#059669" }}>{totalPieces(item.bundle_lines)} pcs</span>
              </div>
            </div>
          </div>
        ))}

        <div style={{
          borderTop: "1px solid var(--border-1)", paddingTop: 12, marginTop: 4,
          display: "flex", justifyContent: "flex-end",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Grand Total:{" "}
            <span style={{ color: "#059669" }}>
              {items.reduce((s, item) => s + totalPieces(item.bundle_lines), 0).toLocaleString()} pcs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateDeliveryOrder;
