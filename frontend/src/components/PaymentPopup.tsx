
import React, { useState, useEffect } from "react";
import { FaMobileAlt, FaUniversity, FaTimes, FaCopy, FaCheckCircle, FaBuilding } from "react-icons/fa";
import { apiFetch } from "../utils/api";

interface PaymentPopupProps {
  amount: number;
  onClose: () => void;
  onConfirm: (method: string, details?: any) => void;
}

const PaymentPopup: React.FC<PaymentPopupProps> = ({ amount, onClose, onConfirm }) => {
  const [qrs, setQrs] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"QR" | "BANK">("QR");
  const [selectedQR, setSelectedQR] = useState<any>(null);
  const [expandedBank, setExpandedBank] = useState<number | null>(null);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const res = await apiFetch("/payment-methods");
        if (res.ok) {
          const data = await res.json();
          setQrs(data.qrs || []);
          setBanks(data.banks || []);
          
          if (data.qrs && data.qrs.length > 0) {
            setSelectedQR(data.qrs[0]);
            setActiveTab("QR");
          } else if (data.banks && data.banks.length > 0) {
            setActiveTab("BANK");
          }
        }
      } catch (err) {
        console.error("Failed to fetch payment methods", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMethods();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
        <div style={{ background: "#fff", padding: "40px", borderRadius: "20px", width: "400px", textAlign: "center", fontWeight: 800, color: "#64748b" }}>
          Loading Payment Methods...
        </div>
      </div>
    );
  }

  const hasQRs = qrs.length > 0;
  const hasBanks = banks.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "450px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
        
        {/* Header */}
        <div style={{ padding: "25px 30px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "5px" }}>Receive Payment</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a" }}>₹{amount.toLocaleString()}</div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}>
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "30px" }}>
          
          {/* Method Tabs */}
          {hasQRs && hasBanks && (
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "12px", padding: "6px", marginBottom: "25px" }}>
              <button 
                onClick={() => setActiveTab("QR")}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: activeTab === "QR" ? "#fff" : "transparent", color: activeTab === "QR" ? "#4f46e5" : "#64748b", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: activeTab === "QR" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}
              >
                <FaMobileAlt /> UPI / QR
              </button>
              <button 
                onClick={() => setActiveTab("BANK")}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: activeTab === "BANK" ? "#fff" : "transparent", color: activeTab === "BANK" ? "#4f46e5" : "#64748b", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: activeTab === "BANK" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}
              >
                <FaUniversity /> Bank Transfer
              </button>
            </div>
          )}

          {(!hasQRs && !hasBanks) && (
             <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontWeight: 700 }}>
                No digital payment methods configured.<br/><br/>
                Please ask the Main Admin to set up QR codes or Bank Accounts in Admin Setup.
             </div>
          )}

          {/* QR View */}
          {activeTab === "QR" && hasQRs && selectedQR && (
            <div>
              {/* Mini Tabs for Multiple QRs */}
              {qrs.length > 1 && (
                <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "20px", paddingBottom: "5px" }}>
                  {qrs.map(qr => (
                    <button 
                      key={qr.id}
                      onClick={() => setSelectedQR(qr)}
                      style={{ padding: "8px 16px", borderRadius: "100px", border: "1px solid", borderColor: selectedQR.id === qr.id ? "#4f46e5" : "#e2e8f0", background: selectedQR.id === qr.id ? "#e0e7ff" : "#fff", color: selectedQR.id === qr.id ? "#4f46e5" : "#64748b", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px", textAlign: "center" }}>
                {selectedQR.image_url ? (
                  <img src={selectedQR.image_url} alt="QR Code" style={{ width: "200px", height: "200px", objectFit: "contain", marginBottom: "20px", borderRadius: "12px", border: "1px solid #f1f5f9", padding: "10px" }} />
                ) : (
                   <div style={{ width: "200px", height: "200px", margin: "0 auto 20px", background: "#f8fafc", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #cbd5e1", color: "#94a3b8" }}>No Image Provided</div>
                )}
                
                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>UPI ID</div>
                    <div style={{ fontSize: "1rem", fontWeight: 900, color: "#1e293b" }}>{selectedQR.upi_id}</div>
                  </div>
                  <button onClick={() => copyToClipboard(selectedQR.upi_id)} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", padding: "8px", borderRadius: "8px" }} title="Copy UPI ID">
                    <FaCopy size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BANK View */}
          {activeTab === "BANK" && hasBanks && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {banks.map(bank => (
                <div key={bank.id} style={{ border: expandedBank === bank.id ? "2px solid #4f46e5" : "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", transition: "all 0.2s" }}>
                  <div 
                    onClick={() => setExpandedBank(expandedBank === bank.id ? null : bank.id)}
                    style={{ padding: "20px", background: expandedBank === bank.id ? "#f8fafc" : "#fff", display: "flex", alignItems: "center", gap: "15px", cursor: "pointer" }}
                  >
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FaBuilding size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, color: "#1e293b" }}>{bank.bank_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700 }}>{bank.account_type} Account</div>
                    </div>
                  </div>
                  
                  {expandedBank === bank.id && (
                    <div style={{ padding: "0 20px 20px", background: "#f8fafc" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", borderTop: "1px dashed #cbd5e1", paddingTop: "15px" }}>
                         
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>Holder</span>
                            <span style={{ fontWeight: 800, color: "#0f172a" }}>{bank.holder_name}</span>
                         </div>
                         
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>Account No</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                               <span style={{ fontWeight: 800, color: "#0f172a", fontFamily: "monospace", fontSize: "1rem" }}>{bank.account_number}</span>
                               <FaCopy color="#4f46e5" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); copyToClipboard(bank.account_number); }} />
                            </div>
                         </div>
                         
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>IFSC Code</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                               <span style={{ fontWeight: 800, color: "#0f172a", fontFamily: "monospace", fontSize: "1rem" }}>{bank.ifsc_code}</span>
                               <FaCopy color="#4f46e5" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); copyToClipboard(bank.ifsc_code); }} />
                            </div>
                         </div>

                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{ padding: "20px 30px", borderTop: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "15px", background: "#fff" }}>
           <button onClick={onClose} style={{ padding: "15px", borderRadius: "12px", border: "2px solid #e2e8f0", background: "transparent", color: "#64748b", fontWeight: 800, cursor: "pointer" }}>Cancel</button>
           <button 
              onClick={() => onConfirm(activeTab === "QR" ? "UPI" : "Bank Transfer", activeTab === "QR" ? selectedQR : null)} 
              disabled={(!hasQRs && !hasBanks)}
              style={{ padding: "15px", borderRadius: "12px", border: "none", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.3)" }}
           >
              <FaCheckCircle /> Payment Received
           </button>
        </div>

      </div>
    </div>
  );
};

export default PaymentPopup;
