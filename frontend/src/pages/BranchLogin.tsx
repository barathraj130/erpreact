import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, Mail } from "lucide-react";
import { login } from "../api/authApi";
import "./Login.css";

const API = import.meta.env.VITE_API_URL || "/api";

export default function BranchLogin() {
  const [companyCode, setCompanyCode] = useState("");
  const [companyName, setCompanyName] = useState("JBS Knit Wear");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [shake, setShake] = useState(false);

  // Auto-fetch company code on mount
  useEffect(() => {
    fetch(`${API}/auth/company`)
      .then(r => r.json())
      .then(d => {
        if (d.company_code) setCompanyCode(d.company_code);
        if (d.company_name) setCompanyName(d.company_name);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");

    if (!email || !password) {
      setLoginError("Please enter your email and password.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!companyCode) {
      setLoginError("Company code not loaded. Please refresh and try again.");
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await login(email.trim(), password, companyCode.trim());

      if (res && res.success && res.token) {
        localStorage.setItem("erp-token", res.token);
        if (res.refreshToken) localStorage.setItem("erp-refresh-token", res.refreshToken);

        try {
          const payload = JSON.parse(atob(res.token.split(".")[1]));
          const role = payload.user?.role?.toLowerCase() || "user";
          if (role === "branch_manager") {
            window.location.href = "/branch/billing";
          } else if (role === "admin" || role === "superadmin") {
            window.location.href = "/dashboard";
          } else {
            window.location.href = "/branch/billing";
          }
        } catch {
          window.location.href = "/branch/billing";
        }
      } else {
        setLoginError("Invalid email or password.");
        setIsAuthenticating(false);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setLoginError(err.message || "Login failed. Please try again.");
      setIsAuthenticating(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  const shakeAnimation = { x: [0, -6, 6, -6, 6, 0], transition: { duration: 0.4 } };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
      fontFamily: "'Inter', sans-serif", padding: 16,
    }}>
      <motion.div
        animate={shake ? shakeAnimation : {}}
        style={{
          background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
          padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
        }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 24, color: "#fff", fontWeight: 900,
          }}>
            B
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
            Branch Login
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{companyName}</p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{
                background: "#fee2e2", color: "#dc2626", padding: "10px 14px",
                borderRadius: 8, fontSize: 13, marginBottom: 20, fontWeight: 500,
              }}
            >
              {loginError}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Email / Username
            </label>
            <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#f9fafb" }}>
              <span style={{ padding: "0 14px", color: "#9ca3af" }}><Mail size={16} /></span>
              <input
                type="text" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required autoFocus
                style={{ flex: 1, padding: "12px 14px 12px 0", border: "none", background: "transparent", fontSize: 14, outline: "none", color: "#111827" }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Password
            </label>
            <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#f9fafb" }}>
              <span style={{ padding: "0 14px", color: "#9ca3af" }}><ShieldCheck size={16} /></span>
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ flex: 1, padding: "12px 0", border: "none", background: "transparent", fontSize: 14, outline: "none", color: "#111827" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ padding: "0 14px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={isAuthenticating}
            style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: isAuthenticating ? "#a5b4fc" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: isAuthenticating ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}>
            {isAuthenticating ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        {/* Admin login link */}
        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 24, marginBottom: 0 }}>
          Admin?{" "}
          <a href="/company-login" style={{ color: "#4f46e5", fontWeight: 600, textDecoration: "none" }}>
            Use full login
          </a>
        </p>
      </motion.div>
    </div>
  );
}
