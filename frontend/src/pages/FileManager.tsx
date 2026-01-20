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
            window.open(`http://localhost:3000${file.file_url}`, '_blank');
        }
    };

    const renderFileList = (files: DocFile[], typeLabel: string) => (
        <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaFolderOpen /> / {getMonthName(expandedMonth!)} / <span style={{color: '#1e293b', fontWeight: 600}}>{typeLabel}</span>
            </h4>
            
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569', width: '50px' }}>Type</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569' }}>Doc Number</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569' }}>Party Name</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569' }}>Date</th>
                            <th style={{ textAlign: 'right', padding: '12px 16px', color: '#475569' }}>Amount</th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', color: '#475569' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No files in this folder.</td></tr>
                        ) : files.map(file => (
                            <tr key={file.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                    <FaFilePdf style={{ color: '#ef4444', fontSize: '1.1rem' }} />
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{file.number}</td>
                                <td style={{ padding: '12px 16px', color: '#334155' }}>{file.party_name}</td>
                                <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(file.date).toLocaleDateString()}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>₹{Number(file.amount).toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                    <button 
                                        onClick={() => openFile(file)}
                                        style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>
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

    return (
        <div>
            {/* HEADER */}
            <div className="flex-between" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Document Manager</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Organized GST filing repository for Invoices and Bills.</p>
                </div>
                <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
                    <button 
                        onClick={() => setActiveTab('sales')}
                        style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: activeTab === 'sales' ? 'white' : 'transparent', color: activeTab === 'sales' ? '#2563eb' : '#64748b', fontWeight: 600, boxShadow: activeTab === 'sales' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Sales (Outwards)
                    </button>
                    <button 
                        onClick={() => setActiveTab('purchases')}
                        style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: activeTab === 'purchases' ? 'white' : 'transparent', color: activeTab === 'purchases' ? '#2563eb' : '#64748b', fontWeight: 600, boxShadow: activeTab === 'purchases' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Purchases (Inwards)
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
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    
                    {/* LEFT: MONTH FOLDERS GRID */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                        {folders.map(folder => {
                            const isExpanded = expandedMonth === folder.month;
                            return (
                                <div 
                                    key={folder.month}
                                    onClick={() => handleFolderClick(folder.month)}
                                    className="card"
                                    style={{ 
                                        padding: '20px', cursor: 'pointer', 
                                        border: isExpanded ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                        background: isExpanded ? '#eff6ff' : 'white',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        {isExpanded ? <FaFolderOpen size={32} color="#3b82f6" /> : <FaFolder size={32} color="#f59e0b" />}
                                        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', color: '#64748b', fontWeight: 600 }}>{folder.total_count} files</span>
                                    </div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                        {getMonthName(folder.month)}
                                    </h3>
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{folder.month}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* RIGHT: SUB-FOLDERS / FILES (Shows when a month is clicked) */}
                    {expandedMonth && (
                        <div className="card" style={{ flex: 2, minHeight: '400px', animation: 'slideInRight 0.3s' }}>
                            <div style={{ paddingBottom: '15px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', color: '#1e293b' }}>{getMonthName(expandedMonth)} - Files</h3>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #e2e8f0', background: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <FaDownload /> Download Zip
                                </button>
                            </div>

                            {/* SUB FOLDERS: TAX vs NON-TAX */}
                            {!subFolderView ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
                                    {/* TAX FOLDER */}
                                    <div 
                                        onClick={() => setSubFolderView('tax')}
                                        style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px dashed #cbd5e1', cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s' }}
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
                                        style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px dashed #cbd5e1', cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s' }}
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