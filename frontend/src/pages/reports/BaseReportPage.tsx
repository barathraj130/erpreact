import React, { useState, useEffect } from "react";
import { FaDownload, FaPrint, FaSearch, FaFilter, FaArrowLeft, FaFilePdf, FaFileExcel, FaChartLine, FaChartPie, FaChartBar } from "react-icons/fa";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar 
} from 'recharts';
import "./Reports.css";

interface BaseReportProps {
    title: string;
    reportId: string;
    columns: { header: string; key: string; type?: 'amount' | 'text' | 'date' | 'status'; align?: 'left' | 'center' | 'right' }[];
    endpoint: string;
    showBranchFilter?: boolean;
    showTaxFilter?: boolean;
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9'];

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

    const getChartData = () => {
        if (!data.length) return { trend: [], pie: [] };

        // ── Hardcoded specifics for known reports ──
        if (reportId === 'sales-register') {
            const grouped = data.reduce((acc: any, item) => {
                const d = item.invoice_date ? new Date(item.invoice_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : 'N/A';
                acc[d] = (acc[d] || 0) + parseFloat(item.total_amount || 0);
                return acc;
            }, {});
            const trend = Object.entries(grouped).map(([name, value]) => ({ name, value })).slice(-12);
            const pie = data.slice(0, 6).map(item => ({ name: String(item.customer_name || item.invoice_number || '').slice(0, 14), value: parseFloat(item.total_amount || 0) }));
            return { trend, pie };
        }

        // ── Generic auto-detection ──
        // 1. Find a date column for trend grouping
        const dateCol = columns.find(c => c.type === 'date' || c.key.includes('date') || c.key.includes('Date'));
        // 2. Find the primary amount/value column
        const amountCol = columns.find(c => c.type === 'amount');
        // 3. Find the best label column (first non-amount, non-date text column)
        const labelCol = columns.find(c => c !== dateCol && c !== amountCol && c.type !== 'amount' && c.type !== 'date');

        const amountKey = amountCol?.key;
        const labelKey  = labelCol?.key  || columns[0]?.key;
        const dateKey   = dateCol?.key;

        if (!amountKey) {
            // No amount column — just count records per label
            const grouped = data.slice(0, 10).reduce((acc: any, item) => {
                const k = String(item[labelKey] || 'Other').slice(0, 16);
                acc[k] = (acc[k] || 0) + 1;
                return acc;
            }, {});
            const pie = Object.entries(grouped).map(([name, value]) => ({ name, value }));
            return { trend: pie, pie };
        }

        // Trend: group by date if date col exists, otherwise top items
        let trend: any[] = [];
        if (dateKey) {
            const grouped = data.reduce((acc: any, item) => {
                const raw = item[dateKey];
                const d = raw ? new Date(raw).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A';
                acc[d] = (acc[d] || 0) + parseFloat(item[amountKey] || 0);
                return acc;
            }, {});
            trend = Object.entries(grouped)
                .map(([name, value]) => ({ name, value }))
                .slice(-12);
        } else {
            trend = data.slice(0, 12).map(item => ({
                name: String(item[labelKey] || '').slice(0, 14),
                value: parseFloat(item[amountKey] || 0),
            }));
        }

        // Pie: top 6 by amount
        const pie = [...data]
            .sort((a, b) => parseFloat(b[amountKey] || 0) - parseFloat(a[amountKey] || 0))
            .slice(0, 6)
            .map(item => ({
                name: String(item[labelKey] || item[dateKey] || '').slice(0, 16),
                value: parseFloat(item[amountKey] || 0),
            }))
            .filter(d => d.value > 0);

        return { trend, pie };
    };

    const { trend: trendData, pie: pieData } = getChartData();

    return (
        <div className="db-page">
            <header className="db-topbar no-print">
                <div className="db-topbar-left">
                    <span className="db-topbar-title">Finance Intel</span>
                    <span className="db-topbar-sep">/</span>
                    <span className="db-topbar-sub">{title}</span>
                </div>
                <div className="db-topbar-right">
                    <Link to="/reports" className="db-btn" style={{ textDecoration: 'none' }}>
                        <FaArrowLeft /> Back
                    </Link>
                </div>
            </header>

            <div className="db-content" style={{ padding: '24px' }}>
                {/* Visual Analytics Header */}
                <div className="report-hero-card">
                    <div className="report-hero-content">
                        <div className="report-tag">ANALYTICAL MODULE</div>
                        <h1 className="report-title">{title}</h1>
                        <p className="report-desc">Intelligent data breakdown for business decision making.</p>
                    </div>
                    <div className="report-hero-stats">
                        <div className="hero-stat-item">
                            <span className="hero-stat-label">Total Volume</span>
                            <span className="hero-stat-value">₹{(() => {
                                const amountKey = columns.find(c => c.type === 'amount')?.key;
                                return amountKey ? calculateTotal(amountKey).toLocaleString('en-IN') :
                                    (calculateTotal('total_amount') || calculateTotal('total_sales') || calculateTotal('revenue') || calculateTotal('amount') || calculateTotal('value')).toLocaleString('en-IN');
                            })()}</span>
                        </div>
                        <div className="hero-stat-item">
                            <span className="hero-stat-label">Record Count</span>
                            <span className="hero-stat-value">{data.length}</span>
                        </div>
                    </div>
                </div>

                {/* Interactive Charts Section */}
                <div className="report-analytics-grid no-print">
                    <div className="db-card" style={{ height: '320px' }}>
                        <div className="db-card-header">
                            <span className="db-card-title">Performance Trend</span>
                            <FaChartLine color="#4F46E5" />
                        </div>
                        <div className="db-card-body" style={{ height: '240px' }}>
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData}>
                                        <defs>
                                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                                        <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
                                        <Area type="monotone" dataKey="value" stroke="#4F46E5" fillOpacity={1} fill="url(#colorVal)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart message="Insufficient data for trend analysis" />}
                        </div>
                    </div>
                    <div className="db-card" style={{ height: '320px' }}>
                        <div className="db-card-header">
                            <span className="db-card-title">Categorical Analysis</span>
                            <FaChartPie color="#10B981" />
                        </div>
                        <div className="db-card-body" style={{ height: '240px' }}>
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value">
                                            {pieData.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
                                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart message="Insufficient data for categorical breakdown" />}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="db-card no-print" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="filter-group">
                        <label>From Date</label>
                        <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
                    </div>
                    <div className="filter-group">
                        <label>To Date</label>
                        <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
                    </div>
                    {showBranchFilter && (
                        <div className="filter-group">
                            <label>Branch</label>
                            <select value={filters.branchId} onChange={(e) => setFilters({...filters, branchId: e.target.value})}>
                                <option value="all">All Branches</option>
                                <option value="1">Main Office</option>
                            </select>
                        </div>
                    )}
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label>Search</label>
                        <div style={{ position: 'relative' }}>
                            <FaSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                            <input style={{ paddingLeft: '32px', width: '100%' }} placeholder="Filter results..." value={filters.searchTerm} onChange={(e) => setFilters({...filters, searchTerm: e.target.value})} />
                        </div>
                    </div>
                    <button className="db-btn db-btn-primary" onClick={() => fetchData()}>Apply</button>
                    <button className="db-btn" onClick={handlePrint}><FaPrint /> Print</button>
                </div>

                {/* Table Data */}
                <div className="db-card">
                    <div className="db-card-header">
                        <span className="db-card-title">Detailed Records</span>
                        {autoExpandedMsg && <span className="report-alert">⚠️ {autoExpandedMsg}</span>}
                    </div>
                    <div className="db-table-wrap">
                        {loading ? <LoadingState /> : (
                            <table className="db-table">
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
                                        return Object.values(row).some(val => String(val).toLowerCase().includes(filters.searchTerm.toLowerCase()));
                                    }).map((row, rowIdx) => (
                                        <tr key={rowIdx}>
                                            {columns.map((col, colIdx) => (
                                                <td key={colIdx} style={{ textAlign: col.align || 'left' }}>
                                                    {col.type === 'amount' 
                                                        ? `₹${new Intl.NumberFormat('en-IN').format(row[col.key] || 0)}`
                                                        : row[col.key] || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr className="total-row">
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx} style={{ textAlign: col.align || 'left', fontWeight: 800 }}>
                                                {colIdx === 0 ? 'TOTAL' : (col.type === 'amount' ? `₹${new Intl.NumberFormat('en-IN').format(calculateTotal(col.key))}` : '')}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .report-hero-card { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; padding: 40px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; color: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); }
                .report-tag { background: rgba(59,130,246,0.2); padding: 4px 12px; border-radius: 100px; color: #60a5fa; font-size: 11px; fontWeight: 700; margin-bottom: 12px; display: inline-block; }
                .report-title { font-size: 32px; font-weight: 800; margin: 0; }
                .report-desc { color: #94a3b8; font-size: 14px; margin: 8px 0 0; }
                .report-hero-stats { display: flex; gap: 40px; }
                .hero-stat-item { display: flex; flex-direction: column; align-items: flex-end; }
                .hero-stat-label { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
                .hero-stat-value { font-size: 24px; font-weight: 700; color: white; }
                .report-analytics-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px; }
                .filter-group { display: flex; flex-direction: column; gap: 4px; }
                .filter-group label { font-size: 11px; font-weight: 700; color: #64748b; }
                .filter-group input, .filter-group select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
                .report-alert { background: #fffbeb; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
                .total-row { background: #f8fafc; }
                .total-row td { color: #4F46E5 !important; }
                @media print { .no-print { display: none !important; } .db-page { background: white; } }
            `}} />
        </div>
    );
};

const LoadingState = () => (
    <div style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f1f5f9', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        <p style={{ marginTop: '16px', color: '#64748b' }}>Synthesizing analytics...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const EmptyChart = ({ message }: any) => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px', gap: '8px' }}>
        <FaChartBar size={24} opacity={0.2} />
        {message}
    </div>
);

export default BaseReportPage;
