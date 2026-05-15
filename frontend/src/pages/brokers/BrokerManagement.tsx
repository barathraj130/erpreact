
import React, { useState, useEffect } from "react";
import * as brokerApi from "../../api/brokerApi";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserTie, FaPlus, FaHistory, FaHandHoldingUsd, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const BrokerManagement: React.FC = () => {
  const [brokers, setBrokers] = useState<brokerApi.BrokerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [payBroker, setPayBroker] = useState<brokerApi.BrokerSummary | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_date: new Date().toISOString().split("T")[0], payment_mode: "CASH" });
  const [payLoading, setPayLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "", phone: "", address: "", broker_type: "BOTH", commission_rate: 0
  });
  const navigate = useNavigate();

  useEffect(() => { loadBrokers(); }, []);

  const loadBrokers = async () => {
    try {
      const data = await brokerApi.fetchBrokerSummary();
      setBrokers(Array.isArray(data) ? data : []);
    } catch (err) {
      setBrokers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await brokerApi.createBroker(formData);
      setShowModal(false);
      setFormData({ name: "", phone: "", address: "", broker_type: "BOTH", commission_rate: 0 });
      loadBrokers();
    } catch { alert("Failed to create broker"); }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBroker) return;
    setPayLoading(true);
    try {
      await brokerApi.recordBrokerPayment({
        broker_id: payBroker.id,
        amount: payForm.amount,
        payment_date: payForm.payment_date,
        payment_mode: payForm.payment_mode,
      });
      setPayBroker(null);
      setPayForm({ amount: 0, payment_date: new Date().toISOString().split("T")[0], payment_mode: "CASH" });
      loadBrokers();
    } catch { alert("Payment failed"); }
    finally { setPayLoading(false); }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(v) || 0);

  return (
    <div className="page-container" style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Broker Network</h1>
          <p style={{ color: "#64748b", marginTop: "8px", fontSize: "15px" }}>Manage commission profiles and payable aging for your partners.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: "12px 24px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 12px rgba(37,99,235,0.2)" }}
        >
          <FaPlus size={14} /> Add New Broker
        </button>
      </header>

      {loading ? (
        <div style={{ padding: "100px", textAlign: "center", color: "#94a3b8" }}>Loading broker data...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
          {brokers.map((broker) => {
            const outstanding = (Number(broker.total_earned) || 0) - (Number(broker.total_paid) || 0);
            return (
              <motion.div key={broker.id} whileHover={{ y: -5 }}
                style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ padding: "12px", background: "#f1f5f9", borderRadius: "14px", color: "#64748b" }}>
                      <FaUserTie size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>{broker.name}</h3>
                      <span style={{ fontSize: "11px", fontWeight: 700, background: "#f1f5f9", padding: "3px 8px", borderRadius: "20px", color: "#64748b", textTransform: "uppercase", marginTop: "4px", display: "inline-block" }}>
                        {broker.broker_type} Broker
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Comm. Rate</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#2563eb" }}>{Number(broker.default_rate) || 0}%</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px", padding: "16px", background: "#f8fafc", borderRadius: "16px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Total Earned</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{fmt(broker.total_earned)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Outstanding</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: outstanding > 0 ? "#e11d48" : "#10b981" }}>{fmt(outstanding)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => navigate(`/finance/brokers/ledger/${broker.id}`)}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  >
                    <FaHistory size={12} /> Statement
                  </button>
                  <button
                    onClick={() => { setPayBroker(broker); setPayForm({ amount: Math.max(0, outstanding), payment_date: new Date().toISOString().split("T")[0], payment_mode: "CASH" }); }}
                    disabled={outstanding <= 0}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: outstanding > 0 ? "#0f172a" : "#e2e8f0", color: outstanding > 0 ? "#fff" : "#94a3b8", fontWeight: 600, cursor: outstanding > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  >
                    <FaHandHoldingUsd size={12} /> Pay Now
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pay Now Modal */}
      <AnimatePresence>
        {payBroker && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ background: "#fff", width: "420px", borderRadius: "24px", padding: "32px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Pay Commission</h2>
                <button onClick={() => setPayBroker(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes size={18} /></button>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
                <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "16px" }}>{payBroker.name}</div>
                <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                  Outstanding: <span style={{ color: "#e11d48", fontWeight: 700 }}>
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((Number(payBroker.total_earned) || 0) - (Number(payBroker.total_paid) || 0))}
                  </span>
                </div>
              </div>
              <form onSubmit={handlePay} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Amount (₹)</label>
                  <input
                    required type="number" step="0.01" min="0.01"
                    value={payForm.amount}
                    onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Payment Date</label>
                  <input
                    required type="date"
                    value={payForm.payment_date}
                    onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Payment Mode</label>
                  <select
                    value={payForm.payment_mode}
                    onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", boxSizing: "border-box", background: "#fff" }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button type="button" onClick={() => setPayBroker(null)}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={payLoading}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#2563eb", fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                    {payLoading ? "Processing..." : "Confirm Payment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Broker Modal */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ background: "#fff", width: "450px", borderRadius: "24px", padding: "32px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
            >
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: "0 0 24px 0" }}>New Broker Profile</h2>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Full Name</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter broker name"
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Phone</label>
                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Mobile number"
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Comm. Rate (%)</label>
                    <input type="number" step="0.01" value={formData.commission_rate} onChange={e => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Broker Type</label>
                  <select value={formData.broker_type} onChange={e => setFormData({ ...formData, broker_type: e.target.value })}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", background: "#fff", boxSizing: "border-box" }}>
                    <option value="BOTH">Purchase & Sales</option>
                    <option value="PURCHASE">Purchase Only</option>
                    <option value="SALES">Sales Only</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Address</label>
                  <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", minHeight: "80px", resize: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>Cancel</button>
                  <button type="submit"
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#2563eb", fontWeight: 600, color: "#fff", cursor: "pointer" }}>Save Broker</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BrokerManagement;
