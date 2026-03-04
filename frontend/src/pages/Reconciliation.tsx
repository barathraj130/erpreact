// frontend/src/pages/Reconciliation.tsx

import React, { useState } from 'react';
// import { fetchReconciliationData, completeReconciliation } from '../api/reconciliationApi'; // To be used

const Reconciliation: React.FC = () => {
    const [selectedBankLedger, setSelectedBankLedger] = useState<number | null>(1);
    const [loading, setLoading] = useState(false);
    const [unmatchedCount, setUnmatchedCount] = useState(0);

    // Mock Ledgers
    const mockLedgers = [
        { id: 1, name: 'ICICI Bank Account' }, 
        { id: 2, name: 'HDFC Current Account' }
    ];

    const mockUnmatched = [
        { id: 201, date: '2024-07-01', description: 'Credit from Customer A', amount: 15000.00, type: 'CR' },
        { id: 202, date: '2024-07-02', description: 'Office Rent Payment', amount: -25000.00, type: 'DR' },
    ];

    const handleReconcile = async () => {
        if (!selectedBankLedger) return;
        setLoading(true);
        try {
            // Find matched IDs (simplification: assume all mockUnmatched transactions are matched)
            // const matchedIds = mockUnmatched.map(t => t.id);
            // await completeReconciliation(selectedBankLedger, matchedIds);
            alert("Reconciliation simulated successfully.");
            setUnmatchedCount(0); // Update count after successful reconciliation
        } catch (error: any) {
            alert(`Reconciliation failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    React.useEffect(() => {
        if(selectedBankLedger) {
            setUnmatchedCount(mockUnmatched.length); // Mock initial load
            // fetchReconciliationData(selectedBankLedger).then(data => setUnmatchedCount(data.unmatched_transactions.length));
        }
    }, [selectedBankLedger]);

    return (
        <section id="reconciliationSection" className="app-section">
            <div className="section-header">
                <h2>Bank Reconciliation</h2>
                <div>
                    <select 
                        className="form-control" 
                        value={selectedBankLedger || ''} 
                        onChange={(e) => setSelectedBankLedger(parseInt(e.target.value))}
                        style={{width: 'auto'}}
                    >
                        <option value="">Select Bank Ledger</option>
                        {mockLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleReconcile} 
                        disabled={loading || unmatchedCount === 0 || !selectedBankLedger}
                    >
                        {loading ? 'Processing...' : `Reconcile (${unmatchedCount})`}
                    </button>
                </div>
            </div>
            
            {selectedBankLedger ? (
                <>
                    <p>Transactions pending reconciliation for {mockLedgers.find(l => l.id === selectedBankLedger)?.name}:</p>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Internal Description</th>
                                    <th className="num">Amount (₹)</th>
                                    <th>Type</th>
                                    <th>Match Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockUnmatched.map(t => (
                                    <tr key={t.id}>
                                        <td>{t.date}</td>
                                        <td>{t.description}</td>
                                        <td className="num">{Math.abs(t.amount).toFixed(2)}</td>
                                        <td>{t.type}</td>
                                        <td><span style={{color: 'orange'}}>Pending Match</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <p className="text-center">Please select a Bank Ledger to begin reconciliation.</p>
            )}
        </section>
    );
};

export default Reconciliation;