import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import "../PageShared.css";

interface BackdatedTx {
  id: number;
  transaction_type: string;
  transaction_date: string;
  amount: number;
  description: string;
  party_name?: string;
  account_type: string;
  backdated_by_name?: string;
  backdated_at: string;
  backdated_reason: string;
  is_reversed: boolean;
  branch_name?: string;
}

const TYPE_BADGES: Record<string, { label: string; bg: string; fg: string }> = {
  cash_in:          { label: "CASH IN",      bg: "#dcfce7", fg: "#15803d" },
  cash_out:         { label: "CASH OUT",     bg: "#fee2e2", fg: "#b91c1c" },
  bank_in:          { label: "BANK IN",      bg: "#dbeafe", fg: "#1d4ed8" },
  bank_out:         { label: "BANK OUT",     bg: "#ffedd5", fg: "#c2410c" },
  sale:             { label: "SALE",         bg: "#dcfce7", fg: "#15803d" },
  purchase:         { label: "PURCHASE",     bg: "#ffedd5", fg: "#c2410c" },
  expense:          { label: "EXPENSE",      bg: "#fee2e2", fg: "#b91c1c" },
  payment_received: { label: "PAYMENT RCV",  bg: "#dcfce7", fg: "#15803d" },
  payment_made:     { label: "PAYMENT MADE", bg: "#fee2e2", fg: "#b91c1c" },
  opening_balance:  { label: "OPENING BAL",  bg: "#ede9fe", fg: "#6d28d9" },
  adjustment:       { label: "ADJUSTMENT",   bg: "#f1f5f9", fg: "#475569" },
  other:            { label: "OTHER",        bg: "#f1f5f9", fg: "#475569" },
};

const CREDIT_TYPES = ["cash_in", "bank_in", "sale", "payment_received", "opening_balance"];

const fmt = (n: any) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};
const today = () => new Date().toISOString().split("T")[0];

