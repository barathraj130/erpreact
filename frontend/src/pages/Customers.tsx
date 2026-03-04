import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { FaEdit, FaExclamationTriangle, FaHistory, FaMapMarkerAlt, FaPlus, FaSearch, FaSync, FaTag, FaTrash, FaUserCircle } from 'react-icons/fa';
import { deleteCustomer } from '../api/userApi';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import { useUsers } from '../hooks/useUsers';
import AddCustomerModal from './AddCustomerModal';
import './Customers.css';

const Customers: React.FC = () => {
    const { customers = [], loading, error, refresh } = useUsers();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [customerToEdit, setCustomerToEdit] = useState<any>(null);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

    const displayedCustomers = React.useMemo(() => {
        if (!Array.isArray(customers)) return [];

        return customers.filter(user => {
            if (!user) return false;
            const username = user.username || '';
            const gstin = user.gstin || '';
            const nickname = user.nickname || '';

            const isNotAdmin = username.toLowerCase() !== 'admin';
            const searchLower = searchTerm.toLowerCase();
            
            const matchesSearch = username.toLowerCase().includes(searchLower) || 
                                   gstin.toLowerCase().includes(searchLower) ||
                                   nickname.toLowerCase().includes(searchLower);
                                   
            return isNotAdmin && matchesSearch;
        }).sort((a,b) => (a.username || '').localeCompare(b.username || ''));
    }, [customers, searchTerm]);

    const handleEdit = (customer: any) => {
        setCustomerToEdit(customer);
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Relinquish this stakeholder record? This action is irreversible.")) {
            try {
                await deleteCustomer(id);
                refresh();
            } catch (err) {
                alert("Authorization failed: Record locked.");
            }
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        setCustomerToEdit(null);
    };

    return (
        <div className="customers-container">
            {/* Header */}
            <div className="customers-header">
                <div className="customers-title">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >Stakeholder Registry</motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >Global Partner Network & Fiscal Exposure Management</motion.p>
                </div>
                <div className="customers-actions">
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-secondary" 
                        onClick={() => refresh()} 
                        style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary" 
                        onClick={() => { setCustomerToEdit(null); setShowModal(true); }} 
                        style={{ height: '52px', padding: '0 28px', gap: '12px', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 800 }}
                    >
                        <FaPlus /> Initialize Onboarding
                    </motion.button>
                </div>
            </div>

            {/* Critical Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--error)', padding: '20px', borderRadius: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid rgba(239, 68, 68, 0.15)' }}
                    >
                        <FaExclamationTriangle size={20} />
                        <span style={{ fontWeight: 800 }}>Vault Sync Failure: {error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Orb */}
            <div className="search-orb">
                <FaSearch style={{ color: 'var(--text-muted)' }} size={20} />
                <input 
                    placeholder="Identify partner by username, GSTIN, or alias..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Cinematic Table */}
            <div className="customer-table-container">
                <table className="cust-table">
                    <thead>
                        <tr>
                            <th>Partner Identity</th>
                            <th>Fiscal Registry (GSTIN)</th>
                            <th>Geographic Context</th>
                            <th style={{ textAlign: 'right' }}>Capital Exposure</th>
                            <th style={{ textAlign: 'center' }}>Control Interface</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <tr key={i}><td colSpan={5} style={{ padding: '30px' }}><div className="skeleton" style={{ height: '30px', borderRadius: '8px' }}></div></td></tr>
                            ))
                        ) : displayedCustomers.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '120px 32px', textAlign: 'center' }}>
                                    <FaUserCircle size={64} style={{ color: 'var(--border-color)', marginBottom: '20px' }} />
                                    <h3 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)' }}>Registry Empty</h3>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No stakeholder detected within current parameters.</p>
                                </td>
                            </tr>
                        ) : (
                            displayedCustomers.map((user, idx) => (
                                <motion.tr 
                                    key={user.id} 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="cust-row"
                                >
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div className="identity-orb">
                                                {(user.username || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{user.username}</div>
                                                {user.nickname && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <FaTag size={10} /> {user.nickname}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '0.5px' }}>{user.gstin || 'NON-CERTIFIED'}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <FaMapMarkerAlt size={12} style={{ opacity: 0.5 }} />
                                            {user.city_pincode || user.state || 'Universal'}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="exposure-value">
                                            ₹{Number(user.initial_balance || 0).toLocaleString('en-IN')}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            <button className="control-btn btn-history" onClick={() => { setSelectedCustomer(user); setShowTransactionModal(true); }} title="Audit History">
                                                <FaHistory size={16} />
                                            </button>
                                            <button className="control-btn btn-edit" onClick={() => handleEdit(user)} title="Modify Records">
                                                <FaEdit size={16} />
                                            </button>
                                            <button className="control-btn btn-delete" onClick={() => handleDelete(user.id)} title="Relinquish Status">
                                                <FaTrash size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <AddCustomerModal 
                    onClose={handleModalClose} 
                    onSuccess={refresh} 
                    customerToEdit={customerToEdit} 
                />
            )}

            {showTransactionModal && selectedCustomer && (
                <TransactionHistoryModal
                    isOpen={showTransactionModal}
                    onClose={() => {
                        setShowTransactionModal(false);
                        setSelectedCustomer(null);
                    }}
                    entityType="customer"
                    entityId={selectedCustomer.id}
                    entityName={selectedCustomer.username}
                />
            )}
        </div>
    );
};

export default Customers;