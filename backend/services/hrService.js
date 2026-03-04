// backend/services/hrService.js
import * as db from "../database/pg.js";
import { logAction } from "./auditLogService.js";

/**
 * Add employee
 */
export const addEmployee = async (companyId, employeeData, userId) => {
    const {
        name,
        email,
        phone,
        designation,
        department,
        salary,
        joining_date,
        employment_type = "permanent", // "permanent", "contract", "temporary"
        bank_account = null,
        address = null
    } = employeeData;

    try {
        const employee = await db.pgRun(
            `INSERT INTO employees
             (company_id, name, email, phone, designation, department, salary, joining_date, employment_type, bank_account, address, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
             RETURNING id, name, email, designation`,
            [companyId, name, email, phone, designation, department, salary, joining_date, employment_type, bank_account, address]
        );

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "HR",
            action: "ADD_EMPLOYEE",
            resource_type: "employee",
            resource_id: employee.id,
            new_data: employeeData,
            status: "success"
        });

        return employee;
    } catch (err) {
        console.error("❌ Add employee error:", err);
        throw err;
    }
};

/**
 * Mark attendance
 */
export const markAttendance = async (companyId, attendanceData, userId) => {
    const {
        employee_id,
        attendance_date,
        status, // "present", "absent", "leave", "half_day"
        remarks = null
    } = attendanceData;

    try {
        // Check if attendance already marked
        const exists = await db.pgGet(
            `SELECT id FROM attendance WHERE employee_id = $1 AND attendance_date = $2`,
            [employee_id, attendance_date]
        );

        let attendance;
        if (exists) {
            attendance = await db.pgRun(
                `UPDATE attendance SET status = $1, remarks = $2 WHERE employee_id = $3 AND attendance_date = $4
                 RETURNING id`,
                [status, remarks, employee_id, attendance_date]
            );
        } else {
            attendance = await db.pgRun(
                `INSERT INTO attendance (employee_id, attendance_date, status, remarks)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [employee_id, attendance_date, status, remarks]
            );
        }

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "HR",
            action: "MARK_ATTENDANCE",
            resource_type: "attendance",
            resource_id: attendance.id,
            new_data: attendanceData,
            status: "success"
        });

        return attendance;
    } catch (err) {
        console.error("❌ Mark attendance error:", err);
        throw err;
    }
};

/**
 * Calculate salary
 */
export const calculateSalary = async (employeeId, month, year) => {
    try {
        const employee = await db.pgGet("SELECT salary FROM employees WHERE id = $1", [employeeId]);

        if (!employee) throw new Error("Employee not found");

        // Get attendance for the month
        const attendance = await db.pgAll(
            `SELECT status FROM attendance 
             WHERE employee_id = $1 AND EXTRACT(MONTH FROM attendance_date) = $2 
             AND EXTRACT(YEAR FROM attendance_date) = $3`,
            [employeeId, month, year]
        );

        // Calculate working days
        const presentDays = attendance.filter(a => a.status === "present").length;
        const halfDays = attendance.filter(a => a.status === "half_day").length;
        const workingDays = presentDays + (halfDays * 0.5);

        // Calculate basic salary
        const totalDaysInMonth = new Date(year, month, 0).getDate();
        const basicSalary = (employee.salary / totalDaysInMonth) * workingDays;

        // Get deductions and advances
        const deductions = await db.pgAll(
            `SELECT amount FROM salary_deductions 
             WHERE employee_id = $1 AND deduction_month = $2 AND deduction_year = $3`,
            [employeeId, month, year]
        );

        const advances = await db.pgAll(
            `SELECT amount FROM salary_advances 
             WHERE employee_id = $1 AND advance_month = $2 AND advance_year = $3`,
            [employeeId, month, year]
        );

        const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
        const totalAdvances = advances.reduce((sum, a) => sum + a.amount, 0);

        const netSalary = basicSalary - totalDeductions - totalAdvances;

        return {
            employee_id: employeeId,
            month,
            year,
            basic_salary: Math.round(basicSalary * 100) / 100,
            deductions: totalDeductions,
            advances: totalAdvances,
            net_salary: Math.round(netSalary * 100) / 100,
            working_days: workingDays,
            present_days: presentDays
        };
    } catch (err) {
        console.error("❌ Calculate salary error:", err);
        throw err;
    }
};

/**
 * Generate payslip
 */
export const generatePayslip = async (companyId, employeeId, month, year, userId) => {
    try {
        // Calculate salary
        const salary = await calculateSalary(employeeId, month, year);

        // Create payslip
        const payslip = await db.pgRun(
            `INSERT INTO payslips
             (company_id, employee_id, month, year, basic_salary, deductions, advances, net_salary, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT')
             RETURNING id`,
            [companyId, employeeId, month, year, salary.basic_salary, salary.deductions, salary.advances, salary.net_salary]
        );

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "HR",
            action: "GENERATE_PAYSLIP",
            resource_type: "payslip",
            resource_id: payslip.id,
            new_data: { month, year },
            status: "success"
        });

        return { payslip_id: payslip.id, ...salary };
    } catch (err) {
        console.error("❌ Generate payslip error:", err);
        throw err;
    }
};

/**
 * Record salary advance
 */
export const recordSalaryAdvance = async (companyId, advanceData, userId) => {
    const {
        employee_id,
        amount,
        advance_month,
        advance_year,
        purpose = null,
        approved = false
    } = advanceData;

    try {
        const advance = await db.pgRun(
            `INSERT INTO salary_advances
             (employee_id, amount, advance_month, advance_year, purpose, approved, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [employee_id, amount, advance_month, advance_year, purpose, approved, userId]
        );

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "HR",
            action: "RECORD_ADVANCE",
            resource_type: "salary_advance",
            resource_id: advance.id,
            new_data: advanceData,
            status: "success"
        });

        return advance;
    } catch (err) {
        console.error("❌ Record advance error:", err);
        throw err;
    }
};

/**
 * Get HR dashboard
 */
export const getHRDashboard = async (companyId) => {
    try {
        // Total employees
        const totalEmployees = await db.pgGet(
            `SELECT COUNT(*) as count FROM employees WHERE company_id = $1 AND is_active = TRUE`,
            [companyId]
        );

        // Today's attendance
        const todayAttendance = await db.pgAll(
            `SELECT 
                e.id, e.name, a.status
             FROM employees e
             LEFT JOIN attendance a ON e.id = a.employee_id AND DATE(a.attendance_date) = CURRENT_DATE
             WHERE e.company_id = $1 AND e.is_active = TRUE`,
            [companyId]
        );

        const presentToday = todayAttendance.filter(a => a.status === "present").length;
        const absentToday = todayAttendance.filter(a => a.status === "absent").length;
        const notMarked = todayAttendance.filter(a => a.status === null).length;

        // Monthly payroll status
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const payslipsGenerated = await db.pgGet(
            `SELECT COUNT(*) as count FROM payslips 
             WHERE company_id = $1 AND month = $2 AND year = $3`,
            [companyId, currentMonth, currentYear]
        );

        // Upcoming leaves
        const upcomingLeaves = await db.pgAll(
            `SELECT 
                e.id, e.name, 
                COUNT(a.id) as leave_days
             FROM employees e
             LEFT JOIN attendance a ON e.id = a.employee_id 
             AND a.status = 'leave'
             AND a.attendance_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
             WHERE e.company_id = $1
             GROUP BY e.id, e.name`,
            [companyId]
        );

        return {
            total_employees: totalEmployees.count,
            attendance_today: {
                present: presentToday,
                absent: absentToday,
                not_marked: notMarked
            },
            payroll_status: {
                payslips_generated: payslipsGenerated.count,
                month: currentMonth,
                year: currentYear
            },
            upcoming_leaves: upcomingLeaves
        };
    } catch (err) {
        console.error("❌ Get HR dashboard error:", err);
        return {};
    }
};

export default {
    addEmployee,
    markAttendance,
    calculateSalary,
    generatePayslip,
    recordSalaryAdvance,
    getHRDashboard
};
