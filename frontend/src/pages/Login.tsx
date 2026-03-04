import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FaBuilding, FaChartLine, FaEye, FaEyeSlash, FaLock, FaRocket, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import "./Login.css";

export default function Login() {
  const [companyCode, setCompanyCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const remComp = localStorage.getItem("rem-company");
    const remEmail = localStorage.getItem("rem-email");
    if (remComp) setCompanyCode(remComp);
    if (remEmail) {
        setEmail(remEmail);
        setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await login(email, password, companyCode);
      
      if (res && res.success && res.token) {
        localStorage.setItem("erp-token", res.token);
        
        if (rememberMe) {
          localStorage.setItem("rem-company", companyCode);
          localStorage.setItem("rem-email", email);
        } else {
          localStorage.removeItem("rem-company");
          localStorage.removeItem("rem-email");
        }
        
        try {
            const payload = JSON.parse(atob(res.token.split('.')[1]));
            const role = payload.user?.role?.toLowerCase() || 'user';

            if (role === 'superadmin') {
                window.location.href = "/platform-admin";
            } else if (role === 'admin') {
                window.location.href = "/admin/branches";
            } else if (role === 'user' || role === 'customer') {
                window.location.href = "/shop"; 
            } else {
                window.location.href = "/dashboard";
            }
        } catch (e) {
            window.location.href = "/dashboard";
        }

      } else {
        setError("Login failed. Check your credentials.");
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.status === 403) {
        setError("Your subscription has expired. Please contact support.");
      } else if (err.status === 423) {
        setError("Too many failed attempts. Account locked for 30 minutes.");
      } else {
        setError(err.message || "Invalid credentials or company code.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* Dynamic Background Elements */}
      <motion.div 
          animate={{ scale: [1, 1.1, 1], x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: 'absolute', top: '-10%', right: '40%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }}
      />
      <motion.div 
          animate={{ scale: [1, 1.2, 1], x: [0, -40, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: 'absolute', bottom: '-5%', left: '30%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}
      />

      {/* LEFT BRANDING */}
      <div className="login-banner">
        <motion.div 
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="banner-content"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ delay: 0.3 }}
            className="logo-badge"
          >
            <FaRocket /> Precision ERP v4.0
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Architecting Enterprise Intelligence
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            The industry standard for multi-tenant resource planning and real-time financial tracking.
          </motion.p>
        </motion.div>
      </div>

      {/* RIGHT SIDE FORM */}
      <div className="login-form-wrapper">
        <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="login-form-card"
        >
          <div className="form-header">
            <h2>Sign In</h2>
            <p>Access your secure enterprise workspace.</p>
          </div>

          {error && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="error-alert"
            >
                {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="form-body">
            {/* COMPANY CODE */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="input-group">
              <label className="input-label">Company Code</label>
              <div className="input-field-wrapper">
                <FaBuilding className="input-icon" />
                <input
                  type="text"
                  className="login-input"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  placeholder="EMP-XXX"
                  required
                />
              </div>
            </motion.div>

            {/* USERNAME */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="input-group">
              <label className="input-label">Email or Username</label>
              <div className="input-field-wrapper">
                <FaUser className="input-icon" />
                <input
                  type="text"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="root@enterprise.com"
                  required
                />
              </div>
            </motion.div>

            {/* PASSWORD */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="input-group">
              <label className="input-label">Security Key</label>
              <div className="input-field-wrapper">
                <FaLock className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </motion.div>

            <motion.label initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="remember-check">
                <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={e => setRememberMe(e.target.checked)} 
                />
                Remember this session
            </motion.label>

            <motion.button 
                whileHover={{ scale: 1.02, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit" 
                className="login-btn" 
                disabled={isLoading}
            >
              {isLoading ? (
                <div className="spinner" />
              ) : (
                <>Authorize Access <FaChartLine /></>
              )}
            </motion.button>
          </form>

          <p className="login-footer-text">
            Licensed to Enterprise Partners only.
          </p>
        </motion.div>
      </div>
    </div>
  );
}