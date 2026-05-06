import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FaBoxes, FaCheckCircle, FaRocket, FaShieldAlt, FaTruckLoading, FaUsers } from "react-icons/fa";
import { apiFetch } from "../utils/api";

const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(Math.round(v));
const cur = (v: number) => "₹" + fmt(v);

const AdvancedReports: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/analytics/world-class")
            .then((res: Response) => res.json())
            .then((d: any) => {
                if (d.success) setData(d.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="full-screen-loader">
            <div className="spinner-innovative"></div>
            <div>Initializing World-Class Intelligence...</div>
        </div>
    );

    const health = data?.health_score || 0;
    const procurement = data?.procurement || {};

    return (
        <div className="db-page">
            <header className="db-topbar">
                <div className="db-topbar-left">
                    <span className="db-topbar-title">Analytics</span>
                    <span className="db-topbar-sep">/</span>
                    <span className="db-topbar-sub">World-Class Intelligence</span>
                </div>
            </header>

            <div className="db-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Hero: Health Score */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="enterprise-card"
                    style={{ 
                        display: 'flex', 
                        padding: '36px', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
                    }}
                >
                    <div style={{ maxWidth: '60%' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.8px', color: 'white' }}>
                            Operational Health Score
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '15px', lineHeight: 1.6 }}>
                            Our proprietary algorithm evaluates procurement success, fiscal liquidity, 
                            and transaction efficiency to determine your global footprint health.
                        </p>
                        <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                                <FaShieldAlt /> System Validated
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                                <FaRocket /> Scaling Optimally
                            </div>
                        </div>
                    </div>

                    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                            <motion.circle 
                                cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeWidth="8"
                                strokeDasharray="283"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * health) / 100 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </svg>
                        <div style={{ textAlign: 'center', zIndex: 1 }}>
                            <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1, color: 'white' }}>{health}%</div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.1em', marginTop: '4px' }}>RATING</div>
                        </div>
                    </div>
                </motion.div>

                {/* KPI Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    <div className="enterprise-card" style={{ padding: '24px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-1)', fontWeight: 600, marginBottom: '24px' }}>
                            <FaCheckCircle color="var(--green)" /> Fulfillment Ratio (R2)
                       </div>
                       <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
                                 <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="10" />
                                 <circle cx="50" cy="50" r="40" fill="none" stroke="var(--green)" strokeWidth="10" 
                                     strokeDasharray="251"
                                     strokeDashoffset={251 - (251 * procurement.success_rate) / 100}
                                     style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                 />
                            </svg>
                            <div style={{ fontSize: '24px', fontWeight: 800, zIndex: 1 }}>{procurement.success_rate}%</div>
                       </div>
                       <div style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-2)', fontSize: '13px' }}>
                            Paid vs Total Inflow Cycle
                       </div>
                    </div>

                    <div className="enterprise-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-1)', fontWeight: 600, marginBottom: '24px' }}>
                            <FaBoxes color="var(--accent)" /> Inventory Movement (R1)
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>
                                <span>Total Inflow</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{procurement.inventory?.in || 0} Units</span>
                            </div>
                            <div style={{ height: '8px', width: '100%', background: 'var(--border-soft)', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: '100%', background: 'var(--accent)' }} />
                            </div>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>
                                <span>Total Outflow</span>
                                <span style={{ fontWeight: 700, color: 'var(--red)' }}>{procurement.inventory?.out || 0} Units</span>
                            </div>
                            <div style={{ height: '8px', width: '100%', background: 'var(--border-soft)', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${((procurement.inventory?.out || 0) / (procurement.inventory?.in || 1)) * 100}%`, background: 'var(--red)' }} />
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '16px', fontWeight: 500 }}>
                            Net Stock Rotation: {Math.round(((procurement.inventory?.out || 0) / (procurement.inventory?.in || 1)) * 100)}%
                        </p>
                    </div>

                    <div className="enterprise-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-1)', fontWeight: 600, marginBottom: '24px' }}>
                            <FaTruckLoading color="var(--amber)" /> Procurement Burn
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-1)' }}>{cur(procurement.metrics?.total_outflow || 0)}</div>
                        <div style={{ marginTop: '24px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '4px' }}>Avg. Bill Value</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-2)' }}>{cur(procurement.metrics?.avg_bill_value || 0)}</div>
                        </div>
                        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                            <span className="badge-green" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{procurement.metrics?.paid_bills} Paid</span>
                            <span className="badge-amber" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{procurement.metrics?.pending_bills} Pending</span>
                        </div>
                    </div>
                </div>

                {/* Suppliers & Details */}
                <div className="enterprise-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-1)', fontWeight: 600, marginBottom: '24px' }}>
                        <FaUsers /> Strategic Supplier Performance (R2 Details)
                    </div>
                    <div className="enterprise-table-wrapper">
                        <table className="enterprise-table">
                            <thead>
                                <tr>
                                    <th>SUPPLIER NAME</th>
                                    <th>ORDER VOLUME</th>
                                    <th>TRANSACTIONS</th>
                                    <th>SUCCESS RATE</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(procurement.supplier_performance || []).map((s: { name: string; total_bills: number; success_rate: number }) => (
                                    <tr key={s.name}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</td>
                                        <td>{cur(procurement.suppliers.find((sup:any) => sup.name === s.name)?.value || 0)}</td>
                                        <td>{s.total_bills} Orders</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ flex: 1, height: '6px', background: 'var(--border-soft)', borderRadius: '3px', width: '80px' }}>
                                                    <div style={{ height: '100%', width: `${s.success_rate}%`, background: s.success_rate > 80 ? 'var(--green)' : 'var(--amber)', borderRadius: '3px' }} />
                                                </div>
                                                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-1)' }}>{s.success_rate}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={s.success_rate > 90 ? 'badge-green' : 'badge-amber'} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>
                                                {s.success_rate > 90 ? 'ELITE' : 'STABLE'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedReports;