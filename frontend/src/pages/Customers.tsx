import React, { useState } from 'react';
import { FaEdit, FaExclamationTriangle, FaPlus, FaSearch, FaSync, FaTag, FaTrash } from 'react-icons/fa';
import { deleteCustomer } from '../api/userApi';
import { useUsers } from '../hooks/useUsers';
import AddCustomerModal from './AddCustomerModal';

const Customers: React.FC = () => {
    // 1. Default to empty array to prevent crash
    const { customers = [], loading, error, refresh } = useUsers();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [customerToEdit, setCustomerToEdit] = useState<any>(null);

    // 2. SAFE FILTERING LOGIC
    // This block protects against null values, missing fields, or non-array data
    const displayedCustomers = React.useMemo(() => {
        if (!Array.isArray(customers)) return [];

        return customers.filter(user => {
            if (!user) return false;

            // Safe property access with fallbacks
            const username = user.username || '';
            const gstin = user.gstin || '';
            const nickname = user.nickname || '';

            const isNotAdmin = username.toLowerCase() !== 'admin';
            const searchLower = searchTerm.toLowerCase();
            
            const matchesSearch = username.toLowerCase().includes(searchLower) || 
                                  gstin.toLowerCase().includes(searchLower) ||
                                  nickname.toLowerCase().includes(searchLower);
                                  
            return isNotAdmin && matchesSearch;
        });
    }, [customers, searchTerm]);

    const handleEdit = (customer: any) => {
        setCustomerToEdit(customer);
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Delete this customer? This will also remove their transaction history.")) {
            try {
                await deleteCustomer(id);
                refresh();
            } catch (err) {
                alert("Failed to delete customer");
            }
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        setCustomerToEdit(null);
    };

    return (
        <div>
            {/* Header */}
            <div className="flex-between" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Customers</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Manage your client details and balances.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" onClick={() => refresh()} title="Refresh List" style={{ padding: '10px', cursor: 'pointer' }}>
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </button>
                    <button className="btn-primary" onClick={() => { setCustomerToEdit(null); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaPlus /> Add Customer
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaExclamationTriangle />
                    <span>Error loading customers: {error}</span>
                </div>
            )}

            {/* Search Bar */}
            <div className="card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', background: 'white', borderRadius: '12px' }}>
                <FaSearch style={{ color: '#94a3b8' }} />
                <input 
                    placeholder="Search by Name, Nickname or GSTIN..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: 'none', width: '100%', fontSize: '0.95rem', background:'transparent', outline: 'none' }} 
                />
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Name / Nickname</th>
                            <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>GSTIN</th>
                            <th style={{ textAlign: 'left', padding: '16px', color: '#475569' }}>Location</th>
                            <th style={{ textAlign: 'right', padding: '16px', color: '#475569' }}>Current Balance</th>
                            <th style={{ textAlign: 'center', padding: '16px', color: '#475569' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{padding: '40px', textAlign: 'center', color: '#64748b'}}>Loading data...</td></tr>
                        ) : displayedCustomers.length === 0 ? (
                            <tr><td colSpan={5} style={{padding: '40px', textAlign: 'center', color: '#94a3b8'}}>No customers found.</td></tr>
                        ) : (
                            displayedCustomers.map((user) => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{user.username}</div>
                                        {user.nickname && (
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <FaTag size={10} /> {user.nickname}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px', color: '#64748b' }}>{user.gstin || '-'}</td>
                                    <td style={{ padding: '16px', color: '#64748b' }}>{user.city_pincode || user.state || '-'}</td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                        ₹{Number(user.remaining_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            <button 
                                                style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }} 
                                                onClick={() => handleEdit(user)}
                                                title="Edit Customer"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button 
                                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} 
                                                onClick={() => handleDelete(user.id)}
                                                title="Delete Customer"
                                            >
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

            {/* Modal */}
            {showModal && (
                <AddCustomerModal 
                    onClose={handleModalClose} 
                    onSuccess={refresh} 
                    customerToEdit={customerToEdit} 
                />
            )}
        </div>
    );
};

export default Customers;