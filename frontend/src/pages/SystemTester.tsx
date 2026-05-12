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
  brokerId?: number;
  chitGroupId?: number;
  lenderId?: number;
  loanId?: number;
  employeeId?: number;
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
  // --- SCENARIO 1: SALES & INVENTORY CORE ---
  {
    id: "T1.1", name: "Create Test Customer", category: "Sales", method: "POST", path: "/users",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.customerId = res.id; return null; }
  },
  {
    id: "T1.2", name: "Create Test Product", category: "Inventory", method: "POST", path: "/products",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.productId = res.product?.id ?? res.id; return null; }
  },
  {
    id: "T1.3", name: "Create NON-TAX Invoice", category: "Sales", method: "POST", path: "/invoice",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.invoiceId = res.id; return null; }
  },

  // --- SCENARIO 3: FINANCE CORE (Receipts, Brokers, Loans) ---
  {
    id: "T3.1", name: "Create Cash Receipt", category: "Finance", method: "POST", path: "/transactions",
    body: null, expectStatus: 201,
    verifyFn: async (res) => { return res.success ? null : "FAIL: Receipt creation reported failure"; }
  },
  {
    id: "T3.2", name: "Register Broker (TEST)", category: "Finance", method: "POST", path: "/brokers",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.brokerId = res.id; return null; }
  },
  {
    id: "T3.3", name: "Create Chit Group", category: "Finance", method: "POST", path: "/chit-fund/groups",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.chitGroupId = res.id; return null; }
  },
  {
    id: "T3.4", name: "Onboard Lender", category: "Finance", method: "POST", path: "/lenders",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.lenderId = res.id; return null; }
  },
  {
    id: "T3.5", name: "Process Loan Disbursement", category: "Finance", method: "POST", path: "/loans",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.loanId = res.id; return null; }
  },

  // --- SCENARIO 4: HR CORE (Employees, Attendance) ---
  {
    id: "T4.1", name: "Hire Test Employee", category: "HR", method: "POST", path: "/employees",
    body: null, expectStatus: 201,
    verifyFn: async (res, ctx) => { ctx.employeeId = res.id; return null; }
  },
  {
    id: "T4.2", name: "Mark Daily Attendance", category: "HR", method: "POST", path: "/attendance",
    body: null, expectStatus: 201,
    verifyFn: async (res) => { return res.success ? null : "FAIL: Attendance not saved"; }
  },

  // --- VERIFICATION: CROSS-MODULE INTEGRITY ---
  {
    id: "T5.1", name: "Verify Finance Health Sync", category: "Reports", method: "GET", path: "/dashboard/finance",
    expectStatus: 200,
    verifyFn: async (data) => {
      if (!data.cash_in_hand || parseFloat(data.cash_in_hand) <= 0) return "FAIL: Finance health not reflecting receipt/loan inflow";
      return null;
    }
  },

  // --- CLEANUP (OPTIONAL / CONDITIONAL) ---
  {
    id: "T9.1", name: "Global Database Cleanup", category: "Cleanup", method: "POST", path: "/test/cleanup",
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

    if (test.id === "T3.1") {
      body = { type: "RECEIPT", amount: 5000, description: "TEST Cash Receipt: Advance", date: today, mode: "CASH" };
    } else if (test.id === "T3.2") {
      body = { name: "TEST Broker " + Math.random().toString(36).substring(7), phone: "9876543210", broker_type: "PURCHASE", commission_rate: 2.5 };
    } else if (test.id === "T3.3") {
      body = { group_name: "TEST Chit " + Math.random().toString(36).substring(7), total_value: 100000, monthly_installment: 5000, duration_months: 20, start_date: today };
    } else if (test.id === "T3.4") {
      body = { lender_name: "TEST Lender " + Math.random().toString(36).substring(7), lender_type: "Bank", contact_person: "Manager", phone: "9876543210" };
    } else if (test.id === "T3.5") {
      body = { lender_id: ctx.current.lenderId, party_name: "TEST Lender", principal_amount: 100000, interest_rate: 12, start_date: today, repayment_cycle: "MONTHLY" };
    } else if (test.id === "T4.1") {
      body = { name: "TEST Employee " + Math.random().toString(36).substring(7), designation: "Staff", salary: 15000, phone: "9876543210", joining_date: today };
    } else if (test.id === "T4.2") {
      body = { employee_id: ctx.current.employeeId, date: today, status: "Present" };
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
