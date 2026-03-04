// frontend/src/pages/Transactions.tsx
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaExchangeAlt, FaFileAlt, FaPlus, FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

interface Transaction {
    id: number;
    transaction_date: string;
    description: string;
    reference_type: string;
    reference_id: number;
    creator_name: string;
    amount?: number; // Added for display convenience if possible
}

const Transactions: React.FC = () => {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchTxs = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/transactions`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('erp-token')}` }
                });
                const data = await response.json();
                if (response.ok) setTransactions(data);
            } catch (error) {
                console.error("Error fetching transactions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTxs();
    }, []);

    const filtered = transactions.filter(t => 
        t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.reference_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Financial Transactions</h1>
                    <p className="text-slate-500 mt-1">Audit log of all ledger movements and journal entries.</p>
                </div>
                <button 
                    onClick={() => navigate('/transactions/new')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 hover:scale-105 transition-all shadow-xl shadow-blue-100"
                >
                    <FaPlus /> New Journal Entry
                </button>
            </div>

            <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-slate-200">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search transactions..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl" />)
                ) : filtered.map((tx, idx) => (
                    <motion.div 
                        key={tx.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="glass-panel p-6 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all group flex items-center justify-between gap-6"
                    >
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-2xl flex items-center justify-center transition-colors">
                                <FaFileAlt size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-sm font-mono font-bold text-slate-400">#{tx.id}</span>
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase tracking-widest">{tx.reference_type}</span>
                                    <span className="text-xs font-bold text-slate-400">{new Date(tx.transaction_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                                </div>
                                <h3 className="font-bold text-slate-900">{tx.description || 'No description provided'}</h3>
                                <p className="text-xs text-slate-400 mt-1">Posted by <span className="text-slate-600 font-bold">{tx.creator_name}</span></p>
                            </div>
                        </div>
                        
                        <div className="text-right">
                             <button className="text-blue-600 text-sm font-black hover:underline flex items-center gap-2">
                                Details <FaExchangeAlt />
                             </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {!loading && filtered.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">No transactions matching your criteria.</p>
                </div>
            )}
        </div>
    );
};

export default Transactions;
