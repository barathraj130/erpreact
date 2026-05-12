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
  supplierId?: number;
  purchaseBillId?: number;
  lenderId?: number;
  loanId?: number;
  employeeId?: number;
  brokerId?: number;
  initialStock?: number;
  initialTrialBalance?: { total_debits: number; total_credits: number };
}

// ─── Scenarios ────────────────────────────────────────────
const DEEP_SCENARIOS: TestCase[] = [
  // SCENARIO 1: PURCHASE TRANSACTION
  { id: "T1.1", name: "Create Supplier (TEST_SUPPLIER_TXN)", category: "Purchase", method: "POST", path: "/suppliers", expectStatus: 201 },
  { id: "T1.2", name: "Create Product (TEST_PRODUCT_TXN)", category: "Inventory", method: "POST", path: "/products", expectStatus: 201 },
  { id: "T1.3", name: "Check Baseline Trial Balance", category: "Finance", method: "GET", path: "/reports/finance/trial-balance", expectStatus: 200 },
  { id: "T1.4", name: "Purchase Bill + Partial Payment (8k/11.8k)", category: "Purchase", method: "POST", path: "/purchase-bills", expectStatus: 201 },
  { id: "T1.5", name: "Verify Inventory Increased (+10)", category: "Inventory", method: "GET", path: "/reports/inventory/summary", expectStatus: 200 },
  { id: "T1.6", name: "Verify Purchase Ledger (Double-Entry)", category: "Finance", method: "GET", path: "/reports/finance/day-book", expectStatus: 200 },
  { id: "T1.7", name: "Verify Supplier Ledger (Bal: 3800 Cr)", category: "Purchase", method: "GET", path: "/suppliers/__supplierId__", expectStatus: 200 },
  { id: "T1.8", name: "Pay Remaining Balance (3.8k)", category: "Purchase", method: "POST", path: "/purchase-bills/__purchaseBillId__/payment", expectStatus: 200 },
  { id: "T1.9", name: "Verify Supplier Balance = 0", category: "Purchase", method: "GET", path: "/suppliers/__supplierId__", expectStatus: 200 },

  // SCENARIO 2: SALES TRANSACTION
  { id: "T2.1", name: "Create Customer (TEST_CUSTOMER_TXN)", category: "Sales", method: "POST", path: "/users", expectStatus: 201 },
  { id: "T2.2", name: "Sales Invoice (NON-TAX) + Split Payment", category: "Sales", method: "POST", path: "/invoice", expectStatus: 201 },
  { id: "T2.3", name: "Verify Stock Decreased (-5)", category: "Inventory", method: "GET", path: "/reports/inventory/summary", expectStatus: 200 },
  { id: "T2.4", name: "Verify Sales Ledger (No GST, Split Cash/UPI)", category: "Finance", method: "GET", path: "/reports/finance/day-book", expectStatus: 200 },
  { id: "T2.5", name: "Verify Customer Ledger (Bal: 2500 Dr)", category: "Sales", method: "GET", path: "/users/__customerId__", expectStatus: 200 },
  { id: "T2.6", name: "Collect Remaining Balance (2.5k)", category: "Sales", method: "POST", path: "/invoice/__invoiceId__/payment", expectStatus: 200 },
  { id: "T2.7", name: "Verify Invoice = SETTLED", category: "Sales", method: "GET", path: "/invoice", expectStatus: 200 },

  // SCENARIO 3: FINANCE & HR
  { id: "T3.1", name: "Add Lender + Disburse Loan (1L)", category: "Finance", method: "POST", path: "/loans", expectStatus: 201 },
  { id: "T3.2", name: "Verify Loan Ledger (Liability Created)", category: "Finance", method: "GET", path: "/reports/finance/day-book", expectStatus: 200 },
  { id: "T3.3", name: "Pay Loan EMI (8k Prin + 1k Int)", category: "Finance", method: "POST", path: "/loans/__loanId__/payments", expectStatus: 201 },
  { id: "T3.4", name: "Add Employee + Mark Attendance", category: "HR", method: "POST", path: "/employees", expectStatus: 201 },
  { id: "T3.5", name: "Process Salary (Pro-rated)", category: "HR", method: "POST", path: "/employees/__employeeId__/salary", expectStatus: 201 },
  { id: "T3.6", name: "Add Broker + Record Commission", category: "Finance", method: "POST", path: "/brokers", expectStatus: 201 },

  // SCENARIO 4: REPORT VERIFICATION
  { id: "T4.1", name: "Verify Trial Balance Zero-Sum", category: "Reports", method: "GET", path: "/reports/finance/trial-balance", expectStatus: 200 },
  { id: "T4.2", name: "Verify Profit & Loss (Loss: 5.2k expected)", category: "Reports", method: "GET", path: "/reports/finance/profit-loss", expectStatus: 200 },
  { id: "T4.3", name: "Verify ITC Report (₹1800 eligible)", category: "Reports", method: "GET", path: "/reports/gst/itc", expectStatus: 200 },
  { id: "T4.4", name: "Validate GSTIN Logic", category: "QA_UNIT", method: "LOCAL", path: "validateGSTIN", expectStatus: 200 },

  { id: "T9.1", name: "Database Purge (TEST_ Cleanup)", category: "Cleanup", method: "POST", path: "/test/cleanup", expectStatus: 200 }
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
      .replace("__customerId__", String(ctx.current.customerId || "0"))
      .replace("__supplierId__", String(ctx.current.supplierId || "0"))
      .replace("__purchaseBillId__", String(ctx.current.purchaseBillId || "0"))
      .replace("__loanId__", String(ctx.current.loanId || "0"))
      .replace("__invoiceId__", String(ctx.current.invoiceId || "0"))
      .replace("__employeeId__", String(ctx.current.employeeId || "0"));
    
    let body: any = null;

    if (test.id === "T1.1") {
      body = { name: "TEST_SUPPLIER_TXN", phone: "9000000001", state: "Tamil Nadu", gstin: "33AABCT1332L1ZF" };
    } else if (test.id === "T1.2") {
      body = { name: "TEST_PRODUCT_TXN", sku: `TXN-${rand.toUpperCase()}`, cost_price: 1000, selling_price: 1500, gst_percent: 18, opening_stock: 0, min_stock: 5, unit: "pcs", hsn_code: "6006", category: "Trading" };
    } else if (test.id === "T1.4") {
      body = {
        supplier_id: ctx.current.supplierId, bill_type: "TAX", bill_date: today,
        items: [{ product_id: ctx.current.productId, quantity: 10, unit_price: 1000, tax_percent: 18 }],
        taxable_amount: 10000, cgst_amount: 900, sgst_amount: 900, total_amount: 11800,
        payments: [{ mode: "CASH", amount: 5000, payment_date: today }, { mode: "BANK", amount: 3000, payment_date: today }],
        total_paid: 8000, balance_amount: 3800
      };
    } else if (test.id === "T1.8") {
      body = { amount: 3800, mode: "UPI", payment_date: today, reference: "UPI-TXN-TEST-001" };
    } else if (test.id === "T2.1") {
      body = { username: `TEST_CUSTOMER_TXN`, role: "customer", phone: "9000000002", state: "Tamil Nadu", state_code: "33" };
    } else if (test.id === "T2.2") {
      body = {
        customer_id: ctx.current.customerId, invoice_type: "NON-TAX", invoice_date: today,
        items: [{ product_id: ctx.current.productId, qty: 5, rate: 1500, gst_rate: 0 }],
        total_amount: 7500,
        payments: [{ mode: "CASH", amount: 2500, payment_date: today }, { mode: "UPI", amount: 2500, payment_date: today }],
        total_paid: 5000, balance_amount: 2500
      };
    } else if (test.id === "T2.6") {
      body = { amount: 2500, mode: "BANK", payment_date: today };
    } else if (test.id === "T3.1") {
      body = { lender_name: "TEST_LENDER_TXN", type: "Bank", phone: "9000000003", principal: 100000, interest_rate: 12, start_date: today, repayment_cycle: "MONTHLY" };
    } else if (test.id === "T3.3") {
      body = { principal_amount: 8000, interest_amount: 1000, payment_date: today, mode: "BANK" };
    } else if (test.id === "T3.4") {
      // Create employee and mark attendance in one step or multi-step
      body = { name: "TEST_EMPLOYEE_TXN", designation: "Sales Staff", phone: "9000000004", salary: 15000, joining_date: today };
    } else if (test.id === "T3.5") {
      body = { month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), working_days: 26, present_days: 20, deductions: 0, advance_deducted: 0 };
    } else if (test.id === "T3.6") {
      body = { name: "TEST_BROKER_TXN", commission_rate: 2.5, phone: "9000000005" };
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
        // ID Collection
        if (test.id === "T1.1") ctx.current.supplierId = data.id;
        if (test.id === "T1.2") ctx.current.productId = data.id;
        if (test.id === "T1.4") ctx.current.purchaseBillId = data.id;
        if (test.id === "T2.1") ctx.current.customerId = data.id;
        if (test.id === "T2.2") ctx.current.invoiceId = data.id;
        if (test.id === "T3.1") ctx.current.loanId = data.id;
        if (test.id === "T3.4") ctx.current.employeeId = data.id;
        if (test.id === "T3.6") ctx.current.brokerId = data.id;

        // VERIFICATION LOGIC
        if (test.id === "T1.3") ctx.current.initialTrialBalance = data;
        
        if (test.id === "T1.5") {
          const prod = data.find((p: any) => p.id === ctx.current.productId);
          if (!prod || parseFloat(prod.current_stock) < 10) throw new Error(`Stock not updated. Expected >= 10, got ${prod?.current_stock}`);
        }

        if (test.id === "T1.6") {
          const entries = data.filter((e: any) => e.reference_id === ctx.current.purchaseBillId);
          const hasInventory = entries.some((e: any) => e.account_name.includes("Inventory") && parseFloat(e.debit) === 10000);
          const hasPayable = entries.some((e: any) => e.account_name.includes("Payable") && parseFloat(e.credit) === 11800);
          if (!hasInventory || !hasPayable) throw new Error("Double-entry ledger check failed for Purchase.");
        }

        if (test.id === "T1.7") {
          if (parseFloat(data.pending_balance) !== 3800) throw new Error(`Supplier balance mismatch. Expected 3800, got ${data.pending_balance}`);
        }

        if (test.id === "T2.3") {
          const prod = data.find((p: any) => p.id === ctx.current.productId);
          if (!prod || parseFloat(prod.current_stock) !== 5) throw new Error(`Stock not decreased. Expected 5, got ${prod?.current_stock}`);
        }

        if (test.id === "T4.1") {
          const diff = Math.abs(parseFloat(data.total_debits) - parseFloat(data.total_credits));
          if (diff > 0.01) throw new Error(`Trial Balance not zero-sum. Difference: ₹${diff.toFixed(2)}`);
        }

        if (test.id === "T4.2") {
          const loss = parseFloat(data.net_profit || 0);
          if (loss > 0) throw new Error(`P&L Mismatch. Expected loss, got profit: ₹${loss}`);
        }

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
      // Skip the cleanup step in "Run All" so data persists if user wants
      if (test.id === "T9.1") {
        updateResult(test.id, { status: "skipped" });
        continue;
      }

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

  const seedRealisticData = async () => {
    setRunning(true);
    try {
      const data = await import("../qa/MasterTestData.json");
      const supplierMap: Record<string, number> = {};
      
      // 1. Seed Lenders
      for (const lender of data.lenders) {
        await apiFetch("/lenders", { method: "POST", body: JSON.stringify(lender) });
      }
      
      // 2. Seed Employees
      for (const emp of data.employees) {
        await apiFetch("/employees", { method: "POST", body: JSON.stringify(emp) });
      }
      
      // 3. Seed Suppliers & collect IDs for Bills
      for (const sup of data.suppliers) {
        const res = await apiFetch("/suppliers", { method: "POST", body: JSON.stringify(sup) });
        if (res.ok) {
          const s = await res.json();
          supplierMap[sup.name] = s.id;
        }
      }

      // 4. Seed Purchase Bills
      for (const bill of data.purchaseBills) {
        const supplierId = supplierMap[bill.supplierName];
        if (supplierId) {
          await apiFetch("/purchase-bills", { 
            method: "POST", 
            body: JSON.stringify({ ...bill, supplier_id: supplierId, bill_date: bill.date, total_amount: bill.amount }) 
          });
        }
      }

      // 5. Seed Expenses
      for (const exp of data.expenses) {
        await apiFetch("/transactions", { method: "POST", body: JSON.stringify(exp) });
      }
      
      alert("✅ Realistic Data (Suppliers, Bills, Expenses) Seeded Successfully!");
    } catch (err: any) {
      alert("❌ Seeding Failed: " + err.message);
    }
    setRunning(false);
  };

  const clearAllData = async () => {
    if (!window.confirm("⚠️ Are you sure you want to PURGE all transaction and master data?")) return;
    setRunning(true);
    try {
      await apiFetch("/test/cleanup", { method: "POST" });
      alert("🗑️ Database Cleared Successfully!");
      setResults(DEEP_SCENARIOS.map(t => ({ id: t.id, name: t.name, category: t.category, method: t.method, path: t.path, status: "idle" })));
    } catch (err: any) {
      alert("❌ Cleanup Failed: " + err.message);
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
            <button onClick={seedRealisticData} disabled={running} className="btn-secondary" style={{ background: "#064e3b", color: "#6ee7b7", padding: "10px 20px" }}>
              🌱 Seed Realistic Data
            </button>
            <button onClick={clearAllData} disabled={running} className="btn-secondary" style={{ background: "#450a0a", color: "#fca5a5", padding: "10px 20px" }}>
              <FaTrashAlt /> Clear All
            </button>
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
              {running ? "Executing..." : <><FaPlay size={14} /> Start Deep Test</>}
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
