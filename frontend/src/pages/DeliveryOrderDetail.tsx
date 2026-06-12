import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaCheckCircle, FaTimes, FaFileInvoice,
  FaBox, FaSync,
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
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
  total_bundles: number;
  total_pieces: number;
  is_confirmed: boolean;
  is_cancelled: boolean;
  confirmed_at: string | null;
}

interface DeliveryOrder {
  id: number;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_id: number;
  status: "draft" | "ready" | "invoiced";
  converted_invoice_id: number | null;
  converted_invoice_number: string | null;
  items: DOItem[];
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "DRAFT",    color: "#6b7280", bg: "#f3f4f6" },
  ready:    { label: "READY TO INVOICE", color: "#065f46", bg: "#d1fae5" },
  invoiced: { label: "INVOICED", color: "#1e40af", bg: "#dbeafe" },
};

const DeliveryOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/delivery-orders/${id}`);
      const data = await res.json();
      if (data.success) setOrder(data.order);
      else setError(data.error || "Not found");
    } catch {
      setError("Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const confirmItem = async (itemId: number) => {
    setActionLoading(itemId);
    try {
      const res = await apiFetch(`/delivery-orders/${id}/confirm-item`, {
        method: "POST",
        body: JSON.stringify({ item_id: itemId }),
      });
      const data = await res.json();
      if (data.success) await load();
      else alert(data.error || "Failed to confirm.");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmAll = async () => {
    setActionLoading("all");
    try {
      const res = await apiFetch(`/delivery-orders/${id}/confirm-all`, { method: "POST" });
      const data = await res.json();
      if (data.success) await load();
      else alert(data.error || "Failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const cancelItem = async (itemId: number) => {
    if (!window.confirm("Cancel this item? It will be crossed out and excluded from the invoice.")) return;
    setActionLoading(itemId);
    try {
      const res = await apiFetch(`/delivery-orders/${id}/cancel-item`, {
        method: "POST",
        body: JSON.stringify({ item_id: itemId }),
      });
      const data = await res.json();
      if (data.success) await load();
      else alert(data.error || "Failed to cancel.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvertToInvoice = () => {
    navigate(`/invoices/new?delivery_order_id=${id}`);
  };

  if (loading) return (
    <div className="page-container">
      <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>Loading...</div>
    </div>
  );

  if (error || !order) return (
    <div className="page-container">
      <div style={{ textAlign: "center", padding: 60, color: "#dc2626" }}>{error || "Not found"}</div>
    </div>
  );

  const activeItems = order.items.filter(i => !i.is_cancelled);
  const pendingItems = activeItems.filter(i => !i.is_confirmed);
  const confirmedItems = activeItems.filter(i => i.is_confirmed);
  const allConfirmed = activeItems.length > 0 && pendingItems.length === 0;
  const totalPieces = activeItems.reduce((s, i) => s + (i.total_pieces || 0), 0);
  const statusBadge = STATUS_LABEL[order.status] || STATUS_LABEL.draft;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="page-btn-round-sm" onClick={() => navigate("/delivery-orders")}>
            <FaArrowLeft size={13} />
          </button>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {order.order_number}
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                color: statusBadge.color, background: statusBadge.bg, letterSpacing: "0.04em",
              }}>{statusBadge.label}</span>
            </h1>
            <p>
              {order.customer_name} &nbsp;·&nbsp;
              {order.order_date ? new Date(order.order_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "---"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="page-btn-round-sm" onClick={load}>
            <FaSync size={13} />
          </button>
          {order.status === "ready" && (
            <button
              onClick={handleConvertToInvoice}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10, border: "none",
                background: "#1d4ed8", color: "#fff", fontWeight: 700,
                fontSize: 13, cursor: "pointer",
              }}
            >
              <FaFileInvoice size={13} /> Convert to Invoice
            </button>
          )}
          {order.status === "invoiced" && order.converted_invoice_id && (
            <button
              onClick={() => navigate(`/invoices/${order.converted_invoice_id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10, border: "none",
                background: "#1e40af", color: "#fff", fontWeight: 700,
                fontSize: 13, cursor: "pointer",
              }}
            >
              <FaFileInvoice size={13} /> View Invoice {order.converted_invoice_number}
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      {order.status === "draft" && (
        <div style={{
          background: pendingItems.length > 0 ? "#fefce8" : "#f0fdf4",
          border: `1px solid ${pendingItems.length > 0 ? "#fde68a" : "#86efac"}`,
          borderRadius: 10, padding: "12px 18px", marginBottom: 20,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: pendingItems.length > 0 ? "#92400e" : "#166534" }}>
            {allConfirmed
              ? `All ${confirmedItems.length} item${confirmedItems.length !== 1 ? "s" : ""} confirmed — ready to convert to invoice.`
              : `${pendingItems.length} item${pendingItems.length !== 1 ? "s" : ""} pending confirmation`}
          </span>
          {!allConfirmed && (
            <button
              onClick={confirmAll}
              disabled={actionLoading === "all"}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: "#059669", color: "#fff", fontWeight: 700,
                fontSize: 12, cursor: "pointer",
              }}
            >
              {actionLoading === "all" ? "Confirming..." : "Confirm All"}
            </button>
          )}
          {allConfirmed && (
            <button
              onClick={handleConvertToInvoice}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: "#1d4ed8", color: "#fff", fontWeight: 700,
                fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <FaFileInvoice size={12} /> Convert to Invoice
            </button>
          )}
        </div>
      )}

      {/* Items */}
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border-1)",
        borderRadius: 12, overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid var(--border-1)",
          fontSize: 13, fontWeight: 700, color: "var(--text-2)",
        }}>
          Products ({order.items.length})
        </div>

        {order.items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-1)",
              opacity: item.is_cancelled ? 0.45 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: "var(--text-1)",
                  textDecoration: item.is_cancelled ? "line-through" : "none",
                  marginBottom: 10,
                }}>
                  <FaBox size={11} style={{ marginRight: 6, opacity: 0.5 }} />
                  {item.product_name}
                  {item.is_confirmed && !item.is_cancelled && (
                    <span style={{
                      marginLeft: 8, fontSize: 11, fontWeight: 700,
                      color: "#059669", background: "#d1fae5",
                      padding: "2px 8px", borderRadius: 20,
                    }}>
                      ✓ Confirmed
                    </span>
                  )}
                  {item.is_cancelled && (
                    <span style={{
                      marginLeft: 8, fontSize: 11, fontWeight: 700,
                      color: "#dc2626", background: "#fee2e2",
                      padding: "2px 8px", borderRadius: 20,
                    }}>
                      Cancelled
                    </span>
                  )}
                </div>

                {/* Bundle breakdown table */}
                {item.bundle_lines && item.bundle_lines.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <table style={{
                      borderCollapse: "collapse", fontSize: 12,
                      minWidth: 260, background: "var(--surface-2)",
                      borderRadius: 8, overflow: "hidden",
                    }}>
                      <thead>
                        <tr style={{ background: "var(--surface-3)" }}>
                          <th style={{ padding: "5px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-3)", borderBottom: "1px solid var(--border-1)" }}>Bundles</th>
                          <th style={{ padding: "5px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-3)", borderBottom: "1px solid var(--border-1)" }}>Per Bundle</th>
                          <th style={{ padding: "5px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-3)", borderBottom: "1px solid var(--border-1)" }}>Total Pcs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.bundle_lines.map((line, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-1)" }}>{line.bundles}</td>
                            <td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-1)" }}>{line.pieces_per_bundle}</td>
                            <td style={{ padding: "5px 12px", fontWeight: 600, borderBottom: "1px solid var(--border-1)" }}>{line.total}</td>
                          </tr>
                        ))}
                        <tr style={{ background: "var(--surface-3)" }}>
                          <td colSpan={2} style={{ padding: "5px 12px", fontWeight: 700, color: "var(--text-2)" }}>Total</td>
                          <td style={{ padding: "5px 12px", fontWeight: 700, color: "#059669" }}>
                            {item.total_pieces} pcs
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {order.status === "draft" && !item.is_cancelled && (
                <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                  {!item.is_confirmed ? (
                    <button
                      onClick={() => confirmItem(item.id)}
                      disabled={actionLoading === item.id}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "none",
                        background: "#059669", color: "#fff", fontWeight: 700,
                        fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <FaCheckCircle size={12} />
                      {actionLoading === item.id ? "..." : "Confirm Count"}
                    </button>
                  ) : (
                    <div style={{
                      padding: "8px 14px", borderRadius: 8,
                      background: "#f0fdf4", color: "#166534",
                      fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <FaCheckCircle size={12} /> Count Confirmed
                    </div>
                  )}
                  <button
                    onClick={() => cancelItem(item.id)}
                    disabled={actionLoading === item.id}
                    style={{
                      padding: "8px 12px", borderRadius: 8, border: "none",
                      background: "#fee2e2", color: "#dc2626", fontWeight: 700,
                      fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                    }}
                    title="Cancel this item"
                  >
                    <FaTimes size={12} /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border-1)",
        borderRadius: 12, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>
          {confirmedItems.length} of {activeItems.length} items confirmed
          {order.items.filter(i => i.is_cancelled).length > 0 && (
            <span style={{ color: "#dc2626", marginLeft: 8 }}>
              ({order.items.filter(i => i.is_cancelled).length} cancelled)
            </span>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Total: <span style={{ color: "#059669" }}>{totalPieces.toLocaleString()} pcs</span>
          {" "}across <span style={{ color: "#059669" }}>{activeItems.length}</span> products
        </div>
      </div>
    </div>
  );
};

export default DeliveryOrderDetail;
