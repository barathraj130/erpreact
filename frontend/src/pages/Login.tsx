import React, { useState } from "react";
import { FaChartLine, FaEye, FaEyeSlash, FaLock, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await login(email, password);
      
      if (res && res.success && res.token) {
        localStorage.setItem("erp-token", res.token);
        
        // --- JWT DECODE TO DETERMINE ROLE ---
        try {
            // Split token and decode the payload (2nd part)
            const payload = JSON.parse(atob(res.token.split('.')[1]));
            const role = payload.user?.role || 'user';

            // --- REDIRECT LOGIC ---
            if (role === 'user' || role === 'customer') {
                // Customer -> Shop
                window.location.href = "/shop"; 
            } else {
                // Admin/Staff -> Dashboard
                window.location.href = "/dashboard";
            }
        } catch (e) {
            // Fallback if decode fails
            window.location.href = "/dashboard";
        }

      } else {
        setError("Login failed. No token received.");
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.message?.includes("Network")) {
        setError("Cannot connect to Server. Check backend.");
      } else {
        setError("Invalid username or password.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* LEFT BRANDING */}
      <div className="login-banner">
        <div className="banner-content">
          <div className="logo-circle"><FaChartLine /></div>
          <h1>ERP System</h1>
          <p>Secure access for Management, Staff, and Customers.</p>
        </div>
        <div className="banner-overlay"></div>
      </div>

      {/* RIGHT SIDE FORM */}
      <div className="login-form-wrapper">
        <div className="login-form-card">
          <div className="form-header">
            <h2>Welcome Back</h2>
            <p>Sign in to access your account.</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* USERNAME */}
            <div className="input-group">
              <label htmlFor="email">Username or Email</label>
              <div className="input-wrapper">
                <FaUser className="input-icon" />
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <FaLock className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
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
            </div>

            {/* BUTTON */}
            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? <span className="spinner"></span> : "Sign In"}
            </button>
          </form>

          <div className="form-footer">
            <p>New Supplier or Client? <span>Contact Admin</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}