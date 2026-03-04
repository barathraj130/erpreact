import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import {
    FaBook,
    FaCalculator,
    FaCalendarDay,
    FaCalendarWeek,
    FaEdit,
    FaMoneyBillWave,
    FaPlus,
    FaQrcode,
    FaSearch,
    FaSync,
    FaTimes,
    FaTrash,
    FaUser,
    FaUserClock
} from 'react-icons/fa';
import './Employees.css';
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

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch('/api/employees', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setEmployees(data || []);
        } catch (err) {
            console.error('Workforce sync failure', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Relinquish this human asset record? This is irreversible.')) return;
        try {
            const token = localStorage.getItem('erp-token');
            await fetch(`/api/employees/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchEmployees();
        } catch (err) {}
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || 
                             (emp.designation || '').toLowerCase().includes(search.toLowerCase());
        const matchesTab = activeTab === 'ALL' || emp.salary_type.toUpperCase() === activeTab;
        return matchesSearch && matchesTab;
    });

    const stats = {
        total: employees.length,
        monthly: employees.filter(e => e.salary_type === 'Monthly').length,
        weekly: employees.filter(e => e.salary_type === 'Weekly').length,
        daily: employees.filter(e => e.salary_type === 'Daily').length
    };

    const openDailyPayoutCalculator = () => {
        const dailyWorkers = employees.filter(e => e.salary_type === 'Daily');
        const payouts: DailyWorkerPayout[] = dailyWorkers.map(emp => ({
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

    const selectedPayouts = dailyPayouts.filter(p => p.isSelected);
    const totalNet = selectedPayouts.reduce((sum, p) => sum + p.netPayout, 0);
    const totalDeductions = selectedPayouts.reduce((sum, p) => sum + p.advanceDeduction, 0);

    const processDailyPayouts = async () => {
        if (!confirm(`Process payouts for ${selectedPayouts.length} workers?\n\nTotal: ₹${totalNet.toLocaleString()}`)) return;
        try {
            alert('✅ Daily payouts processed successfully!');
            setShowDailyPayoutModal(false);
            fetchEmployees();
        } catch (err) {
            alert('Failed to process payouts');
        }
    };

    return (
        <div className="employees-container">
            <header className="employees-header">
                <div className="employees-title">
                    <motion.h1 initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>Workforce Registry</motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                        Human Capital Allocation & Performance Surveillance Matrix
                    </motion.p>
                </div>
                <div className="employees-actions">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-secondary" onClick={fetchEmployees} style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary" onClick={() => { setSelectedEmployee(null); setShowAddModal(true); }} style={{ height: '52px', padding: '0 28px', borderRadius: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaPlus /> Initialize Onboarding
                    </motion.button>
                </div>
            </header>

            <div className="stats-matrix">
                {[
                    { label: 'Total Personnel', value: stats.total, icon: <FaUser />, color: 'var(--primary)' },
                    { label: 'Retainer Base', value: stats.monthly, icon: <FaCalendarWeek />, color: '#6366f1' },
                    { label: 'Weekly Operatives', value: stats.weekly, icon: <FaCalendarDay />, color: '#a855f7' },
                    { label: 'Daily Tacticals', value: stats.daily, icon: <FaUserClock />, color: '#ec4899' }
                ].map((stat, i) => (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i} className="matrix-card">
                        <div className="matrix-icon" style={{ color: stat.color, opacity: 0.1, position: 'absolute', right: '20px', top: '20px', fontSize: '2rem' }}>{stat.icon}</div>
                        <span className="matrix-label">{stat.label}</span>
                        <h3 className="matrix-value">{stat.value}</h3>
                    </motion.div>
                ))}
            </div>

            <div className="hub-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', gap: '20px', flexWrap: 'wrap' }}>
                <div className="employees-tabs">
                    {(['ALL', 'MONTHLY', 'WEEKLY', 'DAILY'] as const).map(tab => (
                        <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab}
                        </button>
                    ))}
                </div>
                
                {activeTab === 'DAILY' && stats.daily > 0 && (
                    <motion.button initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.05 }} className="btn-enterprise" onClick={openDailyPayoutCalculator} style={{ height: '48px', padding: '0 24px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaCalculator /> Daily Ledger Sync
                    </motion.button>
                )}
            </div>

            <div className="search-orb">
                <FaSearch style={{ color: 'var(--text-muted)' }} size={20} />
                <input placeholder="Locate operative via name, designation, or ID code..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="employee-table-container">
                <table className="emp-table">
                    <thead>
                        <tr>
                            <th>Operative Identity</th>
                            <th>Protocol Designation</th>
                            <th>Remuneration</th>
                            <th style={{ textAlign: 'center' }}>Engagement</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'center' }}>Interface</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(6)].map((_, i) => <tr key={i}><td colSpan={6} style={{ padding: '30px' }}><div className="skeleton" style={{ height: '30px', borderRadius: '8px' }}></div></td></tr>)
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '100px 0', textAlign: 'center' }}><FaUser size={64} style={{ opacity: 0.1, marginBottom: '20px' }} /><h3 style={{ opacity: 0.3 }}>Empty Garrison</h3></td></tr>
                        ) : (
                            filteredEmployees.map((emp, i) => (
                                <motion.tr initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={emp.id} className="emp-row">
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div className="profile-orb">{(emp.name || 'U').charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{emp.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{emp.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{emp.designation || 'Specialist'}</td>
                                    <td>
                                        <div style={{ fontWeight: 900 }}>₹{emp.salary.toLocaleString()}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Per {emp.salary_type}</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className="attendance-pill">{emp.days_present || 0} Cycles</div>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${emp.status?.toLowerCase()}`}>{emp.status || 'Active'}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button className="control-btn" style={{ background: 'var(--bg-body)' }} onClick={() => { setSelectedEmployee(emp); setShowQRModal(true); }} title="QR Node"><FaQrcode /></button>
                                            <button className="control-btn" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }} onClick={() => { setSelectedEmployee(emp); setShowLedgerModal(true); }} title="Ledger Audit"><FaBook /></button>
                                            <button className="control-btn" style={{ background: 'var(--success-glow)', color: 'var(--success)' }} onClick={() => { setSelectedEmployee(emp); setShowAdvanceModal(true); }} title="Credit Advance"><FaMoneyBillWave /></button>
                                            <button className="control-btn" style={{ background: 'var(--bg-body)' }} onClick={() => { setSelectedEmployee(emp); setShowAddModal(true); }} title="Modify"><FaEdit /></button>
                                            <button className="control-btn" style={{ background: 'var(--error-glow)', color: 'var(--error)' }} onClick={() => handleDelete(emp.id)} title="Relinquish"><FaTrash /></button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showAddModal && (
                    <AddEmployeeModalInline
                        employee={selectedEmployee}
                        onClose={() => setShowAddModal(false)}
                        onSuccess={() => { setShowAddModal(false); fetchEmployees(); }}
                    />
                )}
                
                {showQRModal && selectedEmployee && (
                    <EmployeeQRModal employee={selectedEmployee} onClose={() => setShowQRModal(false)} />
                )}

                {showLedgerModal && selectedEmployee && (
                    <EmployeeLedgerModal employee={selectedEmployee} onClose={() => setShowLedgerModal(false)} />
                )}

                {showAdvanceModal && selectedEmployee && (
                    <AdvanceSalaryModal 
                        employeeId={selectedEmployee.id} 
                        employeeName={selectedEmployee.name} 
                        onClose={() => setShowAdvanceModal(false)} 
                        onSuccess={fetchEmployees} 
                    />
                )}

                {showDailyPayoutModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="premium-modal-overlay">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="premium-modal" style={{ maxWidth: '900px' }}>
                            <div className="modal-header">
                                <h3 style={{ margin: 0, fontWeight: 900 }}>Daily Payout Gateway</h3>
                                <button onClick={() => setShowDailyPayoutModal(false)} className="btn-secondary" style={{ padding: '8px', width: '36px', height: '36px' }}><FaTimes /></button>
                            </div>
                            <div className="modal-content" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                <table className="emp-table">
                                    <thead>
                                        <tr>
                                            <th>Operative</th>
                                            <th style={{ textAlign: 'center' }}>Cycles</th>
                                            <th style={{ textAlign: 'right' }}>Rate</th>
                                            <th style={{ textAlign: 'right' }}>Deduction</th>
                                            <th style={{ textAlign: 'right' }}>Disbursement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailyPayouts.map((p, i) => (
                                            <tr key={p.employee.id}>
                                                <td><div style={{ fontWeight: 800 }}>{p.employee.name}</div></td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input type="number" value={p.daysWorked} onChange={e => updatePayout(i, 'daysWorked', Number(e.target.value))} className="premium-input" style={{ width: '60px', textAlign: 'center', padding: '6px' }} />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>₹{p.dailyRate}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <input type="number" value={p.advanceDeduction} onChange={e => updatePayout(i, 'advanceDeduction', Number(e.target.value))} className="premium-input" style={{ width: '80px', textAlign: 'right', padding: '6px', color: 'var(--error)' }} />
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 950, color: 'var(--success)' }}>₹{p.netPayout.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="modal-header" style={{ borderBottom: 'none', borderTop: '1px solid var(--border-color)', background: '#f8fafc' }}>
                                <div style={{ fontWeight: 900 }}>Total Disbursement: <span style={{ color: 'var(--success)', fontSize: '1.5rem' }}>₹{totalNet.toLocaleString()}</span></div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn-secondary" onClick={() => setShowDailyPayoutModal(false)}>Abort</button>
                                    <button className="btn-primary" onClick={processDailyPayouts} style={{ background: 'var(--success)', border: 'none' }}>Record Payrun</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Subcomponent: Add/Edit Modal ---
const AddEmployeeModalInline: React.FC<{ employee: Employee | null; onClose: () => void; onSuccess: () => void; }> = ({ employee, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: employee?.name || '',
        designation: employee?.designation || '',
        phone: employee?.phone || '',
        salary: employee?.salary || 0,
        salary_type: employee?.salary_type || 'Monthly',
        status: employee?.status || 'Active'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(employee ? `/api/employees/${employee.id}` : '/api/employees', {
                method: employee ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            if (res.ok) onSuccess();
        } catch (err) { alert("Execution error"); }
    };

    return (
        <div className="premium-modal-overlay">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="premium-modal" style={{ maxWidth: '500px' }}>
                <div className="modal-header"><h3 style={{ margin: 0 }}>{employee ? 'Modify Asset' : 'Onboard Operative'}</h3></div>
                <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
                    <div className="input-group">
                        <label>Personnel Name</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="premium-input" required />
                    </div>
                    <div className="input-group">
                        <label>Protocol Role</label>
                        <input value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="premium-input" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-group">
                            <label>Remuneration</label>
                            <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} className="premium-input" />
                        </div>
                        <div className="input-group">
                            <label>Cycle</label>
                            <select value={formData.salary_type} onChange={e => setFormData({...formData, salary_type: e.target.value as any})} className="premium-input">
                                <option value="Monthly">Monthly</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Daily">Daily</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ width: '100%' }}>Abort</button>
                        <button type="submit" className="btn-primary" style={{ width: '100%' }}>Commit Record</button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default Employees;