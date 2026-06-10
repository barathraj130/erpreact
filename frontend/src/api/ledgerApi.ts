// frontend/src/api/ledgerApi.ts
import { apiFetch } from "../utils/api";

export interface Ledger {
  id: number;
  name: string;
  group_name: string;
  opening_balance: number;
  is_dr: boolean;
  current_balance: number;
}

export interface LedgerGroup {
  id: number;
  name: string;
  nature: string;
}

export const fetchLedgers = async (): Promise<Ledger[]> => {
  const res = await apiFetch("/ledger");
  return res.json();
};

export const fetchLedgerGroups = async (): Promise<LedgerGroup[]> => {
  const res = await apiFetch("/ledger/groups");
  return res.json();
};

export const fetchLedgerReport = async (
  id: number,
): Promise<{
  ledger: Ledger;
  transactions: any[];
  opening_balance: number;
}> => {
  const res = await apiFetch(`/ledger/report/${id}`);
  return res.json();
};

export const checkClosingStatus = async (date: string) => {
  const res = await apiFetch(`/ledger-closing/status/${date}`);
  return res.json();
};

export const closeDayLedger = async (date: string, notes: string = "") => {
  const res = await apiFetch("/ledger-closing/close", {
    method: "POST",
    body: { date, notes },
  });
  return res.json();
};
