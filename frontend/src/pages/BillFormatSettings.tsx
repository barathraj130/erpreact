import React, { useState, useEffect } from "react";
import { FaSave, FaCheckCircle, FaFileInvoice, FaBuilding, FaUniversity } from "react-icons/fa";
import { apiFetch } from "../utils/api";

const BillFormatSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    business_name: "",
    address: "",
    gstin: "",
    phone: "",
    email: "",
    state: "",
    state_code: "",
    bank_name: "",
    bank_account_no: "",
    bank_ifsc_code: "",
    bill_title: "INVOICE",
    show_hsn: true,
    show_gst_breakup: true,
    show_barcode: false,
    show_branch_name: false,
    footer_message: "Thank you for your business!",
    paper_size: "A4",
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/billing-config/format");
        if (res.ok) {
          const data = await res.json();
          if (data) setSettings(s => ({ ...s, ...data }));
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const set = (k: string, v: any) => setSettings(s => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/billing-config/format", { method: "POST", body: JSON.stringify(settings) });
      if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
      else { const d = await res.json(); alert("Save failed: " + (d?.error || "Unknown error")); }
    } catch { alert("Save failed"); }
    finally { setSaving(false); }
  };

  const inp = { padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px", outline: "none" } as React.CSSProperties;
  const label = { display: "block", marginBottom: "5px", fontWeight: 700, color: "#475569", fontSize: "12px" } as React.CSSProperties;
  const section = { background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0", marginBottom: "20px" } as React.CSSProperties;

  if (loading) return <div style={{ padding: 40 }}>Loading settings…</div>;

  return (
    <div style={{ padding: "28px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div>
            <h1 style={{ margin: 0, fontWeight: 900, color: "#0f172a", fontSize: "22px", display: "flex", alignItems: "center", gap: 10 }}>
              <FaFileInvoice color="#4f46e5" /> Bill Format Settings
            </h1>
            <p style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>Changes apply to all generated invoices immediately.</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "11px 28px", borderRadius: "10px", background: "#4f46e5", color: "#fff", border: "none", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            {saving ? "Saving…" : success ? <><FaCheckCircle /> Saved!</> : <><FaSave /> Save Settings</>}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "480px 1fr", gap: "28px", alignItems: "start" }}>

          {/* ── LEFT: Form ── */}
          <div>
            {/* Company Details */}
            <div style={section}>
              <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: "#1e293b", fontSize: "15px", display: "flex", alignItems: "center", gap: 8 }}><FaBuilding color="#4f46e5" /> Company Details</h3>
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={label}>Business Name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input style={inp} value={settings.business_name} onChange={e => set("business_name", e.target.value)} placeholder="e.g. JBS KNIT WEAR" />
                </div>
                <div>
                  <label style={label}>Full Address</label>
                  <textarea style={{ ...inp, resize: "none" }} rows={2} value={settings.address} onChange={e => set("address", e.target.value)} placeholder="Street, Colony, City - Pincode" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={label}>State</label>
                    <input style={inp} value={settings.state} onChange={e => set("state", e.target.value)} placeholder="TAMILNADU" />
                  </div>
                  <div>
                    <label style={label}>State Code</label>
                    <input style={inp} value={settings.state_code} onChange={e => set("state_code", e.target.value)} placeholder="33" />
                  </div>
                </div>
                <div>
                  <label style={label}>GSTIN</label>
                  <input style={inp} value={settings.gstin} onChange={e => set("gstin", e.target.value)} placeholder="33CKAPJ7513F1ZK" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={label}>Phone</label>
                    <input style={inp} value={settings.phone} onChange={e => set("phone", e.target.value)} placeholder="9791902205" />
                  </div>
                  <div>
                    <label style={label}>Email</label>
                    <input style={inp} type="email" value={settings.email} onChange={e => set("email", e.target.value)} placeholder="info@company.com" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div style={section}>
              <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: "#1e293b", fontSize: "15px", display: "flex", alignItems: "center", gap: 8 }}><FaUniversity color="#0ea5e9" /> Bank Details</h3>
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={label}>Bank Name</label>
                  <input style={inp} value={settings.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder="ICICI Bank" />
                </div>
                <div>
                  <label style={label}>Account Number</label>
                  <input style={inp} value={settings.bank_account_no} onChange={e => set("bank_account_no", e.target.value)} placeholder="540305000194" />
                </div>
                <div>
                  <label style={label}>IFSC Code</label>
                  <input style={inp} value={settings.bank_ifsc_code} onChange={e => set("bank_ifsc_code", e.target.value)} placeholder="ICIC0005403" />
                </div>
              </div>
            </div>

            {/* Invoice Options */}
            <div style={section}>
              <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: "#1e293b", fontSize: "15px" }}>Invoice Options</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={label}>Bill Title</label>
                  <input style={inp} value={settings.bill_title} onChange={e => set("bill_title", e.target.value)} placeholder="INVOICE" />
                </div>
                <div>
                  <label style={label}>Paper Size</label>
                  <select style={{ ...inp, background: "#f8fafc" }} value={settings.paper_size} onChange={e => set("paper_size", e.target.value)}>
                    <option value="A4">A4 Standard</option>
                    <option value="Thermal80">Thermal 80mm</option>
                    <option value="Thermal58">Thermal 58mm</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Live Preview ── */}
          <div style={{ position: "sticky", top: "20px" }}>
            <div style={{ fontWeight: 700, color: "#475569", fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              👁 LIVE PREVIEW — matches actual generated PDF
            </div>
            <div style={{ background: "#fff", border: "2px solid #000", padding: "12px", fontSize: "9px", fontFamily: "Arial, sans-serif", transform: "scale(0.88)", transformOrigin: "top left", width: "114%", boxShadow: "0 10px 30px rgba(0,0,0,0.12)" }}>

              {/* Header */}
              <div style={{ textAlign: "center", borderBottom: "1px solid #000", paddingBottom: 6, marginBottom: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>{settings.business_name || "BUSINESS NAME"}</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>{settings.address || "Address, City, State"}</div>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 1 }}>GSTIN No. : {settings.gstin || "GSTIN"}</div>
              </div>

              {/* Title */}
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 13, padding: "3px 0", borderBottom: "1px solid #000", position: "relative" }}>
                {settings.bill_title || "INVOICE"}
                <div style={{ position: "absolute", right: 4, top: 2, fontSize: 7, textAlign: "right", lineHeight: 1.5 }}>
                  <div style={{ color: "red" }}>Original for Recipient</div>
                  <div style={{ color: "blue" }}>Duplicate for Supplier</div>
                  <div style={{ color: "green" }}>Triplicate for Supplier</div>
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000" }}>
                <div style={{ padding: "3px 4px", fontSize: 8 }}>
                  <div><b>Invoice No</b> : INV-001</div>
                  <div><b>Invoice Date</b> : 15/05/2026</div>
                  <div><b>State</b> : {settings.state || "STATE"} &nbsp; <b>Code:</b> {settings.state_code || "00"}</div>
                </div>
                <div style={{ padding: "3px 4px", borderLeft: "1px solid #000", fontSize: 8 }}>
                  <div><b>Transportation Mode</b> :</div>
                  <div><b>Vehicle Number</b> :</div>
                  <div><b>Place of Supply</b> : &nbsp; <b>Code:</b></div>
                </div>
              </div>

              {/* Party */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000" }}>
                <div style={{ padding: "3px 4px", fontSize: 8 }}>
                  <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 2 }}>Details of Receiver Billed To :</div>
                  <div><b>Name :</b> CUSTOMER NAME</div>
                  <div><b>Address :</b> Customer address</div>
                  <div><b>GSTIN :</b> 33XXXXXX</div>
                  <div><b>State :</b> STATE &nbsp; Code: 33</div>
                </div>
                <div style={{ padding: "3px 4px", borderLeft: "1px solid #000", fontSize: 8 }}>
                  <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 2 }}>Details of Consignee :</div>
                  <div><b>Name :</b> {(settings.business_name || "BUSINESS NAME").toUpperCase()}</div>
                  <div><b>Address :</b> {settings.address || "Address"}</div>
                  <div><b>GSTIN :</b> {settings.gstin || "GSTIN"}</div>
                  <div><b>State :</b> {settings.state || "STATE"} &nbsp; Code: {settings.state_code || "00"}</div>
                </div>
              </div>

              {/* Items table header */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 7 }}>
                <thead>
                  <tr>
                    {["Sr", "Name of Product/Service", "HSN", "Uom", "Qty", "Rate", "Amt", "Disc", "Taxable", "CGST Rate", "CGST Amt", "SGST Rate", "SGST Amt", "IGST Rate", "IGST Amt", "Total"].map(h => (
                      <th key={h} style={{ border: "1px solid #000", padding: "2px 1px", textAlign: "center", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", textAlign: "center", padding: "2px 1px" }}>1</td>
                    <td style={{ border: "1px solid #000", padding: "2px 2px", fontWeight: 600 }}>SAMPLE PRODUCT</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", padding: "2px 1px" }}>6006</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", padding: "2px 1px" }}>Pcs</td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>100</td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>500</td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>50000</td>
                    <td style={{ border: "1px solid #000", padding: "2px 1px" }}></td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>50000</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", padding: "2px 1px" }}>2.5</td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>1250</td>
                    <td style={{ border: "1px solid #000", textAlign: "center", padding: "2px 1px" }}>2.5</td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>1250</td>
                    <td style={{ border: "1px solid #000", padding: "2px 1px" }}></td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px" }}>0</td>
                    <td style={{ border: "1px solid #000", textAlign: "right", padding: "2px 2px", fontWeight: 700 }}>52500</td>
                  </tr>
                  {[2,3].map(i => (
                    <tr key={i} style={{ height: 14 }}>
                      {Array(16).fill(0).map((_, j) => (
                        <td key={j} style={{ border: "1px solid #000" }}></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", borderTop: "1px solid #000", fontSize: 8 }}>
                <div style={{ padding: "4px", borderRight: "1px solid #000" }}>
                  <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", margin: "4px 0" }}>Fifty Two Thousand Five Hundred Rupees Only</div>
                  {(settings.bank_name || settings.bank_account_no) && (
                    <div style={{ marginTop: 4 }}>
                      <b style={{ textDecoration: "underline" }}>Bank Details :</b>
                      {settings.bank_name && <div>* BANK NAME : {settings.bank_name}</div>}
                      {settings.bank_account_no && <div>* A/C NO : {settings.bank_account_no}</div>}
                      {settings.bank_ifsc_code && <div>* IFSC NO : {settings.bank_ifsc_code}</div>}
                    </div>
                  )}
                </div>
                <div style={{ padding: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Before Tax</span><span><b>50000</b></span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>CGST 2.5%</span><span><b>1250</b></span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>SGST 2.5%</span><span><b>1250</b></span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderTop: "1px solid #000", marginTop: 2, paddingTop: 2 }}><span>Total After Tax</span><span>52500</span></div>
                  <div style={{ marginTop: 4, fontSize: 7 }}>Certified that the particulars given above are true &amp; correct.</div>
                  <div style={{ marginTop: 2, fontWeight: 700, textAlign: "right" }}>For, {(settings.business_name || "BUSINESS NAME").toUpperCase()}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #000", padding: "4px", fontSize: 8 }}>
                <div style={{ textAlign: "center" }}>(Common Seal)</div>
                <div style={{ textAlign: "right" }}><b>Authorised Signatory</b><br />[E &amp; OE]</div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BillFormatSettings;
