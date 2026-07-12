import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";

type Period = "today" | "week" | "month" | "year" | "custom";

interface ProductSummary {
  product_name: string;
  total_sold_qty: number;
  total_purchased_qty: number;
  total_returned_qty: number;
  total_converted_qty: number;
  net_movement: number;
  total_sale_amount: number;
  total_purchase_amount: number;
  total_return_amount: number;
  gross_profit: number;
  fresh_sold: number;
  mistake_sold: number;
  fresh_purchased: number;
  mistake_purchased: number;
  sale_count: number;
  purchase_count: number;
  return_count: number;
  branches: string[];
  invoice_types: string[];
  suppliers: string[];
  lot_numbers: string[];
  first_movement: string | null;
  last_movement: string | null;
  avg_selling_rate: number;
  avg_purchase_rate: number;
}

interface MovementSummary {
  total_products: number;
  total_sold_qty: number;
  total_purchased_qty: number;
  total_returned_qty: number;
  total_sale_amount: number;
  total_purchase_amount: number;
  gross_profit: number;
  typed_only_products: number;
}

interface MovementData {
  period: { from: string; to: string };
  summary: MovementSummary;
  products: ProductSummary[];
  typed_only_products: string[];
}

interface DetailSale {
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  quantity: number;
  rate: number;
  amount: number;
  stock_type: string | null;
  customer_name: string;
  branch_name: string | null;
}
interface DetailPurchase {
  bill_number: string;
  bill_date: string | null;
  fresh_qty: number;
  mistake_qty: number;
  fresh_rate: number;
  mistake_rate: number;
  total_amount: number;
  supplier_name: string | null;
  lot_number: string | null;
}
interface DetailReturn {
  return_number: string;
  return_date: string | null;
  quantity: number;
  rate: number;
  amount: number;
  customer_name: string;
}
interface ProductDetail {
  product_name: string;
  sales: DetailSale[];
  purchases: DetailPurchase[];
  returns: DetailReturn[];
  summary: {
    total_sold?: number;
    total_purchased?: number;
    total_returned?: number;
    sale_revenue?: number;
    purchase_cost?: number;
  };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

const fmt = (n: number | undefined) => parseFloat(String(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtQty = (n: number | undefined) => parseInt(String(n || 0)).toLocaleString("en-IN");
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");

type Tab = "summary" | "sales" | "purchases" | "returns" | "drilldown";

export default function ProductMovement() {
  const [data, setData] = useState<MovementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/reports/product-movement?period=${period}`;
      if (period === "custom" && fromDate && toDate) {
        url = `/reports/product-movement?from=${fromDate}&to=${toDate}`;
      }
      if (searchProduct) url += `&product_name=${encodeURIComponent(searchProduct)}`;
      const res = await apiFetch(url);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDetail = async (productName: string) => {
    setDetailLoading(true);
    setSelectedProduct(productName);
    try {
      let url = `/reports/product-movement/detail/${encodeURIComponent(productName)}?period=${period}`;
      if (period === "custom" && fromDate && toDate) {
        url = `/reports/product-movement/detail/${encodeURIComponent(productName)}?from=${fromDate}&to=${toDate}`;
      }
      const res = await apiFetch(url);
      setProductDetail(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    const rows = [
      ["Product Name", "Sold Qty", "Purchased Qty", "Returned Qty", "Sale Amount", "Purchase Amount", "Profit", "Avg Sell Rate", "Avg Buy Rate", "Branches"],
      ...(data?.products || []).map((p) => [
        p.product_name, p.total_sold_qty, p.total_purchased_qty, p.total_returned_qty,
        p.total_sale_amount, p.total_purchase_amount, p.gross_profit,
        p.avg_selling_rate.toFixed(2), p.avg_purchase_rate.toFixed(2), (p.branches || []).join(";"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `product-movement-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const kpi = data?.summary;

  return (
    <div style={{ padding: "0 0 40px", fontFamily: "system-ui, sans-serif" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#0f172a" }}>Product Movement</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Every product that moved — sold, purchased, returned, converted. Includes free-text typed products.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${period === p.key ? "#4f46e5" : "#e2e8f0"}`,
                background: period === p.key ? "#4f46e5" : "#fff",
                color: period === p.key ? "#fff" : "#64748b", cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date + search row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        {period === "custom" && (
          <>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <span style={{ color: "#94a3b8" }}>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
          </>
        )}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input
            type="text" placeholder="🔍 Search product name..." value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
          />
        </div>
        <button onClick={fetchData} style={{ padding: "8px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Search
        </button>
        <button onClick={() => { setSearchProduct(""); fetchData(); }} style={{ padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 12, cursor: "pointer", color: "#64748b" }}>
          Clear
        </button>
        <button onClick={exportCsv} style={{ padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
          ⬇ Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "TOTAL PRODUCTS", value: fmtQty(kpi?.total_products), icon: "📦", bg: "#eff6ff", color: "#4f46e5" },
          { label: "TOTAL SOLD", value: `${fmtQty(kpi?.total_sold_qty)} pcs`, icon: "📤", bg: "#f0fdf4", color: "#16a34a" },
          { label: "TOTAL PURCHASED", value: `${fmtQty(kpi?.total_purchased_qty)} pcs`, icon: "📥", bg: "#fef2f2", color: "#dc2626" },
          { label: "SALE REVENUE", value: `₹${fmt(kpi?.total_sale_amount)}`, icon: "💰", bg: "#fffbeb", color: "#d97706" },
          { label: "TYPED PRODUCTS", value: fmtQty(kpi?.typed_only_products), icon: "⌨️", bg: "#f5f3ff", color: "#7c3aed" },
        ].map((card, i) => (
          <div key={i} style={{ background: card.bg, borderRadius: 12, padding: 16, border: `1px solid ${card.color}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>{card.label}</span>
              <span style={{ fontSize: 18 }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Typed-products alert */}
      {(data?.typed_only_products?.length || 0) > 0 && (
        <div style={{ padding: "14px 20px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⌨️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
              {data!.typed_only_products.length} products sold as free text — not in inventory
            </div>
            <div style={{ fontSize: 12, color: "#92400e", marginBottom: 8 }}>
              These were typed manually in invoices and have no matching purchase record. Consider adding them to inventory for proper stock tracking.
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data!.typed_only_products.slice(0, 10).map((name, i) => (
                <span key={i} onClick={() => { setSearchProduct(name); setActiveTab("drilldown"); fetchProductDetail(name); }}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fff", color: "#92400e", fontWeight: 600, border: "1px solid #fde68a", cursor: "pointer" }}>
                  {name}
                </span>
              ))}
              {data!.typed_only_products.length > 10 && (
                <span style={{ fontSize: 11, color: "#92400e" }}>+{data!.typed_only_products.length - 10} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "2px solid #f1f5f9", overflowX: "auto" }}>
        {[
          { id: "summary" as Tab, label: "📊 Product Summary" },
          { id: "drilldown" as Tab, label: `🔍 ${selectedProduct ? selectedProduct : "Drill Down"}` },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px", border: "none", fontSize: 13,
              borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
              background: "transparent", fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? "#4f46e5" : "#64748b", cursor: "pointer", marginBottom: -2, whiteSpace: "nowrap",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === "summary" && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Product Name", "Sold Qty", "Purchased Qty", "Returned", "Sale Revenue", "Purchase Cost", "Gross Profit", "Avg Sell ₹", "Avg Buy ₹", "Branches", "Action"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 12px", textAlign: i <= 1 ? "left" : "right", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.products || []).map((p, i) => (
                <tr key={i} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                  onClick={() => { setActiveTab("drilldown"); fetchProductDetail(p.product_name); }}>
                  <td style={{ padding: "11px 12px", color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.product_name}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {p.fresh_sold > 0 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>Fresh: {fmtQty(p.fresh_sold)}</span>}
                      {p.mistake_sold > 0 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, background: "#fef9c3", color: "#854d0e", fontWeight: 600 }}>Mstk: {fmtQty(p.mistake_sold)}</span>}
                      {p.purchase_count === 0 && p.total_sold_qty > 0 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, background: "#f5f3ff", color: "#7c3aed", fontWeight: 600 }}>⌨️ Typed</span>}
                    </div>
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtQty(p.total_sold_qty)} pcs</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, color: "#64748b" }}>{fmtQty(p.total_purchased_qty)} pcs</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, color: p.total_returned_qty > 0 ? "#dc2626" : "#94a3b8" }}>{fmtQty(p.total_returned_qty)} pcs</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₹{fmt(p.total_sale_amount)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, color: "#dc2626" }}>₹{fmt(p.total_purchase_amount)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, fontWeight: 800, color: p.gross_profit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {p.gross_profit >= 0 ? "+" : ""}₹{fmt(p.gross_profit)}
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 12, color: "#64748b" }}>₹{p.avg_selling_rate.toFixed(0)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 12, color: "#64748b" }}>₹{p.avg_purchase_rate.toFixed(0)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#64748b", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(p.branches || []).join(", ") || "Main"}
                    </div>
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right" }}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveTab("drilldown"); fetchProductDetail(p.product_name); }}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #4f46e5", background: "transparent", color: "#4f46e5", cursor: "pointer", fontWeight: 600 }}>
                      Details →
                    </button>
                  </td>
                </tr>
              ))}
              {(data?.products || []).length === 0 && !loading && (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No product movements found for this period</td></tr>
              )}
            </tbody>
            {(data?.products || []).length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc", fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: 12, fontSize: 13 }}>TOTAL</td>
                  <td style={{ padding: 12, textAlign: "right", fontSize: 13, color: "#16a34a" }}>{fmtQty(kpi?.total_sold_qty)} pcs</td>
                  <td style={{ padding: 12, textAlign: "right", fontSize: 13 }}>{fmtQty(kpi?.total_purchased_qty)} pcs</td>
                  <td style={{ padding: 12, textAlign: "right", fontSize: 13, color: "#dc2626" }}>{fmtQty(kpi?.total_returned_qty)} pcs</td>
                  <td style={{ padding: 12, textAlign: "right", fontSize: 14 }}>₹{fmt(kpi?.total_sale_amount)}</td>
                  <td style={{ padding: 12, textAlign: "right", fontSize: 13, color: "#dc2626" }}>₹{fmt(kpi?.total_purchase_amount)}</td>
                  <td style={{ padding: 12, textAlign: "right", fontSize: 13, color: (kpi?.gross_profit || 0) >= 0 ? "#16a34a" : "#dc2626" }}>₹{fmt(kpi?.gross_profit)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Drilldown tab */}
      {activeTab === "drilldown" && (
        <div>
          {!selectedProduct ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 14, border: "1px dashed #e2e8f0" }}>
              Click on any product row to see full transaction history
            </div>
          ) : detailLoading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Loading {selectedProduct} detail...</div>
          ) : productDetail ? (
            <div>
              <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid #f1f5f9", marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{productDetail.product_name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Total Sold", value: `${fmtQty(productDetail.summary?.total_sold)} pcs`, color: "#16a34a" },
                    { label: "Total Purchased", value: `${fmtQty(productDetail.summary?.total_purchased)} pcs`, color: "#dc2626" },
                    { label: "Total Returned", value: `${fmtQty(productDetail.summary?.total_returned)} pcs`, color: "#f59e0b" },
                    { label: "Sale Revenue", value: `₹${fmt(productDetail.summary?.sale_revenue)}`, color: "#0f172a" },
                    { label: "Purchase Cost", value: `₹${fmt(productDetail.summary?.purchase_cost)}`, color: "#dc2626" },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: "center", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {productDetail.sales?.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "auto", marginBottom: 16 }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    📤 Sales ({productDetail.sales.length} transactions)
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Invoice", "Date", "Type", "Customer", "Branch", "Qty", "Rate", "Amount", "Stock Type"].map((h, i) => (
                          <th key={i} style={{ padding: "9px 12px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productDetail.sales.map((s, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 600, color: "#4f46e5", fontFamily: "monospace" }}>{s.invoice_number}</td>
                          <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>{fmtDate(s.invoice_date)}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: "#eff6ff", color: "#4f46e5", fontWeight: 600 }}>{(s.invoice_type || "").toUpperCase()}</span>
                          </td>
                          <td style={{ padding: "9px 12px", fontSize: 12, color: "#0f172a" }}>{s.customer_name}</td>
                          <td style={{ padding: "9px 12px", fontSize: 11, color: "#64748b" }}>{s.branch_name || "Main"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtQty(s.quantity)} pcs</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12 }}>₹{parseFloat(String(s.rate || 0)).toFixed(0)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>₹{fmt(s.amount)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right" }}>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: s.stock_type === "mistake" ? "#fef9c3" : "#dcfce7", color: s.stock_type === "mistake" ? "#854d0e" : "#166534", fontWeight: 600 }}>
                              {s.stock_type || "Fresh"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {productDetail.purchases?.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "auto", marginBottom: 16 }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    📥 Purchases ({productDetail.purchases.length} bills)
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Bill No", "Date", "Supplier", "Lot", "Fresh Qty", "Mstk Qty", "Fresh Rate", "Mstk Rate", "Total"].map((h, i) => (
                          <th key={i} style={{ padding: "9px 12px", textAlign: i >= 4 ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productDetail.purchases.map((p, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #f8fafc" }}>
                          <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 600, color: "#4f46e5", fontFamily: "monospace" }}>{p.bill_number}</td>
                          <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>{fmtDate(p.bill_date)}</td>
                          <td style={{ padding: "9px 12px", fontSize: 12, color: "#0f172a" }}>{p.supplier_name || "—"}</td>
                          <td style={{ padding: "9px 12px", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{p.lot_number || "—"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtQty(p.fresh_qty)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{fmtQty(p.mistake_qty)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12 }}>₹{parseFloat(String(p.fresh_rate || 0)).toFixed(0)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12 }}>₹{parseFloat(String(p.mistake_rate || 0)).toFixed(0)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>₹{fmt(p.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {productDetail.returns?.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "auto" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    ↩️ Returns ({productDetail.returns.length})
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Return No", "Date", "Customer", "Qty", "Rate", "Amount"].map((h, i) => (
                          <th key={i} style={{ padding: "9px 12px", textAlign: i >= 3 ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productDetail.returns.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #f8fafc" }}>
                          <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 600, color: "#f59e0b", fontFamily: "monospace" }}>{r.return_number || "—"}</td>
                          <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>{fmtDate(r.return_date)}</td>
                          <td style={{ padding: "9px 12px", fontSize: 12 }}>{r.customer_name}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{fmtQty(r.quantity)} pcs</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12 }}>₹{parseFloat(String(r.rate || 0)).toFixed(0)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>₹{fmt(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {productDetail.sales?.length === 0 && productDetail.purchases?.length === 0 && productDetail.returns?.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 14 }}>
                  No detailed transactions found for "{selectedProduct}"
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
