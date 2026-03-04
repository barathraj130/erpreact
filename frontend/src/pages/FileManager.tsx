import React, { useEffect, useState } from 'react';
import { FaBoxOpen, FaDownload, FaFileCsv, FaFilePdf, FaFolder, FaFolderOpen, FaRegFileAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom'; // ✅ Added
import { apiFetch } from '../utils/api';

interface DocFile {
    id: number;
    number: string;
    date: string;
    amount: number;
    party_name: string;
    file_url?: string;
    is_virtual?: boolean; // ✅ New flag
}

interface MonthFolder {
    month: string;
    tax_files: DocFile[];
    non_tax_files: DocFile[];
    total_count: number;
}

const FileManager: React.FC = () => {
    const navigate = useNavigate(); // ✅ Hook
    const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');
    const [folders, setFolders] = useState<MonthFolder[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
    const [subFolderView, setSubFolderView] = useState<'tax' | 'non_tax' | null>(null);

    const loadData = async () => {
        setLoading(true);
        setExpandedMonth(null);
        setSubFolderView(null);
        try {
            const res = await apiFetch(`/documents/${activeTab}`);
            const data = await res.json();
            setFolders(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const handleFolderClick = (month: string) => {
        if (expandedMonth === month) {
            setExpandedMonth(null);
            setSubFolderView(null);
        } else {
            setExpandedMonth(month);
            setSubFolderView(null);
        }
    };

    // Safe month parser
    const getMonthName = (yyyy_mm: string) => {
        if(!yyyy_mm || yyyy_mm === 'Unknown Date') return 'Unknown';
        const parts = yyyy_mm.split('-');
        if(parts.length < 2) return yyyy_mm;
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // Handle File Open
    const openFile = (file: DocFile) => {
        if (file.is_virtual) {
            // It's a system invoice, go to view page
            navigate(file.file_url!); 
        } else if (file.file_url) {
            // It's an uploaded file (e.g. Purchase Bill PDF), open in new tab
            window.open(`http://localhost:3001${file.file_url}`, '_blank');
        }
    };

    const renderFileList = (files: DocFile[], typeLabel: string) => (
        <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaFolderOpen style={{ color: 'var(--primary)' }} /> {typeLabel} 
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}> • {files.length} Documents</span>
                </h4>
            </div>
            
            <div className="glass" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflowX: 'auto', background: 'rgba(255,255,255,0.7)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '700px' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document</th>
                            <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Party Name</th>
                            <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ textAlign: 'right', padding: '16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                            <th style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <FaBoxOpen size={30} style={{ opacity: 0.2, marginBottom: '10px' }} /><br/>
                                No files identified in this category.
                            </td></tr>
                        ) : files.map(file => (
                            <tr key={file.id} className="page-transition" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                                <td style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
                                            <FaFilePdf style={{ color: '#ef4444', fontSize: '1rem' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{file.number}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PDF Document</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '16px', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem' }}>{file.party_name}</td>
                                <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(file.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>₹{Number(file.amount).toLocaleString()}</td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <button 
                                        onClick={() => openFile(file)}
                                        className="btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const isMobile = window.innerWidth <= 768;

    return (
        <div>
            {/* HEADER */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', margin: 0 }}>Document <span style={{color: 'var(--primary)'}}>Manager</span></h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>Enterprise-grade filing & compliance repository.</p>
                </div>
                <div style={{ display: 'flex', background: '#e2e8f0', padding: '5px', borderRadius: '12px', minWidth: isMobile ? '100%' : '300px' }}>
                    <button 
                        onClick={() => setActiveTab('sales')}
                        style={{ 
                            flex: 1,
                            padding: isMobile ? '10px 12px' : '8px 20px', 
                            borderRadius: '6px', 
                            border: 'none', 
                            background: activeTab === 'sales' ? 'white' : 'transparent', 
                            color: activeTab === 'sales' ? '#2563eb' : '#64748b', 
                            fontWeight: 600, 
                            fontSize: isMobile ? '0.85rem' : '0.9rem',
                            boxShadow: activeTab === 'sales' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', 
                            cursor: 'pointer', 
                            transition: 'all 0.2s'
                        }}>
                        {isMobile ? 'Sales' : 'Sales (Outwards)'}
                    </button>
                    <button 
                        onClick={() => setActiveTab('purchases')}
                        style={{ 
                            flex: 1,
                            padding: isMobile ? '10px 12px' : '8px 20px', 
                            borderRadius: '6px', 
                            border: 'none', 
                            background: activeTab === 'purchases' ? 'white' : 'transparent', 
                            color: activeTab === 'purchases' ? '#2563eb' : '#64748b', 
                            fontWeight: 600, 
                            fontSize: isMobile ? '0.85rem' : '0.9rem',
                            boxShadow: activeTab === 'purchases' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', 
                            cursor: 'pointer', 
                            transition: 'all 0.2s'
                        }}>
                        {isMobile ? 'Purchases' : 'Purchases (Inwards)'}
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Scanning documents...</div>
            ) : folders.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <FaBoxOpen size={40} color="#cbd5e1" />
                    <p style={{ marginTop: '10px', color: '#64748b' }}>No documents found for this category.</p>
                    <button onClick={() => navigate(activeTab === 'sales' ? '/invoices/new' : '/bills')} style={{ marginTop: '15px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        + Create New {activeTab === 'sales' ? 'Invoice' : 'Bill'}
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                    
                    {/* LEFT: MONTH FOLDERS GRID */}
                    <div style={{ 
                        flex: isMobile ? '1' : '1 1 300px', 
                        width: isMobile ? '100%' : 'auto',
                        display: 'grid', 
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', 
                        gap: isMobile ? '10px' : '15px' 
                    }}>
                        {folders.map(folder => {
                            const isExpanded = expandedMonth === folder.month;
                            return (
                                <div 
                                    key={folder.month}
                                    onClick={() => handleFolderClick(folder.month)}
                                    className="card"
                                    style={{ 
                                        padding: isMobile ? '16px' : '20px', 
                                        cursor: 'pointer', 
                                        border: isExpanded ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                        background: isExpanded ? '#eff6ff' : 'white',
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: isMobile ? 'row' : 'column',
                                        alignItems: isMobile ? 'center' : 'flex-start',
                                        gap: isMobile ? '12px' : '0'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '0' : '10px', flex: isMobile ? '0 0 auto' : '1' }}>
                                        {isExpanded ? <FaFolderOpen size={isMobile ? 24 : 32} color="#3b82f6" /> : <FaFolder size={isMobile ? 24 : 32} color="#f59e0b" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                            {getMonthName(folder.month)}
                                        </h3>
                                        {!isMobile && <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{folder.month}</p>}
                                    </div>
                                    <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '4px 8px', borderRadius: '10px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{folder.total_count} files</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* RIGHT: SUB-FOLDERS / FILES (Shows when a month is clicked) */}
                    {expandedMonth && (
                        <div className="card" style={{ 
                            flex: isMobile ? '1' : '2 1 400px', 
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 'auto' : '400px', 
                            animation: 'slideInRight 0.3s' 
                        }}>
                            <div style={{ 
                                paddingBottom: '15px', 
                                borderBottom: '1px solid #e2e8f0', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '12px'
                            }}>
                                <h3 style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', color: 'var(--text-main)', flex: '1 1 auto', margin: 0, fontWeight: 800 }}>
                                    {getMonthName(expandedMonth)}
                                </h3>
                                {!isMobile && (
                                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.8rem' }}>
                                        <FaDownload /> Bulk Export
                                    </button>
                                )}
                            </div>

                            {/* SUB FOLDERS: TAX vs NON-TAX */}
                            {!subFolderView ? (
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', 
                                    gap: isMobile ? '12px' : '20px', 
                                    marginTop: isMobile ? '20px' : '30px' 
                                }}>
                                    {/* TAX FOLDER */}
                                    <div 
                                        onClick={() => setSubFolderView('tax')}
                                        style={{ background: '#f8fafc', padding: isMobile ? '20px' : '25px', borderRadius: '12px', border: '1px dashed #cbd5e1', cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                                        onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                                    >
                                        <FaRegFileAlt size={40} color="#22c55e" style={{marginBottom: '10px'}} />
                                        <h4 style={{ color: '#334155', marginBottom: '5px' }}>Tax Invoices</h4>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>GST Ready Files ({folders.find(f => f.month === expandedMonth)?.tax_files.length || 0})</p>
                                    </div>

                                    {/* NON-TAX FOLDER */}
                                    <div 
                                        onClick={() => setSubFolderView('non_tax')}
                                        style={{ background: '#f8fafc', padding: isMobile ? '20px' : '25px', borderRadius: '12px', border: '1px dashed #cbd5e1', cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                                        onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                                    >
                                        <FaFileCsv size={40} color="#64748b" style={{marginBottom: '10px'}} />
                                        <h4 style={{ color: '#334155', marginBottom: '5px' }}>Non-Tax / Others</h4>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Bill of Supply, Receipts ({folders.find(f => f.month === expandedMonth)?.non_tax_files.length || 0})</p>
                                    </div>
                                </div>
                            ) : (
                                /* FILE LIST VIEW */
                                <div>
                                    <button 
                                        onClick={() => setSubFolderView(null)}
                                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginTop: '15px', fontWeight: 500 }}
                                    >
                                        ← Back to Folders
                                    </button>
                                    {renderFileList(
                                        subFolderView === 'tax' 
                                            ? folders.find(f => f.month === expandedMonth)?.tax_files || []
                                            : folders.find(f => f.month === expandedMonth)?.non_tax_files || [],
                                        subFolderView === 'tax' ? 'Tax Invoices (GST)' : 'Non-Tax Documents'
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FileManager;