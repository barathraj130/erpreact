import { motion } from "framer-motion";
import React, { useState } from "react";
import {
  FaBell,
  FaBox,
  FaChartLine,
  FaChevronDown,
  FaChevronRight,
  FaClipboardList,
  FaCloudDownloadAlt,
  FaCog,
  FaExchangeAlt,
  FaFileInvoiceDollar,
  FaHistory,
  FaHome,
  FaLayerGroup as FaLayer,
  FaMoneyBillWave,
  FaSearch,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import "./SynthesisLayout.css";

interface LayoutProps {
  children: React.ReactNode;
  activeItem?: string;
}

const SynthesisLayout: React.FC<LayoutProps> = ({
  children,
  activeItem = "Command Center",
}) => {
  const [fiscalOpen, setFiscalOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="synthesis-layout">
      {/* Sidebar */}
      <motion.aside
        className={`synthesis-sidebar ${sidebarOpen ? "open" : ""}`}
        style={{ x: 0 }}
      >
        <div className="sidebar-brand">
          <div className="sidebar-avatar">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="10" height="10" rx="3" fill="#111" />
              <rect x="14" width="10" height="10" rx="3" fill="#FF91E8" />
              <rect y="14" width="10" height="10" rx="3" fill="#111" />
              <rect x="14" y="14" width="10" height="10" rx="3" fill="#111" />
            </svg>
          </div>
          <h2 style={{ color: "#1E293B", WebkitTextFillColor: "#1E293B" }}>
            Synthesis
          </h2>
        </div>

        <nav className="sidebar-nav">
          <a
            className={`nav-item ${activeItem === "Command Center" || activeItem === "Dashboard" ? "active" : ""}`}
          >
            <FaHome className="nav-item-icon" />{" "}
            <span className="nav-label">Dashboard</span>
          </a>

          <a className="nav-item">
            <FaMoneyBillWave className="nav-item-icon" />{" "}
            <span className="nav-label">Sales</span>
          </a>
          <a className="nav-item">
            <FaWallet className="nav-item-icon" />{" "}
            <span className="nav-label">Purchases</span>
          </a>
          <a className="nav-item">
            <FaBox className="nav-item-icon" />{" "}
            <span className="nav-label">Inventory</span>
          </a>

          <div className="expandable-nav">
            <div
              className="nav-item"
              onClick={() => setFiscalOpen(!fiscalOpen)}
            >
              <FaLayer className="nav-item-icon" />{" "}
              <span className="nav-label">Finance</span>
              {fiscalOpen ? (
                <FaChevronDown className="nav-item-chevron" />
              ) : (
                <FaChevronRight className="nav-item-chevron" />
              )}
            </div>
            {fiscalOpen && (
              <div
                className="sub-nav"
                style={{
                  marginLeft: "1.5rem",
                  borderLeft: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                {[
                  "Finance Health",
                  "Loans",
                  "Receipts",
                  "Reconcile",
                  "Analytics",
                  "Ledgers",
                  "Logs",
                ].map((sub) => (
                  <a
                    key={sub}
                    className="nav-item"
                    style={{ fontSize: "0.8rem", padding: "0.5rem 0.75rem" }}
                  >
                    {sub}
                  </a>
                ))}
              </div>
            )}
          </div>
          <a className="nav-item">
            <FaUsers className="nav-item-icon" />{" "}
            <span className="nav-label">Employees</span>
          </a>
        </nav>

        <div
          className="sidebar-footer"
          style={{
            marginTop: "auto",
            padding: "1rem 1.5rem",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="nav-item">
            <FaCog /> Settings
          </div>
        </div>
      </motion.aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            zIndex: 45,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="synthesis-main">
        {/* Topbar */}
        <header className="synthesis-topbar">
          <div className="topbar-left">
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                display: window.innerWidth < 1024 ? "flex" : "none",
                background: "#f1f5f9",
                border: "none",
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "2px",
                  background: "#111",
                  position: "relative",
                  boxShadow: "0 5px 0 #111, 0 -5px 0 #111",
                }}
              />
            </button>
            <div className="branch-selector">
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: "#10B981",
                  borderRadius: "50%",
                }}
              ></div>
              DEMO BRANCH 01
              <FaChevronDown style={{ fontSize: "0.7rem" }} />
            </div>
            <div className="topbar-search">
              <FaSearch className="search-icon" />
              <input type="text" placeholder="Search anything..." />
            </div>
          </div>

          <div className="topbar-right">
            <div className="icon-btn">
              <FaBell />
              <span className="notification-badge"></span>
            </div>
            <div className="icon-btn">
              <FaCloudDownloadAlt />
            </div>
            <div className="profile-trigger">
              <img
                src="https://i.pravatar.cc/150?img=47"
                alt="Profile"
                className="profile-img"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
              <div
                className="profile-info"
                style={{ display: "flex", flexDirection: "column" }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Admin User
                </span>
                <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                  System Administrator
                </span>
              </div>
              <FaChevronDown style={{ fontSize: "0.7rem", color: "#94a3b8" }} />
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="content-scrollable">{children}</div>
      </main>
    </div>
  );
};

export default SynthesisLayout;
