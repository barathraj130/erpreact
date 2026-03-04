// frontend/src/pages/Branches.tsx
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaBuilding, FaMapMarkerAlt, FaNetworkWired, FaPlus, FaSearch, FaUserTie } from 'react-icons/fa';

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

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const response = await fetch('/api/branches', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('erp-token')}` }
                });
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

    const filteredBranches = branches.filter(b => 
        b.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.branch_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Empire Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.03em' }}>
                        Enterprise <span style={{ color: 'var(--primary)' }}>Footprint</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Monitoring and governance of global branch infrastructure.
                    </p>
                </div>
                <button className="btn-enterprise">
                    <FaPlus /> Authorize New Branch
                </button>
            </div>

            {/* Network Telemetry */}
            <div className="kpi-grid">
                <StatusCard icon={<FaNetworkWired />} title="Total Nodes" value={branches.length} color="var(--primary)" detail="Global Mesh" />
                <StatusCard icon={<FaBuilding />} title="Operational" value={branches.filter(b => b.is_active).length} color="var(--success)" detail="Active Now" />
                <StatusCard icon={<FaMapMarkerAlt />} title="Geographic Spread" value="State-wide" color="var(--warning)" detail="Zone Alpha" />
                <StatusCard icon={<FaUserTie />} title="Managers Active" value={branches.filter(b => b.manager_user_id).length} color="var(--text-main)" detail="Leadership Index" />
            </div>

            {/* Control Bar */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="enterprise-card glass" style={{ padding: '16px 24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <FaSearch color="var(--text-muted)" />
                <input 
                    className="input-modern" 
                    placeholder="Search node by name or unique identifer..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ border: 'none', background: 'transparent', flex: 1 }}
                />
            </motion.div>

            {/* Branch Mesh Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                <AnimatePresence>
                    {loading ? (
                        [1,2,3].map(i => <div key={i} className="enterprise-card glass" style={{ height: '200px' }} />)
                    ) : (
                        filteredBranches.map((branch, idx) => (
                            <motion.div 
                                key={branch.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                whileHover={{ y: -8 }}
                                className="enterprise-card glass"
                                style={{ padding: '32px', borderTop: `5px solid ${branch.is_active ? 'var(--success)' : 'var(--error)'}` }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                    <div style={{ padding: '12px', background: 'var(--bg-canvas)', borderRadius: '12px', color: 'var(--primary)' }}>
                                        <FaBuilding />
                                    </div>
                                    <span className={`badge-premium ${branch.is_active ? 'badge-user' : 'badge-host'}`}>
                                        {branch.is_active ? 'OPERATIONAL' : 'OFFLINE'}
                                    </span>
                                </div>

                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '4px' }}>{branch.branch_name}</h3>
                                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{branch.branch_code || 'NODE-UNDEF'}</p>

                                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        <FaMapMarkerAlt color="var(--text-muted)" /> {branch.location || 'Location Not Sealed'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        <FaUserTie color="var(--text-muted)" /> {branch.manager_user_id ? 'Authenticated Manager' : 'Master Overseer'}
                                    </div>
                                </div>

                                <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)' }}>ID: {branch.id}</span>
                                    <button className="clickable" style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', border: 'none', background: 'none' }}>RECONFIGURE →</button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const StatusCard: React.FC<any> = ({ icon, title, value, color, detail }) => (
    <motion.div 
        whileHover={{ y: -5 }} 
        className="enterprise-card glass" 
        style={{ padding: '24px', borderLeft: `6px solid ${color}` }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ color }}>{icon}</div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{detail}</span>
        </div>
        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'var(--text-primary)', marginTop: '4px' }}>{value}</div>
    </motion.div>
);

export default Branches;
