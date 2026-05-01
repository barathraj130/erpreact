// frontend/src/pages/Branches.tsx
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaBuilding,
  FaMapMarkerAlt,
  FaNetworkWired,
  FaPlus,
  FaSearch,
  FaUserTie,
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./Dashboard.css";
import "./PageShared.css";

interface Branch {
  id: number;
  branch_name: string;
  branch_code: string;
  location: string;
  manager_user_id: number;
  is_active: boolean;
  created_at: string;
}

const Branches: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
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
    fetchBranches();
  }, []);

  const filteredBranches = branches.filter(
    (b) =>
      b.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.branch_code?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="db-page">
      {/* ── Sticky Topbar ── */}
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Platform Hub</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">Branch Network</span>
        </div>
        <div className="db-topbar-right">
          <button className="db-btn db-btn-ghost" onClick={() => window.location.reload()}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 8a6 6 0 1 0 1.2-3.6"/><path d="M2 4v4h4"/>
            </svg>
            Refresh
          </button>
          <button className="db-btn db-btn-primary">
            <FaPlus size={12} />
            Authorize Node
          </button>
        </div>
      </header>

      {/* ── Page Body ── */}
      <div className="db-content">
        {/* Page Header */}
        <div className="db-page-header">
          <div>
            <h1 className="db-page-title">Branch <strong>Assets</strong></h1>
            <p className="db-page-sub">Analytics and monitoring of global branch infrastructure.</p>
          </div>
        </div>

        {/* Global Network KPIs */}
        <div className="db-kpi-grid">
          <div className="db-kpi-card">
            <div className="db-kpi-top">
              <span className="db-kpi-label">Total Branches</span>
              <span className="db-badge bg-blue">{branches.length} Nodes</span>
            </div>
            <div className="db-kpi-value">{branches.length}</div>
            <div className="db-kpi-footer">
              <span className="db-trend">Across all regions</span>
            </div>
          </div>

          <div className="db-kpi-card">
            <div className="db-kpi-top">
              <span className="db-kpi-label">Operational</span>
              <span className="db-badge bg-green">↑ Active</span>
            </div>
            <div className="db-kpi-value" style={{ color: '#16a34a' }}>
              {branches.filter(b => b.is_active).length}
            </div>
            <div className="db-kpi-footer">
              <span>Working Normal</span>
            </div>
          </div>

          <div className="db-kpi-card">
            <div className="db-kpi-top">
              <span className="db-kpi-label">Managers</span>
              <span className="db-badge bg-amber">Staffed</span>
            </div>
            <div className="db-kpi-value">
              {branches.filter(b => b.manager_user_id).length}
            </div>
            <div className="db-kpi-footer">
              <span>Total Active Leaders</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '20px' }}>
          <div className="db-search-wrap" style={{ width: isMobile ? '100% ' : '320px' }}>
            <FaSearch size={14} style={{ position: 'absolute', left: '12px', color: '#9b9b96' }} />
            <input
              className="db-search-input"
              style={{ width: '100%', paddingLeft: '36px', height: '38px', borderRadius: '10px' }}
              placeholder="Filter nodes by ID, name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Branch Mesh Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "12px",
          }}
        >
          <AnimatePresence>
            {loading
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="db-card" style={{ height: "180px", opacity: 0.5 }}>
                     <div className="skeleton" style={{ height: '100%' }}></div>
                  </div>
                ))
              : filteredBranches.map((branch) => {
                  const statusColor = branch.is_active ? "#16a34a" : "#dc2626";
                  return (
                    <motion.div
                      key={branch.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="db-card"
                      style={{ padding: "16px", display: 'flex', flexDirection: 'column', gap: '14px' }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: 32, height: 32, background: '#f7f7f6', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#111' }}>
                            <FaBuilding size={14} />
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>{branch.branch_name}</div>
                            <div style={{ fontSize: "11px", color: "#9b9b96", fontFamily: 'monospace' }}>{branch.branch_code || 'NODE-UNDEFINED'}</div>
                          </div>
                        </div>
                        <span className={`db-status-tag ${branch.is_active ? 'st-paid' : 'st-failed'}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                          <span className="db-s-dot"></span>
                          {branch.is_active ? "Operational" : "Offline"}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#fcfcfc', border: '1px solid #f0f0ee', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#9b9b96', textTransform: 'uppercase', marginBottom: '4px' }}>Location</div>
                          <div style={{ fontSize: '12.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FaMapMarkerAlt size={10} color={statusColor} />
                            {branch.location || "N/A"}
                          </div>
                        </div>
                        <div style={{ background: '#fcfcfc', border: '1px solid #f0f0ee', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#9b9b96', textTransform: 'uppercase', marginBottom: '4px' }}>Manager</div>
                          <div style={{ fontSize: '12.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FaUserTie size={10} color={statusColor} />
                            {branch.manager_user_id ? "Assigned" : "Unassigned"}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f0f0ee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#9b9b96' }}>Branch ID: {branch.id}</span>
                        <button className="db-btn" style={{ padding: '4px 12px', fontSize: '11px', background: '#f7f7f6' }}>
                          Configure Node
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Branches;
