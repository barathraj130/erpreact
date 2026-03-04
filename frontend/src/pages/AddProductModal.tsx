import React, { useEffect, useState } from 'react';
import {
    FaAlignLeft,
    FaArrowDown,
    FaArrowUp,
    FaBarcode,
    FaBox,
    FaMoneyBillWave,
    FaSave,
    FaTag,
    FaTimes
} from 'react-icons/fa';
import { createProduct, updateProduct } from '../api/productApi';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
    productToEdit?: any;
}

const styles = {
    overlay: {
        position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    },
    modal: {
        backgroundColor: '#ffffff', width: '100%', maxWidth: '650px',
        borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column' as const,
        maxHeight: '90vh', fontFamily: 'Inter, sans-serif'
    },
    header: {
        padding: '20px 28px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#ffffff', flexShrink: 0
    },
    body: {
        padding: '28px',
        overflowY: 'auto' as const,
        flexGrow: 1,
        background: 'linear-gradient(to bottom, #ffffff, #f8fafc)'
    },
    footer: {
        padding: '20px 28px', borderTop: '1px solid #f1f5f9',
        backgroundColor: '#ffffff', display: 'flex', justifyContent: 'flex-end',
        gap: '12px', flexShrink: 0
    },
    title: { fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '-0.5px' },
    closeBtn: { background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' },
    sectionTitle: { fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '16px', marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px' },
    inputGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#475569', letterSpacing: '-0.2px' },
    inputWrapper: { position: 'relative' as const },
    icon: { position: 'absolute' as const, left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' as const, fontSize: '16px' },
    input: { width: '100%', padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#1e293b', backgroundColor: '#fff', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' as const, fontWeight: 500 },
    textarea: { width: '100%', padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#1e293b', backgroundColor: '#fff', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' as const, fontWeight: 500, minHeight: '80px', resize: 'vertical' as const },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    btnSecondary: { padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: '#475569', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
    btnPrimary: { padding: '12px 28px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'all 0.2s' }
};

const InputField = ({ label, icon: Icon, value, onChange, placeholder, required = false, type = "text", disabled = false, isTextArea = false }: any) => (
    <div style={styles.inputGroup}>
        <label style={styles.label}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
        <div style={styles.inputWrapper}>
            <div style={{ ...styles.icon, top: isTextArea ? '24px' : '50%' }}><Icon /></div>
            {isTextArea ? (
                <textarea
                    required={required}
                    disabled={disabled}
                    style={{ ...styles.textarea, ...(disabled ? { opacity: 0.7, backgroundColor: '#f1f5f9' } : {}) }}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                />
            ) : (
                <input
                    type={type}
                    required={required}
                    disabled={disabled}
                    style={{ ...styles.input, ...(disabled ? { opacity: 0.7, backgroundColor: '#f1f5f9' } : {}) }}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                />
            )}
        </div>
    </div>
);

const AddProductModal: React.FC<Props> = ({ onClose, onSuccess, productToEdit }) => {
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        description: '',
        cost_price: 0,
        selling_price: 0,
        opening_stock: 0,
        current_stock: 0,
        min_stock: 5,
        hsn_code: '',
        barcode: '',
        unit: 'Unit'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (productToEdit) {
            setFormData({
                name: productToEdit.name || '',
                sku: productToEdit.sku || '',
                description: productToEdit.description || '',
                cost_price: productToEdit.cost_price || 0,
                selling_price: productToEdit.selling_price || 0,
                opening_stock: productToEdit.opening_stock || 0,
                current_stock: productToEdit.current_stock || 0,
                min_stock: productToEdit.min_stock || 5,
                hsn_code: productToEdit.hsn_code || '',
                barcode: productToEdit.barcode || '',
                unit: productToEdit.unit || 'Unit'
            });
        }
    }, [productToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (productToEdit) {
                await updateProduct(productToEdit.id, formData);
            } else {
                await createProduct(formData);
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
            <div style={styles.modal} className="page-transition">
                <div style={styles.header}>
                    <h2 style={styles.title}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#2563eb', display: 'flex' }}>
                            <FaBox size={20} />
                        </div>
                        {productToEdit ? 'Edit Product' : 'Add New Product'}
                    </h2>
                    <button 
                        onClick={onClose} 
                        style={styles.closeBtn}
                        onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
                        onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
                    >
                        <FaTimes />
                    </button>
                </div>

                <div style={styles.body}>
                    <form id="product-form" onSubmit={handleSubmit}>
                        
                        <div style={{ ...styles.sectionTitle, marginTop: 0 }}>Basic Information</div>
                        <InputField 
                            label="Product Name" 
                            icon={FaBox} 
                            value={formData.name} 
                            onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} 
                            placeholder="e.g. Wireless Mouse" 
                            required 
                        />
                        
                        <div style={styles.row}>
                            <InputField 
                                label="SKU / Item ID" 
                                icon={FaBarcode} 
                                value={formData.sku} 
                                onChange={(e: any) => setFormData({ ...formData, sku: e.target.value })} 
                                placeholder="PROD-123" 
                            />
                            <InputField 
                                label="HSN / SAC Code" 
                                icon={FaTag} 
                                value={formData.hsn_code} 
                                onChange={(e: any) => setFormData({ ...formData, hsn_code: e.target.value })} 
                                placeholder="8471" 
                            />
                        </div>

                        <InputField 
                            label="Description" 
                            icon={FaAlignLeft} 
                            value={formData.description} 
                            onChange={(e: any) => setFormData({ ...formData, description: e.target.value })} 
                            placeholder="Brief details about the product..." 
                            isTextArea 
                        />

                        <div style={styles.sectionTitle}>Pricing & Finance</div>
                        <div style={styles.row}>
                            <InputField 
                                label="Purchase Price (₹)" 
                                icon={FaMoneyBillWave} 
                                type="number"
                                value={formData.cost_price} 
                                onChange={(e: any) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} 
                                placeholder="0.00" 
                                required
                            />
                            <InputField 
                                label="Selling Price (₹)" 
                                icon={FaMoneyBillWave} 
                                type="number"
                                value={formData.selling_price} 
                                onChange={(e: any) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })} 
                                placeholder="0.00" 
                                required
                            />
                        </div>

                        <div style={styles.sectionTitle}>Inventory Control</div>
                        <div style={styles.row}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Opening Stock</label>
                                <div style={styles.inputWrapper}>
                                    <div style={styles.icon}><FaArrowUp /></div>
                                    <input 
                                        type="number" 
                                        disabled={!!productToEdit} 
                                        style={{ ...styles.input, ...(productToEdit ? { opacity: 0.7, backgroundColor: '#f1f5f9' } : {}) }} 
                                        value={formData.opening_stock} 
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 0;
                                            setFormData({ ...formData, opening_stock: val, current_stock: val });
                                        }} 
                                    />
                                </div>
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Low Stock Alert at</label>
                                <div style={styles.inputWrapper}>
                                    <div style={styles.icon}><FaArrowDown /></div>
                                    <input 
                                        type="number" 
                                        style={styles.input} 
                                        value={formData.min_stock} 
                                        onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })} 
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div style={styles.footer}>
                    <button 
                        onClick={onClose} 
                        style={styles.btnSecondary} 
                        type="button"
                        onMouseOver={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                    >
                        Cancel
                    </button>
                    <button 
                        form="product-form" 
                        type="submit" 
                        disabled={loading} 
                        style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = '#2563eb'}
                    >
                        {loading ? 'Processing...' : <><FaSave /> {productToEdit ? 'Update Product' : 'Create Product'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddProductModal;
