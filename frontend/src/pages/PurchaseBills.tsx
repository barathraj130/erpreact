import React, { useEffect, useState } from 'react';
import { FaEye, FaFileInvoice, FaPlus, FaSearch, FaSync } from 'react-icons/fa';
import { PurchaseBill, fetchPurchaseBills } from '../api/purchaseBillApi';

const PurchaseBills: React.FC = () => {
    // 1. Initialize with empty array
    const [bills, setBills] = useState<PurchaseBill[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPurchaseBills();
            // 2. Validate data is array before setting
            if (Array.isArray(data)) {
                setBills(data);
            } else {
                setBills([]);
                console.warn("API did not return an array for bills", data);
            }
        } catch (err: any) {
            console.error(err);
            setError("Failed to load purchase bills.");
            setBills([]);
        } finally {
            setLoading(false);
        }
    };

    // 3. Safe Filtering Logic (Memoized)
    const filteredBills = React.useMemo(() => {
        if (!Array.isArray(bills)) return [];
        
        return bills.filter(b => {
            if (!b) return false;
            // Safe access to properties
            const billNo = b.bill_number || '';
            const supplier = b.supplier_name || '';
            const term = searchTerm.toLowerCase();
            
            return billNo.toLowerCase().includes(term) ||
                   supplier.toLowerCase().includes(term);
        });
    }, [bills, searchTerm]);

    const getStatusStyle = (status: string) => {
        const s = (status || '').toUpperCase();
        switch (s) {
            case 'PAID': return { bg: '#dcfce7', text: '#166534' };
            case 'PENDING': return { bg: '#fef9c3', text: '#854d0e' };
            case 'OVERDUE': return { bg: '#fee2e2', text: '#991b1b' };
            default: return { bg: '#f1f5f9', text: '#475569' };
        }
    };

    // Helper for date formatting
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <div>
            {/* Header */}
            <div className="flex-between" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Purchase Bills</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Manage bills received from your suppliers.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                     <button className="btn-secondary" onClick={loadData} title="Refresh" style={{ padding: '10px', cursor: 'pointer' }}>
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </button>
                    <button className="btn-primary" onClick={() => alert("Create Bill Modal coming soon")} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaPlus /> Record Bill
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {/* Toolbar */}
            <div className="card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                    <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                        placeholder="Search by Bill # or Supplier..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '35px', width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem' }} 
                    />
                </div>
            </div>

            {/* Content */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading bills...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Bill #</th>
                                <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Supplier</th>
                                <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Due Date</th>
                                <th style={{ textAlign: 'right', padding: '16px', color: '#475569' }}>Amount</th>
                                <th style={{ textAlign: 'center', padding: '16px', color: '#475569' }}>Status</th>
                                <th style={{ textAlign: 'center', padding: '16px', color: '#475569' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '60px 0', textAlign: 'center' }}>
                                        <div style={{ color: '#cbd5e1', fontSize: '3rem', marginBottom: '10px', display: 'flex', justifyContent: 'center' }}><FaFileInvoice /></div>
                                        <p style={{ color: '#94a3b8' }}>No bills found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.map((bill) => {
                                    const style = getStatusStyle(bill.status);
                                    return (
                                        <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px', fontWeight: 500, color: '#3b82f6' }}>{bill.bill_number}</td>
                                            <td style={{ padding: '16px' }}>{bill.supplier_name || 'Unknown'}</td>
                                            <td style={{ padding: '16px', color: '#64748b' }}>{formatDate(bill.bill_date)}</td>
                                            <td style={{ padding: '16px', color: '#64748b' }}>{formatDate(bill.due_date)}</td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>₹{Number(bill.total_amount || 0).toLocaleString()}</td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: style.bg, color: style.text }}>
                                                    {bill.status || 'PENDING'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <button style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }} title="View">
                                                    <FaEye />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PurchaseBills;