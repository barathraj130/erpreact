// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { FaUsers, FaCalendarCheck, FaMoneyBillWave, FaFileInvoiceDollar } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface DashboardData {
  employees: { total: number; active: number };
  attendance_today: { present: number; absent: number; on_leave: number };
  pending_leaves: { id: number; employee_name: string; leave_type: string; total_days: number }[];
  payroll_this_month: { total: number; paid: number; total_amount: number };
  finance_this_month: { total_income: number; total_expense: number };
}

const fmt = (n: any) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const OrgDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/org/dashboard");
        const json = await res.json();
        if (json.error) setError(json.error);
        else setData(json);
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="page-container">Loading…</div>;
  if (error) return <div className="page-container"><div className="page-empty">{error}</div></div>;
  if (!data) return null;

  const cards = [
    { icon: <FaUsers />, label: "Active Employees", value: `${data.employees.active} / ${data.employees.total}`, color: "#5B4BFF" },
    { icon: <FaCalendarCheck />, label: "Present Today", value: `${data.attendance_today.present || 0}`, sub: `${data.attendance_today.absent || 0} absent · ${data.attendance_today.on_leave || 0} on leave`, color: "#10B981" },
    { icon: <FaMoneyBillWave />, label: "Payroll This Month", value: `${data.payroll_this_month.paid} / ${data.payroll_this_month.total} paid`, sub: `₹${fmt(data.payroll_this_month.total_amount)} total`, color: "#F59E0B" },
    { icon: <FaFileInvoiceDollar />, label: "Finance This Month", value: `₹${fmt(data.finance_this_month.total_income)} in`, sub: `₹${fmt(data.finance_this_month.total_expense)} out`, color: "#8B5CF6" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Fluxora Organization</h1>
          <p>Internal HR &amp; finance overview for Fluxora Technology's own staff.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 24 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
            <div style={{ color: c.color, fontSize: 20, marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="page-table-wrapper">
        <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #eee" }}>Pending Leave Requests</div>
        {data.pending_leaves.length === 0 ? (
          <div className="page-empty">No pending leave requests.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Employee</th><th>Type</th><th className="text-right">Days</th></tr></thead>
            <tbody>
              {data.pending_leaves.map((l) => (
                <tr key={l.id}>
                  <td className="font-bold">{l.employee_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{l.leave_type}</td>
                  <td className="text-right">{l.total_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OrgDashboard;
