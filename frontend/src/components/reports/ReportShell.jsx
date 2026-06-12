import React from 'react';
import { Link } from 'react-router-dom';
import '../../pages/reports/Reports.css';

const ReportShell = ({ title, subtitle, breadcrumb = [], children }) => {
  return (
    <div className="report-shell">
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <nav className="report-breadcrumb">
          {breadcrumb.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="report-breadcrumb-sep">›</span>}
              {item.path ? (
                <Link to={item.path} className="report-breadcrumb-link">{item.label}</Link>
              ) : (
                <span className="report-breadcrumb-current">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header */}
      <div className="report-shell-header">
        <h1 className="report-shell-title">{title}</h1>
        {subtitle && <p className="report-shell-subtitle">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
};

export default ReportShell;
