
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

const generateChitSchedule = (chit: any, installments: any[]) => {
  const months = Number(chit.duration_months || 20);
  const monthly = Number(chit.monthly_installment || 0);
  const start = new Date(chit.start_date || new Date());
  const today = new Date();
  const schedule = [];

  for (let i = 1; i <= months; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i - 1);
    const paid = installments.find(ins => {
      const d = new Date(ins.payment_date);
      return d.getMonth() === due.getMonth() && d.getFullYear() === due.getFullYear();
    });
    const isCurrent = due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
    const isPast = due < today && due.getMonth() !== today.getMonth();
    schedule.push({ month: i, due, monthly, paid: !!paid, installment: paid, isCurrent, isPast });
  }
  return schedule;
};

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
    payment_mode: "CASH",
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        <div className="enterprise-card" style={{ width: '320px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'white', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(22, 163, 74, 0.1)' }}>
            <FaCoins size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Active Chits</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#14532d' }}>{chits.length}</div>
          </div>
        </div>
        <div className="enterprise-card" style={{ width: '320px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'white', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.1)' }}>
            <FaMoneyBillWave size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Monthly Commitment</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a' }}>{fmt(chits.reduce((acc, c) => acc + Number(c.monthly_installment), 0))}</div>
          </div>
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
                <td>{chit.start_date ? new Date(chit.start_date).toLocaleDateString('en-IN') : '-'}</td>
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

      {/* Schedule Viewer */}
      <AnimatePresence>
        {selectedChit && !showCollectModal && (() => {
          const schedule = generateChitSchedule(selectedChit, installments);
          const paidCount = schedule.filter(s => s.paid).length;
          const nextDue = schedule.find(s => !s.paid && (s.isCurrent || !s.isPast));

          return (
            <motion.div
              className="card"
              style={{ marginTop: '24px', padding: '0', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>{selectedChit.group_name} — Payment Schedule</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>{paidCount} of {schedule.length} months paid</span>
                    {nextDue && (
                      <span style={{ marginLeft: '12px' }}>
                        Next due: <strong>{new Date(nextDue.due).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="page-btn-round-sm"
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '11px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => { e.stopPropagation(); setShowCollectModal(true); }}
                  >
                    <FaPlus size={9} /> Add Payment
                  </button>
                  <button className="page-btn-round-sm" onClick={() => setSelectedChit(null)}><FaTimes /></button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ padding: '0 24px 0', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', margin: '0 0 16px' }}>
                  <div style={{ height: '100%', width: `${(paidCount / schedule.length) * 100}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Schedule grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', padding: '20px 24px' }}>
                {schedule.map(row => {
                  let statusLabel = 'UPCOMING';
                  let statusColor = '#64748b';
                  let statusBg = '#f1f5f9';
                  let statusIcon = '';
                  if (row.paid) { statusLabel = 'PAID'; statusColor = '#16a34a'; statusBg = '#dcfce7'; statusIcon = '✅'; }
                  else if (row.isCurrent) { statusLabel = 'DUE NOW'; statusColor = '#d97706'; statusBg = '#fef3c7'; statusIcon = '🔔'; }
                  else if (row.isPast) { statusLabel = 'OVERDUE'; statusColor = '#dc2626'; statusBg = '#fee2e2'; statusIcon = '⚠️'; }

                  return (
                    <div
                      key={row.month}
                      style={{
                        background: row.paid ? '#f0fdf4' : row.isCurrent ? '#fffbeb' : row.isPast ? '#fff5f5' : '#fafafa',
                        border: `1px solid ${row.paid ? '#bbf7d0' : row.isCurrent ? '#fde68a' : row.isPast ? '#fecaca' : '#e2e8f0'}`,
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Month {row.month}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: statusBg, color: statusColor }}>
                          {statusIcon} {statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        {new Date(row.due).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: row.paid ? '#16a34a' : '#0f172a' }}>
                        {row.paid && row.installment ? fmt(row.installment.amount) : fmt(row.monthly)}
                      </div>
                      {!row.paid && (row.isCurrent || row.isPast) && (
                        <button
                          style={{ marginTop: '4px', padding: '5px 0', borderRadius: '8px', border: 'none', background: row.isCurrent ? '#f59e0b' : '#ef4444', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                          onClick={() => {
                            setColForm(prev => ({
                              ...prev,
                              amount: row.monthly,
                              payment_date: row.due.toISOString().split('T')[0],
                            }));
                            setShowCollectModal(true);
                          }}
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* New Group Modal */}
      <AnimatePresence>
        {showNewModal && (
          <div className="page-modal-overlay">
            <motion.div className="page-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <h2>New Chit Group</h2>
              <form onSubmit={handleCreateChit}>
                <label>Group Name</label>
                <input required value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} />
                <div className="form-grid-2">
                  <div>
                    <label>Total Value (₹)</label>
                    <input type="number" required value={form.total_value} onChange={e => setForm({ ...form, total_value: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Monthly Installment (₹)</label>
                    <input type="number" required value={form.monthly_installment} onChange={e => setForm({ ...form, monthly_installment: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div>
                    <label>Duration (Months)</label>
                    <input type="number" required value={form.duration_months} onChange={e => setForm({ ...form, duration_months: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Start Date</label>
                    <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
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
                <input type="date" required value={colForm.payment_date} onChange={e => setColForm({ ...colForm, payment_date: e.target.value })} />

                <label>Installment Paid (₹)</label>
                <input type="number" required value={colForm.amount} onChange={e => setColForm({ ...colForm, amount: Number(e.target.value) })} />

                <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="auction_won" checked={colForm.is_auction_won} onChange={e => setColForm({ ...colForm, is_auction_won: e.target.checked })} />
                  <label htmlFor="auction_won" style={{ margin: 0 }}>Did you win the auction this month?</label>
                </div>

                {colForm.is_auction_won && (
                  <div>
                    <label>Auction Payout Received (₹)</label>
                    <input type="number" required value={colForm.auction_amount_received} onChange={e => setColForm({ ...colForm, auction_amount_received: Number(e.target.value) })} />
                  </div>
                )}

                <label>Payment Mode</label>
                <select value={colForm.payment_mode} onChange={e => setColForm({ ...colForm, payment_mode: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", marginBottom: "8px" }}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>

                <label>Notes</label>
                <input value={colForm.notes} onChange={e => setColForm({ ...colForm, notes: e.target.value })} />

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
