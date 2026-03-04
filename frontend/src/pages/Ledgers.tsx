// frontend/src/pages/Ledgers.tsx
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaBook, FaPlus, FaSearch } from 'react-icons/fa';

interface Account {
    id: number;
    account_code: string;
    name: string;
    account_type: string;
    current_balance: string;
}

const Ledgers: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [newAccount, setNewAccount] = useState({
        account_code: '',
        name: '',
        account_type: 'ASSET',
        opening_balance: 0
    });

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/accounts`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('erp-token')}` }
            });
            const data = await response.json();
            if (response.ok) setAccounts(data);
        } catch (error) {
            console.error("Error fetching accounts:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/accounts`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('erp-token')}` 
                },
                body: JSON.stringify(newAccount)
            });
            if (response.ok) {
                setShowModal(false);
                setNewAccount({ account_code: '', name: '', account_type: 'ASSET', opening_balance: 0 });
                fetchAccounts();
            }
        } catch (error) {
            console.error("Error saving account:", error);
        }
    };

    const filteredAccounts = accounts.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.account_code.includes(searchTerm)
    );

    const getTypeColor = (type: string) => {
        switch(type) {
            case 'ASSET': return 'text-blue-600 bg-blue-50';
            case 'LIABILITY': return 'text-red-600 bg-red-50';
            case 'EQUITY': return 'text-purple-600 bg-purple-50';
            case 'INCOME': return 'text-emerald-600 bg-emerald-50';
            case 'EXPENSE': return 'text-amber-600 bg-amber-50';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chart of Accounts</h1>
                    <p className="text-slate-500 mt-1">Manage your enterprise's financial ledger structure.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all"
                >
                    <FaPlus /> New Account
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[32px] p-10 w-full max-w-md shadow-2xl border border-slate-100"
                    >
                        <h2 className="text-2xl font-black text-slate-900 mb-6">Create New Account</h2>
                        <form onSubmit={handleSaveAccount} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Account Code</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-blue-500 transition-all font-bold"
                                    placeholder="e.g. 1001"
                                    value={newAccount.account_code}
                                    onChange={(e) => setNewAccount({...newAccount, account_code: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Account Name</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-blue-500 transition-all font-bold"
                                    placeholder="e.g. Petty Cash"
                                    value={newAccount.name}
                                    onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Account Type</label>
                                <select 
                                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-blue-500 transition-all font-bold"
                                    value={newAccount.account_type}
                                    onChange={(e) => setNewAccount({...newAccount, account_type: e.target.value})}
                                >
                                    <option value="ASSET">ASSET</option>
                                    <option value="LIABILITY">LIABILITY</option>
                                    <option value="EQUITY">EQUITY</option>
                                    <option value="INCOME">INCOME</option>
                                    <option value="EXPENSE">EXPENSE</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Opening Balance</label>
                                <input 
                                    type="number" 
                                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-blue-500 transition-all font-bold"
                                    value={newAccount.opening_balance}
                                    onChange={(e) => setNewAccount({...newAccount, opening_balance: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:scale-105 transition-all">Save Account</button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-slate-200">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search by name or code..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Code</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Account Name</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Type</th>
                            <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Current Balance</th>
                            <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            [1,2,3].map(i => <tr key={i} className="animate-pulse h-16 bg-slate-50/50" />)
                        ) : filteredAccounts.map((account, idx) => (
                            <motion.tr 
                                key={account.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                className="hover:bg-slate-50/80 transition-colors"
                            >
                                <td className="px-6 py-4 font-mono text-sm font-bold text-slate-400">{account.account_code}</td>
                                <td className="px-6 py-4 font-bold text-slate-900">{account.name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${getTypeColor(account.account_type)}`}>
                                        {account.account_type}
                                    </span>
                                </td>
                                <td className={`px-6 py-4 text-right font-black ${parseFloat(account.current_balance) < 0 ? 'text-red-500' : 'text-slate-900'}`}>
                                    ₹{Math.abs(parseFloat(account.current_balance)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    <span className="ml-1 text-[10px] text-slate-400">
                                        {parseFloat(account.current_balance) >= 0 ? 'Dr' : 'Cr'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button className="text-slate-400 hover:text-blue-600 transition-colors">
                                        <FaBook />
                                    </button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
                {!loading && filteredAccounts.length === 0 && (
                    <div className="py-20 text-center text-slate-400 italic">No accounts found.</div>
                )}
            </div>
        </div>
    );
};

export default Ledgers;