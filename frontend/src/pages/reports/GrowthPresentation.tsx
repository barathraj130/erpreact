import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../utils/api";

type Period = "weekly" | "monthly" | "annual";

interface SummaryKpis {
  total_revenue: number;
  total_purchases: number;
  total_gross_profit: number;
  revenue_growth_pct: number | null;
  total_customers: number;
  receivables: number;
  payables: number;
}

interface GrowthMetrics {
  period: Period;
  company_name: string;
  summary_kpis: SummaryKpis;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "annual", label: "Annual" },
];

const STAGES = [
  "Analysing growth data…",
  "Writing insights…",
  "Building slides…",
  "Rendering charts…",
];

const fmt = (n: number) =>
  `₹${parseFloat(String(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function GrowthPresentation() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState("");
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSnapshot(period);
    return () => { if (stageTimer.current) clearInterval(stageTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function fetchSnapshot(p: Period) {
    setSnapshotLoading(true);
    try {
      const res = await apiFetch(`/reports/growth/metrics?period=${p}`);
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error("Failed to fetch growth snapshot", e);
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function generateDeck() {
    setGenerating(true);
    setError("");
    setLastDownload(null);
    setStageIdx(0);
    stageTimer.current = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, 4000);

    try {
      const res = await apiFetch("/reports/growth/presentation", {
        method: "POST",
        body: { period },
      });
      if (!res.ok) {
        let msg = "Failed to generate presentation. Please try again.";
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch { /* non-JSON error body */ }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `Growth_Study_${period}.pptx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setLastDownload(filename);
    } catch (e) {
      console.error(e);
      setError("Network error. Please try again.");
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
      setGenerating(false);
    }
  }

  const kpis = metrics?.summary_kpis;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Header gradient card */}
      <div style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        borderRadius: 16, padding: "28px 32px", marginBottom: 24, color: "#fff",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.8, marginBottom: 6 }}>
          AI POWERED · CLAUDE SONNET
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Growth Study Deck</h2>
        <p style={{ margin: "6px 0 18px", opacity: 0.8, fontSize: 13 }}>
          A world-class, downloadable PowerPoint — real numbers, AI-written narrative, editable charts
        </p>

        {/* Period selector */}
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 18 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              disabled={generating}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                cursor: generating ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700,
                background: period === p.key ? "#fff" : "transparent",
                color: period === p.key ? "#4f46e5" : "#fff",
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={generateDeck}
          disabled={generating || snapshotLoading}
          style={{
            padding: "14px 28px",
            background: (generating || snapshotLoading) ? "rgba(255,255,255,0.2)" : "#fff",
            color: (generating || snapshotLoading) ? "#fff" : "#4f46e5",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: (generating || snapshotLoading) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          }}
        >
          {generating ? <><span>⏳</span> Generating…</> : <><span>✨</span> Generate Presentation</>}
        </button>

        {/* Snapshot mini cards */}
        {kpis && !snapshotLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 20 }}>
            {[
              { label: "Total Revenue", value: fmt(kpis.total_revenue), icon: "📈" },
              { label: "Gross Profit", value: fmt(kpis.total_gross_profit), icon: "💰" },
              { label: "Revenue Growth", value: kpis.revenue_growth_pct != null ? `${kpis.revenue_growth_pct}%` : "N/A", icon: "📊" },
              { label: "Total Customers", value: String(kpis.total_customers), icon: "👥" },
            ].map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
        {snapshotLoading && (
          <div style={{ marginTop: 16, opacity: 0.7, fontSize: 13 }}>Loading business snapshot…</div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>
            {STAGES[stageIdx]}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            This can take up to 30 seconds — Claude is writing the narrative, then the deck is assembled server-side
          </div>
        </div>
      )}

      {/* Success state */}
      {lastDownload && !generating && (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          background: "#f0fdf4", borderRadius: 16, border: "1px solid #bbf7d0",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>
            Downloaded {lastDownload}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
            Open it in PowerPoint, Keynote, or Google Slides — every chart is fully editable.
          </div>
          <button onClick={generateDeck} style={{
            padding: "12px 32px", background: "#4f46e5", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            ✨ Generate Another
          </button>
        </div>
      )}

      {/* Empty state */}
      {!generating && !lastDownload && !error && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "#f8fafc", borderRadius: 16,
          border: "2px dashed #e2e8f0",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Ready to Generate
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24, maxWidth: 440, margin: "0 auto 24px" }}>
            Pick a cadence above and generate a full growth study deck — cover slide, executive summary,
            revenue/profit/customer trend charts, a risk & health slide, and AI-written recommendations.
          </div>
          <button onClick={generateDeck} disabled={snapshotLoading} style={{
            padding: "14px 32px", background: snapshotLoading ? "#94a3b8" : "#4f46e5", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: snapshotLoading ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <span>✨</span> {snapshotLoading ? "Loading data…" : "Generate Presentation"}
          </button>
        </div>
      )}
    </div>
  );
}
