// frontend/src/pages/Dashboard.tsx
import { motion } from 'framer-motion';
import React, { useEffect, useMemo, useState } from 'react';
import {
    FaArrowDown,
    FaArrowUp,
    FaBox,
    FaBrain,
    FaChartLine,
    FaFileInvoice,
    FaSync,
    FaUsers,
    FaWallet
} from 'react-icons/fa';
import { useTenant } from '../context/TenantContext';
import { useAuthUser } from '../hooks/useAuthUser';
import { useInvoices } from '../hooks/useInvoices';
import { useProducts } from '../hooks/useProducts';
import { useUsers } from '../hooks/useUsers';

// --- 📈 ANIMATED KPI COMPONENT ---
const KpiCard = ({ title, value, icon, color, trend, trendType, delay }: any) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="enterprise-card"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: `${color}10`, 
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                }}>
                    {icon}
                </div>
                {trend && (
                    <div style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        color: trendType === 'up' ? 'var(--success)' : 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: trendType === 'up' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '20px'
                    }}>
                        {trendType === 'up' ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />}
                        {trend}
                    </div>
                )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {title}
            </p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {value}
            </h3>
        </motion.div>
    );
};

const Dashboard: React.FC = () => {
    const { user } = useAuthUser();
    const { activeBranch } = useTenant();
    const { customers = [], refresh: refreshUsers } = useUsers();
    const { invoices = [], refresh: refreshInvoices } = useInvoices();
    const { products = [], refresh: refreshProducts } = useProducts();

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([refreshUsers(), refreshInvoices(), refreshProducts()]);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    useEffect(() => { handleRefresh(); }, [activeBranch]);

    const stats = useMemo(() => {
        const totalRevenue = Array.isArray(invoices) ? invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) : 0;
        return {
            revenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
            customers: customers.length || 0,
            invoices: invoices.length || 0,
            health: "99.9%"
        };
    }, [invoices, customers]);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dashboard-container"
            style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
        >
            {/* Header Section */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                    <motion.h1 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}
                    >
                        Welcome Back, <span style={{ color: 'var(--primary)' }}>{user?.username}</span>
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1.1rem', marginTop: '4px' }}
                    >
                        Intelligence Hub | {activeBranch?.branch_name || 'Global Context'}
                    </motion.p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRefresh} 
                        className="btn-secondary"
                        style={{ height: '52px', padding: '0 24px', borderRadius: '14px' }}
                    >
                        <FaSync className={isRefreshing ? 'fa-spin' : ''} /> Sync Neural Link
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary"
                        style={{ height: '52px', padding: '0 28px', borderRadius: '14px' }}
                    >
                        + Initialize Transaction
                    </motion.button>
                </div>
            </header>

            {/* AI Insights Panel - Innovative Design */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="enterprise-card"
                style={{ 
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                    border: 'none',
                    padding: '32px'
                }}
            >
                <div style={{ 
                    padding: '24px', 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                }}>
                    <FaBrain size={40} />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.5px' }}>Neural Forecasting Insight</h4>
                    <p style={{ opacity: 0.9, fontSize: '1rem', maxWidth: '700px', lineHeight: '1.6', fontWeight: 500 }}>
                        Our predictive engine detects a potential <span style={{ fontWeight: 900, color: '#fbbf24' }}>12% demand surge</span> for Industrial Components in your <span style={{ fontWeight: 900 }}>{activeBranch?.branch_name || 'Global'}</span> sector. 
                        Supply chain optimization is ready for immediate deployment.
                    </p>
                </div>
                <motion.button 
                    whileHover={{ scale: 1.05, background: '#fff' }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        padding: '12px 28px', 
                        background: 'rgba(255,255,255,0.9)', 
                        color: 'var(--primary)', 
                        border: 'none', 
                        borderRadius: '12px', 
                        fontWeight: 900, 
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer'
                    }}
                >
                    Authorize Optimization
                </motion.button>

                {/* Decorative Elements */}
                <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.15 }}>
                    <FaChartLine size={180} />
                </div>
            </motion.div>

            {/* KPI Grid */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                <KpiCard title="Fiscal Liquidity" value={stats.revenue} icon={<FaWallet />} color="#6366f1" trend="+14.2%" trendType="up" delay={0.4} />
                <KpiCard title="Strategic Partners" value={stats.customers} icon={<FaUsers />} color="#10b981" trend="+3 New" trendType="up" delay={0.5} />
                <KpiCard title="Neural Sync Health" value={stats.health} icon={<FaSync />} color="#f59e0b" trend="OPTIMAL" trendType="up" delay={0.6} />
                <KpiCard title="Execution Volume" value={stats.invoices} icon={<FaFileInvoice />} color="#8b5cf6" trend="+8.2%" trendType="up" delay={0.7} />
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '32px' }}>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="enterprise-card"
                    style={{ minHeight: '400px', padding: '32px' }}
                >
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.5px' }}>Revenue Trajectory</h3>
                    <div style={{ height: '300px', width: '100%', background: '#f8fafc', borderRadius: '24px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <FaChartLine size={64} style={{ opacity: 0.1, marginBottom: '16px' }} />
                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Analytics Processing...</span>
                        <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>Real-time telemetry stream active</p>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="enterprise-card"
                    style={{ minHeight: '400px', padding: '32px' }}
                >
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.5px' }}>Critical Inventory</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {products.length > 0 ? products.slice(0, 5).map((p, i) => (
                            <motion.div 
                                key={i} 
                                whileHover={{ x: 8 }}
                                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--border-color)' }}
                            >
                                <div style={{ width: '48px', height: '48px', background: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                                    <FaBox size={20} color="var(--primary)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>{p.name}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: '2px 0 0' }}>HASH: {p.sku || 'N/A'}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--primary)' }}>₹{p.selling_price}</span>
                                </div>
                            </motion.div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <FaBox size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                <p style={{ fontWeight: 700 }}>No Inventory Detected</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default Dashboard;