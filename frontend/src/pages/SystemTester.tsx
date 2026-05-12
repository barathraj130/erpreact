import React, { useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { FaPlay, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaRedoAlt } from "react-icons/fa";

// ─── Types ────────────────────────────────────────────────
interface TestCase {
  id: string;
  name: string;
  category: string;
  method: string;
  path: string;
  body?: any;
  expectStatus: number;
  skipIfFailed?: string;
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
  productId?: number;
  invoiceId?: number;
  lenderId?: number;
  employeeId?: number;
  initialStock?: number;
}

// ─── Scenarios ────────────────────────────────────────────
const DEEP_SCENARIOS: TestCase[] = [
  {
    id: "T1.1", name: "Create Customer", category: "Sales", method: "POST", path: "/users",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { 
        if (!res.id) return "No customer ID returned";
        ctx.customerId = res.id; 
        return null; 
    }
  },
  {
    id: "T1.2", name: "Create Product", category: "Inventory", method: "POST", path: "/products",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { 
        const p = res.product || res;
        if (!p.id) return "No product ID returned";
        ctx.productId = p.id;
        ctx.initialStock = parseFloat(p.opening_stock || 0);
        return null; 
    }
  },
  {
    id: "T1.3", name: "Process Sales Invoice", category: "Sales", method: "POST", path: "/invoice",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { 
        if (!res.id) return "No invoice ID returned";
        ctx.invoiceId = res.id; 
        return null; 
    }
  },
  {
    id: "T1.4", name: "Verify Stock Deduction", category: "Inventory", method: "GET", path: "/products/__productId__",
    expectStatus: 200,
    verifyFn: async (res, ctx) => {
        const currentStock = parseFloat(res.current_stock || 0);
        if (currentStock >= (ctx.initialStock || 0)) return `Stock did not decrease. Expected < ${ctx.initialStock}, got ${currentStock}`;
        return null;
    }
  },
  {
    id: "T3.1", name: "Post Cash Receipt", category: "Finance", method: "POST", path: "/transactions",
    expectStatus: 201,
    verifyFn: async (res) => res.success ? null : "Operation reported failure"
  },
  {
    id: "T3.2", name: "Onboard Lender", category: "Finance", method: "POST", path: "/lenders",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.lenderId = res.id; return null; }
  },
  {
    id: "T3.3", name: "Disburse Loan", category: "Finance", method: "POST", path: "/loans",
    expectStatus: 201,
    verifyFn: async (res) => res.id ? null : "No loan ID generated"
  },
  {
    id: "T4.1", name: "Add Employee", category: "HR", method: "POST", path: "/employees",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.employeeId = res.id; return null; }
  },
  {
    id: "T5.1", name: "Sync Analytics Dashboard", category: "Reports", method: "GET", path: "/dashboard/finance",
    expectStatus: 200,
    verifyFn: async (data) => {
      if (!data.cash_in_hand || parseFloat(data.cash_in_hand) === 0) return "Dashboard metrics not updated";
      return null;
    }
  }
];

const STATUS_ICONS: Record<string, any> = {
  idle: <FaHourglassHalf color="#94a3b8" />,
  running: <FaRedoAlt className="spin" color="#f59e0b" />,
  pass: <FaCheckCircle color="#10b981" />,
  fail: <FaExclamationTriangle color="#ef4444" />,
  skipped: <FaHourglassHalf opacity={0.3} />
};

