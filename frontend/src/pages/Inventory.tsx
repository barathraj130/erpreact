import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { FaBox, FaBoxOpen, FaEdit, FaFilter, FaPlus, FaSearch, FaSync, FaTrash } from 'react-icons/fa';
import { deleteProduct } from '../api/productApi';
import { useProducts } from '../hooks/useProducts';
import AddProductModal from './AddProductModal';
import './Inventory.css';

const Inventory: React.FC = () => {
    const { products, loading, error, refresh } = useProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesStock = true;
        if (stockFilter === 'low') matchesStock = p.current_stock <= (p.min_stock || 5);
        if (stockFilter === 'out') matchesStock = p.current_stock === 0;

        return matchesSearch && matchesStock;
    });

    const handleDelete = async (id: number) => {
        if (window.confirm("Relinquish this asset record? Operation-critical data may be lost.")) {
            await deleteProduct(id);
            refresh();
        }
    };

    const handleEdit = (product: any) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setSelectedProduct(null);
        setIsModalOpen(true);
    };

    return (
        <div className="inventory-container">
            {isModalOpen && (
                <AddProductModal 
                    onClose={() => setIsModalOpen(false)} 
                    onSuccess={() => { refresh(); setIsModalOpen(false); }} 
                    productToEdit={selectedProduct} 
                />
            )}

            {/* Header */}
            <div className="inventory-header">
                <div className="inventory-title">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >Asset Repository</motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >Strategic Inventory Intelligence & Lifecycle Tracking</motion.p>
                </div>
                <div className="inventory-actions" style={{ display: 'flex', gap: '12px' }}>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-secondary" 
                        onClick={() => refresh()} 
                        style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary" 
                        onClick={handleAdd} 
                        style={{ height: '52px', padding: '0 28px', gap: '12px', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 800 }}
                    >
                        <FaPlus /> Initialize New Asset
                    </motion.button>
                </div>
            </div>

            {/* Toolbar: Search & Inventory Filters */}
            <div className="inventory-toolbar">
                <div className="inventory-search">
                    <FaSearch style={{ color: 'var(--text-muted)' }} size={20} />
                    <input 
                        placeholder="Locate assets via identity, SKU, or signature..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="inventory-filters">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <FaFilter size={14} /> Threshold:
                    </div>
                    <select 
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">Full Repository</option>
                        <option value="low">Low Level Criticality</option>
                        <option value="out">Depleted Resources</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="inventory-table-container">
                <table className="inv-table">
                    <thead>
                        <tr>
                            <th>Asset Profile</th>
                            <th>Signature (SKU)</th>
                            <th style={{ textAlign: 'right' }}>Unit Valuation</th>
                            <th style={{ textAlign: 'center' }}>Reserves Status</th>
                            <th style={{ textAlign: 'center' }}>Interface</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <tr key={i}><td colSpan={5} style={{ padding: '30px' }}><div className="skeleton" style={{ height: '30px', borderRadius: '8px' }}></div></td></tr>
                            ))
                        ) : filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '120px 0', textAlign: 'center' }}>
                                    <FaBoxOpen size={64} style={{ color: 'var(--border-color)', marginBottom: '24px' }} />
                                    <h3 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)' }}>Repository Empty</h3>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 500, marginTop: '8px' }}>No assets detected within specified neural parameters.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((p, idx) => {
                                const isLow = p.current_stock <= (p.min_stock || 5);
                                const isOut = p.current_stock === 0;
                                
                                return (
                                    <motion.tr 
                                        key={p.id} 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="inv-row"
                                    >
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div className="product-orb">
                                                    <FaBox size={18} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{p.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{p.description || 'Standard Utility'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ background: 'var(--bg-body)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                                                {p.sku || `#${p.id}`}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="price-text">₹{p.selling_price.toLocaleString()}</div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                <span className={`status-badge ${isOut ? 'status-out' : isLow ? 'status-low' : 'status-ok'}`}>
                                                    {isOut ? 'Depleted' : isLow ? 'Critical' : 'Operational'}
                                                </span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: isLow || isOut ? 'var(--text-primary)' : 'var(--text-muted)' }}>{p.current_stock} Units</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                                <motion.button 
                                                    whileHover={{ scale: 1.1, background: 'var(--primary)', color: '#fff' }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="control-btn btn-edit" 
                                                    onClick={() => handleEdit(p)} 
                                                    style={{ width: '38px', height: '38px', border: 'none', borderRadius: '10px', background: 'var(--primary-glow)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Modify Manifest"
                                                >
                                                    <FaEdit size={14} />
                                                </motion.button>
                                                <motion.button 
                                                    whileHover={{ scale: 1.1, background: 'var(--error)', color: '#fff' }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="control-btn btn-delete" 
                                                    onClick={() => handleDelete(p.id)} 
                                                    style={{ width: '38px', height: '38px', border: 'none', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Relinquish Asset"
                                                >
                                                    <FaTrash size={14} />
                                                </motion.button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Inventory;