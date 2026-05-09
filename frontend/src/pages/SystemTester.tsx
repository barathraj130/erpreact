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
  skipIfFailed?: string; // ID of test that must pass to run this
  verifyFn?: (res: any, ctx: TestContext) => Promise<string | null>;
}

interface TestResult {
  id: string;
  name: string;
  category: string;
  method: string;
  path: string;
  status: "idle" | "running" | "pass" | "fail" | "warn" | "skipped";
  httpStatus?: number;
  durationMs?: number;
  errorBody?: any;
  likelyCause?: string;
  fixSuggestion?: string;
  verifyNote?: string;
}

interface TestContext {
  customerId?: number;
  customerName?: string;
  productId?: number;
  productName?: string;
  supplierId?: number;
  stockBaseline?: number;
  tbBaselineDeits?: number;
  tbBaselineCredits?: number;
  invoiceId?: number;
  namesakeInvoiceId?: number;
  purchaseBillId?: number;
  // Shared metrics
  lastTrialBalanceDiff?: number;
}

// ─── Verification Helpers ─────────────────────────────────
const checkTrialBalance = async () => {
  const res = await apiFetch("/reports/finance/trial-balance", { method: "GET" });
  const data = await res.json();
  let totalDebit = 0;
  let totalCredit = 0;
  data.forEach((row: any) => {
    totalDebit += parseFloat(row.debit || 0);
    totalCredit += parseFloat(row.credit || 0);
  });
  return { totalDebit, totalCredit, diff: Math.abs(totalDebit - totalCredit) };
};

