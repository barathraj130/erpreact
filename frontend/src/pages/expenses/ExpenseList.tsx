import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface ExpenseEntry {
  id: number;
  reference_number: string;
  expense_date: string;
  category: string;
  category_label: string;
  category_icon: string;
  sub_category: string;
  amount: string;
  payment_mode: string;
  paid_to: string;
  contact_phone: string | null;
  description: string;
  receipt_number: string | null;
  admin_notes: string | null;
  status: string;
  recorded_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  branch_name: string | null;
  cash_ledger_ref: number | null;
  bank_ledger_ref: number | null;
  ledger_posted: boolean;
  created_at: string;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const MODE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  cash: { bg: "#fffbeb", fg: "#b45309", label: "CASH" },
  bank: { bg: "#eff6ff", fg: "#1d4ed8", label: "BANK" },
  upi: { bg: "#f5f3ff", fg: "#6d28d9", label: "UPI" },
  personal: { bg: "#f1f5f9", fg: "#475569", label: "PERSONAL" },
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, lineHeight: 1.5 }}>{children}</div>
  </div>
);

const ExpenseList: React.FC = () => {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/expense-entries?from=${from}&to=${to}`);
      const data = await res.json();
      setEntries(data.data || []);
    } catch (err) {
      console.error("Failed to fetch expenses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {
    apiFetch("/expense-entries/can-approve")
      .then((r) => r.json())
      .then((d) => setCanApprove(!!d.canApprove))
      .catch(() => setCanApprove(false));
  }, []);

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      const res = await apiFetch(`/expense-entries/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to approve expense.");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert("Failed to approve: " + (err?.message || "Unknown error"));
    } finally {
      setApprovingId(null);
    }
  };

  const stats = useMemo(() => {
    let total = 0, cash = 0, bank = 0, personal = 0;
    entries.forEach((e) => {
      const amt = parseFloat(e.amount) || 0;
      total += amt;
      if (e.payment_mode === "cash") cash += amt;
      else if (e.payment_mode === "bank" || e.payment_mode === "upi") bank += amt;
      else personal += amt;
    });
    return { total, cash, bank, personal };
  }, [entries]);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      // this month
      start.setDate(1);
    } else {
      start.setDate(end.getDate() - days);
    }
    setFrom(start.toISOString().split("T")[0]);
    setTo(end.toISOString().split("T")[0]);
  };

  return (
    <div className="page-container" style={{ padding: "24px 20px 60px", maxWidth: 1040, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>Expense List</h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0 0" }}>Every recorded expense with full audit detail</p>
        </div>
        <Link
          to="/transactions"
          style={{
            padding: "10px 18px", background: "#4f46e5", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700,
            textDecoration: "none", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 1px 2px rgba(79,70,229,0.25)",
          }}
        >
          + Record Expense
        </Link>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Expenses", value: stats.total, color: "#dc2626", border: "#fecaca" },
          { label: "Cash Out", value: stats.cash, color: "#b45309", border: "#fde68a" },
          { label: "Bank Out", value: stats.bank, color: "#1d4ed8", border: "#bfdbfe" },
          { label: "Personal (no ledger)", value: stats.personal, color: "#475569", border: "#e2e8f0" },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: `1px solid ${c.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
        </div>
        <div>
          <label style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["7D", 7], ["30D", 30], ["This Month", 0]].map(([label, days]) => (
            <button key={label} type="button" onClick={() => setQuickRange(days as number)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8", fontWeight: 600, alignSelf: "center" }}>
          {loading ? "Loading…" : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
        </div>
      </div>

      {/* List */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>No expenses recorded in this period</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>Try widening the date range, or record a new expense</div>
          </div>
        ) : (
          entries.map((e, idx) => {
            const isOpen = expandedId === e.id;
            const modeStyle = MODE_STYLE[e.payment_mode] || MODE_STYLE.personal;
            return (
              <div key={e.id} style={{ borderBottom: idx === entries.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                <div
                  onClick={() => setExpandedId(isOpen ? null : e.id)}
                  style={{
                    display: "flex", alignItems: "center", padding: "14px 18px", cursor: "pointer", gap: 14,
                    background: isOpen ? "#f8fafc" : "transparent", transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(ev) => { if (!isOpen) ev.currentTarget.style.background = "#fafbfc"; }}
                  onMouseLeave={(ev) => { if (!isOpen) ev.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "#f1f5f9", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                  }}>
                    {e.category_icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a", marginBottom: 2 }}>{e.sub_category}</div>
                    <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fmtDate(e.expense_date)} · {e.category_label} · Paid to {e.paid_to}
                    </div>
                  </div>
                  {e.status === "pending" && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                      background: "#fef3c7", color: "#b45309", whiteSpace: "nowrap",
                    }}>
                      PENDING
                    </span>
                  )}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                    background: modeStyle.bg, color: modeStyle.fg, whiteSpace: "nowrap",
                  }}>
                    {modeStyle.label}
                  </span>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "#dc2626", minWidth: 92, textAlign: "right" }}>
                    {fmt(parseFloat(e.amount))}
                  </div>
                  <span style={{ color: "#cbd5e1", fontSize: 12, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", display: "inline-block" }}>▼</span>
                </div>

                {isOpen && (
                  <div style={{ background: "#f8fafc", borderTop: "1px solid #f1f5f9", padding: "18px 18px 20px 68px" }}>
                    {e.status === "pending" && (
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                      }}>
                        <div style={{ fontSize: 12.5, color: "#92400e", fontWeight: 600 }}>
                          Awaiting approval — not yet posted to the {e.payment_mode.toUpperCase()} ledger.
                        </div>
                        {canApprove && (
                          <button
                            type="button"
                            disabled={approvingId === e.id}
                            onClick={(ev) => { ev.stopPropagation(); handleApprove(e.id); }}
                            style={{
                              padding: "6px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff",
                              fontSize: 12, fontWeight: 700, cursor: approvingId === e.id ? "not-allowed" : "pointer",
                              opacity: approvingId === e.id ? 0.6 : 1, whiteSpace: "nowrap",
                            }}
                          >
                            {approvingId === e.id ? "Approving…" : "✓ Approve"}
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px 20px", marginBottom: 14 }}>
                      <DetailRow label="Reference">{e.reference_number}</DetailRow>
                      {e.contact_phone && <DetailRow label="Contact">{e.contact_phone}</DetailRow>}
                      {e.receipt_number && <DetailRow label="Receipt No">{e.receipt_number}</DetailRow>}
                      <DetailRow label="Recorded By">{e.recorded_by_name || "Unknown"} · {fmtDateTime(e.created_at)}</DetailRow>
                      {e.branch_name && <DetailRow label="Branch">{e.branch_name}</DetailRow>}
                      <DetailRow label="Status">
                        <span style={{ color: e.status === "pending" ? "#b45309" : "#16a34a", fontWeight: 700 }}>{e.status?.toUpperCase()}</span>
                      </DetailRow>
                      <DetailRow label="Approved By">
                        {e.approved_by_name
                          ? <>{e.approved_by_name}{e.approved_at ? ` · ${fmtDateTime(e.approved_at)}` : ""}</>
                          : <span style={{ color: "#94a3b8" }}>Not yet approved</span>}
                      </DetailRow>
                      <DetailRow label="Ledger Posted">
                        <span style={{ color: e.ledger_posted ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>
                          {e.ledger_posted
                            ? `Yes — ${e.payment_mode.toUpperCase()} ledger`
                            : e.payment_mode === "personal" ? "No — personal expense" : "No — pending approval"}
                        </span>
                      </DetailRow>
                    </div>
                    <DetailRow label="Description">{e.description}</DetailRow>
                    {e.admin_notes && (
                      <div style={{ marginTop: 14 }}>
                        <DetailRow label="Admin Notes">{e.admin_notes}</DetailRow>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ExpenseList;
