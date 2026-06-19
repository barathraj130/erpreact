import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { FaArrowLeft, FaBuilding, FaUsers, FaBoxes, FaFileInvoiceDollar, FaChartBar } from "react-icons/fa";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const KPI = ({ label, value, color = "#1e293b", sub }: { label: string; value: string; color?: string; sub?: string }) => (
  <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "18px 22px" }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{sub}</div>}
  </div>
);

const BranchDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"invoices" | "stock" | "ledger">("invoices");
  const [cashLedger, setCashLedger] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dRes, iRes, sRes, cRes] = await Promise.all([
          apiFetch(`/admin/branches/${id}/detail`),
          apiFetch(`/admin/branches/${id}/invoices`),
          apiFetch(`/admin/branches/${id}/stock`),
          apiFetch(`/ledgers/cash`),
        ]);
        if (dRes.ok) setDetail(await dRes.json());
        if (iRes.ok) setInvoices(await iRes.json());
        if (sRes.ok) setStock(await sRes.json());
        if (cRes.ok) setCashLedger(await cRes.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading branch details…</div>;
  if (!detail) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>Branch not found.</div>;

  const { branch, stats, manager } = detail;

  const TABS = [
    { key: "invoices", label: "Invoices", icon: <FaFileInvoiceDollar /> },
    { key: "stock",    label: "Stock",    icon: <FaBoxes /> },
    { key: "ledger",   label: "Ledger",   icon: <FaChartBar /> },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Back + Header */}
      <button onClick={() => navigate(-1)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: "#6b7280", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 }}>
        <FaArrowLeft size={11} /> Back
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ede9fe", display: "flex",
          alignItems: "center", justifyContent: "center", color: "#6d28d9", flexShrink: 0 }}>
          <FaBuilding size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{branch.branch_name}</h1>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Code: <strong>{branch.branch_code}</strong>
            {branch.address && <> · {branch.address}</>}
            {manager && <> · Manager: <strong>{manager.username}</strong> ({manager.email})</>}
          </div>
        </div>
        <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: branch.is_active !== false ? "#d1fae5" : "#fee2e2",
          color: branch.is_active !== false ? "#065f46" : "#dc2626" }}>
          {branch.is_active !== false ? "Active" : "Inactive"}
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KPI label="Today Sales"   value={fmt(stats?.today_sales)}    color="#059669" />
        <KPI label="Month Sales"   value={fmt(stats?.month_sales)}    color="#4f46e5" />
        <KPI label="Outstanding"   value={fmt(stats?.outstanding)}    color="#dc2626" />
        <KPI label="Bills Today"   value={String(stats?.today_count || 0)} />
        <KPI label="Customers"     value={String(stats?.customer_count || 0)} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid #e5e7eb", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
              border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? "#4f46e5" : "#6b7280",
              borderBottom: activeTab === t.key ? "2px solid #4f46e5" : "2px solid transparent" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                {["Date", "Invoice #", "Customer", "Total", "Paid", "Balance", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600,
                    color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 50).map((inv: any) => (
                <tr key={inv.id} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{fmtDate(inv.invoice_date)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{inv.customer_name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{fmt(inv.grand_total)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#059669" }}>{fmt(inv.paid_amount)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: inv.balance_amount > 0 ? "#dc2626" : "#059669" }}>
                    {fmt(inv.balance_amount)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: inv.payment_status === "PAID" ? "#d1fae5" : inv.payment_status === "PARTIAL" ? "#fef3c7" : "#fee2e2",
                      color: inv.payment_status === "PAID" ? "#065f46" : inv.payment_status === "PARTIAL" ? "#92400e" : "#dc2626" }}>
                      {inv.payment_status || "PENDING"}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Tab */}
      {activeTab === "stock" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                {["Product", "Fresh Stock", "Mistake Stock", "Total", "Selling Price"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600,
                    color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stock.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{s.fresh_stock ?? s.quantity ?? 0}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{s.mistake_stock ?? 0}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700 }}>{(s.fresh_stock ?? s.quantity ?? 0) + (s.mistake_stock ?? 0)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{fmt(s.selling_price)}</td>
                </tr>
              ))}
              {stock.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No stock found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ledger Tab */}
      {activeTab === "ledger" && (
        <div>
          {cashLedger ? (
            <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb", fontWeight: 700, fontSize: 15 }}>
                Cash Ledger — {branch.branch_name}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Date", "Source", "In (+)", "Out (-)", "Balance"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cashLedger.entries || []).slice(0, 40).map((e: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 16px", fontSize: 13 }}>{fmtDate(e.date)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13 }}>{e.source}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#059669" }}>
                        {e.direction === "in" ? fmt(e.amount) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#dc2626" }}>
                        {e.direction === "out" ? fmt(e.amount) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13 }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No ledger data for this branch.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default BranchDetail;
