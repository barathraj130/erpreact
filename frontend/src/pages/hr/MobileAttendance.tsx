// frontend/src/pages/hr/MobileAttendance.tsx
// This page is accessed when employee scans QR code on their phone
// URL format: /mark-attendance?token=EMP_1_SECRET

import React, { useEffect, useState } from 'react';
import {
    FaBriefcase,
    FaCheckCircle,
    FaMapMarkerAlt,
    FaSpinner,
    FaTimesCircle,
    FaUserClock
} from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';

interface AttendanceResponse {
    success?: boolean;
    message?: string;
    error?: string;
    employee_name?: string;
    type?: string;
}

const MobileAttendance: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    // States
    const [step, setStep] = useState<'SELECT' | 'REASON' | 'SUBMITTING' | 'SUCCESS' | 'ERROR'>('SELECT');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [result, setResult] = useState<AttendanceResponse | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [currentTime] = useState(new Date());

    // API Base URL - Use the same host that served this page
    // This ensures the API call goes to your Mac, not localhost on the phone
    const API_BASE = window.location.origin;

    // Get user location on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log('Location not available:', error);
                }
            );
        }
    }, []);

    // Validate token exists
    if (!token) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <FaTimesCircle size={60} color="#ef4444" />
                    <h2 style={{ color: '#ef4444', marginTop: '20px' }}>Invalid QR Code</h2>
                    <p style={{ color: '#64748b' }}>Please scan a valid employee QR code.</p>
                </div>
            </div>
        );
    }

    const handleStatusSelect = (status: string) => {
        setSelectedStatus(status);
        if (status === 'OD' || status === 'LEAVE') {
            setStep('REASON');
        } else {
            submitAttendance(status, '');
        }
    };

    const submitAttendance = async (status: string, workReason: string) => {
        setStep('SUBMITTING');
        
        try {
            const response = await fetch(`${API_BASE}/api/hr/attendance/mobile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    qr_token: token,
                    status: status,
                    work_assigned: workReason,
                    latitude: location?.lat,
                    longitude: location?.lng
                })
            });

            const data = await response.json();

            if (response.ok) {
                setResult(data);
                setStep('SUCCESS');
            } else {
                setResult({ error: data.error || 'Failed to mark attendance' });
                setStep('ERROR');
            }
        } catch (error) {
            console.error('Attendance error:', error);
            setResult({ error: 'Network error. Please try again.' });
            setStep('ERROR');
        }
    };

    const handleReasonSubmit = () => {
        if (!reason.trim() && selectedStatus !== 'PRESENT') {
            alert('Please enter a reason');
            return;
        }
        submitAttendance(selectedStatus, reason);
    };

    const resetForm = () => {
        setStep('SELECT');
        setSelectedStatus('');
        setReason('');
        setResult(null);
    };

    // Attendance Options
    const attendanceOptions = [
        { 
            id: 'PRESENT', 
            label: 'Present', 
            sublabel: 'Working from office',
            icon: <FaCheckCircle size={32} />, 
            color: '#22c55e',
            bgColor: '#dcfce7'
        },
        { 
            id: 'OD', 
            label: 'On Duty', 
            sublabel: 'Field work / Client visit',
            icon: <FaBriefcase size={32} />, 
            color: '#3b82f6',
            bgColor: '#dbeafe'
        },
        { 
            id: 'LEAVE', 
            label: 'Leave', 
            sublabel: 'Taking day off',
            icon: <FaUserClock size={32} />, 
            color: '#f59e0b',
            bgColor: '#fef3c7'
        },
    ];

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <h1 style={{ margin: 0, fontSize: '1.5rem' }}>📋 Attendance</h1>
                <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                    {currentTime.toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                    })}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: '1.2rem', fontWeight: 600 }}>
                    {currentTime.toLocaleTimeString('en-IN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}
                </p>
            </div>

            {/* Main Card */}
            <div style={cardStyle}>
                
                {/* Step 1: Select Status */}
                {step === 'SELECT' && (
                    <>
                        <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '24px' }}>
                            Mark Your Attendance
                        </h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {attendanceOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleStatusSelect(option.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        padding: '20px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '16px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '12px',
                                        background: option.bgColor,
                                        color: option.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {option.icon}
                                    </div>
                                    <div>
                                        <div style={{ 
                                            fontSize: '1.1rem', 
                                            fontWeight: 600, 
                                            color: '#1e293b' 
                                        }}>
                                            {option.label}
                                        </div>
                                        <div style={{ 
                                            fontSize: '0.85rem', 
                                            color: '#64748b',
                                            marginTop: '4px'
                                        }}>
                                            {option.sublabel}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {location && (
                            <div style={{ 
                                marginTop: '20px', 
                                padding: '12px', 
                                background: '#f0fdf4', 
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.85rem',
                                color: '#166534'
                            }}>
                                <FaMapMarkerAlt />
                                Location captured
                            </div>
                        )}
                    </>
                )}

                {/* Step 2: Enter Reason */}
                {step === 'REASON' && (
                    <>
                        <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '8px' }}>
                            {selectedStatus === 'OD' ? '📍 On Duty Details' : '📝 Leave Reason'}
                        </h2>
                        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '24px' }}>
                            {selectedStatus === 'OD' 
                                ? 'Where are you working from today?' 
                                : 'Please provide a reason for your leave'}
                        </p>

                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={selectedStatus === 'OD' 
                                ? 'e.g., Client meeting at XYZ Company, Trichy...' 
                                : 'e.g., Personal work, Medical appointment...'}
                            style={{
                                width: '100%',
                                padding: '16px',
                                border: '2px solid #e2e8f0',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                minHeight: '120px',
                                resize: 'none',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box'
                            }}
                            autoFocus
                        />

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button
                                onClick={() => setStep('SELECT')}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '12px',
                                    background: 'white',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Back
                            </button>
                            <button
                                onClick={handleReasonSubmit}
                                style={{
                                    flex: 2,
                                    padding: '14px',
                                    border: 'none',
                                    borderRadius: '12px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Submit
                            </button>
                        </div>
                    </>
                )}

                {/* Step 3: Submitting */}
                {step === 'SUBMITTING' && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <FaSpinner 
                            size={50} 
                            color="#3b82f6" 
                            style={{ animation: 'spin 1s linear infinite' }}
                        />
                        <p style={{ marginTop: '20px', color: '#64748b', fontSize: '1.1rem' }}>
                            Marking attendance...
                        </p>
                        <style>{`
                            @keyframes spin {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                )}

                {/* Step 4: Success */}
                {step === 'SUCCESS' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: '#dcfce7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <FaCheckCircle size={40} color="#22c55e" />
                        </div>
                        <h2 style={{ color: '#166534', marginBottom: '8px' }}>Success!</h2>
                        <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '8px' }}>
                            {result?.message || 'Attendance marked successfully'}
                        </p>
                        {result?.employee_name && (
                            <p style={{ 
                                color: '#1e293b', 
                                fontSize: '1.2rem', 
                                fontWeight: 600,
                                marginTop: '16px'
                            }}>
                                Welcome, {result.employee_name}!
                            </p>
                        )}
                        <p style={{ 
                            color: '#64748b', 
                            fontSize: '0.9rem',
                            marginTop: '8px'
                        }}>
                            {currentTime.toLocaleTimeString('en-IN')}
                        </p>

                        <button
                            onClick={resetForm}
                            style={{
                                marginTop: '24px',
                                padding: '12px 32px',
                                border: '2px solid #e2e8f0',
                                borderRadius: '12px',
                                background: 'white',
                                fontSize: '1rem',
                                cursor: 'pointer'
                            }}
                        >
                            Done
                        </button>
                    </div>
                )}

                {/* Step 5: Error */}
                {step === 'ERROR' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <FaTimesCircle size={40} color="#ef4444" />
                        </div>
                        <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>Error</h2>
                        <p style={{ color: '#64748b', fontSize: '1rem' }}>
                            {result?.error || 'Something went wrong'}
                        </p>

                        <button
                            onClick={resetForm}
                            style={{
                                marginTop: '24px',
                                padding: '12px 32px',
                                border: 'none',
                                borderRadius: '12px',
                                background: '#3b82f6',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <p style={{ 
                textAlign: 'center', 
                color: 'rgba(255,255,255,0.7)', 
                fontSize: '0.8rem',
                marginTop: '20px'
            }}>
                ERP Attendance System
            </p>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

const headerStyle: React.CSSProperties = {
    color: 'white',
    textAlign: 'center',
    marginBottom: '24px',
    paddingTop: '20px'
};

const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '24px',
    padding: '32px 24px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
};

export default MobileAttendance;