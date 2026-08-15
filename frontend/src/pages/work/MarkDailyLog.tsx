import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface LineItem {
  key: number;
  product_id: string;
  product_name_snapshot: string;
  useFreeText: boolean;
  bundle_count: string;
  pcs_per_bundle: string;
  fresh_pcs: string;
  mistake_pcs: string;
  mistake_pcs_note: string;
}

const emptyLine = (key: number): LineItem => ({ key, product_id: "", product_name_snapshot: "", useFreeText: false, bundle_count: "", pcs_per_bundle: "", fresh_pcs: "", mistake_pcs: "", mistake_pcs_note: "" });

const computeOtPreview = (checkOut: string) => {
  if (!checkOut) return 0;
  const [h, m] = checkOut.split(":").map(Number);
  const minutes = h * 60 + (m || 0);
  const shiftEnd = 18 * 60;
  return minutes <= shiftEnd ? 0 : Number(((minutes - shiftEnd) / 60).toFixed(2));
};

const MarkDailyLog: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState<any[]>([]);
  const [jobId, setJobId] = useState(searchParams.get("job_id") || "");
  const [jobGroups, setJobGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [reachedStatus, setReachedStatus] = useState<"yes" | "no" | "partial" | "">("");
  const [checkInTime, setCheckInTime] = useState("10:00");
  const [checkOutTime, setCheckOutTime] = useState("18:00");
  const [notes, setNotes] = useState("");

  const [products, setProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<LineItem[]>([emptyLine(0)]);
  const [nextKey, setNextKey] = useState(1);

  const [supplierTerm, setSupplierTerm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiFetch("/work-accountability/jobs").then((r) => r.json()).then((d) => setJobs(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch("/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!jobId) { setJobGroups([]); setSupplierTerm(null); return; }
    apiFetch(`/work-accountability/jobs/${jobId}/groups`).then((r) => r.json()).then((d) => setJobGroups(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch(`/work-daily-logs/jobs/${jobId}/details`).then((r) => r.json()).then((d) => setSupplierTerm(d)).catch(() => setSupplierTerm(null));
  }, [jobId]);

  const otPreview = useMemo(() => computeOtPreview(checkOutTime), [checkOutTime]);
  const mistakeNotAllowed = supplierTerm && supplierTerm.supplier_id && !supplierTerm.mistake_pcs_allowed;

  const addLine = () => { setLines((p) => [...p, emptyLine(nextKey)]); setNextKey((k) => k + 1); };
  const removeLine = (key: number) => setLines((p) => p.filter((l) => l.key !== key));
  const updateLine = (key: number, patch: Partial<LineItem>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const onProductSelect = (key: number, productId: string) => {
    const product = products.find((p: any) => String(p.id) === productId);
    updateLine(key, {
      product_id: productId,
      product_name_snapshot: product?.name || "",
      pcs_per_bundle: product?.pieces_per_bundle ? String(product.pieces_per_bundle) : "",
    });
  };

  const submit = async () => {
    setErr("");
    if (!jobId || !groupId || !reachedStatus) { setErr("Job, group and reached status are required"); return; }
    const needsItems = reachedStatus === "yes" || reachedStatus === "partial";
    const validLines = lines.filter((l) => l.product_name_snapshot.trim());
    if (needsItems && validLines.length === 0) { setErr("Add at least one product line"); return; }

    setSaving(true);
    try {
      const logRes = await apiFetch("/work-accountability/daily-logs", {
        method: "POST",
        body: { job_id: Number(jobId), group_id: Number(groupId), log_date: logDate, reached_status: reachedStatus, check_in_time: checkInTime, check_out_time: checkOutTime, notes: notes || undefined },
      });
      const logData = await logRes.json();
      if (!logData.success) { setErr(logData.error || "Failed to save log"); setSaving(false); return; }

      if (needsItems && validLines.length > 0) {
        const itemsRes = await apiFetch(`/work-accountability/daily-logs/${logData.log.id}/items`, {
          method: "POST",
          body: {
            items: validLines.map((l) => ({
              product_id: l.product_id ? Number(l.product_id) : null,
              product_name_snapshot: l.product_name_snapshot,
              bundle_count: Number(l.bundle_count) || 0,
              pcs_per_bundle: Number(l.pcs_per_bundle) || 0,
              fresh_pcs: Number(l.fresh_pcs) || 0,
              mistake_pcs: Number(l.mistake_pcs) || 0,
              mistake_pcs_note: l.mistake_pcs_note || undefined,
            })),
          },
        });
        const itemsData = await itemsRes.json();
        if (!itemsData.success) { setErr(itemsData.error || "Log saved, but items failed"); setSaving(false); return; }
        if (itemsData.warning) alert(itemsData.warning);
      }

      navigate(`/work/job-detail/${jobId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Mark Daily Log</h1>
          <p>Fixed shift 10:00 AM – 6:00 PM. One entry per job, group and date.</p>
        </div>
      </div>

      <div className="page-modal" style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}

        <label>Job *</label>
        <select value={jobId} onChange={(e) => { setJobId(e.target.value); setGroupId(""); }} style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}>
          <option value="">Select job…</option>
          {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>

        <label>Group *</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={!jobId} style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, boxSizing: "border-box" }}>
          <option value="">{jobId ? "Select group…" : "Select a job first"}</option>
          {jobGroups.map((g: any) => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
        </select>

        <label>Date *</label>
        <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />

        <label style={{ display: "block", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>Reached Site? *</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {(["yes", "partial", "no"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setReachedStatus(s)}
              style={{
                flex: 1, padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer",
                border: reachedStatus === s ? "2px solid #111827" : "1.5px solid var(--border)",
                background: reachedStatus === s ? (s === "yes" ? "#dcfce7" : s === "partial" ? "#fef9c3" : "#fee2e2") : "#fff",
                color: reachedStatus === s ? (s === "yes" ? "#166534" : s === "partial" ? "#a16207" : "#991b1b") : "#64748b",
              }}
            >
              {s === "yes" ? "✓ YES" : s === "partial" ? "◐ PARTIAL" : "✕ NO"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
          <div>
            <label>Check-in</label>
            <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
          </div>
          <div>
            <label>Check-out</label>
            <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
          </div>
        </div>
        {otPreview > 0 && (
          <div style={{ fontSize: 12.5, color: "#a16207", fontWeight: 600, marginBottom: 14 }}>OT: {otPreview}h past 6:00 PM (amount not calculated — no rate configured yet)</div>
        )}

        {(reachedStatus === "yes" || reachedStatus === "partial") && (
          <>
            <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 10 }}>Product Lines</div>
            {mistakeNotAllowed && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                ⚠ This supplier's deal terms are Fresh Only — mistake pcs will be recorded but won't count toward the converted purchase.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
              {lines.map((l) => (
                <div key={l.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    {!l.useFreeText ? (
                      <select value={l.product_id} onChange={(e) => onProductSelect(l.key, e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <option value="">Select product…</option>
                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <input value={l.product_name_snapshot} onChange={(e) => updateLine(l.key, { product_name_snapshot: e.target.value, product_id: "" })} placeholder="Product name" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
                    )}
                    <button type="button" onClick={() => updateLine(l.key, { useFreeText: !l.useFreeText, product_id: "", product_name_snapshot: "" })} style={{ background: "none", border: "none", color: "#5B4BFF", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {l.useFreeText ? "Use catalog" : "Type custom name"}
                    </button>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(l.key)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 10 }}>Bundles</label>
                      <input type="number" value={l.bundle_count} onChange={(e) => updateLine(l.key, { bundle_count: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10 }}>Pcs/Bundle</label>
                      <input type="number" value={l.pcs_per_bundle} onChange={(e) => updateLine(l.key, { pcs_per_bundle: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10 }}>Total</label>
                      <div style={{ padding: "6px 8px", fontWeight: 700 }}>{(Number(l.bundle_count) || 0) * (Number(l.pcs_per_bundle) || 0)}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10 }}>Fresh Pcs</label>
                      <input type="number" value={l.fresh_pcs} onChange={(e) => updateLine(l.key, { fresh_pcs: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: mistakeNotAllowed ? "#dc2626" : undefined }}>Mistake Pcs {mistakeNotAllowed ? "⚠" : ""}</label>
                      <input type="number" value={l.mistake_pcs} onChange={(e) => updateLine(l.key, { mistake_pcs: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: mistakeNotAllowed ? "1.5px solid #dc2626" : "1px solid var(--border)", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  {Number(l.mistake_pcs) > 0 && (
                    <input value={l.mistake_pcs_note} onChange={(e) => updateLine(l.key, { mistake_pcs_note: e.target.value })} placeholder="Mistake note (optional)" style={{ width: "100%", marginTop: 8, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box", fontSize: 12.5 }} />
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="page-btn" onClick={addLine} style={{ marginBottom: 16 }}>+ Add Product Line</button>
          </>
        )}

        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 16 }} />

        <div className="page-modal-actions">
          <button className="page-modal-cancel" onClick={() => navigate(-1)}>Cancel</button>
          <button className="page-modal-save" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save Daily Log"}</button>
        </div>
      </div>
    </div>
  );
};

export default MarkDailyLog;
