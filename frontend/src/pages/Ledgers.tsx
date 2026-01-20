// frontend/src/pages/Ledgers.tsx

import React, { useState } from 'react';
// import { useLedgers } from '../hooks/useLedgers'; // To be created

const Ledgers: React.FC = () => {
    const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'report' | 'coa'>('report');
    
    // Mock Ledger Tabs (Would be generated dynamically from ledgerApi)
    const mockLedgers = [
        { id: 1, name: 'Cash Ledger' }, 
        { id: 2, name: 'ICICI Bank' }, 
        { id: 3, name: 'HDFC Bank' }
    ];

    return (
        <section id="ledgersSection" className="app-section">
            <div className="section-header">
                <h2>Ledgers & Accounts</h2>
                <div>
                    <button 
                        className={`btn ${viewMode === 'coa' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setViewMode('coa')}
                    >
                        <i className="fas fa-layer-group"></i> Manage COA
                    </button>
                    <button 
                        className={`btn ${viewMode === 'report' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setViewMode('report')}
                    >
                        <i className="fas fa-book"></i> Ledger Report
                    </button>
                    <button className="btn btn-success" onClick={() => {/* openVoucherModal('Receipt') */}}><i className="fas fa-plus"></i> New Receipt</button>
                </div>
            </div>
            
            {viewMode === 'coa' && (
                <div id="coaManagementArea">
                    <h3 className="section-subheader">Manage Chart of Accounts</h3>
                    <p>Interface for adding/editing groups and ledgers goes here.</p>
                </div>
            )}

            {viewMode === 'report' && (
                <>
                    <h3 className="section-subheader">Ledger Report View</h3>
                    <div className="ledger-tabs" id="ledgerTabsContainer">
                        {mockLedgers.map(l => (
                            <button 
                                key={l.id} 
                                className={`ledger-tab-btn ${selectedLedgerId === l.id ? 'active' : ''}`}
                                onClick={() => setSelectedLedgerId(l.id)}
                            >
                                {l.name}
                            </button>
                        ))}
                    </div>
                    
                    <div id="ledgerDisplayArea">
                        {selectedLedgerId ? (
                            <p>Loading report for Ledger ID: {selectedLedgerId}...</p>
                            // NOTE: Detailed ledger report component goes here
                        ) : (
                            <p className="text-center">Please select a ledger tab above.</p>
                        )}
                    </div>
                </>
            )}
        </section>
    );
};

export default Ledgers;