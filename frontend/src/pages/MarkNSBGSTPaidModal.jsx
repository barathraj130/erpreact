import React, { useState } from "react";
import { apiFetch } from "../utils/api";

const MODES = [
  { value: "CASH",       label: "Cash",       color: "#16a34a", bg: "#dcfce7" },
  { value: "BANK",       label: "Bank",        color: "#1d4ed8", bg: "#dbeafe" },
  { value: "UPI",        label: "UPI",         color: "#0369a1", bg: "#e0f2fe" },
  { value: "PROPRIETOR", label: "Proprietor",  color: "#7c3aed", bg: "#f5f3ff" },
];

export default function MarkNSBGSTPaidModal({ invoice, onClose, onSuccess }) {
  const [paymentMode, setPaymentMode]   = useState("CASH");
  const [paymentDate, setPaymentDate]   = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference]       = useState("");
  const [notes, setNotes]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const gstAmt = parseFloat(invoice.gst_liability_amount || invoice.tax_total || 0);

  const handleSubmit = async () => {
    if (!paymentMode) return setError("Select a payment mode");
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/invoice/nsb/${invoice.id}/mark-gst-paid`, {
        method: "POST",
        body: JSON.stringify({
          payment_mode: paymentMode,
          payment_date: paymentDate,
          payment_reference: reference,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark GST paid");
      onSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }}>
      <div style={{
        background: "var(--bg-card)", borderRadius: "16px", padding: "28px", width: "100%",
        maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--text-1)" }}>
              Mark GST as Paid
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-3)" }}>
              {invoice.invoice_number} — {invoice.customer_name || "NSB Invoice"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "20px", lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* GST liability summary */}
        <div style={{
          background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: "10px",
          padding: "12px 16px", marginBottom: "20px",
        }}>
          <div style={{ fontSize: "12px", color: "#92400e", fontWeight: 600, marginBottom: "4px" }}>GST Liability to Government</div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#78350f" }}>₹{gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          {invoice.cgst_total > 0 && (
            <div style={{ fontSize: "11px", color: "#92400e", marginTop: "4px" }}>
              CGST ₹{parseFloat(invoice.cgst_total).toFixed(2)} + SGST ₹{parseFloat(invoice.sgst_total || 0).toFixed(2)}
            </div>
          )}
          {invoice.igst_total > 0 && (
            <div style={{ fontSize: "11px", color: "#92400e", marginTop: "4px" }}>
              IGST ₹{parseFloat(invoice.igst_total).toFixed(2)}
            </div>
          )}
        </div>

        {/* Payment Mode */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-2)", marginBottom: "8px" }}>
            Payment Mode
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMode(m.value)}
                style={{
                  padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700,
                  fontSize: "13px", transition: "all 0.15s",
                  border: `2px solid ${paymentMode === m.value ? m.color : "var(--border-soft)"}`,
                  background: paymentMode === m.value ? m.bg : "var(--bg)",
                  color: paymentMode === m.value ? m.color : "var(--text-2)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {paymentMode === "PROPRIETOR" && (
            <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#7c3aed" }}>
              GST paid from proprietor personal account — recorded as Capital Introduction
            </p>
          )}
        </div>

        {/* Payment Date */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-2)", marginBottom: "6px" }}>
            Payment Date
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "13px",
              border: "1px solid var(--border-soft)", background: "var(--bg)", color: "var(--text-1)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Reference */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-2)", marginBottom: "6px" }}>
            Reference / Challan No (optional)
          </label>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="e.g. GST challan number"
            style={{
              width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "13px",
              border: "1px solid var(--border-soft)", background: "var(--bg)", color: "var(--text-1)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-2)", marginBottom: "6px" }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Filed via GST portal, return period..."
            style={{
              width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "13px",
              border: "1px solid var(--border-soft)", background: "var(--bg)", color: "var(--text-1)",
              resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid var(--border-soft)",
              background: "var(--bg)", color: "var(--text-2)", fontWeight: 700, fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2, padding: "11px", borderRadius: "10px", border: "none",
              background: loading ? "#9ca3af" : "#16a34a", color: "#fff",
              fontWeight: 800, fontSize: "13px", cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Processing..." : `Confirm — GST Paid ₹${gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          </button>
        </div>
      </div>
    </div>
  );
}
