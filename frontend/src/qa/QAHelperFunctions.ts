/**
 * QA Helper Functions for Textile ERP v2.4.1
 * Designed for Jest + React Testing Library environment.
 */

import { screen, fireEvent, within } from '@testing-library/react';

/**
 * LOANS PAGE HELPERS
 */
export const createLoan = async (lender: string, principal: number, rate: number, startDate: string, cycle: string) => {
  fireEvent.click(screen.getByText(/Add New Loan/i));
  fireEvent.change(screen.getByLabelText(/Lender/i), { target: { value: lender } });
  fireEvent.change(screen.getByLabelText(/Principal/i), { target: { value: principal.toString() } });
  fireEvent.change(screen.getByLabelText(/Interest Rate/i), { target: { value: rate.toString() } });
  fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: startDate } });
  fireEvent.change(screen.getByLabelText(/Payment Cycle/i), { target: { value: cycle } });
  fireEvent.click(screen.getByRole('button', { name: /Save/i }));
};

export const validateLoanSummaryCards = (expectedTotal: number, expectedAvgRate: number, expectedActive: number) => {
  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;
  expect(screen.getByTestId('total-liability')).toHaveTextContent(formatCurrency(expectedTotal));
  expect(screen.getByTestId('avg-rate')).toHaveTextContent(`${expectedAvgRate}%`);
  expect(screen.getByTestId('active-count')).toHaveTextContent(expectedActive.toString());
};

/**
 * LENDERS MASTER HELPERS
 */
export const addNewLender = (name: string, type: string, contact: string) => {
  fireEvent.click(screen.getByText(/Add Lender/i));
  fireEvent.change(screen.getByPlaceholderText(/Lender Name/i), { target: { value: name } });
  fireEvent.select(screen.getByLabelText(/Type/i), { target: { value: type } });
  fireEvent.change(screen.getByLabelText(/Contact/i), { target: { value: contact } });
  fireEvent.click(screen.getByText(/Submit/i));
};

/**
 * CHIT FUND HELPERS
 */
export const createChitGroup = (name: string, totalValue: number, monthly: number, duration: number, startDate: string) => {
  fireEvent.click(screen.getByText(/Create Chit Group/i));
  fireEvent.change(screen.getByLabelText(/Group Name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/Total Value/i), { target: { value: totalValue.toString() } });
  fireEvent.change(screen.getByLabelText(/Monthly Amount/i), { target: { value: monthly.toString() } });
  fireEvent.change(screen.getByLabelText(/Duration/i), { target: { value: duration.toString() } });
  fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: startDate } });
  fireEvent.click(screen.getByText(/Launch Group/i));
};

/**
 * BROKER NETWORK HELPERS
 */
export const addBroker = (name: string, type: string, commissionRate: number) => {
  fireEvent.click(screen.getByText(/Add Broker/i));
  fireEvent.change(screen.getByLabelText(/Broker Name/i), { target: { value: name } });
  fireEvent.select(screen.getByLabelText(/Type/i), { target: { value: type } });
  fireEvent.change(screen.getByLabelText(/Commission Rate/i), { target: { value: commissionRate.toString() } });
  fireEvent.click(screen.getByText(/Save Broker/i));
};

/**
 * SUPPLIER HELPERS
 */
export const validateGSTIN = (gstin: string) => {
  // Format: 2-digit state code, 10-char PAN, 1-char entity code, 'Z' (default), 1-char check digit
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
};

/**
 * ATTENDANCE HELPERS
 */
export const markAttendance = (employeeName: string, status: 'Present' | 'Absent' | 'Late') => {
  const row = screen.getByText(employeeName).closest('tr');
  if (row) {
    fireEvent.click(within(row).getByLabelText(status));
  }
};

export const bulkMarkPresent = (employeeNames: string[]) => {
  employeeNames.forEach(name => {
    markAttendance(name, 'Present');
  });
};
