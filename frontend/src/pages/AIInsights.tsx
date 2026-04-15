// frontend/src/pages/AIInsights.tsx
import { AnimatePresence, motion } from "framer-motion";
import React, { useState, useEffect } from "react";
import {
  FaBrain,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaRobot,
  FaSearch,
  FaTable,
  FaMagic,
  FaArrowRight,
  FaHistory,
  FaFilter
} from "react-icons/fa";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { apiFetch } from "../utils/api";
import { useAuthUser } from "../hooks/useAuthUser";
import "./Dashboard.css";
import "./PageShared.css";

// --- DYNAMIC COMPONENTS ---

/**
 * 📊 Dynamic Data Table
 */
const DynamicTable = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) return <div>No records found for this query.</div>;
  const headers = Object.keys(data[0]);

  return (
    <div className="db-card" style={{ padding: '0', overflowX: 'auto' }}>
      <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#fcfcfc' }}>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#9b9b96', letterSpacing: '0.05em' }}>
                {h.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f0f0ee' }}>
              {headers.map(h => (
                <td key={h} style={{ padding: '16px 20px', fontSize: '13.5px', color: '#111110' }}>
                   {row[h]?.toString() || '--'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 📈 Dynamic Chart Factory
 */
const DynamicChart = ({ type, data }: { type: string, data: any[] }) => {
  if (!data || data.length === 0) return null;
  
  // Detect numerical fields for Y axis
  const keys = Object.keys(data[0]);
  const xKey = keys[0]; // Assume first is label
  const yKey = keys.find(k => typeof data[0][k] === 'number') || keys[1];

  const renderChart = () => {
    switch(type) {
      case 'BAR':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0ee" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 11, fill: '#9b9b96' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 11, fill: '#9b9b96' }} />
            <Tooltip contentStyle={{ fontFamily: "Satoshi", borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
            <Bar dataKey={yKey} fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'LINE':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0ee" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 11, fill: '#9b9b96' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontFamily: "Satoshi", fontSize: 11, fill: '#9b9b96' }} />
            <Tooltip contentStyle={{ fontFamily: "Satoshi", borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
            <Line type="monotone" dataKey={yKey} stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }} />
          </LineChart>
        );
      case 'PIE':
        return (
          <PieChart>
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#4f46e5" paddingAngle={5}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      default: return <DynamicTable data={data} />;
    }
  };

  return (
    <div style={{ height: 350, width: '100%', marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

// --- MAIN AI PAGE ---

const AIInsights: React.FC = () => {
  const { user } = useAuthUser();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault();
    const finalQuery = overrideQuery || query;
    if (!finalQuery.trim()) return;

    setLoading(true);
    setResult(null);
    setStatus("Parsing Intent...");

    // UI Steps
    const steps = [
      "Dynamic Schema Learning...",
      "Generating Universal Query...",
      "Scanning Enterprise Warehouse...",
      "Executing Dynamic SQL...",
      "Compiling Insights..."
    ];
    
    let step = 0;
    const interval = setInterval(() => {
        if (step < steps.length) {
            setStatus(steps[step]);
            step++;
        }
    }, 800);

    try {
      const response = await apiFetch("/ai/reports", {
        method: "POST",
        body: JSON.stringify({
          query: finalQuery,
          userContext: {
            company_id: user?.company_id || 1,
            role: user?.role || "admin",
            enabled_modules: "sales,inventory,procurement,finance,hr,ai,documents"
          }
        })
      });

      const data = await response.json();
      clearInterval(interval);
      
      if (data.success) {
        setResult(data);
        if (!history.includes(finalQuery)) setHistory([finalQuery, ...history].slice(0, 5));
      } else {
        setResult({ error: true, message: data.error || "Engine failed to process query." });
      }
    } catch (err) {
      clearInterval(interval);
      setResult({ error: true, message: "Network error connecting to AI brain." });
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const SUGGESTIONS = [
    "Show me total sales by month for the last year",
    "List top 5 products with stock less than 20",
    "Average invoice amount of Titan Industries",
    "Total salary expenses for Mar 2024",
    "Show vendors with pending payments > 50000"
  ];

  return (
    <div className="db-page">
      {/* ── Sticky Topbar ── */}
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">Genie AI</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">Business Explorer</span>
        </div>
        <div className="db-topbar-right">
          <div className={`db-status-tag ${loading ? 'st-pending' : 'st-paid'}`}>
             <span className="db-s-dot"></span>
             {loading ? 'Thinking...' : 'Brain Active'}
          </div>
        </div>
      </header>

      <div className="db-content" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div className="db-page-header" style={{ textAlign: 'center', padding: '40px 0' }}>
           <div style={{ display: 'inline-grid', placeItems: 'center', width: 64, height: 64, background: 'linear-gradient(135deg, #111, #333)', borderRadius: '20px', marginBottom: '20px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
              <FaRobot size={32} />
           </div>
           <h1 className="db-page-title" style={{ fontSize: '32px' }}>Ask anything about your <strong>Business</strong></h1>
           <p className="db-page-sub">Type your request in natural language. No reports templates required.</p>
        </div>

        {/* 🔍 SEARCH ENGINE */}
        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '40px' }}>
           <input 
              className="db-search-input"
              style={{ width: '100%', height: '70px', borderRadius: '24px', paddingLeft: '64px', fontSize: '18px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', border: '1px solid #e8e8e5' }}
              placeholder="e.g. Compare sales growth between HQ and South branch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
           />
           <FaSearch style={{ position: 'absolute', left: '24px', top: '26px', fontSize: '20px', color: '#9b9b96' }} />
           <button 
              type="submit"
              className="db-btn db-btn-primary" 
              style={{ position: 'absolute', right: '12px', top: '12px', height: '46px', borderRadius: '14px', width: '140px' }}
              disabled={loading}
           >
              {loading ? (
                <div className="db-spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }}></div>
              ) : (
                <>AI Analyze <FaArrowRight size={10} style={{ marginLeft: '4px' }} /></>
              )}
           </button>
        </form>

        <AnimatePresence>
          {loading && (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0 }}
               style={{ textAlign: 'center', padding: '20px' }}
            >
               <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>{status}</h3>
               <div style={{ width: '200px', height: '4px', background: '#f0f0ee', borderRadius: '2px', margin: '16px auto', overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    style={{ width: '100%', height: '100%', background: '#4f46e5' }}
                  />
               </div>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              key="result"
            >
              {result.error ? (
                <div className="db-card" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', textAlign: 'center', padding: '40px' }}>
                    <FaBrain size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3>Intelligence Gap Detected</h3>
                    <p style={{ fontSize: '14px' }}>{result.message}</p>
                </div>
              ) : (
                <div className="db-card" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                       <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Insight Report</span>
                          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0', color: '#111' }}>{result.metadata.title}</h2>
                       </div>
                       <div className="db-status-tag st-paid">
                          {result.metadata.ui_suggestion === 'TABLE' ? <FaTable /> : <FaChartBar />}
                          {result.metadata.ui_suggestion} View
                       </div>
                    </div>

                    {result.metadata.ui_suggestion === 'TABLE' ? (
                        <DynamicTable data={result.payload} />
                    ) : (
                        <div style={{ background: '#fcfcfc', borderRadius: '20px', padding: '20px', border: '1px solid #f0f0ee' }}>
                            <DynamicChart type={result.metadata.ui_suggestion} data={result.payload} />
                        </div>
                    )}

                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f0f0ee', display: 'flex', gap: '8px' }}>
                       <span style={{ fontSize: '12px', color: '#9b9b96' }}>Generated from: "{result.metadata.intent}"</span>
                    </div>
                </div>
              )}
            </motion.div>
          )}

          {!result && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               {/* SUGGESTIONS */}
               <div style={{ marginBottom: '40px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#9b9b96' }}>
                     <FaFilter size={12} />
                     <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Suggested Analyzes</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {SUGGESTIONS.map(s => (
                      <button 
                        key={s} 
                        className="db-btn" 
                        style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e5', padding: '10px 16px', fontSize: '13px' }}
                        onClick={() => { setQuery(s); handleSearch(undefined, s); }}
                      >
                         {s}
                      </button>
                    ))}
                  </div>
               </div>

               {/* RECENT HISTORY */}
               {history.length > 0 && (
                 <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#9b9b96' }}>
                       <FaHistory size={12} />
                       <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Recent Explorer Queries</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       {history.map(h => (
                         <div key={h} className="db-card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => { setQuery(h); handleSearch(undefined, h); }}>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{h}</span>
                            <FaArrowRight size={10} color="#9b9b96" />
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .db-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIInsights;
