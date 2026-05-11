import React, { useState, useEffect } from "react";
import { FaDownload, FaPrint, FaSearch, FaFilter, FaArrowLeft, FaFilePdf, FaFileExcel } from "react-icons/fa";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import "./Reports.css";

interface BaseReportProps {
    title: string;
    reportId: string;
    columns: { header: string; key: string; type?: 'amount' | 'text' | 'date' | 'status'; align?: 'left' | 'center' | 'right' }[];
    endpoint: string;
    showBranchFilter?: boolean;
    showTaxFilter?: boolean;
}

const BaseReportPage: React.FC<BaseReportProps> = ({ 
    title, 
    reportId, 
    columns, 
    endpoint, 
    showBranchFilter = true,
    showTaxFilter = false
}) => {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoExpandedMsg, setAutoExpandedMsg] = useState("");
    const [filters, setFilters] = useState({
        startDate: defaultFrom.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        branchId: 'all',
        searchTerm: '',
        taxType: 'all'
    });

    const fetchData = async (currentFilters = filters, isRetry = false) => {
        setLoading(true);
        if (!isRetry) setAutoExpandedMsg("");
        try {
            const query = new URLSearchParams(currentFilters as any).toString();
            const res = await apiFetch(`${endpoint}?${query}`);
            const json = await res.json();
            const resultData = Array.isArray(json) ? json : [];

            if (resultData.length === 0 && !isRetry) {
                const expandedDate = new Date();
                expandedDate.setDate(expandedDate.getDate() - 90);
                const newFilters = { ...currentFilters, startDate: expandedDate.toISOString().split('T')[0] };
                setFilters(newFilters);
                setAutoExpandedMsg("No data for selected period. Showing last 90 days.");
                // Fetch again with expanded dates
                const retryQuery = new URLSearchParams(newFilters as any).toString();
                const retryRes = await apiFetch(`${endpoint}?${retryQuery}`);
                const retryJson = await retryRes.json();
                setData(Array.isArray(retryJson) ? retryJson : []);
            } else {
                setData(resultData);
            }
        } catch (err) {
            console.error("Failed to fetch report data:", err);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters.startDate, filters.endDate, filters.branchId, filters.taxType]);

    const handlePrint = () => window.print();

    const calculateTotal = (key: string) => {
        return data.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
    };

    return (
        <div className="db-page">
            {/* Topbar */}
            <header className="db-topbar no-print">
                <div className="db-topbar-left">
                    <span className="db-topbar-title">Reports</span>
                    <span className="db-topbar-sep">/</span>
                    <span className="db-topbar-sub">{title}</span>
                </div>
                <div className="db-topbar-right">
                    <Link to="/reports" className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                        <FaArrowLeft style={{ marginRight: '6px' }} /> Back to Dashboard
                    </Link>
                </div>
            </header>

            <div className="db-content" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 0' }}>
                {/* Hero Header */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                    borderRadius: '16px', 
                    padding: '32px 40px', 
                    marginBottom: '24px',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)'
                }}>
                    <div>
                        <div style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.2)', padding: '6px 12px', borderRadius: '100px', color: '#60a5fa', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '12px' }}>
                            ANALYTICS REPORT
                        </div>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', color: 'white', letterSpacing: '-0.5px' }}>{title}</h1>
                        <p className="no-print" style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>System generated data insight for the selected period.</p>
                    </div>
                    <div className="header-actions no-print" style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => alert('PDF Export Coming Soon')} title="Export PDF" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                            <FaFilePdf size={16} /> PDF
                        </button>
                        <button onClick={() => alert('Excel Export Coming Soon')} title="Export Excel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'rgba(34, 197, 94, 0.15)', color: '#86efac', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                            <FaFileExcel size={16} /> Excel
                        </button>
                        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)', transition: 'all 0.2s' }}>
                            <FaPrint size={16} /> Print
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="enterprise-card no-print" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'nowrap', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 auto' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</label>
                        <input 
                            type="date" 
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc', color: '#1e293b', outline: 'none' }}
                            value={filters.startDate} 
                            onChange={(e) => setFilters({...filters, startDate: e.target.value})} 
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 auto' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</label>
                        <input 
                            type="date" 
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc', color: '#1e293b', outline: 'none' }}
                            value={filters.endDate} 
                            onChange={(e) => setFilters({...filters, endDate: e.target.value})} 
                        />
                    </div>
                    {showBranchFilter && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minWidth: '130px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch Location</label>
                            <select 
                                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc', color: '#1e293b', outline: 'none', width: '100%' }}
                                value={filters.branchId} onChange={(e) => setFilters({...filters, branchId: e.target.value})}
                            >
                                <option value="all">All Branches</option>
                                <option value="1">Main Office</option>
                                <option value="2">Warehouse A</option>
                            </select>
                        </div>
                    )}
                    {showTaxFilter && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minWidth: '130px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tax Type</label>
                            <select 
                                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc', color: '#1e293b', outline: 'none', width: '100%' }}
                                value={filters.taxType} onChange={(e) => setFilters({...filters, taxType: e.target.value})}
                            >
                                <option value="all">Both</option>
                                <option value="TAX">Tax Invoice</option>
                                <option value="NON-TAX">Retail Bill</option>
                            </select>
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '2 1 auto', minWidth: '180px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search</label>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                                style={{ padding: '10px 14px 10px 36px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', width: '100%', background: '#f8fafc', color: '#1e293b', outline: 'none' }}
                                placeholder="Search in records..." 
                                value={filters.searchTerm}
                                onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                            />
                        </div>
                    </div>
                    <div style={{ flex: '0 0 auto' }}>
                        <button style={{ padding: '10px 20px', borderRadius: '8px', background: '#1e293b', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', height: '40px' }} onClick={() => fetchData()}>
                            <FaFilter size={14} /> Apply
                        </button>
                    </div>
                </div>

                {/* Messages & Record Count */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        {autoExpandedMsg && (
                            <div style={{ padding: '8px 12px', background: '#fef3c7', color: '#b45309', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                ⚠️ {autoExpandedMsg}
                            </div>
                        )}
                        {!loading && data.length > 0 && (
                            <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
                                Showing <strong style={{ color: '#1e293b' }}>{data.length}</strong> records for selected period
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="enterprise-table-wrapper">
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
                            <div className="spinner-innovative" style={{ margin: '0 auto 16px auto' }}></div>
                            Generating Report Data...
                        </div>
                    ) : data.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
                            <FaSearch size={32} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <p>No records found for the selected filters.</p>
                        </div>
                    ) : (
                        <table className="enterprise-table">
                            <thead>
                                <tr>
                                    {columns.map((col, idx) => (
                                        <th key={idx} style={{ textAlign: col.align || 'left' }}>{col.header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.filter(row => {
                                    if (!filters.searchTerm) return true;
                                    return Object.values(row).some(val => 
                                        String(val).toLowerCase().includes(filters.searchTerm.toLowerCase())
                                    );
                                }).map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx} style={{ textAlign: col.align || 'left', fontWeight: col.type === 'amount' ? 600 : 400, color: col.type === 'amount' ? 'var(--text-1)' : 'var(--text-2)' }}>
                                                {col.type === 'amount' 
                                                    ? `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(row[col.key] || 0)}`
                                                    : row[col.key] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {/* Totals Row */}
                                <tr style={{ background: '#eff6ff' }}>
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} style={{ textAlign: col.align || 'left', fontWeight: 800, color: '#1d4ed8', fontSize: '14px', borderTop: '2px solid #bfdbfe' }}>
                                            {colIdx === 0 ? 'TOTALS' : (
                                                col.type === 'amount' 
                                                ? `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(calculateTotal(col.key))}`
                                                : ''
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .no-print, .db-sidebar, .db-topbar, .report-breadcrumb { display: none !important; }
                    .db-page { background: white; padding: 0; margin: 0; }
                    .db-content { padding: 0 !important; max-width: 100% !important; }
                    .enterprise-table { font-size: 10pt; width: 100%; border-collapse: collapse; }
                    .enterprise-table th, .enterprise-table td { padding: 8px; border: 1px solid #ccc; }
                    .enterprise-table-wrapper { border: none; box-shadow: none; }
                }
            `}} />
        </div>
    );
};

export default BaseReportPage;
