// frontend/src/pages/SalesOrders.tsx

import React from 'react';
// import { useSalesOrders } from '../hooks/useSalesOrders'; // To be implemented

const SalesOrders: React.FC = () => {
    // const { orders, loading, error, refresh } = useSalesOrders();
    const orders = [
        { id: 1, order_number: 'SO-001', customer_id: 5, customer_name: 'Customer E', order_date: '2024-07-20', total_value: 12500.50, status: 'Confirmed' },
        { id: 2, order_number: 'SO-002', customer_id: 8, customer_name: 'Customer F', order_date: '2024-07-22', total_value: 450.00, status: 'Shipped' },
    ];
    const loading = false;
    const error = null;

    const handleCreateInvoice = (orderId: number) => {
        if (window.confirm(`Convert Sales Order ${orderId} to Invoice?`)) {
            // API call: convertToInvoice(orderId)
            alert(`Converting SO-${orderId} to Invoice... (Simulated)`);
            // refresh();
        }
    };

    return (
        <section id="salesOrderSection" className="app-section">
            <div className="section-header">
                <h2>Sales Orders</h2>
                <button className="btn btn-primary" onClick={() => {/* openSalesOrderModal() */}}>
                    <i className="fas fa-file-invoice"></i> Create New Order
                </button>
            </div>

            {loading && <p>Loading sales orders...</p>}
            {error && <p className="text-danger">Error: {error}</p>}

            {!loading && orders.length > 0 && (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Date</th>
                                <th className="num">Value (₹)</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td>{order.order_number}</td>
                                    <td>{order.customer_name}</td>
                                    <td>{new Date(order.order_date).toLocaleDateString()}</td>
                                    <td className="num">{order.total_value.toFixed(2)}</td>
                                    <td>
                                        <span className={`status-badge status-${order.status.toLowerCase()}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="actions-cell">
                                        {order.status !== 'Invoiced' && (
                                            <button 
                                                className="btn btn-sm btn-success" 
                                                onClick={() => handleCreateInvoice(order.id)}
                                            >
                                                Invoice
                                            </button>
                                        )}
                                        <button className="btn btn-sm btn-info">View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default SalesOrders;