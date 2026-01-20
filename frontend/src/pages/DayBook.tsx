// frontend/src/pages/DayBook.tsx

import React, { useState } from 'react';
// import { fetchTransactions } from '../api/transactionApi'; // To be used

const DayBook: React.FC = () => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [transactions, setTransactions] = useState<any[]>([]); // Placeholder for transaction data
    const [loading, setLoading] = useState(false);

    const loadDayBook = async (selectedDate: string) => {
        setLoading(true);
        // NOTE: Replace with actual API call to fetch daily transactions, debits, and credits
        // const data = await fetchTransactions({ startDate: selectedDate, endDate: selectedDate });
        
        // Mock Data for Day Book
        const mockData = [
            { id: 101, time: '09:30', particular: 'Sales Invoice #123 (R. Kumar)', type: 'Debit', amount: 5500.00 },
            { id: 102, time: '11:00', particular: 'Receipt from R. Kumar', type: 'Credit', amount: 3000.00 },
            { id: 103, time: '14:45', particular: 'Petty Cash Expense: Tea & Snacks', type: 'Debit', amount: 150.00 },
        ];
        
        setTransactions(mockData);
        setLoading(false);
    };

    React.useEffect(() => {
        loadDayBook(date);
    }, [date]);

    const totalDebit = transactions.reduce((sum, t) => sum + (t.type === 'Debit' ? t.amount : 0), 0);
    const totalCredit = transactions.reduce((sum, t) => sum + (t.type === 'Credit' ? t.amount : 0), 0);

    return (
        <section id="dayBookSection" className="app-section">
            <div className="section-header">
                <h2>Day Book (Daily Transactions)</h2>
                <div>
                    <label htmlFor="dayBookDate">Select Date:</label>
                    <input 
                        type="date" 
                        id="dayBookDate" 
                        className="form-control" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{width: 'auto'}}
                    />
                </div>
            </div>
            
            {loading && <p>Loading Day Book for {date}...</p>}

            {!loading && (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Particulars</th>
                                <th className="num">Debit (Dr) (₹)</th>
                                <th className="num">Credit (Cr) (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={2} style={{fontWeight: 'bold'}}>Opening Balance (Cash)</td>
                                <td className="num" style={{fontWeight: 'bold'}}>5000.00</td>
                                <td></td>
                            </tr>
                            {transactions.map(t => (
                                <tr key={t.id}>
                                    <td>{t.time}</td>
                                    <td>{t.particular}</td>
                                    <td className="num">{t.type === 'Debit' ? t.amount.toFixed(2) : ''}</td>
                                    <td className="num">{t.type === 'Credit' ? t.amount.toFixed(2) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={2} style={{fontWeight: 'bold'}}>Total Transactions</td>
                                <td className="num total-row">{totalDebit.toFixed(2)}</td>
                                <td className="num total-row">{totalCredit.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{fontWeight: 'bold'}}>Closing Balance (Cash)</td>
                                <td className="num" colSpan={2} style={{fontWeight: 'bold', textAlign: 'center'}}>{(5000 + totalCredit - totalDebit).toFixed(2)} Dr</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
};

export default DayBook;