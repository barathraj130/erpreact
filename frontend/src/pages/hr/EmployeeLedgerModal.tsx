import React, { useEffect, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaBook, FaHistory, FaTimes } from 'react-icons/fa';
import { apiFetch } from '../../utils/api';

interface Props {
    employee: any;
    onClose: () => void;
}

const EmployeeLedgerModal: React.FC<Props> = ({ employee, onClose }) => {
    const [ledger, setLedger] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        const loadLedger = async () => {
            try {
                const res = await apiFetch(`/hr/ledger/${employee.id}`);
                const data = await res.json();
                setLedger(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadLedger();
        return () => window.removeEventListener('resize', handleResize);
    }, [employee.id]);

    const fmt = (n: number) => Number(n).toLocaleString('en-IN', { 
        style: 'currency', 
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    const isMobile = windowWidth <= 640;

    return (
        <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            background: 'rgba(15, 23, 42, 0.4)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 1100,
            padding: '20px'
        }}>
            <div className="page-transition" style={{ 
                background: 'rgba(255, 255, 255, 0.95)', 
                width: '100%',
                maxWidth: '850px', 
                borderRadius: '24px', 
                padding: isMobile ? '20px' : '32px', 
                maxHeight: '90vh', 
                display: 'flex', 
                flexDirection: 'column',
                boxShadow: 'var(--shadow-glass)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                position: 'relative'
            }}>
                
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    style={{ 
                        position: 'absolute',
                        top: '24px',
                        right: '24px',
                        border: 'none', 
                        background: 'var(--bg-body)', 
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--danger)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-body)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                >
                    <FaTimes />
                </button>

                {/* Header */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', alignItems: 'center' }}>
                    <div style={{ 
                        width: '64px',
                        height: '64px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1.5rem',
                        boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)'
                    }}>
                        {employee.name ? employee.name.charAt(0).toUpperCase() : <FaBook />}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ 
                            margin: 0, 
                            color: 'var(--text-main)', 
                            fontSize: isMobile ? '1.25rem' : '1.75rem', 
                            fontWeight: 800,
                            letterSpacing: '-0.5px'
                        }}>
                            {employee.name}'s Ledger
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem', 
                                color: 'var(--primary)',
                                background: 'var(--primary-glow)',
                                padding: '2px 10px',
                                borderRadius: '12px',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>
                                <FaHistory size={10} /> Salary Advance History
                            </span>
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="custom-scrollbar" style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '16px',
                    background: 'white'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction Details</th>
                                {!isMobile && <th style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Debit (+)</th>}
                                {!isMobile && <th style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit (-)</th>}
                                <th style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={isMobile ? 3 : 5} style={{ padding: '40px', textAlign: 'center' }}>
                                        <div className="flex-center" style={{ flexDirection: 'column', gap: '12px' }}>
                                            <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Fetching transaction records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : ledger.length === 0 ? (
                                <tr>
                                    <td colSpan={isMobile ? 3 : 5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                                        <div style={{ opacity: 0.4 }}>
                                            <FaBook size={48} style={{ marginBottom: '16px', color: 'var(--text-light)' }} />
                                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>No history found</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>This employee has no salary advance or repayment history.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                ledger.map((row, i) => {
                                    const isAdvance = row.type === 'ADVANCE';
                                    return (
                                        <tr key={i} className="row-hover" style={{ borderBottom: '1px solid var(--bg-body)', transition: 'background-color 0.2s' }}>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(row.date).getFullYear()}</div>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ 
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.7rem',
                                                        background: isAdvance ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                        color: isAdvance ? 'var(--danger)' : 'var(--success)'
                                                    }}>
                                                        {isAdvance ? <FaArrowUp /> : <FaArrowDown />}
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '0.85rem', 
                                                        fontWeight: 700,
                                                        color: 'var(--text-main)'
                                                    }}>
                                                        {isAdvance ? 'Advance' : 'Repayment'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>
                                                    {row.description || 'No remarks provided'}
                                                </div>
                                                {isMobile && (
                                                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                                                        <span style={{ fontSize: '0.75rem', color: isAdvance ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                                                            {isAdvance ? '+' : '-'} {fmt(row.amount)}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            {!isMobile && (
                                                <td style={{ padding: '16px 20px', textAlign: 'right', color: isAdvance ? 'var(--danger)' : 'var(--text-light)', fontWeight: 700 }}>
                                                    {isAdvance ? fmt(row.amount) : '-'}
                                                </td>
                                            )}
                                            {!isMobile && (
                                                <td style={{ padding: '16px 20px', textAlign: 'right', color: !isAdvance ? 'var(--success)' : 'var(--text-light)', fontWeight: 700 }}>
                                                    {!isAdvance ? fmt(row.amount) : '-'}
                                                </td>
                                            )}
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <div style={{ 
                                                    fontWeight: 800, 
                                                    color: row.running_balance > 0 ? 'var(--text-main)' : 'var(--success)',
                                                    fontSize: '1rem'
                                                }}>
                                                    {fmt(row.running_balance)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Section */}
                <div style={{ 
                    marginTop: '24px', 
                    padding: '20px 24px', 
                    background: 'var(--bg-body)', 
                    borderRadius: '16px',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transactions</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{ledger.length}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Updated</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {ledger.length > 0 ? new Date(ledger[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Due Amount</div>
                        <div style={{ 
                            fontSize: isMobile ? '1.5rem' : '2rem', 
                            fontWeight: 900, 
                            color: ledger.length > 0 && ledger[ledger.length - 1].running_balance > 0 ? 'var(--danger)' : 'var(--success)',
                            lineHeight: 1,
                            marginTop: '4px'
                        }}>
                            {ledger.length > 0 ? fmt(ledger[ledger.length - 1].running_balance) : '₹0'}
                        </div>
                    </div>
                </div>

                <style>{`
                    .row-hover:hover {
                        background-color: #f8fafc !important;
                    }
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 10px;
                    }
                    .skeleton {
                        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                        background-size: 200% 100%;
                        animation: loading 1.5s infinite;
                    }
                    @keyframes loading {
                        0% { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default EmployeeLedgerModal;