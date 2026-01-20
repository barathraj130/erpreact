import React, { useEffect, useState } from 'react';
import { FaBook, FaTimes } from 'react-icons/fa';
import { apiFetch } from '../../utils/api';

interface Props {
    employee: any;
    onClose: () => void;
}

const EmployeeLedgerModal: React.FC<Props> = ({ employee, onClose }) => {
    const [ledger, setLedger] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
    }, [employee.id]);

    const fmt = (n: number) => Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div style={{ background: 'white', width: '700px', borderRadius: '12px', padding: '25px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '6px', color: '#2563eb' }}><FaBook /></div>
                        <div>
                            <h3 style={{ margin: 0, color: '#1e293b' }}>{employee.name}'s Ledger</h3>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Advance Salary History</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}><FaTimes /></button>
                </div>

                {/* Ledger Table */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>Date</th>
                                <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>Description</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Taken (+)</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Repaid (-)</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>Loading history...</td></tr>
                            ) : ledger.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No history found.</td></tr>
                            ) : (
                                ledger.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px' }}>{new Date(row.date).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ 
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                                background: row.type === 'ADVANCE' ? '#fee2e2' : '#dcfce7',
                                                color: row.type === 'ADVANCE' ? '#991b1b' : '#166534'
                                            }}>
                                                {row.type === 'ADVANCE' ? 'ADVANCE' : 'REPAYMENT'}
                                            </span>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{row.description}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 500 }}>
                                            {row.type === 'ADVANCE' ? fmt(row.amount) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#16a34a', fontWeight: 500 }}>
                                            {row.type === 'REPAYMENT' ? fmt(row.amount) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                                            {fmt(row.running_balance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Current Due</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                            {ledger.length > 0 ? fmt(ledger[ledger.length - 1].running_balance) : '₹0.00'}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EmployeeLedgerModal;