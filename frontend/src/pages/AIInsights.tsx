// frontend/src/pages/AIInsights.tsx
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { FaBolt, FaBrain, FaChartLine, FaRobot, FaSortAmountDown, FaWarehouse } from 'react-icons/fa';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MOCK_FORECAST = [
    { name: 'Mon', sales: 4000, forecast: 4200 },
    { name: 'Tue', sales: 3000, forecast: 3300 },
    { name: 'Wed', sales: 2000, forecast: 2500 },
    { name: 'Thu', sales: 2780, forecast: 3100 },
    { name: 'Fri', sales: 1890, forecast: 2200 },
    { name: 'Sat', sales: 2390, forecast: 2800 },
    { name: 'Sun', sales: 3490, forecast: 4000 },
];

const AIInsights: React.FC = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* AI Core Banner */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ 
                    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '48px',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-float)'
                }}
            >
                <div style={{ position: 'relative', zIndex: 2, maxWidth: '700px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                            <FaBrain size={32} />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.8 }}>Neural Engine v4.2</span>
                    </div>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: 950, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '20px' }}>
                        Predictive Intelligence <br/> & <span style={{ color: '#fbbf24' }}>Branch Analytics</span>
                    </h1>
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.9, lineHeight: 1.6 }}>
                        Harness the power of our multi-agent neural network to forecast demand, identify anomalies, and optimize your global logistics chain in real-time.
                    </p>
                </div>

                {/* Cybernetic Background Detail */}
                <div style={{ position: 'absolute', right: '-5%', bottom: '-20%', opacity: 0.1 }}>
                    <FaRobot size={400} />
                </div>
            </motion.div>

            {/* Neural KPI Grid */}
            <div className="kpi-grid">
                <InsightCard title="Global Forecast" value="+14% ↑" label="30 Day Projection" icon={<FaChartLine />} color="#6366f1" delay={0.1} />
                <InsightCard title="Stock Risk" value="Minimal" label="Anomaly Detection" icon={<FaWarehouse />} color="#10b981" delay={0.2} />
                <InsightCard title="Agent Confidence" value="98.2%" label="Neural Accuracy" icon={<FaBolt />} color="#f59e0b" delay={0.3} />
                <InsightCard title="Active Agents" value="12" label="Running Sub-tasks" icon={<FaSortAmountDown />} color="#8b5cf6" delay={0.4} />
            </div>

            {/* Analytics & Strategies */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="enterprise-card"
                    style={{ padding: '32px' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Neural Sales Trajectory</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Comparing historical flow vs AI forecasted momentum</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700 }}><div style={{width: 8, height: 8, borderRadius: '50%', background: '#6366f1'}}></div> Real</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700 }}><div style={{width: 8, height: 8, borderRadius: '50%', border: '1px dashed #8b5cf6'}}></div> AI Forecast</span>
                        </div>
                    </div>

                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_FORECAST}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-premium)', fontWeight: 800 }} />
                                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                <Area type="monotone" dataKey="forecast" stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth={2} fill="transparent" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* AI Recommendations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '8px' }}>Neural Strategies</h3>
                    <AnimatePresence>
                        <StrategyItem 
                            title="Branch Optimization" 
                            body="Neural model suggests shifting 45 units of Copper Slag from HQ to South Branch to meet predicted weekend demand."
                            level="high"
                            delay={0.6}
                        />
                        <StrategyItem 
                            title="Revenue Accelerator" 
                            body="Customer 'Acme Inc' has a 92% match for seasonal re-ordering. Recommend triggering proactive quote agent."
                            level="medium"
                            delay={0.7}
                        />
                        <StrategyItem 
                            title="Cost Reduction" 
                            body="Transport lanes between Branch A and B are under-capacity. Consolidation suggested to save ₹12,400."
                            level="low"
                            delay={0.8}
                        />
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

const InsightCard: React.FC<any> = ({ title, value, label, icon, color, delay }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="enterprise-card glass"
        style={{ padding: '24px' }}
    >
        <div style={{ padding: '12px', background: `${color}15`, color: color, width: 'fit-content', borderRadius: '12px', marginBottom: '20px' }}>
            {icon}
        </div>
        <p style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
        <h3 style={{ fontSize: '2rem', fontWeight: 950, color: 'var(--text-primary)', margin: '4px 0' }}>{value}</h3>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</p>
    </motion.div>
);

const StrategyItem: React.FC<any> = ({ title, body, level, delay }) => {
    const color = level === 'high' ? 'var(--error)' : (level === 'medium' ? 'var(--warning)' : 'var(--primary)');
    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className="enterprise-card"
            style={{ 
                borderLeft: `5px solid ${color}`,
                padding: '20px',
                background: `${color}05`
            }}
        >
            <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{title}</h4>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</p>
            <button className="clickable" style={{ marginTop: '12px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-primary)', border: 'none', background: 'none', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Execute Neural Link →
            </button>
        </motion.div>
    );
}

export default AIInsights;
