import React, { useEffect, useState } from "react";
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

const ExpenseList: React.FC = () => {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const total = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="page-container" style={{ padding: "24px 16px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Expense List</h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0 0" }}>{entries.length} entries — {fmt(total)} total</p>
        </div>
        <Link
          to="/expenses/new"
          style={{ padding: "10px 16px", background: "#4f46e5", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          + Record Expense
        </Link>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>FROM</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>TO</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No expenses recorded in this period</div>
        ) : (
          entries.map((e) => {
            const isOpen = expandedId === e.id;
            return (
              <div key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <div
                  onClick={() => setExpandedId(isOpen ? null : e.id)}
                  style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 }}
                >
                  <span style={{ fontSize: 18 }}>{e.category_icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{e.sub_category}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {fmtDate(e.expense_date)} · {e.category_label} · Paid to {e.paid_to}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#dc2626" }}>{fmt(parseFloat(e.amount))}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>{e.payment_mode}</div>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div style={{ background: "#f8fafc", padding: "16px 20px 20px 48px", fontSize: 13 }}>
                    <table style={{ width: "100%" }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: "4px 0", color: "#64748b", width: 160 }}>Reference</td>
                          <td style={{ padding: "4px 0", fontWeight: 600 }}>{e.reference_number}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "4px 0", color: "#64748b" }}>Description</td>
                          <td style={{ padding: "4px 0" }}>{e.description}</td>
                        </tr>
                        {e.contact_phone && (
                          <tr>
                            <td style={{ padding: "4px 0", color: "#64748b" }}>Contact</td>
                            <td style={{ padding: "4px 0" }}>{e.contact_phone}</td>
                          </tr>
                        )}
                        {e.receipt_number && (
                          <tr>
                            <td style={{ padding: "4px 0", color: "#64748b" }}>Receipt No</td>
                            <td style={{ padding: "4px 0" }}>{e.receipt_number}</td>
                          </tr>
                        )}
                        {e.admin_notes && (
                          <tr>
                            <td style={{ padding: "4px 0", color: "#64748b" }}>Admin Notes</td>
                            <td style={{ padding: "4px 0" }}>{e.admin_notes}</td>
                          </tr>
                        )}
                        <tr>
                          <td style={{ padding: "4px 0", color: "#64748b" }}>Recorded By</td>
                          <td style={{ padding: "4px 0" }}>
                            {e.recorded_by_name || "Unknown"} at {fmtDateTime(e.created_at)}
                          </td>
                        </tr>
                        {e.branch_name && (
                          <tr>
                            <td style={{ padding: "4px 0", color: "#64748b" }}>Branch</td>
                            <td style={{ padding: "4px 0" }}>{e.branch_name}</td>
                          </tr>
                        )}
                        <tr>
                          <td style={{ padding: "4px 0", color: "#64748b" }}>Status</td>
                          <td style={{ padding: "4px 0", fontWeight: 700, color: "#16a34a" }}>{e.status?.toUpperCase()}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "4px 0", color: "#64748b" }}>Ledger Posted</td>
                          <td style={{ padding: "4px 0", fontWeight: 700, color: e.ledger_posted ? "#16a34a" : "#94a3b8" }}>
                            {e.ledger_posted ? `Yes — ${e.payment_mode.toUpperCase()} ledger` : "No — personal expense"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
