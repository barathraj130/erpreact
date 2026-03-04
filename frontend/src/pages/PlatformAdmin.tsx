// frontend/src/pages/PlatformAdmin.tsx
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FaGlobe, FaLock, FaMicrochip, FaPlus, FaShieldAlt, FaUsers } from "react-icons/fa";
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

export default function PlatformAdmin() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    
    const [newComp, setNewComp] = useState({
        name: "", code: "", admin_email: "", admin_password: "",
        plan_name: "Enterprise", max_branches: 5, max_users: 10,
        enabled_modules: "sales,finance,inventory,hr,ai", expiry_date: ""
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const compRes = await apiFetch('/subscriptions/companies');
            if (compRes.ok) setCompanies(await compRes.json());
        } catch (err) {
            console.error("Link Failure", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiFetch('/company', {
                method: 'POST',
                body: JSON.stringify(newComp)
            });
            if (res.ok) {
                setShowRegisterModal(false);
                fetchStats();
                setNewComp({
                    name: "", code: "", admin_email: "", admin_password: "",
                    plan_name: "Enterprise", max_branches: 5, max_users: 10,
                    enabled_modules: "sales,finance,inventory,hr,ai", expiry_date: ""
                });
            }
        } catch (err) {
            alert("Authorization Refused");
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)' }}>
            <div className="spinner-innovative" />
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', paddingBottom: '100px' }}>
            {/* Command Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', background: 'var(--primary-glow)', borderRadius: '10px', color: 'var(--primary)' }}>
                            <FaShieldAlt />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>Cortex Nexus Global</span>
                    </div>
                    <h1 style={{ fontSize: '3rem', fontWeight: 950, letterSpacing: '-0.04em' }}>Platform <span style={{ color: 'var(--primary)' }}>Control Center</span></h1>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Governing multi-tenant state and engine resources.</p>
                </motion.div>
                
                <button className="btn-enterprise" onClick={() => setShowRegisterModal(true)}>
                    <FaPlus /> Provision New Tenant
                </button>
            </header>

            {/* Global Telemetry */}
            <div className="kpi-grid">
                <StatusCard icon={<FaGlobe />} title="Active Ecosystems" value={companies.length} color="var(--primary)" detail="Live Instances" />
                <StatusCard icon={<FaMicrochip />} title="Engine Load" value="Optimal" color="var(--success)" detail="Neural Core 92%" />
                <StatusCard icon={<FaUsers />} title="Total Registry" value={companies.reduce((a, b) => a + (b.active_users || 0), 0)} color="var(--warning)" detail="Active Sessions" />
                <StatusCard icon={<FaLock />} title="System Auth" value="SECURE" color="var(--text-main)" detail="RSA-4096 Link" />
            </div>

            {/* Managed Entities Table */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="enterprise-table-wrapper"
            >
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Tenant Infrastructure Registry</h3>
                </div>
                <table className="enterprise-table">
                    <thead>
                        <tr>
                            <th>Organization Identity</th>
                            <th>Plan Allocation</th>
                            <th>Resource Quota</th>
                            <th>Status Badge</th>
                            <th style={{ textAlign: 'right' }}>Management</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies.map((comp, idx) => (
                            <motion.tr 
                                key={comp.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + (idx * 0.05) }}
                            >
                                <td>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{comp.company_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>#{comp.company_code} • {comp.gstin || 'SYSTEM_INTERNAL'}</div>
                                </td>
                                <td>
                                    <span className="badge-premium badge-user">{comp.plan_name}</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                            BRANCHES: {comp.active_branches}/{comp.max_branches}
                                        </div>
                                        <div style={{ height: '4px', width: '120px', background: 'var(--border-subtle)', borderRadius: '10px' }}>
                                            <div style={{ height: '100%', width: `${Math.min(((comp.active_branches||0)/(comp.max_branches||1))*100, 100)}%`, background: 'var(--primary)', borderRadius: '10px' }} />
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge-premium ${comp.is_active ? 'badge-user' : 'badge-host'}`} style={{ background: comp.is_active ? 'var(--success-surface)' : 'var(--error-surface)', color: comp.is_active ? 'var(--success)' : 'var(--error)' }}>
                                        {comp.is_active ? 'OPERATIONAL' : 'SUSPENDED'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button className="clickable glass" style={{ fontSize: '0.75rem', fontWeight: 800 }}>CONFIGURE</button>
                                        <button className="clickable glass" style={{ fontSize: '0.75rem', fontWeight: 800 }}>LOGS</button>
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>

            {/* Provisioning Modal */}
            <AnimatePresence>
                {showRegisterModal && (
                    <div className="modal-overlay">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
                            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                            exit={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
                            className="enterprise-card"
                            style={{ width: '600px', padding: '40px', background: 'white', border: '1px solid var(--primary-glow)' }}
                        >
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 950, marginBottom: '8px' }}>Provision <span style={{ color: 'var(--primary)' }}>New Context</span></h2>
                            <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '32px' }}>Initialize a secure tenant partition with resource caps.</p>
                            
                            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="input-block">
                                        <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tenant Entity Name</label>
                                        <input className="input-modern" required value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} placeholder="e.g. Acme Corp" />
                                    </div>
                                    <div className="input-block">
                                        <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Unique Cluster Code</label>
                                        <input className="input-modern" required value={newComp.code} onChange={e => setNewComp({...newComp, code: e.target.value.toUpperCase()})} placeholder="ACME-01" />
                                    </div>
                                </div>
                                <div className="input-block">
                                    <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Superuser Email</label>
                                    <input className="input-modern" type="email" required value={newComp.admin_email} onChange={e => setNewComp({...newComp, admin_email: e.target.value})} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                                    <div className="input-block">
                                        <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Max Branches</label>
                                        <input className="input-modern" type="number" value={newComp.max_branches} onChange={e => setNewComp({...newComp, max_branches: +e.target.value})} />
                                    </div>
                                    <div className="input-block">
                                        <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Max Users</label>
                                        <input className="input-modern" type="number" value={newComp.max_users} onChange={e => setNewComp({...newComp, max_users: +e.target.value})} />
                                    </div>
                                    <div className="input-block">
                                        <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Allocation</label>
                                        <select className="input-modern" value={newComp.plan_name} onChange={e => setNewComp({...newComp, plan_name: e.target.value})}>
                                            <option>Basic</option>
                                            <option>Enterprise</option>
                                            <option>Full Alpha</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                                    <button type="submit" className="btn-enterprise" style={{ flex: 1 }}>Execute Provisioning</button>
                                    <button type="button" className="btn-enterprise glass" style={{ color: 'var(--error)' }} onClick={() => setShowRegisterModal(false)}>Abort</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatusCard({ icon, title, value, color, detail }: any) {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="enterprise-card glass"
            style={{ padding: '24px', borderLeft: `6px solid ${color}` }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ color: color }}>{icon}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, background: 'var(--bg-canvas)', padding: '4px 8px', borderRadius: '6px' }}>{detail}</div>
            </div>
            <p style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</p>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--text-primary)', marginTop: '4px' }}>{value}</h3>
        </motion.div>
    );
}

