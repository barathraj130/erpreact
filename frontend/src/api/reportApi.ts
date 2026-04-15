// frontend/src/api/reportApi.ts

import { apiFetch } from "../utils/api";

type ReportType =
  | "pnl_summary"
  | "trial_balance"
  | "cash_flow"
  | "full_disclosure"
  | "gst_r1"
  | "inventory_valuation";

/**
 * Fetches a financial report for a given period.
 * @param reportType The type of report to generate.
 * @param period A string representing the period (e.g., '2024-01-01' to '2024-03-31' or just '2024-05').
 */
export const fetchReport = async (
  reportType: ReportType,
  period: string,
): Promise<any> => {
  const res = await apiFetch(`/report/${reportType}?period=${period}`);
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `Failed to fetch report ${reportType}`);
  }
  return res.json();
};

/**
 * Exports a report as PDF or CSV.
 */
export const exportReport = async (
  reportType: ReportType,
  period: string,
  format: "pdf" | "csv",
): Promise<Blob> => {
  const res = await apiFetch(
    `/report/${reportType}/export?period=${period}&format=${format}`,
  );
  return res.blob();
};
