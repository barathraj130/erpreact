import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import "./Finance.css";
import { FaPrint, FaDownload, FaChartPie, FaTable } from "react-icons/fa";

const FinancialReports: React.FC = () => {
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [pnL, setPnL] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const companyId = 1;

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [tb, pl] = await Promise.all([
          financeApi.getTrialBalance(companyId),
          financeApi.getProfitLoss(
            companyId,
            "2020-01-01",
            new Date().toISOString().split("T")[0],
          ),
        ]);
        setTrialBalance(tb.data);
        setPnL(pl.data);
      } catch (err) {
        console.error("Error fetching reports", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [companyId]);

  if (loading)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: "16px" }}>
        <div style={{ width: "40px", height: "40px", border: "4px solid #f1f5f9", borderTopColor: "var(--erp-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        <div className="text-label" style={{ letterSpacing: "0.1em" }}>GENERATING SYSTEM REPORTS...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  return (
    <div className="finance-container page-container">
      <header className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Financial Reports</h1>
          <p className="text-body">Review the consolidated financial statements for the current fiscal period.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
           <button className="btn btn-secondary"><FaDownload size={14} /> Export XLS</button>
           <button className="btn btn-primary" onClick={() => window.print()}><FaPrint size={14} /> Print Report</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "32px", alignItems: "start" }}>
        {/* Profit & Loss Statement */}
        <div className="card">
          <div className="card-header">
             <div className="card-icon"><FaChartPie size={14} /></div>
             Profit & Loss Statement
          </div>
          
          <div style={{ marginBottom: "24px" }}>
            <div className="text-label" style={{ marginBottom: "12px", borderLeft: "3px solid var(--erp-success)", paddingLeft: "10px" }}>Operating Income</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pnL?.income?.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span className="text-body">{item.name}</span>
                  <span className="text-bold">₹ {item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="text-right" style={{ marginTop: "12px", fontSize: "0.95rem", fontWeight: 700 }}>
              Total Revenue: <span style={{ color: "var(--erp-primary)" }}>₹ {pnL?.total_income?.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div className="text-label" style={{ marginBottom: "12px", borderLeft: "3px solid var(--erp-error)", paddingLeft: "10px" }}>Operating Expenses</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pnL?.expenses?.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span className="text-body">{item.name}</span>
                  <span className="text-bold" style={{ color: "var(--erp-error)" }}>₹ {item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="text-right" style={{ marginTop: "12px", fontSize: "0.95rem", fontWeight: 700 }}>
              Total Expenditure: <span style={{ color: "var(--erp-error)" }}>₹ {pnL?.total_expense?.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "20px", borderRadius: "16px", border: "1px solid rgba(16, 185, 129, 0.2)", textAlign: "center" }}>
            <span className="text-label">Consolidated Net Profit</span>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: pnL?.net_profit >= 0 ? "var(--erp-success)" : "var(--erp-error)", marginTop: "4px", letterSpacing: "-0.04em" }}>
              ₹ {pnL?.net_profit?.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Trial Balance */}
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--erp-border)", display: "flex", alignItems: "center", gap: "12px" }}>
             <div className="card-icon"><FaTable size={14} /></div>
             <span className="text-header" style={{ marginBottom: 0 }}>Trial Balance Summary</span>
          </div>
          <div className="table-container" style={{ border: "none", borderRadius: "0", boxShadow: "none" }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Account Nomenclature</th>
                  <th className="text-right">Debit (₹)</th>
                  <th className="text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance?.data?.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="text-body">{item.name}</td>
                    <td className="currency-cell" style={{ fontWeight: 500 }}>
                      {item.debit > 0 ? item.debit.toLocaleString() : "-"}
                    </td>
                    <td className="currency-cell" style={{ fontWeight: 500 }}>
                      {item.credit > 0 ? item.credit.toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#fdfdfd", fontWeight: 700 }}>
                <tr>
                  <td style={{ padding: "20px 24px" }}>CONSOLIDATED TOTAL</td>
                  <td className="text-right" style={{ padding: "20px 24px" }}>₹ {trialBalance?.total_debit?.toLocaleString()}</td>
                  <td className="text-right" style={{ padding: "20px 24px" }}>₹ {trialBalance?.total_credit?.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReports;
