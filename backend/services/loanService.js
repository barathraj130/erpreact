// backend/services/loanService.js
import * as db from "../database/pg.js";
import { logAction } from "./auditLogService.js";

/**
 * Create a new loan
 */
export const createLoan = async (companyId, loanData, userId) => {
    const {
        lender_id, // Party ID
        loan_amount,
        loan_type, // "borrowed" or "given"
        interest_type, // "simple" or "compound"
        interest_rate, // percentage per annum
        loan_period_months,
        start_date,
        principal_account_id = null,
        interest_account_id = null,
        notes = null
    } = loanData;

    try {
        // Calculate EMI
        const monthlyRate = interest_rate / 12 / 100;
        const emi = (loan_amount * monthlyRate * Math.pow(1 + monthlyRate, loan_period_months)) /
                    (Math.pow(1 + monthlyRate, loan_period_months) - 1);

        const totalInterest = (emi * loan_period_months) - loan_amount;

        const loan = await db.pgRun(
            `INSERT INTO loans
             (company_id, lender_id, loan_amount, loan_type, interest_type, interest_rate, 
              loan_period_months, start_date, principal_account_id, interest_account_id, emi, total_interest, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE')
             RETURNING *`,
            [
                companyId,
                lender_id,
                loan_amount,
                loan_type,
                interest_type,
                interest_rate,
                loan_period_months,
                start_date,
                principal_account_id,
                interest_account_id,
                Math.round(emi * 100) / 100,
                Math.round(totalInterest * 100) / 100,
                notes
            ]
        );

        // Generate EMI schedule
        await generateEMISchedule(loan.id, loan_amount, emi, monthlyRate, loan_period_months, start_date, interest_type);

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "FINANCE",
            action: "CREATE_LOAN",
            resource_type: "loan",
            resource_id: loan.id,
            new_data: loanData,
            status: "success"
        });

        return loan;
    } catch (err) {
        console.error("❌ Create loan error:", err);
        throw err;
    }
};

/**
 * Generate EMI schedule
 */
