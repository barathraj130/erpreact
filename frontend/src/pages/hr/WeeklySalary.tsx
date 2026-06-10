// frontend/src/pages/hr/WeeklySalary.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  FaCalendarWeek,
  FaCheck,
  FaMoneyBillWave,
  FaSync,
  FaHistory,
  FaUsers,
  FaToggleOn,
  FaToggleOff,
  FaUniversity,
  FaWallet,
  FaExclamationTriangle,
} from "react-icons/fa";
import { apiFetch } from "../../utils/api";

interface WeeklyEmployee {
  employee_id: number;
  employee_name: string;
  salary_type: string;
  weekly_rate: number;
  daily_rate: number;
  salary: number;
  working_days_per_week: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  gross_salary: number;
  advance_balance: number;
  deduct_advance: boolean;
  net_salary: number;
  payment_mode: "cash" | "bank" | "proprietor";
}

interface HistoryRow {
  id: number;
  employee_name: string;
  week_start: string;
  week_end: string;
  present_days: number;
  gross_salary: number;
  advance_deducted: number;
  net_salary: number;
  payment_mode: string;
  status: string;
  paid_at: string;
}

const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

// Get the most recent Saturday
function lastSaturday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun,6=Sat
  const diff = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0];
}

const WeeklySalary: React.FC = () => {
  const [weekEnd, setWeekEnd] = useState(lastSaturday());
  const [employees, setEmployees] = useState<WeeklyEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<"calculate" | "history">("calculate");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [result, setResult] = useState<{ processed: number; total_paid: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCalculation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch("/hr/salary/weekly/calculate", {
        method: "POST",
        body: { week_end: weekEnd },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate");
      // Attach UI state
      const rows: WeeklyEmployee[] = (data.employees || []).map((e: any) => ({
        ...e,
        deduct_advance: true,
        payment_mode: "cash" as const,
      }));
      setEmployees(rows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [weekEnd]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await apiFetch("/hr/salary/weekly/history");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "calculate") loadCalculation();
    else loadHistory();
  }, [tab, loadCalculation, loadHistory]);

  const toggleDeduct = (idx: number) => {
    setEmployees(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        deduct_advance: !copy[idx].deduct_advance,
        net_salary: !copy[idx].deduct_advance
          ? Math.max(0, copy[idx].gross_salary - copy[idx].advance_balance)
          : copy[idx].gross_salary,
      };
      return copy;
    });
  };

  const toggleMode = (idx: number) => {
    setEmployees(prev => {
      const copy = [...prev];
      const cycle: Record<string, "cash" | "bank" | "proprietor"> = { cash: "bank", bank: "proprietor", proprietor: "cash" };
      copy[idx] = { ...copy[idx], payment_mode: cycle[copy[idx].payment_mode] ?? "cash" };
      return copy;
    });
  };

  const processAll = async () => {
    if (!employees.length) return;
    setProcessing(true);
    setError(null);
    try {
      const payload = {
        week_end: weekEnd,
        employees: employees.map(e => ({
          employee_id: e.employee_id,
          deduct_advance: e.deduct_advance,
          payment_mode: e.payment_mode,
        })),
      };
      const res = await apiFetch("/hr/salary/weekly/process", {
        method: "POST",
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process");
      setResult({ processed: data.processed, total_paid: data.total_paid });
      setEmployees([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const totalGross = employees.reduce((s, e) => s + e.gross_salary, 0);
  const totalNet = employees.reduce((s, e) => s + e.net_salary, 0);
  const totalAdv = employees.reduce((s, e) => s + (e.deduct_advance ? Math.min(e.advance_balance, e.gross_salary) : 0), 0);

  // Compute week start from week end
  const weekStart = weekEnd
    ? (() => { const d = new Date(weekEnd); d.setDate(d.getDate() - 5); return d.toISOString().split("T")[0]; })()
    : "";

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.2rem" }}>
            <FaCalendarWeek />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#1e293b" }}>Weekly Salary</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Saturday payout — Mon to Sat</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", borderRadius: "10px", padding: "4px" }}>
          {(["calculate", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#6366f1" : "#64748b",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}>
              {t === "calculate" ? <><FaUsers style={{ marginRight: "6px" }} />Process</> : <><FaHistory style={{ marginRight: "6px" }} />History</>}
            </button>
          ))}
        </div>
      </div>

      {tab === "calculate" && (
        <>
          {/* Week selector */}
          <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>Saturday (Week End)</label>
              <input
                type="date"
                value={weekEnd}
                onChange={e => setWeekEnd(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.95rem", outline: "none" }}
              />
            </div>
            {weekStart && (
              <div style={{ background: "#f0f9ff", borderRadius: "10px", padding: "10px 16px", border: "1px solid #bae6fd" }}>
                <span style={{ fontSize: "0.8rem", color: "#0369a1", fontWeight: 600 }}>
                  Week: {fmtDate(weekStart)} → {fmtDate(weekEnd)}
                </span>
              </div>
            )}
            <button
              onClick={loadCalculation}
              disabled={loading}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "10px", background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.7 : 1 }}
            >
              <FaSync className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "14px 18px", marginBottom: "16px", color: "#dc2626", display: "flex", alignItems: "center", gap: "10px" }}>
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {/* Success */}
          {result && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", color: "#15803d" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>✅ Salary Processed!</div>
              <div style={{ marginTop: "6px" }}>{result.processed} employees paid — Total: {fmt(result.total_paid)}</div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "48px", color: "#6366f1" }}>
              <FaSync style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }} />
              <div style={{ marginTop: "12px", fontWeight: 600 }}>Calculating wages…</div>
            </div>
          )}

          {!loading && employees.length === 0 && !result && (
            <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
              <FaUsers style={{ fontSize: "2.5rem", marginBottom: "12px" }} />
              <div style={{ fontWeight: 600 }}>No weekly/daily employees found for this period.</div>
            </div>
          )}

          {!loading && employees.length > 0 && (
            <>
              {/* Summary strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
                {[
                  { label: "Gross Total", val: fmt(totalGross), color: "#6366f1" },
                  { label: "Advance Deduction", val: fmt(totalAdv), color: "#f59e0b" },
                  { label: "Net Payout", val: fmt(totalNet), color: "#10b981" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>{s.label}</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Employee table */}
              <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Employee", "Type", "Days", "Gross", "Advance Bal", "Deduct?", "Net", "Mode"].map(h => (
                          <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, idx) => (
                        <tr key={emp.employee_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "#1e293b" }}>{emp.employee_name}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ background: emp.salary_type === "daily" ? "#fef3c7" : "#ede9fe", color: emp.salary_type === "daily" ? "#92400e" : "#6d28d9", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>
                              {emp.salary_type}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#374151" }}>
                            <span style={{ fontWeight: 700 }}>{emp.present_days}</span>
                            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}> / {emp.working_days_per_week || 6}</span>
                          </td>
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "#1e293b" }}>{fmt(emp.gross_salary)}</td>
                          <td style={{ padding: "14px 16px", color: emp.advance_balance > 0 ? "#f59e0b" : "#94a3b8", fontWeight: 600 }}>
                            {fmt(emp.advance_balance)}
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            {emp.advance_balance > 0 ? (
                              <button
                                onClick={() => toggleDeduct(idx)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: emp.deduct_advance ? "#10b981" : "#cbd5e1", padding: 0, display: "flex", alignItems: "center" }}
                                title={emp.deduct_advance ? "Click to keep advance" : "Click to deduct advance"}
                              >
                                {emp.deduct_advance ? <FaToggleOn /> : <FaToggleOff />}
                              </button>
                            ) : (
                              <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 16px", fontWeight: 800, color: "#10b981", fontSize: "1rem" }}>{fmt(emp.net_salary)}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <button
                              onClick={() => toggleMode(idx)}
                              style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
                                background: emp.payment_mode === "bank" ? "#eff6ff" : emp.payment_mode === "proprietor" ? "#f5f3ff" : "#f0fdf4",
                                color: emp.payment_mode === "bank" ? "#2563eb" : emp.payment_mode === "proprietor" ? "#7c3aed" : "#15803d",
                              }}
                            >
                              {emp.payment_mode === "bank" ? <FaUniversity /> : emp.payment_mode === "proprietor" ? <>👤</> : <FaWallet />}
                              {emp.payment_mode === "bank" ? "Bank" : emp.payment_mode === "proprietor" ? "Proprietor" : "Cash"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Process All footer */}
                <div style={{ padding: "20px 24px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc" }}>
                  <div style={{ fontSize: "0.9rem", color: "#64748b" }}>
                    <strong>{employees.length}</strong> employees · Net payout: <strong style={{ color: "#10b981" }}>{fmt(totalNet)}</strong>
                  </div>
                  <button
                    onClick={processAll}
                    disabled={processing}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "12px 28px", borderRadius: "12px", border: "none", cursor: "pointer",
                      background: processing ? "#94a3b8" : "linear-gradient(135deg,#10b981,#059669)",
                      color: "#fff", fontWeight: 700, fontSize: "1rem",
                      boxShadow: processing ? "none" : "0 4px 14px rgba(16,185,129,0.35)",
                    }}
                  >
                    {processing ? <FaSync style={{ animation: "spin 1s linear infinite" }} /> : <FaCheck />}
                    {processing ? "Processing…" : "Process All Salaries"}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === "history" && (
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {histLoading ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#6366f1" }}>
              <FaSync style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }} />
              <div style={{ marginTop: "12px", fontWeight: 600 }}>Loading…</div>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
              <FaHistory style={{ fontSize: "2.5rem", marginBottom: "12px" }} />
              <div style={{ fontWeight: 600 }}>No weekly salary history yet.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Employee", "Week", "Days", "Gross", "Advance Deducted", "Net Paid", "Mode", "Status", "Paid On"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "13px 16px", fontWeight: 700, color: "#1e293b" }}>{row.employee_name}</td>
                      <td style={{ padding: "13px 16px", fontSize: "0.82rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {fmtDate(row.week_start)} – {fmtDate(row.week_end)}
                      </td>
                      <td style={{ padding: "13px 16px", color: "#374151", fontWeight: 600 }}>{row.present_days}</td>
                      <td style={{ padding: "13px 16px", fontWeight: 700 }}>{fmt(row.gross_salary)}</td>
                      <td style={{ padding: "13px 16px", color: row.advance_deducted > 0 ? "#f59e0b" : "#94a3b8", fontWeight: 600 }}>{fmt(row.advance_deducted)}</td>
                      <td style={{ padding: "13px 16px", fontWeight: 800, color: "#10b981" }}>{fmt(row.net_salary)}</td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: row.payment_mode === "bank" ? "#2563eb" : "#15803d", background: row.payment_mode === "bank" ? "#eff6ff" : "#f0fdf4", padding: "3px 10px", borderRadius: "20px", textTransform: "capitalize" }}>
                          {row.payment_mode}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700 }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: "0.82rem", color: "#64748b" }}>{fmtDate(row.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default WeeklySalary;
