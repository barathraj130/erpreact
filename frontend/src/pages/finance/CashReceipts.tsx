import React, { useState, useEffect } from "react";
import { financeApi } from "./financeApi";
import "./Finance.css";
import { FaReceipt, FaMoneyCheckAlt } from "react-icons/fa";

const CashReceipts: React.FC = () => {
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const companyId = 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await financeApi.createCashReceipt({
        company_id: companyId,
        party_name: partyName,
        amount,
        purpose,
        created_by: 1,
      });
      alert("Cash Receipt Generated!");
      window.open(financeApi.getReceiptPdfUrl(res.data.id), "_blank");
      // Reset form
      setPartyName("");
      setAmount(0);
      setPurpose("");
    } catch (err) {
      console.error(err);
      alert("Failed to generate receipt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-container page-container">
      <header className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Cash Receipt Voucher</h1>
          <p className="text-body">Create legal evidence for cash collection and post entries to ledger.</p>
        </div>
      </header>

      <div className="card" style={{ maxWidth: "700px", margin: "0 auto" }}>
        <div className="card-header">
           <div className="card-icon"><FaReceipt size={14} /></div>
           Voucher Details
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group form-item-full">
            <label>Party Name / Remitter</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              placeholder="Full name of remitter"
              value={partyName} 
              onChange={(e) => setPartyName(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label>Receipt Amount (₹)</label>
            <input 
              type="number" 
              className="form-input" 
              required 
              placeholder="0.00"
              value={amount || ""} 
              onChange={(e) => setAmount(Number(e.target.value))} 
            />
          </div>
          <div className="form-group">
            <label>Transaction Purpose</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              placeholder="e.g. Advance against invoice #42"
              value={purpose} 
              onChange={(e) => setPurpose(e.target.value)} 
            />
          </div>
          <div className="form-item-full" style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ width: "100%", height: "48px", borderRadius: "12px", gap: "12px" }}
            >
              <FaMoneyCheckAlt /> {loading ? "Processing..." : "Generate Receipt & Close Voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashReceipts;
