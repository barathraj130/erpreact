// frontend/src/pages/hr/EmployeeQRModal.tsx
// UPDATED: QR Code now contains a URL that employees can scan to mark attendance

import React from 'react';
import { FaMobileAlt, FaPrint, FaTimes } from 'react-icons/fa';
import QRCode from 'react-qr-code';

interface Employee {
    id: number;
    name: string;
    designation?: string;
    status?: string;
}

interface Props {
    employee: Employee;
    onClose: () => void;
}

const EmployeeQRModal: React.FC<Props> = ({ employee, onClose }) => {
    // Generate the attendance URL that will be encoded in QR
    // When scanned, this opens the mobile attendance page
    
    // Use your Mac's IP address (found via: ipconfig getifaddr en0)
    const baseUrl = 'http://192.168.29.33:5173';
    
    const qrToken = `EMP_${employee.id}_SECRET`;
    const attendanceUrl = `${baseUrl}/mark-attendance?token=${qrToken}`;

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=400,height=700');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee ID Card - ${employee.name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 20px;
                        display: flex;
                        justify-content: center;
                    }
                    .card {
                        width: 300px;
                        border: 2px solid #e2e8f0;
                        border-radius: 16px;
                        overflow: hidden;
                        background: white;
                    }
                    .header {
                        background: linear-gradient(135deg, #1e3a8a, #3b82f6);
                        color: white;
                        padding: 20px;
                        text-align: center;
                    }
                    .header h1 {
                        font-size: 14px;
                        font-weight: 600;
                        letter-spacing: 1px;
                    }
                    .body {
                        padding: 24px;
                        text-align: center;
                    }
                    .name {
                        font-size: 20px;
                        font-weight: 700;
                        color: #1e293b;
                        margin-bottom: 4px;
                    }
                    .designation {
                        font-size: 14px;
                        color: #64748b;
                        margin-bottom: 20px;
                    }
                    .qr-container {
                        background: #f8fafc;
                        padding: 16px;
                        border-radius: 12px;
                        display: inline-block;
                        margin-bottom: 16px;
                    }
                    .footer {
                        font-size: 11px;
                        color: #94a3b8;
                        padding: 12px;
                        border-top: 1px solid #e2e8f0;
                        text-align: center;
                    }
                    .scan-text {
                        font-size: 12px;
                        color: #64748b;
                        margin-top: 12px;
                    }
                    @media print {
                        body { padding: 0; }
                        .card { border: 1px solid #ccc; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h1>🏢 ERP SYSTEM</h1>
                    </div>
                    <div class="body">
                        <div class="name">${employee.name}</div>
                        <div class="designation">${employee.designation || 'Employee'}</div>
                        <div class="qr-container">
                            ${document.getElementById('qr-code-container')?.innerHTML || ''}
                        </div>
                        <div class="scan-text">
                            📱 Scan to mark attendance
                        </div>
                    </div>
                    <div class="footer">
                        ID: ${employee.id} | Status: ${employee.status || 'Active'}
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        // Wait for QR to render then print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(attendanceUrl);
        alert('Attendance link copied! Share with employee.');
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
        }}>
            <div style={{
                background: 'white',
                padding: '30px',
                borderRadius: '16px',
                textAlign: 'center',
                width: '380px',
                position: 'relative',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        border: 'none',
                        background: '#f1f5f9',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        color: '#64748b'
                    }}
                >
                    <FaTimes />
                </button>
                
                {/* Employee Info */}
                <h3 style={{ 
                    margin: '0 0 4px 0', 
                    color: '#1e293b',
                    fontSize: '1.3rem'
                }}>
                    {employee.name}
                </h3>
                <p style={{ 
                    margin: '0 0 20px 0', 
                    color: '#64748b', 
                    fontSize: '0.95rem' 
                }}>
                    {employee.designation || 'Employee'}
                </p>

                {/* QR Code */}
                <div style={{
                    background: '#f8fafc',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'inline-block'
                }}>
                    <div id="qr-code-container">
                        <QRCode 
                            value={attendanceUrl} 
                            size={180}
                            level="M"
                        />
                    </div>
                </div>

                {/* Instructions */}
                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#eff6ff',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}>
                    <FaMobileAlt color="#3b82f6" />
                    <span style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                        Scan with phone to mark attendance
                    </span>
                </div>

                {/* ID Info */}
                <div style={{
                    marginTop: '12px',
                    fontSize: '0.8rem',
                    color: '#94a3b8'
                }}>
                    ID: {employee.id} | Status: {employee.status || 'Active'}
                </div>

                {/* Action Buttons */}
                <div style={{
                    marginTop: '20px',
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center'
                }}>
                    <button 
                        onClick={copyLink}
                        style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: 'none',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '0.9rem'
                        }}
                    >
                        📋 Copy Link
                    </button>
                    <button 
                        onClick={handlePrint} 
                        style={{
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        <FaPrint /> Print ID Card
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeQRModal;