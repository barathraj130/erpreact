// frontend/src/pages/finance/financeApi.ts
// Finance API - using the main api wrapper

import { apiFetch } from "../../utils/api";

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return { data: await res.json() };
};

export const financeApi = {
  // Setup
  setupCompany: async (companyId: number) => {
    const res = await apiFetch("/accounting/setup", {
      method: "POST",
      body: { company_id: companyId },
    });
    return handleResponse(res);
  },

  // Chart of Accounts
  getAccounts: async (companyId: number) => {
    const res = await apiFetch("/accounting/accounts");
    return handleResponse(res);
  },

  // Loans - use ledger/transactions since there's no dedicated loans route
  getLoans: async (companyId: number) => {
    // No dedicated loans endpoint; return empty for now
    return { data: [] };
  },

  createLoan: async (data: any) => {
    // No dedicated loans endpoint; post as a transaction
    const res = await apiFetch("/transactions", {
      method: "POST",
      body: {
        date: data.start_date,
        amount: data.principal_amount,
        description: `Loan to ${data.party_name}`,
        category: "LOAN",
        type: data.loan_direction === "GIVEN" ? "PAYMENT" : "RECEIPT",
      },
    });
    return handleResponse(res);
  },

  // Cash Receipts
  createCashReceipt: async (data: any) => {
    const res = await apiFetch("/transactions", {
      method: "POST",
      body: {
        date: new Date().toISOString().split("T")[0],
        amount: data.amount,
        description: `Cash Receipt - ${data.party_name}: ${data.purpose}`,
        category: "RECEIPT",
        type: "RECEIPT",
      },
    });
    return handleResponse(res);
  },

  getReceiptPdfUrl: (id: number) =>
    `${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/transactions/${id}/pdf`,

  // Report: Trial Balance
  getTrialBalance: async (companyId: number) => {
    const res = await apiFetch("/accounting/reports/balance-sheet");
    return handleResponse(res);
  },

  // Report: Profit & Loss
  getProfitLoss: async (companyId: number, start: string, end: string) => {
    const res = await apiFetch(
      `/accounting/reports/profit-loss?start_date=${start}&end_date=${end}`,
    );
    return handleResponse(res);
  },

  // Bank Accounts - use ledger groups
  getBankAccounts: async (companyId: number) => {
    // No dedicated bank accounts endpoint; return empty
    return { data: [] };
  },

  getBankTransactions: async (companyId: number, bankId: number) => {
    return { data: [] };
  },

  reconcileBank: async (companyId: number, bankId: number) => {
    return { data: { matched_count: 0 } };
  },
};
