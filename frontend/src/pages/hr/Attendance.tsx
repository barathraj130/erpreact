// frontend/src/pages/hr/Attendance.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    FaBriefcase,
    FaCalendarAlt,
    FaCheck,
    FaClock,
    FaEdit,
    FaMapMarkerAlt,
    FaSave,
    FaSearch,
    FaSync,
    FaTimes,
    FaTrash,
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
    latitude?: number;
    longitude?: number;
}

const Attendance: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    
    // Edit Modal State
    const [editModal, setEditModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [editForm, setEditForm] = useState({
        status: 'PRESENT',
        check_in_time: '',
        check_out_time: '',
        work_assigned: ''
    });

    const API_BASE = '/api';

    // Fetch employees once
    useEffect(() => {
        fetchEmployees();
    }, []);

    // Fetch attendance when date changes
    useEffect(() => {
        fetchAttendanceForDate(selectedDate);
    }, [selectedDate]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(() => {
            fetchAttendanceForDate(selectedDate);
            setLastRefresh(new Date());
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, selectedDate]);

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

    const fetchAttendanceForDate = useCallback(async (date: string) => {
        try {
            const token = localStorage.getItem('erp-token');
            const res = await fetch(`${API_BASE}/hr/attendance?date=${date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            const attendanceMap: Record<string, AttendanceRecord> = {};
            (data || []).forEach((record: AttendanceRecord) => {
                attendanceMap[`${record.employee_id}_${date}`] = record;
            });
            setAttendance(attendanceMap);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        }
    }, []);

    const markAttendance = async (employeeId: number, status: string) => {
        try {
            const token = localStorage.getItem('erp-token');
            await fetch(`${API_BASE}/hr/attendance/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    employee_id: employeeId,
                    date: selectedDate,
                    status: status,
                    check_in_time: (status === 'PRESENT' || status === 'OD' || status === 'HALF_DAY') 
                        ? new Date().toLocaleTimeString('en-US', { hour12: false }) 
                        : null
                })
            });
            fetchAttendanceForDate(selectedDate);
        } catch (err) {
            console.error('Error marking attendance:', err);
        }
    };

    const openEditModal = (employeeId: number, employee: Employee) => {
        const record = attendance[`${employeeId}_${selectedDate}`];
        
        setEditingRecord({
            employee_id: employeeId,
            employee_name: employee.name,
            date: selectedDate,
            status: record?.status || 'PRESENT',
            check_in_time: record?.check_in_time || '',
            check_out_time: record?.check_out_time || '',
            work_assigned: record?.work_assigned || '',
            id: record?.id
        });
        
        setEditForm({
            status: record?.status || 'PRESENT',
            check_in_time: record?.check_in_time || '',
            check_out_time: record?.check_out_time || '',
            work_assigned: record?.work_assigned || ''
        });
        
        setEditModal(true);
    };

    const saveAttendance = async () => {
        if (!editingRecord) return;
        
        try {
            const token = localStorage.getItem('erp-token');
            await fetch(`${API_BASE}/hr/attendance/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    employee_id: editingRecord.employee_id,
                    date: selectedDate,
                    status: editForm.status,
                    check_in_time: editForm.check_in_time || null,
                    check_out_time: editForm.check_out_time || null,
                    work_assigned: editForm.work_assigned
                })
            });
            
            setEditModal(false);
            setEditingRecord(null);
            fetchAttendanceForDate(selectedDate);
        } catch (err) {
            console.error('Error saving attendance:', err);
            alert('Failed to save attendance');
        }
    };

    const deleteAttendance = async (recordId: number) => {
        if (!confirm('Delete this attendance record?')) return;
        
        try {
            const token = localStorage.getItem('erp-token');
            await fetch(`${API_BASE}/hr/attendance/${recordId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchAttendanceForDate(selectedDate);
        } catch (err) {
            console.error('Error deleting attendance:', err);
        }
    };

    const getAttendanceStatus = (employeeId: number): AttendanceRecord | null => {
        return attendance[`${employeeId}_${selectedDate}`] || null;
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(search.toLowerCase())
    );

    // Calculate stats
    const attendanceRecords = Object.values(attendance);
    const stats = {
        present: attendanceRecords.filter(a => a.status === 'PRESENT').length,
        absent: employees.length - attendanceRecords.length,
        onDuty: attendanceRecords.filter(a => a.status === 'OD').length,
        leave: attendanceRecords.filter(a => a.status === 'LEAVE').length,
        halfDay: attendanceRecords.filter(a => a.status === 'HALF_DAY').length
    };

    const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
        'PRESENT': { label: 'Present', color: '#16a34a', bg: '#dcfce7', icon: <FaCheck /> },
        'ABSENT': { label: 'Absent', color: '#dc2626', bg: '#fee2e2', icon: <FaTimes /> },
        'OD': { label: 'On Duty', color: '#2563eb', bg: '#dbeafe', icon: <FaBriefcase /> },
        'LEAVE': { label: 'Leave', color: '#d97706', bg: '#fef3c7', icon: <FaUserClock /> },
        'HALF_DAY': { label: 'Half Day', color: '#7c3aed', bg: '#ede9fe', icon: <FaClock /> }
    };

    const cardStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    };

    if (loading) {
        return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1e293b' }}>Attendance Management</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b' }}>Track and manage employee attendance</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Auto Refresh Toggle */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '8px 16px',
                        background: autoRefresh ? '#dcfce7' : '#f1f5f9',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                    }}>
                        <FaSync color={autoRefresh ? '#16a34a' : '#94a3b8'} />
                        <span style={{ color: autoRefresh ? '#16a34a' : '#64748b' }}>
                            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
                        </span>
                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: autoRefresh ? '#16a34a' : '#cbd5e1',
                                borderRadius: '20px',
                                transition: '0.3s'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    height: '14px',
                                    width: '14px',
                                    left: autoRefresh ? '22px' : '3px',
                                    bottom: '3px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    transition: '0.3s'
                                }} />
                            </span>
                        </label>
                    </div>
                    
                    {/* Manual Refresh */}
                    <button
                        onClick={() => fetchAttendanceForDate(selectedDate)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        <FaSync /> Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <FaCheck />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Present</p>
                            <h2 style={{ margin: '4px 0 0', color: '#1e293b' }}>{stats.present}</h2>
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #dc2626' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                            <FaTimes />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Absent</p>
                            <h2 style={{ margin: '4px 0 0', color: '#1e293b' }}>{stats.absent}</h2>
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <FaBriefcase />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>On Duty</p>
                            <h2 style={{ margin: '4px 0 0', color: '#1e293b' }}>{stats.onDuty}</h2>
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #d97706' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                            <FaUserClock />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>On Leave</p>
                            <h2 style={{ margin: '4px 0 0', color: '#1e293b' }}>{stats.leave}</h2>
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                            <FaClock />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Half Day</p>
                            <h2 style={{ margin: '4px 0 0', color: '#1e293b' }}>{stats.halfDay}</h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Selector & Search */}
            <div style={{ ...cardStyle, marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <FaCalendarAlt color="#3b82f6" size={20} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                padding: '10px 16px',
                                border: '2px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 600
                            }}
                        />
                        <span style={{ color: '#64748b' }}>
                            {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Last updated: {lastRefresh.toLocaleTimeString()}
                        </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                padding: '10px 12px 10px 38px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                width: '250px'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div style={cardStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '14px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Employee</th>
                            <th style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Check In</th>
                            <th style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Check Out</th>
                            <th style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '14px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Work/Reason</th>
                            <th style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Mark Attendance</th>
                            <th style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(emp => {
                            const record = getAttendanceStatus(emp.id);
                            const status = record?.status;
                            const config = status ? statusConfig[status] : null;

                            return (
                                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: '#e0e7ff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#4f46e5',
                                                fontWeight: 600
                                            }}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{emp.name}</p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{emp.designation || 'Staff'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                        {record?.check_in_time ? (
                                            <div>
                                                <span style={{ color: '#16a34a', fontWeight: 500 }}>{record.check_in_time}</span>
                                                {record.method === 'QR_MOBILE' && (
                                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>via QR</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>--:--</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                        {record?.check_out_time ? (
                                            <span style={{ color: '#dc2626', fontWeight: 500 }}>{record.check_out_time}</span>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>--:--</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                        {config ? (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                background: config.bg,
                                                color: config.color,
                                                fontSize: '0.85rem',
                                                fontWeight: 600
                                            }}>
                                                {config.icon} {config.label}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Not Marked</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 14px', maxWidth: '200px' }}>
                                        {record?.work_assigned ? (
                                            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                {record.work_assigned}
                                                {record.latitude && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                                                        <FaMapMarkerAlt /> Location captured
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                            {Object.entries(statusConfig).slice(0, 4).map(([key, cfg]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => markAttendance(emp.id, key)}
                                                    title={cfg.label}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        border: status === key ? `2px solid ${cfg.color}` : '1px solid #e2e8f0',
                                                        borderRadius: '6px',
                                                        background: status === key ? cfg.bg : 'white',
                                                        color: cfg.color,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    {cfg.icon}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => openEditModal(emp.id, emp)}
                                                style={{
                                                    padding: '6px 10px',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    background: '#e0e7ff',
                                                    color: '#4f46e5',
                                                    cursor: 'pointer'
                                                }}
                                                title="Edit"
                                            >
                                                <FaEdit />
                                            </button>
                                            {record?.id && (
                                                <button
                                                    onClick={() => deleteAttendance(record.id!)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        background: '#fee2e2',
                                                        color: '#dc2626',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Delete"
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
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

            {/* Edit Modal */}
            {editModal && editingRecord && (
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
                        width: '450px',
                        padding: '24px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
                                Edit Attendance - {editingRecord.employee_name}
                            </h2>
                            <button
                                onClick={() => setEditModal(false)}
                                style={{ border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Date</label>
                            <input
                                type="text"
                                value={new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                disabled
                                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Status</label>
                            <select
                                value={editForm.status}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            >
                                <option value="PRESENT">Present</option>
                                <option value="ABSENT">Absent</option>
                                <option value="OD">On Duty</option>
                                <option value="LEAVE">Leave</option>
                                <option value="HALF_DAY">Half Day</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Check In</label>
                                <input
                                    type="time"
                                    value={editForm.check_in_time}
                                    onChange={(e) => setEditForm({ ...editForm, check_in_time: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>Check Out</label>
                                <input
                                    type="time"
                                    value={editForm.check_out_time}
                                    onChange={(e) => setEditForm({ ...editForm, check_out_time: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>
                                {editForm.status === 'OD' ? 'Work Location / Assignment' : editForm.status === 'LEAVE' ? 'Leave Reason' : 'Notes'}
                            </label>
                            <textarea
                                value={editForm.work_assigned}
                                onChange={(e) => setEditForm({ ...editForm, work_assigned: e.target.value })}
                                placeholder={editForm.status === 'OD' ? 'Enter work location or assignment...' : 'Enter reason or notes...'}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    minHeight: '80px',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setEditModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    background: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveAttendance}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 24px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                <FaSave /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;