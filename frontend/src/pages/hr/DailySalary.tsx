// frontend/src/pages/hr/DailySalary.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  FaCalendarDay, FaCheck, FaTimes, FaClock, FaSync,
  FaUser, FaRupeeSign, FaUniversity, FaWallet,
  FaMoneyBillWave, FaExclamationTriangle, FaCut,
} from "react-icons/fa";
import { apiFetch } from "../../utils/api";

interface DailyRow {
  employee_id: number;
  employee_name: string;
  designation?: string;
  salary_type: string;
  daily_rate: number;
  weekly_rate: number;
  salary: number;
  working_days_per_week: number;
  status: "present" | "absent" | "half_day";
  working_hours: number;
  daily_wage: number;
  payment_mode: "cash" | "bank" | "proprietor";
  already_paid?: boolean;
  is_temp?: boolean;
}

interface PayItem {
  employee_id: number;
  employee_name: string;
  gross_wage: number;
  deduction: number;
  extra_pay: number;
  net_wage: number;
  payment_mode: "cash" | "bank" | "proprietor";
  is_temp?: boolean;
}

const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const statusColor: Record<string, { bg: string; text: string; label: string }> = {
  present:  { bg: "#dcfce7", text: "#15803d", label: "Present"  },
  absent:   { bg: "#fee2e2", text: "#dc2626", label: "Absent"   },
  half_day: { bg: "#fef9c3", text: "#92400e", label: "Half Day" },
};

