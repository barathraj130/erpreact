import React from 'react';

const downloadCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] === null || row[h] === undefined ? '' : row[h];
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (filename || 'report') + '.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const printReport = () => {
  window.print();
};

const ExportButtons = ({ data = [], filename = 'report' }) => {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={() => downloadCSV(data, filename)}
        disabled={!data || data.length === 0}
        style={{
          padding: '7px 14px',
          border: '1px solid #10b981',
          borderRadius: '7px',
          background: 'white',
          color: '#10b981',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          opacity: (!data || data.length === 0) ? 0.5 : 1,
        }}
      >
        Export CSV
      </button>
      <button
        onClick={printReport}
        style={{
          padding: '7px 14px',
          border: '1px solid #6366f1',
          borderRadius: '7px',
          background: 'white',
          color: '#6366f1',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        Print / PDF
      </button>
    </div>
  );
};

export default ExportButtons;
