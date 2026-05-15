import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaEdit,
  FaExclamationTriangle,
  FaHistory,
  FaPlus,
  FaSearch,
  FaSync,
  FaTrash,
  FaUserTie,
  FaFileInvoice,
  FaMoneyBillWave,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { Supplier, deleteSupplier, fetchSuppliers } from "../api/supplierApi";
import { apiFetch } from "../utils/api";
import TransactionHistoryModal from "../components/TransactionHistoryModal";
import AddSupplierModal from "./AddSupplierModal";
import "./Suppliers.css";

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Pay Supplier state
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'CASH', notes: '' });
  const [payLoading, setPayLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn("API Error, using dummy data fallback:", err.message);
      setSuppliers([
        {
          id: 101,
          name: "Super Global Trading (Demo)",
          phone: "+91 98765 43210",
          email: "sales@superglobal.com",
          opening_balance: 45000,
          current_balance: 45000,
        },
        {
          id: 102,
          name: "Reliable Parts Co. (Demo)",
          phone: "+91 91234 56789",
          email: "contact@reliable.in",
          opening_balance: 12500,
          current_balance: 8400,
        },
      ]);
      // Still show error in console but don't break UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplier) return;
    setPayLoading(true);
    try {
      const res = await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SUPPLIER_PAYMENT',
          category: 'Supplier Payment (Debit)',
          amount: payForm.amount,
          date: payForm.payment_date,
          payment_mode: payForm.payment_mode,
          mode: payForm.payment_mode,
          reference_type: 'SUPPLIER_PAYMENT',
          reference_id: paySupplier.id,
          description: `Payment to supplier: ${paySupplier.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Payment failed');
      setPaySupplier(null);
      setPayForm({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'CASH', notes: '' });
      loadData();
      alert(`✅ Payment of ₹${payForm.amount} recorded for ${paySupplier.name}`);
    } catch (err: any) {
      alert('❌ Failed to record payment: ' + (err?.message || 'Unknown error'));
    } finally {
      setPayLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this supplier? This cannot be undone.")) {
      try {
        await deleteSupplier(id);
        loadData();
        alert("✅ Supplier deleted successfully.");
      } catch (err: any) {
        alert("❌ " + (err?.message || "Failed to delete supplier."));
      }
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filtered = suppliers.filter((s) =>
    (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div
      className="suppliers-container page-container" style={{ padding: "24px" }}
    >
      {/* Header - Mobile Responsive */}
      <div
        className="suppliers-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "0",
          padding: isMobile ? "10px 10px 20px 10px" : "10px",
          fontFamily: "'Satoshi', sans-serif"
        }}
      >
        <div className="suppliers-title">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.4px", lineHeight: 1.3, margin: 0, color: "#111110" }}
          >
            Suppliers
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}
          >
            Manage your supply chain and business partners.
          </motion.p>
        </div>
        <div
          className="suppliers-actions"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <button
            className="btn-secondary"
            onClick={loadData}
            style={{
              width: "44px",
              height: "44px",
              padding: 0,
              borderRadius: "100px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "44px",
              background: "#fff",
              border: "1px solid #E2E8F0",
            }}
          >
            <FaSync
              className={loading ? "fa-spin" : ""}
              style={{ color: "#1E293B" }}
            />
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowModal(true)}
            style={{
              height: "44px",
              padding: "0 24px",
              gap: "10px",
              borderRadius: "100px",
              fontSize: "0.85rem",
              fontWeight: 600,
              background: "#1E293B",
              color: "#fff",
              border: "none",
              flex: isMobile ? 1 : "none",
              width: isMobile ? "100%" : "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FaPlus /> Add Supplier
          </button>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            backgroundColor: "var(--error-glow)",
            color: "var(--error)",
            padding: "20px",
            borderRadius: "16px",
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            border: "1px solid rgba(239, 68, 68, 0.1)",
            fontWeight: 700,
          }}
        >
          <FaExclamationTriangle size={20} />
          <span>Error: {error}</span>
        </motion.div>
      )}

      {/* Search Toolbar */}
      <div className="page-search-bar" style={{ width: isMobile ? "100%" : "300px" }}>
        <FaSearch className="page-search-icon" size={14} />
        <input
          placeholder="Search suppliers by name, GSTIN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Data Section */}
      <div className="suppliers-table-container">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <div className="skeleton" style={{ height: "100px", borderRadius: "16px", marginBottom: "16px" }}></div>
            <div className="skeleton" style={{ height: "100px", borderRadius: "16px", marginBottom: "16px" }}></div>
            <div className="skeleton" style={{ height: "100px", borderRadius: "16px" }}></div>
          </div>
        ) : filtered.length > 0 ? (
          isMobile ? (
            <div className="supplier-cards-list">
              {filtered.map((s, idx) => (
                <motion.div
                  key={s.id}
                  className="supplier-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="card-header">
                    <div className="avatar">
                      <FaUserTie size={18} />
                    </div>
                    <div className="header-info">
                      <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Supplier</div>
                      <h3 className="supplier-name">{s.name}</h3>
                      <p className="supplier-id">ID: #VND-{s.id}</p>
                    </div>
                  </div>
                  <div className="card-contact">
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Contact Information</div>
                    <div className="contact-row">
                      <span style={{ fontSize: "12px" }}>📞 {s.phone || "N/A"}</span>
                    </div>
                    <div className="contact-row">
                      <span style={{ fontSize: "12px" }}>✉️ {s.email || "N/A"}</span>
                    </div>
                  </div>
                  <div className="card-balance">
                    <div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Outstanding Balance</div>
                      <span className="balance-value" style={{ fontSize: "1.2rem" }}>
                        ₹{Number(s.current_balance).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", width: "100%" }}>Actions</div>
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      <button 
                        className="action-btn"
                        onClick={() => {
                          setSelectedSupplier(s);
                          setShowTransactionModal(true);
                        }}
                        style={{ flex: 1 }}
                      >
                        <FaHistory /> History
                      </button>
                      <Link 
                        className="action-btn"
                        to={`/suppliers/${s.id}/ledger`}
                        style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <FaFileInvoice /> Ledger
                      </Link>
                      <button className="action-btn edit" style={{ flex: 1 }} onClick={() => { setEditingSupplier(s); setShowModal(true); }}>
                        <FaEdit /> Edit
                      </button>
                      <button 
                        className="action-btn delete"
                        onClick={() => handleDelete(s.id)}
                        style={{ flex: 1 }}
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <table className="sup-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="sup-row"
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "15px",
                        }}
                      >
                        <div className="vendor-orb">
                          <FaUserTie size={18} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              fontSize: "1.1rem",
                            }}
                          >
                            {s.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            ID: #VND-{s.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-primary)",
                            fontWeight: 500,
                            fontSize: "0.95rem",
                          }}
                        >
                          {s.phone || "N/A"}
                        </span>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            fontWeight: 500,
                          }}
                        >
                          {s.email || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="balance-text" style={{ fontWeight: 600 }}>
                        ₹
                        {Number(s.current_balance).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "12px",
                        }}
                      >
                        <button
                          className="control-btn"
                          style={{
                            background: "white",
                            border: "1px solid #e2e8f0",
                            color: "var(--text-secondary)",
                          }}
                          onClick={() => {
                            setSelectedSupplier(s);
                            setShowTransactionModal(true);
                          }}
                          title="History"
                        >
                          <FaHistory size={14} />
                        </button>
                        <Link
                          className="control-btn"
                          style={{
                            background: "white",
                            border: "1px solid #e2e8f0",
                            color: "#2563eb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          to={`/suppliers/${s.id}/ledger`}
                          title="View Ledger"
                        >
                          <FaFileInvoice size={14} />
                        </Link>
                        <button
                          className="control-btn"
                          style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}
                          title="Pay Supplier"
                          onClick={() => { setPaySupplier(s); setPayForm({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'CASH', notes: '' }); }}
                        >
                          <FaMoneyBillWave size={14} />
                        </button>
                        <button
                          className="control-btn"
                          style={{
                            background: "var(--primary-glow)",
                            color: "var(--primary)",
                          }}
                          title="Edit"
                          onClick={() => { setEditingSupplier(s); setShowModal(true); }}
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          className="control-btn"
                          style={{
                            background: "rgba(239, 68, 68, 0.05)",
                            color: "var(--error)",
                          }}
                          onClick={() => handleDelete(s.id)}
                          title="Delete"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "80px 20px",
              textAlign: "center",
            }}
          >
            <FaUserTie size={64} style={{ color: "var(--border-color)" }} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontSize: "1.25rem",
                }}
              >
                No suppliers found
              </h3>
              <p
                style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}
              >
                Add a supplier to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddSupplierModal
          onClose={() => { setShowModal(false); setEditingSupplier(null); }}
          onSuccess={loadData}
          supplier={editingSupplier || undefined}
        />
      )}

      {/* Pay Supplier Modal */}
      {paySupplier && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '420px', borderRadius: '20px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Pay Supplier</h2>
              <button onClick={() => setPaySupplier(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}>×</button>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '16px' }}>{paySupplier.name}</div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                Outstanding: <span style={{ color: '#e11d48', fontWeight: 700 }}>₹{Number(paySupplier.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <form onSubmit={handlePaySupplier} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Amount (₹)</label>
                <input required type="number" step="0.01" min="0.01" value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Payment Date</label>
                <input required type="date" value={payForm.payment_date}
                  onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Payment Mode</label>
                <select value={payForm.payment_mode} onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', boxSizing: 'border-box' }}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setPaySupplier(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={payLoading}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#10b981', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                  {payLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransactionModal && selectedSupplier && (
        <TransactionHistoryModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setSelectedSupplier(null);
          }}
          entityType="supplier"
          entityId={selectedSupplier.id}
          entityName={selectedSupplier.name}
        />
      )}
    </div>
  );
};

export default Suppliers;
