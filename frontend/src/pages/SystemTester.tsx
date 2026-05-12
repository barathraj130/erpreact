import React, { useState, useRef, useMemo } from "react";
import { apiFetch } from "../utils/api";
import { 
  FaPlay, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, 
  FaRedoAlt, FaChevronDown, FaChevronUp, FaFileDownload, FaVial, FaTrashAlt, FaChartLine
} from "react-icons/fa";

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
  requestBody?: any;
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
  // --- SALES & INVENTORY ---
  {
    id: "T1.1", name: "Create Test Customer", category: "Sales", method: "POST", path: "/users",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { 
        if (!res.id) return "No customer ID returned";
        ctx.customerId = res.id; 
        return null; 
    }
  },
  {
    id: "T1.2", name: "Create Test Product", category: "Inventory", method: "POST", path: "/products",
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

  // --- FINANCE ---
  {
    id: "T3.1", name: "Post Cash Receipt", category: "Finance", method: "POST", path: "/transactions",
    expectStatus: 201,
    verifyFn: async (res) => res.success ? null : "Operation reported failure"
  },
  {
    id: "T3.2", name: "Onboard Lender", category: "Finance", method: "POST", path: "/lenders",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { 
        if (!res.id) return "No lender ID returned";
        ctx.lenderId = res.id; 
        return null; 
    }
  },
  {
    id: "T3.3", name: "Disburse Loan", category: "Finance", method: "POST", path: "/loans",
    expectStatus: 201,
    verifyFn: async (res) => res.id ? null : "No loan ID generated"
  },
  {
    id: "T3.4", name: "Create Chit Group", category: "Finance", method: "POST", path: "/chit-fund/groups",
    expectStatus: 201
  },
  {
    id: "T3.5", name: "Add Broker", category: "Finance", method: "POST", path: "/brokers",
    expectStatus: 201
  },

  // --- HR ---
  {
    id: "T4.1", name: "Add Employee", category: "HR", method: "POST", path: "/employees",
    expectStatus: 201,
    verifyFn: async (res, ctx) => { 
        if (!res.id) return "No employee ID returned";
        ctx.employeeId = res.id; 
        return null; 
    }
  },
  {
    id: "T4.2", name: "Mark Attendance", category: "HR", method: "POST", path: "/attendance",
    expectStatus: 201
  },
  {
    id: "T4.3", name: "Process Salary", category: "HR", method: "PUT", path: "/employees/__employeeId__/salary",
    expectStatus: 200,
    verifyFn: async (res) => {
        if (!res.payroll) return "No payroll record returned";
        const net = parseFloat(res.payroll.net_pay);
        // (20/26) * 15000 = 11538.46
        if (net < 11500 || net > 11600) return `Salary calculation error. Expected ~11538, got ${net}`;
        return null;
    }
  },

  // --- ANALYTICS SYNC ---
  {
    id: "T5.1", name: "Verify Finance Health", category: "Reports", method: "GET", path: "/dashboard/finance",
    expectStatus: 200,
    verifyFn: async (data) => {
      if (!data.success || !data.data) return "Dashboard API error";
      const { summary } = data.data;
      if (!summary || parseFloat(summary.cash_balance) === 0) return "Finance metrics not reflecting test data";
      return null;
    }
  },
  {
    id: "T5.2", name: "Verify Sales Register", category: "Reports", method: "GET", path: "/reports/sales/register?from=2020-01-01&to=2030-12-31",
    expectStatus: 200,
    verifyFn: async (res) => {
        if (!Array.isArray(res) || res.length === 0) return "Sales Register report is empty despite test invoice";
        return null;
    }
  },

  // --- CLEANUP ---
  {
    id: "T9.1", name: "Database Purge (Cleanup)", category: "Cleanup", method: "POST", path: "/test/cleanup",
    expectStatus: 200
  }
];

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  idle: { color: "#94a3b8", icon: <FaHourglassHalf /> },
  running: { color: "#f59e0b", icon: <FaRedoAlt className="spin" /> },
  pass: { color: "#10b981", icon: <FaCheckCircle /> },
  fail: { color: "#ef4444", icon: <FaExclamationTriangle /> },
  skipped: { color: "#475569", icon: <FaHourglassHalf opacity={0.3} /> }
};

