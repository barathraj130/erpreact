const exportCSV = (filename, columns, data, summaryRow = null) => {
  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(c => {
      if (c.csvFormat) return c.csvFormat(row[c.key], row);
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') return val.toFixed(2);
      return String(val);
    })
  );

  if (summaryRow) {
    rows.push([]);
    rows.push(columns.map(c => summaryRow[c.key] ?? ''));
  }

  const csvLines = [
    [`"JBS Knit Wear — ${filename}"`],
    ['"GSTIN: 33CKAPJ7513F1ZK"'],
    [`"Generated: ${new Date().toLocaleDateString('en-IN')}"`],
    [],
    headers.map(h => `"${h}"`),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`)),
  ].map(r => r.join(',')).join('\n');

  const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export default exportCSV;
