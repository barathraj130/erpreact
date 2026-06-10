
import React, { useEffect, useState } from "react";
import { FaInbox, FaCheck, FaTimes, FaExchangeAlt, FaRegClock, FaExclamationCircle } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

const StockRequestsInbox: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/branch-inventory/requests/pending");
      if (res.ok) setRequests(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: number, requestedQty: number) => {
    const qty = prompt("Transfer quantity:", String(requestedQty));
    if (!qty || isNaN(parseFloat(qty))) return;

    setProcessingId(id);
    try {
      const res = await apiFetch(`/branch-inventory/requests/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ transfer_qty: parseFloat(qty) })
      });
      if (res.ok) {
        alert("Stock transferred!");
        fetchRequests();
      } else {
        const err = await res.json();
        alert(err.error || "Approval failed");
      }
    } catch (err) {
      alert("Error processing request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (id: number) => {
    const reason = prompt("Reason for declining:");
    if (reason === null) return;

    setProcessingId(id);
    try {
      const res = await apiFetch(`/branch-inventory/requests/${id}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        alert("Request declined");
        fetchRequests();
      }
    } catch (err) {
      alert("Error declining request");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="db-page" style={{ padding: "30px", background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Stock Requests Inbox</h1>
          <p style={{ color: "#64748b", marginTop: "5px" }}>Incoming requests from branches for inventory replenishment</p>
        </div>
        <div style={{ background: "#fee2e2", color: "#ef4444", padding: "8px 16px", borderRadius: "100px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
           <FaInbox /> {requests.length} Pending
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px" }}>Loading requests...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px", background: "#fff", borderRadius: "20px", border: "2px dashed #e2e8f0" }}>
          <FaInbox size={48} color="#cbd5e1" style={{ marginBottom: "20px" }} />
          <h3 style={{ color: "#64748b" }}>No pending requests found</h3>
          <p style={{ color: "#94a3b8" }}>Branches are all stocked up!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(450px, 1fr))", gap: "25px" }}>
          <AnimatePresence>
            {requests.map(r => (
              <motion.div 
                key={r.id} 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ 
                  background: "#fff", 
                  borderRadius: "20px", 
                  overflow: "hidden", 
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                  border: r.urgency === 'Urgent' ? "2px solid #ef4444" : "1px solid #e2e8f0"
                }}
              >
                <div style={{ padding: "20px", background: r.urgency === 'Urgent' ? "#fef2f2" : "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {r.urgency === 'Urgent' && <span style={{ background: "#ef4444", color: "#fff", padding: "4px 10px", borderRadius: "100px", fontSize: "0.7rem", fontWeight: 900 }}>🔴 URGENT</span>}
                    <span style={{ fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                      <FaExchangeAlt color="#64748b" /> Request from {r.branch_name}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
                    <FaRegClock /> {new Date(r.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ padding: "24px" }}>
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", fontWeight: 700 }}>Requested Product</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>{r.product_name}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                    <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, marginBottom: "5px" }}>Requested Qty</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#4f46e5" }}>{parseFloat(r.requested_qty).toLocaleString()}</div>
                    </div>
                    <div style={{ padding: "15px", background: "#f0fdfa", borderRadius: "12px", border: "1px solid #ccfbf1" }}>
                      <div style={{ fontSize: "0.75rem", color: "#0d9488", fontWeight: 700, marginBottom: "5px" }}>Main Stock Avail</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0d9488" }}>{parseFloat(r.main_stock || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  {r.note && (
                    <div style={{ marginBottom: "30px", padding: "15px", background: "#fffbeb", borderRadius: "12px", border: "1px solid #fef3c7", fontSize: "0.9rem", color: "#92400e" }}>
                      <strong>Note:</strong> "{r.note}"
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <button 
                      onClick={() => handleDecline(r.id)} 
                      disabled={processingId === r.id}
                      style={{ padding: "15px", borderRadius: "12px", border: "2px solid #fecaca", background: "#fff", color: "#ef4444", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <FaTimes /> Decline
                    </button>
                    <button 
                      onClick={() => handleApprove(r.id, r.requested_qty)} 
                      disabled={processingId === r.id || parseFloat(r.main_stock || 0) < 1}
                      style={{ padding: "15px", borderRadius: "12px", border: "none", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.3)" }}
                    >
                      {processingId === r.id ? "Processing..." : <><FaCheck /> Approve & Transfer</>}
                    </button>
                  </div>
                  
                  {parseFloat(r.main_stock || 0) < parseFloat(r.requested_qty) && (
                    <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "8px", color: "#f97316", fontSize: "0.8rem", fontWeight: 700 }}>
                      <FaExclamationCircle /> Insufficient main stock for full request
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default StockRequestsInbox;
