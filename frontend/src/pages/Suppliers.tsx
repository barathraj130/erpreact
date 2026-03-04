import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaEdit, FaExclamationTriangle, FaHistory, FaPlus, FaSearch, FaSync, FaTrash, FaUserTie } from 'react-icons/fa';
import { Supplier, deleteSupplier, fetchSuppliers } from '../api/supplierApi';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import AddSupplierModal from './AddSupplierModal';
import './Suppliers.css';

const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSuppliers();
            setSuppliers(data || []);
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
        if (window.confirm("Dissolve this partnership? Historical procurement logs will be archived.")) {
            try {
                await deleteSupplier(id);
                loadData();
            } catch (err) {
                alert("Operation failed: Partnership remains active.");
            }
        }
    };

    const filtered = suppliers.filter(s => 
        (s.lender_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="suppliers-container">
            {/* Header */}
            <div className="suppliers-header">
                <div className="suppliers-title">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >Procurement Network</motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >Strategic Vendor Intelligence & Supply Chain Relations</motion.p>
                </div>
                <div className="suppliers-actions" style={{ display: 'flex', gap: '12px' }}>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-secondary" 
                        onClick={loadData} 
                        style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary" 
                        onClick={() => setShowModal(true)} 
                        style={{ height: '52px', padding: '0 28px', gap: '12px', borderRadius: '14px', fontSize: '1rem', fontWeight: 900 }}
                    >
                        <FaPlus /> Initialize New Vendor
                    </motion.button>
                </div>
            </div>

            {error && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ backgroundColor: 'var(--error-glow)', color: 'var(--error)', padding: '20px', borderRadius: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.1)', fontWeight: 700 }}
                >
                    <FaExclamationTriangle size={20} />
                    <span>Procurement Node Sync Failure: {error}</span>
                </motion.div>
            )}

            {/* Search Toolbar */}
            <div className="suppliers-toolbar">
                <FaSearch style={{ color: 'var(--text-muted)' }} size={20} />
                <input 
                    placeholder="Locate vendor via identity, signature, or HASH..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="suppliers-table-container">
                <table className="sup-table">
                    <thead>
                        <tr>
                            <th>Nexus Entity</th>
                            <th>Neural Contact Patch</th>
                            <th style={{ textAlign: 'right' }}>Liability Balance</th>
                            <th style={{ textAlign: 'center' }}>Interface</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <tr key={i}><td colSpan={4} style={{ padding: '30px' }}><div className="skeleton" style={{ height: '30px', borderRadius: '8px' }}></div></td></tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '120px 0', textAlign: 'center' }}>
                                    <FaUserTie size={64} style={{ color: 'var(--border-color)', marginBottom: '24px' }} />
                                    <h3 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)' }}>Registry Empty</h3>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 500, marginTop: '8px' }}>No active vendor nodes discovered.</p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((s, idx) => (
                                <motion.tr 
                                    key={s.id} 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="sup-row"
                                >
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div className="vendor-orb">
                                                <FaUserTie size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{s.lender_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>INDEX: #VND-{s.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem' }}>{s.phone || 'NO-TRACER'}</span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.email || 'ENCRYPTED'}</span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="balance-text">₹{Number(s.remaining_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            <motion.button 
                                                whileHover={{ scale: 1.1, background: '#f1f5f9' }}
                                                whileTap={{ scale: 0.9 }}
                                                className="control-btn" 
                                                style={{ background: 'white', border: '1px solid #e2e8f0', color: 'var(--text-secondary)' }}
                                                onClick={() => {
                                                    setSelectedSupplier(s);
                                                    setShowTransactionModal(true);
                                                }}
                                                title="Execution History"
                                            >
                                                <FaHistory size={14} />
                                            </motion.button>
                                            <motion.button 
                                                whileHover={{ scale: 1.1, background: 'var(--primary)', color: '#fff' }}
                                                whileTap={{ scale: 0.9 }}
                                                className="control-btn" 
                                                style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}
                                                title="Modify Manifest"
                                            >
                                                <FaEdit size={14} />
                                            </motion.button>
                                            <motion.button 
                                                whileHover={{ scale: 1.1, background: 'var(--error)', color: '#fff' }}
                                                whileTap={{ scale: 0.9 }}
                                                className="control-btn" 
                                                style={{ background: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)' }}
                                                onClick={() => handleDelete(s.id)} 
                                                title="Relinquish Node"
                                            >
                                                <FaTrash size={14} />
                                            </motion.button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && <AddSupplierModal onClose={() => setShowModal(false)} onSuccess={loadData} />}
            
            {showTransactionModal && selectedSupplier && (
                <TransactionHistoryModal
                    isOpen={showTransactionModal}
                    onClose={() => {
                        setShowTransactionModal(false);
                        setSelectedSupplier(null);
                    }}
                    entityType="supplier"
                    entityId={selectedSupplier.id}
                    entityName={selectedSupplier.lender_name}
                />
            )}
        </div>
    );
};

export default Suppliers;