import React from 'react';

const formatINRShort = (amount) => {
  const num = parseFloat(amount || 0);
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  if (num >= 100000)   return '₹' + (num / 100000).toFixed(2) + ' L';
  if (num >= 1000)     return '₹' + (num / 1000).toFixed(1) + 'K';
  return '₹' + num.toLocaleString('en-IN');
};

const KPICard = ({ label, value, subtext, trend, color = 'blue', prefix = '₹', isAmount = true }) => {
  const colorMap = {
    blue:    { border: '#3b82f6', text: '#1d4ed8' },
    green:   { border: '#10b981', text: '#065f46' },
    red:     { border: '#ef4444', text: '#dc2626' },
    amber:   { border: '#f59e0b', text: '#92400e' },
    purple:  { border: '#8b5cf6', text: '#6d28d9' },
    gray:    { border: '#9ca3af', text: '#374151' },
    indigo:  { border: '#6366f1', text: '#4338ca' },
    // legacy hex color support (from old code that passed color as hex string)
    '#10b981': { border: '#10b981', text: '#065f46' },
    '#ef4444': { border: '#ef4444', text: '#dc2626' },
    '#6366f1': { border: '#6366f1', text: '#4338ca' },
    '#f59e0b': { border: '#f59e0b', text: '#92400e' },
    '#8b5cf6': { border: '#8b5cf6', text: '#6d28d9' },
    '#0ea5e9': { border: '#0ea5e9', text: '#0369a1' },
    '#7c3aed': { border: '#7c3aed', text: '#5b21b6' },
    '#3b82f6': { border: '#3b82f6', text: '#1d4ed8' },
  };
  const c = colorMap[color] || colorMap.blue;

  // Determine display value
  let displayValue;
  let fullValue;
  const numericValue = parseFloat(value || 0);

  if (isAmount && !isNaN(numericValue) && typeof value === 'number') {
    // value is a raw number — format with L/K/Cr
    displayValue = formatINRShort(numericValue);
    fullValue = '₹' + numericValue.toLocaleString('en-IN');
  } else {
    // value is already a string (pre-formatted) or non-amount — show as-is
    displayValue = value;
    fullValue = undefined;
  }

  // Handle trend: support both numeric (%) and string ('up'/'down')
  let trendNode = null;
  if (trend !== undefined && trend !== null) {
    if (typeof trend === 'number') {
      const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#9ca3af';
      trendNode = (
        <div style={{ fontSize: 12, marginTop: 4, fontWeight: 500, color: trendColor }}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '●'} {Math.abs(trend).toFixed(1)}%
        </div>
      );
    } else if (trend === 'up' || trend === 'down') {
      const trendColor = trend === 'up' ? '#10b981' : '#ef4444';
      const trendArrow = trend === 'up' ? '▲' : '▼';
      trendNode = (
        <div style={{ fontSize: 12, marginTop: 4, fontWeight: 500, color: trendColor }}>
          {trendArrow} {subtext || ''}
        </div>
      );
    }
  }

  return (
    <div title={fullValue} style={{
      background: 'white', border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${c.border}`,
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
        {displayValue}
      </div>
      {subtext && typeof trend !== 'string' && <div style={{ fontSize: 12, color: '#6b7280' }}>{subtext}</div>}
      {trendNode}
    </div>
  );
};

export default KPICard;
