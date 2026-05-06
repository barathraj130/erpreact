
import React, { useState, useEffect } from "react";
import { FaSave, FaCheckCircle, FaFileInvoice, FaEye } from "react-icons/fa";
import { apiFetch } from "../utils/api";

const BillFormatSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    business_name: "",
    address: "",
    gstin: "",
    phone: "",
    email: "",
    bill_title: "Tax Invoice",
    show_hsn: true,
    show_gst_breakup: true,
    show_barcode: true,
    show_branch_name: true,
    footer_message: "Thank you for your business!",
    paper_size: "A4"
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await apiFetch("/billing-config/format");
        if (res.ok) {
          const data = await res.json();
          if (data && Object.keys(data).length > 0) {
             setSettings({
                 business_name: data.business_name || "",
                 address: data.address || "",
                 gstin: data.gstin || "",
                 phone: data.phone || "",
                 email: data.email || "",
                 bill_title: data.bill_title || "Tax Invoice",
                 show_hsn: data.show_hsn !== false,
                 show_gst_breakup: data.show_gst_breakup !== false,
                 show_barcode: data.show_barcode !== false,
                 show_branch_name: data.show_branch_name !== false,
                 footer_message: data.footer_message || "Thank you for your business!",
                 paper_size: data.paper_size || "A4"
             });
          }
        }
      } catch (err) {
        console.error("Failed to load bill format settings");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/billing-config/format", {
        method: "POST",
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "40px" }}>Loading settings...</div>;

  return (
    <div className="db-page" style={{ padding: "30px", background: "#f8fafc" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, fontWeight: 900, color: "#0f172a", fontSize: "1.75rem", display: "flex", alignItems: "center", gap: "10px" }}>
              <FaFileInvoice color="#4f46e5" /> Bill Format Settings
            </h1>
            <p style={{ color: "#64748b", marginTop: "5px" }}>Configure how bills look for all your branches</p>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ 
               padding: "12px 24px", 
               borderRadius: "12px", 
               background: "#4f46e5", 
               color: "#fff", 
               border: "none", 
               fontWeight: 800, 
               display: "flex", 
               alignItems: "center", 
               gap: "8px",
               cursor: "pointer",
               boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)"
            }}
          >
            {saving ? "Saving..." : success ? <><FaCheckCircle /> Saved!</> : <><FaSave /> Save Settings</>}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "30px" }}>
           
           {/* Left Form */}
           <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                 <h3 style={{ margin: "0 0 20px 0", fontWeight: 800, color: "#1e293b", fontSize: "1.1rem" }}>Company Details</h3>
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                       <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Business Name</label>
                       <input name="business_name" value={settings.business_name} onChange={handleChange} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                       <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Address</label>
                       <textarea name="address" value={settings.address} onChange={handleChange} rows={2} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", resize: "none" }} />
                    </div>
                    <div>
                       <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>GSTIN</label>
                       <input name="gstin" value={settings.gstin} onChange={handleChange} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                    </div>
                    <div>
                       <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Phone Number</label>
                       <input name="phone" value={settings.phone} onChange={handleChange} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                       <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Email Address</label>
                       <input type="email" name="email" value={settings.email} onChange={handleChange} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                    </div>
                 </div>
              </div>

              <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                 <h3 style={{ margin: "0 0 20px 0", fontWeight: 800, color: "#1e293b", fontSize: "1.1rem" }}>Print Preferences</h3>
                 <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                       <div>
                          <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Paper Size</label>
                          <select name="paper_size" value={settings.paper_size} onChange={handleChange} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#f8fafc" }}>
                             <option value="A4">A4 / A5 Standard</option>
                             <option value="Thermal80">Thermal 80mm</option>
                             <option value="Thermal58">Thermal 58mm</option>
                          </select>
                       </div>
                       <div>
                          <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Bill Title</label>
                          <input name="bill_title" value={settings.bill_title} onChange={handleChange} placeholder="e.g. Tax Invoice" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                       </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "10px" }}>
                       {[
                         { name: "show_hsn", label: "Show HSN Code" },
                         { name: "show_gst_breakup", label: "Show GST Breakup (CGST/SGST)" },
                         { name: "show_barcode", label: "Show Barcode" },
                         { name: "show_branch_name", label: "Show Branch Name" },
                       ].map(opt => (
                         <label key={opt.name} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 700, color: "#334155", fontSize: "0.9rem" }}>
                            <input 
                              type="checkbox" 
                              name={opt.name} 
                              checked={(settings as any)[opt.name]} 
                              onChange={handleChange}
                              style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                            />
                            {opt.label}
                         </label>
                       ))}
                    </div>

                    <div style={{ marginTop: "10px" }}>
                       <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>Footer Message (Thank You Note)</label>
                       <input name="footer_message" value={settings.footer_message} onChange={handleChange} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                    </div>
                 </div>
              </div>
           </div>

           {/* Right Preview */}
           <div style={{ background: "#f1f5f9", borderRadius: "20px", padding: "30px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", color: "#64748b", fontWeight: 800 }}>
                 <FaEye /> Live Preview
              </div>
              <div style={{ background: "#fff", padding: "40px", borderRadius: "4px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", minHeight: "500px", position: "relative" }}>
                 {/* Preview content based on settings */}
                 <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "20px", marginBottom: "20px" }}>
                    <h2 style={{ margin: "0 0 5px 0", fontSize: "1.5rem", fontWeight: 900 }}>{settings.business_name || "BUSINESS NAME"}</h2>
                    <div style={{ fontSize: "0.85rem", color: "#333", whiteSpace: "pre-wrap" }}>{settings.address || "123 Business Street, City, State - 123456"}</div>
                    {settings.phone && <div style={{ fontSize: "0.85rem", color: "#333", marginTop: "5px" }}>Ph: {settings.phone}</div>}
                    {settings.email && <div style={{ fontSize: "0.85rem", color: "#333" }}>Email: {settings.email}</div>}
                    {settings.gstin && <div style={{ fontSize: "0.85rem", color: "#333", fontWeight: 700, marginTop: "5px" }}>GSTIN: {settings.gstin}</div>}
                 </div>

                 <div style={{ textAlign: "center", fontWeight: 900, fontSize: "1.2rem", marginBottom: "20px", textTransform: "uppercase" }}>
                    {settings.bill_title || "Tax Invoice"}
                 </div>

                 {settings.show_branch_name && (
                   <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "20px" }}>Branch: Main Hub</div>
                 )}

                 <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse", marginBottom: "20px" }}>
                    <thead>
                       <tr style={{ borderBottom: "1px solid #000" }}>
                          <th style={{ textAlign: "left", padding: "5px 0" }}>Item</th>
                          {settings.show_hsn && <th style={{ textAlign: "left", padding: "5px 0" }}>HSN</th>}
                          <th style={{ textAlign: "right", padding: "5px 0" }}>Qty</th>
                          <th style={{ textAlign: "right", padding: "5px 0" }}>Amount</th>
                       </tr>
                    </thead>
                    <tbody>
                       <tr>
                          <td style={{ padding: "8px 0" }}>Sample Product</td>
                          {settings.show_hsn && <td style={{ padding: "8px 0" }}>1234</td>}
                          <td style={{ textAlign: "right", padding: "8px 0" }}>2</td>
                          <td style={{ textAlign: "right", padding: "8px 0" }}>₹500.00</td>
                       </tr>
                    </tbody>
                 </table>

                 {settings.show_gst_breakup && (
                   <div style={{ fontSize: "0.8rem", textAlign: "right", marginBottom: "20px" }}>
                      <div>CGST (9%): ₹45.00</div>
                      <div>SGST (9%): ₹45.00</div>
                   </div>
                 )}

                 <div style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000", padding: "10px 0", display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "1.2rem", marginBottom: "40px" }}>
                    <span>TOTAL</span>
                    <span>₹590.00</span>
                 </div>

                 <div style={{ textAlign: "center", fontSize: "0.9rem", fontWeight: 700 }}>
                    {settings.footer_message || "Thank you!"}
                 </div>

                 {settings.show_barcode && (
                    <div style={{ textAlign: "center", marginTop: "30px", opacity: 0.5 }}>
                       <div style={{ height: "40px", background: "repeating-linear-gradient(90deg, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 5px, transparent 5px, transparent 8px)", width: "60%", margin: "0 auto" }}></div>
                       <div style={{ fontSize: "0.7rem", marginTop: "5px", letterSpacing: "2px" }}>INV-001</div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BillFormatSettings;
