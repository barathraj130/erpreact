import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { FaUserAlt, FaLock, FaEnvelope } from "react-icons/fa";

const CustomerLogin: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password, company_code: "1" }), // Assuming default company code
                headers: { "Content-Type": "application/json" }
            }, false);

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("token", data.accessToken);
                localStorage.setItem("refreshToken", data.refreshToken);
                localStorage.setItem("user", JSON.stringify(data.user));
                
                await apiFetch("/portal/activity", {
                    method: "POST",
                    body: JSON.stringify({ activity: "logged into portal" }),
                });

                navigate("/portal/home");
            } else {
                alert("Invalid Credentials");
            }
        } catch (err) {
            console.error(err);
            alert("Login Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ height: "100vh", display: "flex", background: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <div style={{ background: "white", padding: "40px", borderRadius: "24px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
                    <div style={{ textAlign: "center", marginBottom: "30px" }}>
                        <div style={{ width: "64px", height: "64px", background: "#eff6ff", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", margin: "0 auto 20px" }}>
                            <FaUserAlt size={24} />
                        </div>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>Customer Portal</h1>
                        <p style={{ color: "#64748b", marginTop: "10px" }}>Login to access your catalog and ledger</p>
                    </div>

                    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>Email Address</label>
                            <div style={{ position: "relative" }}>
                                <FaEnvelope style={{ position: "absolute", left: "14px", top: "14px", color: "#94a3b8" }} />
                                <input 
                                    type="email" 
                                    required 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)}
                                    style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} 
                                    placeholder="your@email.com" 
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>Password</label>
                            <div style={{ position: "relative" }}>
                                <FaLock style={{ position: "absolute", left: "14px", top: "14px", color: "#94a3b8" }} />
                                <input 
                                    type="password" 
                                    required 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)}
                                    style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} 
                                    placeholder="••••••••" 
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} style={{ padding: "14px", borderRadius: "10px", border: "none", background: "#4f46e5", color: "white", fontWeight: 700, fontSize: "1rem", cursor: "pointer", marginTop: "10px" }}>
                            {loading ? "Signing in..." : "Login securely"}
                        </button>
                    </form>
                </div>
            </div>
            <div style={{ flex: 1, background: "linear-gradient(135deg, #4f46e5, #3b82f6)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "white", padding: "40px" }}>
                <h2 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "20px" }}>Welcome Back</h2>
                <p style={{ fontSize: "1.1rem", textAlign: "center", maxWidth: "400px", opacity: 0.9 }}>
                    Access our complete product catalog, track your previous orders, and securely view your financial ledger in one place.
                </p>
            </div>
        </div>
    );
};

export default CustomerLogin;
