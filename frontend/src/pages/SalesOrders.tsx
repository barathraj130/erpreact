import React, { useState } from 'react';
import { FaCalendarAlt, FaCheckCircle, FaClipboardList, FaFileInvoice, FaPlus, FaSearch, FaShippingFast, FaSync } from 'react-icons/fa';

interface SalesOrder {
    id: number;
    order_number: string;
    customer_id: number;
    customer_name: string;
    order_date: string;
    total_value: number;
    status: 'Confirmed' | 'Shipped' | 'Invoiced' | 'Pending';
}

const SalesOrders: React.FC = () => {
    // Mock Data for now
    const [orders, setOrders] = useState<SalesOrder[]>([
        { id: 1, order_number: 'SO-001', customer_id: 5, customer_name: 'Tech Solutions Ltd', order_date: '2024-07-20', total_value: 12500.50, status: 'Confirmed' },
        { id: 2, order_number: 'SO-002', customer_id: 8, customer_name: 'Global Corp', order_date: '2024-07-22', total_value: 450.00, status: 'Shipped' },
        { id: 3, order_number: 'SO-003', customer_id: 2, customer_name: 'Local Retailer', order_date: '2024-07-25', total_value: 3200.00, status: 'Pending' },
    ]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const refresh = () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 500);
    };

    const handleCreateInvoice = (orderId: number) => {
        if (window.confirm(`Convert Sales Order SO-${orders.find(o => o.id === orderId)?.order_number} to Invoice?`)) {
            alert(`Converting Order #${orderId} to Invoice...`);
        }
    };

    const filteredOrders = orders.filter(o => 
        o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Confirmed': return { bg: '#dcfce7', color: '#166534', icon: <FaCheckCircle /> };
            case 'Shipped': return { bg: '#e0e7ff', color: '#4338ca', icon: <FaShippingFast /> };
            case 'Pending': return { bg: '#fef9c3', color: '#854d0e', icon: <FaClipboardList /> };
            case 'Invoiced': return { bg: '#f1f5f9', color: '#475569', icon: <FaFileInvoice /> };
            default: return { bg: '#f1f5f9', color: '#64748b', icon: null };
        }
    };

    return (
        <div className="page-transition">
            {/* Header */}
            <div style={{ 
                marginBottom: '32px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', margin: 0 }}>Sales Orders</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>Track and fulfill customer orders.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button className="btn-secondary" onClick={refresh} title="Refresh Lists" style={{ height: '48px', padding: '0 16px' }}>
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </button>
                    <button className="btn-primary" onClick={() => alert("Create Order Modal")} style={{ height: '48px', padding: '0 24px', gap: '10px' }}>
                        <FaPlus /> Create New Order
                    </button>
                </div>
            </div>

            {/* Search Toolbar */}
            <div className="card" style={{ 
                padding: '0 24px', 
                marginBottom: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                border: '1px solid var(--border-color)', 
                height: '64px', 
                background: 'white', 
                boxShadow: 'var(--shadow-sm)', 
                borderRadius: '18px' 
            }}>
                <FaSearch style={{ color: 'var(--text-light)' }} size={20} />
                <input 
                    placeholder="Search by Order identity, customer name, or status..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                        border: 'none', 
                        width: '100%', 
                        outline: 'none', 
                        background: 'transparent', 
                        fontSize: '1.05rem', 
                        fontWeight: 500, 
                        color: 'var(--text-main)',
                        letterSpacing: '-0.2px'
                    }} 
                />
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'white' }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem', minWidth: '800px' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Info</th>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                <th style={{ textAlign: 'right', padding: '16px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Value</th>
                                <th style={{ textAlign: 'center', padding: '16px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ textAlign: 'center', padding: '16px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <FaClipboardList size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                        <p>No sales orders found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => {
                                    const style = getStatusStyle(order.status);
                                    return (
                                        <tr key={order.id} className="page-transition" style={{ borderBottom: '1px solid var(--bg-body)', transition: 'background-color 0.2s' }}>
                                            <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--primary)' }}>
                                                {order.order_number}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 500, color: 'var(--text-main)' }}>
                                                {order.customer_name}
                                            </td>
                                            <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FaCalendarAlt size={12} />
                                                    {new Date(order.order_date).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                                                ₹{order.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                <span style={{ 
                                                    padding: '6px 12px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 700, 
                                                    background: style.bg, 
                                                    color: style.color,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    {style.icon} {order.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    {order.status !== 'Invoiced' && (
                                                        <button 
                                                            className="btn-secondary" 
                                                            onClick={() => handleCreateInvoice(order.id)}
                                                            style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary-glow)' }}
                                                            title="Convert to Invoice"
                                                        >
                                                            <FaFileInvoice /> Invoice
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesOrders;