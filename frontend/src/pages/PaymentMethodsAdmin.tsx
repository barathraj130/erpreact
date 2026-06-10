
import React, { useState, useEffect } from "react";
import { FaQrcode, FaUniversity, FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { apiFetch } from "../utils/api";

const PaymentMethodsAdmin: React.FC = () => {
  const [qrs, setQrs] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showQRModal, setShowQRModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  
  const [qrForm, setQrForm] = useState({ id: null, label: "", upi_id: "", is_active: true, image: null as File | null });
  const [bankForm, setBankForm] = useState({ id: null, bank_name: "", account_number: "", ifsc_code: "", holder_name: "", is_active: true });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [qrRes, bankRes] = await Promise.all([
        apiFetch("/payment-methods/qr"),
        apiFetch("/payment-methods/bank")
      ]);
      if (qrRes.ok) setQrs(await qrRes.json());
      if (bankRes.ok) setBanks(await bankRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQRSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("label", qrForm.label);
    formData.append("upi_id", qrForm.upi_id);
    formData.append("is_active", String(qrForm.is_active));
    if (qrForm.image) formData.append("image", qrForm.image);

    try {
      const url = qrForm.id ? `/payment-methods/qr/${qrForm.id}` : "/payment-methods/qr";
      const res = await apiFetch(url, { method: qrForm.id ? "PUT" : "POST", body: formData });
      if (res.ok) {
        setShowQRModal(false);
        fetchData();
      }
    } catch (err) { alert("Failed to save QR code."); }
  };

  const handleBankSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = bankForm.id ? `/payment-methods/bank/${bankForm.id}` : "/payment-methods/bank";
      const res = await apiFetch(url, { 
        method: bankForm.id ? "PUT" : "POST", 
        body: JSON.stringify(bankForm)
      });
      if (res.ok) {
        setShowBankModal(false);
        fetchData();
      }
    } catch (err) { alert("Failed to save Bank Account."); }
  };

  const deleteQR = async (id: number) => {
    if (!window.confirm("Delete this QR Code?")) return;
    try {
      await apiFetch(`/payment-methods/qr/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) { alert("Failed to delete."); }
  };

  const deleteBank = async (id: number) => {
    if (!window.confirm("Delete this Bank Account?")) return;
    try {
      await apiFetch(`/payment-methods/bank/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) { alert("Failed to delete."); }
  };

  return (
    <div className="db-page" style={{ padding: "30px", background: "#f8fafc" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.75rem", color: "#0f172a" }}>Payment Methods</h1>
          <p style={{ color: "#64748b" }}>Manage QR codes and Bank Accounts available across all branches.</p>
        </div>

        {loading ? <div>Loading...</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
            
            {/* QR Codes Section */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "25px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}><FaQrcode color="#4f46e5" /> QR Codes</h2>
                <button onClick={() => { setQrForm({ id: null, label: "", upi_id: "", is_active: true, image: null }); setShowQRModal(true); }} className="db-btn db-btn-primary" style={{ padding: "8px 16px" }}><FaPlus /> Add QR</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px" }}>
                {qrs.map(qr => (
                  <div key={qr.id} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "15px", position: "relative", opacity: qr.is_active ? 1 : 0.6 }}>
                    {qr.image_url && <img src={qr.image_url} alt={qr.label} style={{ width: "100%", height: "120px", objectFit: "contain", marginBottom: "10px", background: "#f8fafc", borderRadius: "8px" }} />}
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1e293b" }}>{qr.label}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "10px" }}>{qr.upi_id}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {qr.is_active ? <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: 700 }}><FaCheckCircle /> Active</span> : <span style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700 }}><FaTimesCircle /> Inactive</span>}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => { setQrForm({ ...qr, image: null }); setShowQRModal(true); }} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer" }}><FaEdit /></button>
                        <button onClick={() => deleteQR(qr.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><FaTrash /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bank Accounts Section */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "25px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}><FaUniversity color="#f59e0b" /> Bank Accounts</h2>
                <button onClick={() => { setBankForm({ id: null, bank_name: "", account_number: "", ifsc_code: "", holder_name: "", is_active: true }); setShowBankModal(true); }} className="db-btn db-btn-primary" style={{ padding: "8px 16px" }}><FaPlus /> Add Bank</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {banks.map(bank => (
                  <div key={bank.id} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: bank.is_active ? 1 : 0.6 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1e293b" }}>{bank.bank_name} - {bank.holder_name}</div>
                      <div style={{ fontSize: "0.85rem", color: "#64748b", fontFamily: "monospace", marginTop: "4px" }}>A/C: {bank.account_number} | IFSC: {bank.ifsc_code}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                      {bank.is_active ? <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: 700 }}><FaCheckCircle /> Active</span> : <span style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700 }}><FaTimesCircle /> Inactive</span>}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => { setBankForm(bank); setShowBankModal(true); }} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer" }}><FaEdit /></button>
                        <button onClick={() => deleteBank(bank.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><FaTrash /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "30px", borderRadius: "20px", width: "400px" }}>
            <h2 style={{ marginTop: 0 }}>{qrForm.id ? "Edit QR Code" : "Add QR Code"}</h2>
            <form onSubmit={handleQRSave} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input required placeholder="Label (e.g. GPay, PhonePe)" value={qrForm.label} onChange={e => setQrForm({ ...qrForm, label: e.target.value })} className="erp-input" />
              <input required placeholder="UPI ID" value={qrForm.upi_id} onChange={e => setQrForm({ ...qrForm, upi_id: e.target.value })} className="erp-input" />
              <div>
                <label>QR Image</label>
                <input type="file" accept="image/*" onChange={e => setQrForm({ ...qrForm, image: e.target.files?.[0] || null })} className="erp-input" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" checked={qrForm.is_active} onChange={e => setQrForm({ ...qrForm, is_active: e.target.checked })} /> Active
              </label>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowQRModal(false)} className="db-btn" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="db-btn db-btn-primary" style={{ flex: 1 }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Modal */}
      {showBankModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "30px", borderRadius: "20px", width: "400px" }}>
            <h2 style={{ marginTop: 0 }}>{bankForm.id ? "Edit Bank Account" : "Add Bank Account"}</h2>
            <form onSubmit={handleBankSave} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input required placeholder="Bank Name (e.g. ICICI Bank)" value={bankForm.bank_name} onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} className="erp-input" />
              <input required placeholder="Account Holder Name" value={bankForm.holder_name} onChange={e => setBankForm({ ...bankForm, holder_name: e.target.value })} className="erp-input" />
              <input required placeholder="Account Number" value={bankForm.account_number} onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} className="erp-input" />
              <input required placeholder="IFSC Code" value={bankForm.ifsc_code} onChange={e => setBankForm({ ...bankForm, ifsc_code: e.target.value })} className="erp-input" />
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" checked={bankForm.is_active} onChange={e => setBankForm({ ...bankForm, is_active: e.target.checked })} /> Active
              </label>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowBankModal(false)} className="db-btn" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="db-btn db-btn-primary" style={{ flex: 1 }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodsAdmin;
