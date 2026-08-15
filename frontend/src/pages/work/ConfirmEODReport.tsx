import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

const ConfirmEODReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/work-accountability/daily-logs/${id}`);
      setDetail(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    setConfirming(true);
    setErr("");
    try {
      const res = await apiFetch(`/work-accountability/daily-logs/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setErr(data.error || "Failed to confirm");
      }
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <div className="page-container">Loading…</div>;
  if (!detail?.log) return <div className="page-container"><div className="page-empty">Log not found.</div></div>;

  const { log, items, members, supplier } = detail;
  const totalFresh = items.reduce((s: number, i: any) => s + Number(i.fresh_pcs || 0), 0);
  const totalMistake = items.reduce((s: number, i: any) => s + Number(i.mistake_pcs || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link to={`/work/job-detail/${log.job_id}`} style={{ fontSize: 12, color: "#5B4BFF", fontWeight: 700 }}>← Back to Job</Link>
          <h1 style={{ marginTop: 6 }}>Confirm EOD Report</h1>
          <p>{log.job_title} — {log.group_name} — {log.log_date?.slice(0, 10)}</p>
        </div>
      </div>

      {result ? (
        <div className="page-table-wrapper" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{result.conversion_status === "converted" ? "✅" : "⚠️"}</div>
          <h2 style={{ margin: "0 0 8px" }}>EOD Report Confirmed</h2>
          {result.conversion_status === "converted" ? (
            <p style={{ color: "#166534", fontWeight: 700 }}>Purchase Bill {result.purchase_bill_number} created (#{result.purchase_bill_id}).</p>
          ) : (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: 8, marginTop: 12, textAlign: "left" }}>
              Confirmation was saved, but converting to a Purchase Bill failed: {result.conversion_error}
              <br />The daily log is still confirmed — you can retry the conversion later.
            </div>
          )}
          <button className="page-btn page-btn-primary" style={{ marginTop: 20 }} onClick={() => navigate(`/work/job-detail/${log.job_id}`)}>Back to Job</button>
        </div>
      ) : (
        <>
          {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}

          <div className="page-table-wrapper" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Group Members on Duty</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {members.length === 0 ? <span style={{ color: "var(--text-3)", fontSize: 12.5 }}>No member snapshot recorded.</span> : members.map((m: any) => (
                <span key={m.id} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, background: "#f1f5f9", fontWeight: 600 }}>{m.username}</span>
              ))}
            </div>
          </div>

          <div className="page-table-wrapper" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Supplier Deal Terms</div>
            {supplier?.supplier_id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="font-bold">{supplier.supplier_name}</span>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: supplier.mistake_pcs_allowed ? "#f0fdf4" : "#fef2f2", color: supplier.mistake_pcs_allowed ? "#16a34a" : "#dc2626" }}>
                  {supplier.mistake_pcs_allowed ? "MISTAKE PCS ALLOWED" : "FRESH ONLY"}
                </span>
              </div>
            ) : (
              <div style={{ color: "#dc2626", fontSize: 12.5 }}>⚠ No supplier linked to this job — confirming will save the report, but Purchase Bill conversion will fail until a supplier is linked (Site Log tab on the Job page).</div>
            )}
          </div>

          <div className="page-table-wrapper">
            <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee" }}>Product Lines</div>
            {items.length === 0 ? <div className="page-empty">No items recorded.</div> : (
              <table className="page-table">
                <thead><tr><th>Product</th><th className="text-right">Bundles</th><th className="text-right">Pcs/Bundle</th><th className="text-right">Total</th><th className="text-right">Fresh</th><th className="text-right">Mistake</th></tr></thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="font-bold">{it.product_name_snapshot}</td>
                      <td className="text-right">{it.bundle_count}</td>
                      <td className="text-right">{it.pcs_per_bundle}</td>
                      <td className="text-right font-bold">{it.items_count}</td>
                      <td className="text-right">{it.fresh_pcs}</td>
                      <td className="text-right" style={{ color: it.mistake_pcs > 0 ? "#dc2626" : "inherit" }}>{it.mistake_pcs}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-bold">Total</td>
                    <td></td><td></td><td></td>
                    <td className="text-right font-bold">{totalFresh}</td>
                    <td className="text-right font-bold" style={{ color: totalMistake > 0 ? "#dc2626" : "inherit" }}>{totalMistake}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button
              className="page-btn page-btn-primary"
              style={{ padding: "14px 40px", fontSize: 15, fontWeight: 800, background: "#16a34a" }}
              disabled={confirming || items.length === 0}
              onClick={confirm}
            >
              {confirming ? "Confirming…" : "✓ Confirm EOD Report"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ConfirmEODReport;
