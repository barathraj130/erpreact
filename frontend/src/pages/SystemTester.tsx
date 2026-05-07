import React, { useState, useRef } from "react";
import { apiFetch } from "../utils/api";

// ─── Types ────────────────────────────────────────────────
interface TestCase {
  id: string;
  name: string;
  category: string;
  method: string;
  path: string;
  body?: any;
  expectStatus: number;
  verifyFn?: (res: any, ctx: TestContext) => Promise<string | null>;
}

interface TestResult {
  id: string;
  name: string;
  category: string;
  method: string;
  path: string;
  status: "idle" | "running" | "pass" | "fail" | "warn";
  httpStatus?: number;
  durationMs?: number;
  errorBody?: any;
  likelyCause?: string;
  fixSuggestion?: string;
  verifyNote?: string;
}

interface TestContext {
  createdProductId?: number;
  createdSupplierId?: number;
  createdCustomerId?: number;
  createdPurchaseBillId?: number;
  createdInvoiceId?: number;
}

// ─── Auto-detect failure cause ───────────────────────────
function detectCause(errorBody: any): { cause: string; fix: string } {
  const msg = JSON.stringify(errorBody || "").toLowerCase();
  if (msg.includes("column") && msg.includes("does not exist"))
    return { cause: "Database schema mismatch — column missing from table.", fix: "Run: ALTER TABLE <table> ADD COLUMN <column> <type>;" };
  if (msg.includes("relation") && msg.includes("does not exist"))
    return { cause: "Table does not exist in database.", fix: "Run schema migrations or restart backend to trigger schema updates." };
  if (msg.includes("null value") || msg.includes("not null"))
    return { cause: "Required field is null — missing required body field.", fix: "Ensure all required fields are included in the request body." };
  if (msg.includes("duplicate") || msg.includes("unique"))
    return { cause: "Unique constraint violation — duplicate record.", fix: "Check for existing records with the same unique key." };
  if (msg.includes("foreign key") || msg.includes("violates foreign"))
    return { cause: "Foreign key constraint — related record not found.", fix: "Ensure referenced record exists before inserting." };
  if (msg.includes("econnrefused"))
    return { cause: "Database connection refused.", fix: "Check that PostgreSQL is running and DB credentials are correct." };
  if (msg.includes("jwt") || msg.includes("malformed") || msg.includes("unauthorized"))
    return { cause: "Invalid or expired auth token.", fix: "Re-login as admin to get a fresh token." };
  if (msg.includes("timeout"))
    return { cause: "Query timeout — query too slow.", fix: "Add an index to frequently queried columns." };
  if (msg.includes("not found") || msg.includes("404"))
    return { cause: "Route not implemented or record not found.", fix: "Verify the route exists in backend routes." };
  return { cause: "Unexpected server error.", fix: "Check backend console logs for full stack trace." };
}

