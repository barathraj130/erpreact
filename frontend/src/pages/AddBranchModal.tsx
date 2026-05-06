import React, { useState } from "react";
import { FaTimes, FaSave, FaBuilding, FaMapMarkerAlt, FaPhoneAlt, FaUserTie, FaMoneyBillWave, FaLock, FaSync, FaPlus } from "react-icons/fa";
import { apiFetch } from "../utils/api";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

const AddBranchModal: React.FC<Props> = ({ onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    branch_name: initialData?.branch_name || "",
    branch_code: initialData?.branch_code || "",
    branch_type: initialData?.branch_type || "Main Branch",
    is_active: initialData?.is_active ?? true,
    address_line1: initialData?.address_line1 || "",
    address_line2: initialData?.address_line2 || "",
    city: initialData?.city || "",
    state: initialData?.state || "Tamil Nadu",
    pincode: initialData?.pincode || "",
    country: initialData?.country || "India",
    branch_phone: initialData?.branch_phone || "",
    branch_email: initialData?.branch_email || "",
    whatsapp_number: initialData?.whatsapp_number || "",
    manager_name: initialData?.manager_name || "",
    manager_phone: initialData?.manager_phone || "",
    manager_email: initialData?.manager_email || "",
    manager_whatsapp: initialData?.manager_whatsapp || "",
    gstin: initialData?.gstin || "",
    bill_prefix: initialData?.bill_prefix || "",
    opening_cash_balance: initialData?.opening_cash_balance || "0",
    default_payment_mode: initialData?.default_payment_mode || "Cash",
    login_email: initialData?.login_email || "",
    temporary_password: "",
    access_level: "Branch Staff"
  });

  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData(prev => ({ ...prev, temporary_password: pwd }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = initialData ? `/branches/${initialData.id}` : "/branches";
      const method = initialData ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save branch");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sectionHeaderStyle = {
    fontSize: "0.9rem",
    fontWeight: 800,
    color: "#1e293b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "20px",
    marginBottom: "15px",
    paddingBottom: "8px",
    borderBottom: "1px solid #e2e8f0"
  };

  const labelStyle = { display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 700, color: "#475569" };
  const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" as const, fontSize: "0.9rem" };

  return (
    <div style={{
      position: "fixed", inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000,
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "#ffffff", width: "100%", maxWidth: "800px", height: "90vh",
        borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        <div style={{ padding: "20px 30px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#1e293b", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#4f46e5", color: "white", padding: "8px", borderRadius: "8px", display: "flex" }}>
              <FaBuilding size={14} />
            </div>
            {initialData ? "Edit Branch" : "+ Add New Branch"}
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
            <FaTimes size={20} />
          </button>
        </div>

        <div style={{ padding: "0 30px 30px 30px", overflowY: "auto", flexGrow: 1 }}>
          <form id="add-branch-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            
            {/* BASIC INFO */}
            <div style={sectionHeaderStyle}><FaBuilding color="#64748b" /> Basic Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <label style={labelStyle}>Branch Name <span style={{ color: "#ef4444" }}>*</span></label>
                <input required value={formData.branch_name} onChange={e => updateForm("branch_name", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Branch Code <span style={{ color: "#ef4444" }}>*</span></label>
                <input required maxLength={5} value={formData.branch_code} onChange={e => updateForm("branch_code", e.target.value.toUpperCase())} style={inputStyle} placeholder="e.g. BR01" />
              </div>
              <div>
                <label style={labelStyle}>Branch Type</label>
                <select value={formData.branch_type} onChange={e => updateForm("branch_type", e.target.value)} style={inputStyle}>
                  <option>Main Branch</option>
                  <option>Sub Branch</option>
                  <option>Warehouse</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <div style={{ display: "flex", gap: "15px", paddingTop: "5px" }}>
                   <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.9rem", fontWeight: 600 }}>
                      <input type="radio" checked={formData.is_active} onChange={() => updateForm("is_active", true)} /> Active
                   </label>
                   <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.9rem", fontWeight: 600 }}>
                      <input type="radio" checked={!formData.is_active} onChange={() => updateForm("is_active", false)} /> Inactive
                   </label>
                </div>
              </div>
            </div>

            {/* LOCATION DETAILS */}
            <div style={sectionHeaderStyle}><FaMapMarkerAlt color="#64748b" /> Location Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label style={labelStyle}>Address Line 1 <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={formData.address_line1} onChange={e => updateForm("address_line1", e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Address Line 2</label>
                  <input value={formData.address_line2} onChange={e => updateForm("address_line2", e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <label style={labelStyle}>City <span style={{ color: "#ef4444" }}>*</span></label>
                    <input required value={formData.city} onChange={e => updateForm("city", e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>State <span style={{ color: "#ef4444" }}>*</span></label>
                    <select required value={formData.state} onChange={e => updateForm("state", e.target.value)} style={inputStyle}>
                      <option>Tamil Nadu</option><option>Kerala</option><option>Karnataka</option><option>Andhra Pradesh</option><option>Maharashtra</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>PIN Code <span style={{ color: "#ef4444" }}>*</span></label>
                    <input required maxLength={6} pattern="[0-9]{6}" value={formData.pincode} onChange={e => updateForm("pincode", e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input value={formData.country} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
                  </div>
                </div>
            </div>

            {/* CONTACT DETAILS */}
            <div style={sectionHeaderStyle}><FaPhoneAlt color="#64748b" /> Contact Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <label style={labelStyle}>Branch Phone <span style={{ color: "#ef4444" }}>*</span></label>
                <input required value={formData.branch_phone} onChange={e => updateForm("branch_phone", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Branch Email</label>
                <input type="email" value={formData.branch_email} onChange={e => updateForm("branch_email", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp Number</label>
                <input value={formData.whatsapp_number} onChange={e => updateForm("whatsapp_number", e.target.value)} style={inputStyle} placeholder="For stock request alerts" />
              </div>
            </div>

            {/* MANAGER DETAILS */}
            <div style={sectionHeaderStyle}><FaUserTie color="#64748b" /> Manager Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <label style={labelStyle}>Manager Name <span style={{ color: "#ef4444" }}>*</span></label>
                <input required value={formData.manager_name} onChange={e => updateForm("manager_name", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Manager Phone <span style={{ color: "#ef4444" }}>*</span></label>
                <input required pattern="[0-9]{10}" value={formData.manager_phone} onChange={e => updateForm("manager_phone", e.target.value)} style={inputStyle} placeholder="10-digit mobile" />
              </div>
              <div>
                <label style={labelStyle}>Manager Email</label>
                <input type="email" value={formData.manager_email} onChange={e => updateForm("manager_email", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Manager WhatsApp</label>
                <input value={formData.manager_whatsapp} onChange={e => updateForm("manager_whatsapp", e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* FINANCE SETTINGS */}
            <div style={sectionHeaderStyle}><FaMoneyBillWave color="#64748b" /> Billing & Finance Settings</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <label style={labelStyle}>GSTIN (if different)</label>
                <input value={formData.gstin} onChange={e => updateForm("gstin", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Bill Prefix <span style={{ color: "#ef4444" }}>*</span></label>
                <input required maxLength={4} value={formData.bill_prefix} onChange={e => updateForm("bill_prefix", e.target.value.toUpperCase())} style={inputStyle} placeholder="e.g. BR1" />
              </div>
              <div>
                <label style={labelStyle}>Opening Cash Balance (₹)</label>
                <input type="number" min="0" value={formData.opening_cash_balance} onChange={e => updateForm("opening_cash_balance", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Default Payment Mode</label>
                <select value={formData.default_payment_mode} onChange={e => updateForm("default_payment_mode", e.target.value)} style={inputStyle}>
                  <option>Cash</option><option>Bank</option><option>Wallet</option>
                </select>
              </div>
            </div>

            {/* ACCESS & LOGIN */}
            <div style={sectionHeaderStyle}><FaLock color="#64748b" /> Access & Login</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Login Email <span style={{ color: "#ef4444" }}>*</span></label>
                <input required type="email" value={formData.login_email} onChange={e => updateForm("login_email", e.target.value)} style={inputStyle} placeholder="For branch staff login" />
              </div>
              <div>
                <label style={labelStyle}>Temporary Password <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                    <input required value={formData.temporary_password} onChange={e => updateForm("temporary_password", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={generatePassword} style={{ background: "#e0e7ff", color: "#4f46e5", border: "none", padding: "0 15px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <FaSync /> Gen
                    </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Access Level</label>
                <select value={formData.access_level} onChange={e => updateForm("access_level", e.target.value)} style={inputStyle}>
                  <option>Branch Staff</option><option>Branch Manager</option>
                </select>
              </div>
            </div>

          </form>
        </div>

        <div style={{ padding: "20px 30px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc" }}>
          <button onClick={onClose} disabled={loading} style={{ padding: "12px 24px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700, color: "#475569", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" form="add-branch-form" disabled={loading} style={{ padding: "12px 24px", borderRadius: "10px", border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            {loading ? "Saving..." : <>{initialData ? <FaSave /> : <FaPlus />} {initialData ? "Save Changes" : "+ Create Branch"}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBranchModal;
