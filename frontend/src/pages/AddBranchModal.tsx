import React, { useState } from "react";
import { FaTimes, FaBuilding, FaMapMarkerAlt, FaSave } from "react-icons/fa";
import { apiFetch } from "../utils/api";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const AddBranchModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    branch_name: "",
    branch_code: "",
    location: "",
    address_line1: "",
    city_pincode: "",
    state: "",
    state_code: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/branches", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create branch");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)",
      display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "#ffffff", width: "100%", maxWidth: "600px",
        borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <div style={{ background: "rgba(79, 70, 229, 0.1)", padding: "8px", borderRadius: "10px", color: "#4f46e5", display: "flex" }}>
              <FaBuilding size={16} />
            </div>
            Authorize New Node
          </h2>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FaTimes />
          </button>
        </div>

        <div style={{ padding: "28px", overflowY: "auto", flexGrow: 1 }}>
          <form id="add-branch-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>Branch Name <span style={{ color: "#ef4444" }}>*</span></label>
                <input required value={formData.branch_name} onChange={e => setFormData({ ...formData, branch_name: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} placeholder="e.g. Downtown Office" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>Branch Code</label>
                <input value={formData.branch_code} onChange={e => setFormData({ ...formData, branch_code: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} placeholder="e.g. BR-001" />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>Location</label>
              <div style={{ position: "relative" }}>
                 <FaMapMarkerAlt style={{ position: "absolute", left: "14px", top: "14px", color: "#94a3b8" }} />
                 <input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} placeholder="City, Area" />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>Address Line 1</label>
              <input value={formData.address_line1} onChange={e => setFormData({ ...formData, address_line1: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} placeholder="Full street address" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>City / Pincode</label>
                <input value={formData.city_pincode} onChange={e => setFormData({ ...formData, city_pincode: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>State</label>
                <input value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>State Code</label>
                <input value={formData.state_code} onChange={e => setFormData({ ...formData, state_code: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} placeholder="e.g. 33" />
              </div>
            </div>
          </form>
        </div>

        <div style={{ padding: "20px 28px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button onClick={onClose} disabled={loading} style={{ padding: "12px 24px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, color: "#475569", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" form="add-branch-form" disabled={loading} style={{ padding: "12px 24px", borderRadius: "10px", border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            {loading ? "Authorizing..." : <><FaSave /> Authorize Node</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBranchModal;
