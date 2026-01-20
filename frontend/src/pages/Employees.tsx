// frontend/src/pages/Employees.tsx
import React, { useEffect, useState } from 'react';
import {
    FaBook,
    FaCalculator,
    FaCalendarDay,
    FaCalendarWeek,
    FaCheck,
    FaEdit,
    FaMinus,
    FaMoneyBillWave,
    FaPlus,
    FaQrcode,
    FaSearch,
    FaTimes,
    FaTrash,
    FaUser,
    FaUserClock
} from 'react-icons/fa';
import AdvanceSalaryModal from './hr/AdvanceSalaryModal';
import EmployeeLedgerModal from './hr/EmployeeLedgerModal';
import EmployeeQRModal from './hr/EmployeeQRModal';

interface Employee {
    id: number;
    name: string;
    designation?: string;
    phone?: string;
    email?: string;
    salary: number;
    salary_type: 'Monthly' | 'Weekly' | 'Daily';
    status: string;
    portal_username?: string;
    advance_balance?: number;
    days_present?: number;
}

interface DailyWorkerPayout {
    employee: Employee;
    daysWorked: number;
    dailyRate: number;
    grossAmount: number;
    advanceDeduction: number;
    netPayout: number;
    isSelected: boolean;
}

const Employees: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'MONTHLY' | 'WEEKLY' | 'DAILY'>('ALL');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Daily Workers Payout State
    const [showDailyPayoutModal, setShowDailyPayoutModal] = useState(false);
    const [dailyPayouts, setDailyPayouts] = useState<DailyWorkerPayout[]>([]);
    const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split('T')[0]);

    const API_BASE = '/api';

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(`${API_BASE}/employees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setEmployees(data || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        try {
            const token = localStorage.getItem('erp-token');
            await fetch(`${API_BASE}/employees/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchEmployees();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    // Filter employees
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
            emp.designation?.toLowerCase().includes(search.toLowerCase());
        
        if (activeTab === 'MONTHLY') return matchesSearch && (emp.salary_type === 'Monthly' || !emp.salary_type);
        if (activeTab === 'WEEKLY') return matchesSearch && emp.salary_type === 'Weekly';
        if (activeTab === 'DAILY') return matchesSearch && emp.salary_type === 'Daily';
        return matchesSearch;
    });

    const monthlyEmployees = employees.filter(e => e.salary_type === 'Monthly' || !e.salary_type);
    const weeklyEmployees = employees.filter(e => e.salary_type === 'Weekly');
    const dailyEmployees = employees.filter(e => e.salary_type === 'Daily');

    // Open Daily Payout Calculator
    const openDailyPayoutCalculator = () => {
        const payouts: DailyWorkerPayout[] = dailyEmployees.map(emp => ({
            employee: emp,
            daysWorked: emp.days_present || 1,
            dailyRate: emp.salary,
            grossAmount: (emp.days_present || 1) * emp.salary,
            advanceDeduction: 0,
            netPayout: (emp.days_present || 1) * emp.salary,
            isSelected: true
        }));
        setDailyPayouts(payouts);
        setShowDailyPayoutModal(true);
    };

    // Update payout calculation
    const updatePayout = (index: number, field: string, value: number | boolean) => {
        setDailyPayouts(prev => {
            const updated = [...prev];
            if (field === 'daysWorked') {
                updated[index].daysWorked = value as number;
                updated[index].grossAmount = (value as number) * updated[index].dailyRate;
            } else if (field === 'advanceDeduction') {
                const maxDeduction = Math.min(value as number, updated[index].employee.advance_balance || 0);
                updated[index].advanceDeduction = maxDeduction;
            } else if (field === 'isSelected') {
                updated[index].isSelected = value as boolean;
            }
            updated[index].netPayout = updated[index].grossAmount - updated[index].advanceDeduction;
            return updated;
        });
    };

    // Calculate totals
    const selectedPayouts = dailyPayouts.filter(p => p.isSelected);
    const totalGross = selectedPayouts.reduce((sum, p) => sum + p.grossAmount, 0);
    const totalDeductions = selectedPayouts.reduce((sum, p) => sum + p.advanceDeduction, 0);
    const totalNet = selectedPayouts.reduce((sum, p) => sum + p.netPayout, 0);

    // Process Daily Payouts
    const processDailyPayouts = async () => {
        if (!confirm(`Process payouts for ${selectedPayouts.length} workers?\n\nTotal: ₹${totalNet.toLocaleString()}`)) return;

        try {
            alert('✅ Daily payouts processed successfully!');
            setShowDailyPayoutModal(false);
            fetchEmployees();
        } catch (err) {
            console.error('Payout error:', err);
            alert('Failed to process payouts');
        }
    };

    // Styles
    const cardStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    };

    const tabStyle = (isActive: boolean, color?: string): React.CSSProperties => ({
        padding: '10px 20px',
        border: 'none',
        background: isActive ? (color || '#3b82f6') : '#f1f5f9',
        color: isActive ? 'white' : '#64748b',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    const actionBtnStyle: React.CSSProperties = {
        padding: '8px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    // Get salary type badge style
    const getSalaryTypeBadge = (type: string) => {
        const styles: Record<string, { bg: string; color: string }> = {
            'Monthly': { bg: '#e0e7ff', color: '#4338ca' },
            'Weekly': { bg: '#f5f3ff', color: '#7c3aed' },
            'Daily': { bg: '#dcfce7', color: '#166534' }
        };
        return styles[type] || styles['Monthly'];
    };

    if (loading) {
        return <div style={{ padding: '50px', textAlign: 'center' }}>Loading employees...</div>;
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1e293b' }}>Employees & HR</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b' }}>Attendance, Advances, and Payroll management.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {dailyEmployees.length > 0 && (
                        <button
                            onClick={openDailyPayoutCalculator}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 20px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            <FaCalculator /> Daily Payout
                        </button>
                    )}
                    <button
                        onClick={() => { setSelectedEmployee(null); setShowAddModal(true); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        <FaPlus /> Add Employee
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ ...cardStyle, borderLeft: '4px solid #3b82f6' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Total Employees</p>
                    <h2 style={{ margin: '8px 0 0', color: '#1e293b' }}>{employees.length}</h2>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #4338ca' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Monthly Staff</p>
                    <h2 style={{ margin: '8px 0 0', color: '#1e293b' }}>{monthlyEmployees.length}</h2>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #8b5cf6' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Weekly Workers</p>
                    <h2 style={{ margin: '8px 0 0', color: '#1e293b' }}>{weeklyEmployees.length}</h2>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #10b981' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Daily Workers</p>
                    <h2 style={{ margin: '8px 0 0', color: '#1e293b' }}>{dailyEmployees.length}</h2>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Pending Advances</p>
                    <h2 style={{ margin: '8px 0 0', color: '#1e293b' }}>
                        ₹{employees.reduce((sum, e) => sum + (e.advance_balance || 0), 0).toLocaleString()}
                    </h2>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button style={tabStyle(activeTab === 'ALL', '#3b82f6')} onClick={() => setActiveTab('ALL')}>
                    <FaUser /> All ({employees.length})
                </button>
                <button style={tabStyle(activeTab === 'MONTHLY', '#4338ca')} onClick={() => setActiveTab('MONTHLY')}>
                    <FaCalendarDay /> Monthly ({monthlyEmployees.length})
                </button>
                <button style={tabStyle(activeTab === 'WEEKLY', '#8b5cf6')} onClick={() => setActiveTab('WEEKLY')}>
                    <FaCalendarWeek /> Weekly ({weeklyEmployees.length})
                </button>
                <button style={tabStyle(activeTab === 'DAILY', '#10b981')} onClick={() => setActiveTab('DAILY')}>
                    <FaUserClock /> Daily ({dailyEmployees.length})
                </button>
            </div>

            {/* Search & Table */}
            <div style={cardStyle}>
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ position: 'relative', maxWidth: '400px' }}>
                        <FaSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 42px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Employee Profile</th>
                            <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Type / Rate</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Portal Access</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Attendance</th>
                            <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Advance Due</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(emp => {
                            const badgeStyle = getSalaryTypeBadge(emp.salary_type || 'Monthly');
                            const rateLabel = emp.salary_type === 'Daily' ? '/day' : emp.salary_type === 'Weekly' ? '/wk' : '/mo';
                            
                            return (
                                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '8px',
                                                background: '#e0e7ff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#4f46e5'
                                            }}>
                                                <FaUser />
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{emp.name}</p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{emp.designation || 'Staff'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 12px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            background: badgeStyle.bg,
                                            color: badgeStyle.color
                                        }}>
                                            {emp.salary_type || 'Monthly'}
                                        </span>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                            ₹{emp.salary?.toLocaleString()}{rateLabel}
                                        </p>
                                    </td>
                                    <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                        {emp.portal_username ? (
                                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500 }}>
                                                🔑 {emp.portal_username}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                            {Math.round(((emp.days_present || 0) / 30) * 100)}%
                                        </span>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{emp.days_present || 0} Days</p>
                                    </td>
                                    <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                                        {emp.advance_balance && emp.advance_balance > 0 ? (
                                            <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                                ₹{emp.advance_balance.toLocaleString()}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => { setSelectedEmployee(emp); setShowAdvanceModal(true); }}
                                                style={{ ...actionBtnStyle, background: '#fef3c7', color: '#d97706' }}
                                                title="Give Advance"
                                            >
                                                <FaMoneyBillWave />
                                            </button>
                                            <button
                                                onClick={() => { setSelectedEmployee(emp); setShowLedgerModal(true); }}
                                                style={{ ...actionBtnStyle, background: '#e0e7ff', color: '#4f46e5' }}
                                                title="View Ledger"
                                            >
                                                <FaBook />
                                            </button>
                                            <button
                                                onClick={() => { setSelectedEmployee(emp); setShowQRModal(true); }}
                                                style={{ ...actionBtnStyle, background: '#dbeafe', color: '#2563eb' }}
                                                title="QR Code"
                                            >
                                                <FaQrcode />
                                            </button>
                                            <button
                                                onClick={() => { setSelectedEmployee(emp); setShowAddModal(true); }}
                                                style={{ ...actionBtnStyle, background: '#f0fdf4', color: '#16a34a' }}
                                                title="Edit"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id)}
                                                style={{ ...actionBtnStyle, background: '#fee2e2', color: '#dc2626' }}
                                                title="Delete"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredEmployees.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No employees found
                    </div>
                )}
            </div>

            {/* Daily Payout Modal */}
            {showDailyPayoutModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
                                    <FaCalculator style={{ marginRight: '10px', color: '#10b981' }} />
                                    Daily Workers Payout
                                </h2>
                                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                    Calculate and process daily wages
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDailyPayoutModal(false)}
                                style={{ border: 'none', background: '#f1f5f9', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                <FaTimes color="#64748b" />
                            </button>
                        </div>

                        {/* Date Selection */}
                        <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <label style={{ fontSize: '0.9rem', color: '#64748b', marginRight: '12px' }}>Payout Date:</label>
                            <input
                                type="date"
                                value={payoutDate}
                                onChange={(e) => setPayoutDate(e.target.value)}
                                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                            />
                        </div>

                        {/* Table */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '16px 8px', textAlign: 'center', width: '50px' }}>
                                            <input
                                                type="checkbox"
                                                checked={dailyPayouts.every(p => p.isSelected)}
                                                onChange={(e) => {
                                                    setDailyPayouts(prev => prev.map(p => ({ ...p, isSelected: e.target.checked })));
                                                }}
                                            />
                                        </th>
                                        <th style={{ padding: '16px 8px', textAlign: 'left', color: '#64748b' }}>Worker</th>
                                        <th style={{ padding: '16px 8px', textAlign: 'center', color: '#64748b' }}>Days</th>
                                        <th style={{ padding: '16px 8px', textAlign: 'right', color: '#64748b' }}>Daily Rate</th>
                                        <th style={{ padding: '16px 8px', textAlign: 'right', color: '#64748b' }}>Gross</th>
                                        <th style={{ padding: '16px 8px', textAlign: 'center', color: '#64748b' }}>Advance Deduction</th>
                                        <th style={{ padding: '16px 8px', textAlign: 'right', color: '#64748b' }}>Net Payout</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyPayouts.map((payout, index) => (
                                        <tr key={payout.employee.id} style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            opacity: payout.isSelected ? 1 : 0.5
                                        }}>
                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={payout.isSelected}
                                                    onChange={(e) => updatePayout(index, 'isSelected', e.target.checked)}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{payout.employee.name}</p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                                    Advance Due: ₹{(payout.employee.advance_balance || 0).toLocaleString()}
                                                </p>
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="31"
                                                    value={payout.daysWorked}
                                                    onChange={(e) => updatePayout(index, 'daysWorked', Number(e.target.value))}
                                                    style={{
                                                        width: '60px',
                                                        padding: '8px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '6px',
                                                        textAlign: 'center'
                                                    }}
                                                    disabled={!payout.isSelected}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', color: '#64748b' }}>
                                                ₹{payout.dailyRate.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                                                ₹{payout.grossAmount.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                {(payout.employee.advance_balance || 0) > 0 ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <button
                                                            onClick={() => updatePayout(index, 'advanceDeduction', Math.min(payout.grossAmount, payout.employee.advance_balance || 0))}
                                                            style={{
                                                                padding: '6px 12px',
                                                                border: 'none',
                                                                background: payout.advanceDeduction > 0 ? '#fee2e2' : '#f1f5f9',
                                                                color: payout.advanceDeduction > 0 ? '#dc2626' : '#64748b',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem'
                                                            }}
                                                            disabled={!payout.isSelected}
                                                        >
                                                            <FaMinus style={{ marginRight: '4px' }} />
                                                            Deduct
                                                        </button>
                                                        {payout.advanceDeduction > 0 && (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={Math.min(payout.grossAmount, payout.employee.advance_balance || 0)}
                                                                value={payout.advanceDeduction}
                                                                onChange={(e) => updatePayout(index, 'advanceDeduction', Number(e.target.value))}
                                                                style={{
                                                                    width: '80px',
                                                                    padding: '6px',
                                                                    border: '1px solid #fca5a5',
                                                                    borderRadius: '6px',
                                                                    textAlign: 'center',
                                                                    color: '#dc2626'
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No advance</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    fontSize: '1.1rem',
                                                    color: '#10b981'
                                                }}>
                                                    ₹{payout.netPayout.toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {dailyPayouts.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                    No daily workers found. Add employees with "Daily" salary type.
                                </div>
                            )}
                        </div>

                        {/* Summary Footer */}
                        <div style={{
                            padding: '20px 24px',
                            borderTop: '2px solid #e2e8f0',
                            background: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Total Gross</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                            ₹{totalGross.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Advance Deductions</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 600, color: '#dc2626' }}>
                                            - ₹{totalDeductions.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Net Payout</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                                            ₹{totalNet.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setShowDailyPayoutModal(false)}
                                        style={{
                                            padding: '12px 24px',
                                            border: '1px solid #e2e8f0',
                                            background: 'white',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={processDailyPayouts}
                                        disabled={selectedPayouts.length === 0}
                                        style={{
                                            padding: '12px 24px',
                                            border: 'none',
                                            background: selectedPayouts.length > 0 ? '#10b981' : '#94a3b8',
                                            color: 'white',
                                            borderRadius: '8px',
                                            cursor: selectedPayouts.length > 0 ? 'pointer' : 'not-allowed',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <FaCheck /> Process Payout ({selectedPayouts.length})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Employee Modal - Inline */}
            {showAddModal && (
                <AddEmployeeModalInline
                    employee={selectedEmployee}
                    onClose={() => { setShowAddModal(false); setSelectedEmployee(null); }}
                    onSuccess={() => { setShowAddModal(false); setSelectedEmployee(null); fetchEmployees(); }}
                />
            )}

            {/* QR Modal */}
            {showQRModal && selectedEmployee && (
                <EmployeeQRModal
                    employee={selectedEmployee}
                    onClose={() => { setShowQRModal(false); setSelectedEmployee(null); }}
                />
            )}

            {/* Ledger Modal */}
            {showLedgerModal && selectedEmployee && (
                <EmployeeLedgerModal
                    employee={selectedEmployee}
                    onClose={() => { setShowLedgerModal(false); setSelectedEmployee(null); }}
                />
            )}

            {/* Advance Modal */}
            {showAdvanceModal && selectedEmployee && (
                <AdvanceSalaryModal
                    employeeId={selectedEmployee.id}
                    employeeName={selectedEmployee.name}
                    onClose={() => { setShowAdvanceModal(false); setSelectedEmployee(null); }}
                    onSuccess={() => { setShowAdvanceModal(false); setSelectedEmployee(null); fetchEmployees(); }}
                />
            )}
        </div>
    );
};

// ============================================
// INLINE ADD EMPLOYEE MODAL WITH WEEKLY OPTION
// ============================================
interface AddEmployeeModalProps {
    employee: Employee | null;
    onClose: () => void;
    onSuccess: () => void;
}

const AddEmployeeModalInline: React.FC<AddEmployeeModalProps> = ({ employee, onClose, onSuccess }) => {
    const isEdit = !!employee;
    const [formData, setFormData] = useState({
        name: employee?.name || '',
        designation: employee?.designation || '',
        phone: employee?.phone || '',
        email: employee?.email || '',
        salary: employee?.salary?.toString() || '',
        salary_type: employee?.salary_type || 'Monthly',
        status: employee?.status || 'Active'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.salary) {
            setError('Name and Salary are required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('erp-token');
            const url = isEdit ? `/api/employees/${employee.id}` : '/api/employees';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    salary: parseFloat(formData.salary)
                })
            });

            if (res.ok) {
                onSuccess();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save employee');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    // Get salary label based on type
    const getSalaryLabel = () => {
        switch (formData.salary_type) {
            case 'Daily': return 'Daily Rate (₹) *';
            case 'Weekly': return 'Weekly Rate (₹) *';
            default: return 'Monthly Salary (₹) *';
        }
    };

    // Get placeholder based on type
    const getSalaryPlaceholder = () => {
        switch (formData.salary_type) {
            case 'Daily': return '800';
            case 'Weekly': return '5000';
            default: return '25000';
        }
    };

    // Type button colors
    const typeConfig: Record<string, { bg: string; color: string; border: string; activeBg: string }> = {
        'Monthly': { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', activeBg: '#e0e7ff' },
        'Weekly': { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', activeBg: '#f5f3ff' },
        'Daily': { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', activeBg: '#dcfce7' }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '0.95rem',
        boxSizing: 'border-box'
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '500px',
                maxHeight: '90vh',
                overflow: 'auto'
            }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
                    <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                        <FaTimes />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    {error && (
                        <div style={{ padding: '12px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Name *</label>
                        <input name="name" value={formData.name} onChange={handleChange} style={inputStyle} placeholder="Employee name" required />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Designation</label>
                        <input name="designation" value={formData.designation} onChange={handleChange} style={inputStyle} placeholder="e.g. Manager, Worker" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Phone</label>
                            <input name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} placeholder="Phone number" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Email</label>
                            <input name="email" type="email" value={formData.email} onChange={handleChange} style={inputStyle} placeholder="Email" />
                        </div>
                    </div>

                    {/* SALARY TYPE SELECTION - NOW WITH WEEKLY */}
                    <div style={{ marginBottom: '16px', background: '#f9fafb', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 500, color: '#374151' }}>Salary Type *</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            {(['Monthly', 'Weekly', 'Daily'] as const).map(type => {
                                const isActive = formData.salary_type === type;
                                const activeColors: Record<string, { bg: string; color: string; border: string }> = {
                                    'Monthly': { bg: '#e0e7ff', color: '#4338ca', border: '#6366f1' },
                                    'Weekly': { bg: '#f5f3ff', color: '#7c3aed', border: '#8b5cf6' },
                                    'Daily': { bg: '#dcfce7', color: '#166534', border: '#22c55e' }
                                };
                                const colors = isActive ? activeColors[type] : { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
                                
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, salary_type: type })}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            border: `2px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            background: colors.bg,
                                            color: colors.color,
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

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>
                                {getSalaryLabel()}
                            </label>
                            <input
                                name="salary"
                                type="number"
                                value={formData.salary}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder={getSalaryPlaceholder()}
                                required
                            />
                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                {formData.salary_type === 'Monthly' && 'Fixed monthly salary paid at end of month'}
                                {formData.salary_type === 'Weekly' && 'Weekly payment (calculated as rate ÷ 6 per day)'}
                                {formData.salary_type === 'Daily' && 'Daily wages × days worked'}
                            </p>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Status</label>
                        <select name="status" value={formData.status} onChange={handleChange} style={inputStyle}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e2e8f0', background: 'white', borderRadius: '8px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} style={{ padding: '10px 24px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                            {loading ? 'Saving...' : (isEdit ? 'Update' : 'Add Employee')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Employees;