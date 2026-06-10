import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { FaFileInvoice, FaArrowLeft, FaPrint, FaFileExcel, FaFilePdf, FaWhatsapp, FaTrash } from 'react-icons/fa';
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<'idle'|'sent'|'error'>('idle');
  const [waMsg, setWaMsg] = useState('');

  useEffect(() => {
    fetchLedger();
  }, [id, type]);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const res = await apiFetch(`/ledgers/party/${type}/${id}/pdf`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${type}_Ledger_${data?.party_name || id}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (e: any) { alert('PDF download failed: ' + e.message); }
    finally { setPdfLoading(false); }
  };

  const handleSendWhatsApp = async () => {
    setWaLoading(true); setWaStatus('idle'); setWaMsg('');
    try {
      const res  = await apiFetch(`/ledgers/party/${type}/${id}/send-whatsapp`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setWaStatus('sent'); setWaMsg(json.message || 'Sent!');
        setTimeout(() => setWaStatus('idle'), 5000);
      } else {
        setWaStatus('error'); setWaMsg(json.error || 'Failed to send');
      }
    } catch (e: any) { setWaStatus('error'); setWaMsg('Network error'); }
    finally { setWaLoading(false); }
  };

  const handleDeleteEntry = async (entryId: number, desc: string) => {
    if (!window.confirm(`Delete "${desc}" entry? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/ledgers/party/entry/${entryId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Failed to delete entry'); return; }
      fetchLedger();
    } catch {
      alert('Failed to delete entry');
    }
  };

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
        <div className="header-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="action-btn secondary"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: pdfLoading ? 0.7 : 1 }}
          >
            <FaFilePdf /> {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={waLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: waStatus === 'sent' ? '#16a34a' : '#25D366',
              color: '#fff', border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontWeight: 600, cursor: waLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px', opacity: waLoading ? 0.7 : 1
            }}
          >
            <FaWhatsapp /> {waLoading ? 'Sending...' : waStatus === 'sent' ? '✅ Sent!' : '📱 Send Ledger'}
          </button>
        </div>
      </div>

      {waStatus !== 'idle' && (
        <div style={{
          margin: '0 0 12px 0', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          background: waStatus === 'sent' ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${waStatus === 'sent' ? '#bbf7d0' : '#fecdd3'}`,
          color: waStatus === 'sent' ? '#15803d' : '#ef4444'
        }}>
          {waStatus === 'sent' ? '✅ ' : '❌ '}{waMsg}
        </div>
      )}

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 ? (
              <tr><td colSpan={7} className="text-center">No transactions found</td></tr>
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
                  <td style={{ textAlign: 'center', width: '36px', padding: '4px 8px' }}>
                    <button
                      onClick={() => handleDeleteEntry(row.id, row.tx_desc || row.reference_type)}
                      title="Delete entry"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '4px', borderRadius: '4px', lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                    >
                      <FaTrash size={12} />
                    </button>
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
