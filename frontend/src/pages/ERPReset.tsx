import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { FaExclamationTriangle, FaTrash, FaCheckCircle } from 'react-icons/fa';

const CONFIRM_PHRASE = 'RESET ERP';

const ERPReset: React.FC = () => {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'running' | 'done' | 'error'>('idle');
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState('');

  const handleReset = async () => {
    setPhase('running');
    try {
      const res = await apiFetch('/reset/full', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setPhase('done');
      } else {
        setMessage(data.error || 'Reset failed');
        setPhase('error');
      }
    } catch (err) {
      setMessage('Network error — reset may have partially completed.');
      setPhase('error');
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#fef2f2', border: '2px solid #fca5a5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <FaExclamationTriangle size={28} color="#dc2626" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>Reset ERP Data</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>
          Wipe all test data and start fresh with real entries.
        </p>
      </div>

      {/* What gets deleted */}
      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 10, fontSize: 13 }}>WILL BE DELETED</div>
        {[
          'All invoices, payments & line items',
          'All purchase bills',
          'All customers',
          'All products & inventory (stock reset)',
          'All suppliers, employees, brokers, lenders',
          'All transactions & ledger entries',
          'All loans, payroll, attendance records',
          'All cash / bank ledger entries',
          'All chit funds & notifications',
        ].map(item => (
          <div key={item} style={{ fontSize: 13, color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>✕</span> {item}
          </div>
        ))}
      </div>

      {/* What gets kept */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
        <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: 10, fontSize: 13 }}>WILL BE KEPT</div>
        {[
          'Company profile & settings',
          'Admin & staff user accounts',
          'Branches & bill format settings',
          'Roles & permissions',
          'Chart of accounts & ledger structure',
          'Payment methods & QR codes',
        ].map(item => (
          <div key={item} style={{ fontSize: 13, color: '#14532d', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> {item}
          </div>
        ))}
      </div>

      {phase === 'idle' && (
        <button
          onClick={() => setPhase('confirm')}
          style={{
            width: '100%', padding: '13px', background: '#dc2626', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer'
          }}
        >
          <FaTrash style={{ marginRight: 8 }} /> Begin Reset
        </button>
      )}

      {phase === 'confirm' && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 14, color: '#9a3412', fontWeight: 600, margin: '0 0 12px' }}>
            Type <strong>{CONFIRM_PHRASE}</strong> to confirm this irreversible action:
          </p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            style={{
              width: '100%', padding: '10px 12px', border: '1.5px solid #fdba74',
              borderRadius: 6, fontSize: 15, fontWeight: 600, letterSpacing: 1,
              boxSizing: 'border-box', marginBottom: 14, fontFamily: 'monospace'
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setPhase('idle'); setTyped(''); }}
              style={{
                flex: 1, padding: 11, border: '1px solid #d1d5db', borderRadius: 7,
                background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14
              }}
            >
              Cancel
            </button>
            <button
              disabled={typed !== CONFIRM_PHRASE}
              onClick={handleReset}
              style={{
                flex: 1, padding: 11, borderRadius: 7, border: 'none',
                background: typed === CONFIRM_PHRASE ? '#dc2626' : '#fca5a5',
                color: '#fff', cursor: typed === CONFIRM_PHRASE ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: 14
              }}
            >
              Confirm Reset
            </button>
          </div>
        </div>
      )}

      {phase === 'running' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{
            width: 48, height: 48, border: '4px solid #dc2626', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Clearing all data… do not close this tab.</p>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <FaCheckCircle size={36} color="#16a34a" style={{ marginBottom: 12 }} />
          <h2 style={{ color: '#15803d', fontSize: 18, margin: '0 0 8px' }}>Reset Complete</h2>
          <p style={{ color: '#166534', fontSize: 14, margin: '0 0 20px' }}>{message}</p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              padding: '10px 28px', background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 14, cursor: 'pointer'
            }}
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 20 }}>
          <p style={{ color: '#dc2626', fontWeight: 600, marginTop: 0 }}>Reset Error</p>
          <p style={{ color: '#7f1d1d', fontSize: 13 }}>{message}</p>
          <button onClick={() => setPhase('idle')} style={{ padding: '8px 18px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default ERPReset;
