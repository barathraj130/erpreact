// frontend/src/pages/BusinessFinance.tsx

import React from 'react';

const BusinessFinance: React.FC = () => {
    // const { agreements, loading, error } = useAgreements(); 

    // Mock data for display
    const agreements = [
        { id: 1, agreement_type: 'LOAN', total_amount: 500000, status: 'Active', start_date: '2023-10-01' },
        { id: 2, agreement_type: 'CHIT', total_amount: 100000, status: 'Active', start_date: '2024-05-15' },
    ];
    const loading = false;
    const error = null;

    return (
        <section id="financeSection" className="app-section">
            <div className="section-header">
                <h2>Business Finance & Agreements</h2>
                <button className="btn btn-primary" onClick={() => {/* openAgreementModal() */}}>
                    <i className="fas fa-handshake"></i> New Agreement
                </button>
            </div>

            <h3 className="section-subheader">Active Loans and Chits</h3>

            {loading && <p>Loading financial data...</p>}
            {error && <p className="text-danger">Error: {error}</p>}

            {!loading && agreements.length > 0 && (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Type</th>
                                <th className="num">Total Amount (₹)</th>
                                <th>Start Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agreements.map(agreement => (
                                <tr key={agreement.id}>
                                    <td>{agreement.id}</td>
                                    <td>{agreement.agreement_type}</td>
                                    <td className="num">{agreement.total_amount.toFixed(2)}</td>
                                    <td>{new Date(agreement.start_date).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`status-badge status-${agreement.status.toLowerCase()}`}>
                                            {agreement.status}
                                        </span>
                                    </td>
                                    <td className="actions-cell">
                                        <button className="btn btn-sm btn-info">View Schedule</button>
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

export default BusinessFinance;