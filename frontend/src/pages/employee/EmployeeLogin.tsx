import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaUser, FaLock, FaArrowRight } from "react-icons/fa";

const EmployeeLogin: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/employee-portal/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("erp-employee-token", data.token);
        localStorage.setItem("erp-employee-data", JSON.stringify(data.employee));
        navigate("/employee/dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ 
        height: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#0f172a"
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
            background: "white",
            padding: "40px",
            borderRadius: "24px",
            width: "100%",
            maxWidth: "400px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#1e293b", letterSpacing: "-1px" }}>EMPLOYEE PORTAL</h1>
            <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: "14px" }}>Access your salary & financial records</p>
        </div>

        {error && (
            <div style={{ background: "#fef2f2", color: "#ef4444", padding: "12px", borderRadius: "12px", marginBottom: "20px", fontSize: "14px", fontWeight: 500, textAlign: "center", border: "1px solid #fee2e2" }}>
                {error}
            </div>
        )}

        <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Username</label>
                <div style={{ position: "relative" }}>
                    <FaUser style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input 
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        style={{ 
                            width: "100%", 
                            padding: "14px 14px 14px 44px", 
                            borderRadius: "12px", 
                            border: "1px solid #e2e8f0", 
                            fontSize: "15px",
                            outline: "none"
                        }}
                        disabled={loading}
                    />
                </div>
            </div>

            <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Password</label>
                <div style={{ position: "relative" }}>
                    <FaLock style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ 
                            width: "100%", 
                            padding: "14px 14px 14px 44px", 
                            borderRadius: "12px", 
                            border: "1px solid #e2e8f0", 
                            fontSize: "15px",
                            outline: "none"
                        }}
                        disabled={loading}
                    />
                </div>
            </div>

            <button 
                type="submit"
                disabled={loading}
                style={{ 
                    width: "100%", 
                    padding: "14px", 
                    borderRadius: "12px", 
                    background: "#2563eb", 
                    color: "white", 
                    border: "none", 
                    fontSize: "16px", 
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.4)"
                }}
            >
                {loading ? "Authenticating..." : <>Employee Login <FaArrowRight size={14}/></>}
            </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#94a3b8" }}>Forgot password? Contact your HR Manager.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default EmployeeLogin;
