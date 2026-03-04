import axios from 'axios';

const API_URL = 'http://127.0.0.1:5001/api/finance';

export const financeApi = {
    setupCompany: (companyId: number) => axios.post(`${API_URL}/setup`, { company_id: companyId }),
    getAccounts: (companyId: number) => axios.get(`${API_URL}/accounts`, { params: { company_id: companyId } }),
    getLoans: (companyId: number) => axios.get(`${API_URL}/loans`, { params: { company_id: companyId } }),
    createLoan: (data: any) => axios.post(`${API_URL}/loans`, data),
    createCashReceipt: (data: any) => axios.post(`${API_URL}/cash-receipt`, data),
    getTrialBalance: (companyId: number) => axios.get(`${API_URL}/reports/trial-balance`, { params: { company_id: companyId } }),
    getProfitLoss: (companyId: number, start: string, end: string) => axios.get(`${API_URL}/reports/profit-loss`, { params: { company_id: companyId, start_date: start, end_date: end } }),
    getReceiptPdfUrl: (id: number) => `${API_URL}/cash-receipt/${id}/pdf`,
    getBankAccounts: (companyId: number) => axios.get(`${API_URL}/bank/accounts`, { params: { company_id: companyId } }),
    getBankTransactions: (companyId: number, bankId: number) => axios.get(`${API_URL}/bank/transactions`, { params: { company_id: companyId, bank_account_id: bankId } }),
    reconcileBank: (companyId: number, bankId: number) => axios.post(`${API_URL}/bank/reconcile`, { company_id: companyId, bank_account_id: bankId }),
};