// ─── All Test Definitions ─────────────────────────────────
const ALL_TESTS: TestCase[] = [
  // Auth
  { id: "health", name: "Health Check", category: "Auth", method: "GET", path: "/health", expectStatus: 200 },
  { id: "auth-verify", name: "Verify Token", category: "Auth", method: "GET", path: "/auth/verify", expectStatus: 200 },
  { id: "company", name: "Get Company Profile", category: "Auth", method: "GET", path: "/company", expectStatus: 200 },
  // Products
  { id: "products-list", name: "List Products", category: "Products", method: "GET", path: "/products", expectStatus: 200 },
  {
    id: "products-create", name: "Create Test Product", category: "Products", method: "POST", path: "/products",
    body: { name: "TEST_PRODUCT_AUTO", unit: "Pcs", selling_price: 99, cost_price: 50, gst_percent: 18, hsn_code: "9999" },
    expectStatus: 201
  },
  { id: "products-get", name: "Get Product by ID", category: "Products", method: "GET", path: "/products/__productId__", expectStatus: 200 },
  { id: "products-update", name: "Update Test Product", category: "Products", method: "PUT", path: "/products/__productId__", body: { selling_price: 109 }, expectStatus: 200 },
  // Inventory
  { id: "inventory-list", name: "List Inventory", category: "Inventory", method: "GET", path: "/inventory", expectStatus: 200 },
  { id: "inventory-movements", name: "Inventory Movements", category: "Inventory", method: "GET", path: "/inventory/movements", expectStatus: 200 },
  { id: "inventory-low", name: "Low Stock Report", category: "Inventory", method: "GET", path: "/inventory/low-stock", expectStatus: 200 },
  { id: "bills-pending", name: "Pending Bill Balances", category: "Inventory", method: "GET", path: "/bills/pending-balance", expectStatus: 200 },
  // Suppliers
  { id: "suppliers-list", name: "List Suppliers", category: "Suppliers", method: "GET", path: "/suppliers", expectStatus: 200 },
  {
    id: "suppliers-create", name: "Create Test Supplier", category: "Suppliers", method: "POST", path: "/suppliers",
    body: { name: "TEST_SUPPLIER_AUTO", phone: "9999999999", city: "Chennai" },
    expectStatus: 201
  },
  // Purchases
  { id: "purchases-list", name: "List Purchase Bills", category: "Purchases", method: "GET", path: "/purchase-bills", expectStatus: 200 },
  {
    id: "purchases-create", name: "Create Test Purchase Bill", category: "Purchases", method: "POST", path: "/purchase-bills",
    body: null, // filled at runtime using context
    expectStatus: 201
  },
  // Customers
  { id: "customers-list", name: "List Customers", category: "Customers", method: "GET", path: "/customers", expectStatus: 200 },
  {
    id: "customers-create", name: "Create Test Customer", category: "Customers", method: "POST", path: "/customers",
    body: { username: "TEST_CUSTOMER_AUTO", email: "test_auto@test.com", phone: "8888888888" },
    expectStatus: 201
  },
  { id: "customers-outstanding", name: "Outstanding Balances", category: "Customers", method: "GET", path: "/customers/outstanding-balances", expectStatus: 200 },
  // Sales
  { id: "sales-list", name: "List Sales Invoices", category: "Sales", method: "GET", path: "/invoice", expectStatus: 200 },
  // Finance
  { id: "ledger-list", name: "Ledger Entries", category: "Finance", method: "GET", path: "/ledger-entries", expectStatus: 200 },
  { id: "trial-balance", name: "Trial Balance", category: "Finance", method: "GET", path: "/reports/trial-balance", expectStatus: 200 },
  { id: "profit-loss", name: "Profit & Loss", category: "Finance", method: "GET", path: "/reports/profit-loss", expectStatus: 200 },
  { id: "balance-sheet", name: "Balance Sheet", category: "Finance", method: "GET", path: "/reports/balance-sheet", expectStatus: 200 },
  { id: "day-book", name: "Day Book", category: "Finance", method: "GET", path: "/reports/day-book", expectStatus: 200 },
  { id: "gst-summary", name: "GST Summary", category: "Finance", method: "GET", path: "/reports/gst-summary", expectStatus: 200 },
  { id: "loans", name: "Loans", category: "Finance", method: "GET", path: "/loans", expectStatus: 200 },
  { id: "lenders", name: "Lenders", category: "Finance", method: "GET", path: "/lenders", expectStatus: 200 },
  { id: "chit-funds", name: "Chit Funds", category: "Finance", method: "GET", path: "/chit-funds", expectStatus: 200 },
  // Employees
  { id: "employees-list", name: "List Employees", category: "Employees", method: "GET", path: "/employees", expectStatus: 200 },
  { id: "attendance-today", name: "Today's Attendance", category: "Employees", method: "GET", path: "/attendance/today", expectStatus: 200 },
  // Branches
  { id: "branches-list", name: "List Branches", category: "Branches", method: "GET", path: "/branches", expectStatus: 200 },
  { id: "stock-requests", name: "Stock Requests", category: "Branches", method: "GET", path: "/stock-requests", expectStatus: 200 },
  { id: "stock-transfers", name: "Stock Transfers", category: "Branches", method: "GET", path: "/stock-transfers", expectStatus: 200 },
  // Reports
  { id: "rpt-sales", name: "Sales Register", category: "Reports", method: "GET", path: "/reports/sales-register", expectStatus: 200 },
  { id: "rpt-purchases", name: "Purchase Register", category: "Reports", method: "GET", path: "/reports/purchase-register", expectStatus: 200 },
  { id: "rpt-stock", name: "Stock Summary", category: "Reports", method: "GET", path: "/reports/stock-summary", expectStatus: 200 },
  { id: "rpt-gstr1", name: "GSTR1 Report", category: "Reports", method: "GET", path: "/reports/gstr1", expectStatus: 200 },
  { id: "rpt-itc", name: "ITC Report", category: "Reports", method: "GET", path: "/reports/itc", expectStatus: 200 },
  // Payment Methods
  { id: "payment-methods", name: "Payment Methods", category: "Finance", method: "GET", path: "/payment-methods", expectStatus: 200 },
];

