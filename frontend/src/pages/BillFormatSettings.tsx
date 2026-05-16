import React, { useState, useEffect } from "react";
import { FaSave, FaCheckCircle, FaFileInvoice, FaUniversity, FaBuilding } from "react-icons/fa";
import { apiFetch } from "../utils/api";

interface Settings {
  business_name: string; address: string; gstin: string; phone: string; email: string;
  state: string; state_code: string;
  bank_name: string; bank_account_no: string; bank_ifsc_code: string;
  bill_title: string; bill_type: string;
  show_hsn: boolean; show_gst_breakup: boolean; show_barcode: boolean; show_branch_name: boolean;
  footer_message: string; paper_size: string;
}

const DEFAULTS: Settings = {
  business_name: "", address: "", gstin: "", phone: "", email: "",
  state: "", state_code: "",
  bank_name: "", bank_account_no: "", bank_ifsc_code: "",
  bill_title: "INVOICE", bill_type: "INVOICE",
  show_hsn: true, show_gst_breakup: true, show_barcode: false, show_branch_name: false,
  footer_message: "Thank you for your business!", paper_size: "A4",
};

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "10px",
  border: "1.5px solid #e2e8f0", fontSize: "13px", outline: "none",
  fontFamily: "inherit", background: "#fff", boxSizing: "border-box",
};

