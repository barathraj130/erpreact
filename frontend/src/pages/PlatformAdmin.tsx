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
  monthly_price?: number;
  quarterly_price?: number;
  yearly_price?: number;
  billing_cycle?: string;
  trial_ends_at?: string;
}

interface DashboardStats {
  total_tenants: number;
  total_users: number;
  mrr: number;
  status_counts: Record<string, number>;
  expiring_soon: number;
}

interface Props {
  tab?: string;
}

const DEFAULT_NEW_COMP = {
  name: "",
  code: "",
  admin_email: "",
  admin_password: "",
  plan_name: "Enterprise",
  max_branches: 5,
  max_users: 10,
  enabled_modules: "sales,finance,inventory,hr,ai",
  expiry_date: "",
  monthly_price: 0,
  quarterly_price: 0,
  yearly_price: 0,
  billing_cycle: "monthly",
  max_invoices_per_month: 500,
  trial_days: 0,
};

export default function PlatformAdmin({ tab = "hub" }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [selectedCreds, setSelectedCreds] = useState<any>(null);
  const [detailTenantId, setDetailTenantId] = useState<number | null>(null);

  const [newComp, setNewComp] = useState<any>(DEFAULT_NEW_COMP);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStats();
    fetchModules();
  }, []);

  const fetchStats = async () => {
    try {
      const compRes = await apiFetch("/subscriptions/companies");
      if (compRes.ok) setCompanies(await compRes.json());
      const statsRes = await apiFetch("/subscriptions/dashboard-stats");
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to load", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await apiFetch("/subscriptions/modules");
      if (res.ok) setModules(await res.json());
    } catch (err) {
      console.error("Failed to load modules", err);
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
        setNewComp(DEFAULT_NEW_COMP);
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
                      <button className="action-btn-v2" style={{ color: "var(--pa-accent)" }} onClick={() => setDetailTenantId(comp.id)}>Configure</button>
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
          {showRegisterModal && <ProvisionModal onClose={() => setShowRegisterModal(false)} onSubmit={handleRegister} data={newComp} setData={setNewComp} modules={modules} />}
          {showCredsModal && selectedCreds && <CredentialsModal onClose={() => setShowCredsModal(false)} creds={selectedCreds} />}
          {detailTenantId != null && (
            <TenantDetailPanel
              tenantId={detailTenantId}
              modules={modules}
              onClose={() => setDetailTenantId(null)}
              onChanged={fetchStats}
            />
          )}
        </AnimatePresence>
      </div>
    );

  // Default: Hub (Dashboard)
  return (
    <div className="platform-admin-v2">
      <Header title="Dashboard" sub="Platform Overview" />

      {/* Alert */}
      {stats && stats.expiring_soon > 0 && (
        <div className="alert-strip">
          <FaExclamationTriangle />
          <span><strong>{stats.expiring_soon} tenant{stats.expiring_soon === 1 ? "" : "s"}</strong> expiring or trial-ending within 7 days — review before they lapse.</span>
          <button className="pa-btn" style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "12px" }} onClick={() => (window.location.hash = "#/platform-admin/tenants")}>Review</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          label="Active Companies"
          badge={{ text: "Registered", class: "badge-green" }}
          value={stats?.total_tenants ?? companies.length}
          detail={`${stats?.status_counts?.ACTIVE ?? 0} active · ${stats?.status_counts?.TRIAL ?? 0} trial`}
        />
        <StatCard
          label="Total Users"
          badge={{ text: "Active", class: "badge-blue" }}
          value={stats?.total_users ?? companies.reduce((a, b) => a + (b.active_users || 0), 0)}
          detail="Across all tenants"
        />
        <StatCard
          label="MRR"
          badge={{ text: "Revenue", class: "badge-green" }}
          value={`₹${(stats?.mrr ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          detail="Monthly recurring revenue"
          color="var(--pa-green)"
        />
        <StatCard
          label="Suspended / Cancelled"
          badge={{ text: "Attention", class: "badge-amber" }}
          value={(stats?.status_counts?.SUSPENDED ?? 0) + (stats?.status_counts?.CANCELLED ?? 0)}
          detail="Tenants not currently billed"
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

const FeatureChecklist = ({ modules, selected, onToggle }: { modules: any[]; selected: Set<string>; onToggle: (key: string) => void }) => {
  const byCategory: Record<string, any[]> = {};
  for (const m of modules) {
    (byCategory[m.category] = byCategory[m.category] || []).push(m);
  }
  return (
    <div className="pa-feature-grid">
      {Object.entries(byCategory).map(([category, mods]) => (
        <div key={category} className="pa-feature-category">
          <div className="pa-feature-category-title">{category}</div>
          {mods.map((m) => (
            <label key={m.module_key} className="pa-feature-item">
              <input type="checkbox" checked={selected.has(m.module_key)} onChange={() => onToggle(m.module_key)} />
              <span>{m.module_name}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
};

const ProvisionModal = ({ onClose, onSubmit, data, setData, modules }: any) => {
  const selected = new Set<string>(String(data.enabled_modules || "").split(",").map((s: string) => s.trim()).filter(Boolean));
  const toggleModule = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setData({ ...data, enabled_modules: Array.from(next).join(",") });
  };

  return (
  <div className="pa-modal-overlay">
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pa-modal-card" style={{ maxWidth: "680px", maxHeight: "88vh", overflowY: "auto" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="pa-form-group">
            <label className="pa-label">Max Invoices / Month</label>
            <input className="pa-input" type="number" value={data.max_invoices_per_month} onChange={e => setData({...data, max_invoices_per_month: e.target.value})} />
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Trial Days (0 = no trial)</label>
            <input className="pa-input" type="number" min={0} value={data.trial_days} onChange={e => setData({...data, trial_days: e.target.value})} />
          </div>
        </div>

        <div className="pa-form-group">
          <label className="pa-label">Billing Cycle</label>
          <div className="pa-segmented">
            {["monthly", "quarterly", "yearly"].map(cycle => (
              <button
                key={cycle}
                type="button"
                className={`pa-segmented-btn ${data.billing_cycle === cycle ? "active" : ""}`}
                onClick={() => setData({ ...data, billing_cycle: cycle })}
              >
                {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div className="pa-form-group">
            <label className="pa-label">Monthly Price (₹)</label>
            <input className="pa-input" type="number" min={0} value={data.monthly_price} onChange={e => setData({...data, monthly_price: e.target.value})} />
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Quarterly Price (₹)</label>
            <input className="pa-input" type="number" min={0} value={data.quarterly_price} onChange={e => setData({...data, quarterly_price: e.target.value})} />
          </div>
          <div className="pa-form-group">
            <label className="pa-label">Yearly Price (₹)</label>
            <input className="pa-input" type="number" min={0} value={data.yearly_price} onChange={e => setData({...data, yearly_price: e.target.value})} />
          </div>
        </div>

        <div className="pa-form-group">
          <label className="pa-label">Enabled Features</label>
          <FeatureChecklist modules={modules} selected={selected} onToggle={toggleModule} />
        </div>

        <div className="pa-modal-footer">
          <button type="button" className="pa-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="pa-btn pa-btn-primary">Provision Tenant</button>
        </div>
      </form>
    </motion.div>
  </div>
  );
};

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

// --- Tenant Detail Panel ---

const TenantDetailPanel = ({ tenantId, modules, onClose, onChanged }: { tenantId: number; modules: any[]; onClose: () => void; onChanged: () => void }) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "pricing" | "users">("overview");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/subscriptions/companies/${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
        setForm({
          max_branches: data.max_branches ?? 1,
          max_users: data.max_users ?? 5,
          max_invoices_per_month: data.max_invoices_per_month ?? 500,
          expiry_date: data.expiry_date ? String(data.expiry_date).slice(0, 10) : "",
          monthly_price: data.monthly_price ?? 0,
          quarterly_price: data.quarterly_price ?? 0,
          yearly_price: data.yearly_price ?? 0,
          billing_cycle: data.billing_cycle ?? "monthly",
          enabled_modules: data.enabled_modules ?? "",
        });
      }
    } catch (err) {
      console.error("Failed to load tenant detail", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (fields: any) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/subscriptions/companies/${tenantId}`, {
        method: "PUT",
        body: JSON.stringify({ subscription_id: detail.subscription_id, ...fields }),
      });
      if (res.ok) {
        await load();
        onChanged();
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!window.confirm(`Set tenant status to ${status}?`)) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/subscriptions/companies/${tenantId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await load();
        onChanged();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update status.");
      }
    } catch (err) {
      alert("Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !detail || !form) {
    return (
      <div className="pa-modal-overlay">
        <div className="pa-modal-card" style={{ maxWidth: "760px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
          <div className="spinner-innovative" />
        </div>
      </div>
    );
  }

  const selectedModules = new Set<string>(String(form.enabled_modules || "").split(",").map((s: string) => s.trim()).filter(Boolean));
  const toggleModule = (key: string) => {
    const next = new Set(selectedModules);
    if (next.has(key)) next.delete(key); else next.add(key);
    setForm({ ...form, enabled_modules: Array.from(next).join(",") });
  };

  return (
    <div className="pa-modal-overlay">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pa-modal-card" style={{ maxWidth: "760px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{detail.company_name}</h2>
            <p style={{ color: "var(--pa-text-muted)", fontSize: "13px", margin: "4px 0 0" }}>#{detail.company_code} · {detail.plan_name}</p>
          </div>
          <span className={`status-tag ${detail.sub_status === "ACTIVE" || detail.sub_status === "TRIAL" ? "status-active" : "status-inactive"}`}>
            <span className="status-pa-dot"></span>{detail.sub_status}
          </span>
        </div>

        <div className="pa-tab-bar">
          {(["overview", "features", "pricing", "users"] as const).map(t => (
            <button key={t} className={`pa-tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div>
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "20px" }}>
              <StatCardMini label="Branches" value={`${detail.active_branches ?? 0} / ${detail.max_branches ?? "∞"}`} />
              <StatCardMini label="Users" value={`${(detail.users || []).length} / ${detail.max_users ?? "∞"}`} />
              <StatCardMini label="Features Enabled" value={selectedModules.size} />
            </div>
            {detail.trial_ends_at && (
              <p style={{ fontSize: "13px", color: "var(--pa-text-muted)", marginBottom: "16px" }}>Trial ends: <strong>{String(detail.trial_ends_at).slice(0, 10)}</strong></p>
            )}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="pa-btn" disabled={saving} onClick={() => changeStatus("ACTIVE")}>Activate</button>
              <button className="pa-btn" disabled={saving} onClick={() => changeStatus("SUSPENDED")} style={{ color: "var(--pa-amber)" }}>Suspend</button>
              <button className="pa-btn" disabled={saving} onClick={() => changeStatus("CANCELLED")} style={{ color: "var(--pa-red)" }}>Cancel Subscription</button>
            </div>
          </div>
        )}

        {activeTab === "features" && (
          <div>
            <FeatureChecklist modules={modules} selected={selectedModules} onToggle={toggleModule} />
            <div className="pa-modal-footer">
              <button className="pa-btn pa-btn-primary" disabled={saving} onClick={() => saveConfig({ enabled_modules: form.enabled_modules })}>
                {saving ? "Saving…" : "Save Features"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "pricing" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div className="pa-form-group">
                <label className="pa-label">Monthly Price (₹)</label>
                <input className="pa-input" type="number" min={0} value={form.monthly_price} onChange={e => setForm({ ...form, monthly_price: e.target.value })} />
              </div>
              <div className="pa-form-group">
                <label className="pa-label">Quarterly Price (₹)</label>
                <input className="pa-input" type="number" min={0} value={form.quarterly_price} onChange={e => setForm({ ...form, quarterly_price: e.target.value })} />
              </div>
              <div className="pa-form-group">
                <label className="pa-label">Yearly Price (₹)</label>
                <input className="pa-input" type="number" min={0} value={form.yearly_price} onChange={e => setForm({ ...form, yearly_price: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="pa-form-group">
                <label className="pa-label">Max Branches</label>
                <input className="pa-input" type="number" value={form.max_branches} onChange={e => setForm({ ...form, max_branches: e.target.value })} />
              </div>
              <div className="pa-form-group">
                <label className="pa-label">Max Users</label>
                <input className="pa-input" type="number" value={form.max_users} onChange={e => setForm({ ...form, max_users: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="pa-form-group">
                <label className="pa-label">Max Invoices / Month</label>
                <input className="pa-input" type="number" value={form.max_invoices_per_month} onChange={e => setForm({ ...form, max_invoices_per_month: e.target.value })} />
              </div>
              <div className="pa-form-group">
                <label className="pa-label">Expiry Date</label>
                <input className="pa-input" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div className="pa-modal-footer">
              <button
                className="pa-btn pa-btn-primary"
                disabled={saving}
                onClick={() => saveConfig({
                  max_branches: form.max_branches, max_users: form.max_users,
                  max_invoices_per_month: form.max_invoices_per_month, expiry_date: form.expiry_date || null,
                  monthly_price: form.monthly_price, quarterly_price: form.quarterly_price, yearly_price: form.yearly_price,
                  billing_cycle: form.billing_cycle,
                })}
              >
                {saving ? "Saving…" : "Save Pricing & Limits"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {(detail.users || []).map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div className="company-name-v2">{u.nickname || u.username}</div>
                      <div className="company-id-v2">{u.email || u.username}</div>
                    </td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`status-tag ${u.is_active ? "status-active" : "status-inactive"}`}>
                        <span className="status-pa-dot"></span>{u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pa-modal-footer">
          <button className="pa-btn" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>
  );
};

const StatCardMini = ({ label, value }: { label: string; value: any }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ fontSize: "20px", marginTop: "6px" }}>{value}</div>
  </div>
);