export const generateEMISchedule = async (loanId, principal, emi, monthlyRate, months, startDate, interestType) => {
    try {
        const schedule = [];
        let remainingBalance = principal;
        let currentDate = new Date(startDate);

        for (let i = 1; i <= months; i++) {
            const interestAmount = interestType === "compound"
                ? remainingBalance * monthlyRate
                : principal * monthlyRate;

            const principalAmount = emi - interestAmount;
            remainingBalance = Math.max(0, remainingBalance - principalAmount);

            const dueDate = new Date(currentDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            schedule.push({
                loan_id: loanId,
                installment_number: i,
                due_date: dueDate,
                principal_amount: Math.round(principalAmount * 100) / 100,
                interest_amount: Math.round(interestAmount * 100) / 100,
                emi_amount: Math.round(emi * 100) / 100,
                balance: Math.round(remainingBalance * 100) / 100,
                status: "PENDING"
            });
        }

        // Bulk insert schedule
        for (const installment of schedule) {
            await db.pgRun(
                `INSERT INTO loan_installments 
                 (loan_id, installment_number, due_date, principal_amount, interest_amount, emi_amount, balance, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    installment.loan_id,
                    installment.installment_number,
                    installment.due_date,
                    installment.principal_amount,
                    installment.interest_amount,
                    installment.emi_amount,
                    installment.balance,
                    installment.status
                ]
            );
        }

        return schedule;
    } catch (err) {
        console.error("❌ Generate EMI schedule error:", err);
        throw err;
    }
};

/**
 * Record loan payment
 */
export const recordLoanPayment = async (loanId, paymentData, userId) => {
    const {
        installment_id,
        amount_paid,
        payment_date,
        payment_method,
        reference_no = null,
        company_id
    } = paymentData;

    try {
        // Update installment
        const installment = await db.pgRun(
            `UPDATE loan_installments 
             SET paid_date = $1, amount_paid = $2, status = 'PAID'
             WHERE id = $3
             RETURNING *`,
            [payment_date, amount_paid, installment_id]
        );

        // Create payment transaction
        const payment = await db.pgRun(
            `INSERT INTO loan_payments
             (loan_id, installment_id, amount_paid, payment_date, payment_method, reference_no, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED')
             RETURNING *`,
            [loanId, installment_id, amount_paid, payment_date, payment_method, reference_no]
        );

        // Check if loan is fully paid
        const remaining = await db.pgGet(
            `SELECT COUNT(*) as count FROM loan_installments 
             WHERE loan_id = $1 AND status != 'PAID'`,
            [loanId]
        );

        if (remaining.count === 0) {
            await db.pgRun("UPDATE loans SET status = 'COMPLETED' WHERE id = $1", [loanId]);
        }

        await logAction({
            user_id: userId,
            company_id,
            module: "FINANCE",
            action: "RECORD_LOAN_PAYMENT",
            resource_type: "loan_payment",
            resource_id: payment.id,
            new_data: paymentData,
            status: "success"
        });

        return payment;
    } catch (err) {
        console.error("❌ Record loan payment error:", err);
        throw err;
    }
};

/**
 * Get loan details with schedule
 */
export const getLoanDetails = async (loanId) => {
    try {
        const loan = await db.pgGet("SELECT * FROM loans WHERE id = $1", [loanId]);

        if (!loan) throw new Error("Loan not found");

        const schedule = await db.pgAll(
            `SELECT * FROM loan_installments WHERE loan_id = $1 ORDER BY installment_number`,
            [loanId]
        );

        const payments = await db.pgAll(
            `SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date DESC`,
            [loanId]
        );

        return {
            ...loan,
            schedule,
            payments
        };
    } catch (err) {
        console.error("❌ Get loan details error:", err);
        return null;
    }
};

/**
 * Get company loans summary
 */
export const getCompanyLoans = async (companyId) => {
    try {
        const loans = await db.pgAll(
            `SELECT 
                l.*,
                p.party_name,
                COUNT(CASE WHEN li.status != 'PAID' THEN 1 END) as pending_installments,
                COALESCE(SUM(CASE WHEN li.status != 'PAID' THEN li.emi_amount ELSE 0 END), 0) as outstanding
             FROM loans l
             LEFT JOIN parties p ON l.lender_id = p.id
             LEFT JOIN loan_installments li ON l.id = li.loan_id
             WHERE l.company_id = $1
             GROUP BY l.id, p.id, p.party_name
             ORDER BY l.created_at DESC`,
            [companyId]
        );

        // Summary calculations
        const totalBorrowed = loans
            .filter(l => l.loan_type === "borrowed")
            .reduce((sum, l) => sum + l.loan_amount, 0);

        const totalGiven = loans
            .filter(l => l.loan_type === "given")
            .reduce((sum, l) => sum + l.loan_amount, 0);

        const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);

        return {
            loans,
            summary: {
                total_borrowed: totalBorrowed,
                total_given: totalGiven,
                total_outstanding: totalOutstanding,
                active_loans: loans.filter(l => l.status === "ACTIVE").length
            }
        };
    } catch (err) {
        console.error("❌ Get company loans error:", err);
        return { loans: [], summary: {} };
    }
};

/**
 * Get upcoming due dates
 */
export const getUpcomingDues = async (companyId, days = 30) => {
    try {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const dues = await db.pgAll(
            `SELECT 
                li.id,
                li.due_date,
                li.emi_amount,
                l.id as loan_id,
                p.party_name,
                l.loan_type
             FROM loan_installments li
             JOIN loans l ON li.loan_id = l.id
             LEFT JOIN parties p ON l.lender_id = p.id
             WHERE l.company_id = $1
             AND li.status = 'PENDING'
             AND li.due_date BETWEEN NOW() AND $2
             ORDER BY li.due_date ASC`,
            [companyId, futureDate]
        );

        return dues;
    } catch (err) {
        console.error("❌ Get upcoming dues error:", err);
        return [];
    }
};

export default {
    createLoan,
    generateEMISchedule,
    recordLoanPayment,
    getLoanDetails,
    getCompanyLoans,
    getUpcomingDues
};
