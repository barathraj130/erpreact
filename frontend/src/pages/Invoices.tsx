import { motion } from "framer-motion";
import React, { useState } from "react";
import {
  FaEdit,
  FaEye,
  FaFileInvoice,
  FaPlus,
  FaSearch,
  FaTrash,
  FaSync,
  FaChartBar,
  FaCheckCircle,
  FaClock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { useInvoices } from "../hooks/useInvoices";
import { apiFetch } from "../utils/api";
import "./PageShared.css";

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const { invoices = [], loading, refresh } = useInvoices();
  const { user } = useAuthUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const canDelete =
    user?.role === "admin" ||
    user?.permissions?.some((p: any) => p.action === "delete_invoices");

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      await apiFetch(`/invoice/${id}`, { method: "DELETE" });
      refresh();
    } catch (err) {
      alert("Failed to delete invoice.");
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const stats = {
    totalValue: filteredInvoices.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0),
    paidCount: filteredInvoices.filter(i => i.status?.toLowerCase() === 'paid').length,
    pendingValue: filteredInvoices
      .filter(i => i.status?.toLowerCase() !== 'paid')
      .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0),
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Track your sales transactions and payment collection status.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={refresh} aria-label="Refresh invoices">
            <FaSync className={loading ? "fa-spin" : ""} size={14} />
          </button>
          <button
            className="page-btn-round page-btn-round-primary"
            onClick={() => navigate("/invoices/new")}
            id="create-invoice-btn"
          >
            <FaPlus size={11} /> Create Invoice
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="premium-stats-grid">
        <div className="stat-card card-indigo">
          <FaChartBar className="stat-icon" />
          <div className="label">Total Invoiced</div>
          <div className="value">₹{stats.totalValue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Across all periods</div>
        </div>

        <div className="stat-card card-emerald">
          <FaCheckCircle className="stat-icon" />
          <div className="label">Settled Invoices</div>
          <div className="value">{stats.paidCount} Units</div>
          <div className="stat-sub">Successfully processed</div>
        </div>

        <div className="stat-card card-rose">
          <FaClock className="stat-icon" />
          <div className="label">Outstanding Aging</div>
          <div className="value">₹{stats.pendingValue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Pending collection</div>
        </div>
      </div>

      {/* Search */}
      <div className="page-search-bar" style={{ width: isMobile ? "100%" : "340px", marginBottom: "12px" }}>
        <FaSearch className="page-search-icon" size={13} />
        <input
          placeholder="Search by Invoice No or customer…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : filteredInvoices.length > 0 ? (
        isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 12px" }}>
            {filteredInvoices.map((inv, idx) => (
              <motion.div
                key={inv.id}
                className="tx-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="tx-icon" style={{ background: "var(--bg)", color: "#6366f1" }}>
                    <FaFileInvoice size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="tx-desc" style={{ fontSize: "14.5px" }}>{inv.invoice_number}</div>
                    <div className="tx-poster">{inv.customer_name}</div>
                  </div>
                  <span className={`type-badge ${inv.status?.toLowerCase() === 'paid' ? 'type-badge-green' : 'type-badge-red'}`}>
                    {inv.status || "DRAFT"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border-soft)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "---"}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "14.5px" }}>
                    ₹{Number(inv.total_amount).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button className="page-btn-round" style={{ flex: 1 }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <FaEye size={12} /> View
                  </button>
                  <button className="page-btn-round" style={{ flex: 1 }} onClick={() => navigate(`/invoices/edit/${inv.id}`)}>
                    <FaEdit size={12} /> Edit
                  </button>
                  {canDelete && (
                    <button className="page-btn-round-danger" onClick={() => handleDelete(inv.id)} aria-label="Delete invoice">
                      <FaTrash size={12} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Customer Name</th>
                  <th>Status</th>
                  <th>Issued Date</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv, idx) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FaFileInvoice style={{ color: "var(--text-3)", opacity: 0.5 }} size={13} />
                        <span className="font-bold">{inv.invoice_number}</span>
                      </div>
                    </td>
                    <td><div className="font-bold">{inv.customer_name}</div></td>
                    <td>
                      <span className={`type-badge ${inv.status?.toLowerCase() === 'paid' ? 'type-badge-green' : 'type-badge-red'}`}>
                        {inv.status || "DRAFT"}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">
                        {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "---"}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="font-bold">₹{Number(inv.total_amount).toLocaleString()}</span>
                    </td>
                    <td className="text-center">
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                        <button className="page-btn-round-sm" onClick={() => navigate(`/invoices/${inv.id}`)} aria-label="View invoice">
                          <FaEye size={13} />
                        </button>
                        <button className="page-btn-round-sm" onClick={() => navigate(`/invoices/edit/${inv.id}`)} aria-label="Edit invoice">
                          <FaEdit size={13} />
                        </button>
                        {canDelete && (
                          <button className="page-btn-round-danger" onClick={() => handleDelete(inv.id)} aria-label="Delete invoice">
                            <FaTrash size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="page-empty">
          <FaFileInvoice size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div style={{ fontSize: "14px", fontWeight: 500 }}>No invoices generated</div>
          <p style={{ margin: "4px 0 0", color: "var(--text-3)", fontSize: "12px" }}>Start billing your customers to see records here.</p>
        </div>
      )}
    </div>
  );
};

export default Invoices;