const BackdatedTransactions: React.FC = () => {
  const { user } = useAuthUser();
  const navigate = useNavigate();

  const [rows, setRows] = useState<BackdatedTx[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reverseTx, setReverseTx] = useState<BackdatedTx | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseSaving, setReverseSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/backdated/list?from=${from}&to=${to}`);
      const data = await res.json();
      setRows(data.transactions || []);
      setSummary(data.summary || {});
    } catch {
      setRows([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const openDetail = async (id: number) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/backdated/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail({ error: "Failed to load" });
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReverse = async () => {
    if (!reverseTx || reverseReason.trim().length < 5) return;
    setReverseSaving(true);
    try {
      const res = await apiFetch(`/backdated/reverse/${reverseTx.id}`, {
        method: "POST",
        body: { reversal_reason: reverseReason.trim() },
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || "Failed to reverse"); return; }
      setReverseTx(null);
      setReverseReason("");
      fetchData();
    } catch {
      alert("Failed to reverse entry");
    } finally {
      setReverseSaving(false);
    }
  };

  if (!user || !["admin", "superadmin"].includes((user.role || "").toLowerCase())) {
    return (
      <div className="page-container">
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>
          This page is restricted to admin.
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Backdated Transactions</h1>
          <p>Historical entries that appear in past reports without affecting current balance</p>
        </div>
        <button className="page-btn-round page-btn-round-primary" onClick={() => navigate("/accounts/backdated/new")}>
          + New Backdated Entry
        </button>
      </div>

      <div style={{ padding: "14px 18px", background: "rgba(245,158,11,0.08)", border: "2px solid rgba(245,158,11,0.25)", borderLeft: "4px solid #F59E0B", marginBottom: 24, borderRadius: "10px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309", marginBottom: 4 }}>Backdated Entries — Handle with Care</div>
          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
            These transactions appear in historical reports for their recorded date. They do NOT change the current ledger balance.
            Every entry requires a reason and is permanently logged in the audit trail. Backdated entries can be reversed but never deleted.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Total Entries</div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px" }}>{summary.total_entries || 0}</div>
        </div>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Total Credits (Past)</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>{fmt(summary.total_credits)}</div>
        </div>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Total Debits (Past)</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>{fmt(summary.total_debits)}</div>
        </div>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Dates Affected</div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px" }}>{summary.dates_affected || 0}</div>
        </div>
      </div>

      <div className="page-table-wrapper" style={{ padding: "16px 20px", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)" }} />
        </div>
        <button className="page-btn-round page-btn-round-primary" onClick={fetchData}>Filter</button>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>No backdated entries for this period.</div>
        ) : (
          <table className="page-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Description</th><th>Party</th>
                <th className="text-right">Amount</th><th>Account</th><th>Entered By</th>
                <th>Entered At</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(tx => {
                const badge = TYPE_BADGES[tx.transaction_type] || TYPE_BADGES.other;
                const isCredit = CREDIT_TYPES.includes(tx.transaction_type);
                return (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(tx.transaction_date)}</td>
                    <td>
                      <span style={{ background: badge.bg, color: badge.fg, padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.description}>{tx.description}</td>
                    <td>{tx.party_name || "—"}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: isCredit ? "#16a34a" : "#dc2626" }}>{fmt(tx.amount)}</td>
                    <td><span className={`type-badge ${tx.account_type === "cash" ? "type-badge-green" : "type-badge-blue"}`}>{tx.account_type?.toUpperCase()}</span></td>
                    <td>{tx.backdated_by_name || "—"}</td>
                    <td style={{ fontSize: "12px", color: "var(--text-3)" }}>{fmtDateTime(tx.backdated_at)}</td>
                    <td>
                      {tx.is_reversed
                        ? <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "11px" }}>REVERSED</span>
                        : <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "11px" }}>ACTIVE</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => openDetail(tx.id)} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>View</button>
                        {!tx.is_reversed && (
                          <button onClick={() => setReverseTx(tx)} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Reverse</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {detailId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "22px 26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1e293b" }}>Backdated Entry Detail</div>
                <button onClick={() => { setDetailId(null); setDetail(null); }} style={{ border: "none", background: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}>✕</button>
              </div>
              {detailLoading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>Loading…</div>
              ) : detail?.error ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#dc2626" }}>{detail.error}</div>
              ) : detail?.transaction ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px", marginBottom: "16px" }}>
                    <div><strong>Date:</strong> {fmtDate(detail.transaction.transaction_date)}</div>
                    <div><strong>Type:</strong> {(TYPE_BADGES[detail.transaction.transaction_type] || TYPE_BADGES.other).label}</div>
                    <div><strong>Amount:</strong> {fmt(detail.transaction.amount)}</div>
                    <div><strong>Account:</strong> {detail.transaction.account_type?.toUpperCase()}</div>
                    <div><strong>Party:</strong> {detail.transaction.party_name || "—"}</div>
                    <div><strong>Branch:</strong> {detail.transaction.branch_name || "—"}</div>
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ fontSize: "13px" }}>Description</strong>
                    <div style={{ fontSize: "13px", color: "#374151", marginTop: "4px" }}>{detail.transaction.description}</div>
                  </div>
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 12px", marginBottom: "16px" }}>
                    <strong style={{ fontSize: "12px", color: "#92400e" }}>Why Backdated</strong>
                    <div style={{ fontSize: "13px", color: "#92400e", marginTop: "4px" }}>{detail.transaction.backdated_reason}</div>
                  </div>
                  {detail.transaction.is_reversed && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 12px", marginBottom: "16px" }}>
                      <strong style={{ fontSize: "12px", color: "#b91c1c" }}>Reversed</strong>
                      <div style={{ fontSize: "13px", color: "#b91c1c", marginTop: "4px" }}>{detail.transaction.reversal_reason}</div>
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: "13px" }}>Audit Trail</strong>
                    <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                      {(detail.audit_trail || []).map((a: any) => (
                        <div key={a.id} style={{ fontSize: "12px", color: "#475569", padding: "8px 10px", background: "#f8fafc", borderRadius: "6px" }}>
                          <strong>{a.action}</strong> by {a.done_by_name || "—"} · {fmtDateTime(a.created_at)}
                        </div>
                      ))}
                    </div>
                  </div>
                  {!detail.transaction.is_reversed && (
                    <button
                      onClick={() => { setReverseTx(detail.transaction); setDetailId(null); setDetail(null); }}
                      style={{ marginTop: "18px", width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, cursor: "pointer" }}>
                      Reverse This Entry
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Reverse modal */}
      {reverseTx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "460px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "24px 26px" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b", marginBottom: "10px" }}>Reverse Backdated Entry</div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#92400e", marginBottom: "16px" }}>
                This will remove the entry from historical reports. It cannot be undone — the entry stays in the audit trail but is permanently marked reversed.
              </div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>Reason for reversal (required)</label>
              <textarea
                value={reverseReason}
                onChange={e => setReverseReason(e.target.value)}
                rows={3}
                placeholder="Why is this entry being reversed?"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box", fontFamily: "inherit", fontSize: "13px" }}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <button onClick={() => { setReverseTx(null); setReverseReason(""); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button
                  onClick={submitReverse}
                  disabled={reverseReason.trim().length < 5 || reverseSaving}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: (reverseReason.trim().length < 5 || reverseSaving) ? 0.5 : 1 }}>
                  {reverseSaving ? "Reversing…" : "Confirm Reverse"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackdatedTransactions;
