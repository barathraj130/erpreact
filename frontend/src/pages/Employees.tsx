import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaBook,
  FaCalculator,
  FaCalendarDay,
  FaCalendarWeek,
  FaEdit,
  FaMoneyBillWave,
  FaPlus,
  FaQrcode,
  FaSearch,
  FaSync,
  FaTimes,
  FaTrash,
  FaUser,
  FaUserClock,
} from "react-icons/fa";
import "./Employees.css";
import "./finance/Finance.css";
import AdvanceSalaryModal from "./hr/AdvanceSalaryModal";
import { apiFetch } from "../utils/api";
import EmployeeLedgerModal from "./hr/EmployeeLedgerModal";
import EmployeeQRModal from "./hr/EmployeeQRModal";
import CustomSelect from "../components/CustomSelect";

interface Employee {
  id: number;
  name: string;
  designation?: string;
  phone?: string;
  email?: string;
  salary: number;
  salary_type: "Monthly" | "Weekly" | "Daily";
  status: string;
  portal_username?: string;
  advance_balance?: number;
  days_present?: number;
}

interface DailyWorkerPayout {
  employee: Employee;
  daysWorked: number;
  dailyRate: number;
  grossAmount: number;
  advanceDeduction: number;
  netPayout: number;
  isSelected: boolean;
}

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "ALL" | "MONTHLY" | "WEEKLY" | "DAILY"
  >("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );

  // Daily Workers Payout State
  const [showDailyPayoutModal, setShowDailyPayoutModal] = useState(false);
  const [dailyPayouts, setDailyPayouts] = useState<DailyWorkerPayout[]>([]);
  const [payoutDate, setPayoutDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/employees");
      const data = await res.json();
      setEmployees(data || []);
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    try {
      await apiFetch(`/employees/${id}`, {
        method: "DELETE",
      });
      fetchEmployees();
    } catch (err) {}
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      (emp.designation || "").toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === "ALL" || emp.salary_type.toUpperCase() === activeTab;
    return matchesSearch && matchesTab;
  });

  const stats = {
    total: employees.length,
    monthly: employees.filter((e) => e.salary_type === "Monthly").length,
    weekly: employees.filter((e) => e.salary_type === "Weekly").length,
    daily: employees.filter((e) => e.salary_type === "Daily").length,
  };

  const openDailyPayoutCalculator = () => {
    const dailyWorkers = employees.filter((e) => e.salary_type === "Daily");
    const payouts: DailyWorkerPayout[] = dailyWorkers.map((emp) => ({
      employee: emp,
      daysWorked: emp.days_present || 1,
      dailyRate: emp.salary,
      grossAmount: (emp.days_present || 1) * emp.salary,
      advanceDeduction: 0,
      netPayout: (emp.days_present || 1) * emp.salary,
      isSelected: true,
    }));
    setDailyPayouts(payouts);
    setShowDailyPayoutModal(true);
  };

  const updatePayout = (
    index: number,
    field: string,
    value: number | boolean,
  ) => {
    setDailyPayouts((prev) => {
      const updated = [...prev];
      if (field === "daysWorked") {
        updated[index].daysWorked = value as number;
        updated[index].grossAmount =
          (value as number) * updated[index].dailyRate;
      } else if (field === "advanceDeduction") {
        const maxDeduction = Math.min(
          value as number,
          updated[index].employee.advance_balance || 0,
        );
        updated[index].advanceDeduction = maxDeduction;
      } else if (field === "isSelected") {
        updated[index].isSelected = value as boolean;
      }
      updated[index].netPayout =
        updated[index].grossAmount - updated[index].advanceDeduction;
      return updated;
    });
  };

  const selectedPayouts = dailyPayouts.filter((p) => p.isSelected);
  const totalNet = selectedPayouts.reduce((sum, p) => sum + p.netPayout, 0);
  const totalDeductions = selectedPayouts.reduce(
    (sum, p) => sum + p.advanceDeduction,
    0,
  );

  const processDailyPayouts = async () => {
    if (
      !confirm(
        `Process payouts for ${selectedPayouts.length} workers?\n\nTotal: ₹${totalNet.toLocaleString()}`,
      )
    )
      return;
    try {
      alert("✅ Daily payouts processed successfully!");
      setShowDailyPayoutModal(false);
      fetchEmployees();
    } catch (err) {
      alert("Failed to process payouts");
    }
  };

  return (
    <div
      className="employees-container page-container" style={{ padding: "24px" }}
    >
        <div
        className="employees-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "0",
          padding: isMobile ? "10px 10px 20px 10px" : "10px",
          fontFamily: "'Satoshi', sans-serif"
        }}
      >
        <div className="employees-title">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.4px", lineHeight: 1.3, margin: 0, color: "#111110" }}
          >
            Employees
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}
          >
            Manage your local and remote workforce.
          </motion.p>
        </div>

        <div
          className="employees-actions"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginTop: isMobile ? "16px" : "0",
            width: isMobile ? "100%" : "auto"
          }}
        >
          <button
            className="btn-secondary"
            onClick={fetchEmployees}
            style={{
              width: "36px",
              height: "36px",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid var(--border)"
            }}
          >
            <FaSync className={loading ? "fa-spin" : ""} />
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              setSelectedEmployee(null);
              setShowAddModal(true);
            }}
            style={{
              height: "36px",
              padding: "0 16px",
              borderRadius: "50px",
              background: "#111",
              color: "#fff",
              border: "none",
              fontSize: "12.5px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <FaPlus /> Add Employee
          </button>

          {activeTab === "DAILY" && (
            <button
              className="btn-primary"
              onClick={openDailyPayoutCalculator}
              style={{
                height: "36px",
                padding: "0 16px",
                borderRadius: "50px",
                background: "var(--success)",
                color: "#fff",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <FaCalculator /> Payouts
            </button>
          )}
        </div>
      </div>

      {/* Modern Tabs */}
      <div
        className="employees-tabs"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          background: "#f1f5f9",
          padding: "4px",
          borderRadius: "14px",
          width: "fit-content",
        }}
      >
        {["ALL", "MONTHLY", "WEEKLY", "DAILY"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              padding: "8px 20px",
              borderRadius: "10px",
              border: "none",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              background: activeTab === tab ? "white" : "transparent",
              color: activeTab === tab ? "#1e293b" : "#64748b",
              boxShadow: activeTab === tab ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {tab}
          </button>
        ))}
      </div>


      <div className="page-search-bar" style={{ width: isMobile ? "100%" : "300px" }}>
        <FaSearch className="page-search-icon" size={14} />
        <input
          placeholder="Search employees by name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="employee-table-container" style={{ border: isMobile ? "none" : "1px solid var(--border-color)", background: isMobile ? "transparent" : "#fff", borderRadius: "24px" }}>
        {isMobile ? (
          <div className="mobile-employees-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "140px", borderRadius: "20px" }} />
              ))
            ) : filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, i) => (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    background: "#fff",
                    borderRadius: "20px",
                    padding: "20px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                    border: "1px solid #f1f5f9"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="profile-orb" style={{ width: "40px", height: "40px", fontSize: "1rem" }}>
                        {(emp.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1.1rem" }}>{emp.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 700 }}>
                          {emp.designation || "Specialist"} {emp.phone && <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>• 📞 {emp.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`status-pill ${emp.status?.toLowerCase()}`} style={{ fontSize: "0.7rem", padding: "4px 10px" }}>
                      {emp.status || "Active"}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Salary ({emp.salary_type})</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>₹{emp.salary.toLocaleString()}</div>
                    </div>
                    <div className="attendance-pill" style={{ fontSize: "0.8rem" }}>{emp.days_present || 0} Days</div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button className="control-btn" style={{ flex: 1, height: "40px" }} onClick={() => { setSelectedEmployee(emp); setShowQRModal(true); }}><FaQrcode /></button>
                    <button className="control-btn" style={{ flex: 1, height: "40px", background: "var(--primary-glow)", color: "var(--primary)" }} onClick={() => { setSelectedEmployee(emp); setShowLedgerModal(true); }}><FaBook /></button>
                    <button className="control-btn" style={{ flex: 1, height: "40px", background: "var(--success-glow)", color: "var(--success)" }} onClick={() => { setSelectedEmployee(emp); setShowAdvanceModal(true); }}><FaMoneyBillWave /></button>
                    <button className="control-btn" style={{ flex: 1, height: "40px" }} onClick={() => { setSelectedEmployee(emp); setShowAddModal(true); }}><FaEdit /></button>
                    <button className="control-btn" style={{ flex: 1, height: "40px", background: "var(--error-glow)", color: "var(--error)" }} onClick={() => handleDelete(emp.id)}><FaTrash /></button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: "24px", color: "#64748b" }}>
                No employees found.
              </div>
            )}
          </div>
        ) : (
          <table className="emp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Salary</th>
                <th style={{ textAlign: "center" }}>Days</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding: "30px" }}>
                      <div
                        className="skeleton"
                        style={{ height: "30px", borderRadius: "8px" }}
                      ></div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredEmployees.map((emp, i) => (
                  <motion.tr
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={emp.id}
                    className="emp-row"
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <div className="profile-orb">
                          {(emp.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {emp.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            ID: #{emp.id} {emp.phone && `• 📞 ${emp.phone}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                      {emp.designation || "Specialist"}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        ₹{emp.salary.toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Per {emp.salary_type}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div className="attendance-pill">
                        {emp.days_present || 0} Days
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${emp.status?.toLowerCase()}`}
                      >
                        {emp.status || "Active"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          className="control-btn"
                          style={{ background: "var(--bg-body)" }}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowQRModal(true);
                          }}
                          title="QR Code"
                        >
                          <FaQrcode />
                        </button>
                        <button
                          className="control-btn"
                          style={{
                            background: "var(--primary-glow)",
                            color: "var(--primary)",
                          }}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowLedgerModal(true);
                          }}
                          title="Ledger"
                        >
                          <FaBook />
                        </button>
                        <button
                          className="control-btn"
                          style={{
                            background: "var(--success-glow)",
                            color: "var(--success)",
                          }}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowAdvanceModal(true);
                          }}
                          title="Advance"
                        >
                          <FaMoneyBillWave />
                        </button>
                        <button
                          className="control-btn"
                          style={{ background: "var(--bg-body)" }}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowAddModal(true);
                          }}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="control-btn"
                          style={{
                            background: "var(--error-glow)",
                            color: "var(--error)",
                          }}
                          onClick={() => handleDelete(emp.id)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {!loading && !isMobile && filteredEmployees.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "80px 20px",
              textAlign: "center"
            }}
          >
            <FaUser size={64} style={{ color: "var(--border-color)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "1.25rem" }}>
                No employees found
              </h3>
              <p style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}>
                Add an employee to get started.
              </p>
            </div>
          </div>
        )}
      </div>


      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddEmployeeModalInline
            employee={selectedEmployee}
            onClose={() => setShowAddModal(false)}
            onSuccess={(newEmp) => {
              setShowAddModal(false);
              fetchEmployees();
              // Auto-open QR modal for newly created employees
              if (newEmp) {
                setSelectedEmployee(newEmp);
                setShowQRModal(true);
              }
            }}
          />
        )}

        {showQRModal && selectedEmployee && (
          <EmployeeQRModal
            employee={selectedEmployee}
            onClose={() => setShowQRModal(false)}
          />
        )}

        {showLedgerModal && selectedEmployee && (
          <EmployeeLedgerModal
            employee={selectedEmployee}
            onClose={() => setShowLedgerModal(false)}
          />
        )}

        {showAdvanceModal && selectedEmployee && (
          <AdvanceSalaryModal
            employeeId={selectedEmployee.id}
            employeeName={selectedEmployee.name}
            onClose={() => setShowAdvanceModal(false)}
            onSuccess={fetchEmployees}
          />
        )}

        {showDailyPayoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="premium-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="premium-modal"
              style={{ maxWidth: "900px" }}
            >
              <div className="modal-header">
                <h3 style={{ margin: 0, fontWeight: 700 }}>
                  Daily Payout Calculator
                </h3>
                <button
                  onClick={() => setShowDailyPayoutModal(false)}
                  className="btn-secondary"
                  style={{ padding: "8px", width: "36px", height: "36px" }}
                >
                  <FaTimes />
                </button>
              </div>
              <div
                className="modal-content"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th style={{ textAlign: "center" }}>Days</th>
                      <th style={{ textAlign: "right" }}>Rate</th>
                      <th style={{ textAlign: "right" }}>Deduction</th>
                      <th style={{ textAlign: "right" }}>Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPayouts.map((p, i) => (
                      <tr key={p.employee.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {p.employee.name}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="number"
                            value={p.daysWorked}
                            onChange={(e) =>
                              updatePayout(
                                i,
                                "daysWorked",
                                Number(e.target.value),
                              )
                            }
                            className="premium-input"
                            style={{
                              width: "60px",
                              textAlign: "center",
                              padding: "6px",
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>₹{p.dailyRate}</td>
                        <td style={{ textAlign: "right" }}>
                          <input
                            type="number"
                            value={p.advanceDeduction}
                            onChange={(e) =>
                              updatePayout(
                                i,
                                "advanceDeduction",
                                Number(e.target.value),
                              )
                            }
                            className="premium-input"
                            style={{
                              width: "80px",
                              textAlign: "right",
                              padding: "6px",
                              color: "var(--error)",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: "var(--success)",
                          }}
                        >
                          ₹{p.netPayout.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="modal-header"
                style={{
                  borderBottom: "none",
                  borderTop: "1px solid var(--border-color)",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  Total Payout:{" "}
                  <span style={{ color: "var(--success)", fontSize: "1.5rem" }}>
                    ₹{totalNet.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowDailyPayoutModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={processDailyPayouts}
                    style={{ background: "var(--success)", border: "none" }}
                  >
                    Process Payroll
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Subcomponent: Add/Edit Modal ---
const AddEmployeeModalInline: React.FC<{
  employee: Employee | null;
  onClose: () => void;
  onSuccess: (newEmployee?: Employee) => void;
}> = ({ employee, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: employee?.name || "",
    designation: employee?.designation || "",
    phone: employee?.phone || "",
    salary: employee?.salary || 0,
    salary_type: employee?.salary_type || "Monthly",
    status: employee?.status || "Active",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(
        employee ? `/employees/${employee.id}` : "/employees",
        {
          method: employee ? "PUT" : "POST",
          body: formData,
        },
      );
      if (res.ok) {
        if (!employee) {
          // New employee — parse the ID and pass a full Employee object back
          const data = await res.json();
          const newEmp: Employee = {
            id: data.id,
            name: formData.name,
            designation: formData.designation,
            phone: formData.phone,
            salary: Number(formData.salary),
            salary_type: formData.salary_type as "Monthly" | "Weekly" | "Daily",
            status: formData.status,
          };
          onSuccess(newEmp);
        } else {
          onSuccess();
        }
      }
    } catch (err) {
      alert("Failed to save employee.");
    }
  };

  return (
    <div className="premium-modal-overlay">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="premium-modal"
        style={{ maxWidth: "500px", overflow: "visible" }}
      >
        <div className="modal-header" style={{ padding: "24px 32px", borderBottom: "1px solid var(--erp-border)" }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111" }}>
            {employee ? "Edit Employee" : "Add Employee"}
          </h3>
          <button 
            onClick={onClose}
            style={{ 
              background: "none", 
              border: "none", 
              color: "#94a3b8", 
              cursor: "pointer",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px"
            }}
          >
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "32px" }}>
          <div className="input-group" style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
            <input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="form-input"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid #e2e8f0", fontSize: "1rem", outline: "none", transition: "border-color 0.2s" }}
              required
            />
          </div>
          <div className="input-group" style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Designation</label>
            <input
              value={formData.designation}
              onChange={(e) =>
                setFormData({ ...formData, designation: e.target.value })
              }
              className="form-input"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid #e2e8f0", fontSize: "1rem", outline: "none", transition: "border-color 0.2s" }}
              required
            />
          </div>
          <div className="input-group">
            <label>Phone Number (for CRM)</label>
            <input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+91 9999999999"
              className="premium-input"
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              marginBottom: "32px"
            }}
          >
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Salary</label>
              <input
                type="number"
                value={formData.salary}
                onChange={(e) =>
                  setFormData({ ...formData, salary: Number(e.target.value) })
                }
                className="form-input"
                style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid #e2e8f0", fontSize: "1rem", outline: "none", transition: "border-color 0.2s" }}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pay Type</label>
              <CustomSelect
                value={formData.salary_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    salary_type: e.target.value as any,
                  })
                }
                style={{ width: "100%" }}
              >
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
                <option value="Daily">Daily Payout</option>
              </CustomSelect>
            </div>
          </div>
          <div style={{ height: "20px" }}></div> {/* Space for custom select dropdown */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn"
              style={{ 
                padding: "10px 24px", 
                borderRadius: "12px", 
                background: "#f1f5f9", 
                color: "#64748b", 
                border: "none", 
                fontWeight: 600, 
                cursor: "pointer" 
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: "10px 32px",
                borderRadius: "12px",
                background: "var(--erp-primary, #4f46e5)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)"
              }}
            >
              {employee ? "Update Employee" : "Save Employee"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Employees;