// ─── Component ────────────────────────────────────────────
const SystemTester: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>(
    DEEP_SCENARIOS.map(t => ({ id: t.id, name: t.name, category: t.category, method: t.method, path: t.path, status: "idle" }))
  );
  const [running, setRunning] = useState(false);
  const ctx = useRef<TestContext>({});

  const updateResult = (id: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  };

  const runTest = async (test: TestCase): Promise<boolean> => {
    updateResult(test.id, { status: "running" });
    const t0 = Date.now();
    const today = new Date().toISOString().split("T")[0];
    const rand = Math.random().toString(36).substring(7);

    let path = test.path.replace("__productId__", String(ctx.current.productId || "0"));
    let body: any = null;

    if (test.id === "T1.1") {
      body = { username: `TEST_CUST_${rand}`, nickname: "Automated Test", phone: "9876543210", email: `test_${rand}@example.com` };
    } else if (test.id === "T1.2") {
      body = { name: `TEST_PROD_${rand}`, selling_price: 150, cost_price: 100, opening_stock: 50, category: "Testing" };
    } else if (test.id === "T1.3") {
      body = { 
        customer_id: ctx.current.customerId, 
        invoice_type: "NON-TAX", 
        bill_purpose: "real",
        items: [{ product_id: ctx.current.productId, name: "Test Item", qty: 5, rate: 150, total: 750 }],
        amount_paid: 750, balance_due: 0, payment_status: "PAID"
      };
    } else if (test.id === "T3.1") {
      body = { type: "RECEIPT", amount: 1000, description: "Test Receipt", date: today, mode: "CASH" };
    } else if (test.id === "T3.2") {
      body = { lender_name: `TEST_BANK_${rand}`, lender_type: "Bank", phone: "9876543210" };
    } else if (test.id === "T3.3") {
      body = { lender_id: ctx.current.lenderId, principal_amount: 50000, interest_rate: 10, start_date: today, repayment_cycle: "MONTHLY" };
    } else if (test.id === "T4.1") {
      body = { name: `TEST_EMP_${rand}`, designation: "Tester", salary: 20000, joining_date: today };
    }

    try {
      const res = await apiFetch(path, { method: test.method, body });
      const durationMs = Date.now() - t0;
      let data = await res.json().catch(() => ({}));

      const isOk = res.status === test.expectStatus || (test.expectStatus === 201 && res.status === 200);
      let error = isOk ? (test.verifyFn ? await test.verifyFn(data, ctx.current) : null) : `Expected ${test.expectStatus}, got ${res.status}`;

      if (!error) {
        updateResult(test.id, { status: "pass", httpStatus: res.status, durationMs });
        return true;
      } else {
        updateResult(test.id, { status: "fail", httpStatus: res.status, durationMs, likelyCause: error, errorBody: data });
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
      const ok = await runTest(test);
      if (!ok) {
        const idx = DEEP_SCENARIOS.indexOf(test);
        DEEP_SCENARIOS.slice(idx + 1).forEach(t => updateResult(t.id, { status: "skipped" }));
        break;
      }
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: "40px", background: "#020617", minHeight: "100vh", color: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: "white" }}>System <span style={{ color: "#3b82f6" }}>Integrity</span></h1>
            <p style={{ color: "#64748b", margin: "4px 0 0" }}>End-to-end transaction chain validation engine.</p>
          </div>
          <button onClick={runAll} disabled={running} style={{ 
            background: running ? "#1e293b" : "#3b82f6", color: "white", border: "none", padding: "12px 24px", 
            borderRadius: "10px", fontWeight: 700, cursor: running ? "default" : "pointer", display: "flex", alignItems: "center", gap: "10px" 
          }}>
            {running ? "Analyzing Chain..." : <><FaPlay size={12} /> Execute Integrity Test</>}
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {results.map((r) => (
            <div key={r.id} style={{ 
              display: "flex", padding: "16px 20px", background: "#0f172a", borderRadius: "12px", border: "1px solid #1e293b",
              alignItems: "center", gap: "20px", opacity: r.status === "skipped" ? 0.4 : 1
            }}>
              <div style={{ width: "40px", fontSize: "12px", color: "#475569", fontWeight: 800 }}>{r.id}</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
                {STATUS_ICONS[r.status]}
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: "10px", background: "#1e293b", padding: "2px 8px", borderRadius: "4px", color: "#94a3b8" }}>{r.category}</span>
              </div>
              <div style={{ display: "flex", gap: "20px", alignItems: "center", fontSize: "13px" }}>
                {r.durationMs && <span style={{ color: "#475569" }}>{r.durationMs}ms</span>}
                <span style={{ color: r.status === "fail" ? "#ef4444" : r.status === "pass" ? "#10b981" : "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{r.status}</span>
              </div>
              {r.status === "fail" && (
                <div style={{ position: "absolute", left: "102%", width: "300px", background: "#450a0a", padding: "12px", borderRadius: "8px", border: "1px solid #7f1d1d", zIndex: 10 }}>
                   <div style={{ fontWeight: 800, color: "#fca5a5", fontSize: "12px", marginBottom: "4px" }}>LOGICAL ERROR</div>
                   <div style={{ color: "white", fontSize: "11px" }}>{r.likelyCause}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SystemTester;
