import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { masterFetch } from "./masterApi";
import "../../styles/aurora.css";

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
    <div style={{ minHeight: "100vh", background: "#070B16", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* AURORA BLOBS */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-25%", left: "-15%", width: "65%", height: "75%", borderRadius: "50%", background: "radial-gradient(circle, rgba(91,75,255,0.16) 0%, transparent 60%)", filter: "blur(90px)", animation: "aurora-slow 24s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-15%", width: "60%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 60%)", filter: "blur(100px)", animation: "aurora-slow-reverse 30s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", top: "40%", left: "35%", width: "30%", height: "30%", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,108,255,0.08) 0%, transparent 60%)", filter: "blur(60px)" }} />
      </div>

      <div style={{
        position: "relative", zIndex: 1, width: 440, padding: "52px 44px", background: "rgba(13,20,38,0.92)", borderRadius: 24,
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow: "8px 8px 24px rgba(0,0,0,0.45), -5px -5px 16px rgba(255,255,255,0.02), 0 0 60px rgba(91,75,255,0.10)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg, #5B4BFF, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 18px", fontWeight: 900, color: "#fff", boxShadow: "0 8px 28px rgba(91,75,255,0.50)" }}>
            F
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 6, letterSpacing: "-0.01em" }}>Fluxora Master</div>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>Platform Control Panel</div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "0.5px solid rgba(239,68,68,0.30)", borderRadius: 10, color: "#fca5a5", fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>MASTER EMAIL</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.10)", background: "#070B16", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box", outline: "none", boxShadow: "inset 4px 4px 10px rgba(0,0,0,0.4), inset -3px -3px 8px rgba(255,255,255,0.02)", transition: "border-color 150ms" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(91,75,255,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
            />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>MASTER PASSWORD</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.10)", background: "#070B16", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box", outline: "none", boxShadow: "inset 4px 4px 10px rgba(0,0,0,0.4), inset -3px -3px 8px rgba(255,255,255,0.02)", transition: "border-color 150ms" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(91,75,255,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{ width: "100%", padding: 14, background: loading ? "#1e293b" : "linear-gradient(135deg, #5B4BFF, #7C6CFF)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 6px 24px rgba(91,75,255,0.40)", transition: "all 150ms ease" }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.boxShadow = "0 8px 32px rgba(91,75,255,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = loading ? "none" : "0 6px 24px rgba(91,75,255,0.40)"; e.currentTarget.style.transform = "none"; }}
          >
            {loading ? "Authenticating..." : "Enter Master Panel →"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#1e293b", fontWeight: 500 }}>
          This page is not linked publicly. Access is restricted.
        </div>
      </div>
    </div>
  );
};

export default MasterLogin;
