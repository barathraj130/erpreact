import { motion } from "framer-motion";
import React, { useCallback, useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaCheck,
  FaClock,
  FaFingerprint,
  FaSearch,
  FaSync,
  FaTimes,
  FaUserClock,
  FaBriefcase,
  FaUsers,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import "../Employees.css";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Employee {
  id: number;
  name: string;
  designation?: string;
  salary_type?: string;
}

interface AttendanceRecord {
  id?: number;
  employee_id: number;
  employee_name?: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "OD" | "LEAVE" | "HALF_DAY";
  check_in_time?: string;
  check_out_time?: string;
  work_assigned?: string;
  method?: string;
}

const Attendance: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadWorkers = async () => {
    try {
      const res = await apiFetch("/employees");
      const data = await res.json();
      setEmployees(data || []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  const fetchAttendanceForDate = useCallback(async (date: string) => {
    try {
      const res = await apiFetch(`/hr/attendance?date=${date}`);
      const data = await res.json();
      const attendanceMap: Record<string, AttendanceRecord> = {};
      (data || []).forEach((record: AttendanceRecord) => {
        attendanceMap[`${record.employee_id}_${date}`] = record;
      });
      setAttendance(attendanceMap);
    } catch (err) {}
  }, []);

  useEffect(() => {
    fetchAttendanceForDate(selectedDate);
  }, [selectedDate, fetchAttendanceForDate]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchAttendanceForDate(selectedDate), 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedDate, fetchAttendanceForDate]);

  const markAttendance = async (employeeId: number, status: string) => {
    try {
      const res = await apiFetch("/hr/attendance/manual", {
        method: "POST",
        body: {
          employee_id: employeeId,
          date: selectedDate,
          status: status,
          check_in_time: ["PRESENT", "OD", "HALF_DAY"].includes(status)
            ? new Date().toLocaleTimeString("en-US", { hour12: false })
            : null,
        },
      });
      if (res.ok) {
        fetchAttendanceForDate(selectedDate);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to mark attendance");
      }
    } catch (err) {
      alert("Network error marking attendance");
    }
  };

  const statusConfig: any = {
    PRESENT: { label: "PRESENT", color: "var(--green)", bg: "var(--green-bg)", icon: <FaCheck /> },
    ABSENT: { label: "ABSENT", color: "var(--red)", bg: "var(--red-bg)", icon: <FaTimes /> },
    OD: { label: "ON DUTY", color: "var(--accent)", bg: "var(--accent-bg)", icon: <FaBriefcase /> },
    LEAVE: { label: "LEAVE", color: "var(--amber)", bg: "var(--amber-bg)", icon: <FaUserClock /> },
    HALF_DAY: { label: "HALF DAY", color: "#8b5cf6", bg: "#ede9fe", icon: <FaClock /> },
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  // Stats
  const stats = {
    total: employees.length,
    present: Object.values(attendance).filter(r => ["PRESENT", "OD", "HALF_DAY"].includes(r.status)).length,
    absent: Object.values(attendance).filter(r => r.status === "ABSENT").length,
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Attendance Management</h1>
          <p>Real-time workforce tracking and daily logs for {selectedDate}.</p>
        </div>
        <div className="page-header-actions">
        <div className="page-header-actions">
          <div className="page-search-bar" style={{ height: "42px", padding: "0 14px", borderRadius: "20px" }}>
            <FaCalendarAlt size={14} style={{ color: "var(--accent)" }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ fontWeight: 600, width: "130px" }}
            />
          </div>
          <button
            className={`page-btn-round ${autoRefresh ? "page-btn-round-primary" : ""}`}
            style={{ 
              height: "42px", 
              position: 'relative',
              paddingLeft: autoRefresh ? '32px' : '20px'
            }}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh && (
              <span className="live-indicator-pulse" style={{
                position: 'absolute',
                left: '12px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.7)',
                animation: 'pulse-white 2s infinite'
              }}></span>
            )}
            <FaSync className={autoRefresh ? "fa-spin" : ""} size={12} />
            {autoRefresh ? "Live Active" : "Go Live"}
          </button>
        </div>
        </div>
      </div>

      {/* Stats Board */}
      <div className="premium-stats-grid">
        <div className="stat-card card-indigo">
          <FaUsers className="stat-icon" />
          <div className="label">Total Workforce</div>
          <div className="value">{stats.total}</div>
          <div className="stat-sub">Registered employees</div>
        </div>
        <div className="stat-card card-emerald">
          <FaCheckCircle className="stat-icon" />
          <div className="label">Present Today</div>
          <div className="value">{stats.present}</div>
          <div className="stat-sub">Active on premises</div>
        </div>
        <div className="stat-card card-rose">
          <FaExclamationCircle className="stat-icon" />
          <div className="label">Daily Absentees</div>
          <div className="value">{stats.absent}</div>
          <div className="stat-sub">Mismatched or leave</div>
        </div>
      </div>

      {/* Search & Actions */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        <div className="page-search-bar" style={{ width: isMobile ? "100%" : "340px" }}>
          <FaSearch className="page-search-icon" size={13} />
          <input
            placeholder="Search by employee name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton-row" style={{ height: "180px" }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredEmployees.map((emp, idx) => {
            const record = attendance[`${emp.id}_${selectedDate}`];
            const cfg = record ? statusConfig[record.status] : null;
            return (
              <motion.div
                key={emp.id}
                className="tx-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{ flexDirection: "column", alignItems: "stretch", padding: "20px" }}
              >
                {/* Employee Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                  <div className="tx-icon" style={{ 
                    width: "48px", 
                    height: "48px", 
                    borderRadius: "12px", 
                    background: "var(--bg)", 
                    color: "var(--accent)", 
                    fontSize: "18px", 
                    fontWeight: 700 
                  }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="tx-desc" style={{ fontSize: "16px" }}>{emp.name}</div>
                    <div className="tx-poster" style={{ fontSize: "12px" }}>{emp.designation || "Executive"}</div>
                  </div>
                  {cfg ? (
                    <span className="type-badge" style={{ background: cfg.bg, color: cfg.color, padding: "4px 10px" }}>
                      {cfg.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-3)", padding: "4px 8px", background: "var(--bg)", borderRadius: "4px", textTransform: "uppercase" }}>Pending</span>
                  )}
                </div>

                {/* Times */}
                <div style={{ 
                  display: "flex", 
                  backgroundColor: "var(--bg)", 
                  padding: "12px", 
                  borderRadius: "10px", 
                  justifyContent: "space-around", 
                  marginBottom: "16px" 
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Check In</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: record?.check_in_time ? "var(--green)" : "var(--text-3)" }}>
                      {record?.check_in_time || "-- : --"}
                    </div>
                  </div>
                  <div style={{ width: "1px", backgroundColor: "var(--border)" }}></div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Check Out</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: record?.check_out_time ? "var(--red)" : "var(--text-3)" }}>
                      {record?.check_out_time || "-- : --"}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
                  {Object.entries(statusConfig).map(([key, c]: any) => (
                    <button
                      key={key}
                      onClick={() => markAttendance(emp.id, key)}
                      style={{
                        padding: "8px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: record?.status === key ? c.color : "white",
                        color: record?.status === key ? "white" : "var(--text-2)",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        minWidth: "60px",
                        transition: "all 0.2s"
                      }}
                      title={c.label}
                    >
                      {React.cloneElement(c.icon, { size: 14 })}
                      <span style={{ fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>{c.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
                
                {record?.method && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-soft)", paddingTop: "8px", fontSize: "10px", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <FaFingerprint size={10} /> Logged via {record.method}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Attendance;