const DailySalary: React.FC = () => {
  const [date, setDate]       = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows]       = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<{ processed: number; total_paid: number } | null>(null);

  // Temp worker form
  const [showTempForm, setShowTempForm] = useState(false);
  const [tempName, setTempName]         = useState("");
  const [tempRate, setTempRate]         = useState<number | "">("");
  const [tempCounter, setTempCounter]   = useState(0);

  const addTempWorker = () => {
    if (!String(tempName).trim() || !tempRate) return;
    const rate = Number(tempRate);
    const id   = -(tempCounter + 1); // negative IDs for temp workers
    setRows(prev => [...prev, {
      employee_id:           id,
      employee_name:         tempName.trim(),
      designation:           "Temp Worker",
      salary_type:           "daily",
      daily_rate:            rate,
      weekly_rate:           0,
      salary:                0,
      working_days_per_week: 6,
      status:                "present",
      working_hours:         8,
      daily_wage:            rate,
      payment_mode:          "cash",
      already_paid:          false,
      is_temp:               true,
    }]);
    setTempCounter(c => c + 1);
    setTempName(""); setTempRate(""); setShowTempForm(false);
  };

  // Payment confirm modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payItems, setPayItems]         = useState<PayItem[]>([]);
  const [processing, setProcessing]     = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await apiFetch(`/hr/salary/daily/summary?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      const list = (Array.isArray(data) ? data : (data.employees || []))
        .filter((e: any) => (e.salary_type || "").toLowerCase() === "daily");
      setRows(list.map((e: any) => ({
        employee_id:           e.id || e.employee_id,
        employee_name:         e.name || e.employee_name,
        designation:           e.designation,
        salary_type:           e.salary_type || "monthly",
        daily_rate:            Number(e.daily_rate  || 0),
        weekly_rate:           Number(e.weekly_rate || 0),
        salary:                Number(e.monthly_salary || e.salary || 0),
        working_days_per_week: Number(e.working_days_per_week || 6),
        status:                (e.status === "not_marked" ? "absent" : e.status) || "absent",
        working_hours:         Number(e.working_hours || 0),
        daily_wage:            Number(e.paid_wage || e.daily_wage || 0),
        payment_mode:          (e.paid_mode || "cash") as "cash" | "bank",
        already_paid:          e.already_paid === true,
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const markAttendance = async (
    employeeId: number,
    status: "present" | "absent" | "half_day",
    hours = 8,
    isTemp = false
  ) => {
    if (isTemp) {
      // Temp workers: update local state only — no backend attendance record
      setRows(prev => prev.map(r => {
        if (r.employee_id !== employeeId) return r;
        const rate = r.daily_rate;
        const wage = status === "present" ? rate : status === "half_day" ? Math.ceil(rate / 2) : 0;
        return { ...r, status, working_hours: hours, daily_wage: wage };
      }));
      return;
    }
    setMarking(employeeId);
    try {
      const res = await apiFetch("/hr/attendance/daily", {
        method: "POST",
        body: { employee_id: employeeId, attendance_date: date, status, working_hours: hours },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      await loadSummary();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMarking(null);
    }
  };

  const toggleMode = (idx: number) => {
    setRows(prev => {
      const copy = [...prev];
      const cycle: Record<string, "cash" | "bank" | "proprietor"> = { cash: "bank", bank: "proprietor", proprietor: "cash" };
      copy[idx] = { ...copy[idx], payment_mode: cycle[copy[idx].payment_mode] ?? "cash" };
      return copy;
    });
  };

  // Open the deduction modal
  const openPayModal = () => {
    const present = rows.filter(r => (r.status === "present" || r.status === "half_day") && r.daily_wage > 0 && !r.already_paid);
    if (!present.length) { setError("No present employees to pay."); return; }
    setPayItems(present.map(r => ({
      employee_id:   r.employee_id,
      employee_name: r.employee_name,
      gross_wage:    r.daily_wage,
      deduction:     0,
      extra_pay:     0,
      net_wage:      r.daily_wage,
      payment_mode:  r.payment_mode,
      is_temp:       r.is_temp,
    })));
    setShowPayModal(true);
  };

  const updateDeduction = (idx: number, val: string) => {
    setPayItems(prev => {
      const copy = [...prev];
      const d    = Math.max(0, Number(val) || 0);
      copy[idx]  = { ...copy[idx], deduction: d, net_wage: Math.max(0, copy[idx].gross_wage - d + copy[idx].extra_pay) };
      return copy;
    });
  };

  const updateExtraPay = (idx: number, val: string) => {
    setPayItems(prev => {
      const copy = [...prev];
      const e    = Math.max(0, Number(val) || 0);
      copy[idx]  = { ...copy[idx], extra_pay: e, net_wage: Math.max(0, copy[idx].gross_wage - copy[idx].deduction + e) };
      return copy;
    });
  };

  const togglePayMode = (idx: number) => {
    setPayItems(prev => {
      const copy = [...prev];
      const cycle: Record<string, "cash" | "bank" | "proprietor"> = { cash: "bank", bank: "proprietor", proprietor: "cash" };
      copy[idx]  = { ...copy[idx], payment_mode: cycle[copy[idx].payment_mode] ?? "cash" };
      return copy;
    });
  };

  const confirmPayments = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await apiFetch("/hr/salary/daily/process", {
        method: "POST",
        body: {
          date,
          employees: payItems.map(p => ({
            employee_id:   p.employee_id,
            employee_name: p.employee_name,
            daily_wage:    p.net_wage,
            gross_wage:    p.gross_wage,
            deduction:     p.deduction,
            extra_pay:     p.extra_pay,
            payment_mode:  p.payment_mode,
            is_temp:       p.is_temp || false,
          })),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process");
      setResult({ processed: data.processed, total_paid: data.total_paid });
      setShowPayModal(false);
      // Mark rows as paid
      const paidIds = new Set(payItems.map(p => p.employee_id));
      setRows(prev => prev.map(r => paidIds.has(r.employee_id) ? { ...r, already_paid: true } : r));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const totalPresent = rows.filter(r => r.status === "present").length;
  const totalAbsent  = rows.filter(r => r.status === "absent").length;
  const totalWage    = rows.reduce((s, r) => s + (r.daily_wage || 0), 0);
  const payableRows  = rows.filter(r => (r.status === "present" || r.status === "half_day") && r.daily_wage > 0 && !r.already_paid);

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.2rem" }}>
          <FaCalendarDay />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#1e293b" }}>Daily Wage Summary</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Mark attendance · deduct if needed · pay wages</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.95rem", outline: "none" }} />
          <button onClick={loadSummary} disabled={loading}
            style={{ padding: "10px 14px", borderRadius: "10px", background: "#f59e0b", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", opacity: loading ? 0.7 : 1 }}>
            <FaSync className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Present",          val: totalPresent,   color: "#10b981", bg: "#f0fdf4" },
          { label: "Absent",           val: totalAbsent,    color: "#ef4444", bg: "#fef2f2" },
          { label: "Total Wage Today", val: fmt(totalWage), color: "#f59e0b", bg: "#fffbeb" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: "12px", border: `1px solid ${c.color}22`, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>{c.label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "14px 18px", marginBottom: "16px", color: "#dc2626", display: "flex", alignItems: "center", gap: "10px" }}>
          <FaExclamationTriangle /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><FaTimes /></button>
        </div>
      )}

      {/* Success */}
      {result && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", color: "#15803d" }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>✅ Wages Paid Successfully!</div>
          <div style={{ marginTop: "6px", fontSize: "0.9rem" }}>{result.processed} employees paid · Total: <strong>{fmt(result.total_paid)}</strong></div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: "#f59e0b" }}>
            <FaSync style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: "12px", fontWeight: 600, color: "#64748b" }}>Loading…</div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
            <FaUser style={{ fontSize: "2.5rem", marginBottom: "12px" }} />
            <div style={{ fontWeight: 600 }}>No employees found.</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Employee","Type","Status","Hours","Daily Wage","Pay Mode","Mark Present","Mark Half","Mark Absent"].map(h => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const sc = statusColor[row.status] || statusColor.absent;
                    const isMarking = marking === row.employee_id;
                    const isPaid = row.already_paid;
                    return (
                      <tr key={row.employee_id} style={{ borderBottom: "1px solid #f8fafc", background: isPaid ? "#f0fdf4" : undefined }}>
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 700, color: "#1e293b" }}>{row.employee_name}</span>
                            {row.is_temp && (
                              <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: "20px", border: "1px solid #fde68a", whiteSpace: "nowrap" }}>TEMP</span>
                            )}
                          </div>
                          {row.designation && !row.is_temp && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{row.designation}</div>}
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{ background: row.salary_type === "daily" ? "#fef3c7" : "#ede9fe", color: row.salary_type === "daily" ? "#92400e" : "#6d28d9", padding: "3px 10px", borderRadius: "20px", fontSize: "0.73rem", fontWeight: 700, textTransform: "capitalize" }}>
                            {row.salary_type}
                          </span>
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          {isPaid ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#dcfce7", color: "#15803d", padding: "4px 12px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800 }}>
                              <FaCheck size={10} /> Paid
                            </span>
                          ) : (
                            <span style={{ background: sc.bg, color: sc.text, padding: "4px 12px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 700 }}>{sc.label}</span>
                          )}
                        </td>
                        <td style={{ padding: "13px 14px", color: "#374151" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <FaClock style={{ color: "#94a3b8", fontSize: "0.78rem" }} />{row.working_hours || 0}h
                          </div>
                        </td>
                        <td style={{ padding: "13px 14px", fontWeight: 800, color: row.daily_wage > 0 ? (isPaid ? "#15803d" : "#10b981") : "#94a3b8", fontSize: "1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <FaRupeeSign style={{ fontSize: "0.78rem" }} />{fmt(row.daily_wage).replace("₹", "")}
                          </div>
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          {isPaid ? (
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: row.payment_mode === "bank" ? "#2563eb" : row.payment_mode === "proprietor" ? "#7c3aed" : "#15803d", background: row.payment_mode === "bank" ? "#eff6ff" : row.payment_mode === "proprietor" ? "#f5f3ff" : "#f0fdf4", padding: "4px 10px", borderRadius: "8px" }}>
                              {row.payment_mode === "bank" ? <><FaUniversity style={{ marginRight: 4 }} />Bank</> : row.payment_mode === "proprietor" ? <>👤 Proprietor</> : <><FaWallet style={{ marginRight: 4 }} />Cash</>}
                            </span>
                          ) : (row.status === "present" || row.status === "half_day") && row.daily_wage > 0 ? (
                            <button onClick={() => toggleMode(idx)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem", background: row.payment_mode === "bank" ? "#eff6ff" : row.payment_mode === "proprietor" ? "#f5f3ff" : "#f0fdf4", color: row.payment_mode === "bank" ? "#2563eb" : row.payment_mode === "proprietor" ? "#7c3aed" : "#15803d" }}>
                              {row.payment_mode === "bank" ? <FaUniversity /> : row.payment_mode === "proprietor" ? <>👤</> : <FaWallet />}
                              {row.payment_mode === "bank" ? "Bank" : row.payment_mode === "proprietor" ? "Proprietor" : "Cash"}
                            </button>
                          ) : <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>—</span>}
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          {isPaid ? <span style={{ color: "#86efac", fontSize: "0.8rem" }}>✓</span> : (
                            <button onClick={() => markAttendance(row.employee_id, "present", 8, row.is_temp)} disabled={isMarking}
                              style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 11px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem", background: row.status === "present" ? "#10b981" : "#f0fdf4", color: row.status === "present" ? "#fff" : "#15803d", opacity: isMarking ? 0.6 : 1 }}>
                              <FaCheck /> Present
                            </button>
                          )}
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          {isPaid ? <span style={{ color: "#86efac", fontSize: "0.8rem" }}>✓</span> : (
                            <button onClick={() => markAttendance(row.employee_id, "half_day", 4, row.is_temp)} disabled={isMarking}
                              style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 11px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem", background: row.status === "half_day" ? "#f59e0b" : "#fffbeb", color: row.status === "half_day" ? "#fff" : "#92400e", opacity: isMarking ? 0.6 : 1 }}>
                              ½ Half
                            </button>
                          )}
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          {isPaid ? <span style={{ color: "#86efac", fontSize: "0.8rem" }}>✓</span> : (
                            <button onClick={() => markAttendance(row.employee_id, "absent", 0, row.is_temp)} disabled={isMarking}
                              style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 11px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem", background: row.status === "absent" ? "#ef4444" : "#fef2f2", color: row.status === "absent" ? "#fff" : "#dc2626", opacity: isMarking ? 0.6 : 1 }}>
                              <FaTimes /> Absent
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                    <td colSpan={4} style={{ padding: "13px 14px", fontWeight: 700, color: "#374151" }}>Total ({rows.length} employees)</td>
                    <td style={{ padding: "13px 14px", fontWeight: 800, color: "#10b981", fontSize: "1.05rem" }}>{fmt(totalWage)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Temp worker form */}
            {showTempForm ? (
              <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", background: "#fefce8", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e" }}>+ Temp Worker</span>
                <input
                  type="text" placeholder="Worker name" value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #fde68a", fontSize: "0.88rem", outline: "none", flex: "1", minWidth: "140px" }}
                  autoFocus
                />
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#92400e", fontWeight: 700 }}>₹</span>
                  <input
                    type="number" placeholder="Daily rate" value={tempRate}
                    onChange={e => setTempRate(e.target.value === "" ? "" : Number(e.target.value))}
                    onKeyDown={e => e.key === "Enter" && addTempWorker()}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #fde68a", fontSize: "0.88rem", outline: "none", width: "110px" }}
                  />
                </div>
                <button onClick={addTempWorker}
                  style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
                  Add
                </button>
                <button onClick={() => { setShowTempForm(false); setTempName(""); setTempRate(""); }}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #fde68a", background: "#fff", color: "#92400e", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ padding: "12px 20px", borderTop: "1px dashed #fde68a" }}>
                <button onClick={() => setShowTempForm(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "8px", border: "1.5px dashed #f59e0b", background: "#fefce8", color: "#92400e", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                  + Add Temporary Worker
                </button>
              </div>
            )}

            {/* Process footer */}
            {payableRows.length > 0 && (
              <div style={{ padding: "20px 24px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ fontSize: "0.9rem", color: "#64748b" }}>
                  <strong>{payableRows.length}</strong> present · Payable: <strong style={{ color: "#10b981" }}>{fmt(payableRows.reduce((s,r) => s + r.daily_wage, 0))}</strong>
                </div>
                <button onClick={openPayModal}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 32px", borderRadius: "12px", border: "none", cursor: "pointer", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: 700, fontSize: "1rem", boxShadow: "0 4px 16px rgba(16,185,129,0.35)" }}>
                  <FaMoneyBillWave /> Pay {payableRows.length} Employee{payableRows.length > 1 ? "s" : ""}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── DEDUCTION CONFIRM MODAL ─────────────────────────────────────── */}
      {showPayModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "560px", boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "22px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <FaCut />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1e293b" }}>Confirm Payment</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Set deduction (if any) for each employee</div>
                </div>
              </div>
              <button onClick={() => setShowPayModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.2rem" }}><FaTimes /></button>
            </div>

            {/* Employee rows */}
            <div style={{ padding: "20px 28px", maxHeight: "60vh", overflowY: "auto" }}>
              {payItems.map((p, idx) => (
                <div key={p.employee_id} style={{ marginBottom: "16px", background: "#f8fafc", borderRadius: "14px", padding: "16px 18px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>{p.employee_name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Gross Wage: <strong style={{ color: "#10b981" }}>{fmt(p.gross_wage)}</strong></div>
                    </div>
                    {/* Cash / Bank / Proprietor toggle */}
                    <button onClick={() => togglePayMode(idx)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem", background: p.payment_mode === "bank" ? "#eff6ff" : p.payment_mode === "proprietor" ? "#f5f3ff" : "#f0fdf4", color: p.payment_mode === "bank" ? "#2563eb" : p.payment_mode === "proprietor" ? "#7c3aed" : "#15803d" }}>
                      {p.payment_mode === "bank" ? <FaUniversity /> : p.payment_mode === "proprietor" ? <>👤</> : <FaWallet />}
                      {p.payment_mode === "bank" ? "Bank" : p.payment_mode === "proprietor" ? "Proprietor" : "Cash"}
                    </button>
                  </div>

                  {/* Deduction + Extra Pay inputs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", alignItems: "center" }}>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "5px" }}>
                        Deduction (₹)
                      </label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.85rem" }}>₹</span>
                        <input
                          type="number"
                          min={0}
                          max={p.gross_wage}
                          value={p.deduction || ""}
                          placeholder="0"
                          onChange={e => updateDeduction(idx, e.target.value)}
                          style={{ width: "100%", padding: "10px 12px 10px 28px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "5px" }}>
                        Extra Pay (₹)
                      </label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#a78bfa", fontSize: "0.85rem" }}>₹</span>
                        <input
                          type="number"
                          min={0}
                          value={p.extra_pay || ""}
                          placeholder="0"
                          onChange={e => updateExtraPay(idx, e.target.value)}
                          style={{ width: "100%", padding: "10px 12px 10px 28px", borderRadius: "10px", border: "1.5px solid #ddd6fe", fontSize: "0.95rem", outline: "none", boxSizing: "border-box", background: "#faf5ff" }}
                        />
                      </div>
                    </div>
                    <div style={{ background: (p.deduction > 0 || p.extra_pay > 0) ? (p.extra_pay > 0 ? "#f5f3ff" : "#fef9c3") : "#f0fdf4", borderRadius: "10px", padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Net Pay</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: p.extra_pay > 0 ? "#7c3aed" : p.deduction > 0 ? "#d97706" : "#10b981" }}>{fmt(p.net_wage)}</div>
                    </div>
                  </div>
                  {(p.deduction > 0 || p.extra_pay > 0) && (
                    <div style={{ marginTop: "8px", fontSize: "0.78rem", color: p.extra_pay > 0 ? "#5b21b6" : "#92400e", background: p.extra_pay > 0 ? "#ede9fe" : "#fef3c7", borderRadius: "8px", padding: "6px 12px" }}>
                      {p.extra_pay > 0 ? "⭐" : "✂️"} {fmt(p.gross_wage)}
                      {p.deduction > 0 && <> − {fmt(p.deduction)} deduct</>}
                      {p.extra_pay > 0 && <> + {fmt(p.extra_pay)} bonus</>}
                      {" "}= <strong>{fmt(p.net_wage)}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div style={{ padding: "18px 28px", borderTop: "1px solid #f1f5f9", background: "#fafbfc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "0.88rem", color: "#64748b" }}>
                Total Net: <strong style={{ color: "#10b981", fontSize: "1rem" }}>{fmt(payItems.reduce((s, p) => s + p.net_wage, 0))}</strong>
                {payItems.some(p => p.deduction > 0) && (
                  <span style={{ marginLeft: "8px", color: "#f59e0b", fontSize: "0.8rem" }}>
                    (−{fmt(payItems.reduce((s, p) => s + p.deduction, 0))} deducted)
                  </span>
                )}
                {payItems.some(p => p.extra_pay > 0) && (
                  <span style={{ marginLeft: "8px", color: "#7c3aed", fontSize: "0.8rem" }}>
                    (+{fmt(payItems.reduce((s, p) => s + p.extra_pay, 0))} bonus)
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setShowPayModal(false)} style={{ padding: "10px 20px", borderRadius: "10px", background: "#f1f5f9", color: "#64748b", border: "none", fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={confirmPayments} disabled={processing}
                  style={{ padding: "10px 24px", borderRadius: "10px", background: processing ? "#94a3b8" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: processing ? "none" : "0 4px 14px rgba(16,185,129,0.3)" }}>
                  {processing ? <><FaSync style={{ animation: "spin 1s linear infinite" }} /> Processing…</> : <><FaCheck /> Confirm & Pay</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default DailySalary;
