import React, { useState, useEffect } from 'react';
import { financeApi } from './financeApi';
import './Finance.css';

const FinancialReports: React.FC = () => {
    const [trialBalance, setTrialBalance] = useState<any>(null);
    const [pnL, setPnL] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const companyId = 1;

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const [tb, pl] = await Promise.all([
                    financeApi.getTrialBalance(companyId),
                    financeApi.getProfitLoss(companyId, '2020-01-01', new Date().toISOString().split('T')[0])
                ]);
                setTrialBalance(tb.data);
                setPnL(pl.data);
            } catch (err) {
                console.error("Error fetching reports", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [companyId]);

    if (loading) return <div className="loading">Generating Automated Financial Reports...</div>;

    return (
        <div className="finance-container">
            <div className="finance-header">
                <h1>Automated Financial Reports</h1>
                <div className="report-controls">
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="fas fa-print"></i> Print Reports
                    </button>
                </div>
            </div>

            <div className="report-grid">
                {/* Profit & Loss Statement */}
                <div className="report-card card">
                    <h2>Profit & Loss Statement (Real-time)</h2>
                    <div className="report-section">
                        <h3>Incomes</h3>
                        <ul className="report-list">
                            {pnL?.income?.map((item: any, i: number) => (
                                <li key={i}><span>{item.name}</span> <span>₹ {item.amount.toLocaleString()}</span></li>
                            ))}
                        </ul>
                        <div className="report-total">Total Income: ₹ {pnL?.total_income?.toLocaleString()}</div>
                    </div>
                    <div className="report-section mt-4">
                        <h3>Expenses</h3>
                        <ul className="report-list">
                            {pnL?.expenses?.map((item: any, i: number) => (
                                <li key={i}><span>{item.name}</span> <span className="negative">₹ {item.amount.toLocaleString()}</span></li>
                            ))}
                        </ul>
                        <div className="report-total">Total Expense: ₹ {pnL?.total_expense?.toLocaleString()}</div>
                    </div>
                    <div className="net-profit mt-4">
                        <h3>Net Profit: <span className={pnL?.net_profit >= 0 ? 'positive' : 'negative'}>₹ {pnL?.net_profit?.toLocaleString()}</span></h3>
                    </div>
                </div>

                {/* Trial Balance */}
                <div className="report-card card">
                    <h2>Trial Balance</h2>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th className="num">Debit (₹)</th>
                                <th className="num">Credit (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trialBalance?.data?.map((item: any, i: number) => (
                                <tr key={i}>
                                    <td>{item.name}</td>
                                    <td className="num">{item.debit > 0 ? item.debit.toLocaleString() : '-'}</td>
                                    <td className="num">{item.credit > 0 ? item.credit.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="total-row">
                                <td>TOTAL</td>
                                <td className="num">{trialBalance?.total_debit?.toLocaleString()}</td>
                                <td className="num">{trialBalance?.total_credit?.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinancialReports;
