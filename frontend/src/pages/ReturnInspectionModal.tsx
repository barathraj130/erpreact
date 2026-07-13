import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { apiFetch } from "../utils/api";

interface ReturnItem {
  product_id: number | null;
  description: string;
  qty: number;
  rate: number;
}

interface SalesReturnLike {
  id: number;
  return_number: string;
  items: ReturnItem[];
}

interface Inspection {
  id: number;
  product_id: number;
  total_qty_inspected: number;
  good_qty: number;
  mistake_qty: number;
  rejected_qty: number;
  inspector_name: string | null;
}

interface LineDraft {
  good: string;
  mistake: string;
  rejected: string;
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" };

export default function ReturnInspectionModal({ ret, onClose }: { ret: SalesReturnLike; onClose: () => void }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectorName, setInspectorName] = useState("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const gradableItems = (ret.items || []).filter((i) => i.product_id != null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ret.id]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(`/sales-return-inspections/by-return/${ret.id}`);
      const data = await res.json();
      setInspections(Array.isArray(data) ? data : []);
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }

  function gradedQtyFor(productId: number) {
    return inspections
      .filter((i) => i.product_id === productId)
      .reduce((s, i) => s + Number(i.total_qty_inspected || 0), 0);
  }

  function setDraft(productId: number, field: keyof LineDraft, value: string) {
    setDrafts((prev) => {
      const base: LineDraft = prev[productId] || { good: "", mistake: "", rejected: "" };
      return { ...prev, [productId]: { ...base, [field]: value } };
    });
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const pending = gradableItems.filter((item) => {
        const d = drafts[item.product_id as number];
        return d && (Number(d.good) || Number(d.mistake) || Number(d.rejected));
      });
      if (pending.length === 0) {
        setError("Enter at least one Good/Mistake/Rejected quantity to submit.");
        setSaving(false);
        return;
      }
      for (const item of pending) {
        const d = drafts[item.product_id as number];
        const res = await apiFetch("/sales-return-inspections", {
          method: "POST",
          body: {
            return_id: ret.id,
            product_id: item.product_id,
            inspector_name: inspectorName || null,
            good_qty: Number(d.good) || 0,
            mistake_qty: Number(d.mistake) || 0,
            rejected_qty: Number(d.rejected) || 0,
            notes: notes || null,
          },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to save inspection");
      }
      setDrafts({});
      setNotes("");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to save inspection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-modal-overlay">
      <motion.div
        className="page-modal"
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        style={{ maxWidth: 640, width: "100%" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Inspect Return — {ret.return_number}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Split each returned line into Good (resalable) / Mistake (sold cheap) / Rejected (write-off)</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}><FaTimes /></button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : gradableItems.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
            No inventory-linked items on this return — free-text items can't be graded into stock.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            {gradableItems.map((item) => {
              const productId = item.product_id as number;
              const graded = gradedQtyFor(productId);
              const remaining = Number(item.qty) - graded;
              const draft = drafts[productId] || { good: "", mistake: "", rejected: "" };
              const fullyGraded = remaining <= 0;
              return (
                <div key={productId} style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 14, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{item.description}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Returned: <strong>{item.qty}</strong>
                      {graded > 0 && <> · Graded: <strong style={{ color: "#166534" }}>{graded}</strong></>}
                      {!fullyGraded && <> · Remaining: <strong style={{ color: "#a16207" }}>{remaining}</strong></>}
                    </div>
                  </div>
                  {fullyGraded ? (
                    <div style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>✓ Fully graded</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Good Qty</label>
                        <input type="number" min={0} placeholder="0" value={draft.good}
                          onChange={(e) => setDraft(productId, "good", e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Mistake Qty</label>
                        <input type="number" min={0} placeholder="0" value={draft.mistake}
                          onChange={(e) => setDraft(productId, "mistake", e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Rejected Qty</label>
                        <input type="number" min={0} placeholder="0" value={draft.rejected}
                          onChange={(e) => setDraft(productId, "rejected", e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div>
              <label style={labelStyle}>Inspector Name</label>
              <input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder="Who checked this?" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "none" }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} className="page-btn-round">Close</button>
          {gradableItems.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}
            >
              {saving ? "Saving…" : "Save Inspection"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
