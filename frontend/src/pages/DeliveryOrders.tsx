import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaSync, FaEye, FaBox, FaFileInvoice, FaEdit, FaTrash } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./PageShared.css";

interface DeliveryOrder {
  id: number;
  order_number: string;
  order_date: string;
  customer_name: string;
  item_count: number;
  total_pieces: number;
  status: "draft" | "ready" | "invoiced";
  converted_invoice_id: number | null;
  converted_invoice_number: string | null;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "DRAFT",    color: "#6b7280", bg: "#f3f4f6" },
  ready:    { label: "READY",    color: "#065f46", bg: "#d1fae5" },
  invoiced: { label: "INVOICED", color: "#1e40af", bg: "#dbeafe" },
};

const DeliveryOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/delivery-orders");
      const data = await res.json();
      if (data.success) setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (o: DeliveryOrder) => {
    if (!window.confirm(`Delete ${o.order_number}? This cannot be undone.`)) return;
    setDeletingId(o.id);
    try {
      const res = await apiFetch(`/delivery-orders/${o.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.filter(x => x.id !== o.id));
      } else {
        alert(data.error || "Delete failed.");
      }
    } catch (e: any) {
      alert(e.message || "Network error.");
    } finally {
      setDeletingId(null);
    }
  };

  const badge = (status: string) => {
    const b = STATUS_BADGE[status] || STATUS_BADGE.draft;
    return (
      <span style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
        color: b.color, background: b.bg, letterSpacing: "0.04em",
      }}>{b.label}</span>
    );
  };

  const ActionButtons = ({ o }: { o: DeliveryOrder }) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {/* View */}
      <button
        className="page-btn-round-sm"
        onClick={() => navigate(`/delivery-orders/${o.id}`)}
        title="View / Confirm"
      >
        <FaEye size={13} />
      </button>
      {/* Edit — only draft */}
      {o.status === "draft" && (
        <button
          className="page-btn-round-sm"
          onClick={() => navigate(`/delivery-orders/${o.id}/edit`)}
          title="Edit"
          style={{ color: "#6366f1" }}
        >
          <FaEdit size={13} />
        </button>
      )}
      {/* View Invoice — invoiced */}
      {o.status === "invoiced" && o.converted_invoice_id && (
        <button
          className="page-btn-round-sm"
          onClick={() => navigate(`/invoices/${o.converted_invoice_id}`)}
          title="View Invoice"
          style={{ color: "#3b82f6" }}
        >
          <FaFileInvoice size={13} />
        </button>
      )}
      {/* Delete — not invoiced */}
      {o.status !== "invoiced" && (
        <button
          className="page-btn-round-sm"
          onClick={() => handleDelete(o)}
          title="Delete"
          disabled={deletingId === o.id}
          style={{ color: "#dc2626", opacity: deletingId === o.id ? 0.5 : 1 }}
        >
          <FaTrash size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Delivery Orders</h1>
          <p>Track bundle-wise delivery and convert to invoice when ready.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load} aria-label="Refresh">
            <FaSync className={loading ? "fa-spin" : ""} size={14} />
          </button>
          <button
            className="page-btn-round page-btn-round-primary"
            onClick={() => navigate("/delivery-orders/new")}
          >
            <FaPlus size={11} /> Create Delivery Order
          </button>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="page-empty">
          <FaBox size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>No delivery orders yet</div>
          <p style={{ margin: "4px 0 0", color: "var(--text-3)", fontSize: 12 }}>
            Create a delivery order to track bundle quantities before invoicing.
          </p>
        </div>
      ) : isMobile ? (
        /* ── Mobile card layout ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map(o => (
            <div key={o.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    <FaBox size={11} style={{ opacity: 0.4 }} />
                    {o.order_number}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    {o.order_date ? new Date(o.order_date).toLocaleDateString("en-IN") : "---"}
                  </div>
                </div>
                {badge(o.status)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{o.customer_name || "---"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pieces</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{Number(o.total_pieces).toLocaleString()} pcs</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Items</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{o.item_count} product{Number(o.item_count) !== 1 ? "s" : ""}</div>
                </div>
                {o.status === "invoiced" && o.converted_invoice_number && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Invoice</div>
                    <div style={{ fontSize: 13, color: "#3b82f6", marginTop: 2 }}>{o.converted_invoice_number}</div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
                <ActionButtons o={o} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Desktop table layout ── */
        <div className="page-table-wrapper">
          <table className="page-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total Pieces</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <FaBox style={{ color: "var(--text-3)", opacity: 0.5 }} size={12} />
                      <span className="font-bold">{o.order_number}</span>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono">
                      {o.order_date ? new Date(o.order_date).toLocaleDateString("en-IN") : "---"}
                    </span>
                  </td>
                  <td><div className="font-bold">{o.customer_name || "---"}</div></td>
                  <td>{o.item_count} product{Number(o.item_count) !== 1 ? "s" : ""}</td>
                  <td>{Number(o.total_pieces).toLocaleString()} pcs</td>
                  <td>
                    {badge(o.status)}
                    {o.status === "invoiced" && o.converted_invoice_number && (
                      <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 2 }}>
                        {o.converted_invoice_number}
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    <ActionButtons o={o} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrders;
