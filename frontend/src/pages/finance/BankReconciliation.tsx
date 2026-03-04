import React, { useState, useEffect } from 'react';
import { financeApi } from './financeApi';
import './Finance.css';

const BankReconciliation: React.FC = () => {
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [selectedBank, setSelectedBank] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const companyId = 1;

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await financeApi.getBankAccounts(companyId);
                setBankAccounts(res.data);
                if (res.data.length > 0) setSelectedBank(res.data[0].id);
            } catch (err) {
                console.error(err);
            }
        };
        fetchBanks();
    }, [companyId]);

    const fetchTransactions = async () => {
        if (!selectedBank) return;
        setLoading(true);
        try {
            const res = await financeApi.getBankTransactions(companyId, selectedBank);
            setTransactions(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [selectedBank]);

    const handleAutoReconcile = async () => {
        if (!selectedBank) return;
        setLoading(true);
        try {
            const res = await financeApi.reconcileBank(companyId, selectedBank);
            alert(`Auto-reconciliation complete! Matched ${res.data.matched_count} transactions.`);
            fetchTransactions();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="finance-container">
            <div className="finance-header">
                <h1>Bank Automation & Reconciliation</h1>
                <div className="actions">
                    <button className="btn btn-success" onClick={handleAutoReconcile} disabled={loading}>
                        <i className="fas fa-magic"></i> Run Auto-Matching
                    </button>
                    <button className="btn btn-primary ml-2">
                        <i className="fas fa-file-import"></i> Import Statement (CSV)
                    </button>
                </div>
            </div>

            <div className="bank-select card mb-4">
                <label>Select Bank Account:</label>
                <select value={selectedBank || ''} onChange={e => setSelectedBank(Number(e.target.value))}>
                    {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number} (₹ {b.balance.toLocaleString()})</option>
                    ))}
                </select>
            </div>

            <div className="table-wrapper card">
                <h3>Bank Transactions vs Ledger</h3>
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(tx => (
                            <tr key={tx.id}>
                                <td>{tx.date}</td>
                                <td>{tx.description}</td>
                                <td className="num">₹ {tx.amount.toLocaleString()}</td>
                                <td><span className={`badge ${tx.type === 'CR' ? 'badge-success' : 'badge-danger'}`}>{tx.type}</span></td>
                                <td>
                                    {tx.reconciled ? 
                                        <span className="status-pill active">Reconciled</span> : 
                                        <span className="status-pill pending">Unmatched</span>
                                    }
                                </td>
                                <td>
                                    {!tx.reconciled && <button className="btn btn-sm btn-outline-primary">Manual Match</button>}
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center' }}>No transactions found for this bank account.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BankReconciliation;
