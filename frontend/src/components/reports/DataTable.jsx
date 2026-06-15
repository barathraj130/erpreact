import React from 'react';

const fmt = (amount) => {
  const n = parseFloat(amount || 0);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
};

const DataTable = ({ columns = [], data = [], loading = false, summary, emptyText }) => {
  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
      <div style={{
        width: 28, height: 28, border: '3px solid #e5e7eb',
        borderTop: '3px solid #6366f1', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', margin: '0 auto 10px',
      }} />
      Loading...
    </div>
  );

  if (!data || !data.length) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
      {emptyText || 'No data for selected period'}
    </div>
  );

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          tableLayout: 'auto',
          minWidth: Math.max(500, columns.length * 110),
        }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {columns.map((col, i) => (
                <th key={i} style={{
                  padding: '10px 14px',
                  textAlign: col.align || 'left',
                  fontSize: 11, fontWeight: 600, color: '#374151',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  minWidth: col.minWidth || (col.type === 'amount' ? 130 : undefined),
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri} style={{
                borderBottom: '0.5px solid #f3f4f6',
                background: ri % 2 === 0 ? '#fff' : '#fafafa',
              }}>
                {columns.map((col, ci) => {
                  const val = row[col.key];
                  let displayVal;
                  if (col.render) {
                    displayVal = col.render(val, row);
                  } else if (col.type === 'amount') {
                    displayVal = fmt(val);
                  } else if (col.type === 'pct') {
                    displayVal = parseFloat(val || 0).toFixed(1) + '%';
                  } else if (col.type === 'date') {
                    displayVal = val ? new Date(val).toLocaleDateString('en-IN') : '—';
                  } else if (col.type === 'number') {
                    displayVal = parseFloat(val || 0).toLocaleString('en-IN');
                  } else {
                    displayVal = val ?? '—';
                  }

                  const cellColor = col.colorFn
                    ? col.colorFn(val, row)
                    : col.type === 'amount' && parseFloat(val || 0) < 0
                      ? '#dc2626'
                      : '#374151';

                  return (
                    <td key={ci} style={{
                      padding: '10px 14px',
                      textAlign: col.align || 'left',
                      fontSize: 13,
                      fontWeight: col.bold ? 600 : 400,
                      color: cellColor,
                      whiteSpace: col.wrap ? 'normal' : 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: col.wrap ? 220 : undefined,
                      fontVariantNumeric: col.type === 'amount' ? 'tabular-nums' : undefined,
                    }}>
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {summary && (
            <tfoot>
              <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                {columns.map((col, i) => (
                  <td key={i} style={{
                    padding: '11px 14px',
                    textAlign: col.align || 'left',
                    fontWeight: 700, fontSize: 13, color: '#111827',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: col.type === 'amount' ? 'tabular-nums' : undefined,
                  }}>
                    {summary[col.key] !== undefined
                      ? (col.type === 'amount' ? fmt(summary[col.key]) : summary[col.key])
                      : (i === 0 ? 'TOTAL' : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default DataTable;
