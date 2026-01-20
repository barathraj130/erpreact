import React, { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaClock, FaQrcode, FaSave } from 'react-icons/fa';
import { apiFetch } from '../../utils/api';

const AttendanceScanner: React.FC = () => {
    const [scanResult, setScanResult] = useState('');
    
    // UI States
    const [step, setStep] = useState<'SCAN' | 'DETAILS' | 'RESULT'>('SCAN');
    const [statusType, setStatusType] = useState('PRESENT');
    const [workAssigned, setWorkAssigned] = useState('');
    
    // Result States
    const [resultMessage, setResultMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Keep focus on input for scanner
    useEffect(() => {
        if (step === 'SCAN') {
            inputRef.current?.focus();
            const interval = setInterval(() => inputRef.current?.focus(), 2000);
            return () => clearInterval(interval);
        }
    }, [step]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (scanResult) {
            // Move to Details Step
            setStep('DETAILS');
        }
    };

    const handleSubmitAttendance = async () => {
        try {
            const res = await apiFetch('/hr/attendance/scan', {
                method: 'POST',
                body: { 
                    qr_token: scanResult,
                    status: statusType,
                    work_assigned: workAssigned
                }
            });
            const data = await res.json();

            if (res.ok) {
                setIsError(false);
                setResultMessage(data.message);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            setIsError(true);
            setResultMessage(err.message || 'Invalid QR Code');
        }

        setStep('RESULT');

        // Reset after 3 seconds
        setTimeout(() => {
            setScanResult('');
            setWorkAssigned('');
            setStatusType('PRESENT');
            setStep('SCAN');
        }, 3000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
            
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>Attendance Kiosk</h1>
                <p style={{ color: '#64748b' }}>
                    {step === 'SCAN' ? 'Please scan your employee ID card.' : 'Enter work details.'}
                </p>
            </div>

            <div style={{ 
                width: '100%', maxWidth: '500px', background: 'white', padding: '40px', borderRadius: '20px', 
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', textAlign: 'center', border: '1px solid #e2e8f0' 
            }}>
                
                {/* STEP 1: SCANNING */}
                {step === 'SCAN' && (
                    <div style={{ animation: 'pulse 2s infinite' }}>
                        <FaQrcode size={100} color="#cbd5e1" />
                        <p style={{ marginTop: '20px', fontWeight: 500, color: '#94a3b8' }}>Waiting for scan...</p>
                        
                        {/* Hidden Input for Scanner */}
                        <form onSubmit={handleScan} style={{ marginTop: '30px' }}>
                            <input 
                                ref={inputRef}
                                value={scanResult}
                                onChange={e => setScanResult(e.target.value)}
                                placeholder="Click here & scan..."
                                style={{ 
                                    width: '80%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', 
                                    textAlign: 'center', fontSize: '1.2rem', outline: 'none' 
                                }}
                                autoFocus
                            />
                        </form>
                    </div>
                )}

                {/* STEP 2: DETAILS INPUT */}
                {step === 'DETAILS' && (
                    <div style={{textAlign: 'left'}}>
                        <h3 style={{marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Entry Details</h3>
                        
                        <div style={{marginBottom: '15px'}}>
                            <label style={{display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '5px'}}>Status</label>
                            <select 
                                value={statusType} 
                                onChange={e => setStatusType(e.target.value)} 
                                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                            >
                                <option value="PRESENT">Present (In Office)</option>
                                <option value="OD">On Duty (OD) / Field Work</option>
                                <option value="LEAVE">Leave</option>
                            </select>
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '5px'}}>Work Assigned / Notes</label>
                            <textarea 
                                value={workAssigned} 
                                onChange={e => setWorkAssigned(e.target.value)} 
                                rows={3}
                                placeholder="E.g. Site visit to Trichy..."
                                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none'}}
                            />
                        </div>

                        <button 
                            onClick={handleSubmitAttendance}
                            style={{
                                width: '100%', padding: '12px', background: '#2563eb', color: 'white', 
                                border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                            }}
                        >
                            <FaSave /> Confirm Attendance
                        </button>
                    </div>
                )}

                {/* STEP 3: RESULT */}
                {step === 'RESULT' && (
                    <div>
                        {isError ? (
                            <div style={{ color: '#dc2626' }}>
                                <FaClock size={100} />
                                <h2 style={{ marginTop: '20px', fontSize: '1.5rem' }}>Error</h2>
                                <p>{resultMessage}</p>
                            </div>
                        ) : (
                            <div style={{ color: '#16a34a' }}>
                                <FaCheckCircle size={100} />
                                <h2 style={{ marginTop: '20px', fontSize: '1.5rem' }}>Success!</h2>
                                <p>{resultMessage}</p>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <div style={{ marginTop: '30px', fontSize: '0.9rem', color: '#94a3b8' }}>
                System Ready • {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};

export default AttendanceScanner;