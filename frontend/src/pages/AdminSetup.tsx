import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaBuilding,
  FaCheckCircle,
  FaEdit,
  FaGlobe,
  FaMapMarkerAlt,
  FaProjectDiagram,
  FaShieldAlt,
  FaUniversity,
  FaUserShield,
  FaSync,
  FaPlus,
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./PageShared.css";

interface CompanyProfile {
  id: number;
  company_name: string;
  company_code: string;
  gstin?: string;
  address_line1?: string;
  city_pincode?: string;
  state?: string;
  phone?: string;
  email?: string;
}

interface Branch {
  id: number;
  branch_name: string;
  branch_code: string;
  is_active: boolean;
}

const AdminSetup: React.FC = () => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<"PROFILE" | "BRANCHES" | "BILLING" | "SECURITY" | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Security Matrix State
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [mappings, setMappings] = useState<{role_id: number, permission_id: number}[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  // Employee Permission State
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userOverrides, setUserOverrides] = useState<{permission_id: number, is_granted: boolean}[]>([]);
  const [securityMode, setSecurityMode] = useState<"ROLES" | "EMPLOYEES">("ROLES");

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<CompanyProfile>>({});
  
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState<Partial<Branch>>({
    branch_name: "",
    branch_code: "",
    is_active: true
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    fetchData();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (activeItem === "SECURITY") {
      fetchSecurityMatrix();
      fetchStaff();
    }
  }, [activeItem]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserOverrides(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, branchRes] = await Promise.all([
        apiFetch("/company/profile"),
        apiFetch("/branches")
      ]);
      
      const profileData = await profileRes.json();
      const branchData = await branchRes.json();
      
      setProfile(profileData);
      setProfileForm(profileData);
      setBranches(branchData);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityMatrix = async () => {
    try {
      setSecurityLoading(true);
      const res = await apiFetch("/roles/matrix");
      const data = await res.json();
      setRoles(data.roles);
      setPermissions(data.permissions);
      setMappings(data.mappings);
    } catch (err) {
      console.error("Failed to fetch matrix", err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await apiFetch("/users/staff");
      const data = await res.json();
      setStaff(data);
    } catch (err) {
      console.error("Failed to fetch staff", err);
    }
  };

  const fetchUserOverrides = async (userId: number) => {
    try {
      const res = await apiFetch(`/roles/user/${userId}`);
      const data = await res.json();
      setUserOverrides(data);
    } catch (err) {
      console.error("Failed to fetch overrides", err);
    }
  };

  const toggleUserOverride = async (userId: number, permId: number, isGranted: boolean, remove: boolean) => {
    try {
      // Optimistic update
      if (remove) {
        setUserOverrides(userOverrides.filter(o => o.permission_id !== permId));
      } else {
        const existing = userOverrides.find(o => o.permission_id === permId);
        if (existing) {
          setUserOverrides(userOverrides.map(o => o.permission_id === permId ? { ...o, is_granted: isGranted } : o));
        } else {
          setUserOverrides([...userOverrides, { permission_id: permId, is_granted: isGranted }]);
        }
      }

      await apiFetch("/roles/user/toggle", {
        method: "POST",
        body: { user_id: userId, permission_id: permId, is_granted: isGranted, remove }
      });
    } catch (err) {
      alert("Failed to update user override");
      fetchUserOverrides(userId);
    }
  };

  const togglePermission = async (roleId: number, permId: number, enabled: boolean) => {
    try {
      // Optimistic update
      if (enabled) {
        setMappings([...mappings, { role_id: roleId, permission_id: permId }]);
      } else {
        setMappings(mappings.filter(m => !(m.role_id === roleId && m.permission_id === permId)));
      }

      await apiFetch("/roles/toggle", {
        method: "POST",
        body: { role_id: roleId, permission_id: permId, enabled }
      });
    } catch (err) {
      alert("Failed to update permission");
      fetchSecurityMatrix(); // Revert
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/company/profile", {
        method: "PUT",
        body: profileForm
      });
      if (res.ok) {
        setShowEditProfile(false);
        fetchData();
      }
    } catch (err) {
      alert("Failed to update profile");
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!branchToEdit;
      const url = isEdit ? `/branches/${branchToEdit?.id}` : "/branches";
      const method = isEdit ? "PUT" : "POST";
      
      const res = await apiFetch(url, {
        method,
        body: branchForm
      });
      
      if (res.ok) {
        setShowBranchModal(false);
        setBranchToEdit(null);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save branch");
      }
    } catch (err) {
      alert("Network error saving branch");
    }
  };

  const openBranchModal = (branch: Branch | null = null) => {
    if (branch) {
      setBranchToEdit(branch);
      setBranchForm(branch);
    } else {
      setBranchToEdit(null);
      setBranchForm({ branch_name: "", branch_code: "", is_active: true });
    }
    setShowBranchModal(true);
  };

  const menuItems = [
    { id: "PROFILE", label: "Corporate Profile", desc: "Company ID, Legal Details", icon: <FaBuilding />, color: "var(--accent)" },
    { id: "BRANCHES", label: "Regional Branches", desc: "Physical Locations", icon: <FaProjectDiagram />, color: "var(--green)" },
    { id: "BILLING", label: "Finance & Banking", desc: "Payouts, P&L config", icon: <FaUniversity />, color: "#8b5cf6" },
    { id: "SECURITY", label: "Roles & Safety", desc: "Access Control, Logs", icon: <FaUserShield />, color: "var(--red)" },
  ];

  if (loading && !profile) return (
    <div className="page-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
      <div className="fa-spin"><FaSync size={32} color="var(--accent)" /></div>
    </div>
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Admin Setup</h1>
          <p>Configure your enterprise architecture and global parameters.</p>
        </div>
        {!activeItem && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg)", padding: "6px 14px", borderRadius: "50px", border: "1px solid var(--border)" }}>
            <FaShieldAlt size={12} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-3)" }}>{profile?.company_code}</span>
          </div>
        )}
      </div>

      <main style={{ marginTop: "12px" }}>
        <AnimatePresence mode="wait">
          {!activeItem ? (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "16px" }}
            >
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="tx-card"
                  onClick={() => setActiveItem(item.id as any)}
                  style={{ cursor: "pointer", padding: "24px" }}
                >
                  <div className="tx-card-left" style={{ gap: "20px" }}>
                    <div className="tx-icon" style={{ width: "48px", height: "48px", background: "var(--bg)", color: item.color }}>
                      {React.cloneElement(item.icon as any, { size: 20 })}
                    </div>
                    <div>
                      <div className="tx-desc" style={{ fontSize: "16px" }}>{item.label}</div>
                      <div className="tx-poster" style={{ marginTop: "4px" }}>{item.desc}</div>
                    </div>
                  </div>
                  <FaGlobe size={14} style={{ color: "var(--border)", opacity: 0.5 }} />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "260px 1fr", gap: "24px" }}
            >
              {/* Sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button 
                  className="page-btn-round-ghost" 
                  onClick={() => setActiveItem(null)} 
                  style={{ justifyContent: "flex-start", width: "fit-content" }}
                >
                  <FaArrowLeft size={11} /> Back to dashboard
                </button>
                <div className="page-table-wrapper" style={{ padding: "8px" }}>
                  {menuItems.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => setActiveItem(item.id as any)}
                      style={{
                        width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: "8px",
                        border: "none", background: activeItem === item.id ? "var(--accent-bg)" : "transparent",
                        color: activeItem === item.id ? "var(--accent)" : "var(--text-2)",
                        fontWeight: activeItem === item.id ? 600 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                        fontSize: "13px", transition: "0.1s"
                      }}
                    >
                      {React.cloneElement(item.icon as any, { size: 13 })} {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Content */}
              <div className="page-table-wrapper" style={{ minHeight: "400px" }}>
                {activeItem === "PROFILE" && (
                  <div>
                    <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: 600 }}>Corporate Identity</div>
                        <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginTop: "2px" }}>Primary legal details of your business.</div>
                      </div>
                      <button className="page-btn-round page-btn-round-primary" onClick={() => setShowEditProfile(true)}>
                        <FaEdit size={11} /> Update
                      </button>
                    </div>
                    <div style={{ padding: "32px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "24px" }}>
                      {[
                        { label: "Company Name", value: profile?.company_name },
                        { label: "Company Code", value: profile?.company_code, mono: true },
                        { label: "GSTIN", value: profile?.gstin || "Not provided" },
                        { label: "Email Address", value: profile?.email || "Not provided" },
                        { label: "Headquarters", value: [profile?.address_line1, profile?.city_pincode, profile?.state].filter(Boolean).join(", ") || "No address set", full: true }
                      ].map(field => (
                        <div key={field.label} style={{ gridColumn: field.full ? "span 1" : "auto" }}>
                          <div style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "4px" }}>{field.label}</div>
                          <div style={{ fontSize: "14px", fontWeight: 500, fontFamily: field.mono ? "Geist Mono, monospace" : "inherit" }}>{field.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeItem === "BRANCHES" && (
                  <div>
                    <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: 600 }}>Regional Branches</div>
                        <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginTop: "2px" }}>Locations under this company and their status.</div>
                      </div>
                      <button className="page-btn-round page-btn-round-primary" onClick={() => openBranchModal()}>
                        <FaPlus size={11} /> Add Branch
                      </button>
                    </div>
                    <table className="page-table">
                      <thead>
                        <tr>
                          <th>Branch Name</th>
                          <th>Code</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map(b => (
                          <tr key={b.id}>
                            <td><div className="font-bold">{b.branch_name}</div></td>
                            <td><span className="font-mono">{b.branch_code}</span></td>
                            <td>
                              <span className={`type-badge ${b.is_active ? 'type-badge-green' : 'type-badge-slate'}`}>
                                {b.is_active ? 'Active' : 'Offline'}
                              </span>
                            </td>
                            <td className="text-right"><button className="page-btn-round-sm" onClick={() => openBranchModal(b)}><FaEdit size={12} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeItem === "SECURITY" && (
                  <div>
                    <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: 600 }}>Access Control Management</div>
                        <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginTop: "2px" }}>Configure granular permissions by role or individual employee overrides.</div>
                      </div>
                      <div className="type-badge type-badge-slate">Level 2 Safety</div>
                    </div>

                    <div style={{ padding: "16px 32px", borderBottom: "1px solid var(--border)", display: "flex", gap: "24px", background: "var(--bg)" }}>
                      <button 
                        onClick={() => setSecurityMode("ROLES")}
                        style={{ 
                          padding: "8px 16px", borderRadius: "100px", border: "none", 
                          background: securityMode === "ROLES" ? "var(--accent)" : "transparent",
                          color: securityMode === "ROLES" ? "#fff" : "var(--text-3)",
                          fontSize: "12px", fontWeight: 700, cursor: "pointer"
                        }}
                      >
                        Role Matrix
                      </button>
                      <button 
                        onClick={() => setSecurityMode("EMPLOYEES")}
                        style={{ 
                          padding: "8px 16px", borderRadius: "100px", border: "none", 
                          background: securityMode === "EMPLOYEES" ? "var(--accent)" : "transparent",
                          color: securityMode === "EMPLOYEES" ? "#fff" : "var(--text-3)",
                          fontSize: "12px", fontWeight: 700, cursor: "pointer"
                        }}
                      >
                        Employee Overrides
                      </button>
                    </div>

                    {securityMode === "EMPLOYEES" && (
                      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                        <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-2)" }}>Select Employee:</label>
                        <select 
                          value={selectedUserId || ""} 
                          onChange={(e) => setSelectedUserId(Number(e.target.value))}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "#fff", outline: "none" }}
                        >
                          <option value="">-- Choose Staff Member --</option>
                          {staff.map(u => (
                            <option key={u.id} value={u.id}>{u.employee_name || u.username} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {securityLoading ? (
                       <div style={{ padding: "100px", textAlign: "center" }}><FaSync className="fa-spin" /></div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="page-table">
                          <thead>
                            <tr>
                              <th style={{ minWidth: "200px" }}>Permissions Module / Action</th>
                              {securityMode === "ROLES" ? (
                                roles.map(r => (
                                  <th key={r.id} className="text-center" style={{ textTransform: "capitalize" }}>{r.name}</th>
                                ))
                              ) : (
                                <>
                                  <th className="text-center">Role Default</th>
                                  <th className="text-center">Override Action</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Group by Module */}
                            {Array.from(new Set(permissions.map(p => p.module))).map(moduleName => (
                              <React.Fragment key={moduleName}>
                                <tr style={{ backgroundColor: "var(--bg)", fontWeight: 700 }}>
                                  <td colSpan={securityMode === "ROLES" ? roles.length + 1 : 3} style={{ fontSize: "11px", color: "var(--accent)", padding: "10px 20px" }}>
                                    {moduleName.toUpperCase()} MODULE
                                  </td>
                                </tr>
                                {permissions.filter(p => p.module === moduleName).map(p => {
                                  if (securityMode === "ROLES") {
                                    return (
                                      <tr key={p.id}>
                                        <td style={{ paddingLeft: "32px" }}>
                                          <div style={{ fontSize: "13px", fontWeight: 500 }}>{p.description || p.action}</div>
                                          <div style={{ fontSize: "10px", color: "var(--text-3)" }}>{p.action}</div>
                                        </td>
                                        {roles.map(r => {
                                          const isEnabled = mappings.some(m => m.role_id === r.id && m.permission_id === p.id);
                                          return (
                                            <td key={r.id} className="text-center">
                                              <input 
                                                type="checkbox" 
                                                checked={isEnabled}
                                                onChange={(e) => togglePermission(r.id, p.id, e.target.checked)}
                                                style={{ width: "18px", height: "18px", cursor: "pointer" }}
                                              />
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  } else {
                                    // EMPLOYEE MODE
                                    const currentUser = staff.find(u => u.id === selectedUserId);
                                    const userRoleId = roles.find(r => r.name.toLowerCase() === currentUser?.role?.toLowerCase())?.id;
                                    const isRoleDefault = mappings.some(m => m.role_id === userRoleId && m.permission_id === p.id);
                                    const override = userOverrides.find(o => o.permission_id === p.id);
                                    const isEffective = override ? override.is_granted : isRoleDefault;

                                    return (
                                      <tr key={p.id} style={{ opacity: selectedUserId ? 1 : 0.5 }}>
                                        <td style={{ paddingLeft: "32px" }}>
                                          <div style={{ fontSize: "13px", fontWeight: 500 }}>{p.description || p.action}</div>
                                          <div style={{ fontSize: "10px", color: "var(--text-3)" }}>{p.action}</div>
                                        </td>
                                        <td className="text-center">
                                          <span className={`type-badge ${isRoleDefault ? 'type-badge-green' : 'type-badge-slate'}`} style={{ fontSize: "10px" }}>
                                            {isRoleDefault ? 'Allowed' : 'Denied'}
                                          </span>
                                        </td>
                                        <td className="text-center">
                                          {selectedUserId && (
                                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                              <button 
                                                onClick={() => toggleUserOverride(selectedUserId, p.id, true, override?.is_granted === true)}
                                                style={{ 
                                                  padding: "4px 10px", fontSize: "10px", borderRadius: "4px", border: "1px solid var(--border)",
                                                  background: override?.is_granted === true ? "var(--green)" : "#fff",
                                                  color: override?.is_granted === true ? "#fff" : "var(--text-2)",
                                                  cursor: "pointer"
                                                }}
                                              >
                                                Grant
                                              </button>
                                              <button 
                                                onClick={() => toggleUserOverride(selectedUserId, p.id, false, override?.is_granted === false)}
                                                style={{ 
                                                  padding: "4px 10px", fontSize: "10px", borderRadius: "4px", border: "1px solid var(--border)",
                                                  background: override?.is_granted === false ? "var(--red)" : "#fff",
                                                  color: override?.is_granted === false ? "#fff" : "var(--text-2)",
                                                  cursor: "pointer"
                                                }}
                                              >
                                                Revoke
                                              </button>
                                              {override && (
                                                <button 
                                                  onClick={() => toggleUserOverride(selectedUserId, p.id, false, true)}
                                                  style={{ padding: "4px 8px", fontSize: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
                                                  title="Clear Override"
                                                >
                                                  Reset
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }
                                })}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeItem === "BILLING" && (
                  <div style={{ padding: "60px", textAlign: "center", color: "var(--text-3)" }}>
                    <div style={{ opacity: 0.5, marginBottom: "16px" }}>{menuItems.find(m => m.id === activeItem)?.icon}</div>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>Module Configuration Active</div>
                    <p style={{ fontSize: "12px", marginTop: "4px" }}>Manage these settings through the platform administrator console.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditProfile && (
          <div className="page-modal-overlay">
            <motion.div 
              className="page-modal"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <h2>Edit Profile</h2>
              <form onSubmit={handleUpdateProfile}>
                <label>Company Name</label>
                <input 
                  value={profileForm.company_name}
                  onChange={e => setProfileForm({...profileForm, company_name: e.target.value})}
                  required
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label>GSTIN</label>
                    <input 
                      value={profileForm.gstin}
                      onChange={e => setProfileForm({...profileForm, gstin: e.target.value})}
                    />
                  </div>
                  <div>
                    <label>Email</label>
                    <input 
                      value={profileForm.email}
                      onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                    />
                  </div>
                </div>
                <label>Address</label>
                <input 
                  value={profileForm.address_line1}
                  onChange={e => setProfileForm({...profileForm, address_line1: e.target.value})}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label>City & Pin</label>
                    <input 
                      value={profileForm.city_pincode}
                      onChange={e => setProfileForm({...profileForm, city_pincode: e.target.value})}
                    />
                  </div>
                  <div>
                    <label>State</label>
                    <input 
                      value={profileForm.state}
                      onChange={e => setProfileForm({...profileForm, state: e.target.value})}
                    />
                  </div>
                </div>
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowEditProfile(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" style={{ flex: 1 }}>Save Identity</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Branch Modal */}
      <AnimatePresence>
        {showBranchModal && (
          <div className="page-modal-overlay">
            <motion.div 
              className="page-modal"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <h2>{branchToEdit ? "Edit Branch" : "Add New Branch"}</h2>
              <form onSubmit={handleSaveBranch}>
                <label>Branch Name</label>
                <input 
                  value={branchForm.branch_name}
                  onChange={e => setBranchForm({...branchForm, branch_name: e.target.value})}
                  placeholder="e.g. New York Office"
                  required
                />
                <label>Branch Code</label>
                <input 
                  value={branchForm.branch_code}
                  onChange={e => setBranchForm({...branchForm, branch_code: e.target.value})}
                  placeholder="e.g. NY-001"
                  required
                />
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
                   <input 
                     type="checkbox" 
                     checked={branchForm.is_active} 
                     onChange={e => setBranchForm({...branchForm, is_active: e.target.checked})}
                     style={{ width: "auto", margin: 0 }}
                   />
                   <span style={{ fontSize: "13px", fontWeight: 600 }}>Active - Operational status</span>
                </div>
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowBranchModal(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary" style={{ flex: 1 }}>
                    {branchToEdit ? "Update Node" : "Authorize Node"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSetup;
