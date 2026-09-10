import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../../../utils/api";
import "../../../styles/neo-neu-motion.css";

interface ChitGroup {
  id: number;
  group_name: string;
  chit_type: "internal" | "external";
  monthly_amount: number;
  duration_months: number;
  total_chit_value: number | null;
  start_date: string | null;
  status: string;
  member_count: number;
  total_collected: number;
  managed_by_name?: string;
}
interface Member {
  id: number;
  employee_id: number;
  employee_name: string;
  monthly_contribution: number | null;
  ticket_number: number | null;
  status: string;
  bid_amount: number | null;
  bid_month: number | null;
  received_chit: boolean;
  received_amount: number | null;
  total_paid: number;
}
interface HubUser { id: number; name: string; role: string; }

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const ChitManagement: React.FC = () => {
  const [groups, setGroups] = useState<ChitGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ChitGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [gf, setGf] = useState<Record<string, any>>({});

  const [showAddMember, setShowAddMember] = useState(false);
  const [users, setUsers] = useState<HubUser[]>([]);
  const [mf, setMf] = useState<Record<string, any>>({});

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/loan-chit/chit-groups");
      setGroups(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadGroups(); }, []);

  const loadMembers = async (g: ChitGroup) => {
    setSelected(g);
    const res = await apiFetch(`/loan-chit/chit-groups/${g.id}/members`);
    setMembers(res.ok ? await res.json() : []);
  };

  const createGroup = async () => {
    if (!gf.group_name?.trim() || !gf.monthly_amount || !gf.duration_months) return alert("Name, monthly amount and duration are required.");
    const res = await apiFetch("/loan-chit/chit-groups", { method: "POST", body: JSON.stringify(gf) });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    setShowNewGroup(false);
    setGf({});
    loadGroups();
  };

  const openAddMember = async () => {
    setShowAddMember(true);
    setMf({});
    const res = await apiFetch("/hub/users");
    setUsers(res.ok ? await res.json() : []);
  };
  const addMember = async () => {
    if (!selected || !mf.employee_id) return alert("Select an employee.");
    const res = await apiFetch(`/loan-chit/chit-groups/${selected.id}/members`, { method: "POST", body: JSON.stringify(mf) });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    setShowAddMember(false);
    loadMembers(selected);
    loadGroups();
  };

  const recordContribution = async (m: Member) => {
    const amt = prompt(`Contribution amount for ${m.employee_name} (₹):`, String(m.monthly_contribution || ""));
    if (!amt || Number(amt) <= 0) return;
    const res = await apiFetch(`/loan-chit/chit-memberships/${m.id}`, { method: "PUT", body: JSON.stringify({ add_contribution: Number(amt) }) });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    if (selected) loadMembers(selected);
    loadGroups();
  };
  const recordBid = async (m: Member) => {
    const bid = prompt(`Bid amount for ${m.employee_name} (₹):`, String(m.bid_amount || ""));
    if (!bid) return;
    const month = prompt("Bid month (number):", String(m.bid_month || ""));
    const recv = prompt("Amount received (₹):", bid);
    const res = await apiFetch(`/loan-chit/chit-memberships/${m.id}`, {
      method: "PUT",
      body: JSON.stringify({ bid_amount: Number(bid), bid_month: month ? Number(month) : undefined, received_chit: true, received_amount: recv ? Number(recv) : undefined, received_date: new Date().toISOString().split("T")[0] }),
    });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Failed.");
    if (selected) loadMembers(selected);
  };

  return (
    <div className="neo-page">
      <div className="neo-page-header">
        <div>
          <h1 className="neo-page-title">🎫 Chit Management</h1>
          <p className="neo-page-sub">Internal and external chit funds — groups, members, monthly contributions and bids.</p>
        </div>
        <div className="neo-page-actions">
          <button className="neo-btn-primary" onClick={() => { setShowNewGroup(true); setGf({}); }}>+ New Chit Group</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        {groups.length === 0 && <div style={{ color: "var(--neu-text-muted)", fontSize: 13 }}>{loading ? "Loading…" : "No chit groups yet."}</div>}
        {groups.map((g) => (
          <div key={g.id} className="neu-card" style={{ padding: 16, cursor: "pointer", borderLeft: `4px solid ${selected?.id === g.id ? "#5B4BFF" : "transparent"}` }} onClick={() => loadMembers(g)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{g.group_name}</div>
              <span className="neo-badge neo-badge-brand" style={{ fontSize: 9 }}>{g.chit_type}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--neu-text-muted)", marginTop: 6 }}>
              {fmt(g.monthly_amount)}/mo · {g.duration_months} months · {fmt(g.total_chit_value)}
            </div>
            <div style={{ fontSize: 12, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span>{g.member_count} members</span>
              <span style={{ fontWeight: 700, color: "#15803d" }}>{fmt(g.total_collected)} collected</span>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="neo-table-wrap">
          <div className="neo-table-header">
            <div className="neo-table-title">{selected.group_name} — Members</div>
            <button className="neo-btn-primary neo-btn-sm" onClick={openAddMember}>+ Add Member</button>
          </div>
          <div className="neo-table-scroll">
            <table className="neo-table">
              <thead>
                <tr><th>Ticket</th><th>Employee</th><th className="text-right">Monthly</th><th className="text-right">Total Paid</th><th>Bid</th><th>Received</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--neu-text-muted)", padding: 28 }}>No members yet.</td></tr>
                ) : members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.ticket_number ?? "—"}</td>
                    <td style={{ fontWeight: 700 }}>{m.employee_name}</td>
                    <td className="text-right">{fmt(m.monthly_contribution)}</td>
                    <td className="text-right" style={{ fontWeight: 700 }}>{fmt(m.total_paid)}</td>
                    <td>{m.bid_amount != null ? `${fmt(m.bid_amount)}${m.bid_month ? ` (mo ${m.bid_month})` : ""}` : "—"}</td>
                    <td>{m.received_chit ? fmt(m.received_amount) : "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{m.status}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="neo-btn-secondary neo-btn-sm" onClick={() => recordContribution(m)}>+ Contribution</button>
                        {!m.received_chit && <button className="neo-btn-primary neo-btn-sm" onClick={() => recordBid(m)}>Record Bid</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewGroup && createPortal(
        <div className="neo-modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header"><h3 className="neo-modal-title">New Chit Group</h3><button className="neo-modal-close" onClick={() => setShowNewGroup(false)}>×</button></div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 12 }}>
              <input className="neu-input" placeholder="Group name" value={gf.group_name || ""} onChange={(e) => setGf({ ...gf, group_name: e.target.value })} />
              <select className="neu-select" value={gf.chit_type || "internal"} onChange={(e) => setGf({ ...gf, chit_type: e.target.value })}>
                <option value="internal">Company Internal</option><option value="external">External</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="neu-input" type="number" placeholder="Monthly amount ₹" value={gf.monthly_amount || ""} onChange={(e) => setGf({ ...gf, monthly_amount: Number(e.target.value) })} />
                <input className="neu-input" type="number" placeholder="Duration (months)" value={gf.duration_months || ""} onChange={(e) => setGf({ ...gf, duration_months: Number(e.target.value) })} />
              </div>
              <input className="neu-input" type="date" value={gf.start_date || ""} onChange={(e) => setGf({ ...gf, start_date: e.target.value })} />
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setShowNewGroup(false)}>Cancel</button>
              <button className="neo-btn-primary" onClick={createGroup}>Create Group</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAddMember && createPortal(
        <div className="neo-modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="neo-modal neo-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="neo-modal-header"><h3 className="neo-modal-title">Add Member — {selected?.group_name}</h3><button className="neo-modal-close" onClick={() => setShowAddMember(false)}>×</button></div>
            <div className="neo-modal-body" style={{ display: "grid", gap: 12 }}>
              <select className="neu-select" value={mf.employee_id || ""} onChange={(e) => setMf({ ...mf, employee_id: Number(e.target.value) })}>
                <option value="">Select employee…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="neu-input" type="number" placeholder="Ticket number" value={mf.ticket_number || ""} onChange={(e) => setMf({ ...mf, ticket_number: Number(e.target.value) })} />
                <input className="neu-input" type="number" placeholder={`Monthly (${selected ? fmt(selected.monthly_amount) : ""})`} value={mf.monthly_contribution || ""} onChange={(e) => setMf({ ...mf, monthly_contribution: Number(e.target.value) })} />
              </div>
            </div>
            <div className="neo-modal-footer">
              <button className="neo-btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
              <button className="neo-btn-primary" onClick={addMember}>Add Member</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ChitManagement;
