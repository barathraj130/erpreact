import React, { useState } from 'react';
import { FaBuilding, FaEnvelope, FaMoneyBillWave, FaPhone, FaTimes } from 'react-icons/fa';
import { createSupplier } from '../api/supplierApi';

interface AddSupplierModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        supplier_name: '',
        phone: '',
        email: '',
        initial_payable_balance: '',
        gstin: '',
        address: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createSupplier(formData);
            alert("Success! Supplier created.");
            onSuccess();
            onClose();
        } catch (err: any) {
            alert("Failed to create supplier");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', width: '500px', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Add New Supplier</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Supplier Name</label>
                        <div style={{ position: 'relative' }}>
                            <FaBuilding style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                                required
                                value={formData.supplier_name}
                                onChange={e => setFormData({...formData, supplier_name: e.target.value})}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                placeholder="e.g. Global Tech Solutions"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Phone</label>
                            <div style={{ position: 'relative' }}>
                                <FaPhone style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input 
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    placeholder="98765..."
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input 
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    placeholder="supplier@example.com"
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Opening Balance (Payable)</label>
                        <div style={{ position: 'relative' }}>
                            <FaMoneyBillWave style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444' }} />
                            <input 
                                type="number"
                                value={formData.initial_payable_balance}
                                onChange={e => setFormData({...formData, initial_payable_balance: e.target.value})}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                                placeholder="0.00"
                            />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Amount you already owe to this supplier.</p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button 
                            type="button" 
                            onClick={onClose}
                            style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'Creating...' : 'Create Supplier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddSupplierModal;