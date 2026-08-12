// NEW FILE — SAFE TO CREATE
// DO NOT MODIFY ANY EXISTING FILES
// DO NOT ALTER ANY EXISTING DATABASE TABLES
// FLUXORA ERP — LIVE CUSTOMER PROTECTION
import React, { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  department_name?: string;
  designation_title?: string;
  branch_name?: string;
  employment_status: string;
  basic_salary: number;
}

interface Department { id: number; name: string; }
interface Designation { id: number; title: string; }
interface Branch { id: number; name: string; }

const emptyForm = {
  name: "", email: "", phone: "", department_id: "", designation_id: "", branch_id: "",
  joining_date: "", employment_type: "fulltime", basic_salary: "",
};

const OrgEmployees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, desRes, branchRes] = await Promise.all([
        apiFetch("/org/employees").then((r) => r.json()),
        apiFetch("/org/departments").then((r) => r.json()),
        apiFetch("/org/designations").then((r) => r.json()),
        apiFetch("/org/branches").then((r) => r.json()),
      ]);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      setDepartments(Array.isArray(deptRes) ? deptRes : []);
      setDesignations(Array.isArray(desRes) ? desRes : []);
      setBranches(Array.isArray(branchRes) ? branchRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const quickCreate = async (kind: "department" | "designation" | "branch") => {
    const label = kind === "department" ? "department" : kind === "designation" ? "designation" : "branch";
    const name = window.prompt(`New ${label} name:`);
    if (!name || !name.trim()) return;
    const endpoint = kind === "department" ? "/org/departments" : kind === "designation" ? "/org/designations" : "/org/branches";
    const body = kind === "designation" ? { title: name.trim() } : { name: name.trim() };
    const res = await apiFetch(endpoint, { method: "POST", body });
    const data = await res.json();
    if (data.success) {
      if (kind === "department") { setDepartments((p) => [...p, data.department]); setForm((p) => ({ ...p, department_id: String(data.department.id) })); }
      if (kind === "designation") { setDesignations((p) => [...p, data.designation]); setForm((p) => ({ ...p, designation_id: String(data.designation.id) })); }
      if (kind === "branch") { setBranches((p) => [...p, data.branch]); setForm((p) => ({ ...p, branch_id: String(data.branch.id) })); }
    } else {
      alert(data.error || `Failed to create ${label}`);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { setErr("Employee name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await apiFetch("/org/employees", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setForm(emptyForm);
        fetchAll();
      } else {
        setErr(data.error || "Failed to create employee");
      }
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Fluxora Employees</h1>
          <p>{employees.length} staff members at Fluxora Technology.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn page-btn-primary" onClick={() => setShowModal(true)}>
            <FaPlus /> Add Employee
          </button>
        </div>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="page-empty">No employees yet. Add your first one.</div>
        ) : (
          <table className="page-table">
            <thead>
              <tr>
                <th>Emp ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Branch</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono">{e.employee_id}</td>
                  <td className="font-bold">{e.name}</td>
                  <td>{e.department_name || "—"}</td>
                  <td>{e.designation_title || "—"}</td>
                  <td>{e.branch_name || "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{e.employment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="page-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Employee</h2>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}
            <label>Name *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Department
              <span onClick={() => quickCreate("department")} style={{ color: "#5B4BFF", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ New</span>
            </label>
            <select value={form.department_id} onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Designation
              <span onClick={() => quickCreate("designation")} style={{ color: "#5B4BFF", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ New</span>
            </label>
            <select value={form.designation_id} onChange={(e) => setForm((p) => ({ ...p, designation_id: e.target.value }))}>
              <option value="">— None —</option>
              {designations.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Branch
              <span onClick={() => quickCreate("branch")} style={{ color: "#5B4BFF", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ New</span>
            </label>
            <select value={form.branch_id} onChange={(e) => setForm((p) => ({ ...p, branch_id: e.target.value }))}>
              <option value="">— None —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label>Joining Date</label>
            <input type="date" value={form.joining_date} onChange={(e) => setForm((p) => ({ ...p, joining_date: e.target.value }))} />
            <label>Basic Salary</label>
            <input type="number" value={form.basic_salary} onChange={(e) => setForm((p) => ({ ...p, basic_salary: e.target.value }))} />
            <div className="page-modal-actions">
              <button className="page-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="page-modal-save" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save Employee"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgEmployees;
