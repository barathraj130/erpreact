// frontend/src/pages/hr/DailySalary.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  FaCalendarDay,
  FaCheck,
  FaTimes,
  FaClock,
  FaSync,
  FaUser,
  FaRupeeSign,
  FaExclamationTriangle,
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
}

const fmt = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const statusColor: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: "#dcfce7", text: "#15803d", label: "Present" },
  absent: { bg: "#fee2e2", text: "#dc2626", label: "Absent" },
  half_day: { bg: "#fef9c3", text: "#92400e", label: "Half Day" },
};

const DailySalary: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/hr/salary/daily/summary?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      // Backend returns { date, employees: [...], total_daily_wage } or plain array
      const list = Array.isArray(data) ? data : (data.employees || []);
      // Map backend column names to frontend interface
      setRows(list.map((e: any) => ({
        employee_id: e.id || e.employee_id,
        employee_name: e.name || e.employee_name,
        designation: e.designation,
        salary_type: e.salary_type || 'monthly',
        daily_rate: Number(e.daily_rate || 0),
        weekly_rate: Number(e.weekly_rate || 0),
        salary: Number(e.monthly_salary || e.salary || 0),
        working_days_per_week: Number(e.working_days_per_week || 6),
        status: (e.status === 'not_marked' ? 'absent' : e.status) || 'absent',
        working_hours: Number(e.working_hours || 0),
        daily_wage: Number(e.daily_wage || 0),
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const markAttendance = async (
    employeeId: number,
    status: "present" | "absent" | "half_day",
    hours = 8
  ) => {
    setMarking(employeeId);
    try {
      const res = await apiFetch("/hr/attendance/daily", {
        method: "POST",
        body: { employee_id: employeeId, attendance_date: date, status, working_hours: hours },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to mark");
      }
      await loadSummary();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMarking(null);
    }
  };

  const totalPresent = rows.filter(r => r.status === "present").length;
  const totalWage = rows.reduce((s, r) => s + (r.daily_wage || 0), 0);
  const totalAbsent = rows.filter(r => r.status === "absent").length;

  return (
    <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.2rem" }}>
          <FaCalendarDay />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#1e293b" }}>Daily Wage Summary</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Mark attendance and see daily earnings</p>
        </div>

        {/* Date picker */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.95rem", outline: "none" }}
          />
          <button
            onClick={loadSummary}
            disabled={loading}
            style={{ padding: "10px 16px", borderRadius: "10px", background: "#f59e0b", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}
          >
            <FaSync className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Present", val: totalPresent, color: "#10b981", bg: "#f0fdf4" },
          { label: "Absent", val: totalAbsent, color: "#ef4444", bg: "#fef2f2" },
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Employee", "Type", "Status", "Hours", "Daily Wage", "Mark Present", "Mark Half", "Mark Absent"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const sc = statusColor[row.status] || statusColor.absent;
                  const isMarking = marking === row.employee_id;
                  return (
                    <tr key={row.employee_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#1e293b" }}>{row.employee_name}</div>
                        {row.designation && <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{row.designation}</div>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: row.salary_type === "daily" ? "#fef3c7" : "#ede9fe", color: row.salary_type === "daily" ? "#92400e" : "#6d28d9", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>
                          {row.salary_type}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: sc.bg, color: sc.text, padding: "4px 12px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: 700 }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <FaClock style={{ color: "#94a3b8", fontSize: "0.8rem" }} />
                          {row.working_hours || 0}h
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: row.daily_wage > 0 ? "#10b981" : "#94a3b8" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <FaRupeeSign style={{ fontSize: "0.8rem" }} />
                          {fmt(row.daily_wage).replace("₹", "")}
                        </div>
                      </td>
                      {/* Mark buttons */}
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          onClick={() => markAttendance(row.employee_id, "present", 8)}
                          disabled={isMarking}
                          style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                            background: row.status === "present" ? "#10b981" : "#f0fdf4",
                            color: row.status === "present" ? "#fff" : "#15803d",
                            opacity: isMarking ? 0.6 : 1,
                          }}
                        >
                          <FaCheck /> Present
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          onClick={() => markAttendance(row.employee_id, "half_day", 4)}
                          disabled={isMarking}
                          style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                            background: row.status === "half_day" ? "#f59e0b" : "#fffbeb",
                            color: row.status === "half_day" ? "#fff" : "#92400e",
                            opacity: isMarking ? 0.6 : 1,
                          }}
                        >
                          ½ Half
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          onClick={() => markAttendance(row.employee_id, "absent", 0)}
                          disabled={isMarking}
                          style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                            background: row.status === "absent" ? "#ef4444" : "#fef2f2",
                            color: row.status === "absent" ? "#fff" : "#dc2626",
                            opacity: isMarking ? 0.6 : 1,
                          }}
                        >
                          <FaTimes /> Absent
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  <td colSpan={4} style={{ padding: "14px 16px", fontWeight: 700, color: "#374151" }}>
                    Total ({rows.length} employees)
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#10b981", fontSize: "1.05rem" }}>
                    {fmt(totalWage)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default DailySalary;
