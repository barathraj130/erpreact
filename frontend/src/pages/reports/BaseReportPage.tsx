import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        branchId: 'all',
        searchTerm: '',
        taxType: 'all'
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams(filters).toString();
            const res = await apiFetch(`${endpoint}?${query}`);
            const json = await res.json();
            setData(Array.isArray(json) ? json : []);
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
        <div className="report-page-container">
            {/* Nav */}
            <div className="report-breadcrumb">
                <Link to="/reports" className="back-link"><FaArrowLeft /> Back to Dashboard</Link>
            </div>

            {/* Header */}
            <div className="report-header-section">
                <div className="header-info">
                    <h1>{title}</h1>
                    <p className="no-print">System generated report for the selected period.</p>
                </div>
                <div className="header-actions no-print">
                    <button className="export-btn pdf" onClick={() => alert('PDF Export Coming Soon')} title="Export PDF">
                        <FaFilePdf /> PDF
                    </button>
                    <button className="export-btn excel" onClick={() => alert('Excel Export Coming Soon')} title="Export Excel">
                        <FaFileExcel /> Excel
                    </button>
                    <button className="print-btn" onClick={handlePrint}>
                        <FaPrint /> Print
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="report-toolbar no-print">
                <div className="filter-group">
                    <div className="input-with-icon">
                        <label>From</label>
                        <input 
                            type="date" 
                            value={filters.startDate} 
                            onChange={(e) => setFilters({...filters, startDate: e.target.value})} 
                        />
                    </div>
                    <div className="input-with-icon">
                        <label>To</label>
                        <input 
                            type="date" 
                            value={filters.endDate} 
                            onChange={(e) => setFilters({...filters, endDate: e.target.value})} 
                        />
                    </div>
                    {showBranchFilter && (
                        <div className="input-with-icon">
                            <label>Branch</label>
                            <select value={filters.branchId} onChange={(e) => setFilters({...filters, branchId: e.target.value})}>
                                <option value="all">All Branches</option>
                                <option value="1">Main Office</option>
                                <option value="2">Warehouse A</option>
                            </select>
                        </div>
                    )}
                    {showTaxFilter && (
                        <div className="input-with-icon">
                            <label>Tax Type</label>
                            <select value={filters.taxType} onChange={(e) => setFilters({...filters, taxType: e.target.value})}>
                                <option value="all">Both</option>
                                <option value="TAX">Tax Invoice</option>
                                <option value="NON-TAX">Retail Bill</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="search-group">
                    <div className="search-box">
                        <FaSearch className="search-icon" />
                        <input 
                            placeholder="Search in results..." 
                            value={filters.searchTerm}
                            onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                        />
                    </div>
                    <button className="refresh-btn" onClick={fetchData}><FaFilter /> Apply</button>
                </div>
            </div>

            {/* Table */}
            <div className="report-table-wrapper">
                {loading ? (
                    <div className="report-loading">
                        <div className="skeleton-table"></div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="report-empty">
                        <p>No records found for the selected filters.</p>
                    </div>
                ) : (
                    <table className="report-table">
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
                                        <td key={colIdx} style={{ textAlign: col.align || 'left' }}>
                                            {col.type === 'amount' 
                                                ? `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(row[col.key] || 0)}`
                                                : row[col.key] || '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {/* Totals Row */}
                            <tr className="totals-row">
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} style={{ textAlign: col.align || 'left' }}>
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

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .no-print, .db-sidebar, .db-topbar, .report-breadcrumb { display: none !important; }
                    .report-page-container { padding: 0; background: white; }
                    .report-table { font-size: 10pt; }
                    .report-table th, .report-table td { padding: 8px; border: 1px solid #eee; }
                    .totals-row { background: #eee !important; -webkit-print-color-adjust: exact; }
                }
            `}} />
        </div>
    );
};

export default BaseReportPage;