const BillFormatSettings: React.FC = () => {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/billing-config/format")
      .then(r => r.json())
      .then(data => { if (data && !data.error) setS(p => ({ ...p, ...data })); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Settings, v: any) => setS(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/billing-config/format", { method: "POST", body: JSON.stringify(s) });
      if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
      else { const e = await res.json(); alert("Save failed: " + (e.error || "Unknown")); }
    } catch { alert("Failed to save."); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading…</div>;

  const Card = ({ title, icon, children }: any) => (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ color: "#6366f1", fontSize: 15 }}>{icon}</span>
        <h3 style={{ margin: 0, fontWeight: 800, color: "#1e293b", fontSize: "1rem" }}>{title}</h3>
      </div>
      {children}
    </div>
  );

  const G2 = ({ children }: any) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>;
  const F = ({ label, children }: any) => (
    <div><label style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>{children}</div>
  );

  return (
    <div style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontWeight: 900, color: "#0f172a", fontSize: "1.55rem", display: "flex", alignItems: "center", gap: 10 }}>
              <FaFileInvoice color="#6366f1" /> Bill Format Settings
            </h1>
            <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>Changes apply instantly to all generated invoices & PDFs.</p>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: success ? "#16a34a" : "#6366f1", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
            {saving ? "Saving…" : success ? <><FaCheckCircle /> Saved!</> : <><FaSave /> Save Settings</>}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 22, alignItems: "start" }}>

          {/* FORM */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Card title="Company Details" icon={<FaBuilding />}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <F label="Business Name *"><input style={inp} value={s.business_name} onChange={e => set("business_name", e.target.value)} placeholder="JBS KNIT WEAR" /></F>
                <F label="Full Address"><textarea style={{ ...inp, resize: "none" } as any} rows={2} value={s.address} onChange={e => set("address", e.target.value)} placeholder="3/2B, Nesavalar Colony, PN Road, TIRUPUR - 641602" /></F>
                <G2>
                  <F label="State"><input style={inp} value={s.state} onChange={e => set("state", e.target.value)} placeholder="TAMILNADU" /></F>
                  <F label="State Code"><input style={inp} value={s.state_code} onChange={e => set("state_code", e.target.value)} placeholder="33" /></F>
                </G2>
                <G2>
                  <F label="GSTIN"><input style={inp} value={s.gstin} onChange={e => set("gstin", e.target.value)} placeholder="33CKAPJ7513F1ZK" /></F>
                  <F label="Phone"><input style={inp} value={s.phone} onChange={e => set("phone", e.target.value)} placeholder="9791902205" /></F>
                </G2>
                <F label="Email"><input type="email" style={inp} value={s.email} onChange={e => set("email", e.target.value)} placeholder="info@company.com" /></F>
              </div>
            </Card>

            <Card title="Bank Details" icon={<FaUniversity />}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <F label="Bank Name"><input style={inp} value={s.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder="ICICI Bank" /></F>
                <G2>
                  <F label="Account Number"><input style={inp} value={s.bank_account_no} onChange={e => set("bank_account_no", e.target.value)} placeholder="540305000194" /></F>
                  <F label="IFSC Code"><input style={inp} value={s.bank_ifsc_code} onChange={e => set("bank_ifsc_code", e.target.value)} placeholder="ICIC0005403" /></F>
                </G2>
              </div>
            </Card>

            <Card title="Invoice Settings" icon={<FaFileInvoice />}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <G2>
                  <F label="Invoice Title"><input style={inp} value={s.bill_title} onChange={e => set("bill_title", e.target.value)} placeholder="INVOICE" /></F>
                  <F label="Paper Size">
                    <select style={inp} value={s.paper_size} onChange={e => set("paper_size", e.target.value)}>
                      <option value="A4">A4 Standard</option>
                      <option value="Thermal80">Thermal 80mm</option>
                      <option value="Thermal58">Thermal 58mm</option>
                    </select>
                  </F>
                </G2>
                <F label="Footer Message"><input style={inp} value={s.footer_message} onChange={e => set("footer_message", e.target.value)} /></F>
                <G2>
                  {([{ k: "show_hsn", l: "Show HSN Code" }, { k: "show_gst_breakup", l: "Show GST Breakup (CGST/SGST)" }] as const).map(o => (
                    <label key={o.k} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, color: "#334155", fontSize: 13, padding: "10px 14px", borderRadius: 10, border: "1.5px solid", borderColor: (s as any)[o.k] ? "#c7d2fe" : "#e2e8f0", background: (s as any)[o.k] ? "#eef2ff" : "#fff" }}>
                      <input type="checkbox" checked={(s as any)[o.k]} onChange={e => set(o.k, e.target.checked)} style={{ width: 16, height: 16, accentColor: "#6366f1" }} />
                      {o.l}
                    </label>
                  ))}
                </G2>
              </div>
            </Card>
          </div>

          {/* LIVE PREVIEW */}
          <div style={{ position: "sticky", top: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ color: "#6366f1", fontWeight: 700, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <FaFileInvoice /> Live Preview — updates as you type
              </div>
              {/* Scaled preview */}
              <div style={{ transform: "scale(0.6)", transformOrigin: "top left", width: "167%", pointerEvents: "none" }}>
                <div style={{ border: "2px solid #000", fontFamily: "Arial, sans-serif", fontSize: 10, background: "#fff" }}>

                  {/* Header */}
                  <div style={{ textAlign: "center", padding: "8px 6px 5px", borderBottom: "1px solid #000" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>{(s.business_name || "YOUR COMPANY NAME").toUpperCase()}</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>{s.address || "Address, City, State - PIN"}</div>
                    {s.state && <div style={{ fontSize: 10 }}>{s.state.toUpperCase()}</div>}
                    {s.gstin && <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>GSTIN No. : {s.gstin}</div>}
                  </div>

                  {/* Title */}
                  <div style={{ textAlign: "center", fontSize: 16, fontWeight: 900, padding: "5px 6px", borderBottom: "1px solid #000", position: "relative" }}>
                    {s.bill_title || "INVOICE"}
                    <div style={{ position: "absolute", right: 6, top: 2, fontSize: 7.5, textAlign: "right", lineHeight: 1.6 }}>
                      <div style={{ color: "red" }}>Original for Recipient</div>
                      <div style={{ color: "#1a56db" }}>Duplicate for Supplier / Transporter</div>
                      <div style={{ color: "green" }}>Triplicate for Supplier</div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000" }}>
                    {[
                      [["Reverse Charge",""], ["Invoice No",": INV-001"], ["Invoice Date",`: ${new Date().toLocaleDateString("en-IN")}`], ["State",`: ${s.state||"—"} State Code: ${s.state_code||"—"}`]],
                      [["Transportation Mode",""], ["Vehicle Number",""], ["Date of Supply",""], ["Place of Supply",""]],
                    ].map((col, ci) => (
                      <div key={ci} style={{ padding: "4px 6px", ...(ci===1 ? { borderLeft: "1px solid #000" } : {}) }}>
                        {col.map(([l,v], i) => (
                          <div key={i} style={{ display: "flex", gap: 4, padding: "1px 0", fontSize: 9 }}>
                            <b style={{ minWidth: ci===0 ? 90 : 110 }}>{l}</b><span>{v || ":"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Party */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000" }}>
                    <div style={{ padding: "4px 6px", fontSize: 9 }}>
                      <div style={{ fontWeight: 700, textDecoration: "underline", fontSize: 8.5, marginBottom: 3 }}>Details of Receiver Billed To :</div>
                      <div><b>Name &nbsp;:</b> CUSTOMER NAME</div>
                      <div><b>Address:</b> Customer Address, City</div>
                      <div><b>GSTIN &nbsp;:</b> GSTIN NUMBER</div>
                      <div><b>State &nbsp; :</b> STATE <b>Code:</b> XX</div>
                    </div>
                    <div style={{ padding: "4px 6px", fontSize: 9, borderLeft: "1px solid #000" }}>
                      <div style={{ fontWeight: 700, textDecoration: "underline", fontSize: 8.5, marginBottom: 3 }}>Details of Consignee :</div>
                      <div><b>Name &nbsp;:</b> {(s.business_name || "YOUR COMPANY").toUpperCase()}</div>
                      <div><b>Address:</b> {s.address || "Your Address"}</div>
                      <div><b>GSTIN &nbsp;:</b> <b>{s.gstin || "GSTIN"}</b></div>
                      <div><b>State &nbsp; :</b> {s.state || "STATE"} <b>Code:</b> {s.state_code || "XX"}</div>
                    </div>
                  </div>

                  {/* Items table header */}
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Sr.", "Product / Service", ...(s.show_hsn?["HSN"]:[]), "UOM", "Qty", "Rate", "Amt", "Discount", "Taxable",
                          ...(s.show_gst_breakup?["CGST%","CGST₹","SGST%","SGST₹"]:[]), "IGST%","IGST₹", "Total"
                        ].map((h,i) => <th key={i} style={{ border: "1px solid #000", padding: "2px 1px", fontSize: 7.5, fontWeight: 700, background: "#f9f9f9", textAlign: "center" }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[1,2].map(i => (
                        <tr key={i} style={{ height: 16 }}>
                          <td style={{ border: "1px solid #000", textAlign: "center", fontSize: 8 }}>{i}</td>
                          <td style={{ border: "1px solid #000", fontSize: 8, padding: "0 2px" }}>{i===1?"SAMPLE PRODUCT":""}</td>
                          {s.show_hsn && <td style={{ border: "1px solid #000", textAlign: "center", fontSize: 8 }}>{i===1?"1234":""}</td>}
                          <td style={{ border: "1px solid #000", textAlign: "center", fontSize: 8 }}>Pcs</td>
                          <td style={{ border: "1px solid #000", textAlign: "right", fontSize: 8, padding: "0 2px" }}>{i===1?"100":""}</td>
                          <td style={{ border: "1px solid #000", textAlign: "right", fontSize: 8, padding: "0 2px" }}>{i===1?"50":""}</td>
                          <td style={{ border: "1px solid #000", textAlign: "right", fontSize: 8, padding: "0 2px" }}>{i===1?"5000":""}</td>
                          <td style={{ border: "1px solid #000" }}></td>
                          <td style={{ border: "1px solid #000", textAlign: "right", fontSize: 8, padding: "0 2px" }}>{i===1?"5000":"0"}</td>
                          {s.show_gst_breakup&&<><td style={{ border:"1px solid #000",textAlign:"center",fontSize:8}}>{i===1?"2.5":""}</td><td style={{border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px"}}>{i===1?"125":"0"}</td><td style={{border:"1px solid #000",textAlign:"center",fontSize:8}}>{i===1?"2.5":""}</td><td style={{border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px"}}>{i===1?"125":"0"}</td></>}
                          <td style={{ border: "1px solid #000" }}></td>
                          <td style={{ border: "1px solid #000", textAlign: "right", fontSize: 8, padding: "0 2px" }}>0</td>
                          <td style={{ border: "1px solid #000", textAlign: "right", fontSize: 8, padding: "0 2px", fontWeight: 700 }}>{i===1?"5250":"0"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: "#f9f9f9" }}>
                        <td colSpan={4} style={{ border:"1px solid #000",textAlign:"center",fontSize:8,padding:2 }}>Total</td>
                        <td style={{ border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px" }}>100</td>
                        <td style={{ border:"1px solid #000" }}></td>
                        <td style={{ border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px" }}>5000</td>
                        <td style={{ border:"1px solid #000" }}></td>
                        <td style={{ border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px" }}>5000</td>
                        {s.show_gst_breakup&&<><td style={{border:"1px solid #000"}}></td><td style={{border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px"}}>125</td><td style={{border:"1px solid #000"}}></td><td style={{border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px"}}>125</td></>}
                        <td style={{ border:"1px solid #000" }}></td>
                        <td style={{ border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px" }}>0</td>
                        <td style={{ border:"1px solid #000",textAlign:"right",fontSize:8,padding:"0 2px",fontWeight:900 }}>5250</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Footer */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", borderTop: "1px solid #000" }}>
                    <div style={{ padding: 6, borderRight: "1px solid #000", fontSize: 9 }}>
                      <div style={{ fontWeight: 700, fontSize: 8.5 }}>Total Invoice Amount in words</div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: "4px 0" }}>FIVE THOUSAND TWO HUNDRED AND FIFTY RUPEES ONLY</div>
                      <div style={{ marginTop: 6 }}><b>Bundles :</b> —</div>
                      {(s.bank_name||s.bank_account_no) && (
                        <div style={{ marginTop: 6 }}>
                          <b style={{ textDecoration: "underline" }}>Bank Details :</b>
                          {s.bank_name&&<div>* <b>BANK NAME</b> : {s.bank_name}</div>}
                          {s.bank_account_no&&<div>* <b>A/C NO</b> : {s.bank_account_no}</div>}
                          {s.bank_ifsc_code&&<div>* <b>IFSC NO</b> : {s.bank_ifsc_code}</div>}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 6, fontSize: 9 }}>
                      <div style={{ display:"flex",justifyContent:"space-between" }}><span>Total Before Tax</span><span>: <b>5000</b></span></div>
                      {s.show_gst_breakup&&<>
                        <div style={{ display:"flex",justifyContent:"space-between" }}><span>Add: CGST 2.5%</span><span>: <b>125</b></span></div>
                        <div style={{ display:"flex",justifyContent:"space-between" }}><span>Add: SGST 2.5%</span><span>: <b>125</b></span></div>
                      </>}
                      <div style={{ display:"flex",justifyContent:"space-between" }}><span>Add: IGST</span><span>:</span></div>
                      <div style={{ display:"flex",justifyContent:"space-between" }}><span>Tax Amount: GST</span><span>: <b>250</b></span></div>
                      <div style={{ display:"flex",justifyContent:"space-between",fontWeight:900,borderTop:"1px solid #000",marginTop:4,paddingTop:4 }}><span>Total After Tax</span><span>5250</span></div>
                      <div style={{ marginTop:6,fontSize:8.5 }}>GST Payable on Reverse Charge :</div>
                      <div style={{ marginTop:4,fontSize:8.5 }}>Certified that the particulars given above are true &amp; correct.</div>
                      <div style={{ marginTop:4,fontWeight:700,textAlign:"right",fontSize:9 }}>For, {(s.business_name||"YOUR COMPANY").toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"1px solid #000",padding:"4px 6px" }}>
                    <div style={{ textAlign:"center",paddingTop:24,fontSize:9 }}>(Common Seal)</div>
                    <div style={{ textAlign:"right",paddingTop:24,fontSize:9 }}>
                      <div style={{ fontWeight:700 }}>Authorised Signatory</div>
                      <div style={{ fontSize:8,marginTop:4 }}>[E &amp; OE]</div>
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ textAlign:"center",fontSize:11,color:"#94a3b8",marginTop:10,fontStyle:"italic" }}>This preview updates live as you type.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillFormatSettings;
