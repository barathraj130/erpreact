import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaCalendarAlt, FaChartLine, FaHistory, FaReceipt } from 'react-icons/fa';
import { fetchTransactions, Transaction } from '../api/transactionApi';
import './DayBook.css';

const DayBook: React.FC = () => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async (selectedDate: string) => {
        setLoading(true);
        try {
            const data = await fetchTransactions();
            const filtered = data.filter(t => t.date.slice(0, 10) === selectedDate);
            setTransactions(filtered);
        } catch (err) {
            console.error("Failed to load Day Book:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(date);
    }, [date]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const totalDebit = transactions.reduce((sum, t) => sum + (t.type === 'BILL' || t.type === 'PAYMENT' ? Number(t.amount) : 0), 0);
    const totalCredit = transactions.reduce((sum, t) => sum + (t.type === 'INVOICE' || t.type === 'RECEIPT' ? Number(t.amount) : 0), 0);

    return (
        <div className="daybook-container">
            {/* Header */}
            <header className="daybook-header">
                <div className="daybook-title">
                    <motion.h1
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        Daily <span style={{ color: 'var(--primary)' }}>Ledger</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        Financial Audit Pulse: {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </motion.p>
                </div>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="date-selector-glass"
                >
                    <FaCalendarAlt style={{ color: 'var(--primary)' }} />
                    <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </motion.div>
            </header>

            {/* Stats Matrix */}
            <div className="ledger-matrix">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="ledger-stat-card debit"
                >
                    <div className="stat-icon-bg"><FaChartLine /></div>
                    <span className="stat-label">Neural Outflow (Debit)</span>
                    <h3 className="stat-value">{formatCurrency(totalDebit)}</h3>
                    <div style={{ marginTop: '24px', height: '4px', background: 'var(--error-glow)', borderRadius: '2px', overflow: 'hidden' }}>
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ height: '100%', background: 'var(--error)' }} 
                        />
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="ledger-stat-card credit"
                >
                    <div className="stat-icon-bg"><FaReceipt /></div>
                    <span className="stat-label">Neural Inflow (Credit)</span>
                    <h3 className="stat-value">{formatCurrency(totalCredit)}</h3>
                    <div style={{ marginTop: '24px', height: '4px', background: 'var(--success-glow)', borderRadius: '2px', overflow: 'hidden' }}>
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ height: '100%', background: 'var(--success)' }} 
                        />
                    </div>
                </motion.div>
            </div>

            {/* Table Area */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="daybook-table-wrapper"
            >
                <table className="day-table">
                    <thead>
                        <tr>
                            <th>Narrative Context</th>
                            <th>Protocol Type</th>
                            <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                            <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ padding: '80px', textAlign: 'center' }}><div className="skeleton" style={{ height: '40px', borderRadius: '12px' }}></div></td></tr>
                        ) : transactions.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '120px 0', textAlign: 'center' }}>
                                    <FaHistory size={64} style={{ color: 'var(--border-color)', marginBottom: '24px' }} />
                                    <h3 style={{ margin: 0, fontWeight: 950, color: 'var(--text-primary)' }}>Book Idle</h3>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 500, marginTop: '8px' }}>No financial impulses detected for this timestamp.</p>
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t, idx) => {
                                const isCredit = t.type === 'INVOICE' || t.type === 'RECEIPT';
                                return (
                                    <motion.tr 
                                        key={t.id} 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + (idx * 0.05) }}
                                        className="tx-row"
                                    >
                                        <td>
                                            <div className="tx-narration">{t.description}</div>
                                            <div className="tx-entity">{t.user_name || t.lender_name || 'System Auto-Node'}</div>
                                        </td>
                                        <td>
                                            <span className={`type-pill ${isCredit ? 'credit' : 'debit'}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {!isCredit ? <div className="val-debit">{formatCurrency(t.amount)}</div> : <div className="val-empty">•</div>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {isCredit ? <div className="val-credit">{formatCurrency(t.amount)}</div> : <div className="val-empty">•</div>}
                                        </td>
                                    </motion.tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </motion.div>
        </div>
    );
};

export default DayBook;