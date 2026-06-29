import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface Summary {
  total_bills: number;
  total_revenue: number;
  total_collected: number;
  total_pending: number;
  avg_bill_value: number;
  paid_count: number;
  partial_count: number;
  pending_count: number;
  paid_revenue: number;
  unique_customers: number;
  retail_percent: string;
  wholesale_revenue: number;
  total_revenue_all: number;
}

interface DailyRow { date: string; bills: number; revenue: number; collected: number; }
interface ProductRow { product_name: string; total_qty: number; total_revenue: number; bill_count: number; avg_rate: number; }
interface BillRow {
  id: number; invoice_number: string; invoice_date: string;
  total_amount: number; paid_amount: number; balance_amount: number;
  status: string; customer_name: string; item_count: number; total_qty: number;
}

interface RetailData {
  period: { from: string; to: string };
  summary: Summary;
  daily_trend: DailyRow[];
  top_products: ProductRow[];
  recent_bills: BillRow[];
}

const fmt = (n: number) =>
  `₹${parseFloat(String(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid:    { bg: "#dcfce7", color: "#166534" },
  partial: { bg: "#fef9c3", color: "#854d0e" },
  pending: { bg: "#fee2e2", color: "#991b1b" },
  unpaid:  { bg: "#fee2e2", color: "#991b1b" },
};

export default function RetailRevenue() {
  const [data, setData]     = useState<RetailData | null>(null);
  const [period, setPeriod] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [loading, setLoading]   = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/invoices/retail-summary?period=${period}`;
      if (period === "custom" && fromDate && toDate) {
        url = `/invoices/retail-summary?from=${fromDate}&to=${toDate}`;
      }
      const res  = await apiFetch(url);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Retail summary error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  const s = data?.summary;

  const PERIODS = [
    { key: "today", label: "Today" },
    { key: "week",  label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div style={{ padding: "24px 28px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--color-text-primary)" }}>
            🛍️ Retail Revenue
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            Walk-in cash customers — RET/ invoices
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${period === p.key ? "#4f46e5" : "var(--color-border-secondary)"}`,
                background: period === p.key ? "#4f46e5" : "transparent",
                color: period === p.key ? "#fff" : "var(--color-text-primary)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
          <span style={{ color: "var(--color-text-secondary)" }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
          <button onClick={fetchData}
            style={{ padding: "8px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Apply
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-secondary)", fontSize: 14 }}>
          Loading retail data…
        </div>
      )}

      {!loading && s && (
        <>
          {/* KPI Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
            {[
              { label: "Total Retail Revenue", value: fmt(s.total_revenue), sub: `${s.retail_percent}% of all sales`, color: "#4f46e5", bg: "#eff6ff", icon: "🛍️" },
              { label: "Total Bills",           value: s.total_bills.toLocaleString("en-IN"), sub: `Avg ${fmt(s.avg_bill_value)} per bill`, color: "#0891b2", bg: "#ecfeff", icon: "🧾" },
              { label: "Cash Collected",        value: fmt(s.total_collected), sub: `${s.paid_count} fully paid bills`, color: "#15803d", bg: "#f0fdf4", icon: "💵" },
              { label: "Pending Amount",        value: fmt(s.total_pending), sub: `${s.pending_count} unpaid bills`, color: "#dc2626", bg: "#fef2f2", icon: "⏳" },
            ].map((c, i) => (
              <div key={i} style={{ background: c.bg, borderRadius: 12, padding: "16px 18px", border: `0.5px solid ${c.color}22` }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 4 }}>
                  {c.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* KPI Row 2 — split + status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            {/* Retail vs Wholesale split */}
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 20, border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 16 }}>
                RETAIL vs WHOLESALE SPLIT
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#4f46e5", fontWeight: 600 }}>🛍️ Retail</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{s.retail_percent}%</span>
                </div>
                <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, background: "#4f46e5", width: `${Math.min(100, parseFloat(s.retail_percent))}%`, transition: "width 0.6s ease" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Retail</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#4f46e5" }}>{fmt(s.total_revenue)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Wholesale</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0891b2" }}>{fmt(s.wholesale_revenue)}</div>
                </div>
              </div>
            </div>

            {/* Bill status breakdown */}
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 20, border: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 16 }}>
                BILL STATUS BREAKDOWN
              </div>
              {[
                { label: "Paid",    count: s.paid_count,    color: "#15803d" },
                { label: "Partial", count: s.partial_count, color: "#d97706" },
                { label: "Pending", count: s.pending_count, color: "#dc2626" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                    <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>
                    {row.count.toLocaleString("en-IN")} bills
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top products */}
          <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 20, marginBottom: 20, border: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--color-text-primary)" }}>
              Top Products in Retail Sales
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  {["#", "Product", "Bills", "Qty Sold", "Avg Rate", "Total Revenue"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", textAlign: i >= 2 ? "right" : "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.top_products.slice(0, 10).map((p, i) => (
                  <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--color-text-secondary)" }}>{i + 1}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{p.product_name}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13 }}>{Number(p.bill_count).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13 }}>{Number(p.total_qty).toLocaleString("en-IN")} pcs</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13 }}>{fmt(p.avg_rate)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#4f46e5" }}>{fmt(p.total_revenue)}</td>
                  </tr>
                ))}
                {data!.top_products.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
                      No retail sales in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent retail bills */}
          <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 20, border: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--color-text-primary)" }}>
              Recent Retail Bills
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  {["Invoice No", "Date", "Customer", "Qty", "Amount", "Collected", "Status"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", textAlign: i >= 3 ? "right" : "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.recent_bills.map((bill, i) => {
                  const stKey = (bill.status || "pending").toLowerCase();
                  const st = STATUS_STYLE[stKey] || STATUS_STYLE.pending;
                  return (
                    <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#4f46e5" }}>{bill.invoice_number}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--color-text-secondary)" }}>
                        {new Date(bill.invoice_date).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--color-text-primary)" }}>{bill.customer_name || "Walk-in"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13 }}>{Number(bill.total_qty || 0)} pcs</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{fmt(bill.total_amount)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, color: "#15803d" }}>{fmt(bill.paid_amount)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                          {(bill.status || "PENDING").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data!.recent_bills.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
                      No retail bills in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
