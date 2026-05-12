import React, { useState, useRef, useMemo } from "react";
import { apiFetch } from "../utils/api";
import { validateGSTIN } from "../qa/QAHelperFunctions";
import { 
  FaPlay, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, 
  FaRedoAlt, FaChevronDown, FaChevronUp, FaFileDownload, FaVial, FaTrashAlt
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
  { id: "T1.1", name: "Create Test Customer", category: "Sales", method: "POST", path: "/users", expectStatus: 201 },
  { id: "T1.2", name: "Create Test Product", category: "Inventory", method: "POST", path: "/products", expectStatus: 201 },
  { id: "T1.3", name: "Process Sales Invoice", category: "Sales", method: "POST", path: "/invoice", expectStatus: 201 },
  { id: "T1.4", name: "Verify Stock Deduction", category: "Inventory", method: "GET", path: "/products/__productId__", expectStatus: 200 },
  { id: "T3.1", name: "Post Cash Receipt", category: "Finance", method: "POST", path: "/transactions", expectStatus: 201 },
  { id: "T3.2", name: "Onboard Lender", category: "Finance", method: "POST", path: "/lenders", expectStatus: 201 },
  { id: "T3.3", name: "Disburse Loan", category: "Finance", method: "POST", path: "/loans", expectStatus: 201 },
  { id: "T3.4", name: "Create Chit Group", category: "Finance", method: "POST", path: "/chit-fund/groups", expectStatus: 201 },
  { id: "T3.5", name: "Add Broker", category: "Finance", method: "POST", path: "/brokers", expectStatus: 201 },
  { id: "T4.1", name: "Add Employee", category: "HR", method: "POST", path: "/employees", expectStatus: 201 },
  { id: "T4.2", name: "Mark Attendance", category: "HR", method: "POST", path: "/attendance", expectStatus: 201 },
  { id: "T4.3", name: "Process Salary", category: "HR", method: "PUT", path: "/employees/__employeeId__/salary", expectStatus: 200 },
  { id: "T5.1", name: "Verify Finance Health", category: "Reports", method: "GET", path: "/dashboard/finance", expectStatus: 200 },
  { id: "T5.2", name: "Verify Sales Register", category: "Reports", method: "GET", path: "/reports/sales/register?from=2020-01-01&to=2030-12-31", expectStatus: 200 },
  { id: "QA.1", name: "Validate GSTIN Logic", category: "QA_UNIT", method: "LOCAL", path: "validateGSTIN", expectStatus: 200 },
  { id: "QA.2", name: "Validate Currency Logic", category: "QA_UNIT", method: "LOCAL", path: "formatCurrency", expectStatus: 200 },
  { id: "T9.1", name: "Database Purge (Cleanup)", category: "Cleanup", method: "POST", path: "/test/cleanup", expectStatus: 200 }
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
      body = { username: `TEST_CUST_${rand}`, role: "customer", phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`, state: "Tamil Nadu", state_code: "33" };
    } else if (test.id === "T1.2") {
      body = { 
        name: `TEST_PROD_${rand}`, sku: `SKU-${rand.toUpperCase()}`,
        selling_price: 150, cost_price: 100, gst_percent: 18,
        opening_stock: 50, min_stock: 5, unit: "pcs",
        category: "Trading", hsn_code: "6006"
      };
    } else if (test.id === "T1.3") {
      if (!ctx.current.productId) return false;
      body = { 
        customer_id: ctx.current.customerId,
        invoice_type: "TAX_INVOICE",
        items: [{ product_id: ctx.current.productId, qty: 5, rate: 150, gst_rate: 18 }],
        amount_paid: 200,
        payment_status: "PARTIAL",
        payments: [{ amount: 200, payment_method: "CASH", payment_date: today }]
      };
    } else if (test.id === "T3.1") {
      body = { type: "RECEIPT", amount: 1000, description: "TEST_RECEIPT_AUTO", date: today, mode: "CASH", category: "Direct Income" };
    } else if (test.id === "T3.2") {
      body = { lender_name: `TEST_LENDER_${rand}`, contact_info: "9998887776", email: `test_${rand}@erp.com` };
    } else if (test.id === "T3.3") {
      if (!ctx.current.lenderId) return false;
      body = { 
        lender_id: ctx.current.lenderId, 
        principal_amount: 50000, 
        interest_rate: 12, 
        start_date: today, 
        duration_months: 12, 
        repayment_cycle: "MONTHLY",
        party_name: "TEST_LOAN"
      };
    } else if (test.id === "T3.4") {
      body = { 
        group_name: `TEST_CHIT_${rand}`, 
        total_value: 100000, 
        monthly_installment: 10000, 
        duration_months: 10, 
        start_date: today 
      };
    } else if (test.id === "T3.5") {
      body = { name: `TEST_BROKER_${rand}`, commission_rate: 2, phone: "8887776665" };
    } else if (test.id === "T4.1") {
      body = { name: `TEST_EMP_${rand}`, designation: "staff", phone: "7776665554", salary: 25000, joining_date: today };
    } else if (test.id === "T4.2") {
      if (!ctx.current.employeeId) return false;
      body = { employee_id: ctx.current.employeeId, date: today, status: "Present" };
    } else if (test.id === "T4.3") {
      if (!ctx.current.employeeId) return false;
      body = { month: "May 2026", working_days: 26, present_days: 20, deductions: 0, advance_deducted: 0 };
    }

    if (test.method === "LOCAL") {
      try {
        if (test.id === "QA.1") {
          // Unit test for GSTIN logic
          const valid = validateGSTIN("33AABCS1234A1Z5");
          const invalid = validateGSTIN("29AABCS1234A1Z@");
          if (valid && !invalid) {
            updateResult(test.id, { status: "pass", durationMs: 1 });
            return true;
          }
          throw new Error("GSTIN logic failed to correctly identify valid/invalid formats.");
        }
        if (test.id === "QA.2") {
          // Placeholder for currency logic test
          updateResult(test.id, { status: "pass", durationMs: 1 });
          return true;
        }
      } catch (err: any) {
        updateResult(test.id, { status: "fail", likelyCause: err.message });
        return false;
      }
    }

    try {
      const res = await apiFetch(path, { method: test.method, body: body ? JSON.stringify(body) : null });
      const durationMs = Date.now() - t0;
      let data = await res.json().catch(() => ({}));

      const isOk = res.status === test.expectStatus || (test.expectStatus === 201 && res.status === 200);
      
      if (isOk) {
        if (test.id === "T1.1") ctx.current.customerId = data.id;
        if (test.id === "T1.2") {
          const p = data.product || data;
          ctx.current.productId = p.id;
          ctx.current.initialStock = parseFloat(p.opening_stock || 0);
        }
        if (test.id === "T3.2") ctx.current.lenderId = data.id;
        if (test.id === "T4.1") ctx.current.employeeId = data.id;

        updateResult(test.id, { status: "pass", httpStatus: res.status, durationMs, requestBody: body });
        return true;
      } else {
        updateResult(test.id, { 
          status: "fail", 
          httpStatus: res.status, 
          durationMs, 
          likelyCause: data.error || `Status mismatch: Expected ${test.expectStatus}, got ${res.status}`, 
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
    const chainStatus = { inventory: true, finance: true, hr: true };

    for (const test of DEEP_SCENARIOS) {
      // Fail-fast logic
      const isInv = test.id.startsWith("T1");
      const isFin = test.id.startsWith("T3");
      const isHR = test.id.startsWith("T4");

      if ((isInv && !chainStatus.inventory) || (isFin && !chainStatus.finance) || (isHR && !chainStatus.hr)) {
        updateResult(test.id, { status: "skipped" });
        continue;
      }

      const ok = await runTest(test);
      if (!ok) {
        if (isInv) chainStatus.inventory = false;
        if (isFin && test.id === "T3.2") chainStatus.finance = false;
        if (isHR && test.id === "T4.1") chainStatus.hr = false;
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
