// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { FaCalculator } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface PayrollRow {
  id: number;
  employee_name: string;
  emp_code: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_status: string;
}

const fmt = (n: any) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const currentMonth = () => new Date().toISOString().slice(0, 7);

const OrgPayroll: React.FC = () => {
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchRows = async (m: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/org/payroll?month=${m}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(month); }, [month]);

  const processPayroll = async () => {
    setProcessing(true);
    try {
      const res = await apiFetch("/org/payroll/process", { method: "POST", body: { payroll_month: month } });
      const data = await res.json();
      if (data.success) { alert(data.message); fetchRows(month); }
      else alert(data.error);
    } finally {
      setProcessing(false);
    }
  };

  const markPaid = async (id: number) => {
    await apiFetch(`/org/payroll/${id}/mark-paid`, { method: "POST" });
    fetchRows(month);
  };

  const total = rows.reduce((sum, r) => sum + parseFloat(String(r.net_salary || 0)), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Payroll</h1>
          <p>Monthly payroll for Fluxora staff.</p>
        </div>
        <div className="page-header-actions">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="page-btn" style={{ cursor: "pointer" }} />
          <button className="page-btn page-btn-primary" onClick={processPayroll} disabled={processing}>
            <FaCalculator /> {processing ? "Processing…" : "Process Payroll"}
          </button>
        </div>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="page-empty">No payroll generated for this month yet. Click "Process Payroll".</div>
        ) : (
          <>
            <table className="page-table">
              <thead>
                <tr><th>Employee</th><th className="text-right">Basic</th><th className="text-right">Allowances</th><th className="text-right">Deductions</th><th className="text-right">Net</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.employee_name} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({r.emp_code})</span></td>
                    <td className="text-right">₹{fmt(r.basic_salary)}</td>
                    <td className="text-right">₹{fmt(r.allowances)}</td>
                    <td className="text-right">₹{fmt(r.deductions)}</td>
                    <td className="text-right font-bold">₹{fmt(r.net_salary)}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: r.payment_status === "paid" ? "#dcfce7" : "#fef9c3", color: r.payment_status === "paid" ? "#166534" : "#854d0e" }}>
                        {r.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {r.payment_status !== "paid" && (
                        <button className="page-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => markPaid(r.id)}>Mark Paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "14px 18px", fontWeight: 700, borderTop: "1px solid #eee", textAlign: "right" }}>
              Total Payroll: ₹{fmt(total)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrgPayroll;
