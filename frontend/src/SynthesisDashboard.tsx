import { motion } from 'framer-motion';
import React from 'react';
import { FaArrowUp, FaDownload, FaEllipsisV, FaFilter } from 'react-icons/fa';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SynthesisLayout from './SynthesisLayout';

const cashFlowData = [
  { name: 'Mon', inflow: 4000, outflow: 2400 },
  { name: 'Tue', inflow: 3000, outflow: 1398 },
  { name: 'Wed', inflow: 2000, outflow: 9800 },
  { name: 'Thu', inflow: 2780, outflow: 3908 },
  { name: 'Fri', inflow: 1890, outflow: 4800 },
  { name: 'Sat', inflow: 2390, outflow: 3800 },
  { name: 'Sun', inflow: 3490, outflow: 4300 },
];

const expenseRevenueData = [
  { month: 'Jan', revenue: 45000, expense: 32000 },
  { month: 'Feb', revenue: 52000, expense: 28000 },
  { month: 'Mar', revenue: 48000, expense: 35000 },
  { month: 'Apr', revenue: 61000, expense: 42000 },
  { month: 'May', revenue: 55000, expense: 39000 },
  { month: 'Jun', revenue: 67000, expense: 45000 },
];

const SynthesisDashboard: React.FC = () => {
  return (
    <SynthesisLayout activeItem="Command Center">
      <div className="fade-in-up">
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B' }}>Finance Command Center</h1>
            <p style={{ color: '#64748B', fontSize: '0.95rem' }}>Real-time fiscal logic and operational intelligence.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button style={{ padding: '0.6rem 1.2rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <FaFilter size={12} /> Filter Period
            </button>
            <button style={{ padding: '0.6rem 1.2rem', background: '#1E2A78', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <FaDownload size={12} /> Export Intelligence
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="kpi-grid">
          <motion.div whileHover={{ y: -5 }} className="kpi-card">
            <div className="kpi-label">LIQUID CASH</div>
            <div className="kpi-value">$248,590.00</div>
            <div className="kpi-trend trend-up">
              <FaArrowUp /> +12.4% <span style={{ color: '#94a3b8', fontWeight: 400 }}>vs last month</span>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="kpi-card">
            <div className="kpi-label">AGGREGATED BANK BALANCE</div>
            <div className="kpi-value">$1,420,000.00</div>
            <div className="kpi-trend trend-up">
              <FaArrowUp /> +3.2% <span style={{ color: '#94a3b8', fontWeight: 400 }}>5 internal accounts</span>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="kpi-card">
            <div className="kpi-label">NET PROFIT (YTD)</div>
            <div className="kpi-value" style={{ color: '#10B981' }}>$682,400.00</div>
            <div className="kpi-trend trend-up">
              <FaArrowUp /> +24% <span style={{ color: '#94a3b8', fontWeight: 400 }}>Projected: $1.2M</span>
            </div>
          </motion.div>
        </div>

        {/* Analytics Grid */}
        <div className="dashboard-grid">
          {/* Main Chart */}
          <div className="widget-card">
            <div className="widget-header">
              <h3 className="widget-title">Fiscal Liquidity (Cash Flow)</h3>
              <div className="widget-actions">
                <FaEllipsisV style={{ color: '#94a3b8', cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                  <Area type="monotone" dataKey="outflow" stroke="#94a3b8" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="widget-card">
              <h3 className="widget-title" style={{ marginBottom: '1rem' }}>Revenue vs Expense</h3>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={expenseRevenueData}>
                    <Bar dataKey="revenue" fill="#1E2A78" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="widget-card" style={{ background: 'linear-gradient(135deg, #1E2A78 0%, #312E81 100%)', color: '#fff' }}>
                <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.6)' }}>OUTSTANDING RECEIVABLES</div>
                <div className="kpi-value" style={{ color: '#fff', fontSize: '1.5rem' }}>$84,320.00</div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0' }}></div>
                <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.6)' }}>PENDING PAYABLES</div>
                <div className="kpi-value" style={{ color: '#fff', fontSize: '1.5rem' }}>$42,150.00</div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="widget-card">
          <div className="widget-header">
            <h3 className="widget-title">Recent Automated Transactions</h3>
            <button style={{ color: '#3B82F6', background: 'none', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>View All History</button>
          </div>
          <table className="premium-table">
            <thead>
              <tr>
                <th>TRANSACTION ID</th>
                <th>ENTITY / ORIGIN</th>
                <th>CATEGORY</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>FSCAL LOG</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 'FT-9021', entity: 'Amazon Web Services', cat: 'Cloud Infra', amt: '-$1,240.00', status: 'SUCCESS' },
                { id: 'FT-9022', entity: 'Global Logistics Corp', cat: 'Shipping', amt: '-$3,500.00', status: 'PENDING' },
                { id: 'FT-9023', entity: 'Stripe Payout', cat: 'Revenue', amt: '+$12,450.00', status: 'SUCCESS' },
                { id: 'FT-9024', entity: 'Employee Payroll (May)', cat: 'Workforce', amt: '-$45,000.00', status: 'SUCCESS' },
                { id: 'FT-9025', entity: 'Office Space Rental', cat: 'Facilities', amt: '-$8,000.00', status: 'ERROR' },
              ].map((tx, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{tx.id}</td>
                  <td>{tx.entity}</td>
                  <td><span style={{ fontSize: '0.8rem', color: '#64748B', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{tx.cat}</span></td>
                  <td style={{ fontWeight: 700, color: tx.amt.startsWith('+') ? '#10B981' : '#1E293B' }}>{tx.amt}</td>
                  <td>
                    <span className={`status-pill status-${tx.status.toLowerCase()}`}>
                        {tx.status}
                    </span>
                  </td>
                  <td><button style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}><FaDownload size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SynthesisLayout>
  );
};

export default SynthesisDashboard;
