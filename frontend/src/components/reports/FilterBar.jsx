import React from 'react';

const FilterBar = ({ filters = [], values = {}, onChange, onApply, onReset }) => {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '16px 20px',
      marginBottom: '20px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'flex-end',
    }}>
      {filters.map(f => (
        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>{f.label}</label>
          {f.type === 'date' ? (
            <input
              type="date"
              value={values[f.key] || ''}
              onChange={e => onChange && onChange({ ...values, [f.key]: e.target.value })}
              style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', color: '#374151' }}
            />
          ) : f.type === 'select' ? (
            <select
              value={values[f.key] || ''}
              onChange={e => onChange && onChange({ ...values, [f.key]: e.target.value })}
              style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', color: '#374151' }}
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
              style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', color: '#374151' }}
            />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
        {onReset && (
          <button
            onClick={onReset}
            style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: '7px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}
          >
            Reset
          </button>
        )}
        {onApply && (
          <button
            onClick={onApply}
            style={{ padding: '7px 16px', border: 'none', borderRadius: '7px', background: '#6366f1', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
