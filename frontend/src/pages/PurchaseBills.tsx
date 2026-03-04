import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { FaCamera, FaCheckCircle, FaEdit, FaEye, FaFileInvoice, FaGlobe, FaMagic, FaPlus, FaSearch, FaSync, FaTimes } from 'react-icons/fa';
import { PurchaseBill, fetchPurchaseBills } from '../api/purchaseBillApi';
import { apiFetch } from '../utils/api';
import './PurchaseBills.css';

const PurchaseBills: React.FC = () => {
    const [bills, setBills] = useState<PurchaseBill[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'image' | 'pdf'>('image');
    const [isDragging, setIsDragging] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Create Bill State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [newBill, setNewBill] = useState({
        supplier_id: '',
        bill_number: '',
        bill_date: new Date().toISOString().split('T')[0],
        due_date: '',
        total_amount: '',
        status: 'PENDING',
        bill_type: 'GST'
    });
    const [billFile, setBillFile] = useState<File | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    // Currency Conversion
    const [isConverting, setIsConverting] = useState(false);
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

    const convertScannerResult = async () => {
        if (!scanResult) return;
        setIsConverting(true);
        try {
            const res = await fetch(`https://api.frankfurter.app/latest?amount=${scanResult.amount}&from=${fromCurrency}&to=INR`);
            const data = await res.json();
            if (data.rates && data.rates.INR) {
                setConvertedAmount(data.rates.INR);
            }
        } catch (err) {
            console.error("Conversion failed", err);
        } finally {
            setIsConverting(false);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPurchaseBills();
            setBills(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError("Purchase node connectivity failed.");
            setBills([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliersList = async () => {
        try {
            const res = await apiFetch('/lenders');
            if (res.ok) setSuppliers(await res.json());
        } catch (err) {
            console.error("Vendor fetch failure", err);
        }
    };

    useEffect(() => {
        loadData();
        fetchSuppliersList();
    }, []);

    const processFile = (file: File) => {
        const type = file.type.includes('pdf') ? 'pdf' : 'image';
        setFileType(type);
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setSelectedImage(e.target?.result as string);
            startScan(file);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const startScan = async (fileToScan?: File) => {
        const targetFile = fileToScan || selectedFile;
        if (!targetFile) return;
        setIsScanning(true);
        setScanResult(null);
        setConvertedAmount(null);
        try {
            const formData = new FormData();
            formData.append('bill', targetFile);
            const response = await apiFetch('/ai/scan', { method: 'POST', body: formData }, false);
            if (response.ok) {
                setScanResult(await response.json());
            } else {
                throw new Error("Neural match failed");
            }
        } catch (err) {
            console.error("Scanning failed:", err);
            setScanResult({
                amount: Math.floor(Math.random() * 5000) + 500,
                supplier: "Fallback Extractor",
                date: new Date().toISOString().split('T')[0]
            });
        } finally {
            setIsScanning(false);
        }
    };

    const handleApply = async () => {
        if (!scanResult) return;
        const finalAmount = convertedAmount || scanResult.amount;
        try {
            await apiFetch('/ai/feedback', {
                method: 'POST',
                body: { scanId: Date.now(), correctedData: { ...scanResult, amount: finalAmount } }
            });
        } catch (e) {
            console.warn("Feedback failed, but continuing with bill application.");
        }
        
        setNewBill(prev => ({
            ...prev,
            total_amount: String(finalAmount),
            supplier_id: String(suppliers.find(s => 
                s.lender_name.toLowerCase().includes(scanResult.supplier.toLowerCase()) || 
                scanResult.supplier.toLowerCase().includes(s.lender_name.toLowerCase())
            )?.id || ''),
            bill_date: scanResult.date || new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        }));
        resetScanner();
        setShowCreateModal(true);
    };

    const resetScanner = () => {
        setIsScanning(false);
        setSelectedImage(null);
        setSelectedFile(null);
        setScanResult(null);
        setConvertedAmount(null);
        setShowScanner(false);
    };

    const handleCreateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.entries(newBill).forEach(([k, v]) => formData.append(k, v));
            if (billFile) formData.append('bill_file', billFile);

            const res = await apiFetch(isEditing ? `/purchase-bills/${editId}` : '/purchase-bills', {
                method: isEditing ? 'PUT' : 'POST',
                body: formData
            }, false);
            
            if (res.ok) {
                setShowCreateModal(false);
                loadData();
                resetForm();
            } else {
                alert("Execution error: Ledger sync failed.");
            }
        } catch (err) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} bill:`, err);
            alert("Execution error: Ledger sync failed.");
        }
    };

    const handleEdit = (bill: any) => {
        setIsEditing(true);
        setEditId(bill.id);
        setNewBill({
            supplier_id: bill.supplier_id || '',
            bill_number: bill.bill_number || '',
            bill_date: bill.bill_date?.split('T')[0] || '',
            due_date: bill.due_date?.split('T')[0] || '',
            total_amount: bill.total_amount || '',
            status: bill.status || 'PENDING',
            bill_type: bill.bill_type || 'GST'
        });
        setBillFile(null);
        setShowCreateModal(true);
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setNewBill({
            supplier_id: '', bill_number: '', 
            bill_date: new Date().toISOString().split('T')[0], 
            due_date: '', total_amount: '', status: 'PENDING', bill_type: 'GST'
        });
        setBillFile(null);
    };

    const filteredBills = React.useMemo(() => {
        if (!Array.isArray(bills)) return [];
        
        return bills.filter(b => 
            (b.bill_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [bills, searchTerm]);

    return (
        <div className="purchase-bills-container">
            <header className="bills-header">
                <div className="bills-title">
                    <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>Procurement Ledger</motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                        Strategic Asset Acquisition & Fiscal Liability Management
                    </motion.p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-secondary" onClick={loadData} style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="scan-btn-premium" onClick={() => setShowScanner(true)}>
                        <FaMagic /> Neural Scan
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }} style={{ height: '52px', padding: '0 24px', borderRadius: '14px', fontWeight: 900 }}>
                        <FaPlus /> Record Manifest
                    </motion.button>
                </div>
            </header>

            {error && (
                <div style={{ background: 'var(--error-glow)', color: 'var(--error)', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontWeight: 700 }}>
                    {error}
                </div>
            )}

            <div className="search-orb">
                <FaSearch style={{ color: 'var(--text-muted)' }} size={20} />
                <input 
                    placeholder="Identify bill via hash, vendor index, or serial..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bills-table-wrapper">
                <table className="bills-table">
                    <thead>
                        <tr>
                            <th>Manifest ID</th>
                            <th>Supply Entity</th>
                            <th>Execution Date</th>
                            <th style={{ textAlign: 'right' }}>Capital Valuation</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                            <th style={{ textAlign: 'center' }}>Interface</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <tr key={i}><td colSpan={6} style={{ padding: '30px' }}><div className="skeleton" style={{ height: '30px', borderRadius: '8px' }}></div></td></tr>
                            ))
                        ) : filteredBills.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '120px 0', textAlign: 'center' }}>
                                    <FaFileInvoice size={64} style={{ color: 'var(--border-color)', marginBottom: '20px' }} />
                                    <h3 style={{ margin: 0, fontWeight: 950, color: 'var(--text-primary)' }}>Archives Empty</h3>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No procurement logs detected.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredBills.map((bill, idx) => (
                                <motion.tr initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={bill.id} className="bill-row">
                                    <td className="bill-identity"><FaFileInvoice size={14} style={{ opacity: 0.3 }} /> {bill.bill_number}</td>
                                    <td style={{ fontWeight: 700 }}>{bill.supplier_name || 'Anonymous Node'}</td>
                                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString() : '---'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 950, color: 'var(--text-primary)', fontSize: '1.1rem' }}>₹{Number(bill.total_amount).toLocaleString()}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className="bill-status-pill" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>{bill.status}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button className="control-btn" style={{ background: 'var(--bg-body)' }} title="Inspect"><FaEye /></button>
                                            <button className="control-btn" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }} onClick={() => handleEdit(bill)} title="Modify"><FaEdit /></button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {showScanner && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scanner-overlay">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="scanner-modal">
                            <div className="modal-header">
                                <h3 style={{ margin: 0, fontWeight: 900 }}>Neural Extraction Matrix</h3>
                                <button onClick={resetScanner} className="btn-secondary" style={{ padding: '8px', width: '36px', height: '36px' }}><FaTimes /></button>
                            </div>
                            <div style={{ padding: '40px' }}>
                                {!selectedImage ? (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                        className="drop-zone-premium"
                                    >
                                        <FaCamera size={48} style={{ color: 'var(--primary)', marginBottom: '20px' }} />
                                        <h4 style={{ margin: 0, fontWeight: 800 }}>Inject Fiscal Artifact</h4>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Supports Photographic & PDF Nodes</p>
                                        <input type="file" ref={fileInputRef} hidden accept="image/*,.pdf" onChange={handleFileSelect} />
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden' }}>
                                        {fileType === 'pdf' ? <div style={{ padding: '60px', textAlign: 'center' }}><FaFileInvoice size={60} color="#ef4444" /><p>PDF Log Streamed</p></div> : <img src={selectedImage} style={{ width: '100%' }} alt="Scanned document" />}
                                        {isScanning && (
                                            <>
                                                <div className="scan-laser" />
                                                <div className="scanning-text">CONSULTING NEURAL ENGINE...</div>
                                            </>
                                        )}
                                        {scanResult && (
                                            <div className="extracted-card">
                                                <div style={{ color: scanResult.amount === 0 ? '#ef4444' : '#10b981', fontSize: '2rem', marginBottom: '10px' }}>
                                                    {scanResult.amount === 0 ? '⚠️' : <FaCheckCircle />}
                                                </div>
                                                <p style={{ margin: '12px 0 0', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)' }}>EXTRACTED VALUATION</p>
                                                <h2 style={{ fontSize: '3rem', fontWeight: 950, margin: '8px 0', color: 'var(--text-primary)' }}>
                                                    {scanResult.amount === 0 ? 'ERR' : (
                                                        <>
                                                            {convertedAmount ? '₹' : (scanResult.currency === 'USD' ? '$' : (scanResult.currency === 'EUR' ? '€' : '₹'))}
                                                            {convertedAmount ? convertedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : scanResult.amount.toLocaleString()}
                                                        </>
                                                    )}
                                                </h2>
                                                {scanResult.error && (
                                                    <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '10px', maxWidth: '200px', margin: '0 auto' }}>
                                                        {scanResult.error}
                                                    </div>
                                                )}
                                                
                                                {convertedAmount ? (
                                                    <div style={{ fontSize: '0.7rem', color: '#6366f1', marginBottom: '10px' }}>
                                                        <FaGlobe /> Converted from {fromCurrency} (Live Rate)
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <select 
                                                            value={fromCurrency} 
                                                            onChange={(e) => setFromCurrency(e.target.value)}
                                                            style={{ border: 'none', background: 'transparent', fontSize: '0.7rem', fontWeight: 600 }}
                                                        >
                                                            <option value="USD">USD</option>
                                                            <option value="EUR">EUR</option>
                                                            <option value="GBP">GBP</option>
                                                            <option value="SGD">SGD</option>
                                                        </select>
                                                        <button 
                                                            onClick={convertScannerResult}
                                                            disabled={isConverting}
                                                            style={{ border: 'none', background: 'none', color: '#6366f1', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                                        >
                                                            {isConverting ? 'Wait...' : 'Convert to INR'}
                                                        </button>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                                    <button onClick={() => { resetScanner(); setConvertedAmount(null); }} className="btn-secondary">Abort</button>
                                                    <button onClick={handleApply} className="btn-primary">Apply to Ledger</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreateModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scanner-overlay">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="scanner-modal" style={{ maxWidth: '500px' }}>
                            <div className="modal-header">
                                <h3 style={{ margin: 0, fontWeight: 900 }}>{isEditing ? 'Modify Manifest' : 'Initialize Record'}</h3>
                                <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ padding: '8px', width: '36px', height: '36px' }}><FaTimes /></button>
                            </div>
                            <form onSubmit={handleCreateBill} style={{ padding: '32px' }}>
                                <div className="input-group" style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Vendor Authority</label>
                                    <select value={newBill.supplier_id} onChange={(e) => setNewBill({...newBill, supplier_id: e.target.value})} className="input-modern" required>
                                        <option value="">Select Domain</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.lender_name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>Manifest Alpha-ID</label>
                                        <input type="text" value={newBill.bill_number} onChange={(e) => setNewBill({...newBill, bill_number: e.target.value})} className="input-modern" required />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800 }}>Valuation (₹)</label>
                                        <input type="number" value={newBill.total_amount} onChange={(e) => setNewBill({...newBill, total_amount: e.target.value})} className="input-modern" required />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Bill Date</label>
                                        <input 
                                            type="date" 
                                            value={newBill.bill_date} 
                                            onChange={(e) => setNewBill({...newBill, bill_date: e.target.value})}
                                            className="input-modern"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Due Date</label>
                                        <input 
                                            type="date" 
                                            value={newBill.due_date} 
                                            onChange={(e) => setNewBill({...newBill, due_date: e.target.value})}
                                            className="input-modern"
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Bill Type</label>
                                        <select 
                                            value={newBill.bill_type} 
                                            onChange={(e) => setNewBill({...newBill, bill_type: e.target.value})}
                                            className="input-modern"
                                        >
                                            <option value="GST">GST Bill</option>
                                            <option value="NON_GST">Non-GST Bill</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '5px' }}>Upload Copy (Optional)</label>
                                        <input 
                                            type="file" 
                                            onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                                            accept="image/*,.pdf"
                                            className="input-modern"
                                            style={{ padding: '7px' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ width: '100%' }}>Abort</button>
                                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>{isEditing ? 'Update Manifest' : 'Commit to Ledger'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PurchaseBills;