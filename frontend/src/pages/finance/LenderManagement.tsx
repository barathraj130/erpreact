
import React, { useEffect, useState } from "react";
import { FaPlus, FaUniversity, FaUserTie, FaBuilding, FaEllipsisV, FaTrash, FaEye, FaHandHoldingUsd, FaFileInvoiceDollar, FaChartLine } from "react-icons/fa";
import { fetchLenders, createLender, deleteLender, Lender } from "../../api/lenderApi";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import "../PageShared.css";
import "./LenderManagement.css";

const LenderManagement: React.FC = () => {
    const [lenders, setLenders] = useState<Lender[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        lender_name: "",
        lender_type: "Bank",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        opening_balance: 0,
        notes: ""
    });

    const loadData = async () => {
        try {
            const data = await fetchLenders();
            setLenders(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Failed to load lenders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createLender(formData);
            toast.success("Lender added successfully");
            setShowModal(false);
            setFormData({
                lender_name: "", lender_type: "Bank", contact_person: "",
                phone: "", email: "", address: "", opening_balance: 0, notes: ""
            });
            loadData();
        } catch (err) {
            toast.error("Failed to add lender");
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this lender?")) return;
        try {
            const res = await deleteLender(id);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Lender deleted");
                loadData();
            }
        } catch (err) {
            toast.error("Error deleting lender");
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'Bank': return <FaUniversity className="l-type-icon bank" />;
            case 'NBFC': return <FaBuilding className="l-type-icon nbfc" />;
            case 'Private Person': return <FaUserTie className="l-type-icon private" />;
            default: return <FaHandHoldingUsd className="l-type-icon other" />;
        }
    };

    const safeLenders = Array.isArray(lenders) ? lenders : [];
    const totalOutstanding = safeLenders.reduce((acc, l) => acc + (Number(l.total_borrowed || 0) - Number(l.total_repaid || 0)), 0);
    const totalBorrowed = safeLenders.reduce((acc, l) => acc + Number(l.total_borrowed || 0), 0);

    return (
        <div className="db-page">
            <header className="db-topbar">
                <div className="db-topbar-left">
                    <span className="db-topbar-title">Finance</span>
                    <span className="db-topbar-sep">/</span>
                    <span className="db-topbar-sub">Lenders Master</span>
                </div>
                <div className="db-topbar-right">
                    <button className="page-btn-round page-btn-round-primary" onClick={() => setShowModal(true)}>
                        <FaPlus size={12} /> Add New Lender
                    </button>
                </div>
            </header>

            <div className="db-content">
                {/* KPI Section */}
                <div className="l-stats-grid">
                    <div className="l-stat-card">
                        <div className="l-stat-icon-wrap blue">
                            <FaHandHoldingUsd size={20} />
                        </div>
                        <div className="l-stat-info">
                            <span className="l-stat-label">Total Borrowed</span>
                            <span className="l-stat-value">₹{totalBorrowed.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="l-stat-card">
                        <div className="l-stat-icon-wrap purple">
                            <FaFileInvoiceDollar size={20} />
                        </div>
                        <div className="l-stat-info">
                            <span className="l-stat-label">Total Outstanding</span>
                            <span className="l-stat-value">₹{totalOutstanding.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="l-stat-card">
                        <div className="l-stat-icon-wrap green">
                            <FaChartLine size={20} />
                        </div>
                        <div className="l-stat-info">
                            <span className="l-stat-label">Total Lenders</span>
                            <span className="l-stat-value">{safeLenders.length}</span>
                        </div>
                    </div>
                </div>

                {/* Lenders Table */}
                <div className="l-table-container">
                    <table className="l-table">
                        <thead>
                            <tr>
                                <th>Lender Name</th>
                                <th>Type</th>
                                <th>Total Borrowed</th>
                                <th>Total Repaid</th>
                                <th>Outstanding</th>
                                <th>Contact</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
                            ) : safeLenders.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>No lenders found. Click "Add New Lender" to start.</td></tr>
                            ) : (
                                safeLenders.map(l => (
                                    <tr key={l.id}>
                                        <td>
                                            <div className="l-name-cell">
                                                {getIcon(l.lender_type)}
                                                <div>
                                                    <div className="l-name-text">{l.lender_name}</div>
                                                    <div className="l-sub-text">{l.contact_person || 'No Contact Person'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className={`l-badge ${l.lender_type.toLowerCase().replace(' ', '-')}`}>{l.lender_type}</span></td>
                                        <td className="l-amt-cell">₹{(Number(l.total_borrowed) || 0).toLocaleString()}</td>
                                        <td className="l-amt-cell repaid">₹{(Number(l.total_repaid) || 0).toLocaleString()}</td>
                                        <td className="l-amt-cell outstanding">₹{(Number(l.total_borrowed || 0) - Number(l.total_repaid || 0)).toLocaleString()}</td>
                                        <td>
                                            <div className="l-contact-cell">
                                                <div className="l-phone">{l.phone || 'N/A'}</div>
                                                <div className="l-email">{l.email || 'N/A'}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="l-actions">
                                                <button className="l-action-btn view" title="View Details"><FaEye /></button>
                                                <button className="l-action-btn delete" title="Delete" onClick={() => handleDelete(l.id)}><FaTrash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Lender Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="l-modal-overlay">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="l-modal"
                        >
                            <div className="l-modal-header">
                                <h2>Add New Lender</h2>
                                <button className="l-close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                            <form onSubmit={handleCreate} className="l-form">
                                <div className="l-form-grid">
                                    <div className="l-form-group full">
                                        <label>Lender Name *</label>
                                        <input required value={formData.lender_name} onChange={e => setFormData({...formData, lender_name: e.target.value})} placeholder="e.g. ICICI Bank" />
                                    </div>
                                    <div className="l-form-group">
                                        <label>Lender Type</label>
                                        <select value={formData.lender_type} onChange={e => setFormData({...formData, lender_type: e.target.value})}>
                                            <option value="Bank">Bank</option>
                                            <option value="Private Person">Private Person</option>
                                            <option value="NBFC">NBFC</option>
                                            <option value="Chit Company">Chit Company</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="l-form-group">
                                        <label>Contact Person</label>
                                        <input value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="Person Name" />
                                    </div>
                                    <div className="l-form-group">
                                        <label>Phone</label>
                                        <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+91 ..." />
                                    </div>
                                    <div className="l-form-group">
                                        <label>Email</label>
                                        <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@example.com" />
                                    </div>
                                    <div className="l-form-group full">
                                        <label>Address</label>
                                        <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full Address" rows={2} />
                                    </div>
                                    <div className="l-form-group">
                                        <label>Opening Balance (₹)</label>
                                        <input type="number" value={formData.opening_balance} onChange={e => setFormData({...formData, opening_balance: parseFloat(e.target.value)})} placeholder="0.00" />
                                    </div>
                                    <div className="l-form-group full">
                                        <label>Notes</label>
                                        <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Any additional info..." rows={2} />
                                    </div>
                                </div>
                                <div className="l-form-footer">
                                    <button type="button" className="l-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="l-btn-primary">Create Lender</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LenderManagement;
