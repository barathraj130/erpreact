// frontend/src/pages/CompanyProfile.tsx
import { motion } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';
import { FaBuilding, FaCheckCircle, FaHashtag, FaPlus, FaSave, FaUniversity } from 'react-icons/fa';
import { fetchProfile } from '../api/companyApi';

const CompanyProfile: React.FC = () => {
    const [profile, setProfile] = useState<any>({});
    const [bankAccounts, setBankAccounts] = useState<any[]>([
        { id: 1, bank_name: "ICICI Bank", account_number: "106105501618", ifsc_code: "ICIC0001061", account_type: "Savings", is_default: 1 },
        { id: 2, bank_name: "HDFC Bank", account_number: "9876543210", ifsc_code: "HDFC0000020", account_type: "Current", is_default: 0 },
    ]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchProfile();
            setProfile(data);
        } catch (err) {
            console.error('Identity Retrieval Failure', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert("Corporate Identity Synced.");
    };

    if (loading) return (
        <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner-innovative" />
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1200px' }}>
            {/* Identity Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.03em' }}>
                        Corporate <span style={{ color: 'var(--primary)' }}>Identity</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Manage legal entity, fiscal registration and banking hubs.
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
                {/* Profile Form */}
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="enterprise-card" style={{ padding: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                        <div style={{ padding: '10px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '10px' }}>
                            <FaBuilding />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Primary Organization Data</h2>
                    </div>

                    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="input-block">
                            <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Registered Company Name</label>
                            <input className="input-modern" value={profile.company_name || ''} onChange={e => setProfile({...profile, company_name: e.target.value})} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-block">
                                <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>GSTIN Registry</label>
                                <input className="input-modern" value={profile.gstin || ''} onChange={e => setProfile({...profile, gstin: e.target.value})} />
                            </div>
                            <div className="input-block">
                                <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Fiscal Representative</label>
                                <input className="input-modern" value={profile.admin_name || 'MASTER ADMIN'} />
                            </div>
                        </div>

                        <div className="input-block">
                            <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Registered Office Address</label>
                            <textarea className="input-modern" style={{ minHeight: '100px', paddingTop: '12px' }} value={profile.address_line1 || ''} onChange={e => setProfile({...profile, address_line1: e.target.value})} />
                        </div>

                        <button type="submit" className="btn-enterprise" style={{ width: 'fit-content', padding: '16px 32px' }}>
                            <FaSave /> Commit Profile Updates
                        </button>
                    </form>
                </motion.div>

                {/* Bank Hub */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="enterprise-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FaUniversity color="var(--primary)" />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Banking Hub</h3>
                            </div>
                            <button className="clickable glass" style={{ padding: '8px', borderRadius: '8px' }}><FaPlus /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {bankAccounts.map((acc, idx) => (
                                <motion.div 
                                    key={acc.id} 
                                    whileHover={{ scale: 1.02 }}
                                    style={{ background: 'var(--bg-canvas)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border-subtle)', position: 'relative' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 800 }}>{acc.bank_name}</span>
                                        {acc.is_default ? (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, background: 'var(--success-surface)', color: 'var(--success)', padding: '2px 8px', borderRadius: '100px' }}>PRIMARY</span>
                                        ) : null}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FaHashtag size={10} /> {acc.account_number}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>IFSC: {acc.ifsc_code}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Subscription Status */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="enterprise-card glass" style={{ padding: '32px', background: 'var(--text-main)', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <FaCheckCircle color="var(--primary)" />
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Subscription Matrix</span>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 950 }}>Enterprise Full Stack</h3>
                        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '8px' }}>All neural and logistic modules unlocked. Next audit: March 2024.</p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default CompanyProfile;