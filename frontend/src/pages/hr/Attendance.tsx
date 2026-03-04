// frontend/src/pages/hr/Attendance.tsx
import { motion } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FaBriefcase, FaCalendarAlt, FaCheck, FaClock,
    FaFingerprint,
    FaSearch, FaSync, FaTimes,
    FaUserClock
} from 'react-icons/fa';

interface Employee {
    id: number;
    name: string;
    designation?: string;
    salary_type?: string;
}

interface AttendanceRecord {
    id?: number;
    employee_id: number;
    employee_name?: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'OD' | 'LEAVE' | 'HALF_DAY';
    check_in_time?: string;
    check_out_time?: string;
    work_assigned?: string;
    method?: string;
}

const Attendance: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    
    useEffect(() => {
        const load = async () => {
            const token = localStorage.getItem('erp-token');
            const res = await fetch('/api/employees', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setEmployees(data || []);
            setLoading(false);
        };
        load();
    }, []);

    const fetchAttendanceForDate = useCallback(async (date: string) => {
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(`/api/hr/attendance?date=${date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const attendanceMap: Record<string, AttendanceRecord> = {};
            (data || []).forEach((record: AttendanceRecord) => {
                attendanceMap[`${record.employee_id}_${date}`] = record;
            });
            setAttendance(attendanceMap);
        } catch (err) {}
    }, []);

    useEffect(() => {
        fetchAttendanceForDate(selectedDate);
    }, [selectedDate, fetchAttendanceForDate]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => fetchAttendanceForDate(selectedDate), 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, selectedDate, fetchAttendanceForDate]);

    const markAttendance = async (employeeId: number, status: string) => {
        const token = localStorage.getItem('erp-token');
        await fetch('/api/hr/attendance/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                employee_id: employeeId,
                date: selectedDate,
                status: status,
                check_in_time: ['PRESENT', 'OD', 'HALF_DAY'].includes(status) ? new Date().toLocaleTimeString('en-US', { hour12: false }) : null
            })
        });
        fetchAttendanceForDate(selectedDate);
    };

    const stats = {
        total: employees.length,
        present: Object.values(attendance).filter(a => a.status === 'PRESENT').length,
        absent: employees.length - Object.values(attendance).length,
        onDuty: Object.values(attendance).filter(a => a.status === 'OD').length,
    };

    const statusConfig: any = {
        'PRESENT': { label: 'PRESENT', color: '#10b981', bg: '#dcfce7', icon: <FaCheck /> },
        'ABSENT': { label: 'ABSENT', color: '#ef4444', bg: '#fee2e2', icon: <FaTimes /> },
        'OD': { label: 'ON DUTY', color: '#3b82f6', bg: '#dbeafe', icon: <FaBriefcase /> },
        'LEAVE': { label: 'LEAVE', color: '#f59e0b', bg: '#fef3c7', icon: <FaUserClock /> },
        'HALF_DAY': { label: 'HALF DAY', color: '#8b5cf6', bg: '#ede9fe', icon: <FaClock /> }
    };

    return (
        <div className="employees-container">
            <header className="employees-header">
                <div className="employees-title">
                    <motion.h1 initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>Presence Registry</motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                        Real-time workforce monitoring and authentication matrix.
                    </motion.p>
                </div>
                <div className="employees-actions" style={{ alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                        <FaCalendarAlt color="var(--primary)" />
                        <input 
                            type="date" 
                            className="premium-input" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)}
                            style={{ border: 'none', background: 'transparent', padding: 0, fontWeight: 800, width: '130px' }}
                        />
                    </div>
                    <motion.button 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }} 
                        className={`btn-secondary ${autoRefresh ? 'active' : ''}`} 
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{ height: '52px', border: autoRefresh ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}
                    >
                        <FaSync className={autoRefresh ? 'fa-spin' : ''} style={{ animationDuration: '4s' }} /> 
                        {autoRefresh ? 'Real-time Linked' : 'Stream Paused'}
                    </motion.button>
                </div>
            </header>

            <div className="stats-matrix">
                {[
                    { label: 'Total Personnel', value: stats.total, icon: <FaUserClock />, color: 'var(--text-muted)' },
                    { label: 'Verified Present', value: stats.present, icon: <FaCheck />, color: 'var(--success)' },
                    { label: 'Registry Absence', value: stats.absent, icon: <FaTimes />, color: 'var(--error)' },
                    { label: 'On-Field Operatives', value: stats.onDuty, icon: <FaBriefcase />, color: 'var(--primary)' }
                ].map((stat, i) => (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i} className="matrix-card">
                        <div className="matrix-icon" style={{ color: stat.color, opacity: 0.1, position: 'absolute', right: '20px', top: '20px', fontSize: '2rem' }}>{stat.icon}</div>
                        <span className="matrix-label">{stat.label}</span>
                        <h3 className="matrix-value" style={{ color: i > 0 ? stat.color : 'inherit' }}>{stat.value}</h3>
                    </motion.div>
                ))}
            </div>

            <div className="search-orb">
                <FaSearch style={{ color: 'var(--text-muted)' }} size={20} />
                <input 
                    placeholder="Identify workforce member via name or ID..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="employee-table-container">
                <table className="emp-table">
                    <thead>
                        <tr>
                            <th>Personnel Profile</th>
                            <th style={{ textAlign: 'center' }}>Clock In</th>
                            <th style={{ textAlign: 'center' }}>Clock Out</th>
                            <th>Status Signature</th>
                            <th>Methods</th>
                            <th style={{ textAlign: 'center' }}>Interface Override</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).map((emp, idx) => {
                            const record = attendance[`${emp.id}_${selectedDate}`];
                            const cfg = record ? statusConfig[record.status] : null;
                            return (
                                <motion.tr 
                                    key={emp.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="emp-row"
                                >
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div className="profile-orb" style={{ background: record ? 'var(--primary-glow)' : '#f1f5f9' }}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800 }}>{emp.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{emp.designation || 'Specialist'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 900, color: record?.check_in_time ? 'var(--success)' : '#cbd5e1' }}>
                                        {record?.check_in_time || '--:--'}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 900, color: record?.check_out_time ? 'var(--error)' : '#cbd5e1' }}>
                                        {record?.check_out_time || '--:--'}
                                    </td>
                                    <td>
                                        {cfg ? (
                                            <span className="status-pill" style={{ background: cfg.bg, color: cfg.color }}>
                                                {cfg.label}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, opacity: 0.5, letterSpacing: '1px' }}>UNMARKED</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                            <FaFingerprint size={14} style={{ opacity: record ? 1 : 0.2 }} />
                                            {record ? (record.method || 'MANUAL') : 'WAITING'}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                            {Object.entries(statusConfig).map(([key, c]: any) => (
                                                <motion.button 
                                                    key={key}
                                                    whileHover={{ scale: 1.15 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    style={{ 
                                                        width: 32, height: 32, borderRadius: 10, border: 'none',
                                                        color: record?.status === key ? 'white' : 'var(--text-muted)', 
                                                        background: record?.status === key ? c.color : '#f1f5f9',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    onClick={() => markAttendance(emp.id, key)}
                                                    title={c.label}
                                                >
                                                    {c.icon}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Attendance;