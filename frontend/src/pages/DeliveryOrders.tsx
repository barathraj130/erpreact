import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaSync, FaEye, FaBox, FaFileInvoice } from "react-icons/fa";
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

  const badge = (status: string) => {
    const b = STATUS_BADGE[status] || STATUS_BADGE.draft;
    return (
      <span style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
        color: b.color, background: b.bg, letterSpacing: "0.04em",
      }}>{b.label}</span>
    );
  };

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

      {orders.length === 0 && !loading ? (
        <div className="page-empty">
          <FaBox size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>No delivery orders yet</div>
          <p style={{ margin: "4px 0 0", color: "var(--text-3)", fontSize: 12 }}>
            Create a delivery order to track bundle quantities before invoicing.
          </p>
        </div>
      ) : (
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
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      <button
                        className="page-btn-round-sm"
                        onClick={() => navigate(`/delivery-orders/${o.id}`)}
                        title="View / Confirm"
                      >
                        <FaEye size={13} />
                      </button>
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
                    </div>
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
