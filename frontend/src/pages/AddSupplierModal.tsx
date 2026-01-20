// frontend/src/pages/AddCustomerModal.tsx
import React, { useEffect, useState } from 'react';
import { FaBuilding, FaEnvelope, FaIdCard, FaMapMarkerAlt, FaMoneyCheckAlt, FaPhone, FaSave, FaTag, FaTimes, FaUser } from 'react-icons/fa';
import { createCustomer, updateCustomer } from '../api/userApi';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
    customerToEdit?: any; 
}

const styles = {
    // ... (Keep existing styles for modal/overlay from previous file content) ...
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { backgroundColor: '#ffffff', width: '100%', maxWidth: '600px', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, maxHeight: '90vh', fontFamily: 'Inter, sans-serif' },
    header: { padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' },
    title: { fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem', display: 'flex', alignItems: 'center' },
    body: { padding: '24px', overflowY: 'auto' as const },
    sectionTitle: { fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '12px', marginTop: '20px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' },
    inputGroup: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' },
    inputWrapper: { position: 'relative' as const },
    icon: { position: 'absolute' as const, left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' as const, fontSize: '14px' },
    input: { width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#1e293b', backgroundColor: '#fff', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' as const },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    footer: { padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
    btnSecondary: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' },
    btnPrimary: { padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }
};

const InputField = ({ label, icon: Icon, value, onChange, placeholder, required = false, type = "text", disabled = false }: any) => (
    <div style={styles.inputGroup}>
        <label style={styles.label}>{label} {required && <span style={{color: '#ef4444'}}>*</span>}</label>
        <div style={styles.inputWrapper}>
            <div style={styles.icon}><Icon /></div>
            <input type={type} required={required} disabled={disabled} style={{...styles.input, opacity: disabled ? 0.7 : 1, backgroundColor: disabled ? '#f1f5f9' : '#fff'}} placeholder={placeholder} value={value} onChange={onChange} onFocus={(e) => e.target.style.borderColor = '#2563eb'} onBlur={(e) => e.target.style.borderColor = '#cbd5e1'} />
        </div>
    </div>
);

const AddCustomerModal: React.FC<Props> = ({ onClose, onSuccess, customerToEdit }) => {
    const [formData, setFormData] = useState({
        username: '', nickname: '', email: '', phone: '', gstin: '',
        address_line1: '', city_pincode: '', state: '', state_code: '',
        bank_name: '', bank_account_no: '', bank_ifsc_code: '',
        opening_balance: 0
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (customerToEdit) {
            setFormData({
                username: customerToEdit.username || '', nickname: customerToEdit.nickname || '',
                email: customerToEdit.email || '', phone: customerToEdit.phone || '',
                gstin: customerToEdit.gstin || '', address_line1: customerToEdit.address_line1 || '',
                city_pincode: customerToEdit.city_pincode || '', state: customerToEdit.state || '',
                state_code: customerToEdit.state_code || '',
                bank_name: customerToEdit.bank_name || '',
                bank_account_no: customerToEdit.bank_account_no || '',
                bank_ifsc_code: customerToEdit.bank_ifsc_code || '',
                opening_balance: customerToEdit.initial_balance || 0
            });
        }
    }, [customerToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (customerToEdit) {
                await updateCustomer(customerToEdit.id, formData);
                alert("Success! Customer profile updated.");
            } else {
                await createCustomer(formData);
                alert("Success! Customer profile created.");
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.message || "Operation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>
                        <div style={{background:'#eff6ff', padding:'8px', borderRadius:'6px', color:'#2563eb', display:'flex'}}><FaUser /></div>
                        {customerToEdit ? 'Edit Customer' : 'Add New Customer'}
                    </h2>
                    <button onClick={onClose} style={styles.closeBtn}><FaTimes /></button>
                </div>

                <div style={styles.body}>
                    <form id="customer-form" onSubmit={handleSubmit}>
                        
                        <div style={{...styles.sectionTitle, marginTop: 0}}>Business Details</div>
                        <InputField label="Customer / Business Name" icon={FaBuilding} value={formData.username} onChange={(e: any) => setFormData({...formData, username: e.target.value})} placeholder="e.g. Acme Corp Pvt Ltd" required />
                        <div style={styles.row}>
                            <InputField label="Nickname / Alias" icon={FaTag} value={formData.nickname} onChange={(e: any) => setFormData({...formData, nickname: e.target.value})} placeholder="e.g. Shop 1" />
                            <InputField label="Phone" icon={FaPhone} value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} placeholder="98765..." />
                        </div>
                        <div style={styles.row}>
                            <InputField label="GSTIN" icon={FaIdCard} value={formData.gstin} onChange={(e: any) => setFormData({...formData, gstin: e.target.value})} placeholder="33ABC..." />
                            <InputField label="Email" icon={FaEnvelope} value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} placeholder="customer@example.com" />
                        </div>

                        <div style={styles.sectionTitle}>Bank Account Details</div>
                        <InputField label="Bank Name" icon={FaMoneyCheckAlt} value={formData.bank_name} onChange={(e: any) => setFormData({...formData, bank_name: e.target.value})} placeholder="e.g. SBI" />
                        <div style={styles.row}>
                            <InputField label="Account Number" icon={FaTag} value={formData.bank_account_no} onChange={(e: any) => setFormData({...formData, bank_account_no: e.target.value})} placeholder="1234567890" />
                            <InputField label="IFSC Code" icon={FaTag} value={formData.bank_ifsc_code} onChange={(e: any) => setFormData({...formData, bank_ifsc_code: e.target.value})} placeholder="SBIN000123" />
                        </div>

                        <div style={styles.sectionTitle}>Location</div>
                        <InputField label="Address Line 1" icon={FaMapMarkerAlt} value={formData.address_line1} onChange={(e: any) => setFormData({...formData, address_line1: e.target.value})} placeholder="Street, Area" />
                        <div style={styles.row}>
                            <InputField label="City - Pincode" icon={FaMapMarkerAlt} value={formData.city_pincode} onChange={(e: any) => setFormData({...formData, city_pincode: e.target.value})} placeholder="Chennai - 600001" />
                            <InputField label="State" icon={FaMapMarkerAlt} value={formData.state} onChange={(e: any) => setFormData({...formData, state: e.target.value})} placeholder="State Name" />
                        </div>

                        <div style={{marginTop: '10px', background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd'}}>
                            <label style={{...styles.label, color: '#0369a1', marginBottom: '8px'}}>Opening Balance (Receivable)</label>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <span style={{fontSize: '1.2rem', color: '#0369a1', fontWeight: 'bold', marginRight: '10px'}}>₹</span>
                                <input type="number" disabled={!!customerToEdit} style={{...styles.input, paddingLeft: '12px', textAlign: 'right', fontWeight: 'bold', backgroundColor: customerToEdit ? '#e2e8f0' : '#fff'}} value={formData.opening_balance} onChange={e => setFormData({...formData, opening_balance: parseFloat(e.target.value) || 0})} />
                            </div>
                        </div>
                    </form>
                </div>

                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.btnSecondary} type="button">Cancel</button>
                    <button form="customer-form" type="submit" disabled={loading} style={{...styles.btnPrimary, opacity: loading ? 0.7 : 1}}>
                        {loading ? 'Saving...' : <><FaSave /> {customerToEdit ? 'Update Customer' : 'Save Customer'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddCustomerModal;