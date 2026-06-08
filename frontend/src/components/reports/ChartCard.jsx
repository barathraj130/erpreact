import React from 'react';
import { ResponsiveContainer } from 'recharts';

const ChartCard = ({ title, children, height = 300 }) => {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      {title && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
          fontWeight: 600,
          fontSize: '14px',
          color: '#374151',
        }}>
          {title}
        </div>
      )}
      <div style={{ padding: '16px 8px', height }}>
        {React.Children.map(children, child => {
          if (!child) return null;
          // Wrap in ResponsiveContainer if not already wrapped
          if (child.type === ResponsiveContainer) return child;
          return (
            <ResponsiveContainer width="100%" height="100%">
              {child}
            </ResponsiveContainer>
          );
        })}
      </div>
    </div>
  );
};

export default ChartCard;
