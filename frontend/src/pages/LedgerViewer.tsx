import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FaFileInvoice, FaArrowLeft, FaPrint, FaFileExcel } from 'react-icons/fa';
import './LedgerViewer.css';

interface LedgerEntry {
  id: number;
  entry_date: string;
  tx_desc: string;
  reference_type: string;
  reference_id: number;
  debit: number;
  credit: number;
  running_balance: number;
}

const LedgerViewer: React.FC<{ type: 'supplier' | 'customer' | 'lender' | 'employee' | 'broker' }> = ({ type }) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLedger();
  }, [id, type]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const endpoint = type === 'supplier' ? `/ledgers/supplier/${id}` : `/ledgers/party/${type}/${id}`;
      const res = await apiFetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        // Normalise supplier endpoint shape { supplier, summary, transactions }
        // to the generic shape { party_name, summary, transactions }
        if (type === 'supplier' && json.supplier) {
          setData({
            party_name: json.supplier.name,
            account_name: `Supplier #${json.supplier.id}`,
            summary: {
              opening_balance: json.summary.opening_balance,
              total_debit: json.summary.total_paid,
              total_credit: json.summary.total_billed,
              balance: json.summary.pending_amount,
            },
            transactions: json.transactions.map((t: any) => ({
              ...t,
              entry_date: t.date || t.created_at,
              tx_desc: t.description || t.reference || t.type,
            })),
          });
        } else {
          setData(json);
        }
      } else {
        setError('Failed to load ledger data');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="ledger-loader">Loading Ledger...</div>;
  if (error) return <div className="ledger-error">{error}</div>;
  if (!data) return <div className="ledger-empty">No data found</div>;

  return (
    <div className="ledger-container">
      <div className="ledger-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => window.history.back()}><FaArrowLeft /></button>
          <div>
            <h1>{data.party_name}</h1>
            <p className="subtitle">{type.toUpperCase()} LEDGER | {data.account_name}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="action-btn secondary"><FaPrint /> Print</button>
          <button className="action-btn primary"><FaFileExcel /> Export</button>
        </div>
      </div>

      <div className="ledger-summary-cards">
        <div className="summary-card">
          <span className="label">Opening Balance</span>
          <span className="value">₹{data.summary.opening_balance.toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total Debits</span>
          <span className="value debit">₹{data.summary.total_debit.toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total Credits</span>
          <span className="value credit">₹{data.summary.total_credit.toLocaleString()}</span>
        </div>
        <div className="summary-card closing">
          <span className="label">Closing Balance</span>
          <span className={`value ${data.summary.balance <= 0 ? 'credit' : 'debit'}`}>
            ₹{Math.abs(data.summary.balance).toLocaleString()}
            {data.summary.balance < 0
              ? <span style={{ marginLeft: '6px', fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>ADVANCE</span>
              : data.summary.balance > 0
              ? <span style={{ marginLeft: '6px', fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>OUTSTANDING</span>
              : <span style={{ marginLeft: '6px', fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>SETTLED</span>
            }
          </span>
        </div>
      </div>

      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th>Ref Type</th>
              <th>Debit (DR)</th>
              <th>Credit (CR)</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 ? (
              <tr><td colSpan={6} className="text-center">No transactions found</td></tr>
            ) : (
              data.transactions.map((row: LedgerEntry) => (
                <tr key={row.id}>
                  <td>{new Date(row.entry_date).toLocaleDateString('en-IN')}</td>
                  <td className="particulars">
                    {row.tx_desc}
                    {row.reference_id && <span className="ref-tag">#{row.reference_id}</span>}
                  </td>
                  <td><span className="badge">{row.reference_type}</span></td>
                  <td className="amount debit">{row.debit > 0 ? `₹${parseFloat(row.debit.toString()).toLocaleString()}` : '-'}</td>
                  <td className="amount credit">{row.credit > 0 ? `₹${parseFloat(row.credit.toString()).toLocaleString()}` : '-'}</td>
                  <td className={`amount balance ${row.running_balance >= 0 ? 'pos' : 'neg'}`}>
                    ₹{Math.abs(row.running_balance).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LedgerViewer;
