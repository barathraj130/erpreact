
import React, { useState, useEffect } from "react";
import { FaCog, FaFileUpload, FaPrint, FaImage, FaCheckCircle, FaSave } from "react-icons/fa";
import { apiFetch } from "../utils/api";

const BillFormatSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>({
    bill_title: "Tax Invoice",
    show_hsn: true,
    show_gst_breakup: true,
    show_barcode: true,
    show_branch_name: true,
    paper_size: "A4",
    business_name: "",
    address: "",
    gstin: "",
    phone: "",
    email: "",
    footer_message: "Thank you for your business!"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch("/billing-config/format");
        if (res.ok) {
          const data = await res.json();
          if (data.id) setSettings(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/billing-config/format", {
        method: "POST",
        body: JSON.stringify(settings)
      });
      if (res.ok) alert("Settings saved successfully!");
    } catch (err) {
      alert("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Loading settings...</div>;

  return (
    <div className="db-page" style={{ padding: "30px", background: "#f8fafc" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>Bill Format Settings</h1>
        <p style={{ color: "#64748b", marginBottom: "40px" }}>Configure how your sales invoices look across all branches.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "30px" }}>
          {/* Form */}
          <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>Company Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Business Name</label>
                  <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none" }} value={settings.business_name} onChange={e => setSettings({...settings, business_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>GSTIN</label>
                  <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none" }} value={settings.gstin} onChange={e => setSettings({...settings, gstin: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Address</label>
                  <textarea style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none", minHeight: "80px" }} value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Phone</label>
                  <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none" }} value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Email</label>
                  <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none" }} value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", fontWeight: 800 }}>Invoice Display Toggles</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                {[
                  { label: "Show HSN Code", key: "show_hsn" },
                  { label: "Show GST Breakup", key: "show_gst_breakup" },
                  { label: "Show Barcode", key: "show_barcode" },
                  { label: "Show Branch Name", key: "show_branch_name" },
                ].map(item => (
                  <label key={item.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", cursor: "pointer", border: "1px solid #e2e8f0" }}>
                    <input 
                      type="checkbox" 
                      style={{ width: "18px", height: "18px", accentColor: "#3b82f6", cursor: "pointer" }}
                      checked={settings[item.key]} 
                      onChange={e => setSettings({...settings, [item.key]: e.target.checked})} 
                    />
                    <span style={{ fontWeight: 600, color: "#475569", fontSize: "0.9rem" }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", fontWeight: 800 }}>Paper & Layout</h3>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Paper Size</label>
                <select style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none", cursor: "pointer" }} value={settings.paper_size} onChange={e => setSettings({...settings, paper_size: e.target.value})}>
                  <option value="A4">Standard A4</option>
                  <option value="A5">Standard A5</option>
                  <option value="Thermal 80mm">Thermal 80mm (Standard POS)</option>
                  <option value="Thermal 58mm">Thermal 58mm (Small POS)</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Footer Message</label>
                <input style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", background: "#f8fafc", outline: "none" }} value={settings.footer_message} onChange={e => setSettings({...settings, footer_message: e.target.value})} />
              </div>
            </div>

            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ width: "100%", background: "#4f46e5", color: "#fff", border: "none", padding: "18px", borderRadius: "12px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
            >
              {saving ? "Saving..." : <><FaSave /> Save Layout Config</>}
            </button>
          </div>

          {/* Preview */}
          <div style={{ position: "sticky", top: "30px", height: "fit-content" }}>
            <h3 style={{ margin: "0 0 15px", fontSize: "0.9rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 800 }}>Live Preview</h3>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: "20px", borderRadius: "4px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", minHeight: "500px", fontFamily: "'Courier New', Courier, monospace", fontSize: "12px" }}>
              <div style={{ textAlign: "center", marginBottom: "15px" }}>
                <div style={{ fontWeight: 800, fontSize: "14px" }}>{settings.business_name || "YOUR BUSINESS NAME"}</div>
                <div>{settings.address || "123, Street Name, City"}</div>
                {settings.gstin && <div>GST: {settings.gstin}</div>}
                {settings.show_branch_name && <div style={{ marginTop: "5px", fontSize: "10px", color: "#64748b" }}>[ Branch Name ]</div>}
              </div>
              <div style={{ textAlign: "center", fontWeight: 800, borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 0", margin: "10px 0" }}>
                {settings.bill_title.toUpperCase()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span>Bill: #B-001</span>
                <span>Date: 02/05/2026</span>
              </div>
              <div style={{ borderBottom: "1px dashed #000", paddingBottom: "5px", marginBottom: "5px", fontWeight: 800, display: "grid", gridTemplateColumns: "1fr 40px 60px" }}>
                <span>Item</span>
                <span style={{ textAlign: "center" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Amt</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 60px", marginBottom: "5px" }}>
                <span>Product A {settings.show_hsn && <span style={{ fontSize: "9px" }}>(HSN: 1234)</span>}</span>
                <span style={{ textAlign: "center" }}>1</span>
                <span style={{ textAlign: "right" }}>100.00</span>
              </div>
              <div style={{ borderTop: "1px solid #000", marginTop: "10px", paddingTop: "5px", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                <span>Total</span>
                <span>100.00</span>
              </div>
              {settings.show_gst_breakup && (
                <div style={{ fontSize: "10px", marginTop: "10px" }}>
                   CGST 9%: 9.00 | SGST 9%: 9.00
                </div>
              )}
              {settings.show_barcode && (
                <div style={{ textAlign: "center", marginTop: "30px" }}>
                   || ||| || ||| || ||| <br/> [ Barcode Preview ]
                </div>
              )}
              <div style={{ textAlign: "center", marginTop: "30px", fontSize: "10px", fontStyle: "italic" }}>
                {settings.footer_message}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillFormatSettings;
