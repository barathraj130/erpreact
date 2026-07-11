import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";

interface RoundOffRequest {
  id: number;
  branch_name: string | null;
  requested_by_name: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  original_amount: string;
  requested_roundoff: string;
  requested_final_amount: string;
  reason: string;
  status: string;
}

const inr = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const RoundOffRequests: React.FC = () => {
  const [requests, setRequests] = useState<RoundOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/roundoff/pending");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approve = async (id: number) => {
    setProcessing(id);
    try {
      const res = await apiFetch(`/roundoff/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!data.success) alert(data.error || "Failed to approve");
      fetchRequests();
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (id: number) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setProcessing(id);
    try {
      const res = await apiFetch(`/roundoff/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || "Failed to reject");
      fetchRequests();
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="page-container" style={{ padding: "24px 20px 60px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>Round Off Requests</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Branch managers and billing staff request — you approve or reject. Nothing changes on the invoice until you approve.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: "#64748b",
          background: "#f8fafc", borderRadius: 14, border: "1px dashed #e2e8f0",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No pending round off requests</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((req) => (
            <div key={req.id} style={{
              background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid #e2e8f0",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{req.branch_name || "—"}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>by {req.requested_by_name || "—"}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#fef9c3", color: "#854d0e", fontWeight: 600 }}>
                    PENDING
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                  Customer: <strong>{req.customer_name || "—"}</strong>
                  {req.invoice_number && ` · Invoice: ${req.invoice_number}`}
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 13, flexWrap: "wrap" }}>
                  <span>Original: <strong>₹{inr(req.original_amount)}</strong></span>
                  <span style={{ color: "#ef4444" }}>Round Off: <strong>-₹{inr(req.requested_roundoff)}</strong></span>
                  <span style={{ color: "#16a34a" }}>Final: <strong>₹{inr(req.requested_final_amount)}</strong></span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Reason: {req.reason}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => reject(req.id)}
                  disabled={processing === req.id}
                  style={{ padding: "10px 18px", border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Reject
                </button>
                <button
                  onClick={() => approve(req.id)}
                  disabled={processing === req.id}
                  style={{ padding: "10px 18px", border: "none", borderRadius: 8, background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {processing === req.id ? "Processing…" : "Approve ✓"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoundOffRequests;
