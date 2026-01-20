// frontend/src/pages/Brokers.tsx

import React from 'react';

const Brokers: React.FC = () => {
    return (
        <section id="brokersSection" className="app-section">
            <div className="section-header">
                <h2>Broker/Agent Management</h2>
            </div>
            <p>This section is dedicated to managing brokers and calculating their commissions.</p>
            
            <div className="card-container">
                {/* Broker List Table */}
                <div className="data-card">
                    <h3>Active Brokers</h3>
                    {/* Placeholder for table */}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Total Sales (Mo)</th>
                                <th>Commission Rate</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={5} className="text-center">Broker data pending implementation.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
};

export default Brokers;