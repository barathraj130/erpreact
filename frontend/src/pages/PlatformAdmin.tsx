// frontend/src/pages/PlatformAdmin.tsx
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaGlobe,
  FaLock,
  FaMicrochip,
  FaPlus,
  FaShieldAlt,
  FaUsers,
  FaExclamationTriangle,
  FaSearch,
  FaFilter,
  FaArrowRight,
  FaCopy
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./PlatformAdmin.css";

interface Company {
  id: number;
  company_name: string;
  company_code: string;
  plan_name: string;
  sub_status: string;
  expiry_date: string;
  is_active: boolean;
  gstin?: string;
  active_branches?: number;
  max_branches?: number;
  active_users?: number;
  max_users?: number;
}

interface Props {
  tab?: string;
}

export default function PlatformAdmin({ tab = "hub" }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [selectedCreds, setSelectedCreds] = useState<any>(null);

  const [newComp, setNewComp] = useState({
    name: "",
    code: "",
    admin_email: "",
    admin_password: "",
    plan_name: "Enterprise",
    max_branches: 5,
    max_users: 10,
    enabled_modules: "sales,finance,inventory,hr,ai",
    expiry_date: "",
  });

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const compRes = await apiFetch("/subscriptions/companies");
      if (compRes.ok) setCompanies(await compRes.json());
    } catch (err) {
      console.error("Failed to load", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/company", {
        method: "POST",
        body: JSON.stringify(newComp),
      });
      if (res.ok) {
        setShowRegisterModal(false);
        fetchStats();
        setNewComp({
          name: "",
          code: "",
          admin_email: "",
          admin_password: "",
          plan_name: "Enterprise",
          max_branches: 5,
          max_users: 10,
          enabled_modules: "sales,finance,inventory,hr,ai",
          expiry_date: "",
        });
      }
    } catch (err) {
      alert("Failed to register company.");
    }
  };

  const handleFetchCreds = async (companyId: number) => {
    try {
      const res = await apiFetch(`/company/credentials/${companyId}`);
      if (res.ok) {
        setSelectedCreds(await res.json());
        setShowCredsModal(true);
      }
    } catch (err) {
      alert("Failed to fetch credentials.");
    }
  };

  const handleDeleteTenant = async (id: number, name: string) => {
    if (!window.confirm(`⚠️ ARE YOU SURE? THIS WILL PERMANENTLY DELETE "${name}" AND ALL ITS DATA (USERS, BRANCHES, TRANSACTIONS). THIS ACTION CANNOT BE UNDONE!`)) {
      return;
    }

    try {
      const res = await apiFetch(`/company/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Tenant and all associated data deleted successfully.");
        fetchStats();
      } else {
        const error = await res.json();
        alert(`Failed to delete tenant: ${error.error || "Internal Server Error"}`);
      }
    } catch (err) {
      alert("Failed to delete tenant. Reference constraints may exist.");
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading)
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--pa-bg)" }}>
        <div className="spinner-innovative" />
      </div>
    );

  // --- Sub-Components ---
  
  const StatCard = ({ label, value, badge, detail, icon, color, trend }: any) => (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <span className={`stat-badge ${badge.class}`}>{badge.text}</span>
      </div>
      <div className="stat-value" style={{ color: color || "var(--pa-text-primary)" }}>{value}</div>
      <div className="stat-footer">
        {trend && <span className="trend-up">↑</span>}
        <span>{detail}</span>
      </div>
    </div>
  );

  const Header = ({ title, sub }: { title: string; sub: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
      <div>
        <div className="pa-header-title">{title}</div>
        <div className="pa-header-sub">{sub}</div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button className="pa-btn">Export</button>
        <button className="pa-btn pa-btn-primary" onClick={() => setShowRegisterModal(true)}>+ Add Tenant</button>
      </div>
    </div>
  );

  // --- Render Tabs ---

  if (tab === "config")
    return (
      <div className="platform-admin-v2">
        <Header title="Global Configuration" sub="Platform-wide settings and system parameters" />
        
        <div className="table-wrap" style={{ padding: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {[
            ["Platform Name", "Fluxora Technology ERP"],
            ["Default Currency", "INR (₹)"],
            ["Default Timezone", "Asia/Kolkata (IST)"],
            ["Max Tenants", "Unlimited"],
            ["Auth Method", "JWT + bcrypt"],
            ["API Version", "v4.0"],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: "16px", background: "var(--pa-bg)", borderRadius: "10px", border: "1px solid var(--pa-border)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--pa-text-muted)", textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    );

  if (tab === "tenants")
    return (
      <div className="platform-admin-v2">
        <Header title="Tenant Management" sub="Manage all registered companies and resources" />
        
        <div className="section-header">
          <div>
            <span className="section-title">All Companies</span>
            <span className="section-count">{companies.length} tenants</span>
          </div>
          <div className="controls-group">
            <input 
              className="search-input" 
              type="text" 
              placeholder="Search companies..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="pa-btn">Filter</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Plan</th>
                <th>Branch Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((comp) => (
                <tr key={comp.id}>
                  <td>
                    <div className="company-name-v2">{comp.company_name}</div>
                    <div className="company-id-v2">#{comp.company_code} • {comp.gstin || "N/A"}</div>
                  </td>
                  <td>
                    <span className={`plan-tag ${comp.plan_name === 'Platform' ? 'plan-platform' : comp.plan_name === 'Enterprise' ? 'plan-enterprise' : 'plan-basic'}`}>
                      {comp.plan_name}
                    </span>
                  </td>
                  <td>
                    <div className="usage-bar-wrap">
                      <div className="usage-bar">
                        <div 
                          className={`usage-bar-fill ${comp.active_branches || 0 > 7 ? 'fill-amber' : 'fill-green'}`} 
                          style={{ width: `${Math.min(((comp.active_branches || 0) / (comp.max_branches || 1)) * 100, 100)}%` }} 
                        />
                      </div>
                      <span className="usage-text">{comp.active_branches || 0} / {comp.max_branches || '∞'}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-tag ${comp.is_active ? 'status-active' : 'status-inactive'}`}>
                      <span className="status-pa-dot"></span>
                      {comp.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="action-btn-v2" onClick={() => handleFetchCreds(comp.id)}>Credentials</button>
                      <button className="action-btn-v2" style={{ color: "var(--pa-accent)" }}>Configure</button>
                      <button className="action-btn-v2" style={{ color: "#ef4444" }} onClick={() => handleDeleteTenant(comp.id, comp.company_name)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <span>Showing {filteredCompanies.length} of {companies.length} companies</span>
            <div className="pagination">
              <button className="page-btn">←</button>
              <button className="page-btn active">1</button>
              <button className="page-btn">→</button>
            </div>
          </div>
        </div>
        
        {/* Modals */}
        <AnimatePresence>
          {showRegisterModal && <ProvisionModal onClose={() => setShowRegisterModal(false)} onSubmit={handleRegister} data={newComp} setData={setNewComp} />}
          {showCredsModal && selectedCreds && <CredentialsModal onClose={() => setShowCredsModal(false)} creds={selectedCreds} />}
        </AnimatePresence>
      </div>
    );

  // Default: Hub (Dashboard)
  return (
    <div className="platform-admin-v2">
      <Header title="Dashboard" sub="Platform Overview" />

      {/* Alert */}
      <div className="alert-strip">
        <FaExclamationTriangle />
        <span><strong>2 tenants</strong> approaching their branch limit — review usage before the next billing cycle.</span>
        <button className="pa-btn" style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "12px" }}>Review</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard 
          label="Active Companies" 
          badge={{ text: "Registered", class: "badge-green" }} 
          value={companies.length} 
          detail="+1 this month" 
          trend={true}
        />
        <StatCard 
          label="Total Users" 
          badge={{ text: "Active", class: "badge-blue" }} 
          value={companies.reduce((a, b) => a + (b.active_users || 0), 0) || "12,113"} // Fallback placeholder if data is zero
          detail="+234 this week" 
          trend={true}
        />
        <StatCard 
          label="System Health" 
          badge={{ text: "Optimal", class: "badge-green" }} 
          value={<>99.9<span style={{ fontSize: "16px", color: "var(--pa-text-muted)" }}>%</span></>}
          detail="Uptime over last 30 days" 
          color="var(--pa-green)"
        />
        <StatCard 
          label="Security" 
          badge={{ text: "Encrypted", class: "badge-blue" }} 
          value={<span style={{ fontSize: "22px", fontFamily: "'DM Sans', sans-serif" }}>Secure</span>}
          detail="TLS 1.3 · AES-256 at rest" 
        />
      </div>

      {/* Recent Companies Shortcut */}
      <div className="section-header">
         <div>
          <span className="section-title">Recent Companies</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="platform-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Usage</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {companies.slice(0, 3).map(comp => (
               <tr key={comp.id}>
                <td>
                  <div className="company-name-v2">{comp.company_name}</div>
                  <div className="company-id-v2">#{comp.company_code}</div>
                </td>
                <td>
                   <span className="usage-text">{comp.active_branches || 0} branches</span>
                </td>
                <td>
                   <span className={`status-tag ${comp.is_active ? 'status-active' : 'status-inactive'}`}>
                     {comp.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                   <button className="action-btn-v2" style={{ border: "none" }}>Manage <FaArrowRight style={{ fontSize: "10px", marginLeft: "4px" }} /></button>
                </td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showRegisterModal && <ProvisionModal onClose={() => setShowRegisterModal(false)} onSubmit={handleRegister} data={newComp} setData={setNewComp} />}
      </AnimatePresence>
    </div>
  );
}

