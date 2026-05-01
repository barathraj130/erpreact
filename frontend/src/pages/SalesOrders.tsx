import { motion } from "framer-motion";
import React, { useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaFileInvoice,
  FaPlus,
  FaSearch,
  FaShippingFast,
  FaSync,
  FaChartLine,
} from "react-icons/fa";
import "./PageShared.css";

interface SalesOrder {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  order_date: string;
  total_value: number;
  status: "Confirmed" | "Shipped" | "Invoiced" | "Pending";
}

const SalesOrders: React.FC = () => {
  const [orders, setOrders] = useState<SalesOrder[]>([
    {
      id: 1,
      order_number: "SO-2024-001",
      customer_id: 5,
      customer_name: "Tech Solutions Ltd",
      order_date: "2024-07-20",
      total_value: 12500.5,
      status: "Confirmed",
    },
    {
      id: 2,
      order_number: "SO-2024-002",
      customer_id: 8,
      customer_name: "Global Corp",
      order_date: "2024-07-22",
      total_value: 450.0,
      status: "Shipped",
    },
    {
      id: 3,
      order_number: "SO-2024-003",
      customer_id: 2,
      customer_name: "Local Retailer",
      order_date: "2024-07-25",
      total_value: 3200.0,
      status: "Pending",
    },
  ]);
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const refresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleCreateInvoice = (orderId: number) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    
    if (window.confirm(`Convert Sales Order ${order.order_number} to Invoice?`)) {
      alert(`Converting Order #${orderId} to Invoice...`);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredOrders = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const stats = {
    totalValue: filteredOrders.reduce((acc, curr) => acc + curr.total_value, 0),
    activeOrders: filteredOrders.filter(o => o.status !== "Invoiced").length,
    pending: filteredOrders.filter(o => o.status === "Pending").length,
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Confirmed":
        return { bg: "var(--green-bg)", color: "var(--green)", icon: <FaCheckCircle /> };
      case "Shipped":
        return { bg: "var(--accent-bg)", color: "var(--accent)", icon: <FaShippingFast /> };
      case "Pending":
        return { bg: "var(--amber-bg)", color: "var(--amber)", icon: <FaClipboardList /> };
      case "Invoiced":
        return { bg: "var(--bg)", color: "var(--text-3)", icon: <FaFileInvoice /> };
      default:
        return { bg: "var(--bg)", color: "var(--text-3)", icon: null };
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Sales Orders</h1>
          <p>Track and manage customer purchase commitments.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn" onClick={refresh} style={{ width: "40px", height: "40px", padding: 0 }}>
            <FaSync className={loading ? "fa-spin" : ""} size={14} />
          </button>
          <button className="page-btn page-btn-primary" onClick={() => alert("Open Create Order Modal")}>
            <FaPlus size={11} /> Create Order
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="premium-stats-grid">
        <div className="stat-card card-indigo">
          <FaChartLine className="stat-icon" />
          <div className="label">Total Pipeline</div>
          <div className="value">₹{stats.totalValue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Estimated revenue</div>
        </div>
        <div className="stat-card card-emerald">
          <FaCheckCircle className="stat-icon" />
          <div className="label">Confirmed</div>
          <div className="value">{stats.activeOrders} SO</div>
          <div className="stat-sub">Ready for fulfillment</div>
        </div>
        <div className="stat-card card-amber">
          <FaClipboardList className="stat-icon" />
          <div className="label">Pending Review</div>
          <div className="value">{stats.pending} SO</div>
          <div className="stat-sub">Draft orders</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
        <div className="page-search-bar" style={{ width: isMobile ? "100%" : "340px" }}>
          <FaSearch className="page-search-icon" size={13} />
          <input
            placeholder="Search orders by number or customer…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : filteredOrders.length > 0 ? (
        isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "0 12px" }}>
            {filteredOrders.map((order, idx) => {
              const s = getStatusStyle(order.status);
              return (
                <motion.div
                  key={order.id}
                  className="tx-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="tx-icon" style={{ background: "var(--bg)", color: "var(--text-2)" }}>
                      <FaClipboardList size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="tx-desc" style={{ fontSize: "14.5px" }}>{order.order_number}</div>
                      <div className="tx-poster">{order.customer_name}</div>
                    </div>
                    <span
                      className="type-badge"
                      style={{ background: s.bg, color: s.color, height: "fit-content" }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border-soft)" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <FaCalendarAlt size={11} /> {new Date(order.order_date).toLocaleDateString()}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "14.5px" }}>
                      ₹{order.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {order.status !== "Invoiced" && (
                    <button
                      className="page-btn page-btn-primary"
                      onClick={() => handleCreateInvoice(order.id)}
                      style={{ marginTop: "12px", width: "100%", justifyContent: "center" }}
                    >
                      <FaFileInvoice size={12} /> Convert to Invoice
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="text-right">Total Value</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, idx) => {
                  const s = getStatusStyle(order.status);
                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td>
                        <span className="font-bold" style={{ fontSize: "13.5px" }}>{order.order_number}</span>
                      </td>
                      <td>{order.customer_name}</td>
                      <td>
                        <span className="font-mono">
                          {new Date(order.order_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-bold" style={{ color: "var(--text-1)" }}>
                          ₹{order.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="type-badge"
                          style={{ background: s.bg, color: s.color, display: "inline-flex", alignItems: "center", gap: "6px", width: "100px", justifyContent: "center" }}
                        >
                          {s.icon} <span style={{ textTransform: "uppercase", fontSize: "10px", fontWeight: 700 }}>{order.status}</span>
                        </span>
                      </td>
                      <td className="text-center">
                        {order.status !== "Invoiced" && (
                          <button
                            className="page-btn"
                            onClick={() => handleCreateInvoice(order.id)}
                            style={{ padding: "6px 12px", fontSize: "11.5px" }}
                          >
                            <FaFileInvoice size={12} /> Invoice
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="page-empty">
          <FaClipboardList size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div style={{ fontSize: "14px", fontWeight: 500 }}>No sales orders found</div>
          <p style={{ margin: "4px 0 0", color: "var(--text-3)", fontSize: "12px" }}>Confirmed orders will appear here for fulfillment and invoicing.</p>
        </div>
      )}
    </div>
  );
};

export default SalesOrders;
