import React, { useState, useMemo } from 'react';

const PAGE_SIZE = 25;

const ReportTable = ({ columns = [], data = [], loading = false, emptyText = 'No data available' }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
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

  const formatCell = (col, row) => {
    const val = row[col.key];
    if (val === null || val === undefined) return '-';
    if (col.type === 'amount') {
      return '₹' + Number(val).toLocaleString('en-IN');
    }
    if (col.type === 'date') {
      try { return new Date(val).toLocaleDateString('en-IN'); } catch { return val; }
    }
    if (col.type === 'pct') {
      return Number(val).toFixed(1) + '%';
    }
    return String(val);
  };

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      ) : paged.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>{emptyText}</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '10px 16px',
                        textAlign: col.align || 'left',
                        fontWeight: 600,
                        color: '#374151',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span style={{ marginLeft: '4px', color: '#6366f1' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6', background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                    {columns.map(col => (
                      <td
                        key={col.key}
                        style={{
                          padding: '10px 16px',
                          color: '#374151',
                          textAlign: col.align || 'left',
                          whiteSpace: col.type === 'amount' || col.align === 'right' ? 'nowrap' : undefined,
                          fontWeight: col.type === 'amount' ? 500 : undefined,
                          fontVariantNumeric: col.type === 'amount' ? 'tabular-nums' : undefined,
                        }}
                      >
                        {col.render ? col.render(row) : formatCell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                >
                  Prev
                </button>
                <span style={{ padding: '4px 8px', fontSize: '13px', color: '#374151' }}>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportTable;
