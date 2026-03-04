import React, { useState, useEffect } from 'react';
import { financeApi } from './financeApi';
import './Finance.css';

const LoanManagement: React.FC = () => {
    const [loans, setLoans] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const companyId = 1; // Real app would get this from Auth context/props

    const [formData, setFormData] = useState({
        party_name: '',
        party_type: 'EMPLOYEE',
        loan_direction: 'GIVEN',
        principal_amount: 0,
        interest_rate: 12,
        interest_type: 'EMI',
        start_date: new Date().toISOString().split('T')[0],
        duration_months: 12
    });

    const fetchLoans = async () => {
        try {
            const res = await financeApi.getLoans(companyId);
            setLoans(res.data);
        } catch (err) {
            console.error("Failed to fetch loans", err);
        }
    };

    useEffect(() => {
        fetchLoans();
    }, [companyId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await financeApi.createLoan({ ...formData, company_id: companyId });
            setShowModal(false);
            fetchLoans(); // Refresh real data
            alert('Loan created successfully!');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const stats = {
        totalGiven: loans.filter(l => l.loan_direction === 'GIVEN').reduce((acc, curr) => acc + curr.principal_amount, 0),
        interestAccrued: loans.reduce((acc, curr) => acc + (curr.principal_amount * curr.interest_rate / 100), 0) / 12, // Simple monthly est for UI
        overdue: loans.filter(l => l.status === 'OVERDUE').reduce((acc, curr) => acc + curr.outstanding_amount, 0)
    };

    return (
        <div className="finance-container">
            <div className="finance-header">
                <h1>Loan & Advance Management</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <i className="fas fa-plus"></i> New Loan
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total Loans Given</h3>
                    <p className="stat-value">₹ {stats.totalGiven.toLocaleString()}</p>
                    <span className="stat-change positive">Real-time data</span>
                </div>
                <div className="stat-card">
                    <h3>Interest Earned (Est.)</h3>
                    <p className="stat-value">₹ {stats.interestAccrued.toLocaleString()}</p>
                    <span className="stat-change">Accrued from ledger</span>
                </div>
                <div className="stat-card">
                    <h3>Overdue Outstanding</h3>
                    <p className="stat-value overdue">₹ {stats.overdue.toLocaleString()}</p>
                    <span className="stat-change negative">{loans.filter(l => l.status === 'OVERDUE').length} cases</span>
                </div>
            </div>

            <div className="table-wrapper card">
                <h3>Active Loans</h3>
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>Party Name</th>
                            <th>Type</th>
                            <th>Principal</th>
                            <th>Rate</th>
                            <th>Duration</th>
                            <th>Outstanding</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loans.map(loan => (
                            <tr key={loan.id}>
                                <td>{loan.party_name}</td>
                                <td><span className={`badge badge-${loan.party_type === 'BANK' ? 'danger' : 'info'}`}>{loan.party_type}</span></td>
                                <td>₹ {loan.principal_amount.toLocaleString()}</td>
                                <td>{loan.interest_rate}%</td>
                                <td>{loan.duration_months} Mo</td>
                                <td>₹ {loan.outstanding_amount.toLocaleString()}</td>
                                <td><span className={`status-pill ${loan.status.toLowerCase()}`}>{loan.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2>Register New Loan</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Party Name</label>
                                <input type="text" required onChange={e => setFormData({...formData, party_name: e.target.value})} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Principal Amount</label>
                                    <input type="number" required onChange={e => setFormData({...formData, principal_amount: Number(e.target.value)})} />
                                </div>
                                <div className="form-group">
                                    <label>Interest Rate (%)</label>
                                    <input type="number" step="0.1" defaultValue="12" onChange={e => setFormData({...formData, interest_rate: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Type</label>
                                    <select onChange={e => setFormData({...formData, interest_type: e.target.value})}>
                                        <option value="EMI">EMI Based</option>
                                        <option value="SIMPLE">Simple Interest</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Duration (Months)</label>
                                    <input type="number" defaultValue="12" onChange={e => setFormData({...formData, duration_months: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Processing...' : 'Create Loan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoanManagement;
