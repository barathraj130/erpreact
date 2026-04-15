
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaChartLine, FaCheckCircle, FaRocket, FaShieldAlt, FaTruckLoading, FaUsers } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./AdvancedReports.css";
import "./PageShared.css";

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(Math.round(v));
const cur = (v: number) => "₹" + fmt(v);

const AdvancedReports: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/analytics/world-class")
            .then(res => res.json())
            .then(d => {
                if (d.success) setData(d.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state">Initializing World-Class Intelligence...</div>;

    const health = data?.health_score || 0;
    const procurement = data?.procurement || {};

    return (
        <div className="reports-page">
            <header className="db-topbar">
                <div className="db-topbar-left">
                    <span className="db-topbar-title">Analytics</span>
                    <span className="db-topbar-sep">/</span>
                    <span className="db-topbar-sub">World-Class Intelligence</span>
                </div>
            </header>

            <div className="reports-grid">
                {/* Hero: Health Score */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="report-hero"
                >
                    <div style={{ maxWidth: '60%' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.8px' }}>
                            Operational Health Score
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.6 }}>
                            Our proprietary algorithm evaluates procurement success, fiscal liquidity, 
                            and transaction efficiency to determine your global footprint health.
                        </p>
                        <div style={{ marginTop: '24px', display: 'flex', gap: '20px' }}>
                            <div className="metric-pill">
                                <FaShieldAlt /> System Validated
                            </div>
                            <div className="metric-pill">
                                <FaRocket /> Scaling Optimally
                            </div>
                        </div>
                    </div>

                    <div className="health-gauge">
                        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                            <motion.circle 
                                cx="50" cy="50" r="45" fill="none" stroke="#60a5fa" strokeWidth="8"
                                strokeDasharray="283"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * health) / 100 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </svg>
                        <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <div className="health-gauge-val">{health}%</div>
                            <div style={{ fontSize: '10px', opacity: 0.6 }}>RATING</div>
                        </div>
                    </div>
                </motion.div>

                {/* KPI Cards */}
                <div className="report-card" style={{ gridColumn: 'span 4' }}>
                   <div className="report-card-title"><FaCheckCircle color="#10b981" /> Purchase Success</div>
                   <div className="success-circle">
                        <svg viewBox="0 0 100 100">
                             <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f1f0" strokeWidth="10" />
                             <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="10" 
                                strokeDasharray="251"
                                strokeDashoffset={251 - (251 * procurement.success_rate) / 100}
                                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                             />
                        </svg>
                        <div style={{ position: 'absolute', fontSize: '20px', fontWeight: 700 }}>{procurement.success_rate}%</div>
                   </div>
                   <div style={{ textAlign: 'center', marginTop: '12px', color: '#64748b', fontSize: '12px' }}>
                        Fulfillment Ratio (Paid vs Total Bills)
                   </div>
                </div>

                <div className="report-card" style={{ gridColumn: 'span 4' }}>
                    <div className="report-card-title"><FaChartLine color="#3b82f6" /> Financial Efficiency</div>
                    <div className="metric-v" style={{ fontSize: '40px', marginTop: '20px' }}>{data?.efficiency || 0}%</div>
                    <div style={{ marginTop: '20px' }}>
                        <div style={{ height: '8px', width: '100%', background: '#f1f1f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${data?.efficiency || 0}%`, background: '#3b82f6' }} />
                        </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9b9b96', marginTop: '16px' }}>
                        Calculated based on Revenue vs Procurement Burn Rate.
                    </p>
                </div>

                <div className="report-card" style={{ gridColumn: 'span 4' }}>
                    <div className="report-card-title"><FaTruckLoading color="#f59e0b" /> Procurement Burn</div>
                    <div className="metric-v" style={{ marginTop: '10px' }}>{cur(procurement.metrics?.total_outflow || 0)}</div>
                    <div style={{ marginTop: '24px' }}>
                        <div style={{ fontSize: '12px', color: '#9b9b96', marginBottom: '4px' }}>Avg. Bill Value</div>
                        <div className="metric-v" style={{ fontSize: '18px' }}>{cur(procurement.metrics?.avg_bill_value || 0)}</div>
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                        <span className="badge-glow bg-success-glow">{procurement.metrics?.paid_bills} Paid</span>
                        <span className="badge-glow bg-warning-glow">{procurement.metrics?.pending_bills} Pending</span>
                    </div>
                </div>

                {/* Suppliers & Details */}
                <div className="report-card" style={{ gridColumn: 'span 12' }}>
                    <div className="report-card-title"><FaUsers /> Top Strategic Suppliers</div>
                    <table className="table-glass">
                        <thead>
                            <tr>
                                <th>SUPPLIER NAME</th>
                                <th>VOLUME</th>
                                <th>TRANSACTIONS</th>
                                <th>HEALTH STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(procurement.suppliers || []).map((s: any) => (
                                <tr key={s.name}>
                                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                                    <td>{cur(s.value)}</td>
                                    <td>{s.count} Bills</td>
                                    <td>
                                        <span className="badge-glow bg-success-glow">STRATEGIC</span>
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

export default AdvancedReports;
