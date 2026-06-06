import React, { useEffect, useState } from "react";
import {
  FaBuilding,
  FaEnvelope,
  FaIdCard,
  FaLock,
  FaMapMarkerAlt,
  FaMoneyCheckAlt,
  FaPhone,
  FaSave,
  FaTag,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import { createCustomer, updateCustomer } from "../api/userApi";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: any;
}

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#ffffff",
    width: window.innerWidth <= 600 ? "95%" : "100%",
    maxWidth: "600px",
    borderRadius: "12px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    maxHeight: "90vh",
    fontFamily: "Inter, sans-serif",
    margin: window.innerWidth <= 600 ? "10px" : "0",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flexShrink: 0,
  },
  body: {
    padding: "24px",
    overflowY: "auto" as const,
    flexGrow: 1,
  },
  footer: {
    padding: "16px 24px",
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "#f8fafc",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexShrink: 0,
  },
  title: {
    fontSize: "1.15rem",
    fontWeight: 700,
    color: "#1e293b",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    fontSize: "1.2rem",
    display: "flex",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "12px",
    marginTop: "20px",
    borderBottom: "1px dashed #e2e8f0",
    paddingBottom: "4px",
  },
  inputGroup: { marginBottom: "16px" },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#1e293b", /* Darker */
  },

  inputWrapper: { position: "relative" as const },
  icon: {
    position: "absolute" as const,
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
    pointerEvents: "none" as const,
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "10px 12px 10px 38px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "0.9rem",
    color: "#1e293b",
    backgroundColor: "#fff",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
  },
  row: (isMobile: boolean) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
    gap: isMobile ? "12px" : "16px",
  }),

  btnSecondary: {
    padding: "10px 24px",
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#475569",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  btnPrimary: {
    padding: "10px 28px",
    borderRadius: "999px",
    border: "none",
    background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

const InputField = ({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  disabled = false,
}: any) => (
  <div style={styles.inputGroup}>
    <label style={styles.label}>
      {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
    </label>
    <div style={styles.inputWrapper}>
      <div style={styles.icon}>
        <Icon />
      </div>
      <input
        type={type}
        required={required}
        disabled={disabled}
        style={{
          ...styles.input,
          opacity: disabled ? 0.7 : 1,
          backgroundColor: disabled ? "#f1f5f9" : "#fff",
        }}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  </div>
);

const AddCustomerModal: React.FC<Props> = ({
  onClose,
  onSuccess,
  customerToEdit,
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [balanceType, setBalanceType] = useState<"receivable" | "advance">("receivable");

  const [formData, setFormData] = useState({
    username: "",
    nickname: "",
    email: "",
    phone: "",
    gstin: "",
    address_line1: "",
    city_pincode: "",
    state: "",
    state_code: "",
    bank_name: "",
    bank_account_no: "",
    bank_ifsc_code: "",
    opening_balance: 0,
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customerToEdit) {
      const bal = Number(customerToEdit.initial_balance || 0);
      setBalanceType(bal < 0 ? "advance" : "receivable");
      setFormData({
        username: customerToEdit.username || "",
        nickname: customerToEdit.nickname || "",
        email: customerToEdit.email || "",
        phone: customerToEdit.phone || "",
        gstin: customerToEdit.gstin || "",
        address_line1: customerToEdit.address_line1 || "",
        city_pincode: customerToEdit.city_pincode || "",
        state: customerToEdit.state || "",
        state_code: customerToEdit.state_code || "",
        bank_name: customerToEdit.bank_name || "",
        bank_account_no: customerToEdit.bank_account_no || "",
        bank_ifsc_code: customerToEdit.bank_ifsc_code || "",
        opening_balance: Math.abs(bal),
        password: "",
      });
    }
  }, [customerToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    if (!formData.username.trim()) {
      setErrMsg("Customer name is required.");
      return;
    }
    setLoading(true);
    try {
      // Advance payment = negative opening balance (company owes customer)
      const signedBalance = balanceType === "advance"
        ? -Math.abs(formData.opening_balance)
        : Math.abs(formData.opening_balance);
      const payload = { ...formData, opening_balance: signedBalance };

      if (customerToEdit) {
        await updateCustomer(customerToEdit.id, payload);
      } else {
        await createCustomer(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrMsg(err.message || "Operation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <div
              style={{
                background: "#eff6ff",
                padding: "8px",
                borderRadius: "6px",
                color: "#2563eb",
                display: "flex",
              }}
            >
              <FaUser />
            </div>
            {customerToEdit ? "Edit Customer" : "Add New Customer"}
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <FaTimes />
          </button>
        </div>

        <div style={styles.body}>
          <form id="customer-form" onSubmit={handleSubmit}>
            {errMsg && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626",
                padding: "10px 14px", borderRadius: "8px", marginBottom: "14px",
                fontSize: "0.85rem", fontWeight: 500,
              }}>
                {errMsg}
              </div>
            )}
            {/* 1. BUSINESS NAME */}
            <div style={{ ...styles.sectionTitle, marginTop: 0 }}>
              Business Details
            </div>
            <InputField
              label="Customer / Business Name"
              icon={FaBuilding}
              value={formData.username}
              onChange={(e: any) => {
                const val = e.target.value;
                // Keep nickname in sync with business name so display always shows the new name
                setFormData({ ...formData, username: val, nickname: val });
              }}
              placeholder="e.g. Acme Corp Pvt Ltd"
              required
            />

            {/* 2. PORTAL LOGIN (✅ NEW GREEN BOX) */}
            <div
              style={{
                background: "#f0fdf4",
                padding: "15px",
                borderRadius: "8px",
                border: "1px solid #bbf7d0",
                marginBottom: "20px",
                marginTop: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#166534",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaLock /> Customer Portal Access
              </div>
              <div style={styles.row(isMobile)}>
                {/* Read-only username for context */}
                <InputField
                  label="Login Username"
                  icon={FaUser}
                  value={formData.username}
                  disabled={true}
                  placeholder="Auto-filled"
                />

                {/* Password Field */}
                <InputField
                  label="Set/Reset Password"
                  icon={FaLock}
                  type="text"
                  value={formData.password}
                  onChange={(e: any) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter password"
                />
              </div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#166534",
                  margin: 0,
                  marginTop: "5px",
                }}
              >
                * The customer can use these credentials to log in to the
                portal.
              </p>
            </div>

            {/* 3. OTHER DETAILS */}
            <div style={styles.row(isMobile)}>
              <InputField
                label="Nickname / Alias"
                icon={FaTag}
                value={formData.nickname}
                onChange={(e: any) =>
                  setFormData({ ...formData, nickname: e.target.value })
                }
                placeholder="e.g. Shop 1"
              />
              <InputField
                label="Phone"
                icon={FaPhone}
                value={formData.phone}
                onChange={(e: any) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="98765..."
              />
            </div>
            <div style={styles.row(isMobile)}>
              <InputField
                label="GSTIN"
                icon={FaIdCard}
                value={formData.gstin}
                onChange={(e: any) => {
                  const gstin = e.target.value.toUpperCase();
                  const update: any = { gstin };
                  // Auto-detect state code from first 2 digits of GSTIN
                  if (gstin.length >= 2) {
                    const prefix = gstin.substring(0, 2);
                    if (/^\d{2}$/.test(prefix)) {
                      update.state_code = prefix;
                      const stateNames: Record<string, string> = {
                        '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
                        '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan',
                        '09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh',
                        '13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
                        '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand',
                        '21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
                        '25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
                        '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
                        '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
                        '36':'Telangana','37':'Andhra Pradesh (New)','38':'Ladakh',
                      };
                      if (stateNames[prefix]) update.state = stateNames[prefix];
                    }
                  }
                  setFormData({ ...formData, ...update });
                }}
                placeholder="33ABC... (state auto-detected)"
              />
              <InputField
                label="Email"
                icon={FaEnvelope}
                value={formData.email}
                onChange={(e: any) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="customer@example.com"
              />
            </div>

            {/* 4. BANK */}
            <div style={styles.sectionTitle}>Bank Account Details</div>
            <InputField
              label="Bank Name"
              icon={FaMoneyCheckAlt}
              value={formData.bank_name}
              onChange={(e: any) =>
                setFormData({ ...formData, bank_name: e.target.value })
              }
              placeholder="e.g. HDFC Bank"
            />
            <div style={styles.row(isMobile)}>
              <InputField
                label="Account Number"
                icon={FaTag}
                value={formData.bank_account_no}
                onChange={(e: any) =>
                  setFormData({ ...formData, bank_account_no: e.target.value })
                }
                placeholder="1234567890"
              />
              <InputField
                label="IFSC Code"
                icon={FaTag}
                value={formData.bank_ifsc_code}
                onChange={(e: any) =>
                  setFormData({ ...formData, bank_ifsc_code: e.target.value })
                }
                placeholder="HDFC000123"
              />
            </div>

            {/* 5. LOCATION */}
            <div style={styles.sectionTitle}>Location</div>
            <InputField
              label="Address Line 1"
              icon={FaMapMarkerAlt}
              value={formData.address_line1}
              onChange={(e: any) =>
                setFormData({ ...formData, address_line1: e.target.value })
              }
              placeholder="Street, Area"
            />
            <div style={styles.row(isMobile)}>
              <InputField
                label="City - Pincode"
                icon={FaMapMarkerAlt}
                value={formData.city_pincode}
                onChange={(e: any) =>
                  setFormData({ ...formData, city_pincode: e.target.value })
                }
                placeholder="Chennai - 600001"
              />
              {/* State dropdown — sets both state name and state_code for GST detection */}
              <div style={{ flex: 1 }}>
                <label style={{ ...styles.label, display: 'block', marginBottom: 6 }}>State (for GST)</label>
                <select
                  value={formData.state_code || '33'}
                  onChange={(e: any) => {
                    const stateNames: Record<string, string> = {
                      '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
                      '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan',
                      '09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh',
                      '13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
                      '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand',
                      '21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
                      '25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
                      '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
                      '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
                      '36':'Telangana','37':'Andhra Pradesh (New)','38':'Ladakh',
                    };
                    const code = e.target.value;
                    setFormData({ ...formData, state_code: code, state: stateNames[code] || formData.state });
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
                    borderRadius: '10px', fontSize: '13px', background: '#f8fafc', color: '#0f172a',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  {[
                    ['01','Jammu & Kashmir'],['02','Himachal Pradesh'],['03','Punjab'],['04','Chandigarh'],
                    ['05','Uttarakhand'],['06','Haryana'],['07','Delhi'],['08','Rajasthan'],
                    ['09','Uttar Pradesh'],['10','Bihar'],['11','Sikkim'],['12','Arunachal Pradesh'],
                    ['13','Nagaland'],['14','Manipur'],['15','Mizoram'],['16','Tripura'],
                    ['17','Meghalaya'],['18','Assam'],['19','West Bengal'],['20','Jharkhand'],
                    ['21','Odisha'],['22','Chhattisgarh'],['23','Madhya Pradesh'],['24','Gujarat'],
                    ['25','Daman & Diu'],['26','Dadra & Nagar Haveli'],['27','Maharashtra'],
                    ['28','Andhra Pradesh'],['29','Karnataka'],['30','Goa'],['31','Lakshadweep'],
                    ['32','Kerala'],['33','Tamil Nadu'],['34','Puducherry'],['35','Andaman & Nicobar'],
                    ['36','Telangana'],['37','Andhra Pradesh (New)'],['38','Ladakh'],
                  ].map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}{code === '33' ? ' ✓' : ''}</option>
                  ))}
                </select>
                {formData.state_code && formData.state_code !== '33' && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                    🔵 Inter-state — IGST will apply
                  </div>
                )}
                {(!formData.state_code || formData.state_code === '33') && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                    🟢 Intra-state — CGST + SGST will apply
                  </div>
                )}
              </div>
            </div>

            {/* 6. OPENING BALANCE */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                Opening Balance
              </div>

              {/* Toggle: Receivable vs Advance */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <button
                  type="button"
                  onClick={() => setBalanceType("receivable")}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                    border: balanceType === "receivable" ? "2px solid #2563eb" : "2px solid #e2e8f0",
                    background: balanceType === "receivable" ? "#eff6ff" : "#f8fafc",
                    color: balanceType === "receivable" ? "#1d4ed8" : "#64748b",
                    fontWeight: 700, fontSize: "13px", transition: "all 0.2s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>📋</span>
                  <span>Receivable</span>
                  <span style={{ fontSize: "11px", fontWeight: 400, color: balanceType === "receivable" ? "#3b82f6" : "#94a3b8" }}>
                    Customer owes you
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceType("advance")}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                    border: balanceType === "advance" ? "2px solid #16a34a" : "2px solid #e2e8f0",
                    background: balanceType === "advance" ? "#f0fdf4" : "#f8fafc",
                    color: balanceType === "advance" ? "#15803d" : "#64748b",
                    fontWeight: 700, fontSize: "13px", transition: "all 0.2s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>💵</span>
                  <span>Advance Payment</span>
                  <span style={{ fontSize: "11px", fontWeight: 400, color: balanceType === "advance" ? "#16a34a" : "#94a3b8" }}>
                    You owe the customer
                  </span>
                </button>
              </div>

              {/* Amount input */}
              <div style={{
                background: balanceType === "advance" ? "#f0fdf4" : "#f0f9ff",
                padding: "14px 16px", borderRadius: "10px",
                border: `1px solid ${balanceType === "advance" ? "#bbf7d0" : "#bae6fd"}`,
              }}>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px",
                  color: balanceType === "advance" ? "#15803d" : "#0369a1" }}>
                  {balanceType === "advance"
                    ? "💵 Advance Amount (credit to customer)"
                    : "📋 Receivable Amount (customer owes)"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem", fontWeight: "bold",
                    color: balanceType === "advance" ? "#16a34a" : "#0369a1" }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    style={{
                      ...styles.input, paddingLeft: "12px", textAlign: "right",
                      fontWeight: "bold", fontSize: "1.1rem",
                      backgroundColor: "#fff",
                      border: `1.5px solid ${balanceType === "advance" ? "#86efac" : "#7dd3fc"}`,
                    }}
                    value={formData.opening_balance}
                    onChange={(e) =>
                      setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                {customerToEdit && (
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#d97706", fontWeight: 600 }}>
                    ⚠️ Changing this will recalculate the customer's balance.
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnSecondary} type="button">
            Cancel
          </button>
          <button
            form="customer-form"
            type="submit"
            disabled={loading}
            style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              "Saving..."
            ) : (
              <>
                <FaSave />{" "}
                {customerToEdit ? "Update Customer" : "Save Customer"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerModal;
