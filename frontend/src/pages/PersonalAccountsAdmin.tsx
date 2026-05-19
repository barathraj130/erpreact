import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaToggleOn, FaToggleOff, FaUniversity, FaMobileAlt, FaWallet, FaTimes, FaSync } from "react-icons/fa";
import "./PageShared.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n || 0));

interface PersonalAccount {
  id: number;
  account_name: string;
  account_type: "upi" | "bank" | "cash" | "other";
  upi_id?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  holder_name?: string;
  notes?: string;
  is_active: boolean;
  total_received?: number;
  total_paid?: number;
}

const defaultForm = {
  account_name: "",
  account_type: "upi" as PersonalAccount["account_type"],
  upi_id: "",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  holder_name: "",
  notes: "",
};

const AccountIcon: React.FC<{ type: PersonalAccount["account_type"] }> = ({ type }) => {
  if (type === "upi") return <FaMobileAlt size={20} color="#7c3aed" />;
  if (type === "bank") return <FaUniversity size={20} color="#1d4ed8" />;
  if (type === "cash") return <FaWallet size={20} color="#15803d" />;
  return <FaWallet size={20} color="#64748b" />;
};

const typeBg: Record<string, string> = { upi: "#f3e8ff", bank: "#dbeafe", cash: "#dcfce7", other: "#f1f5f9" };
const typeColor: Record<string, string> = { upi: "#7c3aed", bank: "#1d4ed8", cash: "#15803d", other: "#475569" };

const PersonalAccountsAdmin: React.FC = () => {
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/personal-accounts");
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditId(null); setForm({ ...defaultForm }); setShowModal(true); };
  const openEdit = (acc: PersonalAccount) => {
    setEditId(acc.id);
    setForm({ account_name: acc.account_name, account_type: acc.account_type, upi_id: acc.upi_id || "", bank_name: acc.bank_name || "", account_number: acc.account_number || "", ifsc_code: acc.ifsc_code || "", holder_name: acc.holder_name || "", notes: acc.notes || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { account_name: form.account_name, account_type: form.account_type, notes: form.notes };
      if (form.account_type === "upi") payload.upi_id = form.upi_id;
      if (form.account_type === "bank") { payload.bank_name = form.bank_name; payload.account_number = form.account_number; payload.ifsc_code = form.ifsc_code; payload.holder_name = form.holder_name; }

      await apiFetch(editId !== null ? `/personal-accounts/${editId}` : "/personal-accounts", {
        method: editId !== null ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setShowModal(false);
      load();
    } catch { alert("Failed to save account"); }
    finally { setSaving(false); }
  };

  const toggleActive = async (acc: PersonalAccount) => {
    try {
      await apiFetch(`/personal-accounts/${acc.id}`, { method: "PUT", body: JSON.stringify({ is_active: !acc.is_active }) });
      load();
    } catch { alert("Failed to toggle status"); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Personal Accounts</h1>
          <p>Manage UPI, bank, and cash accounts used for personal transactions.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={load}><FaSync className={loading ? "fa-spin" : ""} size={12} /></button>
          <button className="page-btn-round page-btn-round-primary" onClick={openAdd}><FaPlus size={11} /> Add Account</button>
        </div>
      </div>

      {loading && accounts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>Loading...</div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>No personal accounts yet. Click "+ Add Account" to get started.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {accounts.map((acc) => (
            <div key={acc.id} style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", opacity: acc.is_active ? 1 : 0.5, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: typeBg[acc.account_type] || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AccountIcon type={acc.account_type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a", marginBottom: "4px" }}>{acc.account_name}</div>
                  <span style={{ background: typeBg[acc.account_type], color: typeColor[acc.account_type], display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>{acc.account_type}</span>
                </div>
                {!acc.is_active && <span style={{ background: "#f1f5f9", color: "#94a3b8", fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", textTransform: "uppercase" }}>Disabled</span>}
              </div>

              {acc.account_type === "upi" && acc.upi_id && (
                <div style={{ marginBottom: "12px", padding: "10px 14px", background: "#faf5ff", borderRadius: "10px", fontSize: "13px" }}>
                  <span style={{ color: "#94a3b8", fontWeight: 600 }}>UPI ID: </span>
                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>{acc.upi_id}</span>
                </div>
              )}
              {acc.account_type === "bank" && (
                <div style={{ marginBottom: "12px", padding: "10px 14px", background: "#eff6ff", borderRadius: "10px", fontSize: "13px" }}>
                  {acc.bank_name && <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Bank: </span><span style={{ color: "#1d4ed8", fontWeight: 700 }}>{acc.bank_name}</span></div>}
                  {acc.account_number && <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Acc No: </span><span style={{ color: "#1e293b", fontWeight: 600 }}>{acc.account_number}</span></div>}
                  {acc.ifsc_code && <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>IFSC: </span><span style={{ color: "#1e293b", fontWeight: 600 }}>{acc.ifsc_code}</span></div>}
                  {acc.holder_name && <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Holder: </span><span style={{ color: "#1e293b", fontWeight: 600 }}>{acc.holder_name}</span></div>}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1, padding: "10px 14px", background: "#f0fdf4", borderRadius: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 700, textTransform: "uppercase" }}>Received</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#15803d" }}>{fmt(acc.total_received || 0)}</div>
                </div>
                <div style={{ flex: 1, padding: "10px 14px", background: "#fef2f2", borderRadius: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700, textTransform: "uppercase" }}>Paid</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#dc2626" }}>{fmt(acc.total_paid || 0)}</div>
                </div>
              </div>

              {acc.notes && <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px", fontStyle: "italic" }}>{acc.notes}</div>}

              <div style={{ display: "flex", gap: "10px" }}>
                <button className="page-btn-round" style={{ flex: 1 }} onClick={() => openEdit(acc)}><FaEdit size={11} /> Edit</button>
                <button className="page-btn-round" style={{ flex: 1, background: acc.is_active ? "#fef2f2" : "#f0fdf4", color: acc.is_active ? "#dc2626" : "#15803d", border: `1px solid ${acc.is_active ? "#fca5a5" : "#86efac"}` }} onClick={() => toggleActive(acc)}>
                  {acc.is_active ? <><FaToggleOn size={14} /> Disable</> : <><FaToggleOff size={14} /> Enable</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0 }}>{editId !== null ? "Edit Account" : "Add Personal Account"}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><FaTimes size={18} /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid-2">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Account Name *</label>
                    <input type="text" required placeholder="e.g. My PhonePe Account" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Account Type *</label>
                    <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value as PersonalAccount["account_type"] })}>
                      <option value="upi">UPI (PhonePe / GPay / Paytm)</option>
                      <option value="bank">Bank Account</option>
                      <option value="cash">Cash (Personal)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {form.account_type === "upi" && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label>UPI ID</label>
                      <input type="text" placeholder="e.g. name@bank" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
                    </div>
                  )}
                  {form.account_type === "bank" && (
                    <>
                      <div><label>Bank Name</label><input type="text" placeholder="e.g. SBI" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
                      <div><label>Account Number</label><input type="text" placeholder="e.g. 123456789" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
                      <div><label>IFSC Code</label><input type="text" placeholder="e.g. SBIN0001234" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} /></div>
                      <div><label>Account Holder Name</label><input type="text" placeholder="e.g. Ramesh Kumar" value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} /></div>
                    </>
                  )}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Notes (optional)</label>
                    <input type="text" placeholder="Any remarks..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" disabled={saving}>{saving ? "Saving..." : editId !== null ? "Update" : "Add Account"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PersonalAccountsAdmin;
