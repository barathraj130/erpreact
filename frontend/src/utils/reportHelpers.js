const formatINR = (amount) => {
  const num = parseFloat(amount || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatINRShort = (amount) => {
  const num = parseFloat(amount || 0);
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  if (num >= 100000)   return '₹' + (num / 100000).toFixed(2) + ' L';
  if (num >= 1000)     return '₹' + (num / 1000).toFixed(1) + 'K';
  return '₹' + num.toLocaleString('en-IN');
};

const formatPct = (value, total) => {
  if (!total || total === 0) return '0%';
  return ((parseFloat(value || 0) / parseFloat(total)) * 100).toFixed(1) + '%';
};

const formatNum = (num) => parseFloat(num || 0).toLocaleString('en-IN');

const formatDate = (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—';

const yAxisFormatter = (v) => {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (v >= 100000)   return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)     return '₹' + (v / 1000).toFixed(0) + 'K';
  return '₹' + v;
};

const tooltipFormatter = (value) => ['₹' + parseFloat(value || 0).toLocaleString('en-IN'), ''];

export { formatINR, formatINRShort, formatPct, formatNum, formatDate, yAxisFormatter, tooltipFormatter };
