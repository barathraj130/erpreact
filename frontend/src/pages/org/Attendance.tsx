// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { FaCheckDouble } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Employee { id: number; name: string; employee_id: string; }
interface AttendanceRow { employee_id: number; status: string; }

const STATUS_OPTIONS = ["present", "absent", "half_day", "late", "wfh", "on_leave"];
const STATUS_COLOR: Record<string, string> = {
  present: "#10B981", absent: "#EF4444", half_day: "#F59E0B", late: "#F59E0B", wfh: "#5B4BFF", on_leave: "#8B5CF6",
};

const todayStr = () => new Date().toISOString().split("T")[0];

const OrgAttendance: React.FC = () => {
  const [date, setDate] = useState(todayStr());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [bulkMarking, setBulkMarking] = useState(false);

  const fetchAll = async (d: string) => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        apiFetch("/org/employees?status=active").then((r) => r.json()),
        apiFetch(`/org/attendance?date=${d}`).then((r) => r.json()),
      ]);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      const map: Record<number, string> = {};
      (Array.isArray(attRes) ? attRes : []).forEach((a: AttendanceRow) => { map[a.employee_id] = a.status; });
      setMarks(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(date); }, [date]);

  const markStatus = async (employeeId: number, status: string) => {
    setMarks((p) => ({ ...p, [employeeId]: status }));
    await apiFetch("/org/attendance", { method: "POST", body: { employee_id: employeeId, attendance_date: date, status } });
  };

  const bulkMarkPresent = async () => {
    setBulkMarking(true);
    try {
      await apiFetch("/org/attendance/bulk-mark", { method: "POST", body: { attendance_date: date } });
      fetchAll(date);
    } finally {
      setBulkMarking(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p>Mark daily attendance for Fluxora staff.</p>
        </div>
        <div className="page-header-actions">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="page-btn" style={{ cursor: "pointer" }} />
          <button className="page-btn page-btn-primary" onClick={bulkMarkPresent} disabled={bulkMarking}>
            <FaCheckDouble /> {bulkMarking ? "Marking…" : "Mark All Present"}
          </button>
        </div>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="page-empty">No active employees yet.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Emp ID</th><th>Name</th><th>Status</th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono">{e.employee_id}</td>
                  <td className="font-bold">{e.name}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => markStatus(e.id, s)}
                          style={{
                            fontSize: 11, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600, textTransform: "capitalize",
                            border: `1px solid ${marks[e.id] === s ? STATUS_COLOR[s] : "#e2e8f0"}`,
                            background: marks[e.id] === s ? `${STATUS_COLOR[s]}18` : "#fff",
                            color: marks[e.id] === s ? STATUS_COLOR[s] : "#64748b",
                          }}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OrgAttendance;
