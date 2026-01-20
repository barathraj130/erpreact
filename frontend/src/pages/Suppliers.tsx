import React, { useEffect, useState } from 'react';
import { FaEdit, FaExclamationTriangle, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { Supplier, deleteSupplier, fetchSuppliers } from '../api/supplierApi'; // Using SupplierApi
import AddSupplierModal from './AddSupplierModal';

const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSuppliers();
            setSuppliers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id: number) => {
        if (window.confirm("Delete this supplier? Records linked to them might be affected.")) {
            try {
                await deleteSupplier(id);
                loadData();
            } catch (err) {
                alert("Could not delete supplier.");
            }
        }
    };

    const filtered = suppliers.filter(s => 
        s.lender_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {/* Header */}
            <div className="flex-between" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Supplier Management</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Track and manage your vendors.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    <FaPlus /> Add Supplier
                </button>
            </div>

            {error && (
                <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaExclamationTriangle /> {error}
                </div>
            )}

            {/* Toolbar */}
            <div className="card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                <FaSearch style={{ color: '#94a3b8', marginRight: '10px' }} />
                <input 
                    placeholder="Search by name..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ border: 'none', width: '100%', outline: 'none', fontSize: '0.95rem' }} 
                />
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Contact</th>
                            <th style={{ textAlign: 'right', padding: '16px', color: '#475569' }}>Payable Balance</th>
                            <th style={{ textAlign: 'center', padding: '16px', color: '#475569' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading suppliers...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No suppliers found.</td></tr>
                        ) : (
                            filtered.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px', fontWeight: 600, color: '#1e293b' }}>
                                        {s.lender_name}
                                    </td>
                                    <td style={{ padding: '16px', color: '#64748b' }}>
                                        {s.phone || s.email ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {s.phone && <span>{s.phone}</span>}
                                                {s.email && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{s.email}</span>}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#dc2626' }}>
                                        ₹{Number(s.remaining_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                            <button style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">
                                                <FaEdit />
                                            </button>
                                            <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(s.id)} title="Delete">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && <AddSupplierModal onClose={() => setShowModal(false)} onSuccess={loadData} />}
        </div>
    );
};

export default Suppliers;