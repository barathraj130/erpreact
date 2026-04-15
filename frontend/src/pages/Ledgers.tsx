import React, { useEffect, useState } from "react";
import { FaPlus, FaSearch, FaBook, FaFingerprint, FaMoneyBillWave, FaBuilding, FaWallet, FaFilter, FaTimes } from "react-icons/fa";
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

  const computeBalance = (entries: LedgerEntry[], opening: number) => {
    return opening + entries.reduce((acc, entry) => {
      const amt = Number(entry.amount) || 0;
      return entry.direction === "in" ? acc + amt : acc - amt;
    }, 0);
  };

  const cashBalance = computeBalance(cashEntries, cashOpeningBalance);
  const bankBalance = computeBalance(bankEntries, bankOpeningBalance);
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

  const renderEntries = (entries: LedgerEntry[], type: "CASH"|"BANK", opening: number) => {
    let runningBalance = opening;
    const rows = entries.map((entry, idx) => {
      const amt = Number(entry.amount) || 0;
      if (entry.direction === "in") runningBalance += amt;
      else runningBalance -= amt;
      const dateStr = new Date(entry.date || entry.created_at).toLocaleDateString('en-IN');
      return (
        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
          <td style={{ padding: "16px", color: "#64748b" }}>{dateStr}</td>
          <td style={{ padding: "16px", fontWeight: 500, textTransform: "capitalize" }}>{entry.source}</td>
          {type === "BANK" && (
            <td style={{ padding: "16px" }}>
              <div style={{ fontWeight: 600 }}>{entry.bank_name || "-"}</div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>{entry.transaction_id || ""}</div>
            </td>
          )}
          <td style={{ padding: "16px", color: "#10b981", fontWeight: 600, textAlign: "right" }}>
            {entry.direction === "in" ? `₹${amt.toLocaleString("en-IN", {minimumFractionDigits:2})}` : "-"}
          </td>
          <td style={{ padding: "16px", color: "#ef4444", fontWeight: 600, textAlign: "right" }}>
            {entry.direction === "out" ? `₹${amt.toLocaleString("en-IN", {minimumFractionDigits:2})}` : "-"}
          </td>
          <td style={{ padding: "16px", fontWeight: 800, textAlign: "right", color: runningBalance < 0 ? "#ef4444" : "#1e293b" }}>
            ₹{runningBalance.toLocaleString("en-IN", {minimumFractionDigits:2})}
          </td>
        </tr>
      );
    });
    const openingRow = (
      <tr key="opening_balance" style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
        <td colSpan={type === "BANK" ? 3 : 2} style={{ padding: "16px", fontWeight: 700, color: "#475569" }}>Balance b/d (Opening Balance)</td>
        <td style={{ padding: "16px" }}></td>
        <td style={{ padding: "16px" }}></td>
        <td style={{ padding: "16px", fontWeight: 800, textAlign: "right", color: opening < 0 ? "#ef4444" : "#1e293b" }}>
            ₹{opening.toLocaleString("en-IN", {minimumFractionDigits:2})}
        </td>
      </tr>
    );
    return [openingRow, ...rows];
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
            <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <FaFilter color="#94a3b8" size={14} />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: "14px", fontWeight: 600, color: "#334155" }} />
              <span style={{ color: "#cbd5e1" }}>–</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: "14px", fontWeight: 600, color: "#334155" }} />
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