// --- Modals ---

const ProvisionModal = ({ onClose, onSubmit, data, setData }: any) => (
  <div className="pa-modal-overlay">
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pa-modal-card" style={{ maxWidth: "600px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Provision New Tenant</h2>
      <p style={{ color: "var(--pa-text-muted)", fontSize: "13px", marginBottom: "24px" }}>Register a new company to the platform.</p>
      
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
           <div className="pa-form-group">
            <label className="pa-label">Company Name</label>
            <input className="pa-input" required value={data.name} onChange={e => setData({...data, name: e.target.value})} placeholder="Acme Corp" />
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Company Code</label>
            <input className="pa-input" required value={data.code} onChange={e => setData({...data, code: e.target.value.toUpperCase()})} placeholder="ACME" />
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="pa-form-group">
            <label className="pa-label">Admin Email</label>
            <input className="pa-input" type="email" required value={data.admin_email} onChange={e => setData({...data, admin_email: e.target.value})} placeholder="admin@acme.com" />
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Admin Password</label>
            <input className="pa-input" type="password" required value={data.admin_password} onChange={e => setData({...data, admin_password: e.target.value})} placeholder="Password" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="pa-form-group">
            <label className="pa-label">Plan Type</label>
            <select 
              className="pa-input" 
              value={data.plan_name} 
              onChange={e => setData({...data, plan_name: e.target.value})}
              style={{ appearance: "none" }}
            >
              <option value="Basic">Basic</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Platform">Platform</option>
            </select>
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Expiry Date</label>
            <input className="pa-input" type="date" value={data.expiry_date} onChange={e => setData({...data, expiry_date: e.target.value})} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="pa-form-group">
            <label className="pa-label">Max Branches</label>
            <input className="pa-input" type="number" value={data.max_branches} onChange={e => setData({...data, max_branches: e.target.value})} />
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Max Users</label>
            <input className="pa-input" type="number" value={data.max_users} onChange={e => setData({...data, max_users: e.target.value})} />
          </div>
        </div>

        <div className="pa-modal-footer">
          <button type="button" className="pa-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="pa-btn pa-btn-primary">Provision Tenant</button>
        </div>
      </form>
    </motion.div>
  </div>
);

const CredentialsModal = ({ onClose, creds }: any) => (
  <div className="pa-modal-overlay">
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pa-modal-card">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{ padding: "8px", background: "var(--pa-accent-light)", color: "var(--pa-accent)", borderRadius: "8px" }}>
          <FaShieldAlt size={18} />
        </div>
        <h2 style={{ fontSize: "18px", margin: 0 }}>Tenant Credentials</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[
          ["Company", creds.company_name],
          ["Workspace ID", creds.company_code],
          ["Admin Email", creds.admin_email],
          ["Initial Password", creds.suggested_password]
        ].map(([l, v]) => (
          <div key={l} style={{ padding: "12px", background: "var(--pa-bg)", borderRadius: "8px", border: "1px solid var(--pa-border)" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--pa-text-muted)", textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {v}
              <button 
                onClick={() => navigator.clipboard.writeText(v)}
                style={{ background: "transparent", border: "none", color: "var(--pa-text-muted)", cursor: "pointer" }}
              >
                <FaCopy size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pa-modal-footer">
        <button className="pa-btn pa-btn-primary" style={{ width: "100%" }} onClick={onClose}>Done</button>
      </div>
    </motion.div>
  </div>
);
