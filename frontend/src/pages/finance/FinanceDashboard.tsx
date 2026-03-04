import React, { useState, useEffect } from 'react';
import { financeApi } from './financeApi';
import './Finance.css';

const FinanceDashboard: React.FC = () => {
    const [summary, setSummary] = useState({
        totalCash: 0,
        totalBank: 0,
        totalReceivables: 0,
        totalPayables: 0,
        netProfit: 0
    });
    const companyId = 1;

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [accountsRes, plRes] = await Promise.all([
                    financeApi.getAccounts(companyId),
                    financeApi.getProfitLoss(companyId, '2020-01-01', new Date().toISOString().split('T')[0])
                ]);
                
                const accounts = accountsRes.data;
                const getBal = (name: string) => accounts.find((a: any) => a.name === name)?.balance || 0;
                
                setSummary({
                    totalCash: getBal('Cash'),
                    totalBank: getBal('Bank'),
                    totalReceivables: getBal('Accounts Receivable'),
                    totalPayables: getBal('Accounts Payable'),
                    netProfit: plRes.data.net_profit
                });
            } catch (err) {
                console.error(err);
            }
        };
        fetchDashboardData();
    }, [companyId]);

    return (
        <div className="finance-container">
            <div className="finance-header">
                <h1>Finance Command Center</h1>
                <div className="company-badge">Company ID: {companyId}</div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Liquid Cash</h3>
                    <p className="stat-value">₹ {summary.totalCash.toLocaleString()}</p>
                    <span className="stat-change positive">In Hand</span>
                </div>
                <div className="stat-card">
                    <h3>Bank Balance</h3>
                    <p className="stat-value">₹ {summary.totalBank.toLocaleString()}</p>
                    <span className="stat-change">Across Accounts</span>
                </div>
                <div className="stat-card">
                    <h3>Net Profit (YTD)</h3>
                    <p className={`stat-value ${summary.netProfit >= 0 ? 'positive' : 'negative'}`}>
                        ₹ {summary.netProfit.toLocaleString()}
                    </p>
                    <span className="stat-change">Automated Posting</span>
                </div>
            </div>

            <div className="dashboard-grid mt-4">
                <div className="card">
                    <h3>Outstanding Overview</h3>
                    <div className="progress-list">
                        <div className="progress-item">
                            <span>Receivables</span>
                            <span className="num">₹ {summary.totalReceivables.toLocaleString()}</span>
                        </div>
                        <div className="progress-item">
                            <span>Payables</span>
                            <span className="num negative">₹ {summary.totalPayables.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3>Recent Automated Postings</h3>
                    <ul className="report-list">
                        <li><span>Sales Invoice #1024</span> <span className="positive">+₹ 12,000</span></li>
                        <li><span>Purchase Bill #SB-99</span> <span className="negative">-₹ 4,500</span></li>
                        <li><span>Salary Batch Feb 26</span> <span className="negative">-₹ 2,40,000</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default FinanceDashboard;
