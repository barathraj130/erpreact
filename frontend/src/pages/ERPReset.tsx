import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import {
  FaExclamationTriangle, FaTrash, FaCheckCircle,
  FaDatabase, FaRupeeSign, FaArrowRight, FaShieldAlt,
} from 'react-icons/fa';

const CONFIRM_PHRASE = 'RESET FLUXORA';

type Phase = 'idle' | 'confirm' | 'running' | 'opening' | 'done' | 'error';

const fmt = (n: number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const ERPReset: React.FC = () => {
  const [phase, setPhase]     = useState<Phase>('idle');
  const [typed, setTyped]     = useState('');
  const [message, setMessage] = useState('');

  // Opening balance form
  const [cashAmt,  setCashAmt]  = useState('');
  const [bankAmt,  setBankAmt]  = useState('');
  const [bankName, setBankName] = useState('ICICI Bank');
  const [balDate,  setBalDate]  = useState(new Date().toISOString().split('T')[0]);
  const [balSaving, setBalSaving] = useState(false);
  const [balDone,   setBalDone]   = useState(false);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    setPhase('running');
    try {
      const res  = await apiFetch('/reset/full', {
        method: 'POST',
        body: { confirm_text: CONFIRM_PHRASE },
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setPhase('opening'); // go to opening balance entry
      } else {
        setMessage(data.error || 'Reset failed');
        setPhase('error');
      }
    } catch {
      setMessage('Network error — reset may have partially completed.');
      setPhase('error');
    }
  };

  // ── Opening balance ────────────────────────────────────────────────────────
  const handleSaveBalance = async () => {
    const cash = Number(cashAmt) || 0;
    const bank = Number(bankAmt) || 0;
    if (cash <= 0 && bank <= 0) {
      setPhase('done');
      return;
    }
    setBalSaving(true);
    try {
      const res  = await apiFetch('/reset/opening-balance', {
        method: 'POST',
        body: { cash_amount: cash, bank_amount: bank, bank_name: bankName, date: balDate },
      });
      const data = await res.json();
      if (data.success) { setBalDone(true); setPhase('done'); }
      else { alert(data.error || 'Failed to save balance'); }
    } catch {
      alert('Network error saving balance');
    } finally { setBalSaving(false); }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    maxWidth: 580, margin: '48px auto', padding: '0 20px',
  };

  return (
    <div style={card}>

      {/* ══ HEADER ══ */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#fef2f2', border: '2px solid #fca5a5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <FaDatabase size={26} color="#dc2626" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>
          Market Launch Reset
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>
          Delete all test data · Keep settings · Start fresh for JBS Knit Wear
        </p>
      </div>

      {/* ══ IDLE ══ */}
      {phase === 'idle' && (
        <>
          {/* Backup reminder */}
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d',
            borderRadius: 10, padding: '14px 18px', marginBottom: 16,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <FaShieldAlt color="#d97706" size={18} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: '#92400e' }}>Backup first!</strong>
              <div style={{ color: '#78350f', marginTop: 3 }}>
                Run this in your terminal before proceeding:
              </div>
              <code style={{
                display: 'block', marginTop: 6, background: '#fef3c7',
                padding: '6px 10px', borderRadius: 6, fontSize: 12,
                color: '#451a03', fontFamily: 'monospace',
              }}>
                pg_dump $DATABASE_URL &gt; backup_{new Date().toISOString().slice(0,10)}.sql
              </code>
            </div>
          </div>

          {/* Will be deleted */}
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8, fontSize: 12, letterSpacing: 1 }}>
              WILL BE DELETED
            </div>
            {[
              'All invoices, payments & line items',
              'All purchase bills & items',
              'All customers, suppliers, employees, lenders, brokers',
              'All products & inventory (stock zeroed)',
              'All transactions, cash & bank ledger entries',
              'All loans, payroll runs, salary advances, attendance',
              'All chit funds, notifications',
              'Invoice number series (reseeded to 0)',
            ].map(t => (
              <div key={t} style={{ fontSize: 13, color: '#7f1d1d', display: 'flex', gap: 8, marginBottom: 3 }}>
                <span style={{ color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>✕</span> {t}
              </div>
            ))}
          </div>

          {/* Will be kept */}
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 8, fontSize: 12, letterSpacing: 1 }}>
              WILL BE KEPT
            </div>
            {[
              'Company profile (JBS Knit Wear)',
              'Admin & staff user accounts',
              'Branches (Main + ADOSS)',
              'Bill format settings & GST config',
              'Payment methods & QR codes',
              'Roles & permissions',
              'Chart of accounts',
            ].map(t => (
              <div key={t} style={{ fontSize: 13, color: '#14532d', display: 'flex', gap: 8, marginBottom: 3 }}>
                <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓</span> {t}
              </div>
            ))}
          </div>

          <button
            onClick={() => setPhase('confirm')}
            style={{
              width: '100%', padding: 14, background: '#dc2626', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <FaTrash /> Begin Market Launch Reset
          </button>
        </>
      )}

      {/* ══ CONFIRM ══ */}
      {phase === 'confirm' && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <FaExclamationTriangle size={32} color="#ea580c" />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#9a3412', margin: '10px 0 4px' }}>
              Final Confirmation
            </h2>
            <p style={{ fontSize: 13, color: '#9a3412', margin: 0 }}>
              This action is <strong>irreversible</strong>. All data will be permanently deleted.
            </p>
          </div>

          <p style={{ fontSize: 14, color: '#9a3412', fontWeight: 600, margin: '0 0 10px' }}>
            Type <code style={{ background: '#fed7aa', padding: '2px 8px', borderRadius: 4, letterSpacing: 2 }}>{CONFIRM_PHRASE}</code> to proceed:
          </p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value.toUpperCase())}
            placeholder={CONFIRM_PHRASE}
            autoFocus
            style={{
              width: '100%', padding: '12px 14px',
              border: `2px solid ${typed === CONFIRM_PHRASE ? '#16a34a' : '#fdba74'}`,
              borderRadius: 8, fontSize: 16, fontWeight: 700, letterSpacing: 2,
              boxSizing: 'border-box', marginBottom: 16,
              fontFamily: 'monospace', textAlign: 'center',
              background: typed === CONFIRM_PHRASE ? '#f0fdf4' : 'white',
              color: typed === CONFIRM_PHRASE ? '#15803d' : '#1c1917',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setPhase('idle'); setTyped(''); }}
              style={{
                flex: 1, padding: 12, border: '1px solid #d1d5db',
                borderRadius: 8, background: '#fff', cursor: 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              disabled={typed !== CONFIRM_PHRASE}
              onClick={handleReset}
              style={{
                flex: 2, padding: 12, borderRadius: 8, border: 'none',
                background: typed === CONFIRM_PHRASE ? '#dc2626' : '#fca5a5',
                color: '#fff',
                cursor: typed === CONFIRM_PHRASE ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: 14,
              }}
            >
              {typed === CONFIRM_PHRASE ? '🗑️ Confirm & Reset Now' : 'Type the phrase above'}
            </button>
          </div>
        </div>
      )}

      {/* ══ RUNNING ══ */}
      {phase === 'running' && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{
            width: 52, height: 52, border: '4px solid #dc2626',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>
            Wiping data…
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Do not close this tab. This takes a few seconds.</p>
        </div>
      )}

      {/* ══ OPENING BALANCE ══ */}
      {phase === 'opening' && (
        <div>
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 10, padding: '14px 18px', marginBottom: 20,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <FaCheckCircle size={20} color="#16a34a" />
            <span style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>
              ✅ Reset complete! Now enter your opening balances.
            </span>
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>
            <FaRupeeSign style={{ marginRight: 6 }} />
            Opening Balances
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>
            Enter the cash and bank amounts from your books as of today.
            These will appear in your ledger as "Opening Balance".
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                💵 Opening Cash Balance (₹)
              </label>
              <input
                type="number" min="0" value={cashAmt}
                onChange={e => setCashAmt(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #d1d5db', borderRadius: 8,
                  fontSize: 15, fontWeight: 600, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                🏦 Opening Bank Balance (₹)
              </label>
              <input
                type="number" min="0" value={bankAmt}
                onChange={e => setBankAmt(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #d1d5db', borderRadius: 8,
                  fontSize: 15, fontWeight: 600, boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {Number(bankAmt) > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                  Bank Name
                </label>
                <input
                  value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. ICICI Bank"
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1.5px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                  As of Date
                </label>
                <input
                  type="date" value={balDate} onChange={e => setBalDate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1.5px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {(Number(cashAmt) > 0 || Number(bankAmt) > 0) && (
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '12px 16px', marginBottom: 14,
              fontSize: 13,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#334155' }}>Preview:</div>
              {Number(cashAmt) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>💵 Cash Opening Balance</span>
                  <strong style={{ color: '#16a34a' }}>₹{fmt(Number(cashAmt))}</strong>
                </div>
              )}
              {Number(bankAmt) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🏦 Bank Opening Balance ({bankName})</span>
                  <strong style={{ color: '#2563eb' }}>₹{fmt(Number(bankAmt))}</strong>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setPhase('done')}
              style={{
                flex: 1, padding: 12, border: '1px solid #d1d5db',
                borderRadius: 8, background: '#fff', cursor: 'pointer',
                fontWeight: 600, fontSize: 14, color: '#6b7280',
              }}
            >
              Skip (enter later)
            </button>
            <button
              disabled={balSaving}
              onClick={handleSaveBalance}
              style={{
                flex: 2, padding: 12, borderRadius: 8, border: 'none',
                background: balSaving ? '#94a3b8' : '#2563eb', color: '#fff',
                cursor: balSaving ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {balSaving ? 'Saving…' : <><FaRupeeSign /> Save Opening Balances</>}
            </button>
          </div>
        </div>
      )}

      {/* ══ DONE ══ */}
      {phase === 'done' && (
        <div>
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 12, padding: '24px', textAlign: 'center', marginBottom: 24,
          }}>
            <FaCheckCircle size={40} color="#16a34a" style={{ marginBottom: 12 }} />
            <h2 style={{ color: '#15803d', fontSize: 20, margin: '0 0 8px', fontWeight: 800 }}>
              🚀 Ready for Market Launch!
            </h2>
            <p style={{ color: '#166534', fontSize: 14, margin: 0 }}>
              {balDone
                ? `Opening balances saved. All systems clean.`
                : `ERP data wiped. Opening balances can be entered via Finance → Receipts.`}
            </p>
          </div>

          {/* Next steps */}
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px', color: '#1e293b' }}>
            What to do next — in this order:
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { step: '1', label: 'Verify Company Profile', sub: 'Admin → Settings → Company', path: '/admin/settings' },
              { step: '2', label: 'Add Real Products', sub: 'Products → Add Product (with HSN codes)', path: '/products' },
              { step: '3', label: 'Add Suppliers', sub: 'Purchases → Suppliers → Add Supplier', path: '/suppliers' },
              { step: '4', label: 'Add Customers', sub: 'Sales → Customers → Add Customer', path: '/customers' },
              { step: '5', label: 'Add Employees', sub: 'HR → Employees → Add Employee', path: '/employees' },
              { step: '6', label: 'Add Lenders / Loans', sub: 'Finance → Lenders → Add Lender', path: '/finance/lenders' },
              { step: '7', label: 'Create First Invoice', sub: 'Invoices → New Invoice → INV-1 ✅', path: '/invoices/new' },
            ].map(({ step, label, sub, path }) => (
              <a
                key={step}
                href={path}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#2563eb', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, flexShrink: 0,
                }}>
                  {step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{sub}</div>
                </div>
                <FaArrowRight color="#94a3b8" size={12} />
              </a>
            ))}
          </div>

          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              width: '100%', marginTop: 20, padding: 14,
              background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            Go to Dashboard →
          </button>
        </div>
      )}

      {/* ══ ERROR ══ */}
      {phase === 'error' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 20 }}>
          <p style={{ color: '#dc2626', fontWeight: 700, marginTop: 0 }}>Reset Error</p>
          <p style={{ color: '#7f1d1d', fontSize: 13 }}>{message}</p>
          <button
            onClick={() => { setPhase('idle'); setTyped(''); }}
            style={{
              padding: '9px 20px', border: '1px solid #fca5a5',
              borderRadius: 7, background: '#fff', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      )}

    </div>
  );
};

export default ERPReset;