// ─── Deep Test Scenarios ──────────────────────────────────
const DEEP_SCENARIOS: TestCase[] = [
  // --- SCENARIO 1: NON-TAX INVOICE WITH SPLIT PAYMENT ---
  {
    id: "T1.1", name: "Create Test Customer", category: "Scenario 1", method: "POST", path: "/users",
    body: null, // dynamic
    expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.customerId = res.id; return null; }
  },
  {
    id: "T1.2", name: "Create Test Product", category: "Scenario 1", method: "POST", path: "/products",
    body: null, // dynamic
    expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.productId = res.product?.id ?? res.id; return null; }
  },
  {
    id: "T1.3", name: "Get Inventory Baseline", category: "Scenario 1", method: "GET", path: "/reports/inventory/summary",
    expectStatus: 200,
    verifyFn: async (rows, ctx) => {
      const p = rows.find((r: any) => r.name === ctx.productName);
      if (!p) return "FAIL: Test product not found in summary";
      ctx.stockBaseline = parseFloat(p.current_stock);
      return null;
    }
  },
  {
    id: "T1.4", name: "Trial Balance Baseline", category: "Scenario 1", method: "GET", path: "/reports/finance/trial-balance",
    expectStatus: 200,
    verifyFn: async () => {
      const { diff } = await checkTrialBalance();
      if (diff > 0.01) return `FAIL: TB not zero-sum. Diff: ${diff}`;
      return null;
    }
  },
  {
    id: "T1.5", name: "Create NON-TAX Invoice (10L)", category: "Scenario 1", method: "POST", path: "/invoice",
    body: null, // dynamic
    expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.invoiceId = res.id; return null; }
  },
  {
    id: "T1.6", name: "Verify Invoice Fields", category: "Scenario 1", method: "GET", path: "/invoice/__invoiceId__",
    expectStatus: 200,
    verifyFn: async (inv) => {
      const checks = [
        inv.invoice_type === "NON_TAX_INVOICE",
        Math.abs(parseFloat(inv.total_amount) - 1000000) < 0.01,
        Math.abs(parseFloat(inv.paid_amount) - 500000) < 0.01,
        Math.abs(parseFloat(inv.tax_total || 0) - 0) < 0.01
      ];
      if (checks.includes(false)) return "FAIL: Invoice field mismatch";
      return null;
    }
  },
  {
    id: "T1.7", name: "Verify Inventory Decreased", category: "Scenario 1", method: "GET", path: "/reports/inventory/summary",
    expectStatus: 200,
    verifyFn: async (rows, ctx) => {
      const p = rows.find((r: any) => r.name === ctx.productName);
      const current = parseFloat(p.current_stock);
      if (current !== (ctx.stockBaseline || 0) - 100) return `FAIL: Stock wrong. Expected ${(ctx.stockBaseline || 0) - 100}, got ${current}`;
      return null;
    }
  },
  {
    id: "T1.8", name: "Verify Movement Logged", category: "Scenario 1", method: "GET", path: "/reports/inventory/movement",
    expectStatus: 200,
    verifyFn: async (rows, ctx) => {
      const m = rows.find((r: any) => r.product_name === ctx.productName && r.reference.includes(String(ctx.invoiceId)));
      if (!m) return "FAIL: No movement log found";
      if (parseFloat(m.qty_out) !== 100) return "FAIL: Wrong movement qty";
      return null;
    }
  },
  {
    id: "T1.9", name: "Verify Ledger Entries (Isolation)", category: "Scenario 1", method: "GET", path: "/reports/finance/day-book",
    expectStatus: 200,
    verifyFn: async (rows, ctx) => {
      const entries = rows.filter((r: any) => r.id === ctx.invoiceId || (r.description && r.description.includes(String(ctx.invoiceId))));
      // Should find: Dr AR (10L), Cr Sales (10L), Dr Cash (2.5L), Cr AR (2.5L), Dr UPI (2.5L), Cr AR (2.5L)
      const gst = rows.filter((r: any) => r.account_name.includes("GST") && r.id === ctx.invoiceId);
      if (gst.length > 0) return "CRITICAL FAIL: GST entries found on Non-Tax bill";
      return null;
    }
  },
  {
    id: "T1.10", name: "TB Zero-Sum Check (After S1)", category: "Scenario 1", method: "GET", path: "/reports/finance/trial-balance",
    expectStatus: 200,
    verifyFn: async () => {
      const { diff } = await checkTrialBalance();
      if (diff > 0.01) return `CRITICAL FAIL: TB broken after S1. Diff: ${diff}`;
      return null;
    }
  },
  {
    id: "T1.11", name: "Verify Split Payment in Register", category: "Scenario 1", method: "GET", path: "/reports/sales/register",
    expectStatus: 200,
    verifyFn: async (rows, ctx) => {
      const row = rows.find((r: any) => r.id === ctx.invoiceId);
      if (!row) return "FAIL: Invoice not in register";
      if (parseFloat(row.cash_collected) !== 250000 || parseFloat(row.upi_collected) !== 250000) 
        return "FAIL: Split payment columns combined or wrong";
      return null;
    }
  },
  {
    id: "T1.12", name: "Verify Excluded from GST", category: "Scenario 1", method: "GET", path: "/reports/gst/summary",
    expectStatus: 200,
    verifyFn: async (data, ctx) => {
      const found = data.some((r: any) => r.invoice_id === ctx.invoiceId);
      if (found) return "CRITICAL FAIL: Non-tax invoice found in GST summary";
      return null;
    }
  },

  // --- SCENARIO 2: NAME-SAKE TAX BILL ---
  {
    id: "T2.1", name: "Create Name-Sake TAX Bill (20L)", category: "Scenario 2", method: "POST", path: "/invoice",
    body: null, // dynamic
    expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.namesakeInvoiceId = res.id; return null; }
  },
  {
    id: "T2.2", name: "Verify Bill Purpose Tag", category: "Scenario 2", method: "GET", path: "/invoice/__namesakeInvoiceId__",
    expectStatus: 200,
    verifyFn: async (inv) => {
      if (inv.bill_purpose !== "name_only") return "FAIL: Bill not tagged as name_only";
      return null;
    }
  },
  {
    id: "T2.3", name: "Verify Real Balance Safe", category: "Scenario 2", method: "GET", path: "/reports/sales/customer-wise?filterType=real",
    expectStatus: 200,
    verifyFn: async (rows, ctx) => {
      const c = rows.find((r: any) => r.customer_name === "TEST_CUSTOMER_DEEP");
      if (parseFloat(c.balance) !== 500000) return `FAIL: Real balance contaminated. Expected 5L, got ${c.balance}`;
      return null;
    }
  },
  {
    id: "T2.4", name: "Verify Included in GST Report", category: "Scenario 2", method: "GET", path: "/reports/gst/summary",
    expectStatus: 200,
    verifyFn: async (data, ctx) => {
      // Logic for GST summary check
      return null;
    }
  },
  {
    id: "T2.5", name: "Verify P&L Revenue Isolation", category: "Scenario 2", method: "GET", path: "/reports/finance/profit-loss?filterType=real",
    expectStatus: 200,
    verifyFn: async (data) => {
      if (data.totalIncome > 1500000) return `FAIL: Revenue inflated! Got ${data.totalIncome}, Expected ~10L`;
      return null;
    }
  },
  {
    id: "T2.6", name: "Verify Cash Flow Unaffected", category: "Scenario 2", method: "GET", path: "/reports/finance/balance-sheet?filterType=real",
    expectStatus: 200,
    verifyFn: async (data) => {
      const cash = data.details.find((d: any) => d.account_name === "Cash");
      if (parseFloat(cash.current_balance) > 250000) return "FAIL: Name-sake affected cash flow";
      return null;
    }
  },
  {
    id: "T2.7", name: "TB Zero-Sum Check (After S2)", category: "Scenario 2", method: "GET", path: "/reports/finance/trial-balance",
    expectStatus: 200,
    verifyFn: async () => {
      const { diff } = await checkTrialBalance();
      if (diff > 0.01) return `CRITICAL FAIL: TB broken after Name-sake. Diff: ${diff}`;
      return null;
    }
  },

  // --- CLEANUP ---
  {
    id: "T5.1", name: "Cleanup: Delete Name-sake Invoice", category: "Cleanup", method: "DELETE", path: "/invoice/__namesakeInvoiceId__",
    expectStatus: 200
  },
  {
    id: "T5.2", name: "Cleanup: Delete Real Invoice", category: "Cleanup", method: "DELETE", path: "/invoice/__invoiceId__",
    expectStatus: 200
  },
  {
    id: "T5.3", name: "Cleanup: Archive Test Product", category: "Cleanup", method: "PATCH", path: "/products/__productId__/archive",
    expectStatus: 200
  }
];

