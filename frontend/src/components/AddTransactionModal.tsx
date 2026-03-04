// frontend/src/components/AddTransactionModal.tsx
import React, { useEffect, useState } from 'react';
import {
    FaExchangeAlt,
    FaSave,
    FaTimes
} from 'react-icons/fa';
import { fetchLedgers, Ledger } from '../api/ledgerApi';
import { createTransaction } from '../api/transactionApi';
import { Customer, fetchCustomers } from '../api/userApi';
// Assuming fetchSuppliers exist, if not I'll check.
// I'll check lenders/suppliers API.

const styles = {
    overlay: { 
        position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 
    },
    modal: { 
        backgroundColor: '#ffffff', width: '100%', maxWidth: '550px', 
        borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
        overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, 
        maxHeight: '90vh'
    },
    header: { 
        padding: '20px 24px', borderBottom: '1px solid #f1f5f9', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        backgroundColor: '#fff'
    },
    body: { padding: '24px', overflowY: 'auto' as const, flexGrow: 1 },
    footer: { 
        padding: '16px 24px', borderTop: '1px solid #f1f5f9', 
        backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', 
        gap: '12px' 
    },
    title: { fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' },
    inputGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#475569' },
    input: { 
        width: '100%', padding: '12px 16px', borderRadius: '10px', 
        border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none', 
        transition: 'all 0.2s', boxSizing: 'border-box' as const 
    },
    select: { 
        width: '100%', padding: '12px 16px', borderRadius: '10px', 
        border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#fff', 
        outline: 'none', cursor: 'pointer' 
    }
};

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

const AddTransactionModal: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().slice(0, 10),
        amount: '',
        description: '',
        type: 'RECEIPT', // RECEIPT, PAYMENT
        category: 'General',
        ledger_id: '',
        user_id: '', // Linked Customer
    });

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [lRes, cRes] = await Promise.all([
                    fetchLedgers(),
                    fetchCustomers()
                ]);
                setLedgers(lRes);
                setCustomers(cRes);
                
                // Pick default ledger if available
                if (lRes.length > 0) {
                    setFormData(prev => ({ ...prev, ledger_id: String(lRes[0].id) }));
                }
            } catch (err) {
                console.error("Failed to load modal data:", err);
            }
        };
        loadInitialData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || !formData.ledger_id) {
            alert("Amount and Ledger are required.");
            return;
        }

        setLoading(true);
        try {
            await createTransaction({
                ...formData,
                amount: parseFloat(formData.amount),
                ledger_id: parseInt(formData.ledger_id),
                user_id: formData.user_id ? parseInt(formData.user_id) : null
            });
            onSuccess();
            onClose();
        } catch (err) {
            alert("Failed to save transaction.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} className="page-transition">
                <div style={styles.header}>
                    <h2 style={styles.title}>
                        <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', color: '#10b981', display: 'flex' }}>
                            <FaExchangeAlt />
                        </div>
                        New Entry
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                        <FaTimes size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.body}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Entry Type</label>
                                <select 
                                    style={styles.select} 
                                    value={formData.type} 
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="RECEIPT">Receipt (Inward)</option>
                                    <option value="PAYMENT">Payment (Outward)</option>
                                </select>
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Date</label>
                                <input 
                                    type="date" 
                                    style={styles.input} 
                                    value={formData.date} 
                                    onChange={e => setFormData({ ...formData, date: e.target.value })} 
                                />
                            </div>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Account / Ledger (Bank/Cash)</label>
                            <select 
                                style={styles.select} 
                                value={formData.ledger_id} 
                                onChange={e => setFormData({ ...formData, ledger_id: e.target.value })}
                                required
                            >
                                <option value="">Select Account</option>
                                {ledgers.map(l => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.group_name})</option>
                                ))}
                            </select>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Amount (₹)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00" 
                                style={{ ...styles.input, fontWeight: 700, fontSize: '1.25rem', color: '#1e293b' }} 
                                value={formData.amount} 
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Linked Party (Optional)</label>
                            <select 
                                style={styles.select} 
                                value={formData.user_id} 
                                onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                            >
                                <option value="">None / Cash Transaction</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.username}</option>
                                ))}
                            </select>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Description / Reference</label>
                            <textarea 
                                placeholder="e.g., Payment for Invoice #123" 
                                style={{ ...styles.input, height: '80px', resize: 'none' }} 
                                value={formData.description} 
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '10px' }}>
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading} 
                            style={{ 
                                padding: '10px 24px', 
                                borderRadius: '10px', 
                                backgroundColor: '#10b981', 
                                color: 'white', 
                                border: 'none', 
                                fontWeight: 700, 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px',
                                cursor: 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            <FaSave />
                            {loading ? 'Saving...' : 'Save Entry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTransactionModal;
