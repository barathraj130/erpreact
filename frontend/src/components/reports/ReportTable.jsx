import React, { useState, useMemo } from 'react';

const PAGE_SIZE = 50;

const LoadingState = () => (
  <div style={{ padding: '48px 0', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
    <div style={{
      width: 28, height: 28, border: '3px solid #e5e7eb',
      borderTop: '3px solid #6366f1', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', margin: '0 auto 10px'
    }} />
    Loading report data...
  </div>
);

const EmptyState = ({ message }) => (
  <div style={{ padding: '56px 0', textAlign: 'center', color: '#9ca3af' }}>
    <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
    <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>No Data Found</div>
    <div style={{ fontSize: 13 }}>{message || 'No records for selected period'}</div>
  </div>
);

const ReportTable = ({ columns = [], data = [], loading = false, summary, emptyText }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const an = parseFloat(av), bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
      return sortDir === 'asc'
        ? String(av || '').localeCompare(String(bv || ''))
        : String(bv || '').localeCompare(String(av || ''));
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <LoadingState />;
  if (!data || data.length === 0) return <EmptyState message={emptyText} />;

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: Math.max(560, columns.length * 120), borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            {columns.map((col, i) => (
              <col key={i} style={{ width: col.width || 'auto', minWidth: col.type === 'amount' ? 130 : col.minWidth || undefined }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {columns.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} style={{
                  padding: '10px 14px', textAlign: col.align || 'left',
                  fontWeight: 600, fontSize: 11, color: '#374151',
                  cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  {col.label}
                  {sortKey === col.key && <span style={{ marginLeft: 4, color: '#6366f1' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6', background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                {columns.map(col => {
                  const val = row[col.key];
                  const cellColor = col.colorFn ? col.colorFn(val, row) : '#374151';
                  const content = col.render ? col.render(val, row) : (val ?? '—');
                  return (
                    <td key={col.key} style={{
                      padding: '10px 14px', textAlign: col.align || 'left',
                      color: cellColor, fontWeight: col.bold ? 600 : 400,
                      whiteSpace: (col.wrap || col.type === 'text') ? 'normal' : 'nowrap',
                      fontVariantNumeric: col.type === 'amount' ? 'tabular-nums' : undefined,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {content}
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
                  <td key={col.key} style={{
                    padding: '10px 14px', textAlign: col.align || 'left',
                    fontWeight: 700, fontSize: 13, color: '#111827',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: col.type === 'amount' ? 'tabular-nums' : undefined,
                  }}>
                    {summary[col.key] !== undefined ? summary[col.key] : (i === 0 ? 'TOTAL' : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontSize: 12 }}>Prev</button>
            <span style={{ padding: '4px 8px', fontSize: 12, color: '#374151' }}>{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, fontSize: 12 }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportTable;