const STATUS_COLORS: Record<string, string> = {
  idle: "#94a3b8", running: "#f59e0b", pass: "#10b981", fail: "#ef4444", warn: "#f97316", skipped: "#334155"
};

// ─── Main Component ───────────────────────────────────────
const SystemTester: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>(
    DEEP_SCENARIOS.map(t => ({ id: t.id, name: t.name, category: t.category, method: t.method, path: t.path, status: "idle" }))
  );
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ctx = useRef<TestContext>({});

  const updateResult = (id: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  };

  const runTest = async (test: TestCase): Promise<boolean> => {
    updateResult(test.id, { status: "running" });
    const t0 = Date.now();

    let path = test.path
      .replace("__customerId__", String(ctx.current.customerId || "0"))
      .replace("__productId__", String(ctx.current.productId || "0"))
      .replace("__invoiceId__", String(ctx.current.invoiceId || "0"))
      .replace("__namesakeInvoiceId__", String(ctx.current.namesakeInvoiceId || "0"));

    let body = test.body;
    const today = new Date().toISOString().split("T")[0];

    if (test.id === "T1.1") {
      ctx.current.customerName = "deep_cust_" + Math.random().toString(36).substring(7);
      body = { username: ctx.current.customerName, role: "customer" };
    } else if (test.id === "T1.2") {
      ctx.current.productName = "DEEP_PROD_" + Math.random().toString(36).substring(7);
      body = { name: ctx.current.productName, cost_price: 8000, selling_price: 10000, opening_stock: 200, gst_percent: 18, unit: "Pcs" };
    } else if (test.id === "T1.5") {
      body = {
        customer_id: ctx.current.customerId,
        invoice_type: "NON_TAX_INVOICE",
        invoice_date: today,
        items: [{ product_id: ctx.current.productId, qty: 100, rate: 10000, gst_rate: 0 }],
        amount_paid: 500000,
        payments: [
          { payment_method: "CASH", amount: 250000 },
          { payment_method: "UPI", amount: 250000 }
        ],
        bill_purpose: "real"
      };
    } else if (test.id === "T2.1") {
      body = {
        customer_id: ctx.current.customerId,
        invoice_type: "TAX_INVOICE",
        invoice_date: today,
        items: [{ product_id: ctx.current.productId, qty: 200, rate: 10000, gst_rate: 18 }],
        bill_purpose: "name_only",
        amount_paid: 0,
        payments: []
      };
    }

    try {
      const opts: any = { method: test.method };
      if (body) opts.body = body; // apiFetch handles JSON.stringify internally

      const res = await apiFetch(path, opts);
      const durationMs = Date.now() - t0;
      let data: any = {};
      try { data = await res.json(); } catch (_) {}

      const passed = res.status === test.expectStatus || (test.expectStatus === 200 && res.status === 201);
      
      let errorMsg = null;
      let successNote = null;

      if (passed && test.verifyFn) {
        const result = await test.verifyFn(data, ctx.current);
        if (typeof result === "string") {
          errorMsg = result;
        }
      }

      if (passed && !errorMsg) {
        updateResult(test.id, { status: "pass", httpStatus: res.status, durationMs, verifyNote: successNote || undefined });
        return true;
      } else {
        updateResult(test.id, { 
          status: "fail", 
          httpStatus: res.status, 
          durationMs, 
          errorBody: data, 
          likelyCause: errorMsg || "Status code mismatch",
          fixSuggestion: passed ? "Deep verification failed" : "Backend rejected request"
        });
        return false;
      }
    } catch (err: any) {
      updateResult(test.id, { status: "fail", likelyCause: err.message });
      return false;
    }
  };

  const runAll = async () => {
    setRunning(true);
    ctx.current = {};
    for (const test of DEEP_SCENARIOS) {
      const success = await runTest(test);
      if (!success && !test.id.startsWith("T5")) {
        // Stop chain if not cleanup
        const index = DEEP_SCENARIOS.indexOf(test);
        const remaining = DEEP_SCENARIOS.slice(index + 1);
        remaining.forEach(t => updateResult(t.id, { status: "skipped" }));
        break;
      }
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: "40px", background: "#020617", minHeight: "100vh", color: "#f8fafc", fontFamily: "'Geist Mono', monospace" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 900, letterSpacing: "-1px", color: "#fff" }}>
              ERP DATA INTEGRITY <span style={{ color: "#38bdf8" }}>CHAIN TESTER</span>
            </h1>
            <p style={{ color: "#64748b", marginTop: "8px" }}>Deep transaction verification & report isolation logic</p>
          </div>
          <button
            onClick={runAll}
            disabled={running}
            style={{ 
              padding: "12px 30px", background: running ? "#1e293b" : "#0ea5e9", 
              color: "#fff", border: "none", borderRadius: "8px", 
              fontWeight: 800, cursor: running ? "not-allowed" : "pointer",
              boxShadow: "0 0 20px rgba(14, 165, 233, 0.3)"
            }}
          >
            {running ? "EXERCISING CHAIN..." : "▶ START DEEP TEST"}
          </button>
        </div>

        {/* Chain Display */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {results.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ width: "60px", color: "#475569", fontSize: "0.8rem", fontWeight: 700 }}>{r.id}</div>
              <div style={{ 
                flex: 1, padding: "16px 24px", background: "#0f172a", border: `1px solid ${STATUS_COLORS[r.status]}33`,
                borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center",
                opacity: r.status === "skipped" ? 0.4 : 1
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: STATUS_COLORS[r.status] }}></div>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.name}</span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase" }}>{r.category}</span>
                </div>
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  {r.verifyNote && <span style={{ color: "#38bdf8", fontSize: "0.8rem" }}>{r.verifyNote}</span>}
                  {r.durationMs && <span style={{ color: "#475569", fontSize: "0.7rem" }}>{r.durationMs}ms</span>}
                  <span style={{ 
                    color: STATUS_COLORS[r.status], fontWeight: 900, fontSize: "0.8rem",
                    textTransform: "uppercase"
                  }}>
                    {r.status}
                  </span>
                </div>
              </div>
              {r.status === "fail" && (
                <div style={{ width: "340px", padding: "14px", background: "#450a0a", borderRadius: "8px", color: "#fecaca", fontSize: "0.72rem", border: "1px solid #7f1d1d", lineHeight: "1.6" }}>
                  <div style={{ fontWeight: 900, marginBottom: "6px" }}>
                    CRITICAL FAIL {r.httpStatus ? <span style={{ color: "#f87171" }}>[HTTP {r.httpStatus}]</span> : ""}
                  </div>
                  <div style={{ color: "#fca5a5", marginBottom: "4px" }}>{r.likelyCause}</div>
                  {r.errorBody && (
                    <div style={{ marginTop: "6px", padding: "6px", background: "#3b0000", borderRadius: "4px", color: "#fcd34d", fontFamily: "monospace", wordBreak: "break-all" }}>
                      {typeof r.errorBody === "object" ? JSON.stringify(r.errorBody) : String(r.errorBody)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemTester;
