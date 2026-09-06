import React, { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import "./Finance.css";
import { FaRegCheckCircle, FaUndo } from "react-icons/fa";

interface BankLedgerEntry {
  id: number;
  date: string;
  source: string;
  bank_name?: string;
  transaction_id?: string;
  amount: number;
  direction: "in" | "out";
  is_reconciled: boolean;
  reconciled_at?: string;
  party_name?: string;
  notes?: string;
}

// Bank Reconciliation checks each bank_ledger entry off against your physical
// bank statement — a different job from "Set Opening Balance" (correcting the
// running total) or "Cash Reconciliation" (a physical cash-count variance).
// There is no bank-statement import yet, so matching is manual: you tick off
// each entry as you find it on the statement.
const BankReconciliation: React.FC = () => {
  const [entries, setEntries] = useState<BankLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showOnly, setShowOnly] = useState<"all" | "unreconciled" | "reconciled">("unreconciled");

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/ledger/bank?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      console.error("Failed to fetch bank ledger for reconciliation", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const toggleReconciled = async (entry: BankLedgerEntry) => {
    setUpdatingId(entry.id);
    try {
      const res = await apiFetch(`/ledger/bank/${entry.id}/reconcile`, {
        method: "PATCH",
        body: { reconciled: !entry.is_reconciled },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update.");
        return;
      }
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_reconciled: !entry.is_reconciled } : e));
    } catch (err) {
      alert("Failed to update reconciliation status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const visible = entries.filter(e =>
    showOnly === "all" ? true : showOnly === "reconciled" ? e.is_reconciled : !e.is_reconciled
  );
  const unreconciledCount = entries.filter(e => !e.is_reconciled).length;
  const unreconciledTotal = entries
    .filter(e => !e.is_reconciled)
    .reduce((sum, e) => sum + (e.direction === "in" ? Number(e.amount) : -Number(e.amount)), 0);

  return (
    <div className="finance-container page-container">
      <header className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Bank Reconciliation</h1>
          <p className="text-body">Check each bank ledger entry off against your physical bank statement, one by one.</p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "24px", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-end", padding: "20px 24px" }}>
        <div className="form-group">
          <label>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Show</label>
          <select value={showOnly} onChange={e => setShowOnly(e.target.value as any)}>
            <option value="unreconciled">Not yet reconciled</option>
            <option value="reconciled">Already reconciled</option>
            <option value="all">All entries</option>
          </select>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Unreconciled</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: unreconciledCount > 0 ? "#b45309" : "#16a34a" }}>
            {unreconciledCount} entries · ₹{Math.abs(unreconciledTotal).toLocaleString("en-IN")} {unreconciledTotal < 0 ? "net out" : "net in"}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div className="card-header" style={{ padding: "24px 32px", marginBottom: "0" }}>
          <div className="card-icon"><FaRegCheckCircle size={14} /></div>
          Bank Ledger — {startDate} to {endDate}
        </div>
        <div className="table-container" style={{ border: "none", borderRadius: "0", boxShadow: "none", overflowX: "auto" }}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Party / Bank</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Flow</th>
                <th className="text-center">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px" }} className="text-muted">Loading…</td></tr>
              )}
              {!loading && visible.map((e) => (
                <tr key={e.id}>
                  <td className="text-body">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td className="text-body">{e.source}</td>
                  <td className="text-body">{e.party_name || e.bank_name || "-"}</td>
                  <td className="currency-cell">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                  <td className="text-center">
                    <span className={`status-badge status-${e.direction === "in" ? "success" : "error"}`}>
                      {e.direction === "in" ? "IN" : "OUT"}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`status-badge ${e.is_reconciled ? "status-success" : "status-warning"}`}>
                      {e.is_reconciled ? "RECONCILED" : "PENDING"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                      disabled={updatingId === e.id}
                      onClick={() => toggleReconciled(e)}
                    >
                      {e.is_reconciled ? <><FaUndo size={10} /> Unmark</> : "Mark Reconciled"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px" }} className="text-muted">
                    {showOnly === "unreconciled" ? "Everything in this date range is reconciled." : "No entries in this date range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BankReconciliation;
