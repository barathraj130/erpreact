// frontend/src/pages/TOCDashboard.tsx
import React, { useEffect, useState } from 'react';
import {
    FaBullseye,
    FaExclamationTriangle,
    FaPlus,
    FaSync
} from 'react-icons/fa';
import type { Constraint } from '../api/tocApi';
import { fetchConstraints, fetchTocDashboard } from '../api/tocApi';

const TOCDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [dashboardData, constraintsData] = await Promise.all([
                fetchTocDashboard(),
                fetchConstraints()
            ]);
            setStats(dashboardData);
            setConstraints(constraintsData);
        } catch (error) {
            console.error('Failed to load TOC data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#ef4444';
            case 'ELEVATED': return '#f59e0b';
            case 'RESOLVED': return '#10b981';
            default: return '#6b7280';
        }
    };

    return (
        <div style={{ padding: '0 0 40px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: '1 1 300px' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>
                        Theory of Constraints
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', marginTop: ' 4px' }}>
                        Identify, exploit, and elevate your business bottlenecks.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={loadData}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
                    >
                        <FaSync className={loading ? 'fa-spin' : ''} /> Refresh
                    </button>
                    <button 
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#6366f1' }}
                    >
                        <FaPlus /> New Constraint
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <div style={cardStyle}>
                    <p style={statLabelStyle}>Active Constraints</p>
                    <h3 style={statValueStyle}>{stats?.activeConstraints || 0}</h3>
                    <div style={{ ...badgeStyle, backgroundColor: '#fee2e2', color: '#ef4444' }}>High Priority</div>
                </div>
                <div style={cardStyle}>
                    <p style={statLabelStyle}>Current Throughput</p>
                    <h3 style={statValueStyle}>₹{Number(stats?.latestMetrics?.throughput || 0).toLocaleString('en-IN')}</h3>
                </div>
                <div style={cardStyle}>
                    <p style={statLabelStyle}>Open Actions</p>
                    <h3 style={statValueStyle}>{stats?.pendingActions || 0}</h3>
                </div>
                <div style={cardStyle}>
                    <p style={statLabelStyle}>System ROI</p>
                    <h3 style={statValueStyle}>{stats?.latestMetrics?.return_on_investment || 0}%</h3>
                    <div style={{ ...badgeStyle, backgroundColor: '#e0e7ff', color: '#4f46e5' }}>Healthy</div>
                </div>
            </div>

            {/* Main Content Areas */}
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '2fr 1fr', gap: '24px' }}>
                {/* Active Constraints Table */}
                <div style={{ ...cardStyleBySide, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>System Constraints</h3>
                        <FaExclamationTriangle color="#ef4444" />
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={thStyle}>Constraint Name</th>
                                <th style={thStyle}>Area</th>
                                <th style={thStyle}>Utilization</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</td></tr>
                            ) : constraints.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No constraints identified yet.</td></tr>
                            ) : (
                                constraints.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.constraint_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.constraint_type}</div>
                                        </td>
                                        <td style={tdStyle}>{c.area}</td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ 
                                                        width: `${c.utilization_percent}%`, 
                                                        height: '100%', 
                                                        backgroundColor: c.utilization_percent > 90 ? '#ef4444' : '#6366f1' 
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.utilization_percent}%</span>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '9999px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 600, 
                                                backgroundColor: `${getStatusColor(c.status)}20`,
                                                color: getStatusColor(c.status)
                                            }}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <button style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>

                {/* TOC Methodology Panel */}
                <div style={{ ...cardStyleBySide, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 700 }}>5 Focusing Steps</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {METHODOLOGY_STEPS.map((step, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '50%', 
                                    backgroundColor: step.color, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '0.9rem',
                                    fontWeight: 800,
                                    flexShrink: 0
                                }}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{step.name}</h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button style={{ 
                        marginTop: '32px', 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: 'none', 
                        backgroundColor: '#6366f1', 
                        color: 'white', 
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}>
                        <FaBullseye /> Identify Bottleneck
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Styles ---
const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    border: '1px solid #e2e8f0',
};

const cardStyleBySide: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
};

const statLabelStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.875rem',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.025em'
};

const statValueStyle: React.CSSProperties = {
    margin: '8px 0',
    fontSize: '1.875rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.025em'
};

const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700
};

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '16px 24px',
    fontSize: '0.8rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const tdStyle: React.CSSProperties = {
    padding: '16px 24px',
    fontSize: '0.9rem',
    color: '#1e293b'
};

const METHODOLOGY_STEPS = [
    { name: 'IDENTIFY', desc: 'Find the resource that limits the system from achieving its goal.', color: '#ef4444' },
    { name: 'EXPLOIT', desc: 'Ensure the constraint is never idle and only works on quality parts.', color: '#f59e0b' },
    { name: 'SUBORDINATE', desc: 'Align all non-constraints to the pace of the bottleneck.', color: '#3b82f6' },
    { name: 'ELEVATE', desc: 'Invest in increasing the capacity of the constraint.', color: '#a855f7' },
    { name: 'PREVENT INERTIA', desc: 'Once the constraint is broken, go back to step 1.', color: '#10b981' },
];

export default TOCDashboard;
