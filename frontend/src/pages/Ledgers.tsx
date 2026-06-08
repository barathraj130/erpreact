import React, { useEffect, useState } from "react";
import { FaPlus, FaSearch, FaBook, FaFingerprint, FaMoneyBillWave, FaBuilding, FaWallet, FaFilter, FaTimes, FaBalanceScale } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../utils/api";
import "./finance/Finance.css";
import "./PageShared.css";
import CustomSelect from "../components/CustomSelect";

interface LedgerEntry {
  id: number;
  source: string;
  amount: number;
  direction: string; // 'in' or 'out'
  date: string;
  bank_name?: string;
  transaction_id?: string;
  created_at: string;
}

interface Account {
  id: number;
  account_code: string;
  name: string;
  account_type: string;
  current_balance: string;
}

const Ledgers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"CASH" | "BANK" | "ACCOUNTS">("CASH");
  const [cashEntries, setCashEntries] = useState<LedgerEntry[]>([]);
  const [bankEntries, setBankEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [cashOpeningBalance, setCashOpeningBalance] = useState<number>(0);
  const [bankOpeningBalance, setBankOpeningBalance] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showModal, setShowModal] = useState(false);
  const [newAccount, setNewAccount] = useState({
    account_code: "",
    name: "",
    account_type: "ASSET",
    opening_balance: 0,
  });

  // ── Cash Reconciliation ──
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileDate, setReconcileDate] = useState(today);
  const [reconcileActual, setReconcileActual] = useState("");
  const [reconcileNotes, setReconcileNotes] = useState("");
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "ACCOUNTS") {
        const response = await apiFetch("/accounting/accounts");
        const data = await response.json();
        if (response.ok) setAccounts(data);
      } else {
        const qs = `?startDate=${startDate}&endDate=${endDate}`;
        const [cashRes, bankRes] = await Promise.all([
          apiFetch(`/ledger/cash${qs}`),
          apiFetch(`/ledger/bank${qs}`)
        ]);
        const cashData = await cashRes.json();
        const bankData = await bankRes.json();
        
        setCashEntries(cashData.entries || []);
        setCashOpeningBalance(Number(cashData.opening_balance) || 0);

        setBankEntries(bankData.entries || []);
        setBankOpeningBalance(Number(bankData.opening_balance) || 0);
      }
    } catch (err) {
      console.error("Failed to fetch ledgers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, activeTab]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch("/accounting/accounts", {
        method: "POST",
        body: newAccount,
      });
      if (response.ok) {
        setShowModal(false);
        fetchData();
        setNewAccount({ account_code: "", name: "", account_type: "ASSET", opening_balance: 0 });
      }
    } catch (error) {
      console.error("Error saving account:", error);
    }
  };

  // Closing balance for the visible date range = opening + net of shown entries
  const computeClosingBalance = (entries: LedgerEntry[], opening: number) =>
    opening + entries.reduce((acc, e) => {
      const amt = Number(e.amount) || 0;
      return e.direction === "in" ? acc + amt : acc - amt;
    }, 0);

  const cashBalance = computeClosingBalance(cashEntries, cashOpeningBalance);
  const bankBalance = computeClosingBalance(bankEntries, bankOpeningBalance);
  const totalBalance = cashBalance + bankBalance;

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    acc.account_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "ASSET": return "status-success";
      case "LIABILITY": return "status-error";
      case "EXPENSE": return "status-warning";
      default: return "";
    }
  };

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const colSpan = (type: "CASH" | "BANK") => type === "BANK" ? 6 : 5;

  const renderEntries = (entries: LedgerEntry[], type: "CASH" | "BANK", opening: number) => {
    // Group entries by calendar date (YYYY-MM-DD)
    const groups: Record<string, LedgerEntry[]> = {};
    entries.forEach(e => {
      const key = (e.date || e.created_at || "").slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });

    const rows: React.ReactNode[] = [];
    let runningBalance = opening;

    // If no entries, just show opening row
    if (Object.keys(groups).length === 0) {
      rows.push(
        <tr key="ob" style={{ background: "#eff6ff", borderTop: "2px solid #bfdbfe" }}>
          <td colSpan={colSpan(type)} style={{ padding: "14px 16px", fontWeight: 700, color: "#1d4ed8" }}>
            Balance b/d (Opening Balance)
          </td>
          <td style={{ padding: "14px 16px", fontWeight: 800, textAlign: "right", color: "#1d4ed8" }}>
            {fmt(opening)}
          </td>
        </tr>
      );
      return rows;
    }

    Object.entries(groups).forEach(([dateKey, dayEntries], gi) => {
      const displayDate = fmtDate(dateKey);

      // Balance b/d row — blue header for this day
      rows.push(
        <tr key={`bd-${gi}`} style={{ background: "#eff6ff", borderTop: "2px solid #bfdbfe" }}>
          <td colSpan={colSpan(type)} style={{ padding: "12px 16px", fontWeight: 700, color: "#1d4ed8", fontSize: "13px" }}>
            Balance b/d &nbsp;·&nbsp; {displayDate}
          </td>
          <td style={{ padding: "12px 16px", fontWeight: 800, textAlign: "right", color: runningBalance < 0 ? "#ef4444" : "#1d4ed8" }}>
            {fmt(runningBalance)}
          </td>
        </tr>
      );

      // Transaction rows for this day
      dayEntries.forEach((entry, idx) => {
        const amt = Number(entry.amount) || 0;
        if (entry.direction === "in") runningBalance += amt;
        else runningBalance -= amt;

        const isReconcile = entry.source === "CASH_RECONCILIATION";
        rows.push(
          <tr key={`${gi}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9", background: isReconcile ? "#faf5ff" : "white" }}>
            <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "13px" }}>
              {fmtDate(entry.date || entry.created_at)}
            </td>
            <td style={{ padding: "14px 16px", fontWeight: 500 }}>
              {isReconcile ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ background: "#ede9fe", color: "#6d28d9", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", letterSpacing: "0.04em" }}>RECONCILED</span>
                  <span style={{ color: "#6d28d9", fontWeight: 600 }}>Cash Reconciliation</span>
                </span>
              ) : sourceLabel(entry.source)}
            </td>
            {type === "BANK" && (
              <td style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600 }}>{(entry as any).bank_name || "-"}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{(entry as any).transaction_id || ""}</div>
              </td>
            )}
            <td style={{ padding: "14px 16px", color: isReconcile && entry.direction === "in" ? "#7c3aed" : "#10b981", fontWeight: 600, textAlign: "right" }}>
              {entry.direction === "in" ? fmt(amt) : "-"}
            </td>
            <td style={{ padding: "14px 16px", color: isReconcile && entry.direction === "out" ? "#7c3aed" : "#ef4444", fontWeight: 600, textAlign: "right" }}>
              {entry.direction === "out" ? fmt(amt) : "-"}
            </td>
            <td style={{ padding: "14px 16px", fontWeight: 800, textAlign: "right", color: runningBalance < 0 ? "#ef4444" : "#1e293b" }}>
              {fmt(runningBalance)}
            </td>
          </tr>
        );
      });

      // Closing Balance row — green footer for this day
      rows.push(
        <tr key={`cb-${gi}`} style={{ background: "#f0fdf4", borderBottom: "2px solid #bbf7d0" }}>
          <td colSpan={colSpan(type)} style={{ padding: "12px 16px", fontWeight: 700, color: "#15803d", fontSize: "13px" }}>
            Closing Balance &nbsp;·&nbsp; {displayDate}
          </td>
          <td style={{ padding: "12px 16px", fontWeight: 800, textAlign: "right", color: runningBalance < 0 ? "#ef4444" : "#15803d" }}>
            {fmt(runningBalance)}
          </td>
        </tr>
      );
    });

    return rows;
  };

  // ── Reconciliation submit ──
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileActual || isNaN(Number(reconcileActual)) || Number(reconcileActual) < 0) {
      setReconcileMsg({ type: "error", text: "Please enter a valid actual cash amount (≥ 0)" });
      return;
    }
    setReconcileLoading(true);
    setReconcileMsg(null);
    try {
      const res = await apiFetch("/ledger/cash-reconciliation", {
        method: "POST",
        body: { date: reconcileDate, actual_cash: Number(reconcileActual), notes: reconcileNotes.trim() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save reconciliation");
      setReconcileMsg({ type: "success", text: data.message });
      setReconcileActual("");
      setReconcileNotes("");
      // Reload the ledger to show the new entry
      await fetchData();
    } catch (err: any) {
      setReconcileMsg({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setReconcileLoading(false);
    }
  };

  // ── Source label helper ──
  const sourceLabel = (source: string) => {
    const map: Record<string, string> = {
      OPENING_BALANCE: "Opening Balance",
      RECEIPT: "Receipt",
      INVOICE: "Invoice",
      EXPENSE: "Expense",
      SALARY: "Salary",
      WAGES: "Wages",
      GIFT_CONTRIBUTION: "Gift / Contribution",
      LOAN_RECEIVED: "Loan Received",
      LOAN_DISBURSEMENT: "Loan Disbursement",
      CASH_RECONCILIATION: "Cash Reconciliation",
      Payment: "Payment",
      payment: "Payment",
    };
    return map[source] || source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="page-container" style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "24px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
            {activeTab === "ACCOUNTS" ? "Chart of Accounts" : "Financial Ledgers"}
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>
            {activeTab === "ACCOUNTS" ? "Maintain the structural ledger for your organization." : "Real-time tracking for Cash and Bank Balances."}
          </p>
        </div>
        
        {activeTab !== "ACCOUNTS" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: "8px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <FaFilter color="#94a3b8" size={14} />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: "14px", fontWeight: 600, color: "#334155" }} />
                <span style={{ color: "#cbd5e1" }}>–</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: "14px", fontWeight: 600, color: "#334155" }} />
              </div>
              {activeTab === "CASH" && (
                <button
                  onClick={() => { setShowReconcile(v => !v); setReconcileMsg(null); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "12px", background: showReconcile ? "#7c3aed" : "#ede9fe", color: showReconcile ? "white" : "#7c3aed", border: "1.5px solid #c4b5fd", fontWeight: 700, fontSize: "13px", cursor: "pointer", transition: "all 0.2s" }}
                >
                  <FaBalanceScale size={13} /> Reconcile Cash
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "ACCOUNTS" && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "12px" }}>
            <FaPlus size={12} /> New Ledger Account
          </button>
        )}
      </div>

      {activeTab !== "ACCOUNTS" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderRadius: "20px", padding: "20px", border: "1px solid #bfdbfe", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden", animation: "ledgerFadeIn 0.5s ease-out forwards", opacity: 0, transform: "translateY(20px)" }}>
            <style>{`@keyframes ledgerFadeIn { to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ position: "absolute", top: "-30%", left: "-30%", width: "160%", height: "160%", background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)", filter: "blur(12px)", opacity: 0.3, animation: "ledgerShimmer 2.5s ease-in-out infinite" }} />
            <style>{`@keyframes ledgerShimmer { 0%, 100% { transform: translate(0, 0); opacity: 0.3; } 50% { transform: translate(10%, 10%); opacity: 0.5; } }`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Balance</span>
              <FaWallet size={16} color="#3b82f6" />
            </div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>₹{totalBalance.toLocaleString("en-IN", {minimumFractionDigits: 2})}</div>
          </div>
          <div style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", borderRadius: "20px", padding: "20px", border: "1px solid #a7f3d0", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden", animation: "ledgerFadeIn 0.5s ease-out forwards", opacity: 0, transform: "translateY(20px)", animationDelay: "0.1s" }}>
            <div style={{ position: "absolute", top: "-30%", left: "-30%", width: "160%", height: "160%", background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)", filter: "blur(12px)", opacity: 0.3, animation: "ledgerShimmer 2.5s ease-in-out infinite" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cash in Hand</span>
              <FaMoneyBillWave size={16} color="#10b981" />
            </div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: cashBalance < 0 ? "#ef4444" : "#0f172a", letterSpacing: "-0.5px" }}>₹{cashBalance.toLocaleString("en-IN", {minimumFractionDigits: 2})}</div>
          </div>
          <div style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", borderRadius: "20px", padding: "20px", border: "1px solid #fed7aa", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden", animation: "ledgerFadeIn 0.5s ease-out forwards", opacity: 0, transform: "translateY(20px)", animationDelay: "0.2s" }}>
            <div style={{ position: "absolute", top: "-30%", left: "-30%", width: "160%", height: "160%", background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)", filter: "blur(12px)", opacity: 0.3, animation: "ledgerShimmer 2.5s ease-in-out infinite" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Bank Balance</span>
              <FaBuilding size={16} color="#f97316" />
            </div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: bankBalance < 0 ? "#ef4444" : "#0f172a", letterSpacing: "-0.5px" }}>₹{bankBalance.toLocaleString("en-IN", {minimumFractionDigits: 2})}</div>
          </div>
        </div>
      )}

      {/* ── Cash Reconciliation Panel ── */}
      <AnimatePresence>
        {showReconcile && activeTab === "CASH" && (
          <motion.div
            key="reconcile-panel"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            style={{ background: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)", border: "1.5px solid #c4b5fd", borderRadius: "20px", padding: "24px", marginBottom: "24px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaBalanceScale size={16} color="#7c3aed" />
                  <span style={{ fontWeight: 700, fontSize: "16px", color: "#4c1d95" }}>Daily Cash Reconciliation</span>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#7c3aed" }}>
                  Record the difference between computer balance and actual physical cash count.
                </p>
              </div>
              <button onClick={() => setShowReconcile(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", padding: "4px" }}>
                <FaTimes size={16} />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "160px 1fr 1fr", gap: "16px", alignItems: "end", marginBottom: "16px" }}>
                {/* Date */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#6d28d9", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</label>
                  <input
                    type="date"
                    value={reconcileDate}
                    onChange={e => setReconcileDate(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #c4b5fd", background: "white", fontSize: "14px", fontWeight: 600, color: "#1e293b", boxSizing: "border-box" }}
                  />
                </div>
                {/* Computer Balance (read-only) */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#6d28d9", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Computer Says</label>
                  <div style={{ padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #c4b5fd", background: "#f3e8ff", fontSize: "15px", fontWeight: 800, color: "#4c1d95" }}>
                    ₹{cashBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#8b5cf6" }}>Closing balance for selected date range</p>
                </div>
                {/* Actual cash input */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#6d28d9", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actual Cash Count</label>
                  <input
                    type="number"
                    placeholder="e.g. 300"
                    min="0"
                    step="0.01"
                    value={reconcileActual}
                    onChange={e => setReconcileActual(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #c4b5fd", background: "white", fontSize: "14px", fontWeight: 600, color: "#1e293b", boxSizing: "border-box" }}
                    required
                  />
                </div>
              </div>

              {/* Live variance preview */}
              {reconcileActual !== "" && !isNaN(Number(reconcileActual)) && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "12px", marginBottom: "16px",
                  background: Number(reconcileActual) > cashBalance ? "#f0fdf4" : Number(reconcileActual) < cashBalance ? "#fef2f2" : "#f0fdf4",
                  border: `1.5px solid ${Number(reconcileActual) > cashBalance ? "#bbf7d0" : Number(reconcileActual) < cashBalance ? "#fecaca" : "#bbf7d0"}`,
                }}>
                  <span style={{ fontSize: "20px" }}>
                    {Number(reconcileActual) > cashBalance ? "📈" : Number(reconcileActual) < cashBalance ? "📉" : "✅"}
                  </span>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: Number(reconcileActual) > cashBalance ? "#15803d" : Number(reconcileActual) < cashBalance ? "#dc2626" : "#15803d" }}>
                      {Number(reconcileActual) === cashBalance
                        ? "✓ Cash matches — no adjustment needed"
                        : Number(reconcileActual) > cashBalance
                          ? `Cash Excess: ₹${(Number(reconcileActual) - cashBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} extra in hand`
                          : `Cash Shortage: ₹${(cashBalance - Number(reconcileActual)).toLocaleString("en-IN", { minimumFractionDigits: 2 })} less than expected`}
                    </span>
                    {Number(reconcileActual) !== cashBalance && (
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        Will be recorded as a {Number(reconcileActual) > cashBalance ? "cash IN (+)" : "cash OUT (−)"} adjustment entry
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes + Submit */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: "12px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#6d28d9", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Short change from counter, error in yesterday's count..."
                    value={reconcileNotes}
                    onChange={e => setReconcileNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #c4b5fd", background: "white", fontSize: "14px", color: "#1e293b", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={reconcileLoading}
                  style={{ padding: "10px 24px", borderRadius: "12px", background: reconcileLoading ? "#c4b5fd" : "#7c3aed", color: "white", border: "none", fontWeight: 700, fontSize: "14px", cursor: reconcileLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                >
                  {reconcileLoading ? "Saving…" : "Save Reconciliation"}
                </button>
              </div>

              {reconcileMsg && (
                <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px", background: reconcileMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${reconcileMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`, color: reconcileMsg.type === "success" ? "#15803d" : "#dc2626", fontWeight: 600, fontSize: "13px" }}>
                  {reconcileMsg.type === "success" ? "✓ " : "⚠ "}{reconcileMsg.text}
                </div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        {["CASH", "BANK", "ACCOUNTS"].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{ 
              padding: "10px 24px", 
              borderRadius: "100px", 
              background: activeTab === tab ? "#1e293b" : "transparent",
              color: activeTab === tab ? "white" : "#64748b",
              fontWeight: 600,
              border: activeTab === tab ? "none" : "1px solid #cbd5e1",
              cursor: "pointer"
            }}
          >
            {tab === "ACCOUNTS" ? "Chart of Accounts" : `${tab.charAt(0) + tab.slice(1).toLowerCase()} Ledger`}
          </button>
        ))}
      </div>

      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>
        ) : activeTab === "ACCOUNTS" ? (
          <div style={{ padding: "24px" }}>
            <div style={{ marginBottom: "20px", position: "relative", maxWidth: "400px" }}>
              <FaSearch style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} size={14} />
              <input type="text" placeholder="Search accounts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "10px 14px 10px 42px", borderRadius: "10px", border: "1.5px solid #e2e8f0" }} />
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ padding: "16px", textAlign: "left" }}>Code</th>
                  <th style={{ padding: "16px", textAlign: "left" }}>Account Name</th>
                  <th style={{ padding: "16px", textAlign: "left" }}>Type</th>
                  <th style={{ padding: "16px", textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map(account => (
                  <tr key={account.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px", fontFamily: "monospace" }}>{account.account_code}</td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{account.name}</td>
                    <td style={{ padding: "16px" }}><span className={`status-badge ${getTypeStyle(account.account_type)}`}>{account.account_type}</span></td>
                    <td style={{ padding: "16px", textAlign: "right", fontWeight: 700 }}>₹{Math.abs(parseFloat(account.current_balance)).toLocaleString("en-IN", { minimumFractionDigits: 2 })} {parseFloat(account.current_balance) >= 0 ? "DR" : "CR"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ padding: "16px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "16px", textAlign: "left" }}>Source</th>
                  {activeTab === "BANK" && <th style={{ padding: "16px", textAlign: "left" }}>Bank Details</th>}
                  <th style={{ padding: "16px", textAlign: "right" }}>In (+)</th>
                  <th style={{ padding: "16px", textAlign: "right" }}>Out (-)</th>
                  <th style={{ padding: "16px", textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === "CASH" ? renderEntries(cashEntries, "CASH", cashOpeningBalance) : renderEntries(bankEntries, "BANK", bankOpeningBalance)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="modal-content" style={{ maxWidth: "500px" }}>
              <div className="modal-header">
                <span className="text-header">Create New Ledger Account</span>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}><FaTimes /></button>
              </div>
              <form onSubmit={handleSaveAccount}>
                <div className="modal-body">
                  <div className="form-group"><label>Account Code</label><input type="text" className="form-input" required value={newAccount.account_code} onChange={(e) => setNewAccount({ ...newAccount, account_code: e.target.value })} /></div>
                  <div className="form-group"><label>Account Name</label><input type="text" className="form-input" required value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} /></div>
                  <div className="form-group">
                    <label>Type</label>
                    <CustomSelect value={newAccount.account_type} onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}>
                      <option value="ASSET">ASSET</option>
                      <option value="LIABILITY">LIABILITY</option>
                      <option value="EQUITY">EQUITY</option>
                      <option value="INCOME">INCOME</option>
                      <option value="EXPENSE">EXPENSE</option>
                    </CustomSelect>
                  </div>
                  <div className="form-group"><label>Opening Balance</label><input type="number" className="form-input" value={newAccount.opening_balance} onChange={(e) => setNewAccount({ ...newAccount, opening_balance: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Account</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ledgers;
