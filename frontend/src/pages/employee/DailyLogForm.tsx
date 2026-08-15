import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface MyJobRow {
  job_id: number;
  title: string;
  job_status: string;
  group_id: number;
  group_name: string;
  today_log_id: number | null;
  today_reached_status: string | null;
  today_confirmed: boolean | null;
  mistake_pcs_allowed: boolean | null;
}

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

const DailyLogForm: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("erp-employee-token");

  const [jobs, setJobs] = useState<MyJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(""); // `${job_id}:${group_id}`

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [reachedStatus, setReachedStatus] = useState<"yes" | "no" | "partial" | "">("");
  const [checkInTime, setCheckInTime] = useState("10:00");
  const [checkOutTime, setCheckOutTime] = useState("18:00");
  const [notes, setNotes] = useState("");

  const [products, setProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<LineItem[]>([emptyLine(0)]);
  const [nextKey, setNextKey] = useState(1);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const authedFetch = (path: string, options: RequestInit = {}) =>
    fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });

  const fetchJobs = async () => {
    if (!token) { navigate("/employee-login"); return; }
    setLoading(true);
    try {
      const res = await authedFetch("/employee-portal/my-jobs");
      if (res.status === 401) { navigate("/employee-login"); return; }
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    authedFetch("/employee-portal/products-lite").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => {
    const [jobId, groupId] = selectedKey.split(":").map(Number);
    return jobs.find((j) => j.job_id === jobId && j.group_id === groupId) || null;
  }, [selectedKey, jobs]);

  const otPreview = useMemo(() => computeOtPreview(checkOutTime), [checkOutTime]);
  const mistakeNotAllowed = selected && selected.mistake_pcs_allowed === false;

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
    if (!selected || !reachedStatus) { setErr("Select a job and reached status"); return; }
    const needsItems = reachedStatus === "yes" || reachedStatus === "partial";
    const validLines = lines.filter((l) => l.product_name_snapshot.trim());
    if (needsItems && validLines.length === 0) { setErr("Add at least one product line"); return; }

    setSaving(true);
    try {
      const logRes = await authedFetch("/employee-portal/my-daily-logs", {
        method: "POST",
        body: JSON.stringify({ job_id: selected.job_id, group_id: selected.group_id, log_date: logDate, reached_status: reachedStatus, check_in_time: checkInTime, check_out_time: checkOutTime, notes: notes || undefined }),
      });
      const logData = await logRes.json();
      if (!logData.success) { setErr(logData.error || "Failed to save log"); setSaving(false); return; }

      if (needsItems && validLines.length > 0) {
        const itemsRes = await authedFetch(`/employee-portal/my-daily-logs/${logData.log.id}/items`, {
          method: "POST",
          body: JSON.stringify({
            items: validLines.map((l) => ({
              product_id: l.product_id ? Number(l.product_id) : null,
              product_name_snapshot: l.product_name_snapshot,
              bundle_count: Number(l.bundle_count) || 0,
              pcs_per_bundle: Number(l.pcs_per_bundle) || 0,
              fresh_pcs: Number(l.fresh_pcs) || 0,
              mistake_pcs: Number(l.mistake_pcs) || 0,
              mistake_pcs_note: l.mistake_pcs_note || undefined,
            })),
          }),
        });
        const itemsData = await itemsRes.json();
        if (!itemsData.success) { setErr(itemsData.error || "Log saved, but items failed"); setSaving(false); return; }
        if (itemsData.warning) alert(itemsData.warning);
      }

      alert("Daily log submitted. Your admin will review and confirm it.");
      navigate("/employee/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Satoshi', sans-serif" }}>
      <nav style={{ background: "white", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate("/employee/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
          <FaArrowLeft size={16} />
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Daily Job Log</h2>
      </nav>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading…</p>
        ) : jobs.length === 0 ? (
          <div style={{ background: "white", borderRadius: 16, padding: 40, textAlign: "center", color: "#94a3b8" }}>
            No jobs assigned to your group(s) yet. Contact your admin.
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}

            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Job *</label>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 14, boxSizing: "border-box" }}
            >
              <option value="">Select job…</option>
              {jobs.map((j) => (
                <option key={`${j.job_id}:${j.group_id}`} value={`${j.job_id}:${j.group_id}`} disabled={!!j.today_log_id}>
                  {j.title} — {j.group_name}{j.today_log_id ? ` (already logged today: ${j.today_reached_status})` : ""}
                </option>
              ))}
            </select>

            {selected && (
              <>
                {selected.today_log_id ? (
                  <div style={{ background: "#f0fdf4", color: "#166534", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                    Already logged today as "{selected.today_reached_status}"{selected.today_confirmed ? " — confirmed by admin" : " — awaiting admin confirmation"}.
                  </div>
                ) : (
                  <>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Date *</label>
                    <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }} />

                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Reached Site? *</label>
                    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                      {(["yes", "partial", "no"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setReachedStatus(s)}
                          style={{
                            flex: 1, padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer",
                            border: reachedStatus === s ? "2px solid #111827" : "1.5px solid #cbd5e1",
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
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Check-in</label>
                        <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Check-out</label>
                        <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    {otPreview > 0 && (
                      <div style={{ fontSize: 12.5, color: "#a16207", fontWeight: 600, marginBottom: 14 }}>OT: {otPreview}h past 6:00 PM</div>
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
                            <div key={l.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                                {!l.useFreeText ? (
                                  <select value={l.product_id} onChange={(e) => onProductSelect(l.key, e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                                    <option value="">Select product…</option>
                                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                ) : (
                                  <input value={l.product_name_snapshot} onChange={(e) => updateLine(l.key, { product_name_snapshot: e.target.value, product_id: "" })} placeholder="Product name" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }} />
                                )}
                                <button type="button" onClick={() => updateLine(l.key, { useFreeText: !l.useFreeText, product_id: "", product_name_snapshot: "" })} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                                  {l.useFreeText ? "Use catalog" : "Type custom name"}
                                </button>
                                {lines.length > 1 && (
                                  <button type="button" onClick={() => removeLine(l.key)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16 }}>×</button>
                                )}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                                <div>
                                  <label style={{ fontSize: 10 }}>Bundles</label>
                                  <input type="number" value={l.bundle_count} onChange={(e) => updateLine(l.key, { bundle_count: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10 }}>Pcs/Bundle</label>
                                  <input type="number" value={l.pcs_per_bundle} onChange={(e) => updateLine(l.key, { pcs_per_bundle: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10 }}>Total</label>
                                  <div style={{ padding: "6px 8px", fontWeight: 700 }}>{(Number(l.bundle_count) || 0) * (Number(l.pcs_per_bundle) || 0)}</div>
                                </div>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div>
                                  <label style={{ fontSize: 10 }}>Fresh Pcs</label>
                                  <input type="number" value={l.fresh_pcs} onChange={(e) => updateLine(l.key, { fresh_pcs: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, color: mistakeNotAllowed ? "#dc2626" : undefined }}>Mistake Pcs {mistakeNotAllowed ? "⚠" : ""}</label>
                                  <input type="number" value={l.mistake_pcs} onChange={(e) => updateLine(l.key, { mistake_pcs: e.target.value })} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: mistakeNotAllowed ? "1.5px solid #dc2626" : "1px solid #cbd5e1", boxSizing: "border-box" }} />
                                </div>
                              </div>
                              {Number(l.mistake_pcs) > 0 && (
                                <input value={l.mistake_pcs_note} onChange={(e) => updateLine(l.key, { mistake_pcs_note: e.target.value })} placeholder="Mistake note (optional)" style={{ width: "100%", marginTop: 8, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: 12.5 }} />
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addLine} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 600 }}>+ Add Product Line</button>
                      </>
                    )}

                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 16 }} />

                    <button
                      disabled={saving}
                      onClick={submit}
                      style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? "Saving…" : "Submit Daily Log"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyLogForm;
