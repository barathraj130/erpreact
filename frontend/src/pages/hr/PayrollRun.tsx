// frontend/src/pages/hr/PayrollRun.tsx
import React, { useEffect, useState } from 'react';
import {
    FaCalculator,
    FaCalendarAlt,
    FaCalendarWeek,
    FaCheck,
    FaChevronDown,
    FaChevronUp,
    FaHistory,
    FaMoneyBillWave,
    FaSearch,
    FaUserClock,
    FaUsers
} from 'react-icons/fa';

interface PayrollItem {
    employee: {
        id: number;
        name: string;
        designation?: string;
        salary: number;
        salary_type: string;
    };
    attendance: {
        working_days: number;
        half_days: number;
        leave_days: number;
        effective_days: number;
    };
    days_present: number;
    gross: number;
    deduction: number;
    net_pay: number;
    advance_id?: number;
    original_deduction: number;
    skipped: boolean;
}

interface PayrollHistory {
    id: number;
    employee_name: string;
    month_year: string;
    gross_earnings: number;
    total_deductions: number;
    net_pay: number;
    status: string;
    generated_at: string;
    salary_type?: string;
}

const PayrollRun: React.FC = () => {
    const [payrollData, setPayrollData] = useState<PayrollItem[]>([]);
    const [payrollHistory, setPayrollHistory] = useState<PayrollHistory[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [weekStart, setWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(today.setDate(diff)).toISOString().split('T')[0];
    });
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [activeTab, setActiveTab] = useState<'MONTHLY' | 'WEEKLY' | 'DAILY'>('MONTHLY');
    const [searchTerm, setSearchTerm] = useState('');

    const API_BASE = '/api';

    useEffect(() => {
        fetchPayrollHistory();
    }, []);

    const fetchPayrollHistory = async () => {
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(`${API_BASE}/hr/payroll/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPayrollHistory(data || []);
        } catch (err) {
            console.error('Error fetching payroll history:', err);
        }
    };

    const generatePayroll = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(`${API_BASE}/hr/payroll/preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ month_year: selectedMonth })
            });
            const data = await res.json();
            setPayrollData(data || []);
        } catch (err) {
            console.error('Error generating payroll:', err);
            alert('Failed to generate payroll preview');
        } finally {
            setLoading(false);
        }
    };

    const updateDeduction = (empId: number, value: number) => {
        setPayrollData(prev => prev.map(item => {
            if (item.employee.id === empId) {
                const newDeduction = Math.min(Math.max(0, value), item.original_deduction);
                return { ...item, deduction: newDeduction, net_pay: item.gross - newDeduction };
            }
            return item;
        }));
    };

    const toggleSkip = (empId: number) => {
        setPayrollData(prev => prev.map(item =>
            item.employee.id === empId ? { ...item, skipped: !item.skipped } : item
        ));
    };

    const processPayroll = async (salaryType: string) => {
        const itemsToProcess = payrollData.filter(p =>
            !p.skipped && (p.employee.salary_type || 'Monthly') === salaryType
        );

        if (itemsToProcess.length === 0) {
            alert('No employees to process');
            return;
        }

        const total = itemsToProcess.reduce((sum, p) => sum + p.net_pay, 0);
        if (!confirm(`Process ${salaryType} payroll for ${itemsToProcess.length} employees?\n\nTotal: ₹${total.toLocaleString()}`)) return;

        setProcessing(true);
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(`${API_BASE}/hr/payroll/finalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    month_year: selectedMonth,
                    payroll_data: itemsToProcess,
                    salary_type: salaryType
                })
            });

            if (res.ok) {
                alert(`✅ ${salaryType} Payroll processed successfully!`);
                setPayrollData(prev => prev.filter(p =>
                    p.skipped || (p.employee.salary_type || 'Monthly') !== salaryType
                ));
                fetchPayrollHistory();
            } else {
                throw new Error('Failed to process');
            }
        } catch (err) {
            console.error('Error processing payroll:', err);
            alert('Failed to process payroll');
        } finally {
            setProcessing(false);
        }
    };

    // Filter by salary type
    const monthlyPayroll = payrollData.filter(p => (p.employee.salary_type || 'Monthly') === 'Monthly');
    const weeklyPayroll = payrollData.filter(p => p.employee.salary_type === 'Weekly');
    const dailyPayroll = payrollData.filter(p => p.employee.salary_type === 'Daily');

    const getCurrentPayroll = () => {
        let base = [];
        switch (activeTab) {
            case 'MONTHLY': base = monthlyPayroll; break;
            case 'WEEKLY': base = weeklyPayroll; break;
            case 'DAILY': base = dailyPayroll; break;
        }
        
        if (!searchTerm.trim()) return base;
        
        return base.filter(p => 
            p.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.employee.designation?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const currentPayroll = getCurrentPayroll();
    const currentActivePayroll = currentPayroll.filter(p => !p.skipped);
    const currentTotalGross = currentActivePayroll.reduce((sum, p) => sum + p.gross, 0);
    const currentTotalDeductions = currentActivePayroll.reduce((sum, p) => sum + p.deduction, 0);
    const currentTotalNet = currentActivePayroll.reduce((sum, p) => sum + p.net_pay, 0);

    // Overall totals
    const allActivePayroll = payrollData.filter(p => !p.skipped);
    const overallTotalNet = allActivePayroll.reduce((sum, p) => sum + p.net_pay, 0);

    const cardStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    };

    const tabConfig = {
        MONTHLY: { icon: <FaUsers />, label: 'Monthly Staff', count: monthlyPayroll.length, color: '#3b82f6', bg: '#eff6ff' },
        WEEKLY: { icon: <FaCalendarWeek />, label: 'Weekly Workers', count: weeklyPayroll.length, color: '#8b5cf6', bg: '#f5f3ff' },
        DAILY: { icon: <FaUserClock />, label: 'Daily Workers', count: dailyPayroll.length, color: '#10b981', bg: '#ecfdf5' }
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1e293b' }}>Payroll Management</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b' }}>Calculate and process employee salaries</p>
                </div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    <FaHistory /> Payroll History {showHistory ? <FaChevronUp /> : <FaChevronDown />}
                </button>
            </div>

            {/* History Panel */}
            {showHistory && (
                <div style={{ ...cardStyle, marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Recent Payroll Runs</h3>
                    {payrollHistory.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>Period</th>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>Employee</th>
                                    <th style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>Type</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Gross</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Deductions</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Net Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrollHistory.slice(0, 15).map((record, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px' }}>{record.month_year}</td>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{record.employee_name}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: record.salary_type === 'Daily' ? '#dcfce7' : record.salary_type === 'Weekly' ? '#f5f3ff' : '#e0e7ff',
                                                color: record.salary_type === 'Daily' ? '#166534' : record.salary_type === 'Weekly' ? '#6d28d9' : '#4338ca'
                                            }}>
                                                {record.salary_type || 'Monthly'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>₹{Number(record.gross_earnings || 0).toLocaleString()}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#dc2626' }}>₹{Number(record.total_deductions || 0).toLocaleString()}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{Number(record.net_pay || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No payroll history found</p>
                    )}
                </div>
            )}

            {/* Period Selection & Generate */}
            <div style={{ ...cardStyle, marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FaCalendarAlt color="#3b82f6" size={20} />
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Select Month</label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        fontWeight: 600
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FaCalendarWeek color="#8b5cf6" size={20} />
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Week Start (for Weekly)</label>
                                <input
                                    type="date"
                                    value={weekStart}
                                    onChange={(e) => setWeekStart(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        fontWeight: 600
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={generatePayroll}
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#3b82f6',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            fontSize: '1rem'
                        }}
                    >
                        <FaCalculator /> {loading ? 'Calculating...' : 'Generate Payroll'}
                    </button>
                </div>
            </div>

            {/* Payroll Data */}
            {payrollData.length > 0 && (
                <>
                    {/* Overall Summary */}
                    <div style={{
                        ...cardStyle,
                        marginBottom: '24px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                            <div>
                                <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Total Payroll Amount</p>
                                <h1 style={{ margin: '8px 0 0', fontSize: '2.5rem' }}>₹{overallTotalNet.toLocaleString()}</h1>
                            </div>
                            <div style={{ display: 'flex', gap: '30px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>Monthly</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                                        ₹{monthlyPayroll.filter(p => !p.skipped).reduce((s, p) => s + p.net_pay, 0).toLocaleString()}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>Weekly</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                                        ₹{weeklyPayroll.filter(p => !p.skipped).reduce((s, p) => s + p.net_pay, 0).toLocaleString()}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>Daily</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                                        ₹{dailyPayroll.filter(p => !p.skipped).reduce((s, p) => s + p.net_pay, 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        {(['MONTHLY', 'WEEKLY', 'DAILY'] as const).map(tab => {
                            const config = tabConfig[tab];
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 20px',
                                        border: isActive ? `2px solid ${config.color}` : '2px solid transparent',
                                        borderRadius: '10px',
                                        background: isActive ? config.bg : '#f8fafc',
                                        color: isActive ? config.color : '#64748b',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {config.icon} {config.label} ({config.count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Current Tab Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                        <div style={{ ...cardStyle, borderLeft: `5px solid ${tabConfig[activeTab].color}`, padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Employees</p>
                                    <h2 style={{ margin: '12px 0 0', color: '#1e293b', fontSize: '2rem', fontWeight: 800 }}>{currentActivePayroll.length}</h2>
                                </div>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${tabConfig[activeTab].bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tabConfig[activeTab].color }}>
                                    <FaUsers size={24} />
                                </div>
                            </div>
                        </div>
                        <div style={{ ...cardStyle, borderLeft: '5px solid #10b981', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Gross</p>
                                    <h2 style={{ margin: '12px 0 0', color: '#10b981', fontSize: '2rem', fontWeight: 800 }}>₹{currentTotalGross.toLocaleString()}</h2>
                                </div>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                    <FaMoneyBillWave size={24} />
                                </div>
                            </div>
                        </div>
                        <div style={{ ...cardStyle, borderLeft: '5px solid #ef4444', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Deductions</p>
                                    <h2 style={{ margin: '12px 0 0', color: '#ef4444', fontSize: '2rem', fontWeight: 800 }}>₹{currentTotalDeductions.toLocaleString()}</h2>
                                </div>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                    <FaCalculator size={24} />
                                </div>
                            </div>
                        </div>
                        <div style={{ ...cardStyle, borderLeft: '5px solid #8b5cf6', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Payable</p>
                                    <h2 style={{ margin: '12px 0 0', color: '#8b5cf6', fontSize: '2rem', fontWeight: 800 }}>₹{currentTotalNet.toLocaleString()}</h2>
                                </div>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                                    <FaUserClock size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search Toolbar */}
                    <div className="card" style={{ 
                        padding: '0 24px', 
                        marginBottom: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px', 
                        border: '1px solid var(--border-color)', 
                        height: '64px', 
                        background: 'white', 
                        boxShadow: 'var(--shadow-sm)', 
                        borderRadius: '18px' 
                    }}>
                        <FaSearch style={{ color: 'var(--text-light)' }} size={20} />
                        <input 
                            placeholder="Search employees in current tab..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                border: 'none', 
                                width: '100%', 
                                outline: 'none', 
                                background: 'transparent', 
                                fontSize: '1.05rem', 
                                fontWeight: 500, 
                                color: 'var(--text-main)',
                                letterSpacing: '-0.2px'
                            }} 
                        />
                    </div>

                    {/* Payroll Table */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: '#1e293b' }}>{tabConfig[activeTab].label} Payroll</h3>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                {activeTab === 'WEEKLY' ? `Week: ${weekStart}` : `Period: ${selectedMonth}`}
                            </span>
                        </div>

                        {currentPayroll.length > 0 ? (
                            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '14px', textAlign: 'left', color: '#64748b' }}>Employee</th>
                                        <th style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>Days Present</th>
                                        <th style={{ padding: '14px', textAlign: 'right', color: '#64748b' }}>Base Salary</th>
                                        <th style={{ padding: '14px', textAlign: 'right', color: '#64748b' }}>Gross Earnings</th>
                                        <th style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>Advance Deduction</th>
                                        <th style={{ padding: '14px', textAlign: 'right', color: '#64748b' }}>Net Pay</th>
                                        <th style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentPayroll.map((item) => (
                                        <tr
                                            key={item.employee.id}
                                            style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                opacity: item.skipped ? 0.5 : 1,
                                                background: item.skipped ? '#fafafa' : 'white'
                                            }}
                                        >
                                            <td style={{ padding: '16px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        background: tabConfig[activeTab].bg,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: tabConfig[activeTab].color,
                                                        fontWeight: 600
                                                    }}>
                                                        {item.employee.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{item.employee.name}</p>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{item.employee.designation || 'Staff'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    background: item.days_present >= 26 ? '#dcfce7' : item.days_present >= 20 ? '#fef3c7' : '#fee2e2',
                                                    color: item.days_present >= 26 ? '#16a34a' : item.days_present >= 20 ? '#d97706' : '#dc2626',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem'
                                                }}>
                                                    {item.days_present} days
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 14px', textAlign: 'right', color: '#64748b' }}>
                                                ₹{item.employee.salary?.toLocaleString()}
                                                <span style={{ fontSize: '0.75rem' }}>
                                                    {activeTab === 'DAILY' ? '/day' : activeTab === 'WEEKLY' ? '/wk' : '/mo'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 14px', textAlign: 'right', fontWeight: 600 }}>
                                                ₹{item.gross.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                                {item.original_deduction > 0 ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.original_deduction}
                                                        value={item.deduction}
                                                        onChange={(e) => updateDeduction(item.employee.id, Number(e.target.value))}
                                                        disabled={item.skipped}
                                                        style={{
                                                            width: '90px',
                                                            padding: '8px',
                                                            border: '1px solid #fca5a5',
                                                            borderRadius: '6px',
                                                            textAlign: 'center',
                                                            color: '#dc2626',
                                                            fontWeight: 500
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{ color: '#94a3b8' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 14px', textAlign: 'right' }}>
                                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>
                                                    ₹{item.net_pay.toLocaleString()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => toggleSkip(item.employee.id)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        background: item.skipped ? '#fee2e2' : '#f1f5f9',
                                                        color: item.skipped ? '#dc2626' : '#64748b',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    {item.skipped ? 'Skipped' : 'Skip'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                <p>No {tabConfig[activeTab].label.toLowerCase()} found</p>
                                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                                    Add employees with "{activeTab === 'MONTHLY' ? 'Monthly' : activeTab === 'WEEKLY' ? 'Weekly' : 'Daily'}" salary type
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Process Button */}
                    {currentPayroll.length > 0 && (
                        <div style={{
                            ...cardStyle,
                            marginTop: '24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <p style={{ margin: 0, color: '#64748b' }}>
                                    Processing payroll for <strong>{currentActivePayroll.length}</strong> {tabConfig[activeTab].label.toLowerCase()}
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>
                                    {currentPayroll.filter(p => p.skipped).length} employees will be skipped
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setPayrollData([])}
                                    style={{
                                        padding: '12px 24px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => processPayroll(activeTab === 'MONTHLY' ? 'Monthly' : activeTab === 'WEEKLY' ? 'Weekly' : 'Daily')}
                                    disabled={processing || currentActivePayroll.length === 0}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 32px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: currentActivePayroll.length > 0 ? tabConfig[activeTab].color : '#94a3b8',
                                        color: 'white',
                                        cursor: currentActivePayroll.length > 0 ? 'pointer' : 'not-allowed',
                                        fontWeight: 600,
                                        fontSize: '1rem'
                                    }}
                                >
                                    <FaCheck /> {processing ? 'Processing...' : `Process ${tabConfig[activeTab].label} (₹${currentTotalNet.toLocaleString()})`}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Empty State */}
            {payrollData.length === 0 && !loading && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
                    <FaMoneyBillWave size={50} color="#94a3b8" />
                    <h3 style={{ margin: '20px 0 8px', color: '#1e293b' }}>Generate Payroll</h3>
                    <p style={{ margin: 0, color: '#64748b', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Select a period and click "Generate Payroll" to calculate salaries for Monthly, Weekly, and Daily workers
                    </p>
                </div>
            )}
        </div>
    );
};

export default PayrollRun;