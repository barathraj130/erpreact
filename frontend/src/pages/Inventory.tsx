// frontend/src/pages/Inventory.tsx
import React, { useState } from 'react';
import { FaBoxOpen, FaEdit, FaFilter, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { deleteProduct } from '../api/productApi';
import { useProducts } from '../hooks/useProducts';

const Inventory: React.FC = () => {
    const { products, loading, error, refresh } = useProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('all');

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesStock = true;
        if (stockFilter === 'low') matchesStock = p.current_stock <= (p.low_stock_threshold || 5);
        if (stockFilter === 'out') matchesStock = p.current_stock === 0;

        return matchesSearch && matchesStock;
    });

    const handleDelete = async (id: number) => {
        if (window.confirm("Delete this product?")) {
            await deleteProduct(id);
            refresh();
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex-between" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Inventory</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Track stock levels and product details.</p>
                </div>
                <button className="btn-primary" onClick={() => alert('Open Product Modal')}>
                    <FaPlus /> Add Product
                </button>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                    <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                        placeholder="Search products by Name or SKU..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '35px', width: '100%', border: 'none', background: 'transparent' }} 
                    />
                </div>
                <div style={{ height: '20px', width: '1px', background: '#e2e8f0' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                    <FaFilter size={12} />
                    <select 
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value)}
                        style={{ border: 'none', background: 'transparent', color: '#475569', fontWeight: 500, outline: 'none' }}
                    >
                        <option value="all">All Stock</option>
                        <option value="low">Low Stock</option>
                        <option value="out">Out of Stock</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading inventory...</div>}
                
                {!loading && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600, color: '#475569' }}>Product Name</th>
                                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600, color: '#475569' }}>SKU</th>
                                <th style={{ textAlign: 'right', padding: '16px', fontWeight: 600, color: '#475569' }}>Price</th>
                                <th style={{ textAlign: 'center', padding: '16px', fontWeight: 600, color: '#475569' }}>Stock Level</th>
                                <th style={{ textAlign: 'center', padding: '16px', fontWeight: 600, color: '#475569' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '60px 0', textAlign: 'center' }}>
                                        <div style={{ color: '#cbd5e1', fontSize: '3rem', marginBottom: '10px' }}><FaBoxOpen /></div>
                                        <p style={{ color: '#94a3b8' }}>No products found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((p) => {
                                    const isLow = p.current_stock <= (p.low_stock_threshold || 5);
                                    const isOut = p.current_stock === 0;
                                    
                                    return (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px', fontWeight: 500 }}>{p.product_name}</td>
                                            <td style={{ padding: '16px', color: '#64748b' }}>{p.sku || '-'}</td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace' }}>₹{p.sale_price.toFixed(2)}</td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <span style={{ 
                                                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                                    backgroundColor: isOut ? '#fee2e2' : isLow ? '#ffedd5' : '#dcfce7',
                                                    color: isOut ? '#991b1b' : isLow ? '#9a3412' : '#166534'
                                                }}>
                                                    {p.current_stock} Units
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                                    <button style={{ color: '#3b82f6' }}><FaEdit /></button>
                                                    <button style={{ color: '#ef4444' }} onClick={() => handleDelete(p.id)}><FaTrash /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Inventory;