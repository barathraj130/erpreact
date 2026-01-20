// frontend/src/pages/AddEmployeeModal.tsx
import React, { useEffect, useState } from 'react';
import {
    FaBriefcase,
    FaCalendarAlt,
    FaEnvelope,
    FaFileSignature,
    FaIdBadge,
    FaMoneyBillWave,
    FaPhone,
    FaSave,
    FaTimes,
    FaUserTie
} from 'react-icons/fa';
import { apiFetch } from '../utils/api';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
    employeeToEdit?: any;
}

const AddEmployeeModal: React.FC<Props> = ({ onClose, onSuccess, employeeToEdit }) => {
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [designation, setDesignation] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [salary, setSalary] = useState<number | string>(0);
    const [salaryType, setSalaryType] = useState('Monthly');
    const [joiningDate, setJoiningDate] = useState(new Date().toISOString().substring(0, 10));
    const [status, setStatus] = useState('Active');

    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

    useEffect(() => {
        if (employeeToEdit) {
            setName(employeeToEdit.name || '');
            setDesignation(employeeToEdit.designation || '');
            setEmail(employeeToEdit.email || '');
            setPhone(employeeToEdit.phone || '');
            setSalary(employeeToEdit.salary || 0);
            setSalaryType(employeeToEdit.salary_type || 'Monthly');
            setJoiningDate(employeeToEdit.joining_date ? employeeToEdit.joining_date.substring(0, 10) : '');
            setStatus(employeeToEdit.status || 'Active');

            if (employeeToEdit.signature_url) {
                setSignaturePreview(`http://localhost:3000${employeeToEdit.signature_url}`);
            }
        }
    }, [employeeToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSignatureFile(file);
            setSignaturePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('designation', designation);
            formData.append('email', email);
            formData.append('phone', phone);
            formData.append('salary', String(salary));
            formData.append('salary_type', salaryType);
            formData.append('joining_date', joiningDate);
            formData.append('status', status);

            if (signatureFile) {
                formData.append('signature', signatureFile);
            }

            const url = employeeToEdit
                ? `/employees/${employeeToEdit.id}`
                : '/employees';

            const method = employeeToEdit ? 'PUT' : 'POST';

            await apiFetch(url, {
                method: method,
                body: formData
            }, false);

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Save Error:", err);
            alert("Failed to save employee. " + (err.message || ""));
        } finally {
            setLoading(false);
        }
    };

    // Dynamic label based on salary type
    const getSalaryLabel = () => {
        switch (salaryType) {
            case 'Monthly': return 'Monthly Salary (₹)';
            case 'Weekly': return 'Weekly Rate (₹)';
            case 'Daily': return 'Daily Rate (₹)';
            default: return 'Amount (₹)';
        }
    };

    const getSalaryPlaceholder = () => {
        switch (salaryType) {
            case 'Monthly': return '25000';
            case 'Weekly': return '5000';
            case 'Daily': return '800';
            default: return '0';
        }
    };

    // Type colors
    const typeColors: Record<string, { bg: string; color: string; border: string }> = {
        'Monthly': { bg: '#eff6ff', color: '#2563eb', border: '#3b82f6' },
        'Weekly': { bg: '#f5f3ff', color: '#7c3aed', border: '#8b5cf6' },
        'Daily': { bg: '#ecfdf5', color: '#059669', border: '#10b981' }
    };

    // Styles
    const modalStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100
    };

    const contentStyle: React.CSSProperties = {
        background: 'white',
        width: '550px',
        borderRadius: '12px',
        overflow: 'hidden',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px 10px 35px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const iconStyle: React.CSSProperties = {
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#94a3b8'
    };

    return (
        <div style={modalStyle}>
            <div style={contentStyle}>

                {/* Header */}
                <div style={{
                    padding: '15px 20px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc'
                }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                        <FaUserTie color="#2563eb" /> {employeeToEdit ? 'Edit Employee' : 'Add Employee'}
                    </h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>
                        <FaTimes />
                    </button>
                </div>

                {/* Form */}
                <div style={{ padding: '20px', overflowY: 'auto' }}>
                    <form id="employee-form" onSubmit={handleSubmit}>

                        {/* Full Name */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Full Name *</label>
                            <div style={{ position: 'relative' }}>
                                <FaIdBadge style={iconStyle} />
                                <input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="John Doe" />
                            </div>
                        </div>

                        {/* Designation */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Designation</label>
                            <div style={{ position: 'relative' }}>
                                <FaBriefcase style={iconStyle} />
                                <input value={designation} onChange={e => setDesignation(e.target.value)} style={inputStyle} placeholder="Manager, Labour, etc." />
                            </div>
                        </div>

                        {/* SALARY TYPE & AMOUNT SECTION */}
                        <div style={{
                            marginBottom: '15px',
                            background: '#f9fafb',
                            padding: '15px',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb'
                        }}>
                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                Payment Structure
                            </label>

                            {/* Type Selection Buttons */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                {['Monthly', 'Weekly', 'Daily'].map(type => {
                                    const colors = typeColors[type];
                                    const isSelected = salaryType === type;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setSalaryType(type)}
                                            style={{
                                                flex: 1,
                                                padding: '12px 10px',
                                                border: isSelected ? `2px solid ${colors.border}` : '2px solid #e5e7eb',
                                                borderRadius: '8px',
                                                background: isSelected ? colors.bg : 'white',
                                                color: isSelected ? colors.color : '#64748b',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Salary Amount Input */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    {getSalaryLabel()}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <FaMoneyBillWave style={iconStyle} />
                                    <input
                                        type="number"
                                        value={salary}
                                        onChange={e => setSalary(e.target.value)}
                                        style={inputStyle}
                                        placeholder={getSalaryPlaceholder()}
                                    />
                                </div>
                                <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {salaryType === 'Monthly' && 'Fixed monthly salary paid at end of month'}
                                    {salaryType === 'Weekly' && 'Weekly payment based on 6-day work week'}
                                    {salaryType === 'Daily' && 'Daily wages × days worked'}
                                </p>
                            </div>
                        </div>

                        {/* Email & Phone */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Email</label>
                                <div style={{ position: 'relative' }}>
                                    <FaEnvelope style={iconStyle} />
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="john@work.com" />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Phone</label>
                                <div style={{ position: 'relative' }}>
                                    <FaPhone style={iconStyle} />
                                    <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="9876543210" />
                                </div>
                            </div>
                        </div>

                        {/* Joining Date & Status */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Joining Date</label>
                                <div style={{ position: 'relative' }}>
                                    <FaCalendarAlt style={iconStyle} />
                                    <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, paddingLeft: '12px' }}>
                                    <option>Active</option>
                                    <option>On Leave</option>
                                    <option>Resigned</option>
                                </select>
                            </div>
                        </div>

                        {/* Signature Upload */}
                        <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px dashed #bae6fd' }}>
                            <label style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FaFileSignature /> Employee Signature
                            </label>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: '0.85rem', color: '#64748b' }} />
                                {signaturePreview && (
                                    <div style={{ width: '80px', height: '40px', border: '1px solid #ddd', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src={signaturePreview} alt="Sig" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div style={{ padding: '15px 20px', borderTop: '1px solid #eee', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button type="submit" form="employee-form" disabled={loading} style={{
                        padding: '10px 24px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px',
                        alignItems: 'center',
                        opacity: loading ? 0.7 : 1
                    }}>
                        <FaSave /> {loading ? 'Saving...' : 'Save Employee'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AddEmployeeModal;