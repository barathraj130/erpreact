import React, { useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaChartPie,
  FaCheckCircle,
  FaCoins,
  FaExclamationTriangle,
  FaHandshake,
  FaMoneyBillWave,
  FaPlus,
  FaTimesCircle,
  FaTimes,
  FaTrash,
  FaUsers,
} from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../finance/Finance.css";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChitFund {
  id: number;
  group_name: string;
  chit_value: number;
  monthly_contribution: number;
  total_members: number;
  duration_months: number;
  start_date: string;
  auction_type: string;
  organizer_commission: number;
  notes: string;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  total_collected: number;
  auction_amount: number;
  outstanding: number;
  months_completed: number;
  created_at: string;
}

interface Collection {
  id: number;
  chit_id: number;
  member_name: string;
  amount: number;
  month_number: number;
  payment_date: string;
  payment_mode: string;
  notes: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(Number(n || 0));

const pct = (part: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0;

const statusColors: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:    { bg: "#f0fdf4", color: "#16a34a", icon: <FaCheckCircle size={10} /> },
  COMPLETED: { bg: "#eff6ff", color: "#2563eb", icon: <FaChartPie size={10} /> },
  DEFAULTED: { bg: "#fef2f2", color: "#dc2626", icon: <FaExclamationTriangle size={10} /> },
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ChitManagement: React.FC = () => {
  const [chits, setChits] = useState<ChitFund[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedChit, setSelectedChit] = useState<ChitFund | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Form state - new chit
  const [form, setForm] = useState({
    group_name: "",
    chit_value: "",
    monthly_contribution: "",
    total_members: "",
    duration_months: "",
    start_date: new Date().toISOString().split("T")[0],
    auction_type: "OPEN",
    organizer_commission: "5",
    notes: "",
  });

  // Form state - collection
  const [colForm, setColForm] = useState({
    member_name: "",
    amount: "",
    month_number: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_mode: "CASH",
    notes: "",
  });

  // ── API calls ──────────────────────────────────────────────────────────────
  const fetchChits = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/chit-fund/schemes");
      const data = await res.json();
      setChits(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  async function fetchCollections(chitId: number) {
    try {
      const res = await apiFetch(`/chit-fund/schemes/${chitId}/collections`);
      const data = await res.json();
      setCollections(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { fetchChits(); }, []);

  const handleCreateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/chit-fund/schemes", {
        method: "POST",
        body: {
          ...form,
          chit_value: Number(form.chit_value),
          monthly_contribution: Number(form.monthly_contribution),
          total_members: Number(form.total_members),
          duration_months: Number(form.duration_months) || Number(form.total_members),
          organizer_commission: Number(form.organizer_commission),
        },
      });
      setShowNewModal(false);
      setForm({
        group_name: "", chit_value: "", monthly_contribution: "", total_members: "",
        duration_months: "", start_date: new Date().toISOString().split("T")[0],
        auction_type: "OPEN", organizer_commission: "5", notes: "",
      });
      fetchChits();
    } catch (e) {
      alert("Failed to create chit fund.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChit) return;
    setLoading(true);
    try {
      await apiFetch(`/chit-fund/schemes/${selectedChit.id}/collections`, {
        method: "POST",
        body: {
          ...colForm,
          amount: Number(colForm.amount),
          month_number: Number(colForm.month_number),
        },
      });
      setShowCollectModal(false);
      setColForm({
        member_name: "", amount: "", month_number: "",
        payment_date: new Date().toISOString().split("T")[0],
        payment_mode: "CASH", notes: "",
      });
      await fetchCollections(selectedChit.id);
      fetchChits();
    } catch (e) {
      alert("Failed to record collection.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChit = async (id: number) => {
    if (!window.confirm("Delete this chit fund and all its records?")) return;
    try {
      await apiFetch(`/chit-fund/schemes/${id}`, { method: "DELETE" });
      if (selectedChit?.id === id) setSelectedChit(null);
      fetchChits();
    } catch (e) {
      alert("Failed to delete.");
    }
  };

  const handleDeleteCollection = async (colId: number) => {
    if (!window.confirm("Remove this collection entry?")) return;
    try {
      await apiFetch(`/chit-fund/collections/${colId}`, { method: "DELETE" });
      if (selectedChit) fetchCollections(selectedChit.id);
      fetchChits();
    } catch (e) {
      alert("Failed to delete.");
    }
  };

  const openChitDetail = async (chit: ChitFund) => {
    setSelectedChit(chit);
    await fetchCollections(chit.id);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    totalValue: chits.reduce((s, c) => s + c.chit_value, 0),
    totalCollected: chits.reduce((s, c) => s + c.total_collected, 0),
    activeCount: chits.filter((c) => c.status === "ACTIVE").length,
    outstanding: chits.reduce((s, c) => s + Math.max(0, c.outstanding), 0),
  };

  const filteredChits = chits.filter((c) => {
    if (activeTab === "active") return c.status === "ACTIVE";
    if (activeTab === "completed") return c.status === "COMPLETED";
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="finance-container page-container" style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1300px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <style>{`
        .cm-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
        .cm-input { width:100%; height:40px; padding:0 12px; border:1px solid #e2e8f0; border-radius:9px; background:#fff; font-size:13px; font-family:inherit; color:#0f172a; box-sizing:border-box; transition:border-color .15s; }
        .cm-input:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.08); }
        select.cm-input { cursor:pointer; }
        .cm-label { display:block; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; margin-bottom:5px; }
        .cm-btn-primary { height:40px; padding:0 24px; border-radius:100px; background:#111110; color:#fff; font-size:0.85rem; font-weight:700; border:none; cursor:pointer; font-family:inherit; transition:background .2s; display:inline-flex; align-items:center; gap:8px;}
        .cm-btn-primary:hover { background:#1e293b; }
        .cm-btn-secondary { height:40px; padding:0 20px; border-radius:100px; background:#fff; color:#5c5c58; font-size:0.85rem; font-weight:600; border:1px solid #e8e8e5; cursor:pointer; font-family:inherit; transition:all .2s; }
        .cm-btn-secondary:hover { background:#f7f7f6; }
        .cm-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:.3px; text-transform:uppercase; }
        .cm-progress-bar { height:6px; border-radius:999px; background:#f0f0ee; overflow:hidden; }
        .cm-progress-fill { height:100%; border-radius:999px; transition:width .4s ease; }
        .cm-overlay { position:fixed; inset:0; background:rgba(17, 17, 16, 0.4); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; }
        .cm-modal { background:#fff; border-radius:24px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; box-shadow:0 12px 48px rgba(0,0,0,0.12); animation:cmSlide .2s cubic-bezier(.22,1,.36,1); border: 1px solid #e8e8e5; }
        @keyframes cmSlide { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .cm-modal-header { padding:24px; border-bottom:1px solid #f0f0ee; display:flex; align-items:center; justify-content:space-between; }
        .cm-modal-body { padding:24px; display:grid; gap:16px; }
        .cm-modal-footer { padding:16px 24px; border-top:1px solid #f0f0ee; display:flex; justify-content:flex-end; gap:12px; background: #fafafa; }
        .cm-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .cm-chit-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; cursor:pointer; transition:all .15s; }
        .cm-chit-card:hover { border-color:#2563eb; box-shadow:0 4px 16px rgba(37,99,235,.1); transform:translateY(-1px); }
        .cm-chit-card.selected { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
        .cm-tab { height:34px; padding:0 14px; border-radius:8px; border:none; background:transparent; color:#64748b; font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; }
        .cm-tab.active { background:#0f172a; color:#fff; }
        .cm-empty { padding:60px 20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; }
        .cm-empty-icon { width:52px; height:52px; border-radius:14px; background:#f1f5f9; display:grid; place-items:center; color:#94a3b8; font-size:20px; }
        .cm-detail-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f8fafc; font-size:13px; }
        .cm-detail-row:last-child { border-bottom:none; }
      `}</style>

      {/* ── Page Header ── */}
      <div
        className="finance-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "32px",
          padding: isMobile ? "10px 10px 20px 10px" : "10px",
          fontFamily: "'Satoshi', sans-serif"
        }}
      >
        <div>
          <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.4px", lineHeight: 1.3, margin: 0, color: "#111110" }}>
            Chit Fund Management
          </h1>
          <p style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}>
            Track chit groups, monthly collections & auctions.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowNewModal(true)}
          style={{
            height: "48px",
            padding: "0 32px",
            borderRadius: "100px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#1E293B",
            color: "#fff",
            border: "none",
            fontSize: "0.9rem",
            width: isMobile ? "100%" : "auto",
            justifyContent: "center",
            marginTop: isMobile ? "16px" : "0"
          }}
        >
          <FaPlus size={14} /> New Chit Fund
        </button>
      </div>

{/* ── Summary Cards ── */}
      <div className="stats-grid" style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", 
          gap: isMobile ? "12px" : "16px",
          marginBottom: "32px"
      }}>
        {[
  { label: "Total Chit Value", value: fmt(stats.totalValue), bg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", color: "#3b82f6", subtitle: "All registered chits", accent: "#3b82f6" },
  { label: "Total Collected", value: fmt(stats.totalCollected), bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", color: "#10b981", subtitle: "Pool amount", accent: "#10b981" },
  { label: "Total Funds", value: fmt(stats.totalFundValue), bg: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", color: "#f97316", subtitle: "Total value", accent: "#f97316" },
  { label: "Active Groups", value: String(stats.activeCount), bg: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", color: "#8b5cf6", subtitle: "Running funds", accent: "#8b5cf6" },
  { label: "Outstanding", value: fmt(stats.outstanding), bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", color: "#d97706", subtitle: "To be collected", accent: "#d97706" },
        ].map((s, idx) => (
          <div key={s.label} style={{ 
            padding: isMobile ? "18px" : "20px", 
            borderRadius: "20px", 
            display: "flex", 
            flexDirection: "column", 
            background: s.bg, 
            border: `1px solid ${s.accent}40`, 
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
            animation: "chitCardFadeIn 0.5s ease-out forwards",
            opacity: 0,
            transform: "translateY(20px)",
            animationDelay: `${idx * 0.1}s`
          }}>
            <style>{`@keyframes chitCardFadeIn { to { opacity: 1; transform: translateY(0); } }`}</style>
            {/* Shimmer effect */}
            <div style={{
              position: "absolute",
              top: "-30%",
              left: "-30%",
              width: "160%",
              height: "160%",
              background: `radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)`,
              filter: "blur(12px)",
              opacity: 0.25,
              animation: `chitShimmer${idx} 3s ease-in-out infinite`,
              pointerEvents: "none"
            }} />
            <style>{`
              @keyframes chitShimmer${idx} {
                0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.25; }
                50% { transform: translate(10%, 10%) scale(1.1); opacity: 0.4; }
              }
            `}</style>
            <div style={{ 
              position: "absolute", 
              bottom: 0, 
              left: 0, 
              right: 0, 
              height: "4px", 
              background: `linear-gradient(90deg, ${s.accent}, ${s.accent}50, transparent)`,
              borderRadius: "0 0 20px 20px"
            }} />
            <h3 style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "8px" }}>{s.label}</h3>
            <p style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "4px 0 8px 0", letterSpacing: "-0.5px" }}>
              {s.value}
            </p>
            <span style={{ fontSize: "12px", color: "#64748b" }}>{s.subtitle}</span>
          </div>
        ))}
      </div>

      {/* ── Main Two-Col Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : selectedChit ? "minmax(0,1fr) 420px" : "1fr", gap: "24px", alignItems: "start" }}>

        {/* ── Left: Chit List ── */}
        <div className="table-wrapper card" style={{ padding: isMobile ? "16px" : "24px", overflow: "hidden", borderRadius: "20px", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px" }}>
            {(["all", "active", "completed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  background: activeTab === t ? "#0f172a" : "transparent",
                  color: activeTab === t ? "#fff" : "#64748b",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === "all" && chits.length > 0 && (
                  <span style={{ background: activeTab === t ? "rgba(255,255,255,0.2)" : "#f0f0ee", color: activeTab === t ? "#fff" : "#5c5c58", padding: "2px 8px", borderRadius: "100px", fontSize: "0.75rem" }}>
                    {chits.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading && chits.length === 0 ? (
            <div style={{ padding: "40px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {[1,2,3].map((n) => <div key={n} style={{ height: "100px", borderRadius: "16px", background: "linear-gradient(90deg, #f0f0ee 25%, #e8e8e5 50%, #f0f0ee 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />)}
            </div>
          ) : filteredChits.length === 0 ? (
            <div style={{ padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#f7f7f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9b9b96" }}>
                <FaCoins size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111110", marginBottom: "4px" }}>No Chit Funds Found</h3>
                <p style={{ color: "#9b9b96", fontSize: "0.9rem" }}>Click "New Chit Fund" to set up your first group.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {filteredChits.map((c) => {
                const prog = pct(c.total_collected, c.chit_value);
                const sc = statusColors[c.status] || statusColors.ACTIVE;
                return (
                  <div
                    key={c.id}
                    onClick={() => openChitDetail(c)}
                    style={{
                      background: selectedChit?.id === c.id ? "#f7f7f6" : "#fff",
                      border: "1px solid",
                      borderColor: selectedChit?.id === c.id ? "#111110" : "#e8e8e5",
                      borderRadius: "16px",
                      padding: "20px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: selectedChit?.id === c.id ? "0 4px 12px rgba(0,0,0,0.05)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#111110", marginBottom: "4px" }}>{c.group_name}</div>
                        <div style={{ fontSize: "0.85rem", color: "#5c5c58", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>{c.total_members} members</span>
                          <span>•</span>
                          <span>{c.duration_months} months</span>
                          <span>•</span>
                          <span>Starts {c.start_date}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: "4px 12px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                          {sc.icon} {c.status}
                        </span>
                        <button
                          style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteChit(c.id); }}
                          title="Delete"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px", background: "#f7f7f6", padding: "12px", borderRadius: "12px" }}>
                      {[
                        { label: "Chit Value", val: fmt(c.chit_value) },
                        { label: "Collected", val: fmt(c.total_collected) },
                        { label: "Outstanding", val: fmt(Math.max(0, c.outstanding)) },
                      ].map((x) => (
                        <div key={x.label}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9b9b96", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{x.label}</div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111110" }}>{x.val}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "0.8rem", color: "#5c5c58", fontWeight: 600 }}>Collection Progress</span>
                        <span style={{ fontSize: "0.8rem", color: "#111110", fontWeight: 700 }}>{prog}%</span>
                      </div>
                      <div style={{ height: "8px", borderRadius: "100px", background: "#f0f0ee", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${prog}%`, background: prog >= 100 ? "#16a34a" : "#111110", transition: "width 0.4s ease", borderRadius: "100px" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Chit Detail ── */}
        {selectedChit && (
          <div className="card" style={{ padding: "0", overflow: "hidden", borderRadius: "20px", border: "1px solid rgba(0,0,0,0.04)", background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
            {/* Detail header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0ee", background: "#fcfcfb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9b9b96", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Chit Detail</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111110" }}>{selectedChit.group_name}</div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-primary"
                  style={{ height: "36px", padding: "0 16px", fontSize: "0.85rem", borderRadius: "8px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", background: "#111110", color: "#fff", border: "none", cursor: "pointer" }}
                  onClick={() => setShowCollectModal(true)}
                >
                  <FaPlus size={10} /> Collect
                </button>
                <button
                  style={{ width: "36px", height: "36px", borderRadius: "8px", border: "1px solid #e8e8e5", background: "#fff", color: "#5c5c58", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                  onClick={() => setSelectedChit(null)}
                >
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            {/* Fund info */}
            <div style={{ padding: "24px" }}>
              <div style={{ display: "grid", gap: "12px", marginBottom: "24px" }}>
                {[
                  { label: "Chit Value", val: fmt(selectedChit.chit_value) },
                  { label: "Monthly Contribution", val: fmt(selectedChit.monthly_contribution) },
                  { label: "Duration", val: `${selectedChit.duration_months} months` },
                  { label: "Auction Type", val: selectedChit.auction_type },
                  { label: "Commission", val: `${selectedChit.organizer_commission}%` }
                ].map((r) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #f7f7f6" }}>
                    <span style={{ color: "#5c5c58", fontSize: "0.9rem", fontWeight: 500 }}>{r.label}</span>
                    <span style={{ fontWeight: 600, color: "#111110", fontSize: "0.95rem" }}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div style={{ padding: "20px", background: "#fcfcfb", borderRadius: "16px", border: "1px solid #f0f0ee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#9b9b96", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: "4px" }}>Total Collected</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#16a34a" }}>{fmt(selectedChit.total_collected)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "#9b9b96", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: "4px" }}>Outstanding</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>{fmt(Math.max(0, selectedChit.outstanding))}</div>
                  </div>
                </div>
                
                <div style={{ height: "8px", borderRadius: "100px", background: "#e8e8e5", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${pct(selectedChit.total_collected, selectedChit.chit_value)}%`,
                    background: "#111110",
                    borderRadius: "100px",
                    transition: "width 0.4s ease"
                  }} />
                </div>
                <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#9b9b96", marginTop: "8px", fontWeight: 600 }}>
                  {pct(selectedChit.total_collected, selectedChit.chit_value)}% of target
                </div>
              </div>
            </div>

            {/* Collections list */}
            <div style={{ borderTop: "1px solid #f0f0ee", background: "#fafafa" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0ee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#5c5c58", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Collection History ({collections.length})
                </span>
              </div>
              
              {collections.length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center", color: "#9b9b96" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#f0f0ee", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <FaMoneyBillWave size={20} style={{ opacity: 0.5 }} />
                  </div>
                  <p style={{ fontSize: "0.9rem", margin: 0 }}>No collections recorded yet.</p>
                </div>
              ) : (
                <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                  {collections.map((col) => (
                    <div key={col.id} style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0ee", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#111110", marginBottom: "4px" }}>{col.member_name}</div>
                        <div style={{ fontSize: "0.8rem", color: "#9b9b96", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>Month {col.month_number}</span>
                          <span>•</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><FaCalendarAlt size={10} /> {col.payment_date}</span>
                          <span>•</span>
                          <span>{col.payment_mode}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#16a34a" }}>{fmt(col.amount)}</span>
                        <button
                          style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1px solid rgba(220, 38, 38, 0.2)", background: "rgba(220, 38, 38, 0.05)", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                          onClick={() => handleDeleteCollection(col.id)}
                          title="Remove"
                        >
                          <FaTimes size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── New Chit Fund Modal ── */}
      {showNewModal && (
        <div className="cm-overlay" onClick={() => setShowNewModal(false)}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 2 }}>Finance › Chit Funds</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Register New Chit Fund</div>
              </div>
              <button style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center", color: "#64748b" }} onClick={() => setShowNewModal(false)}>
                <FaTimes size={13} />
              </button>
            </div>
            <form onSubmit={handleCreateChit}>
              <div className="cm-modal-body">
                <div>
                  <label className="cm-label">Group Name *</label>
                  <input className="cm-input" required placeholder="e.g. Neighborhood Chit 2025" value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} />
                </div>
                <div className="cm-row">
                  <div>
                    <label className="cm-label">Chit Value (₹) *</label>
                    <input className="cm-input" type="number" required placeholder="e.g. 100000" value={form.chit_value} onChange={(e) => setForm({ ...form, chit_value: e.target.value })} />
                  </div>
                  <div>
                    <label className="cm-label">Monthly Contribution (₹) *</label>
                    <input className="cm-input" type="number" required placeholder="e.g. 10000" value={form.monthly_contribution} onChange={(e) => setForm({ ...form, monthly_contribution: e.target.value })} />
                  </div>
                </div>
                <div className="cm-row">
                  <div>
                    <label className="cm-label">Total Members *</label>
                    <input className="cm-input" type="number" required placeholder="e.g. 10" value={form.total_members} onChange={(e) => setForm({ ...form, total_members: e.target.value })} />
                  </div>
                  <div>
                    <label className="cm-label">Duration (Months)</label>
                    <input className="cm-input" type="number" placeholder="Same as members" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} />
                  </div>
                </div>
                <div className="cm-row">
                  <div>
                    <label className="cm-label">Start Date</label>
                    <input className="cm-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="cm-label">Auction Type</label>
                    <select className="cm-input" value={form.auction_type} onChange={(e) => setForm({ ...form, auction_type: e.target.value })}>
                      <option value="OPEN">Open Auction</option>
                      <option value="LUCKY">Lucky Draw</option>
                      <option value="TENDER">Reverse Tender</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="cm-label">Organizer Commission (%)</label>
                  <input className="cm-input" type="number" step="0.5" value={form.organizer_commission} onChange={(e) => setForm({ ...form, organizer_commission: e.target.value })} />
                </div>
                <div>
                  <label className="cm-label">Notes</label>
                  <input className="cm-input" placeholder="Optional remarks" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="cm-modal-footer">
                <button type="button" className="cm-btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
                <button type="submit" className="cm-btn-primary" disabled={loading}>{loading ? "Creating…" : "Create Chit Fund"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record Collection Modal ── */}
      {showCollectModal && selectedChit && (
        <div className="cm-overlay" onClick={() => setShowCollectModal(false)}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 2 }}>{selectedChit.group_name}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Record Monthly Collection</div>
              </div>
              <button style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center", color: "#64748b" }} onClick={() => setShowCollectModal(false)}>
                <FaTimes size={13} />
              </button>
            </div>
            <form onSubmit={handleRecordCollection}>
              <div className="cm-modal-body">
                <div>
                  <label className="cm-label">Member Name *</label>
                  <input className="cm-input" required placeholder="Enter member name" value={colForm.member_name} onChange={(e) => setColForm({ ...colForm, member_name: e.target.value })} />
                </div>
                <div className="cm-row">
                  <div>
                    <label className="cm-label">Amount (₹) *</label>
                    <input className="cm-input" type="number" required placeholder={`e.g. ${selectedChit.monthly_contribution}`} value={colForm.amount} onChange={(e) => setColForm({ ...colForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="cm-label">Month Number *</label>
                    <input className="cm-input" type="number" required min={1} max={selectedChit.duration_months} placeholder={`1–${selectedChit.duration_months}`} value={colForm.month_number} onChange={(e) => setColForm({ ...colForm, month_number: e.target.value })} />
                  </div>
                </div>
                <div className="cm-row">
                  <div>
                    <label className="cm-label">Payment Date</label>
                    <input className="cm-input" type="date" value={colForm.payment_date} onChange={(e) => setColForm({ ...colForm, payment_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="cm-label">Payment Mode</label>
                    <select className="cm-input" value={colForm.payment_mode} onChange={(e) => setColForm({ ...colForm, payment_mode: e.target.value })}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="cm-label">Notes</label>
                  <input className="cm-input" placeholder="Optional" value={colForm.notes} onChange={(e) => setColForm({ ...colForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="cm-modal-footer">
                <button type="button" className="cm-btn-secondary" onClick={() => setShowCollectModal(false)}>Cancel</button>
                <button type="submit" className="cm-btn-primary" disabled={loading}>{loading ? "Saving…" : "Record Collection"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChitManagement;
