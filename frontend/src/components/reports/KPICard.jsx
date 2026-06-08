import React from 'react';

const KPICard = ({ label, value, subtext, trend = null, prefix = '', color = '#6366f1', suffix = '' }) => {
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';
  const trendArrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '';

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>
        {prefix}{value}{suffix}
      </p>
      {(subtext || trend) && (
        <p style={{ fontSize: '12px', color: trendColor, margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trendArrow && <span>{trendArrow}</span>}
          {subtext}
        </p>
      )}
    </div>
  );
};

export default KPICard;
