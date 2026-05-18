import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import {
  FaEdit,
  FaHistory,
  FaMapMarkerAlt,
  FaPlus,
  FaSearch,
  FaSync,
  FaTag,
  FaTrash,
  FaUserCircle,
  FaUsers,
  FaWallet,
  FaFileInvoice,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { deleteCustomer } from "../api/userApi";
import TransactionHistoryModal from "../components/TransactionHistoryModal";
import { useUsers } from "../hooks/useUsers";
import AddCustomerModal from "./AddCustomerModal";
import "./PageShared.css";

const Customers: React.FC = () => {
  const { customers = [], loading, error: fetchError, refresh } = useUsers();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const displayedCustomers = React.useMemo(() => {
    if (!Array.isArray(customers)) return [];

    return customers
      .filter((user) => {
        if (!user) return false;
        const username = user.username || "";
        const gstin = user.gstin || "";
        const nickname = user.nickname || "";

        const isNotAdmin = username.toLowerCase() !== "admin";
        const searchLower = searchTerm.toLowerCase();

        const matchesSearch =
          username.toLowerCase().includes(searchLower) ||
          gstin.toLowerCase().includes(searchLower) ||
          nickname.toLowerCase().includes(searchLower);

        return isNotAdmin && matchesSearch;
      })
      .sort((a, b) => (a.nickname || a.username || "").localeCompare(b.nickname || b.username || ""));
  }, [customers, searchTerm]);

  // Stats calculation — positive = outstanding (customer owes), negative = advance (we owe customer)
  const totalOutstanding = displayedCustomers.reduce((acc, curr) => {
    const b = Number(curr.remaining_balance) || 0;
    return acc + (b > 0 ? b : 0);
  }, 0);
  const totalAdvance = displayedCustomers.reduce((acc, curr) => {
    const b = Number(curr.remaining_balance) || 0;
    return acc + (b < 0 ? Math.abs(b) : 0);
  }, 0);
  const totalCustomers = displayedCustomers.length;

  const handleEdit = (customer: any) => {
    setCustomerToEdit(customer);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this customer? This cannot be undone.")) return;
    try {
      const result = await deleteCustomer(id);
      if (result.error) {
        // Offer force-delete if there are linked records
        const forceIt = window.confirm(
          result.error + "\n\nClick OK to FORCE DELETE and clear ALL linked invoices and transactions for this customer."
        );
        if (!forceIt) return;
        const forced = await deleteCustomer(id, true);
        if (forced.error) {
          alert(forced.error);
          return;
        }
      }
      refresh();
    } catch (err) {
      alert("Failed to delete customer. Please try again.");
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setCustomerToEdit(null);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Manage your corporate clients and partners.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={() => refresh()} aria-label="Refresh customers">
            <FaSync className={loading ? "fa-spin" : ""} size={14} />
          </button>
          <button
            className="page-btn-round page-btn-round-primary"
            onClick={() => {
              setCustomerToEdit(null);
              setShowModal(true);
            }}
          >
            <FaPlus size={11} /> Add Customer
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="premium-stats-grid">
        <div className="stat-card card-indigo">
          <FaUsers className="stat-icon" />
          <div className="label">Total Customers</div>
          <div className="value">{totalCustomers}</div>
          <div className="stat-sub">Active in system</div>
        </div>
        <div className="stat-card card-emerald">
          <FaWallet className="stat-icon" />
          <div className="label">Outstanding Balance</div>
          <div className="value">₹{totalOutstanding.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Pending collection</div>
        </div>
        <div className="stat-card card-indigo" style={{ borderLeft: '4px solid #10b981' }}>
          <FaWallet className="stat-icon" style={{ color: '#10b981' }} />
          <div className="label">Advance Credits</div>
          <div className="value" style={{ color: '#10b981' }}>₹{totalAdvance.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Overpaid by customers</div>
        </div>
        <div className="stat-card card-dark">
          <FaTag className="stat-icon" />
          <div className="label">Engagement</div>
          <div className="value">High</div>
          <div className="stat-sub">Real-time tracking</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
        <div className="page-search-bar" style={{ width: isMobile ? "100%" : "340px" }}>
          <FaSearch className="page-search-icon" size={13} />
          <input
            placeholder="Search customers by name, GSTIN…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Fetch error banner */}
      {fetchError && !loading && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626",
          padding: "12px 16px", borderRadius: "10px", marginBottom: "16px",
          fontSize: "0.875rem", fontWeight: 500, display: "flex",
          alignItems: "center", gap: "8px",
        }}>
          ⚠️ {fetchError}
          <button
            onClick={refresh}
            style={{ marginLeft: "auto", background: "none", border: "1px solid #fca5a5",
              color: "#dc2626", borderRadius: "6px", padding: "2px 10px",
              cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : displayedCustomers.length > 0 ? (
        isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 12px" }}>
            {displayedCustomers.map((user, idx) => (
              <motion.div
                key={user.id}
                className="tx-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="tx-icon" style={{ background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", fontWeight: 600, fontSize: "14px" }}>
                    {(user.nickname || user.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="tx-desc" style={{ fontSize: "14.5px" }}>{user.nickname || user.username}</div>
                    <div className="tx-poster">
                      GSTIN: {user.gstin || "N/A"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border-soft)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <FaMapMarkerAlt size={10} /> {user.city_pincode || user.state || "Not specified"}
                  </span>
                  {(() => {
                    const bal = Number(user.remaining_balance || 0);
                    const isAdvance = bal < 0;
                    return (
                      <span style={{ fontWeight: 600, fontSize: "13px", color: isAdvance ? "#16a34a" : bal > 0 ? "#dc2626" : "var(--text-3)" }}>
                        {isAdvance ? `ADV ₹${Math.abs(bal).toLocaleString("en-IN")}` : `₹${bal.toLocaleString("en-IN")}`}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button className="page-btn-round" style={{ flex: 1 }} onClick={() => { setSelectedCustomer(user); setShowTransactionModal(true); }}>
                    <FaHistory size={11} /> History
                  </button>
                  <Link 
                    className="page-btn-round" 
                    style={{ flex: 1, textDecoration: 'none', color: '#6366f1' }}
                    to={`/customers/${user.id}/ledger`}
                  >
                    <FaFileInvoice size={11} /> Ledger
                  </Link>
                  <button className="page-btn-round" style={{ flex: 1 }} onClick={() => handleEdit(user)}>
                    <FaEdit size={11} /> Edit
                  </button>
                  <button className="page-btn-round-danger" onClick={() => handleDelete(user.id)} aria-label="Delete customer">
                    <FaTrash size={11} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>GSTIN</th>
                  <th>Location</th>
                  <th className="text-right">Balance</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedCustomers.map((user, idx) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "34px", height: "34px", borderRadius: "10px",
                          background: "rgba(99, 102, 241, 0.1)", color: "#6366f1",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 600, fontSize: "13.5px", flexShrink: 0
                        }}>
                          {(user.nickname || user.username || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold" style={{ fontSize: "13.5px" }}>{user.nickname || user.username}</div>
                          {user.nickname && user.nickname !== user.username && (
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                              @{user.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono">{user.gstin || "N/A"}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-3)" }}>
                        <FaMapMarkerAlt size={11} />
                        {user.city_pincode || user.state || "Not specified"}
                      </div>
                    </td>
                    <td className="text-right">
                      {(() => {
                        const bal = Number(user.remaining_balance || 0);
                        const isAdvance = bal < 0;
                        return (
                          <div>
                            <span className="font-bold" style={{ color: isAdvance ? "#16a34a" : bal > 0 ? "#dc2626" : "var(--text-3)" }}>
                              ₹{Math.abs(bal).toLocaleString("en-IN")}
                            </span>
                            {isAdvance && <div style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600 }}>ADVANCE</div>}
                            {bal > 0 && <div style={{ fontSize: "10px", color: "#dc2626", fontWeight: 600 }}>OUTSTANDING</div>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-center">
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                        <button
                          className="page-btn-round-sm"
                          onClick={() => { setSelectedCustomer(user); setShowTransactionModal(true); }}
                          title="View History"
                        >
                          <FaHistory size={12} />
                        </button>
                        <Link
                          className="page-btn-round-sm"
                          style={{ color: '#6366f1' }}
                          to={`/customers/${user.id}/ledger`}
                          title="View Ledger"
                        >
                          <FaFileInvoice size={12} />
                        </Link>
                        <button
                          className="page-btn-round-sm"
                          onClick={() => handleEdit(user)}
                          title="Edit Customer"
                        >
                          <FaEdit size={12} />
                        </button>
                        <button
                          className="page-btn-round-danger"
                          onClick={() => handleDelete(user.id)}
                          title="Delete Customer"
                        >
                          <FaTrash size={12} />
                        </button>
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
          <FaUserCircle size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div style={{ fontSize: "14px", fontWeight: 500 }}>No customers found</div>
          <p style={{ margin: "4px 0 0", color: "var(--text-3)", fontSize: "12px" }}>Add your first corporate client to get started.</p>
        </div>
      )}

      {showModal && (
        <AddCustomerModal
          onClose={handleModalClose}
          onSuccess={refresh}
          customerToEdit={customerToEdit}
        />
      )}

      {showTransactionModal && selectedCustomer && (
        <TransactionHistoryModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setSelectedCustomer(null);
          }}
          entityType="customer"
          entityId={selectedCustomer.id}
          entityName={selectedCustomer.username}
        />
      )}
    </div>
  );
};

export default Customers;
