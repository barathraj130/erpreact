import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaDownload, FaExclamationCircle, FaWallet } from 'react-icons/fa';
import { apiFetch } from '../../utils/api';

const MyLedger: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // Fetches summary + transactions for logged-in user
                const res = await apiFetch('/portal/my-ledger');
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error("Ledger Load Error:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    if (loading) return <div style={{padding: 40, textAlign: 'center', color: '#64748b'}}>Loading your financial data...</div>;

    const { summary, transactions } = data || { summary: {}, transactions: [] };

    return (
        <div>
            <div style={{marginBottom: '30px'}}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b' }}>My Ledger</h1>
                <p style={{ color: '#64748b' }}>Track your invoices, payments, and outstanding balance.</p>
            </div>

            {/* --- SUMMARY CARDS --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {/* Total Billed */}
                <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ color: '#64748b', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaWallet /> Total Invoiced
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b' }}>
                        {fmt(summary?.total_billed)}
                    </div>
                </div>

                {/* Total Paid */}
                <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ color: '#166534', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaCheckCircle /> Total Paid
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#166534' }}>
                        {fmt(summary?.total_paid)}
                    </div>
                </div>

                {/* Pending */}
                <div style={{ background: '#fff7ed', padding: '25px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                    <div style={{ color: '#c2410c', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaExclamationCircle /> Balance Due
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#c2410c' }}>
                        {fmt(summary?.balance_pending)}
                    </div>
                </div>
            </div>

            {/* --- TRANSACTIONS TABLE --- */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, color: '#475569' }}>
                    Transaction History
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#64748b' }}>Date</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#64748b' }}>Invoice #</th>
                            <th style={{ padding: '16px', textAlign: 'right', color: '#64748b' }}>Amount</th>
                            <th style={{ padding: '16px', textAlign: 'right', color: '#64748b' }}>Paid</th>
                            <th style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Status</th>
                            <th style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!transactions || transactions.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No transaction history found.</td></tr>
                        ) : transactions.map((inv: any) => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '16px', fontWeight: 500 }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                <td style={{ padding: '16px', color: '#3b82f6', fontWeight: 600 }}>{inv.invoice_number}</td>
                                <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                                <td style={{ padding: '16px', textAlign: 'right', color: '#166534' }}>{fmt(inv.paid_amount)}</td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <span style={{ 
                                        background: inv.status === 'Paid' ? '#dcfce7' : '#fef9c3', 
                                        color: inv.status === 'Paid' ? '#166534' : '#854d0e',
                                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 
                                    }}>
                                        {inv.status || 'PENDING'}
                                    </span>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    {/* Open PDF in new tab if file_url exists */}
                                    {inv.file_url ? (
                                        <button 
                                            onClick={() => window.open(`http://localhost:3000${inv.file_url}`, '_blank')}
                                            style={{ border: '1px solid #e2e8f0', background: 'white', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
                                            title="Download Invoice"
                                        >
                                            <FaDownload />
                                        </button>
                                    ) : (
                                        <span style={{color: '#cbd5e1'}}>-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MyLedger;