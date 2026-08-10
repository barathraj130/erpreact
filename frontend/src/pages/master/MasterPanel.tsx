import React, { useEffect, useState } from "react";
import { masterFetch } from "./masterApi";
import "../../styles/aurora.css";

interface DashboardData {
  company_stats: Record<string, number>;
  revenue_stats: { mrr: number; arr: number };
  invoice_stats: { total_invoices: number; companies_with_invoices: number };
  recent_companies: any[];
  plan_distribution: { plan_name: string; count: number; plan_revenue: number }[];
}

interface Tenant {
  id: number;
  company_name: string;
  company_code: string;
  email?: string;
  city_pincode?: string;
  plan_name?: string;
  subscription_status?: string;
  monthly_price?: number;
  max_users?: number;
  active_users?: number;
  total_invoices?: number;
  total_billed?: number;
  days_remaining?: number;
  created_at: string;
}

const fmt = (n: any) => parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const useMasterAuth = () => {
  const [user] = useState<any>(() => JSON.parse(localStorage.getItem("master_user") || "{}"));
  const logout = () => {
    localStorage.removeItem("master_token");
    localStorage.removeItem("master_user");
    window.location.href = "/fluxora-master";
  };
  return { user, logout };
};

const STATUS_COLOR: Record<string, string> = { ACTIVE: "#10b981", TRIAL: "#f59e0b", SUSPENDED: "#ef4444", EXPIRED: "#dc2626" };

