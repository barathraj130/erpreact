// frontend/src/pages/Reports.tsx
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaBalanceScale, FaCalendarAlt, FaChartBar, FaDownload } from 'react-icons/fa';

interface PLReport {
    details: any[];
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
}

const Reports: React.FC = () => {
    const [report, setReport] = useState<PLReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [dates, setDates] = useState({ 
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0] 
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/accounting/reports/profit-loss?start_date=${dates.start}&end_date=${dates.end}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('erp-token')}` }
            });
            const data = await response.json();
            if (response.ok) setReport(data);
        } catch (error) {
            console.error("Link Error", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [dates]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Header Hub */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.03em' }}>
                        Financial <span style={{ color: 'var(--primary)' }}>Intelligence</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Real-time Profit & Loss and Fiscal Health Analytics.
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="enterprise-card glass" style={{ padding: '8px 16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <FaCalendarAlt color="var(--primary)" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="date" className="input-modern" style={{ background: 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 800 }} value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} />
                            <span style={{ fontWeight: 950, color: 'var(--text-muted)' }}>→</span>
                            <input type="date" className="input-modern" style={{ background: 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 800 }} value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} />
                        </div>
                    </div>
                    <button className="btn-enterprise" style={{ padding: '16px' }}>
                        <FaDownload />
                    </button>
                </div>
            </div>

            {/* P&L Performance Cards */}
            <div className="kpi-grid">
                <PerformanceCard icon={<FaArrowUp />} title="Total Revenue" value={report?.totalIncome || 0} color="var(--success)" detail="Inflow Velocity" />
                <PerformanceCard icon={<FaArrowDown />} title="Operating Costs" value={report?.totalExpense || 0} color="var(--error)" detail="Resource Burn" />
                <PerformanceCard icon={<FaBalanceScale />} title="Fiscal Momentum" value={report?.netProfit || 0} color="var(--text-main)" detail="Net Scalability" isLarge />
            </div>

            {/* P&L Detail Statement */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="enterprise-table-wrapper" style={{ paddingBottom: '40px' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '10px', borderRadius: '10px' }}>
                        <FaChartBar />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Profit & Loss Ledger</h2>
                </div>

                <table className="enterprise-table">
                    <thead>
                        <tr>
                            <th>Fiscal Cluster</th>
                            <th>Entry Classification</th>
                            <th style={{ textAlign: 'right' }}>Financial Velocity (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '100px' }}><div className="spinner-innovative" style={{margin: '0 auto'}} /></td></tr>
                        ) : (
                            <>
                                {report?.details.map((item, idx) => (
                                    <motion.tr 
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <td style={{ fontWeight: 800, fontSize: '1.05rem' }}>{item.account_name}</td>
                                        <td>
                                            <span className={`badge-premium ${item.account_type === 'INCOME' ? 'badge-user' : 'badge-host'}`}>
                                                {item.account_type}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 900, color: item.account_type === 'EXPENSE' ? 'var(--error)' : 'var(--success)' }}>
                                            {item.account_type === 'EXPENSE' ? '(-)' : '(+)'} ₹{Math.abs(parseFloat(item.net_impact)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </motion.tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>

                {report && (
                    <div style={{ padding: '32px', borderTop: '2px solid var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 950 }}>Net Enterprise Profit</span>
                        <span style={{ fontSize: '2rem', fontWeight: 950, color: report.netProfit >= 0 ? 'var(--primary)' : 'var(--error)' }}>
                            ₹{report.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const PerformanceCard: React.FC<any> = ({ icon, title, value, color, detail, isLarge }) => (
    <motion.div 
        whileHover={{ y: -8 }}
        className="enterprise-card glass"
        style={{ padding: '32px', borderTop: `6px solid ${color}`, background: isLarge ? 'var(--text-main)' : undefined, color: isLarge ? 'white' : undefined }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ color: isLarge ? 'white' : color }}>{icon}</div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.6 }}>{detail}</span>
        </div>
        <p style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', opacity: 0.6 }}>{title}</p>
        <h3 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em' }}>
            ₹{Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </h3>
    </motion.div>
);

export default Reports;