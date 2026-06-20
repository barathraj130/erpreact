import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck, Mail, Building2, ChevronRight, Zap } from "lucide-react";
import { login } from "../api/authApi";
import { apiFetch } from "../utils/api";
import loginImg from "../assets/login-image.png";
import "./Login.css";

export default function Login() {
  const [companyCode, setCompanyCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [shake, setShake] = useState(false);

  const [errors, setErrors] = useState({
    companyCode: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    const remComp = localStorage.getItem("rem-company");
    const remEmail = localStorage.getItem("rem-email");
    if (remComp) setCompanyCode(remComp);
    if (remEmail) {
      setEmail(remEmail);
      setRememberMe(true);
    }
  }, []);

  const validateForm = () => {
    let isValid = true;
    const newErrors = { companyCode: "", email: "", password: "" };

    if (!companyCode) {
      newErrors.companyCode = "Workspace ID is required";
      isValid = false;
    } else if (companyCode.length < 2) {
      newErrors.companyCode = "Minimum 2 characters";
      isValid = false;
    } else if (!/^[a-zA-Z0-9\-_\s\u2014\u2013]+$/.test(companyCode)) {
      newErrors.companyCode = "Invalid characters detected";
      isValid = false;
    }

    if (!email) {
      newErrors.email = "Credential is required";
      isValid = false;
    } else if (email.length < 3) {
      newErrors.email = "Minimum 3 characters";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Security key is required";
      isValid = false;
    } else if (password.length < 4) {
      newErrors.password = "Minimum 4 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");

    if (!validateForm()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsAuthenticating(true);

    setTimeout(async () => {
      try {
        const res = await login(email.trim(), password, companyCode.trim());

        if (res && res.success && res.token) {
          localStorage.setItem("erp-token", res.token);
          // Store refresh token so we can silently renew expired access tokens
          if (res.refreshToken) {
            localStorage.setItem("erp-refresh-token", res.refreshToken);
          }

          if (rememberMe) {
            localStorage.setItem("rem-company", companyCode);
            localStorage.setItem("rem-email", email);
          } else {
            localStorage.removeItem("rem-company");
            localStorage.removeItem("rem-email");
          }

          try {
            const payload = JSON.parse(atob(res.token.split(".")[1]));
            const role = payload.user?.role?.toLowerCase() || "user";

            if (role === "superadmin") {
              window.location.href = "/platform-admin";
            } else if (role === "customer" || role === "user") {
              window.location.href = "/shop";
            } else if (role === "branch_manager") {
              window.location.href = "/branch/billing";
            } else {
              window.location.href = "/dashboard";
            }
          } catch (e) {
            window.location.href = "/shop"; // Fallback to safe shop view
          }
        } else {
          setLoginError("Access Denied. Please verify your credentials.");
          setIsAuthenticating(false);
        }
      } catch (err: any) {
        setLoginError(err.message || "Unable to authenticate. System unavailable.");
        setIsAuthenticating(false);
      }
    }, 1500);
  }

  async function handleDemoLogin() {
    setIsDemoLoading(true);
    setLoginError("");
    try {
      const res = await apiFetch("/auth/demo-login", { method: "POST" });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("erp-token", data.token);
        window.location.href = "/dashboard";
      } else {
        setLoginError(data.error || "Demo login failed.");
      }
    } catch {
      setLoginError("Demo login failed. Please try again.");
    } finally {
      setIsDemoLoading(false);
    }
  }

  const shakeAnimation = {
    x: [0, -6, 6, -6, 6, 0],
    transition: { duration: 0.4 }
  };

  return (
    <div className="login-container">
      {/* Refined Background Elements */}
      <div className="background-mesh"></div>
      
      <motion.div 
        className="login-box-wrapper"
        animate={shake ? shakeAnimation : {}}
      >
        <div className="login-box">
          {/* LEFT: INFORMATION PANEL */}
          <div className="login-banner">
            <div className="banner-visual">
               <img src={loginImg} alt="Platform Branding" className="illustration-img" />
            </div>
            <div className="banner-overlay"></div>
            <div className="banner-content">
              <div className="brand-badge">ENTERPRISE OS</div>
              <h1 className="banner-heading">ERP</h1>
              <p className="banner-description">
                Unified operations. Intelligent insights. Secure infrastructure for the modern workforce.
              </p>
            </div>
          </div>

          {/* RIGHT: AUTHENTICATION FORM */}
          <div className="login-form-side">
            <div className="form-container">
              <header className="form-header">
                <h2 className="header-title">Secure Login</h2>
                <p className="header-subtitle">Provide your workspace credentials to continue.</p>
              </header>

              <AnimatePresence>
                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="auth-error-block"
                  >
                    {loginError}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="auth-form-body">
                {/* WORKSPACE CODE */}
                <div className="form-field-group">
                  <label className="field-label">Workspace Identifier</label>
                  <div className={`field-input-container ${errors.companyCode ? 'field-has-error' : ''}`}>
                    <Building2 className="field-icon" size={18} />
                    <input
                      type="text"
                      className="field-native-input"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      placeholder="e.g. TITAN-X"
                    />
                  </div>
                  {errors.companyCode && <span className="field-error-text">{errors.companyCode}</span>}
                </div>

                {/* IDENTIFIER */}
                <div className="form-field-group">
                  <label className="field-label">User Credential</label>
                  <div className={`field-input-container ${errors.email ? 'field-has-error' : ''}`}>
                    <Mail className="field-icon" size={18} />
                    <input
                      type="text"
                      className="field-native-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@organization.com"
                    />
                  </div>
                  {errors.email && <span className="field-error-text">{errors.email}</span>}
                </div>

                {/* SECURITY KEY */}
                <div className="form-field-group">
                  <label className="field-label">Security Key</label>
                  <div className={`field-input-container ${errors.password ? 'field-has-error' : ''}`}>
                    <ShieldCheck className="field-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="field-native-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                    />
                    {/* WRAPPER FIX FOR BUTTON BLEED */}
                    <div className="interactive-wrapper-fix password-eye-wrapper">
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {errors.password && <span className="field-error-text">{errors.password}</span>}
                </div>

                <div className="auth-options-row">
                  <label className="checkbox-input-label">
                    <input
                      type="checkbox"
                      className="hidden-native-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="styled-checkbox-frame"></span>
                    <span className="checkbox-label-text">Persistent Authentication</span>
                  </label>
                </div>

                {/* WRAPPER FIX FOR BUTTON BLEED SITESHIDE */}
                <div className="interactive-wrapper-fix login-button-wrapper">
                  <button
                    type="submit"
                    className="primary-action-btn"
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating ? (
                      <span className="action-spinner"></span>
                    ) : (
                      <span className="action-text-flex">
                        Authenticate Access <ChevronRight size={18} />
                      </span>
                    )}
                  </button>
                </div>

                {/* DEMO LOGIN */}
                <div style={{ position: "relative", margin: "16px 0 0", textAlign: "center" }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(148,163,184,0.25)", transform: "translateY(-50%)" }} />
                  <span style={{ position: "relative", background: "white", padding: "0 12px", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>or</span>
                </div>
                <div className="interactive-wrapper-fix login-button-wrapper" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={isDemoLoading}
                    style={{
                      width: "100%", padding: "12px 20px", borderRadius: 10,
                      border: "1.5px solid #e2e8f0", background: "#f8fafc",
                      color: "#334155", fontSize: 14, fontWeight: 600,
                      cursor: isDemoLoading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; }}
                  >
                    {isDemoLoading ? (
                      <span className="action-spinner" style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}></span>
                    ) : (
                      <>
                        <Zap size={16} style={{ color: "#6366f1" }} />
                        Try Demo — No Login Required
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
