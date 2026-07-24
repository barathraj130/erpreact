import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHandshake, FaPlus, FaClock, FaMoneyCheckAlt, FaFileContract } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Settlement {
  id: number;
  settlement_number: string;
  customer_name: string;
  settlement_date: string;
  settlement_type: string;
  total_value: number;
  status: "pending" | "approved" | "rejected" | "voided";
  is_conditional: boolean;
  legal_transfer_done: boolean;
}

interface Summary {
  pending_count: number;
  pending_value: number;
  conditional_count: number;
  cheques_due_count: number;
}

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fffbeb", fg: "#b45309" },
  approved: { bg: "#f0fdf4", fg: "#16a34a" },
  rejected: { bg: "#fef2f2", fg: "#dc2626" },
  voided: { bg: "#f1f5f9", fg: "#64748b" },
};

const TYPE_LABELS: Record<string, string> = {
  goods: "Goods",
  asset: "Asset",
  cheque: "Cheque",
  mixed: "Mixed",
  cash_partial: "Cash (Partial)",
};

export default function Settlements() {
  const navigate = useNavigate();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "cheques">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      const query = filter === "pending" || filter === "approved" ? `?status=${filter}` : "";
      const [listRes, summaryRes] = await Promise.all([
        apiFetch(`/settlements${query}`),
        apiFetch("/settlements/summary"),
      ]);
      const list = await listRes.json();
      setSettlements(Array.isArray(list) ? list : []);
      setSummary(await summaryRes.json());
    } catch {
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  };

  const displayed = filter === "cheques" ? settlements.filter((s) => ["cheque", "mixed"].includes(s.settlement_type)) : settlements;

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div>
          <h1><FaHandshake style={{ marginRight: 10, opacity: 0.7 }} />Debt Settlements</h1>
          <p>Settle customer outstanding balances with goods, assets, cheques, or cash.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round page-btn-round-primary" onClick={() => navigate("/settlements/new")}>
            <FaPlus size={11} /> New Settlement
          </button>
        </div>
      </div>

      <div className="premium-stats-grid">
        <div className="stat-card card-amber">
          <FaClock className="stat-icon" />
          <div className="label">Total Pending</div>
          <div className="value">{summary?.pending_count ?? 0}</div>
          <div className="stat-sub">₹{(summary?.pending_value ?? 0).toLocaleString("en-IN")}</div>
        </div>
        <div className="stat-card card-indigo">
          <FaMoneyCheckAlt className="stat-icon" />
          <div className="label">Cheques Due This Week</div>
          <div className="value">{summary?.cheques_due_count ?? 0}</div>
          <div className="stat-sub">Pending clearance</div>
        </div>
        <div className="stat-card card-emerald">
          <FaFileContract className="stat-icon" />
          <div className="label">Conditional (Awaiting Transfer)</div>
          <div className="value">{summary?.conditional_count ?? 0}</div>
          <div className="stat-sub">Land/Property settlements</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "20px 0" }}>
        {(["all", "pending", "approved", "cheques"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "7px 16px", borderRadius: 20, border: "1px solid var(--border-soft)",
              background: filter === f ? "#4f46e5" : "var(--surface)",
              color: filter === f ? "#fff" : "var(--text-2)",
              fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize",
            }}
          >
            {f === "cheques" ? "Cheques" : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-empty">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="page-empty">
          <FaHandshake size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>No settlements found</div>
          <p style={{ margin: "4px 0 0", color: "var(--text-3)", fontSize: 12 }}>Create one from a customer's row, or the button above.</p>
        </div>
      ) : (
        <div className="page-table-wrapper">
          <table className="page-table">
            <thead>
              <tr>
                <th>Ref No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Type</th>
                <th className="text-right">Value</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((s) => {
                const style = STATUS_STYLES[s.status] || STATUS_STYLES.pending;
                return (
                  <tr key={s.id}>
                    <td className="font-mono">{s.settlement_number}</td>
                    <td className="font-bold">{s.customer_name || "—"}</td>
                    <td>{new Date(s.settlement_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>
                      {TYPE_LABELS[s.settlement_type] || s.settlement_type}
                      {s.is_conditional && (
                        <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "#fffbeb", color: "#b45309", fontWeight: 700 }}>
                          {s.legal_transfer_done ? "TRANSFERRED" : "⏳ CONDITIONAL"}
                        </span>
                      )}
                    </td>
                    <td className="text-right font-bold">₹{Number(s.total_value).toLocaleString("en-IN")}</td>
                    <td className="text-center">
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: style.bg, color: style.fg, textTransform: "uppercase" }}>
                        {s.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <button className="page-btn-round-sm" onClick={() => navigate(`/settlements/${s.id}`)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
