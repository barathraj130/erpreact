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

  // Loans
  getLoans: async () => {
    const res = await apiFetch("/loans");
    return handleResponse(res);
  },

  createLoan: async (data: any) => {
    const res = await apiFetch("/loans", {
      method: "POST",
      body: data,
    });
    return handleResponse(res);
  },

  recordLoanRepayment: async (data: any) => {
    const res = await apiFetch("/loans/repayment", {
      method: "POST",
      body: data,
    });
    return handleResponse(res);
  },

  getLoanSummary: async () => {
    const res = await apiFetch("/loans/summary");
    return handleResponse(res);
  },

  // Chit Funds
  getChitGroups: async () => {
    const res = await apiFetch("/chit-fund/groups");
    return handleResponse(res);
  },

  createChitGroup: async (data: any) => {
    const res = await apiFetch("/chit-fund/groups", {
      method: "POST",
      body: data,
    });
    return handleResponse(res);
  },

  getChitInstallments: async (groupId: number) => {
    const res = await apiFetch(`/chit-fund/installments/${groupId}`);
    return handleResponse(res);
  },

  recordChitInstallment: async (data: any) => {
    const res = await apiFetch("/chit-fund/installments", {
      method: "POST",
      body: data,
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
    `${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/transactions/${id}/pdf`,

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
    const res = await apiFetch("/bank-accounts"); // Assuming this exists or using generic ledger search
    return handleResponse(res);
  },

  // Bank Reconciliation
  getBankTransactions: async (companyId: number, bankAccountId: number) => {
    const res = await apiFetch(`/bank-ledger?company_id=${companyId}&bank_account_id=${bankAccountId}`);
    return handleResponse(res);
  },

  reconcileBank: async (companyId: number, bankAccountId: number) => {
    const res = await apiFetch(`/bank-reconciliation/auto`, {
      method: "POST",
      body: { company_id: companyId, bank_account_id: bankAccountId },
    });
    return handleResponse(res);
  },
};
