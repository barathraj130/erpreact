import React, { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaClock, FaPaperPlane } from "react-icons/fa";

const CustomerContact: React.FC = () => {
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [form, setForm] = useState({ subject: "", message: "" });
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        const fetchCompanyInfo = async () => {
            try {
                // To fetch company info, use user's active company
                const u = localStorage.getItem("user");
                if (u) {
                    const user = JSON.parse(u);
                    const res = await apiFetch("/company");
                    if (res.ok) {
                        const data = await res.json();
                        setCompanyInfo(data);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchCompanyInfo();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch("/portal/message", {
                method: "POST",
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setSuccessMsg("✅ Message sent! We'll get back to you soon.");
                setForm({ subject: "", message: "" });
                setTimeout(() => setSuccessMsg(""), 5000);
            }
        } catch (err) {
            alert("Failed to send message");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: "40px" }}>
                <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 800, color: "#1e293b" }}>Contact Us</h1>
                <p style={{ color: "#64748b", margin: "10px 0 0", fontSize: "1.1rem" }}>We're here to help. Reach out to us for any queries.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "40px" }}>
                {/* Contact Info */}
                <div style={{ background: "white", borderRadius: "24px", padding: "30px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: "0 0 25px", fontSize: "1.2rem", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "1px" }}>Our Office</h3>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
                        <div style={{ display: "flex", gap: "15px" }}>
                            <div style={{ width: "40px", height: "40px", background: "#eff6ff", color: "#3b82f6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaMapMarkerAlt /></div>
                            <div>
                                <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>Address</div>
                                <div style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.5 }}>
                                    {companyInfo?.address_line1 || "Business Address"}<br/>
                                    {companyInfo?.city_pincode || "City, Pincode"}<br/>
                                    {companyInfo?.state || "State"}
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: "15px" }}>
                            <div style={{ width: "40px", height: "40px", background: "#eff6ff", color: "#3b82f6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaPhoneAlt /></div>
                            <div>
                                <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>Phone</div>
                                <div style={{ color: "#64748b", fontSize: "0.95rem" }}>{companyInfo?.phone_number || "+91 00000 00000"}</div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "15px" }}>
                            <div style={{ width: "40px", height: "40px", background: "#eff6ff", color: "#3b82f6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaEnvelope /></div>
                            <div>
                                <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>Email</div>
                                <div style={{ color: "#64748b", fontSize: "0.95rem" }}>{companyInfo?.email || "contact@business.com"}</div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "15px" }}>
                            <div style={{ width: "40px", height: "40px", background: "#eff6ff", color: "#3b82f6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaClock /></div>
                            <div>
                                <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>Business Hours</div>
                                <div style={{ color: "#64748b", fontSize: "0.95rem" }}>Mon - Sat, 9:00 AM - 6:00 PM</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Form */}
                <div style={{ background: "white", borderRadius: "24px", padding: "40px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: "0 0 5px", fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>Send us a message</h3>
                    <p style={{ color: "#64748b", marginBottom: "30px" }}>Our team will respond to your query as soon as possible.</p>
                    
                    {successMsg && <div style={{ background: "#dcfce7", color: "#166534", padding: "15px", borderRadius: "12px", fontWeight: 700, marginBottom: "20px" }}>{successMsg}</div>}

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "0.85rem", color: "#475569" }}>Subject</label>
                            <input 
                                required 
                                value={form.subject} 
                                onChange={e => setForm({...form, subject: e.target.value})} 
                                placeholder="What is this regarding?" 
                                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "1rem" }} 
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "0.85rem", color: "#475569" }}>Message</label>
                            <textarea 
                                required 
                                value={form.message} 
                                onChange={e => setForm({...form, message: e.target.value})} 
                                placeholder="Type your message here..." 
                                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", minHeight: "150px", fontSize: "1rem" }} 
                            />
                        </div>
                        <button type="submit" disabled={loading} style={{ padding: "16px", background: "#4f46e5", color: "white", border: "none", borderRadius: "12px", fontWeight: 800, fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "10px" }}>
                            {loading ? "Sending..." : <><FaPaperPlane /> Send Message</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CustomerContact;
