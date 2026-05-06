import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  FaFileInvoice, 
  FaArrowDown, 
  FaArrowUp, 
  FaCalendarAlt, 
  FaUndo, 
  FaCheckCircle,
  FaCalculator,
  FaMoneyCheckAlt
} from 'react-icons/fa';
import { motion } from 'framer-motion';

const GSTReport: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Direct call to Flask Microservice on Port 5001
      const res = await fetch(`http://${window.location.hostname}:5001/api/gst/monthly?month=${month}&year=${year}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch GST report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [month, year]);

  const cardStyle = {
    background: '#fff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    border: '1px solid #f1f5f9'
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading GST Data...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: "'Satoshi', sans-serif" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>GST Monthly Reconciliation</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>Analyze your tax liabilities and Input Tax Credit balances.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600 }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600 }}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      {data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, borderLeft: '6px solid #4f46e5' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <FaArrowUp color="#4f46e5" /> Output GST (Sales)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
                ₹{data.output_gst.total.toLocaleString()}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 1 }} transition={{ delay: 0.1 }} style={{ ...cardStyle, borderLeft: '6px solid #10b981' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <FaArrowDown color="#10b981" /> Input GST (ITC)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>
                ₹{data.input_gst_itc.total_available.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                Includes ₹{data.input_gst_itc.carry_forward_from_prev.toLocaleString()} Carry Forward
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ 
              ...cardStyle, 
              background: data.payable_gst.net_payable > 0 ? '#fff1f2' : '#f0fdf4',
              borderLeft: `6px solid ${data.payable_gst.net_payable > 0 ? '#ef4444' : '#22c55e'}` 
            }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <FaCalculator color={data.payable_gst.net_payable > 0 ? '#ef4444' : '#22c55e'} /> Net GST Payable
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '12px', color: data.payable_gst.net_payable > 0 ? '#ef4444' : '#166534' }}>
                ₹{data.payable_gst.net_payable.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                {data.payable_gst.net_payable > 0 ? 'Monthly Liability' : 'Zero Liability'}
              </div>
            </motion.div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Detailed Table */}
            <div style={cardStyle}>
              <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 700 }}>Tax Breakdown</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 0', color: '#64748b', fontSize: '0.85rem' }}>Tax Type</th>
                    <th style={{ padding: '12px 0', color: '#64748b', fontSize: '0.85rem' }}>Output</th>
                    <th style={{ padding: '12px 0', color: '#64748b', fontSize: '0.85rem' }}>Input (ITC)</th>
                    <th style={{ padding: '12px 0', color: '#64748b', fontSize: '0.85rem', textAlign: 'right' }}>Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {['cgst', 'sgst', 'igst'].map(type => (
                    <tr key={type} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 0', fontWeight: 700, textTransform: 'uppercase', color: '#334155' }}>{type}</td>
                      <td style={{ padding: '16px 0', color: '#0f172a' }}>₹{data.output_gst[type].toLocaleString()}</td>
                      <td style={{ padding: '16px 0', color: '#0f172a' }}>₹{data.input_gst_itc[type].toLocaleString()}</td>
                      <td style={{ padding: '16px 0', fontWeight: 800, textAlign: 'right', color: data.payable_gst[type] > 0 ? '#ef4444' : '#22c55e' }}>
                        ₹{data.payable_gst[type].toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Carry Forward Info */}
            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaUndo color="#60a5fa" />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Carry Forward</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>Next Month ITC</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {['cgst', 'sgst', 'igst'].map(type => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ textTransform: 'uppercase', fontSize: '0.85rem', color: '#cbd5e1' }}>{type}</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>₹{data.carry_forward_to_next_month[type].toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ marginTop: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>Total Surplus</span>
                  <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#60a5fa' }}>
                    ₹{(data.carry_forward_to_next_month.cgst + data.carry_forward_to_next_month.sgst + data.carry_forward_to_next_month.igst).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
          <FaMoneyCheckAlt size={64} style={{ opacity: 0.1, marginBottom: '20px' }} />
          <h3>Select a period to generate GST report</h3>
        </div>
      )}
    </div>
  );
};

export default GSTReport;
