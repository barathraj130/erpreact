import React, { useEffect, useState } from "react";
import { FaMoneyBillWave, FaFilter } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface StatementEntry {
  id: number;
  ledger_type: "CASH" | "BANK";
  date: string;
  source: string;
  amount: number;
  direction: "in" | "out";
  notes?: string;
  party_name?: string;
}

const fmt = (n: any) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const sourceLabel = (s: string) => {
  const map: Record<string, string> = {
    RECEIPT: "Receipt", Payment: "Payment", payment: "Payment", INVOICE_PAYMENT: "Invoice Payment",
    INVOICE: "Invoice", EXPENSE: "Expense", SALARY: "Salary", WAGES: "Wages", PURCHASE: "Purchase",
    LOAN_RECEIVED: "Loan Received", LOAN_DISBURSEMENT: "Loan Disbursement", LOAN_REPAYMENT: "Loan Repayment",
    GIFT_CONTRIBUTION: "Gift Contribution", CASH_TRANSFER: "Cash Transfer", SETTLEMENT: "Settlement",
    SETTLEMENT_CASH: "Settlement (Cash)", PROPRIETOR: "Proprietor", PURCHASE_RETURN: "Purchase Return",
  };
  return map[s] || s;
};

const MonthlyStatement: React.FC = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CASH" | "BANK">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/reports/finance/cash-bank-statement?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setTotalIn(data.total_in || 0);
      setTotalOut(data.total_out || 0);
    } catch {
      setEntries([]);
      setTotalIn(0);
      setTotalOut(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [startDate, endDate]);

  const visible = entries.filter(e => {
    if (typeFilter !== "ALL" && e.ledger_type !== typeFilter) return false;
    if (searchTerm && !(`${e.party_name || ""} ${e.source} ${e.notes || ""}`.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Monthly Statement</h1>
          <p>Every cash and bank movement for the period, with who it was from/to.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Total In</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>{fmt(totalIn)}</div>
        </div>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Total Out</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>{fmt(totalOut)}</div>
        </div>
        <div className="page-table-wrapper" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>Net</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: (totalIn - totalOut) >= 0 ? "#16a34a" : "#dc2626", marginTop: "4px" }}>{fmt(totalIn - totalOut)}</div>
        </div>
      </div>

      <div className="page-table-wrapper" style={{ padding: "16px 20px", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)" }}>
            <option value="ALL">All (Cash + Bank)</option>
            <option value="CASH">Cash only</option>
            <option value="BANK">Bank only</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>
            <FaFilter size={9} /> Search name / source
          </label>
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="e.g. a customer or supplier name…"
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", boxSizing: "border-box" }} />
        </div>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>
            <FaMoneyBillWave size={24} style={{ marginBottom: "8px", opacity: 0.4 }} />
            <div>No movements for this period.</div>
          </div>
        ) : (
          <table className="page-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Source</th>
                <th>Name</th>
                <th className="text-right">In (+)</th>
                <th className="text-right">Out (−)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(e => (
                <tr key={`${e.ledger_type}-${e.id}`}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td>
                    <span className={`type-badge ${e.ledger_type === "CASH" ? "type-badge-green" : "type-badge-blue"}`}>{e.ledger_type}</span>
                  </td>
                  <td>{sourceLabel(e.source)}</td>
                  <td style={{ fontWeight: 600 }}>{e.party_name || "—"}</td>
                  <td className="text-right" style={{ color: "#16a34a", fontWeight: 700 }}>{e.direction === "in" ? fmt(e.amount) : "-"}</td>
                  <td className="text-right" style={{ color: "#dc2626", fontWeight: 700 }}>{e.direction === "out" ? fmt(e.amount) : "-"}</td>
                  <td style={{ fontSize: "12px", color: "var(--text-3)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.notes}>{e.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MonthlyStatement;
