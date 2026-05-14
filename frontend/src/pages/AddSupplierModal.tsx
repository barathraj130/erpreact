import React, { useState } from "react";
import { FaBuilding, FaEnvelope, FaMoneyBillWave, FaPhone, FaTimes } from "react-icons/fa";
import { createSupplier } from "../api/supplierApi";
import { apiFetch } from "../utils/api";

interface Supplier {
  id?: number;
  name?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  opening_balance?: number | string;
}

interface AddSupplierModalProps {
  onClose: () => void;
  onSuccess: () => void;
  supplier?: Supplier; // if provided → edit mode
}

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 10px 10px 35px", borderRadius: "6px", border: "1px solid #cbd5e1",
};
const iconStyle: React.CSSProperties = {
  position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#475569", marginBottom: "5px",
};

const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ onClose, onSuccess, supplier }) => {
  const isEdit = !!supplier?.id;
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    phone: supplier?.phone || "",
    email: supplier?.email || "",
    opening_balance: supplier?.opening_balance?.toString() || "",
    gstin: supplier?.gstin || "",
    address: supplier?.address || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        const res = await apiFetch(`/suppliers/${supplier!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        await createSupplier(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Failed to ${isEdit ? "update" : "create"} supplier: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "white", width: "500px", borderRadius: "12px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            {isEdit ? "Edit Supplier" : "Add New Supplier"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#64748b" }}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label style={lbl}>Supplier Name</label>
            <div style={{ position: "relative" }}>
              <FaBuilding style={iconStyle} />
              <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inp} placeholder="e.g. Global Tech Solutions" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={lbl}>Phone</label>
              <div style={{ position: "relative" }}>
                <FaPhone style={iconStyle} />
                <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={inp} placeholder="98765..." />
              </div>
            </div>
            <div>
              <label style={lbl}>Email</label>
              <div style={{ position: "relative" }}>
                <FaEnvelope style={iconStyle} />
                <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inp} placeholder="supplier@example.com" />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={lbl}>GSTIN (Optional)</label>
            <input value={formData.gstin} onChange={e => setFormData({ ...formData, gstin: e.target.value })} style={{ ...inp, paddingLeft: "10px" }} placeholder="e.g. 33AAAAA0000A1Z5" />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={lbl}>Address (Optional)</label>
            <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} style={{ ...inp, paddingLeft: "10px" }} placeholder="Street, City" />
          </div>

          {!isEdit && (
            <div style={{ marginBottom: "20px" }}>
              <label style={lbl}>Opening Balance (Payable)</label>
              <div style={{ position: "relative" }}>
                <FaMoneyBillWave style={{ ...iconStyle, color: "#ef4444" }} />
                <input type="number" value={formData.opening_balance} onChange={e => setFormData({ ...formData, opening_balance: e.target.value })} style={inp} placeholder="0.00" />
              </div>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Amount you already owe to this supplier.</p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 20px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "white", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Supplier")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSupplierModal;
