// frontend/src/pages/CreateTransaction.tsx
import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaPlus, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

interface Account {
    id: number;
    account_code: string;
    name: string;
}

interface TransactionLine {
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    description: string;
}

const CreateTransaction: React.FC = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [lines, setLines] = useState<TransactionLine[]>([
        { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
        { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
    ]);

    useEffect(() => {
        const fetchAccounts = async () => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/accounts`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('erp-token')}` }
            });
            const data = await response.json();
            if (response.ok) setAccounts(data);
        };
        fetchAccounts();
    }, []);

    const addLine = () => {
        setLines([...lines, { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof TransactionLine, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const totalDebits = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
    const isBalanced = totalDebits === totalCredits && totalDebits > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) return alert("Double entry must be balanced (Debits = Credits)");

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/transactions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('erp-token')}` 
                },
                body: JSON.stringify({
                    transaction_date: date,
                    description,
                    lines: lines.filter(l => l.account_id && (l.debit_amount > 0 || l.credit_amount > 0))
                })
            });

            if (response.ok) {
                navigate('/transactions');
            } else {
                const err = await response.json();
                alert(err.error || "Failed to save transaction");
            }
        } catch (error) {
            console.error("Error creating transaction:", error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">New Journal Entry</h1>
                    <p className="text-slate-500 mt-1">Record a manual double-entry financial transaction.</p>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest ${isBalanced ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {isBalanced ? <><FaCheckCircle /> Balanced</> : 'Unbalanced'}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-panel p-8 rounded-[32px] border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Transaction Date</label>
                        <input 
                            type="date"
                            required
                            className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">General Description</label>
                        <input 
                            type="text"
                            required
                            className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold"
                            placeholder="e.g. Monthly Rent Payment"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="glass-panel rounded-[32px] overflow-hidden border border-slate-200">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Account</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Debit (₹)</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Credit (₹)</th>
                                <th className="px-6 py-4 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {lines.map((line, idx) => (
                                <tr key={idx}>
                                    <td className="p-4">
                                        <select 
                                            required
                                            className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm font-bold"
                                            value={line.account_id}
                                            onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                                        >
                                            <option value="">Select Account</option>
                                            {accounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.account_code} - {a.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <input 
                                            type="text"
                                            className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm font-bold"
                                            placeholder="Line details..."
                                            value={line.description}
                                            onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input 
                                            type="number"
                                            className="w-full p-3 bg-slate-50 rounded-xl outline-none text-right text-sm font-bold"
                                            value={line.debit_amount}
                                            onChange={(e) => updateLine(idx, 'debit_amount', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input 
                                            type="number"
                                            className="w-full p-3 bg-slate-50 rounded-xl outline-none text-right text-sm font-bold"
                                            value={line.credit_amount}
                                            onChange={(e) => updateLine(idx, 'credit_amount', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="p-4 text-center">
                                        {lines.length > 2 && (
                                            <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                                                <FaTrash size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-black">
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-right">TOTAL</td>
                                <td className="px-6 py-4 text-right text-blue-600">₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-right text-purple-600">₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="flex items-center justify-between gap-6">
                    <button 
                        type="button" 
                        onClick={addLine}
                        className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                    >
                        <FaPlus /> Add Line Item
                    </button>
                    <div className="flex gap-4">
                        <button type="button" onClick={() => navigate('/transactions')} className="px-8 py-4 font-bold text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={!isBalanced}
                            className={`px-10 py-4 rounded-2xl font-black shadow-xl transition-all ${isBalanced ? 'bg-slate-900 text-white hover:scale-105 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                            Post Journal Entry
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateTransaction;