const CATEGORIES = ["All", ...Array.from(new Set(ALL_TESTS.map(t => t.category)))];

const STATUS_COLORS: Record<string, string> = {
  idle: "#94a3b8", running: "#f59e0b", pass: "#10b981", fail: "#ef4444", warn: "#f97316"
};
const STATUS_ICONS: Record<string, string> = {
  idle: "○", running: "⟳", pass: "✅", fail: "❌", warn: "⚠️"
};

// ─── Main Component ───────────────────────────────────────
const SystemTester: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>(
    ALL_TESTS.map(t => ({ id: t.id, name: t.name, category: t.category, method: t.method, path: t.path, status: "idle" }))
  );
  const [running, setRunning] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const stopRef = useRef(false);
  const startTime = useRef(0);
  const [totalTime, setTotalTime] = useState(0);

  const ctx = useRef<TestContext>({});

  const updateResult = (id: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  };

  const runTest = async (test: TestCase): Promise<void> => {
    updateResult(test.id, { status: "running", httpStatus: undefined, errorBody: undefined });
    const t0 = Date.now();

    // Resolve dynamic path
    let path = test.path
      .replace("__productId__", String(ctx.current.createdProductId || "1"))
      .replace("__supplierId__", String(ctx.current.createdSupplierId || "1"))
      .replace("__customerId__", String(ctx.current.createdCustomerId || "1"));

    // Fill purchase bill body at runtime
    let body = test.body;
    if (test.id === "purchases-create") {
      body = {
        supplier_id: ctx.current.createdSupplierId || null,
        bill_number: "TEST_BILL_AUTO",
        bill_date: new Date().toISOString().split("T")[0],
        items: ctx.current.createdProductId
          ? [{ product_id: ctx.current.createdProductId, quantity: 5, unit_price: 50, tax_percent: 18 }]
          : [],
        payment_status: "PAID",
        amount_paid: 295,
      };
    }

    try {
      const opts: Record<string, any> = {
        method: test.method,
      };
      if (body) opts.body = JSON.stringify(body);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await apiFetch(path, opts as any);
      clearTimeout(timer);
      const durationMs = Date.now() - t0;
      let data: any = {};
      try { data = await res.json(); } catch (_) {}

      // Save context IDs for chained tests
      if (test.id === "products-create" && data.id) ctx.current.createdProductId = data.id;
      if (test.id === "suppliers-create" && data.id) ctx.current.createdSupplierId = data.id;
      if (test.id === "customers-create" && data.id) ctx.current.createdCustomerId = data.id;
      if (test.id === "purchases-create" && (data.id || data.bill_id)) ctx.current.createdPurchaseBillId = data.id || data.bill_id;

      const passed = res.status === test.expectStatus || (test.expectStatus === 200 && res.status === 201);
      const warned = !passed && (res.status === 404 || res.status === 501);

      if (passed) {
        updateResult(test.id, { status: "pass", httpStatus: res.status, durationMs });
      } else if (warned) {
        const { cause, fix } = detectCause(data);
        updateResult(test.id, { status: "warn", httpStatus: res.status, durationMs, errorBody: data, likelyCause: cause, fixSuggestion: fix });
      } else {
        const { cause, fix } = detectCause(data);
        updateResult(test.id, { status: "fail", httpStatus: res.status, durationMs, errorBody: data, likelyCause: cause, fixSuggestion: fix });
      }
    } catch (err: any) {
      const durationMs = Date.now() - t0;
      const { cause, fix } = detectCause({ error: err.message });
      updateResult(test.id, { status: "fail", httpStatus: 0, durationMs, errorBody: { error: err.message }, likelyCause: cause, fixSuggestion: fix });
    }
  };

  const cleanup = async () => {
    const toClean = [
      ctx.current.createdProductId && apiFetch(`/products/${ctx.current.createdProductId}`, { method: "DELETE" }),
      ctx.current.createdSupplierId && apiFetch(`/suppliers/${ctx.current.createdSupplierId}`, { method: "DELETE" }),
      ctx.current.createdCustomerId && apiFetch(`/customers/${ctx.current.createdCustomerId}`, { method: "DELETE" }),
    ].filter(Boolean);
    await Promise.allSettled(toClean as Promise<any>[]);
    ctx.current = {};
  };

  const runAll = async (category?: string) => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    startTime.current = Date.now();
    ctx.current = {};

    const testsToRun = ALL_TESTS.filter(t => !category || category === "All" || t.category === category);
    setResults(prev => prev.map(r => {
      const inSet = testsToRun.find(t => t.id === r.id);
      return inSet ? { ...r, status: "idle", httpStatus: undefined, errorBody: undefined } : r;
    }));

    for (const test of testsToRun) {
      if (stopRef.current) break;
      await runTest(test);
    }

    await cleanup();
    setTotalTime(Date.now() - startTime.current);
    setRunning(false);
  };

  const stopAll = () => { stopRef.current = true; };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "erp_test_results.json"; a.click();
  };

  const copyClipboard = (text: string) => navigator.clipboard.writeText(text);

  const stats = {
    total: results.length,
    pass: results.filter(r => r.status === "pass").length,
    fail: results.filter(r => r.status === "fail").length,
    warn: results.filter(r => r.status === "warn").length,
  };

  const filtered = results.filter(r => activeCategory === "All" || r.category === activeCategory);
  const grouped: Record<string, TestResult[]> = {};
  filtered.forEach(r => { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r); });

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });
  };

  return (
    <div style={{ padding: "30px", background: "#0f172a", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, color: "#fff" }}>🧪 System Function Tester</h1>
            <p style={{ color: "#64748b", marginTop: "6px", fontSize: "0.9rem" }}>Admin-only tool — verifies all backend endpoints and data integrity</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={exportJSON}
              style={{ padding: "10px 20px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "10px", cursor: "pointer", fontWeight: 700 }}
            >📤 Export JSON</button>
            <button
              onClick={stopAll}
              disabled={!running}
              style={{ padding: "10px 20px", background: running ? "#ef4444" : "#1e293b", color: running ? "#fff" : "#64748b", border: "none", borderRadius: "10px", cursor: running ? "pointer" : "not-allowed", fontWeight: 800 }}
            >⏹ Stop</button>
            <button
              onClick={() => runAll()}
              disabled={running}
              style={{ padding: "10px 28px", background: running ? "#334155" : "#4f46e5", color: "#fff", border: "none", borderRadius: "10px", cursor: running ? "not-allowed" : "pointer", fontWeight: 800, fontSize: "1rem", boxShadow: running ? "none" : "0 4px 15px rgba(79,70,229,0.4)" }}
            >{running ? "Running..." : "▶ Run All"}</button>
          </div>
        </div>

        {/* Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "15px", marginBottom: "25px" }}>
          {[
            { label: "Total", value: stats.total, color: "#94a3b8" },
            { label: "Passed", value: stats.pass, color: "#10b981" },
            { label: "Failed", value: stats.fail, color: "#ef4444" },
            { label: "Warnings", value: stats.warn, color: "#f97316" },
            { label: "Time", value: totalTime > 0 ? `${totalTime}ms` : "—", color: "#a78bfa" },
          ].map(s => (
            <div key={s.label} style={{ background: "#1e293b", borderRadius: "14px", padding: "18px", textAlign: "center", border: "1px solid #334155" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Category Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "25px" }}>
          {CATEGORIES.map(cat => {
            const catResults = results.filter(r => cat === "All" || r.category === cat);
            const hasFail = catResults.some(r => r.status === "fail");
            const hasWarn = catResults.some(r => r.status === "warn");
            const allPass = catResults.every(r => r.status === "pass");
            const color = hasFail ? "#ef4444" : hasWarn ? "#f97316" : allPass ? "#10b981" : "#64748b";
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 16px", borderRadius: "100px", border: `2px solid ${activeCategory === cat ? color : "#334155"}`,
                  background: activeCategory === cat ? color : "transparent",
                  color: activeCategory === cat ? "#fff" : "#94a3b8",
                  fontWeight: 700, cursor: "pointer", fontSize: "0.8rem", transition: "all 0.2s",
                }}
              >
                {cat}
                {cat !== "All" && (
                  <span style={{ marginLeft: "6px", opacity: 0.8 }}>
                    {catResults.filter(r => r.status === "pass").length}/{catResults.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {Object.entries(grouped).map(([cat, catResults]) => (
          <div key={cat} style={{ marginBottom: "20px" }}>
            <div
              onClick={() => toggleCat(cat)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "#1e293b", borderRadius: "12px", cursor: "pointer", marginBottom: "8px", border: "1px solid #334155" }}
            >
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#e2e8f0" }}>{cat}</span>
              <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
                {catResults.filter(r => r.status === "pass").length} passed · {catResults.filter(r => r.status === "fail").length} failed · {collapsedCats.has(cat) ? "▼" : "▲"}
              </span>
            </div>

            {!collapsedCats.has(cat) && catResults.map(result => (
              <div key={result.id} style={{ marginBottom: "6px" }}>
                <div
                  onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "30px 80px 1fr auto auto",
                    gap: "12px", alignItems: "center", padding: "14px 20px",
                    background: result.status === "fail" ? "#1a0a0a" : result.status === "pass" ? "#0a1a0f" : result.status === "warn" ? "#1a1200" : "#1e293b",
                    borderRadius: "10px", cursor: "pointer",
                    border: `1px solid ${result.status === "fail" ? "#7f1d1d" : result.status === "pass" ? "#14532d" : result.status === "warn" ? "#78350f" : "#334155"}`,
                    transition: "all 0.15s"
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{STATUS_ICONS[result.status]}</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "#0f172a", padding: "3px 8px", borderRadius: "6px", color: "#a78bfa", fontWeight: 700 }}>
                    {result.method}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#e2e8f0", fontFamily: "monospace" }}>{result.name}</span>
                  {result.httpStatus !== undefined && (
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: result.httpStatus >= 400 ? "#ef4444" : "#10b981", fontWeight: 700 }}>
                      {result.httpStatus}
                    </span>
                  )}
                  {result.durationMs !== undefined && (
                    <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b" }}>{result.durationMs}ms</span>
                  )}
                </div>

                {/* Expanded Error Detail */}
                {expandedId === result.id && (result.status === "fail" || result.status === "warn") && (
                  <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "20px", marginTop: "4px", marginBottom: "6px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>Error Response</div>
                        <pre style={{ background: "#1e293b", color: "#f87171", padding: "12px", borderRadius: "8px", fontSize: "0.75rem", overflow: "auto", maxHeight: "200px", margin: 0 }}>
                          {JSON.stringify(result.errorBody, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>Likely Cause</div>
                        <div style={{ background: "#1e293b", padding: "12px", borderRadius: "8px", fontSize: "0.82rem", color: "#fbbf24", lineHeight: 1.6, marginBottom: "12px" }}>
                          {result.likelyCause}
                        </div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>Fix Suggestion</div>
                        <pre style={{ background: "#1e293b", color: "#6ee7b7", padding: "12px", borderRadius: "8px", fontSize: "0.75rem", overflow: "auto", maxHeight: "120px", margin: 0 }}>
                          {result.fixSuggestion}
                        </pre>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                      <button onClick={() => copyClipboard(JSON.stringify(result.errorBody, null, 2))}
                        style={{ padding: "7px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        📋 Copy Error
                      </button>
                      <button onClick={() => copyClipboard(result.fixSuggestion || "")}
                        style={{ padding: "7px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        📋 Copy Fix
                      </button>
                      <button onClick={() => { const t = ALL_TESTS.find(x => x.id === result.id); if (t) runTest(t); }}
                        style={{ padding: "7px 16px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        🔄 Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemTester;
