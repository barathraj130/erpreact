import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaHandshake, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaFileContract,
  FaBoxOpen, FaGem, FaMoneyCheckAlt, FaHistory, FaExclamationTriangle,
} from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import { useAuthUser } from "../../hooks/useAuthUser";
import "../PageShared.css";

const fmt = (n: any) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fffbeb", fg: "#b45309" },
  approved: { bg: "#f0fdf4", fg: "#16a34a" },
  rejected: { bg: "#fef2f2", fg: "#dc2626" },
  voided: { bg: "#f1f5f9", fg: "#64748b" },
};

const HISTORY_ICONS: Record<string, React.ReactNode> = {
  created: <FaHandshake color="#4f46e5" />,
  approved: <FaCheckCircle color="#16a34a" />,
  rejected: <FaTimesCircle color="#dc2626" />,
  legal_transfer_confirmed: <FaFileContract color="#16a34a" />,
};

export default function SettlementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/settlements/${id}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (path: string, body?: any, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await apiFetch(path, { method: "POST", body });
      const result = await res.json();
      if (!result.success) { alert(result.error || "Action failed"); return; }
      await load();
    } catch (e: any) {
      alert(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="page-empty" style={{ margin: 40 }}>Loading…</div>;
  if (!data || data.error || !data.settlement) return <div className="page-empty" style={{ margin: 40 }}>Settlement not found.</div>;

  const { settlement: s, invoice_links, goods, assets, cheques, history } = data;
  const style = STATUS_STYLES[s.status] || STATUS_STYLES.pending;
  const awaitingTransfer = s.is_conditional && !s.legal_transfer_done && s.status === "approved";

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1><FaHandshake style={{ marginRight: 10, opacity: 0.7 }} />{s.settlement_number}</h1>
          <p>{s.customer_name} · {new Date(s.settlement_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, background: style.bg, color: style.fg, textTransform: "uppercase", height: "fit-content" }}>
          {s.status}
        </span>
      </div>

      {awaitingTransfer && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ color: "#92400e", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <FaHourglassHalf /> Awaiting Legal Transfer
          </span>
          {isAdmin && (
            <button className="page-btn-round page-btn-round-primary" disabled={busy} onClick={() => runAction(`/settlements/${id}/confirm-transfer`, undefined, "Confirm legal transfer is done? This will reduce the customer's outstanding balance.")}>
              Confirm Transfer Done
            </button>
          )}
        </div>
      )}

      <div className="premium-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card card-indigo"><div className="label">Total Value</div><div className="value" style={{ fontSize: 20 }}>{fmt(s.total_value)}</div></div>
        <div className="stat-card card-emerald"><div className="label">Outstanding Before</div><div className="value" style={{ fontSize: 20 }}>{fmt(s.outstanding_before)}</div></div>
        <div className="stat-card card-amber"><div className="label">Outstanding After</div><div className="value" style={{ fontSize: 20 }}>{fmt(s.outstanding_after)}</div></div>
        <div className="stat-card"><div className="label">Type</div><div className="value" style={{ fontSize: 18, textTransform: "capitalize" }}>{s.settlement_type.replace("_", " ")}</div></div>
      </div>

      {goods.length > 0 && (
        <>
          <h3 style={{ margin: "24px 0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><FaBoxOpen /> Goods</h3>
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead><tr><th>Description</th><th>Qty</th><th>Condition</th><th className="text-right">Rate</th><th className="text-right">Total</th><th>Stock Type</th></tr></thead>
              <tbody>
                {goods.map((g: any) => (
                  <tr key={g.id}>
                    <td>{g.description}</td><td>{g.quantity} {g.unit}</td><td style={{ textTransform: "capitalize" }}>{g.condition}</td>
                    <td className="text-right">{fmt(g.rate)}</td><td className="text-right font-bold">{fmt(g.total_value)}</td>
                    <td style={{ textTransform: "capitalize" }}>{g.stock_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {assets.length > 0 && (
        <>
          <h3 style={{ margin: "24px 0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><FaGem /> Assets</h3>
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead><tr><th>Name</th><th>Type</th><th>Condition</th><th className="text-right">Agreed Value</th><th>Serial #</th><th className="text-center">Status</th>{isAdmin && <th className="text-center">Actions</th>}</tr></thead>
              <tbody>
                {assets.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.asset_name}</td><td>{a.asset_type}</td><td style={{ textTransform: "capitalize" }}>{a.condition}</td>
                    <td className="text-right font-bold">{fmt(a.agreed_value)}</td><td className="font-mono">{a.serial_number || "—"}</td>
                    <td className="text-center" style={{ textTransform: "capitalize" }}>{a.disposal_status.replace("_", " ")}</td>
                    {isAdmin && (
                      <td className="text-center">
                        {a.disposal_status === "held" ? (
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="page-btn-round-sm" disabled={busy} onClick={() => {
                              const val = window.prompt("Sold for how much?", String(a.agreed_value));
                              if (val === null) return;
                              runAction(`/settlements/assets/${a.id}/dispose`, { disposal_status: "sold", disposal_value: parseFloat(val) || 0 });
                            }}>Mark Sold</button>
                            <button className="page-btn-round-sm" disabled={busy} onClick={() => runAction(`/settlements/assets/${a.id}/dispose`, { disposal_status: "returned" })}>Mark Returned</button>
                            <button className="page-btn-round-danger" disabled={busy} onClick={() => runAction(`/settlements/assets/${a.id}/dispose`, { disposal_status: "written_off" })}>Write Off</button>
                          </div>
                        ) : <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {cheques.length > 0 && (
        <>
          <h3 style={{ margin: "24px 0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><FaMoneyCheckAlt /> Cheques</h3>
          <div className="page-table-wrapper">
            <table className="page-table">
              <thead><tr><th>Bank</th><th>Cheque #</th><th>Date</th><th className="text-right">Amount</th><th className="text-center">Status</th>{isAdmin && <th className="text-center">Actions</th>}</tr></thead>
              <tbody>
                {cheques.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.bank_name}</td><td className="font-mono">{c.cheque_number}</td>
                    <td>{new Date(c.cheque_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                    <td className="text-right font-bold">{fmt(c.amount)}</td>
                    <td className="text-center" style={{ textTransform: "capitalize" }}>{c.status}</td>
                    {isAdmin && (
                      <td className="text-center">
                        {c.status === "pending" ? (
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="page-btn-round-sm" disabled={busy} onClick={() => runAction(`/settlements/cheques/${c.id}/cleared`, {})}>Mark Cleared</button>
                            <button className="page-btn-round-danger" disabled={busy} onClick={() => {
                              const reason = window.prompt("Bounce reason?");
                              if (reason === null) return;
                              const charges = window.prompt("Bank charges (if any)?", "0");
                              runAction(`/settlements/cheques/${c.id}/bounced`, { bounce_reason: reason, bank_charges: parseFloat(charges || "0") || 0 });
                            }}>Mark Bounced</button>
                          </div>
                        ) : <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 style={{ margin: "24px 0 10px", fontSize: 14 }}>Invoice Allocations</h3>
      <div className="page-table-wrapper">
        <table className="page-table">
          <thead><tr><th>Invoice #</th><th className="text-right">Allocated</th></tr></thead>
          <tbody>
            {invoice_links.map((l: any) => (
              <tr key={l.id}><td className="font-mono">{l.invoice_number}</td><td className="text-right font-bold">{fmt(l.amount_allocated)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {s.status === "pending" && isAdmin && (
        <div style={{ marginTop: 24, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="page-btn-round page-btn-round-primary"
            disabled={busy}
            onClick={() => runAction(`/settlements/${id}/approve`, undefined, "Approve this settlement? This will update invoices and reduce the customer's outstanding balance.")}
          >
            Approve
          </button>
          {!showReject ? (
            <button className="page-btn-round-danger" onClick={() => setShowReject(true)}>Reject</button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
              <input
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-soft)", fontSize: 13 }}
                placeholder="Reason for rejection…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <button
                className="page-btn-round-danger"
                disabled={busy || rejectReason.trim().length < 3}
                onClick={() => runAction(`/settlements/${id}/reject`, { reason: rejectReason })}
              >
                Confirm Reject
              </button>
              <button className="page-btn-round" onClick={() => setShowReject(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {s.status === "rejected" && s.rejection_reason && (
        <div style={{ marginTop: 20, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", color: "#dc2626", fontSize: 13, display: "flex", gap: 8 }}>
          <FaExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }} /> Rejected: {s.rejection_reason}
        </div>
      )}

      <h3 style={{ margin: "28px 0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><FaHistory /> Audit Timeline</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map((h: any) => (
          <div key={h.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8 }}>
            <div style={{ marginTop: 2 }}>{HISTORY_ICONS[h.action] || <FaHandshake color="#64748b" />}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{h.action.replace(/_/g, " ")}</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>{h.notes}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{h.done_by_name || "System"} · {fmtDate(h.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
