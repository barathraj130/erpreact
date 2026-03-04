import React, { useEffect, useState } from 'react';
import { FaCalendarAlt, FaFileInvoiceDollar, FaHistory, FaTimes } from 'react-icons/fa';
import { apiFetch } from '../utils/api';

interface Transaction {
    id: number;
    date: string;
    type: string;
    category: string;
    amount: number;
    description: string;
    lender_name?: string;
    user_name?: string;
}

interface TransactionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: 'supplier' | 'customer';
    entityId: number;
    entityName: string;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
    isOpen,
    onClose,
    entityType,
    entityId,
    entityName
}) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchTransactions();
        }
    }, [isOpen, entityId]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const queryParam = entityType === 'supplier' ? `lender_id=${entityId}` : `user_id=${entityId}`;
            const url = `/transactions?${queryParam}`;
            const response = await apiFetch(url);
            const data = await response.json();
            setTransactions(data);
        } catch (error: any) {
            console.error('❌ Failed to fetch transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const fmt = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getTotalAmount = () => {
        return transactions.reduce((sum, t) => {
            const amt = parseFloat(t.amount.toString());
            if (entityType === 'customer') {
                return t.type === 'INVOICE' || (t.type === 'ADJUSTMENT' && amt >= 0) ? sum + amt : sum - Math.abs(amt);
            } else {
                return t.type === 'BILL' ? sum + amt : sum - amt;
            }
        }, 0);
    };

    if (!isOpen) return null;

    const netBalance = getTotalAmount();

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: isMobile ? '0' : '20px',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div className="card" style={{
                backgroundColor: 'white',
                borderRadius: isMobile ? '0' : '24px',
                width: isMobile ? '100%' : '95%',
                maxWidth: '900px',
                height: isMobile ? '100%' : 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: 'none'
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px 32px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    background: 'linear-gradient(to right, #ffffff, #f8fafc)'
                }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ 
                            width: '56px', height: '56px', borderRadius: '16px', 
                            background: 'var(--primary-glow)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem', boxShadow: '0 8px 16px rgba(37, 99, 235, 0.1)'
                        }}>
                            <FaHistory />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                                Account Ledger
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{entityName}</span>
                                <span style={{ 
                                    fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--primary)',
                                    background: 'var(--primary-glow)', padding: '2px 8px', borderRadius: '6px'
                                }}>
                                    {entityType}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="icon-btn-hover"
                        style={{
                            background: 'white', border: '1px solid var(--border-color)', cursor: 'pointer',
                            padding: '12px', borderRadius: '14px', color: 'var(--text-muted)',
                            boxShadow: 'var(--shadow-sm)'
                        }}
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="custom-scrollbar" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '100px 0' }}>
                            <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
                            <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Deciphering transaction logs...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
                            <FaFileInvoiceDollar size={64} style={{ color: 'var(--text-light)', marginBottom: '20px' }} />
                            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>No Transactions Recorded</p>
                            <p style={{ margin: '8px 0 0', fontWeight: 500 }}>This account has zero financial activity.</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                                <div className="card" style={{ padding: '20px', background: 'white', borderLeft: '4px solid var(--primary)' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entry Volume</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>{transactions.length} Records</div>
                                </div>
                                <div className="card" style={{ padding: '20px', background: 'white', borderLeft: '4px solid ' + (netBalance > 0 ? 'var(--danger)' : 'var(--success)') }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Exposure</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: netBalance > 0 ? 'var(--danger)' : 'var(--success)', marginTop: '4px' }}>
                                        {fmt(netBalance)}
                                    </div>
                                </div>
                            </div>

                            {/* Ledger Table */}
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '800px' }}>
                                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Session Date</th>
                                            <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Transaction Particulars</th>
                                            <th style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Debit (+)</th>
                                            <th style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Credit (-)</th>
                                            <th style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Running Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ backgroundColor: 'white' }}>
                                        {(() => {
                                            let runningBalance = 0;
                                            const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                            
                                            return sorted.map((t) => {
                                                const amt = parseFloat(t.amount.toString());
                                                let dr = 0; let cr = 0;

                                                if (entityType === 'customer') {
                                                    if (t.type === 'INVOICE' || t.type === 'ADJUSTMENT') {
                                                        if (amt >= 0) { dr = amt; runningBalance += amt; }
                                                        else { cr = Math.abs(amt); runningBalance -= Math.abs(amt); }
                                                    } else if (t.type === 'RECEIPT') { cr = amt; runningBalance -= amt; }
                                                } else {
                                                    if (t.type === 'BILL') { cr = amt; runningBalance += amt; }
                                                    else if (t.type === 'PAYMENT' || t.type === 'RECEIPT' || t.type === 'DR') { dr = amt; runningBalance -= amt; }
                                                }

                                                return (
                                                    <tr key={t.id} className="row-hover" style={{ borderBottom: '1px solid var(--bg-body)', transition: 'all 0.2s' }}>
                                                        <td style={{ padding: '16px 20px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <FaCalendarAlt size={12} style={{ color: 'var(--text-light)' }} />
                                                                <span style={{ fontWeight: 650, color: 'var(--text-main)' }}>{formatDate(t.date)}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 20px' }}>
                                                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{t.description}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>{t.type} • {t.category}</div>
                                                        </td>
                                                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: dr > 0 ? 'var(--danger)' : 'var(--text-light)', opacity: dr > 0 ? 1 : 0.3 }}>
                                                            {dr > 0 ? fmt(dr) : '-'}
                                                        </td>
                                                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: cr > 0 ? 'var(--success)' : 'var(--text-light)', opacity: cr > 0 ? 1 : 0.3 }}>
                                                            {cr > 0 ? fmt(cr) : '-'}
                                                        </td>
                                                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 900, color: 'var(--text-main)', fontSize: '1rem' }}>
                                                            {fmt(runningBalance)}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 32px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    background: '#f8fafc'
                }}>
                    <button onClick={onClose} className="btn-primary" style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 800 }}>
                        Done
                    </button>
                </div>
            </div>

            <style>{`
                .row-hover:hover { background-color: #f8fafc; }
                .loading-spinner { width: 40px; height: 40px; border: 4px solid var(--primary-glow); border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};

export default TransactionHistoryModal;
