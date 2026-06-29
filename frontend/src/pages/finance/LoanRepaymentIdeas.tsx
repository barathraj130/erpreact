import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";

interface FinancialData {
  total_loan: number;
  monthly_emi: number;
  cash_balance: number;
  bank_balance: number;
  monthly_sales: number;
  monthly_expenses: number;
  customer_outstanding: number;
  active_customers: number;
  stock_value: number;
  pending_invoices: number;
}

interface Idea {
  title: string;
  category: string;
  impact: "High" | "Medium" | "Low";
  timeframe: string;
  description: string;
  estimated_amount: string;
  first_step: string;
}

interface IdeasResponse {
  summary: string;
  urgency: "low" | "medium" | "high";
  ideas: Idea[];
}

const CATEGORY = {
  Collections:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", icon: "💰" },
  Sales:         { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", icon: "📈" },
  "Cost Cutting":{ bg: "#fef2f2", border: "#fecaca", text: "#dc2626", icon: "✂️" },
  Stock:         { bg: "#fffbeb", border: "#fde68a", text: "#d97706", icon: "📦" },
  Banking:       { bg: "#f5f3ff", border: "#ddd6fe", text: "#7c3aed", icon: "🏦" },
  Operations:    { bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e", icon: "⚙️" },
} as Record<string, { bg: string; border: string; text: string; icon: string }>;

const IMPACT = {
  High:   { bg: "#dcfce7", text: "#166534" },
  Medium: { bg: "#fef9c3", text: "#854d0e" },
  Low:    { bg: "#f1f5f9", text: "#475569" },
} as Record<string, { bg: string; text: string }>;

const URGENCY = {
  low:    { color: "#15803d", bg: "#f0fdf4", label: "Loan situation is manageable", icon: "✅" },
  medium: { color: "#d97706", bg: "#fffbeb", label: "Loan needs attention soon",    icon: "⚠️" },
  high:   { color: "#dc2626", bg: "#fef2f2", label: "Loan requires urgent action",  icon: "🚨" },
} as Record<string, { color: string; bg: string; label: string; icon: string }>;

const fmt = (n: number) =>
  `₹${parseFloat(String(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function LoanRepaymentIdeas() {
  const [loading, setLoading]           = useState(false);
  const [ideas, setIdeas]               = useState<IdeasResponse | null>(null);
  const [error, setError]               = useState("");
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  useEffect(() => { fetchSnapshot(); }, []);

  async function fetchSnapshot() {
    setSnapshotLoading(true);
    try {
      const res  = await apiFetch("/finance/loan-snapshot");
      const data = await res.json();
      setFinancialData(data);
    } catch (e) {
      console.error("Failed to fetch loan snapshot", e);
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function generateIdeas() {
    setLoading(true);
    setError("");
    setIdeas(null);
    try {
      const res  = await apiFetch("/finance/loan-ideas", { method: "POST", body: { financialData } });
      const data = await res.json();
      if (data.success) {
        setIdeas(data.ideas);
      } else {
        setError(data.error || "Failed to generate ideas. Please try again.");
      }
    } catch (e) {
      setError("Network error. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const urgCfg = URGENCY[ideas?.urgency || "low"];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>

      {/* ── Header gradient card ── */}
      <div style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        borderRadius: 16, padding: "28px 32px", marginBottom: 24, color: "#fff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.8, marginBottom: 6 }}>
              AI POWERED · CLAUDE SONNET
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Loan Repayment Ideas</h2>
            <p style={{ margin: "6px 0 0", opacity: 0.8, fontSize: 13 }}>
              Claude AI analyses your business data and suggests ways to repay faster
            </p>
          </div>
          <button
            onClick={generateIdeas}
            disabled={loading || snapshotLoading}
            style={{
              padding: "14px 28px",
              background: (loading || snapshotLoading) ? "rgba(255,255,255,0.2)" : "#fff",
              color: (loading || snapshotLoading) ? "#fff" : "#4f46e5",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: (loading || snapshotLoading) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            }}
          >
            {loading ? <><span>⏳</span> Analysing…</> : <><span>✨</span>{ideas ? "Regenerate Ideas" : "Generate Ideas"}</>}
          </button>
        </div>

        {/* Financial snapshot mini cards */}
        {financialData && !snapshotLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 20 }}>
            {[
              { label: "Loan Outstanding",          value: fmt(financialData.total_loan),           icon: "🏦" },
              { label: "Monthly EMI",               value: fmt(financialData.monthly_emi),          icon: "📅" },
              { label: "Customer Outstanding",      value: fmt(financialData.customer_outstanding), icon: "👥" },
              { label: "This Month Sales",          value: fmt(financialData.monthly_sales),        icon: "📈" },
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

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>
            Analysing your business data…
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Claude AI is reviewing your sales, expenses, stock, and loan details
          </div>
        </div>
      )}

      {/* Ideas display */}
      {ideas && !loading && (
        <div>
          {/* Summary / Urgency bar */}
          <div style={{
            padding: "14px 18px",
            background: urgCfg.bg,
            border: `1px solid ${urgCfg.color}`,
            borderRadius: 10, marginBottom: 20,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>{urgCfg.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: urgCfg.color, letterSpacing: "0.04em", marginBottom: 2 }}>
                {urgCfg.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{ideas.summary}</div>
            </div>
          </div>

          {/* Ideas grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {ideas.ideas?.map((idea, i) => {
              const cat = CATEGORY[idea.category] || CATEGORY["Operations"];
              const imp = IMPACT[idea.impact]     || IMPACT["Medium"];
              return (
                <div key={i} style={{
                  background: "#fff",
                  border: `1px solid ${cat.border}`,
                  borderTop: `3px solid ${cat.text}`,
                  borderRadius: 14, padding: 20,
                }}>
                  {/* Card header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{cat.icon}</span>
                      <div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          color: cat.text, background: cat.bg,
                          padding: "2px 8px", borderRadius: 20, display: "inline-block", marginBottom: 4,
                        }}>
                          {idea.category.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
                          {idea.title}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: imp.bg, color: imp.text, marginBottom: 4 }}>
                        {idea.impact.toUpperCase()} IMPACT
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{idea.timeframe}</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 12px" }}>
                    {idea.description}
                  </p>

                  {/* Potential impact */}
                  <div style={{ padding: "8px 12px", background: cat.bg, borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>💵</span>
                    <div>
                      <div style={{ fontSize: 10, color: cat.text, fontWeight: 600 }}>POTENTIAL IMPACT</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: cat.text }}>{idea.estimated_amount}</div>
                    </div>
                  </div>

                  {/* First step */}
                  <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8, borderLeft: `3px solid ${cat.text}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", marginBottom: 4 }}>
                      FIRST STEP TODAY
                    </div>
                    <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
                      → {idea.first_step}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Regenerate at bottom */}
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <button onClick={generateIdeas} style={{
              padding: "12px 32px", background: "#4f46e5", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              ✨ Generate Fresh Ideas
            </button>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              Each generation gives new perspective based on your current data
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!ideas && !loading && !error && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "#f8fafc", borderRadius: 16,
          border: "2px dashed #e2e8f0",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🧠</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Ready to Generate Ideas
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
            Click Generate Ideas above. Claude AI will analyse your sales, expenses, stock and outstanding data to suggest the best ways to repay your loan faster.
          </div>
          <button onClick={generateIdeas} disabled={snapshotLoading} style={{
            padding: "14px 32px", background: snapshotLoading ? "#94a3b8" : "#4f46e5", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: snapshotLoading ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <span>✨</span> {snapshotLoading ? "Loading data…" : "Generate Loan Repayment Ideas"}
          </button>
        </div>
      )}
    </div>
  );
}
