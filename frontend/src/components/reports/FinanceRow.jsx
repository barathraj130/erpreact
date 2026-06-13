import React from 'react';
import { formatINRShort as fmtShort } from '../../utils/reportHelpers';

const fmt = (amount) => {
  const n = parseFloat(amount || 0);
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
};

export const FinanceRow = ({
  label, amount, indent = false, isTotal = false, isGrandTotal = false,
  color, subtext, showSign = false,
}) => {
  const num = parseFloat(amount || 0);
  const amountColor = color
    ? color
    : isTotal || isGrandTotal
      ? (num >= 0 ? '#16a34a' : '#dc2626')
      : '#374151';
  const bg = isGrandTotal ? '#f0f9ff' : isTotal ? '#f8fafc' : 'transparent';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: isGrandTotal ? '13px 16px' : isTotal ? '10px 16px' : '9px 16px',
      paddingLeft: indent ? 32 : 16,
      borderBottom: '0.5px solid #f1f5f9',
      background: bg,
      gap: 12, minWidth: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isGrandTotal ? 14 : isTotal ? 13 : 13,
          fontWeight: isGrandTotal ? 700 : isTotal ? 600 : 400,
          color: isGrandTotal || isTotal ? '#1e293b' : '#6b7280',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
        {subtext && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtext}</div>
        )}
      </div>
      <div style={{
        flexShrink: 0, whiteSpace: 'nowrap',
        fontSize: isGrandTotal ? 15 : isTotal ? 14 : 13,
        fontWeight: isGrandTotal ? 700 : isTotal ? 600 : 500,
        color: amountColor,
        textAlign: 'right', minWidth: 120,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {showSign && num > 0 ? '+' : ''}
        {showSign && num < 0 ? '−' : ''}
        {fmt(num)}
      </div>
    </div>
  );
};

export const SectionHeader = ({ title, color = '#6366f1' }) => (
  <div style={{
    padding: '9px 16px', borderBottom: '0.5px solid #e5e7eb',
    borderLeft: `4px solid ${color}`, background: '#f8fafc',
    display: 'flex', alignItems: 'center',
  }}>
    <span style={{
      fontSize: 11, fontWeight: 600, color: '#374151',
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {title}
    </span>
  </div>
);

export const SectionGap = () => (
  <div style={{ height: 8, background: '#f1f5f9' }} />
);

export const ReportCard = ({ children, style }) => (
  <div style={{
    border: '1px solid #e5e7eb', borderRadius: 10,
    overflow: 'clip', background: '#fff', ...style,
  }}>
    {children}
  </div>
);

export const TwoCol = ({ children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16, marginBottom: 20,
  }}>
    {children}
  </div>
);

export const KPIGrid = ({ cards }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 10, marginBottom: 20,
  }}>
    {cards.map((card, i) => {
      const n = parseFloat(card.value || 0);
      const display = card.isPercent
        ? (n.toFixed(1) + '%')
        : card.isRatio
          ? n.toFixed(2)
          : fmtShort(n);
      return (
        <div
          key={i}
          title={card.isPercent || card.isRatio ? String(n) : '₹' + n.toLocaleString('en-IN')}
          style={{
            background: '#fff',
            border: `0.5px solid ${card.border || '#e5e7eb'}`,
            borderRadius: 8, padding: '12px 14px',
            borderTop: `3px solid ${card.color || '#6366f1'}`,
            minWidth: 0,
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 500, color: '#6b7280',
            letterSpacing: '0.04em', marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {(card.label || '').toUpperCase()}
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: card.color || '#1e293b',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {display}
          </div>
          {card.subtext && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{card.subtext}</div>
          )}
        </div>
      );
    })}
  </div>
);
