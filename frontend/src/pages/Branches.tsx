import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaBuilding,
  FaMapMarkerAlt,
  FaPlus,
  FaSearch,
  FaUserTie,
  FaPhoneAlt,
  FaEnvelope,
  FaWhatsapp,
  FaMoneyBillWave,
  FaBoxes,
  FaChartBar,
  FaExchangeAlt,
  FaCommentDots,
  FaTimes,
  FaEdit,
  FaLock
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./Dashboard.css";
import "./PageShared.css";
import AddBranchModal from "./AddBranchModal";

import { useNavigate } from "react-router-dom";
import { useTenant } from "../context/TenantContext";

interface Branch {
  id: number;
  branch_name: string;
  branch_code: string;
  branch_type: string;
  is_active: boolean;
  address_line1: string;
  city_pincode: string;
  country: string;
  branch_phone: string;
  branch_email: string;
  whatsapp_number: string;
  manager_name: string;
  manager_phone: string;
  manager_email: string;
  login_email?: string; // From the join
  bill_prefix: string;
  gstin: string;
  opening_cash_balance: string;
  created_at: string;
}

const Branches: React.FC = () => {
  const navigate = useNavigate();
  const { setActiveBranch } = useTenant();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);

  const handleBranchAction = (branch: Branch, path: string) => {
    // Set this branch as active so the target page shows its data
    setActiveBranch(branch);
    navigate(path);
  };


  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await apiFetch("/branches");
      const data = await response.json();
      if (response.ok) setBranches(data);
    } catch (error) {
      console.error("Link Loss", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const filteredBranches = branches.filter(
    (b) =>
      b.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.branch_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.city_pincode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="db-page">
      {/* ── Sticky Topbar ── */}
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Admin Setup</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">Branch Network</span>
        </div>
        <div className="db-topbar-right">
          <button className="db-btn db-btn-primary" onClick={() => setIsModalOpen(true)} style={{ background: "#4f46e5", color: "white", border: "none", display: "flex", alignItems: "center", gap: "8px" }}>
            <FaPlus size={12} />
            Add Branch
          </button>
        </div>
      </header>

      {isModalOpen && (
        <AddBranchModal 
          initialData={viewBranch}
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            setViewBranch(null); // Clear view on success
            fetchBranches();
          }} 
        />
      )}

      {/* ── View Branch Detail Modal ── */}
      <AnimatePresence>
        {viewBranch && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ background: "white", width: "100%", maxWidth: "700px", borderRadius: "24px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
                    <div style={{ padding: "25px 30px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#f8fafc" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>{viewBranch.branch_code} — {viewBranch.branch_name}</h2>
                                <span style={{ background: viewBranch.is_active ? "#dcfce7" : "#fee2e2", color: viewBranch.is_active ? "#166534" : "#991b1b", padding: "4px 10px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700 }}>
                                    {viewBranch.is_active ? "🟢 Active" : "🔴 Inactive"}
                                </span>
                            </div>
                            <div style={{ color: "#64748b", fontSize: "0.9rem", display: "flex", gap: "15px" }}>
                                <span>{viewBranch.branch_type || "Sub Branch"}</span>
                                <span>|</span>
                                <span>Since: {new Date(viewBranch.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button 
                                onClick={() => {
                                    setIsModalOpen(true);
                                    // We keep viewBranch open so they can see context, but modal is on top
                                }}
                                style={{ background: "white", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", color: "#475569", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                            >
                                <FaEdit /> Edit
                            </button>
                            <button onClick={() => setViewBranch(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "30px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                            {/* LOCATION & CONTACT */}
                            <div>
                                <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "5px" }}>Location</h3>
                                <div style={{ color: "#1e293b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "20px" }}>
                                    {viewBranch.address_line1}<br/>
                                    {viewBranch.city_pincode}<br/>
                                    {viewBranch.country || "India"}
                                </div>

                                <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "5px" }}>Contact</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", color: "#1e293b", fontSize: "0.95rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><FaPhoneAlt color="#64748b" /> {viewBranch.branch_phone || "N/A"}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><FaEnvelope color="#64748b" /> {viewBranch.branch_email || "N/A"}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><FaWhatsapp color="#22c55e" /> {viewBranch.whatsapp_number || "N/A"}</div>
                                </div>
                            </div>

                            {/* MANAGER & FINANCE */}
                            <div>
                                <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "5px" }}>Manager</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", color: "#1e293b", fontSize: "0.95rem", marginBottom: "20px" }}>
                                    <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{viewBranch.manager_name || "Unassigned"}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><FaPhoneAlt color="#64748b" /> {viewBranch.manager_phone || "N/A"}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><FaEnvelope color="#64748b" /> {viewBranch.manager_email || "N/A"}</div>
                                
                                    <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "5px" }}>Finance</h3>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", color: "#1e293b", fontSize: "0.95rem", marginBottom: "20px" }}>
                                        <div style={{ color: "#64748b" }}>Bill Prefix:</div><div style={{ fontWeight: 700 }}>{viewBranch.bill_prefix || "N/A"}</div>
                                        <div style={{ color: "#64748b" }}>GSTIN:</div><div style={{ fontWeight: 700 }}>{viewBranch.gstin || "N/A"}</div>
                                        <div style={{ color: "#64748b" }}>Cash Bal:</div><div style={{ fontWeight: 700 }}>₹{Number(viewBranch.opening_cash_balance || 0).toLocaleString()}</div>
                                    </div>

                                    <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "5px" }}>Login Credentials</h3>
                                    <div style={{ color: "#1e293b", fontSize: "0.95rem" }}>
                                        <div style={{ color: "#64748b", marginBottom: "4px" }}>Branch Login Email:</div>
                                        <div style={{ fontWeight: 700, color: "#4f46e5", marginBottom: "10px" }}>{viewBranch.login_email || viewBranch.manager_email || "N/A"}</div>
                                        
                                        <button 
                                            onClick={async () => {
                                                const newPwd = window.prompt("Enter new password for this branch:");
                                                if (!newPwd) return;
                                                
                                                try {
                                                    const res = await apiFetch("/branches/reset-password", {
                                                        method: "POST",
                                                        body: { 
                                                            email: viewBranch.login_email || viewBranch.manager_email,
                                                            new_password: newPwd
                                                        }
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        alert("Password reset successfully! They can now login with: " + newPwd);
                                                    } else {
                                                        alert("Error: " + (data.error || "Failed to reset"));
                                                    }
                                                } catch (err) {
                                                    alert("Network error occurred");
                                                }
                                            }}
                                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fee2e2", padding: "6px 12px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                                        >
                                            <FaLock size={10} /> Reset Password
                                        </button>
                                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "8px" }}>Force set a new password for this user</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* QUICK STATS */}
                        <div style={{ background: "#f8fafc", padding: "15px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: "#475569", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase" }}>Quick Stats (Today)</div>
                            <div style={{ display: "flex", gap: "20px", fontWeight: 800, color: "#1e293b" }}>
                                <div>Sales: <span style={{ color: "#4f46e5" }}>₹0</span></div>
                                <div>Bills: <span style={{ color: "#4f46e5" }}>0</span></div>
                                <div>Stock Items: <span style={{ color: "#4f46e5" }}>0</span></div>
                            </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
                            <button onClick={() => handleBranchAction(viewBranch, '/products')} style={{ padding: "12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 700, color: "#475569", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                                <FaBoxes color="#3b82f6" /> View Inventory
                            </button>
                            <button onClick={() => handleBranchAction(viewBranch, '/reports')} style={{ padding: "12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 700, color: "#475569", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                                <FaChartBar color="#8b5cf6" /> View Reports
                            </button>
                            <button onClick={() => handleBranchAction(viewBranch, '/inventory/transfer')} style={{ padding: "12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 700, color: "#475569", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                                <FaExchangeAlt color="#f59e0b" /> Stock Transfers
                            </button>
                            <button onClick={() => handleBranchAction(viewBranch, '/inventory/requests')} style={{ padding: "12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 700, color: "#475569", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                                <FaCommentDots color="#10b981" /> Stock Requests
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* ── Page Body ── */}
      <div className="db-content">
        {/* Global Network KPIs */}
        <div className="db-kpi-grid" style={{ marginBottom: "30px" }}>
          <div className="db-kpi-card" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
            <div className="db-kpi-top">
              <span className="db-kpi-label" style={{ fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Total Branches</span>
              <span className="db-badge bg-blue" style={{ background: "#eff6ff", color: "#3b82f6", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem" }}>Network</span>
            </div>
            <div className="db-kpi-value" style={{ fontSize: "2.5rem", fontWeight: 900, color: "#1e293b", margin: "10px 0" }}>{branches.length}</div>
            <div className="db-kpi-footer" style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>
              Across all regions
            </div>
          </div>

          <div className="db-kpi-card" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
            <div className="db-kpi-top">
              <span className="db-kpi-label" style={{ fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Operational</span>
              <span className="db-badge bg-green" style={{ background: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem" }}>Live</span>
            </div>
            <div className="db-kpi-value" style={{ fontSize: "2.5rem", fontWeight: 900, color: "#16a34a", margin: "10px 0" }}>
              {branches.filter(b => b.is_active).length}
            </div>
            <div className="db-kpi-footer" style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>
              Working Normal
            </div>
          </div>

          <div className="db-kpi-card" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
            <div className="db-kpi-top">
              <span className="db-kpi-label" style={{ fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Managers</span>
              <span className="db-badge bg-amber" style={{ background: "#fef3c7", color: "#d97706", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem" }}>Staffed</span>
            </div>
            <div className="db-kpi-value" style={{ fontSize: "2.5rem", fontWeight: 900, color: "#1e293b", margin: "10px 0" }}>
              {branches.filter(b => b.manager_name).length}
            </div>
            <div className="db-kpi-footer" style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>
              Active Leaders
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '20px', position: "relative", maxWidth: "400px" }}>
            <FaSearch size={14} style={{ position: 'absolute', left: '15px', top: "50%", transform: "translateY(-50%)", color: '#94a3b8' }} />
            <input
              type="text"
              style={{ width: '100%', padding: '14px 14px 14px 45px', borderRadius: '12px', border: "1px solid #e2e8f0", boxSizing: "border-box", fontSize: "1rem" }}
              placeholder="Filter by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Branch List Table */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                        <th style={{ padding: "15px 20px", fontSize: "0.85rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Code</th>
                        <th style={{ padding: "15px 20px", fontSize: "0.85rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Branch Name</th>
                        <th style={{ padding: "15px 20px", fontSize: "0.85rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Type</th>
                        <th style={{ padding: "15px 20px", fontSize: "0.85rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Manager</th>
                        <th style={{ padding: "15px 20px", fontSize: "0.85rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Status</th>
                        <th style={{ padding: "15px 20px", fontSize: "0.85rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading branches...</td></tr>
                    ) : filteredBranches.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No branches found.</td></tr>
                    ) : filteredBranches.map(branch => (
                        <tr key={branch.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "15px 20px", fontWeight: 800, color: "#4f46e5" }}>{branch.branch_code || "N/A"}</td>
                            <td style={{ padding: "15px 20px", fontWeight: 700, color: "#1e293b" }}>
                                {branch.branch_name}
                                <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500, marginTop: "2px" }}>{branch.city_pincode || branch.address_line1}</div>
                            </td>
                            <td style={{ padding: "15px 20px", color: "#64748b", fontWeight: 600 }}>{branch.branch_type || "Sub Branch"}</td>
                            <td style={{ padding: "15px 20px", color: "#1e293b", fontWeight: 600 }}>{branch.manager_name || "Unassigned"}</td>
                            <td style={{ padding: "15px 20px" }}>
                                <span style={{ color: branch.is_active ? "#16a34a" : "#dc2626", fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: branch.is_active ? "#16a34a" : "#dc2626" }}></span>
                                    {branch.is_active ? "Active" : "Inactive"}
                                </span>
                            </td>
                            <td style={{ padding: "15px 20px", textAlign: "right" }}>
                                <button 
                                    onClick={() => setViewBranch(branch)}
                                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 16px", borderRadius: "8px", color: "#475569", fontWeight: 700, cursor: "pointer" }}
                                >
                                    View
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

      </div>
    </div>
  );
};

export default Branches;