// ─── Component ────────────────────────────────────────────
const SystemTester: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>(
    DEEP_SCENARIOS.map(t => ({ id: t.id, name: t.name, category: t.category, method: t.method, path: t.path, status: "idle" }))
  );
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ctx = useRef<TestContext>({});

  const stats = useMemo(() => {
    const total = DEEP_SCENARIOS.length;
    const passed = results.filter(r => r.status === "pass").length;
    const failed = results.filter(r => r.status === "fail").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const progress = ((passed + failed + skipped) / total) * 100;
    return { total, passed, failed, skipped, progress };
  }, [results]);

  const updateResult = (id: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  };

  const runTest = async (test: TestCase): Promise<boolean> => {
    updateResult(test.id, { status: "running" });
    const t0 = Date.now();
    const today = new Date().toISOString().split("T")[0];
    const rand = Math.random().toString(36).substring(7);

    let path = test.path
      .replace("__productId__", String(ctx.current.productId || "0"))
      .replace("__employeeId__", String(ctx.current.employeeId || "0"));
    let body: any = null;

    if (test.id === "T1.1") {
      body = { username: `TEST_CUST_${rand}`, nickname: "Automated Test", phone: "9876543210", email: `test_${rand}@example.com` };
    } else if (test.id === "T1.2") {
      body = { 
        name: `TEST_PROD_${rand}`, 
        sku: `SKU-${rand.toUpperCase()}`,
        selling_price: 150, 
        cost_price: 100, 
        gst_percent: 18,
        opening_stock: 50, 
        min_stock: 5,
        unit: "pcs",
        category: "Trading",
        hsn_code: "6006"
      };
    } else if (test.id === "T1.3") {
      body = { 
        customer_id: ctx.current.customerId, 
        invoice_type: "NON-TAX", 
        bill_purpose: "real",
        items: [{ product_id: ctx.current.productId, name: "Test Item", qty: 5, rate: 150, total: 750 }],
        amount_paid: 750, balance_due: 0, payment_status: "PAID"
      };
    } else if (test.id === "T3.1") {
      body = { type: "RECEIPT", amount: 1000, description: "TEST_RECEIPT_AUTO", date: today, mode: "CASH" };
    } else if (test.id === "T3.2") {
      body = { lender_name: `TEST_BANK_${rand}`, lender_type: "Bank", phone: "9876543210", contact_person: "Test Manager" };
    } else if (test.id === "T3.3") {
      body = { lender_id: ctx.current.lenderId, party_name: "TEST_LENDER", principal_amount: 100000, interest_rate: 12, start_date: today, repayment_cycle: "MONTHLY" };
    } else if (test.id === "T3.4") {
      body = { group_name: `TEST_CHIT_${rand}`, total_value: 100000, monthly_installment: 5000, duration_months: 20, start_date: today };
    } else if (test.id === "T3.5") {
      body = { name: `TEST_BROKER_${rand}`, phone: "9876543210", broker_type: "PURCHASE", commission_rate: 2.5 };
    } else if (test.id === "T4.1") {
      body = { name: `TEST_EMP_${rand}`, designation: "Sales Staff", salary: 15000, phone: "9876543210", joining_date: today };
    } else if (test.id === "T4.2") {
      body = { employee_id: ctx.current.employeeId, date: today, status: "Present" };
    } else if (test.id === "T4.3") {
      body = { month: today.slice(0, 7), working_days: 26, present_days: 20, deductions: 0, advance_deducted: 0 };
    }

    try {
      const res = await apiFetch(path, { method: test.method, body });
      const durationMs = Date.now() - t0;
      let data = await res.json().catch(() => ({}));

      const isOk = res.status === test.expectStatus || (test.expectStatus === 201 && res.status === 200);
      let error = isOk ? (test.verifyFn ? await test.verifyFn(data, ctx.current) : null) : `Status mismatch: Expected ${test.expectStatus}, got ${res.status}`;

      if (!error) {
        updateResult(test.id, { status: "pass", httpStatus: res.status, durationMs, requestBody: body });
        return true;
      } else {
        updateResult(test.id, { 
          status: "fail", 
          httpStatus: res.status, 
          durationMs, 
          likelyCause: error, 
          errorBody: data,
          requestBody: body
        });
        return false;
      }
    } catch (err: any) {
      updateResult(test.id, { status: "fail", likelyCause: err.message, requestBody: body });
      return false;
    }
  };

  const runAll = async () => {
    setRunning(true);
    ctx.current = {};
    for (const test of DEEP_SCENARIOS) {
      const ok = await runTest(test);
      if (!ok && (test.id.startsWith("T1") || test.id === "T1.2")) {
        // T1 failures block other T1 tests as requested
        const idx = DEEP_SCENARIOS.indexOf(test);
        DEEP_SCENARIOS.slice(idx + 1).filter(t => t.id.startsWith("T1")).forEach(t => updateResult(t.id, { status: "skipped" }));
        // But Finance (T3) and HR (T4) run independently
      }
    }
    setRunning(false);
  };

  const exportResults = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `erp_test_results_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div style={{ padding: "40px", background: "#020617", minHeight: "100vh", color: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 900, color: "white", display: "flex", alignItems: "center", gap: "12px" }}>
              <FaVial color="#3b82f6" /> System <span style={{ color: "#3b82f6" }}>Integrity</span>
            </h1>
            <p style={{ color: "#64748b", margin: "8px 0 0", fontSize: "16px" }}>Full transaction chain diagnostic & database health engine.</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={exportResults} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px" }}>
              <FaFileDownload /> Export JSON
            </button>
            <button onClick={runAll} disabled={running} style={{ 
              background: running ? "#1e293b" : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", 
              color: "white", border: "none", padding: "12px 28px", 
              borderRadius: "12px", fontWeight: 700, cursor: running ? "default" : "pointer", 
              display: "flex", alignItems: "center", gap: "10px",
              boxShadow: running ? "none" : "0 4px 15px rgba(59, 130, 246, 0.4)",
              transition: "all 0.2s"
            }}>
              {running ? "Executing Chain..." : <><FaPlay size={14} /> Start Deep Test</>}
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        <div style={{ background: "#0f172a", height: "12px", borderRadius: "100px", marginBottom: "40px", overflow: "hidden", border: "1px solid #1e293b" }}>
          <div style={{ width: `${stats.progress}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #10b981)", transition: "width 0.4s ease-out" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {results.map((r) => {
            const config = STATUS_CONFIG[r.status];
            const isExpanded = expandedId === r.id;
            
            return (
              <div key={r.id} style={{ display: "flex", flexDirection: "column" }}>
                <div 
                  onClick={() => r.status === "fail" && setExpandedId(isExpanded ? null : r.id)}
                  style={{ 
                    display: "flex", padding: "20px 24px", background: "#0f172a", borderRadius: isExpanded ? "16px 16px 0 0" : "16px", 
                    border: `1px solid ${r.status === "fail" ? "#ef444444" : "#1e293b"}`,
                    alignItems: "center", gap: "24px", opacity: r.status === "skipped" ? 0.4 : 1,
                    cursor: r.status === "fail" ? "pointer" : "default",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ width: "50px", fontSize: "14px", color: "#475569", fontWeight: 800 }}>{r.id}</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "20px", display: "flex" }}>{config.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px" }}>{r.name}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>{r.category}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
                    {r.durationMs && <span style={{ color: "#475569", fontSize: "14px", fontFamily: "monospace" }}>{r.durationMs}ms</span>}
                    <div style={{ 
                      color: config.color, fontWeight: 900, fontSize: "14px", 
                      textTransform: "uppercase", padding: "4px 12px", background: `${config.color}15`, borderRadius: "6px"
                    }}>
                      {r.status}
                    </div>
                    {r.status === "fail" && (isExpanded ? <FaChevronUp color="#64748b" /> : <FaChevronDown color="#64748b" />)}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ background: "#0f172a", border: "1px solid #ef444444", borderTop: "none", borderRadius: "0 0 16px 16px", padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Request Details</h4>
                      <div style={{ background: "#020617", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                        <div style={{ color: "#3b82f6", fontWeight: 800, marginBottom: "8px" }}>{r.method} {r.path}</div>
                        <pre style={{ margin: 0, fontSize: "12px", color: "#94a3b8", overflowX: "auto" }}>
                          {JSON.stringify(r.requestBody, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#ef4444", textTransform: "uppercase" }}>Error Context</h4>
                      <div style={{ background: "#450a0a20", padding: "16px", borderRadius: "8px", border: "1px solid #ef444444" }}>
                        <div style={{ color: "#fca5a5", fontWeight: 800, marginBottom: "12px", fontSize: "14px" }}>
                          {r.likelyCause}
                        </div>
                        <pre style={{ margin: 0, fontSize: "12px", color: "#f87171", overflowX: "auto" }}>
                          {JSON.stringify(r.errorBody, null, 2)}
                        </pre>
                      </div>
                      <div style={{ marginTop: "16px", color: "#fbbf24", fontSize: "13px", fontWeight: 600 }}>
                        💡 Fix Suggestion: Verify endpoint payload or database constraints.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Bar */}
        {!running && results.some(r => r.status !== "idle") && (
          <div style={{ 
            marginTop: "40px", padding: "24px", background: "#0f172a", borderRadius: "20px", border: "1px solid #1e293b",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div style={{ display: "flex", gap: "40px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Passed</div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#10b981" }}>{stats.passed}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Failed</div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#ef4444" }}>{stats.failed}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Skipped</div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#475569" }}>{stats.skipped}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={runAll} style={{ padding: "10px 24px", borderRadius: "10px", background: "#1e293b", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>
                Re-run Full Suite
              </button>
              <button onClick={() => apiFetch("/test/cleanup", { method: "POST" })} style={{ padding: "10px 24px", borderRadius: "10px", background: "#7f1d1d", color: "white", border: "none", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaTrashAlt /> Manual Cleanup
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; } 
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-secondary { background: #1e293b; color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-secondary:hover { background: #334155; }
      `}</style>
    </div>
  );
};

export default SystemTester;
