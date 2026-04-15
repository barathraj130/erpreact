import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { fetchTransactions, Transaction } from "../api/transactionApi";
import { checkClosingStatus, closeDayLedger } from "../api/ledgerApi";
import { FaCalendarAlt, FaChartLine, FaHistory, FaReceipt, FaLock, FaLockOpen } from "react-icons/fa";
import "./DayBook.css";

const DayBook: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [closingInProgress, setClosingInProgress] = useState(false);

  const loadData = async (selectedDate: string) => {
    setLoading(true);
    try {
      const [tData, cStatus] = await Promise.all([
        fetchTransactions(),
        checkClosingStatus(selectedDate)
      ]);
      const filtered = tData.filter((t) => t.date.slice(0, 10) === selectedDate);
      setTransactions(filtered);
      setIsClosed(cStatus.is_closed);
    } catch (err) {
      console.error("Failed to load Day Book:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    if (!window.confirm("Are you sure you want to close the ledger for this day? This will calculate closing balances and lock the records.")) return;
    
    setClosingInProgress(true);
    try {
      const res = await closeDayLedger(date, "Manual closure from Day Book");
      if (res.success) {
        setIsClosed(true);
        alert("Day ledger closed successfully.");
      } else {
        alert("Error: " + res.error);
      }
    } catch (err) {
      alert("Failed to close ledger.");
    } finally {
      setClosingInProgress(false);
    }
  };

  useEffect(() => {
    loadData(date);
  }, [date]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalDebit = transactions.reduce(
    (sum, t) =>
      sum + (t.type === "BILL" || t.type === "PAYMENT" ? Number(t.amount) : 0),
    0,
  );
  const totalCredit = transactions.reduce(
    (sum, t) =>
      sum +
      (t.type === "INVOICE" || t.type === "RECEIPT" ? Number(t.amount) : 0),
    0,
  );

  return (
    <div
      className="daybook-container"
      style={{ padding: window.innerWidth < 768 ? "10px" : "0" }}
    >
      {/* Header - Mobile Responsive */}
      <header
        className="daybook-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexDirection: window.innerWidth < 768 ? "column" : "row",
          alignItems: window.innerWidth < 768 ? "flex-start" : "center",
          marginBottom: "0",
          padding: window.innerWidth < 768 ? "10px 10px 20px 10px" : "10px",
          fontFamily: "'Satoshi', sans-serif"
        }}
      >
        <div className="daybook-title">
          <motion.h1
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.4px", lineHeight: 1.3, margin: 0, color: "#111110" }}
          >
            Day Book
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}
          >
            Records for:{" "}
            {new Date(date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="date-selector-glass"
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            padding: "10px 20px",
            borderRadius: "100px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            width: window.innerWidth < 768 ? "100%" : "auto",
            justifyContent: "center",
          }}
        >
          <FaCalendarAlt style={{ color: "#6366F1" }} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              outline: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
              width: window.innerWidth < 768 ? "auto" : "100%",
            }}
          />
        </motion.div>

        <div style={{ display: "flex", gap: "10px", marginTop: window.innerWidth < 768 ? "10px" : "0" }}>
          {isClosed ? (
            <div style={{ 
              display: "flex", alignItems: "center", gap: "8px", 
              background: "#F0FDF4", color: "#16A34A", 
              padding: "8px 16px", borderRadius: "100px", 
              fontSize: "13px", fontWeight: 700, border: "1px solid #BBF7D0" 
            }}>
              <FaLock size={12} /> Day Closed
            </div>
          ) : (
            <button 
              onClick={handleCloseDay}
              disabled={closingInProgress}
              style={{ 
                display: "flex", alignItems: "center", gap: "8px", 
                background: "#6366F1", color: "#fff", 
                padding: "8px 20px", borderRadius: "100px", 
                fontSize: "13px", fontWeight: 700, border: "none",
                cursor: "pointer", opacity: closingInProgress ? 0.7 : 1
              }}
            >
              <FaLockOpen size={12} /> {closingInProgress ? "Closing..." : "Close Day Ledger"}
            </button>
          )}
        </div>
      </header>

      {/* Stats Matrix - Responsive rows */}
      <div
        className="ledger-matrix"
        style={{
          display: "grid",
          gridTemplateColumns: window.innerWidth < 768 ? "1fr" : "1fr 1fr",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="ledger-stat-card debit"
          style={{
            background: "#fff",
            border: "1px solid #f1f5f9",
            borderRadius: "32px",
            padding: window.innerWidth < 768 ? "20px" : "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                padding: "10px",
                background: "#FEF2F2",
                borderRadius: "12px",
                color: "#EF4444",
              }}
            >
              <FaChartLine />
            </div>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "#94a3b8",
                letterSpacing: "0.1em",
              }}
            >
              Total Expenditure
            </span>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: window.innerWidth < 768 ? "1.5rem" : "1.8rem",
              fontWeight: 700,
              color: "#1E293B",
            }}
          >
            {formatCurrency(totalDebit)}
          </h3>
          <div
            style={{
              marginTop: "20px",
              height: "6px",
              background: "#FEE2E2",
              borderRadius: "100px",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{ height: "100%", background: "#EF4444" }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="ledger-stat-card credit"
          style={{
            background: "#fff",
            border: "1px solid #f1f5f9",
            borderRadius: "32px",
            padding: window.innerWidth < 768 ? "20px" : "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                padding: "10px",
                background: "#ECFDF5",
                borderRadius: "12px",
                color: "#10B981",
              }}
            >
              <FaReceipt />
            </div>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "#94a3b8",
                letterSpacing: "0.1em",
              }}
            >
              Total Collections
            </span>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: window.innerWidth < 768 ? "1.5rem" : "1.8rem",
              fontWeight: 700,
              color: "#1E293B",
            }}
          >
            {formatCurrency(totalCredit)}
          </h3>
          <div
            style={{
              marginTop: "20px",
              height: "6px",
              background: "#D1FAE5",
              borderRadius: "100px",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{ height: "100%", background: "#10B981" }}
            />
          </div>
        </motion.div>
      </div>

      {/* Table Area */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="daybook-table-wrapper"
      >
        {loading || transactions.length > 0 ? (
          <table className="day-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Debit (Dr)</th>
                <th style={{ textAlign: "right" }}>Credit (Cr)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: "80px", textAlign: "center" }}
                  >
                    <div
                      className="skeleton"
                      style={{ height: "40px", borderRadius: "12px" }}
                    ></div>
                  </td>
                </tr>
              ) : (
              transactions.map((t, idx) => {
                const isCredit = t.type === "INVOICE" || t.type === "RECEIPT";
                return (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + idx * 0.05 }}
                    className="tx-row"
                  >
                    <td>
                      <div className="tx-narration">{t.description}</div>
                      <div className="tx-entity">
                        {t.user_name || t.lender_name || "System"}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`type-pill ${isCredit ? "credit" : "debit"}`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {!isCredit ? (
                        <div className="val-debit">
                          {formatCurrency(t.amount)}
                        </div>
                      ) : (
                        <div className="val-empty">•</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {isCredit ? (
                        <div className="val-credit">
                          {formatCurrency(t.amount)}
                        </div>
                      ) : (
                        <div className="val-empty">•</div>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "80px 20px",
              textAlign: "center"
            }}
          >
            <FaHistory size={64} style={{ color: "var(--border-color)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "1.25rem" }}>
                No entries
              </h3>
              <p style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}>
                No transactions found for this date.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DayBook;
