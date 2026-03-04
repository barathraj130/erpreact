// frontend/src/pages/Invoices.tsx
import { motion } from 'framer-motion';
import React, { useState } from "react";
import { FaEdit, FaEye, FaFileInvoice, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuthUser } from "../hooks/useAuthUser";
import { useInvoices } from "../hooks/useInvoices";
import { apiFetch } from "../utils/api";

const Invoices: React.FC = () => {
    const navigate = useNavigate();
    const { invoices, loading, refresh } = useInvoices(); 
    const { user } = useAuthUser();
    const [searchTerm, setSearchTerm] = useState('');

    const canDelete = user?.role === 'admin' || user?.permissions?.some((p: any) => p.action === 'delete_invoices');

    const handleDelete = async (id: number) => {
        if(!window.confirm("Delete this document from the ledger?")) return;
        try {
            await apiFetch(`/invoice/${id}`, { method: 'DELETE' });
            refresh();
        } catch (err) {
            alert("Security Clearance required for deletion.");
        }
    };

    const filteredInvoices = invoices.filter(inv => 
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.03em' }}>
                        Invoicing <span style={{ color: 'var(--primary)' }}>Ledger</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {invoices.length} Registered Documents
                    </p>
                </div>
                <button className="btn-enterprise" onClick={() => navigate('/invoices/new')}>
                    <FaPlus /> Author New Invoice
                </button>
            </div>

            {/* Filter Hub */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="enterprise-card glass" 
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}
            >
                <FaSearch color="var(--text-muted)" />
                <input 
                    className="input-modern"
                    placeholder="Search by ID, client title, or certificate no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: 'none', background: 'transparent', flex: 1 }}
                />
            </motion.div>

            {/* Cinematic Table */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="enterprise-table-wrapper"
            >
                <table className="enterprise-table">
                    <thead>
                        <tr>
                            <th>Invoice Reference</th>
                            <th>Consumer Entity</th>
                            <th>Status Badge</th>
                            <th>Issue Date</th>
                            <th style={{ textAlign: 'right' }}>Document Value</th>
                            <th style={{ textAlign: 'center' }}>Control</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px' }}>Syncing Ledger...</td></tr>
                        ) : filteredInvoices.map((inv, idx) => {
                            const status = inv.status?.toLowerCase() || 'draft';
                            const badgeClass = status === 'paid' ? 'badge-user' : (status === 'pending' ? 'badge-host' : 'badge-admin');
                            
                            return (
                                <motion.tr 
                                    key={inv.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <FaFileInvoice style={{ opacity: 0.4 }} />
                                            {inv.invoice_number}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{inv.customer_name}</td>
                                    <td>
                                        <span className={`badge-premium ${badgeClass}`}>
                                            {inv.status || 'DRAFT'}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '---'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--text-primary)' }}>
                                        ₹{Number(inv.total_amount).toLocaleString()}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button className="clickable glass" onClick={() => navigate(`/invoices/${inv.id}`)} style={{ padding: '8px', borderRadius: '8px' }} title="Inspect">
                                                <FaEye size={14} />
                                            </button>
                                            <button className="clickable glass" onClick={() => navigate(`/invoices/edit/${inv.id}`)} style={{ padding: '8px', borderRadius: '8px', color: 'var(--primary)' }} title="Edit">
                                                <FaEdit size={14} />
                                            </button>
                                            {canDelete && (
                                                <button className="clickable glass" onClick={() => handleDelete(inv.id)} style={{ padding: '8px', borderRadius: '8px', color: 'var(--error)' }} title="Revoke">
                                                    <FaTrash size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </motion.div>
        </div>
    );
};

export default Invoices;