const MasterPanel: React.FC = () => {
  const { user, logout } = useMasterAuth();
  const [activeSection, setActiveSection] = useState<"dashboard" | "tenants" | "create" | "announcements" | "health" | "audit">("dashboard");
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<number | null>(null);
  const [planEditor, setPlanEditor] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("master_token")) { window.location.href = "/fluxora-master"; return; }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSection === "audit") fetchAuditLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dash, tenantList, healthData] = await Promise.all([
        masterFetch("/master/dashboard").then((r) => r.json()),
        masterFetch("/master/tenants").then((r) => r.json()),
        masterFetch("/master/system-health").then((r) => r.json()),
      ]);
      setDashData(dash);
      setTenants(Array.isArray(tenantList) ? tenantList : []);
      setHealth(healthData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    const res = await masterFetch("/master/audit-log");
    setAuditLog(await res.json());
  };

  const impersonateTenant = async (companyId: number, companyName: string) => {
    if (!window.confirm(`Login as ${companyName}'s admin? A new tab will open with full access to their ERP.`)) return;
    setImpersonating(companyId);
    try {
      const res = await masterFetch(`/master/tenants/${companyId}/impersonate`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // localStorage is shared per-origin across tabs, so writing it here and
        // opening a new tab is enough — the new tab picks it up on load. This
        // does overwrite any tenant session already open in this browser profile.
        localStorage.setItem("erp-token", data.tenant_token);
        window.open("/dashboard", "_blank");
      } else {
        alert(data.error);
      }
    } finally {
      setImpersonating(null);
    }
  };

  const suspendTenant = async (companyId: number) => {
    const reason = window.prompt("Suspension reason:");
    if (!reason) return;
    const res = await masterFetch(`/master/tenants/${companyId}/suspend`, { method: "POST", body: { reason } });
    const data = await res.json();
    if (data.success) { alert("Company suspended"); fetchAll(); } else alert(data.error);
  };

  const activateTenant = async (companyId: number) => {
    const expiry = window.prompt("Subscription end date (YYYY-MM-DD), or leave blank for +30 days:");
    const res = await masterFetch(`/master/tenants/${companyId}/activate`, { method: "POST", body: { expiry_date: expiry || null } });
    const data = await res.json();
    if (data.success) { alert("Company activated"); fetchAll(); } else alert(data.error);
  };

  const cs = dashData?.company_stats || {};
  const rs = dashData?.revenue_stats || { mrr: 0, arr: 0 };

  return (
    <div style={{ minHeight: "100vh", background: "#070B16", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: "#f1f5f9", position: "relative" }}>
      {/* AURORA AMBIENT — top of page */}
      <div style={{ position: "fixed", top: 62, left: 0, right: 0, height: "45vh", pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 30% 0%, rgba(91,75,255,0.07) 0%, transparent 55%)" }} />

      {/* TOP BAR */}
      <div style={{ background: "rgba(13,20,38,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "0.5px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 62, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#5B4BFF,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, boxShadow: "0 4px 14px rgba(91,75,255,0.45)" }}>F</div>
          <span style={{ fontSize: 16, fontWeight: 800 }}>Fluxora</span>
          <span style={{ fontSize: 10, background: "rgba(91,75,255,0.18)", color: "#7C6CFF", padding: "2px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: "0.09em" }}>MASTER</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { id: "dashboard" as const, label: "📊 Dashboard" },
            { id: "tenants" as const, label: "🏢 Tenants" },
            { id: "create" as const, label: "➕ New Tenant" },
            { id: "announcements" as const, label: "📢 Announce" },
            { id: "health" as const, label: "💚 Health" },
            { id: "audit" as const, label: "📋 Audit Log" },
          ].map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: activeSection === s.id ? "linear-gradient(135deg,#5B4BFF,#7C6CFF)" : "transparent", color: activeSection === s.id ? "#fff" : "#94a3b8", boxShadow: activeSection === s.id ? "0 4px 14px rgba(91,75,255,0.35)" : "none", transition: "all 150ms" }}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>{user.name} — Master</span>
          <button onClick={logout} style={{ padding: "6px 14px", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 8, background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: 24, position: "relative", zIndex: 1 }}>
        {loading && <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading platform data…</div>}

        {!loading && activeSection === "dashboard" && dashData && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "MRR", value: `₹${fmt(rs.mrr)}`, color: "#10b981", icon: "💰" },
                { label: "ARR", value: `₹${fmt(rs.arr)}`, color: "#5B4BFF", icon: "📈" },
                { label: "Active", value: cs.active_companies || 0, color: "#10b981", icon: "✅" },
                { label: "Trial", value: cs.trial_companies || 0, color: "#f59e0b", icon: "⏳" },
                { label: "Trials Expiring", value: cs.trials_expiring_7d || 0, color: "#ef4444", icon: "⚠️" },
                { label: "Suspended", value: cs.suspended_companies || 0, color: "#dc2626", icon: "🚫" },
              ].map((card, i) => (
                <div key={i} style={{
                  background: "#0D1426", borderRadius: 14, padding: "18px 18px 16px", position: "relative", overflow: "hidden",
                  border: `0.5px solid ${card.color}25`,
                  boxShadow: "6px 6px 16px rgba(0,0,0,0.40), -4px -4px 12px rgba(255,255,255,0.02), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
                  transition: "all 200ms ease", cursor: "default",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `6px 6px 20px rgba(0,0,0,0.45), -4px -4px 12px rgba(255,255,255,0.02), 0 0 24px ${card.color}18`; e.currentTarget.style.borderColor = `${card.color}40`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "6px 6px 16px rgba(0,0,0,0.40), -4px -4px 12px rgba(255,255,255,0.02), 0 0 0 0.5px rgba(255,255,255,0.04) inset"; e.currentTarget.style.borderColor = `${card.color}25`; }}
                >
                  <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: `radial-gradient(circle, ${card.color}18 0%, transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{card.icon}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em" }}>{card.label.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <div style={{ background: "#0D1426", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.07)", overflow: "hidden", boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", fontSize: 14, fontWeight: 700 }}>Recent Companies</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.20)" }}>
                      {["Company", "Plan", "Status", "MRR", "Joined"].map((h, i) => (
                        <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dashData.recent_companies || []).map((t, i) => (
                      <tr key={i} style={{ borderTop: "0.5px solid rgba(255,255,255,0.04)", transition: "background 150ms" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(91,75,255,0.05)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{t.company_name}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "rgba(91,75,255,0.14)", color: "#7C6CFF", fontWeight: 700, letterSpacing: "0.04em" }}>{(t.plan_name || "—").toUpperCase()}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[t.subscription_status] || "#64748b"}20`, color: STATUS_COLOR[t.subscription_status] || "#94a3b8" }}>
                            {(t.subscription_status || "—").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#10b981", fontWeight: 700 }}>₹{fmt(t.monthly_price)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: "#475569" }}>{new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: "#0D1426", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.07)", padding: "20px 24px", boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Plan Distribution</div>
                {(dashData.plan_distribution || []).map((plan, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>{plan.plan_name}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{plan.count} — ₹{fmt(plan.plan_revenue)}/mo</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, Number(plan.count) * 20)}%`, background: "linear-gradient(90deg, #5B4BFF, #7C6CFF)", transition: "width 600ms ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && activeSection === "tenants" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>All Companies ({tenants.length})</div>
              <button onClick={() => setActiveSection("create")} style={{ padding: "8px 18px", background: "#5B4BFF", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Tenant</button>
            </div>
            <div style={{ background: "#0D1426", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.07)", overflow: "auto", boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.20)" }}>
                    {["Company", "Plan", "Status", "Users", "MRR", "Days Left", "Actions"].map((h, i) => (
                      <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} style={{ borderTop: "0.5px solid rgba(255,255,255,0.04)", transition: "background 150ms" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(91,75,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{t.company_name}</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>{t.email}</div>
                        <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>{t.company_code}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: "rgba(91,75,255,0.14)", color: "#7C6CFF", letterSpacing: "0.04em" }}>{(t.plan_name || "—").toUpperCase()}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, fontWeight: 700, background: `${STATUS_COLOR[t.subscription_status || ""] || "#64748b"}20`, color: STATUS_COLOR[t.subscription_status || ""] || "#94a3b8" }}>
                          {(t.subscription_status || "—").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8" }}>{t.active_users || 0} / {t.max_users ?? "∞"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#10b981" }}>₹{fmt(t.monthly_price)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: (t.days_remaining ?? 999) <= 7 ? "#ef4444" : (t.days_remaining ?? 999) <= 30 ? "#f59e0b" : "#10b981" }}>
                          {t.days_remaining != null ? (t.days_remaining > 0 ? `${t.days_remaining}d` : "Expired") : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => impersonateTenant(t.id, t.company_name)} disabled={impersonating === t.id} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid #5B4BFF", background: "transparent", color: "#5B4BFF", cursor: "pointer", fontWeight: 600 }}>
                            {impersonating === t.id ? "..." : "👁 View"}
                          </button>
                          <button onClick={() => setPlanEditor({ id: t.id, name: t.company_name })} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid #8B5CF6", background: "transparent", color: "#a78bfa", cursor: "pointer", fontWeight: 600 }}>
                            ⚙ Plan
                          </button>
                          {t.subscription_status !== "SUSPENDED" ? (
                            <button onClick={() => suspendTenant(t.id)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer" }}>Suspend</button>
                          ) : (
                            <button onClick={() => activateTenant(t.id)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid #10b981", background: "transparent", color: "#10b981", cursor: "pointer" }}>Activate</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeSection === "create" && (
          <CreateTenantForm onCreated={() => { setActiveSection("tenants"); fetchAll(); }} />
        )}

        {planEditor && (
          <PlanEditorModal
            tenantId={planEditor.id}
            tenantName={planEditor.name}
            onClose={() => setPlanEditor(null)}
            onSaved={() => { setPlanEditor(null); fetchAll(); }}
          />
        )}

        {!loading && activeSection === "announcements" && <AnnouncementsTab />}

        {!loading && activeSection === "health" && health && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>System Health</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {(health.checks || []).map((check: any, i: number) => (
                <div key={i} style={{ background: "#0D1426", borderRadius: 14, padding: 20, border: `0.5px solid ${check.status === "healthy" ? "rgba(16,185,129,0.30)" : check.status === "slow" ? "rgba(245,158,11,0.30)" : "rgba(255,255,255,0.07)"}`, boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{check.name}</div>
                  {check.response_ms !== undefined ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 800, color: check.status === "healthy" ? "#10b981" : "#f59e0b" }}>{check.response_ms}ms</div>
                      <div style={{ fontSize: 11, color: check.status === "healthy" ? "#10b981" : "#f59e0b", marginTop: 4, fontWeight: 600 }}>{check.status.toUpperCase()}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#5B4BFF" }}>{check.value}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: "#475569" }}>
              Last checked: {new Date(health.checked_at).toLocaleString("en-IN")}
              <button onClick={fetchAll} style={{ marginLeft: 12, padding: "4px 12px", border: "1px solid #334155", borderRadius: 6, background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>Refresh</button>
            </div>
          </div>
        )}

        {!loading && activeSection === "audit" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Audit Log</div>
            <div style={{ background: "#0D1426", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.07)", overflow: "hidden", boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.20)" }}>
                    {["Action", "Target", "By", "When"].map((h, i) => (
                      <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((a, i) => (
                    <tr key={i} style={{ borderTop: "0.5px solid rgba(255,255,255,0.04)", transition: "background 150ms" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(91,75,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700 }}>{a.action.replace(/_/g, " ")}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>{a.target_name || "—"}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{a.master_user_name}</td>
                      <td style={{ padding: "10px 16px", fontSize: 11, color: "#475569" }}>{new Date(a.created_at).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#475569" }}>No activity logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.10)", background: "#070B16", color: "#f1f5f9", fontSize: 13, boxSizing: "border-box", boxShadow: "inset 3px 3px 8px rgba(0,0,0,0.35), inset -2px -2px 6px rgba(255,255,255,0.02)", outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6, letterSpacing: "0.06em" };

const CreateTenantForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [form, setForm] = useState({
    company_name: "", email: "", phone: "", city_pincode: "",
    plan_name: "starter", monthly_price: "", max_users: "3", max_branches: "1", trial_days: "14",
    admin_username: "", admin_email: "", admin_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.company_name.trim()) { setErr("Company name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await masterFetch("/master/tenants", {
        method: "POST",
        body: { ...form, monthly_price: form.monthly_price ? Number(form.monthly_price) : 0, max_users: Number(form.max_users), max_branches: Number(form.max_branches), trial_days: Number(form.trial_days) },
      });
      const data = await res.json();
      if (data.success) {
        alert(`Company created! Workspace Identifier: ${data.company_code}`);
        onCreated();
      } else {
        setErr(data.error || "Failed to create company");
      }
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Create New Tenant</div>
      {err && <div style={{ background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{err}</div>}
      <div style={{ background: "#0D1426", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.07)", padding: 24, boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase" }}>Company</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Company Name *</label><input style={inputStyle} value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} /></div>
          <div><label style={labelStyle}>Email</label><input style={inputStyle} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>City</label><input style={inputStyle} value={form.city_pincode} onChange={(e) => setForm((p) => ({ ...p, city_pincode: e.target.value }))} /></div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase" }}>Plan</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Plan</label>
            <select style={inputStyle} value={form.plan_name} onChange={(e) => setForm((p) => ({ ...p, plan_name: e.target.value }))}>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div><label style={labelStyle}>Monthly ₹</label><input type="number" style={inputStyle} value={form.monthly_price} onChange={(e) => setForm((p) => ({ ...p, monthly_price: e.target.value }))} /></div>
          <div><label style={labelStyle}>Max Users</label><input type="number" style={inputStyle} value={form.max_users} onChange={(e) => setForm((p) => ({ ...p, max_users: e.target.value }))} /></div>
          <div><label style={labelStyle}>Trial Days</label><input type="number" style={inputStyle} value={form.trial_days} onChange={(e) => setForm((p) => ({ ...p, trial_days: e.target.value }))} /></div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase" }}>First Admin User (optional)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div><label style={labelStyle}>Username</label><input style={inputStyle} value={form.admin_username} onChange={(e) => setForm((p) => ({ ...p, admin_username: e.target.value }))} /></div>
          <div><label style={labelStyle}>Email</label><input style={inputStyle} value={form.admin_email} onChange={(e) => setForm((p) => ({ ...p, admin_email: e.target.value }))} /></div>
          <div><label style={labelStyle}>Password</label><input type="text" style={inputStyle} value={form.admin_password} onChange={(e) => setForm((p) => ({ ...p, admin_password: e.target.value }))} /></div>
        </div>

        <button onClick={submit} disabled={saving} style={{ padding: "12px 28px", background: saving ? "#334155" : "#5B4BFF", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Creating…" : "Create Tenant"}
        </button>
      </div>
    </div>
  );
};

const AnnouncementsTab: React.FC = () => {
  const [form, setForm] = useState({ title: "", message: "", type: "info" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!form.title || !form.message) { setMsg("Title and message required"); return; }
    setSaving(true);
    try {
      const res = await masterFetch("/master/announcements", { method: "POST", body: form });
      const data = await res.json();
      setMsg(data.success ? "Announcement published to all tenants." : data.error);
      if (data.success) setForm({ title: "", message: "", type: "info" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Platform Announcement</div>
      {msg && <div style={{ background: "#0D1426", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{msg}</div>}
      <div style={{ background: "#0D1426", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.07)", padding: 24, boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.02)" }}>
        <div style={{ marginBottom: 12 }}><label style={labelStyle}>Title</label><input style={inputStyle} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
            <option value="danger">Danger</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Message</label>
          <textarea rows={4} style={{ ...inputStyle, resize: "none" }} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} />
        </div>
        <button onClick={submit} disabled={saving} style={{ padding: "12px 28px", background: saving ? "#334155" : "#5B4BFF", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Publishing…" : "Publish to All Tenants"}
        </button>
      </div>
    </div>
  );
};

const PlanEditorModal: React.FC<{ tenantId: number; tenantName: string; onClose: () => void; onSaved: () => void }> = ({ tenantId, tenantName, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [modules, setModules] = useState<{ module_key: string; module_name: string; category: string }[]>([]);
  const [form, setForm] = useState<any>({
    plan_name: "", status: "ACTIVE", monthly_price: 0, quarterly_price: 0, yearly_price: 0, billing_cycle: "monthly",
    max_users: "", max_branches: "", max_invoices_per_month: "", expiry_date: "", trial_ends_at: "", enabled_modules: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [detailRes, modulesRes] = await Promise.all([
          masterFetch(`/master/tenants/${tenantId}`).then((r) => r.json()),
          masterFetch("/master/modules").then((r) => r.json()),
        ]);
        setModules(Array.isArray(modulesRes) ? modulesRes : []);
        const c = detailRes?.company || {};
        setForm({
          plan_name: c.plan_name || "",
          status: c.subscription_status || "ACTIVE",
          monthly_price: c.monthly_price || 0,
          quarterly_price: c.quarterly_price || 0,
          yearly_price: c.yearly_price || 0,
          billing_cycle: c.billing_cycle || "monthly",
          max_users: c.max_users ?? "",
          max_branches: c.max_branches ?? "",
          max_invoices_per_month: c.max_invoices_per_month ?? "",
          expiry_date: c.expiry_date ? String(c.expiry_date).slice(0, 10) : "",
          trial_ends_at: c.trial_ends_at ? String(c.trial_ends_at).slice(0, 10) : "",
          enabled_modules: c.enabled_modules || "",
        });
      } catch {
        setErr("Failed to load plan details");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const selectedModules = new Set<string>(String(form.enabled_modules || "").split(",").map((s: string) => s.trim()).filter(Boolean));
  const toggleModule = (key: string) => {
    const next = new Set(selectedModules);
    if (next.has(key)) next.delete(key); else next.add(key);
    setForm((p: any) => ({ ...p, enabled_modules: Array.from(next).join(",") }));
  };

  const byCategory: Record<string, typeof modules> = {};
  for (const m of modules) (byCategory[m.category || "Other"] = byCategory[m.category || "Other"] || []).push(m);

  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      const res = await masterFetch(`/master/tenants/${tenantId}/plan`, {
        method: "PUT",
        body: {
          ...form,
          monthly_price: parseFloat(form.monthly_price) || 0,
          quarterly_price: parseFloat(form.quarterly_price) || 0,
          yearly_price: parseFloat(form.yearly_price) || 0,
          max_users: form.max_users === "" ? null : parseInt(form.max_users),
          max_branches: form.max_branches === "" ? null : parseInt(form.max_branches),
          max_invoices_per_month: form.max_invoices_per_month === "" ? null : parseInt(form.max_invoices_per_month),
          expiry_date: form.expiry_date || null,
          trial_ends_at: form.trial_ends_at || null,
        },
      });
      const data = await res.json();
      if (data.success) onSaved(); else setErr(data.error || "Failed to save");
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,11,22,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ background: "#0D1426", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", padding: 28, boxShadow: "10px 10px 30px rgba(0,0,0,0.45), -6px -6px 18px rgba(255,255,255,0.02), 0 0 60px rgba(91,75,255,0.06)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Manage Plan — {tenantName}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Set pricing, limits, and which modules this tenant can access.</div>

        {loading ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {err && <div style={{ background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{err}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={labelStyle}>Plan Name</label><input style={inputStyle} value={form.plan_name} onChange={(e) => setForm((p: any) => ({ ...p, plan_name: e.target.value }))} placeholder="starter / professional / enterprise" /></div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status} onChange={(e) => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
              <div><label style={labelStyle}>Monthly Price (₹)</label><input type="number" style={inputStyle} value={form.monthly_price} onChange={(e) => setForm((p: any) => ({ ...p, monthly_price: e.target.value }))} /></div>
              <div><label style={labelStyle}>Yearly Price (₹)</label><input type="number" style={inputStyle} value={form.yearly_price} onChange={(e) => setForm((p: any) => ({ ...p, yearly_price: e.target.value }))} /></div>
              <div><label style={labelStyle}>Quarterly Price (₹)</label><input type="number" style={inputStyle} value={form.quarterly_price} onChange={(e) => setForm((p: any) => ({ ...p, quarterly_price: e.target.value }))} /></div>
              <div>
                <label style={labelStyle}>Billing Cycle</label>
                <select style={inputStyle} value={form.billing_cycle} onChange={(e) => setForm((p: any) => ({ ...p, billing_cycle: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div><label style={labelStyle}>Max Users</label><input type="number" style={inputStyle} value={form.max_users} onChange={(e) => setForm((p: any) => ({ ...p, max_users: e.target.value }))} placeholder="blank = unlimited" /></div>
              <div><label style={labelStyle}>Max Branches</label><input type="number" style={inputStyle} value={form.max_branches} onChange={(e) => setForm((p: any) => ({ ...p, max_branches: e.target.value }))} placeholder="blank = unlimited" /></div>
              <div><label style={labelStyle}>Max Invoices / Month</label><input type="number" style={inputStyle} value={form.max_invoices_per_month} onChange={(e) => setForm((p: any) => ({ ...p, max_invoices_per_month: e.target.value }))} placeholder="blank = unlimited" /></div>
              <div><label style={labelStyle}>Expiry Date</label><input type="date" style={inputStyle} value={form.expiry_date} onChange={(e) => setForm((p: any) => ({ ...p, expiry_date: e.target.value }))} /></div>
              <div><label style={labelStyle}>Trial Ends At</label><input type="date" style={inputStyle} value={form.trial_ends_at} onChange={(e) => setForm((p: any) => ({ ...p, trial_ends_at: e.target.value }))} /></div>
            </div>

            <div style={{ marginTop: 22, marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em" }}>MODULES THIS TENANT CAN ACCESS</div>
            {modules.length === 0 ? (
              <div style={{ fontSize: 12, color: "#475569" }}>No module catalog found.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {Object.entries(byCategory).map(([category, mods]) => (
                  <div key={category} style={{ background: "#070B16", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>{category}</div>
                    {mods.map((m) => (
                      <label key={m.module_key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={selectedModules.has(m.module_key)} onChange={() => toggleModule(m.module_key)} />
                        {m.module_name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={submit} disabled={saving} style={{ flex: 1, padding: 12, background: saving ? "#334155" : "#5B4BFF", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : "Save Plan"}
              </button>
              <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MasterPanel;
