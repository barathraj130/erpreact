import React from 'react';
import '../../pages/reports/Reports.css';

const FilterBar = ({ filters = [], values = {}, onChange, onApply, onReset }) => {
  return (
    <div className="report-filter-bar">
      {filters.map(f => (
        <div key={f.key} className="report-filter-field">
          <label className="report-filter-label">{f.label}</label>
          {f.type === 'date' ? (
            <input
              type="date"
              value={values[f.key] || ''}
              onChange={e => onChange && onChange({ ...values, [f.key]: e.target.value })}
              className="report-filter-input"
            />
          ) : f.type === 'select' ? (
            <select
              value={values[f.key] || ''}
              onChange={e => onChange && onChange({ ...values, [f.key]: e.target.value })}
              className="report-filter-input"
            >
              {(f.options || []).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={values[f.key] || ''}
              onChange={e => onChange && onChange({ ...values, [f.key]: e.target.value })}
              placeholder={f.placeholder || ''}
              className="report-filter-input"
            />
          )}
        </div>
      ))}
      <div className="report-filter-actions">
        {onReset && (
          <button onClick={onReset} className="report-filter-btn report-filter-btn-reset">Reset</button>
        )}
        {onApply && (
          <button onClick={onApply} className="report-filter-btn report-filter-btn-apply">Apply</button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
