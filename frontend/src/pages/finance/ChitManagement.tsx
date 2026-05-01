
import React, { useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaCoins,
  FaPlus,
  FaSync,
  FaHistory,
  FaTimes,
  FaTrash,
  FaMoneyBillWave,
} from "react-icons/fa";
import { financeApi } from "./financeApi";
import { motion, AnimatePresence } from "framer-motion";
import "../PageShared.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(Number(n || 0));

const ChitManagement: React.FC = () => {
  const [chits, setChits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedChit, setSelectedChit] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [showCollectModal, setShowCollectModal] = useState(false);

  const fetchChits = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getChitGroups();
      setChits(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallments = async (chitId: number) => {
    try {
      const res = await financeApi.getChitInstallments(chitId);
      setInstallments(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchChits();
  }, []);

  const [form, setForm] = useState({
    group_name: "",
    total_value: 100000,
    monthly_installment: 5000,
    duration_months: 20,
    start_date: new Date().toISOString().split("T")[0],
  });

  const [colForm, setColForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount: 0,
    is_auction_won: false,
    auction_amount_received: 0,
    notes: "",
  });

  const handleCreateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await financeApi.createChitGroup(form);
      setShowNewModal(false);
      fetchChits();
    } catch (e) {
      alert("Failed to create chit fund.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChit) return;
    setLoading(true);
    try {
      await financeApi.recordChitInstallment({
        ...colForm,
        chit_group_id: selectedChit.id,
      });
      setShowCollectModal(false);
      fetchInstallments(selectedChit.id);
      fetchChits();
    } catch (e) {
      alert("Failed to record installment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Chit Fund Management</h1>
          <p>Track group contributions and auction payouts.</p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={fetchChits}>
            <FaSync className={loading ? "fa-spin" : ""} size={12} />
          </button>
          <button className="page-btn-round page-btn-round-primary" onClick={() => setShowNewModal(true)}>
            <FaPlus size={11} /> New Chit Group
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', display: 'grid', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card card-indigo">
          <FaCoins className="stat-icon" />
          <div className="label">Active Chits</div>
          <div className="value">{chits.length}</div>
        </div>
        <div className="stat-card card-green">
          <FaMoneyBillWave className="stat-icon" />
          <div className="label">Monthly commitment</div>
          <div className="value">{fmt(chits.reduce((acc, c) => acc + Number(c.monthly_installment), 0))}</div>
        </div>
      </div>

      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Group Name</th>
              <th className="text-right">Total Value</th>
              <th className="text-right">Monthly</th>
              <th>Duration</th>
              <th>Start Date</th>
              <th className="text-center">Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chits.map(chit => (
              <tr key={chit.id} onClick={() => { setSelectedChit(chit); fetchInstallments(chit.id); }} style={{ cursor: 'pointer' }}>
                <td><div className="font-bold">{chit.group_name}</div></td>
                <td className="text-right font-mono">{fmt(chit.total_value)}</td>
                <td className="text-right font-mono">{fmt(chit.monthly_installment)}</td>
                <td>{chit.duration_months} months</td>
                <td>{chit.start_date}</td>
                <td className="text-center">
                  <span className="type-badge type-badge-green">{chit.status}</span>
                </td>
                <td className="text-center">
                  <button className="page-btn-round-sm" onClick={(e) => { e.stopPropagation(); setSelectedChit(chit); setShowCollectModal(true); }}>
                    <FaPlus size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Viewer */}
      <AnimatePresence>
        {selectedChit && !showCollectModal && (
          <motion.div className="card" style={{ marginTop: '24px', padding: '24px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Installment History: {selectedChit.group_name}</h2>
              <button className="page-btn-round-sm" onClick={() => setSelectedChit(null)}><FaTimes /></button>
            </div>
            <table className="page-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Auction Won?</th>
                  <th className="text-right">Auction Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {installments.map(ins => (
                  <tr key={ins.id}>
                    <td>{ins.payment_date}</td>
                    <td className="text-right">{fmt(ins.amount)}</td>
                    <td className="text-center">{ins.is_auction_won ? "✅ YES" : "NO"}</td>
                    <td className="text-right">{ins.is_auction_won ? fmt(ins.auction_amount_received) : "-"}</td>
                    <td>{ins.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Group Modal */}
      <AnimatePresence>
        {showNewModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>New Chit Group</h2>
              <form onSubmit={handleCreateChit}>
                <label>Group Name</label>
                <input required value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})} />
                <div className="form-grid-2">
                  <div>
                    <label>Total Value (₹)</label>
                    <input type="number" required value={form.total_value} onChange={e => setForm({...form, total_value: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label>Monthly Installment (₹)</label>
                    <input type="number" required value={form.monthly_installment} onChange={e => setForm({...form, monthly_installment: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div>
                    <label>Duration (Months)</label>
                    <input type="number" required value={form.duration_months} onChange={e => setForm({...form, duration_months: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label>Start Date</label>
                    <input type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                  </div>
                </div>
                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowNewModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary">Create Group</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Installment Modal */}
      <AnimatePresence>
        {showCollectModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>Record Installment / Auction Won</h2>
              <form onSubmit={handleRecordInstallment}>
                <label>Date</label>
                <input type="date" required value={colForm.payment_date} onChange={e => setColForm({...colForm, payment_date: e.target.value})} />
                
                <label>Installment Paid (₹)</label>
                <input type="number" required value={colForm.amount} onChange={e => setColForm({...colForm, amount: Number(e.target.value)})} />

                <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="auction_won" checked={colForm.is_auction_won} onChange={e => setColForm({...colForm, is_auction_won: e.target.checked})} />
                  <label htmlFor="auction_won" style={{ margin: 0 }}>Did you win the auction this month?</label>
                </div>

                {colForm.is_auction_won && (
                  <div>
                    <label>Auction Payout Received (₹)</label>
                    <input type="number" required value={colForm.auction_amount_received} onChange={e => setColForm({...colForm, auction_amount_received: Number(e.target.value)})} />
                  </div>
                )}

                <label>Notes</label>
                <input value={colForm.notes} onChange={e => setColForm({...colForm, notes: e.target.value})} />

                <div className="page-modal-actions">
                  <button type="button" className="page-btn-round" onClick={() => setShowCollectModal(false)}>Cancel</button>
                  <button type="submit" className="page-btn-round page-btn-round-primary">Save Record</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChitManagement;
