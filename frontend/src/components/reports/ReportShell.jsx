import React from 'react';
import { Link } from 'react-router-dom';

const ReportShell = ({ title, subtitle, breadcrumb = [], children }) => {
  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: 'var(--erp-bg, #f8fafc)' }}>
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <nav style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
          {breadcrumb.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ color: '#d1d5db' }}>›</span>}
              {item.path ? (
                <Link to={item.path} style={{ color: '#6366f1', textDecoration: 'none' }}>{item.label}</Link>
              ) : (
                <span style={{ color: '#374151', fontWeight: idx === breadcrumb.length - 1 ? 500 : 400 }}>{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{subtitle}</p>}
      </div>

      {children}
    </div>
  );
};

export default ReportShell;
