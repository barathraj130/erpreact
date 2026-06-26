import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import {
  FaEdit,
  FaHistory,
  FaMapMarkerAlt,
  FaPhone,
  FaPlus,
  FaSearch,
  FaSync,
  FaTag,
  FaTrash,
  FaUserCircle,
  FaUsers,
  FaWallet,
  FaWhatsapp,
  FaFileInvoice,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { deleteCustomer } from "../api/userApi";
import { apiFetch } from "../utils/api";
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
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [rowSentIds, setRowSentIds] = useState<Set<number>>(new Set());
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderList, setReminderList] = useState<any[]>([]);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());

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

  const handleExportExcel = () => {
    const fmt = (n: number) => Number(n || 0).toFixed(2);
    const today = new Date().toLocaleDateString("en-IN");

    const headers = ["S.No", "Name", "Display Name", "Phone", "Net Balance (₹)"];

    const rows = displayedCustomers.map((c, i) => {
      const bal = Number(c.remaining_balance) || 0;
      return [
        i + 1,
        c.username || "",
        c.nickname || "",
        c.phone || "",
        fmt(bal),
      ];
    });

    const csvContent = [
      [`Customer Outstanding Report — Exported on ${today}`],
      [],
      headers,
      ...rows,
    ]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const bom = "﻿"; // UTF-8 BOM so Excel reads ₹ correctly
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Customer_Outstanding_${today.replace(/\//g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const fmt = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  // Open preview modal — build list from already-loaded customers
  const openReminderModal = () => {
    const list = displayedCustomers
      .filter((c) => Number(c.remaining_balance) > 0 && c.phone)
      .map((c) => ({
        id: c.id,
        name: c.nickname || c.username,
        phone: c.phone,
        outstanding: Number(c.remaining_balance),
      }));
    setReminderList(list);
    setSentIds(new Set());
    setReminderMsg(null);
    setShowReminderModal(true);
  };

  // Send to one customer
  const sendOne = async (customerId: number) => {
    setSending(true);
    try {
      const res = await apiFetch("/users/send-reminders", {
        method: "POST",
        body: JSON.stringify({ customer_ids: [customerId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSentIds((prev) => new Set([...prev, customerId]));
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setSending(false);
    }
  };

  // Send to all in the list
  const sendAll = async () => {
    setSending(true);
    setReminderMsg(null);
    try {
      const ids = reminderList.map((c) => c.id);
      const res = await apiFetch("/users/send-reminders", {
        method: "POST",
        body: JSON.stringify({ customer_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSentIds(new Set(ids));
      setReminderMsg(data.message);
    } catch (err: any) {
      setReminderMsg("❌ " + err.message);
    } finally {
      setSending(false);
    }
  };

  // Send WhatsApp reminder directly from the row button
  const sendRowReminder = async (customer: any) => {
    if (!customer.phone) {
      alert(`No phone number saved for ${customer.nickname || customer.username}`);
      return;
    }
    setSendingId(customer.id);
    try {
      const res = await apiFetch("/users/send-reminders", {
        method: "POST",
        body: JSON.stringify({ customer_ids: [customer.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRowSentIds((prev) => new Set([...prev, customer.id]));
      // Reset sent badge after 4 seconds
      setTimeout(() => setRowSentIds((prev) => { const s = new Set(prev); s.delete(customer.id); return s; }), 4000);
    } catch (err: any) {
      alert("Failed to send: " + err.message);
    } finally {
      setSendingId(null);
    }
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
            title="Recompute all customer outstanding balances"
            onClick={async () => {
              if (!window.confirm("Recompute all customer balances? This fixes any mismatch between ledger and list.")) return;
              const res = await apiFetch("/users/recompute-all-balances", { method: "POST" });
              const data = await res.json();
              alert(`Done! Fixed: ${data.fixed}, Errors: ${data.errors}`);
              refresh();
            }}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "50px",
              background: "#6366f1", color: "#fff", border: "none",
              fontWeight: 600, fontSize: "13px", cursor: "pointer"
            }}
          >
            🔄 Sync Balances
          </button>
          <button
            onClick={handleExportExcel}
            title="Export all customers with outstanding balances to Excel/CSV"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "50px",
              background: "#16a34a", color: "#fff", border: "none",
              fontWeight: 600, fontSize: "13px", cursor: "pointer"
            }}
          >
            📊 Export Excel
          </button>
          <button
            onClick={openReminderModal}
            title="Preview and send outstanding balance WhatsApp reminders"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "50px",
              background: "#25D366", color: "#fff", border: "none",
              fontWeight: 600, fontSize: "13px", cursor: "pointer"
            }}
          >
            📱 Send Reminders
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
      {reminderMsg && (
        <div style={{
          margin: "8px 0", padding: "10px 16px", borderRadius: "8px",
          background: reminderMsg.startsWith("❌") ? "#fef2f2" : "#f0fdf4",
          color: reminderMsg.startsWith("❌") ? "#dc2626" : "#16a34a",
          fontSize: "13px", fontWeight: 600
        }}>
          {reminderMsg}
        </div>
      )}

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
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                  {/* WhatsApp */}
                  <button
                    onClick={() => sendRowReminder(user)}
                    disabled={sendingId === user.id}
                    style={{
                      flex: 1, padding: "7px 10px", borderRadius: "8px", border: "none",
                      background: rowSentIds.has(user.id) ? "#bbf7d0" : user.phone ? "#25D366" : "#e2e8f0",
                      color: rowSentIds.has(user.id) ? "#16a34a" : user.phone ? "#fff" : "#94a3b8",
                      fontWeight: 600, fontSize: "12px", cursor: user.phone ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                  >
                    {rowSentIds.has(user.id) ? "✅ Sent" : sendingId === user.id ? "⏳" : <><FaWhatsapp size={12} /> Remind</>}
                  </button>
                  {/* Call */}
                  {user.phone ? (
                    <a
                      href={`tel:${user.phone}`}
                      style={{
                        flex: 1, padding: "7px 10px", borderRadius: "8px",
                        background: "#eff6ff", color: "#3b82f6",
                        fontWeight: 600, fontSize: "12px",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                        textDecoration: "none"
                      }}
                    >
                      <FaPhone size={11} /> Call
                    </a>
                  ) : (
                    <span style={{ flex: 1, padding: "7px 10px", borderRadius: "8px", background: "#f1f5f9", color: "#cbd5e1", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                      <FaPhone size={11} /> No Phone
                    </span>
                  )}
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
                      <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                        {/* WhatsApp Reminder */}
                        <button
                          onClick={() => sendRowReminder(user)}
                          disabled={sendingId === user.id}
                          title={user.phone ? `Send WhatsApp reminder to ${user.phone}` : "No phone number saved"}
                          style={{
                            padding: "5px 9px", borderRadius: "7px", border: "none",
                            background: rowSentIds.has(user.id) ? "#bbf7d0" : user.phone ? "#25D366" : "#e2e8f0",
                            color: rowSentIds.has(user.id) ? "#16a34a" : user.phone ? "#fff" : "#94a3b8",
                            cursor: user.phone ? "pointer" : "not-allowed",
                            fontSize: "11px", fontWeight: 600,
                            display: "flex", alignItems: "center", gap: "4px",
                            opacity: sendingId === user.id ? 0.6 : 1,
                            transition: "all 0.2s"
                          }}
                        >
                          {rowSentIds.has(user.id) ? (
                            <span>✅</span>
                          ) : sendingId === user.id ? (
                            <span>⏳</span>
                          ) : (
                            <FaWhatsapp size={12} />
                          )}
                        </button>
                        {/* Call */}
                        {user.phone ? (
                          <a
                            href={`tel:${user.phone}`}
                            title={`Call ${user.phone}`}
                            style={{
                              padding: "5px 9px", borderRadius: "7px",
                              background: "#eff6ff", color: "#3b82f6",
                              fontSize: "11px", fontWeight: 600,
                              display: "flex", alignItems: "center", gap: "4px",
                              textDecoration: "none"
                            }}
                          >
                            <FaPhone size={11} />
                          </a>
                        ) : (
                          <span
                            title="No phone number"
                            style={{
                              padding: "5px 9px", borderRadius: "7px",
                              background: "#f1f5f9", color: "#cbd5e1",
                              fontSize: "11px", display: "flex", alignItems: "center"
                            }}
                          >
                            <FaPhone size={11} />
                          </span>
                        )}
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

      {/* ── WhatsApp Reminder Preview Modal ── */}
      {showReminderModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "560px",
            maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)"
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>📱 Send Outstanding Reminders</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {reminderList.length} customers with pending balance
                </div>
              </div>
              <button onClick={() => setShowReminderModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {reminderList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  No customers with outstanding balance and phone number.
                </div>
              ) : reminderList.map((c) => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", marginBottom: "8px", borderRadius: "10px",
                  background: sentIds.has(c.id) ? "#f0fdf4" : "#f8fafc",
                  border: `1px solid ${sentIds.has(c.id) ? "#bbf7d0" : "#e2e8f0"}`
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{c.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>📞 {c.phone}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontWeight: 700, color: "#dc2626", fontSize: "14px" }}>{fmt(c.outstanding)}</div>
                    {sentIds.has(c.id) ? (
                      <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "13px" }}>✅ Sent</span>
                    ) : (
                      <button
                        onClick={() => sendOne(c.id)}
                        disabled={sending}
                        style={{
                          padding: "5px 12px", borderRadius: "20px", border: "none",
                          background: "#25D366", color: "#fff", fontWeight: 600,
                          fontSize: "12px", cursor: sending ? "not-allowed" : "pointer"
                        }}
                      >
                        Send
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9" }}>
              {reminderMsg && (
                <div style={{
                  marginBottom: "12px", padding: "8px 12px", borderRadius: "8px",
                  background: reminderMsg.startsWith("❌") ? "#fef2f2" : "#f0fdf4",
                  color: reminderMsg.startsWith("❌") ? "#dc2626" : "#16a34a",
                  fontSize: "13px", fontWeight: 600
                }}>{reminderMsg}</div>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => setShowReminderModal(false)}
                  style={{ padding: "9px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 500 }}>
                  Close
                </button>
                {reminderList.length > 0 && sentIds.size < reminderList.length && (
                  <button onClick={sendAll} disabled={sending}
                    style={{
                      padding: "9px 20px", borderRadius: "8px", border: "none",
                      background: sending ? "#94a3b8" : "#25D366", color: "#fff",
                      fontWeight: 700, cursor: sending ? "not-allowed" : "pointer"
                    }}>
                    {sending ? "Sending…" : `📱 Send All (${reminderList.length - sentIds.size})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
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
          onRoundOffApplied={refresh}
        />
      )}
    </div>
  );
};

export default Customers;
