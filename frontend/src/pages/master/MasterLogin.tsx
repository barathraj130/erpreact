import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { masterFetch } from "./masterApi";

const MasterLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await masterFetch("/master/login", { method: "POST", body: { email, password } });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("master_token", data.token);
        localStorage.setItem("master_user", JSON.stringify(data.master));
        navigate("/master");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#030712", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: 420, padding: "48px 40px", background: "#0f172a", borderRadius: 20, border: "1px solid #1e293b" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", fontWeight: 900, color: "#fff" }}>
            F
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>Fluxora Master</div>
          <div style={{ fontSize: 13, color: "#475569" }}>Platform Control Panel</div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, color: "#fca5a5", fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>MASTER EMAIL</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "#020617", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>MASTER PASSWORD</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "#020617", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{ width: "100%", padding: 14, background: loading ? "#334155" : "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Authenticating..." : "Enter Master Panel →"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#1e293b" }}>
          This page is not linked publicly. Access is restricted.
        </div>
      </div>
    </div>
  );
};

export default MasterLogin;
