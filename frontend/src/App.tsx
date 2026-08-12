import React, { useEffect, useState } from "react";
import { FaBars } from "react-icons/fa";
import {
  Navigate,
  Outlet,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import Sidebar from "./components/Layout/Sidebar";
import Topbar from "./components/Layout/Topbar";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import AuditLog from "./pages/admin/AuditLog";
import Settlements from "./pages/settlements/Settlements";
import NewSettlement from "./pages/settlements/NewSettlement";
import SettlementDetail from "./pages/settlements/SettlementDetail";
import "./components/Layout/Layout.css";
import { TenantProvider, useTenant } from "./context/TenantContext";
import { PermissionsProvider } from "./context/PermissionsContext";
import { useAuthUser } from "./hooks/useAuthUser";
import AdvancedReports from "./pages/AdvancedReports"; // Added here
import { Toaster } from "react-hot-toast";

// Pages
import AIInsights from "./pages/AIInsights";
import AdminSetup from "./pages/AdminSetup";
import ERPReset from "./pages/ERPReset";
import Branches from "./pages/Branches";
import CreateInvoice from "./pages/CreateInvoice";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import DayBook from "./pages/DayBook";
import EditInvoice from "./pages/EditInvoice";
import DocumentManager from "./pages/DocumentManager";
import Employees from "./pages/Employees";
import FileManager from "./pages/FileManager";
import HostLogin from "./pages/HostLogin";
import Attendance from "./pages/hr/Attendance";
import MobileAttendance from "./pages/hr/MobileAttendance";
import WeeklySalary from "./pages/hr/WeeklySalary";
import DailySalary from "./pages/hr/DailySalary";
import Inventory from "./pages/Inventory";
import Invoices from "./pages/Invoices";
import SalesReturns from "./pages/SalesReturns";
import StockLots from "./pages/StockLots";
import StockLotDetail from "./pages/StockLotDetail";
import StockInventory from "./pages/StockInventory";
import ProductionLots from "./pages/production/ProductionLots";
import ProductionLotDetail from "./pages/production/ProductionLotDetail";
import ProductionInventory from "./pages/production/ProductionInventory";
import RetailRevenue from "./pages/RetailRevenue";
import InvoiceDetails from "./pages/InvoiceDetails";
import Ledgers from "./pages/Ledgers";
import Login from "./pages/Login";
import BranchLogin from "./pages/BranchLogin";
import PlatformAdmin from "./pages/PlatformAdmin";
import PurchaseBills from "./pages/PurchaseBills";
import SimplifiedPurchaseBill from "./pages/SimplifiedPurchaseBill";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Subscriptions from "./pages/Subscriptions";
import Suppliers from "./pages/Suppliers";
import Transactions from "./pages/Transactions";
import SimpleDashboard from "./SimpleDashboard";
import SynthesisDashboard from "./SynthesisDashboard";
import CustomerNotifications from "./pages/CustomerNotifications";
import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import CustomerShop from "./pages/customer/CustomerShop";
import CustomerLedger from "./pages/customer/CustomerLedger";
import CustomerLayout from "./components/Layout/CustomerLayout";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerPortalLayout from "./pages/customer/CustomerPortalLayout";
import CustomerHome from "./pages/customer/CustomerHome";
import CustomerProducts from "./pages/customer/CustomerProducts";
import CustomerOrders from "./pages/customer/CustomerOrders";
import CustomerLedgerPage from "./pages/customer/CustomerLedgerPage";
import CustomerContact from "./pages/customer/CustomerContact";

// Admin Module
import UserManagement from "./pages/admin/UserManagement";
import BranchDetail from "./pages/admin/BranchDetail";
import UserPermissionsEditor from "./pages/admin/UserPermissionsEditor";
import RoundOffRequests from "./pages/admin/RoundOffRequests";
import StorefrontSettings from "./pages/admin/StorefrontSettings";

// Public Module
import FluxoraLanding from "./pages/public/FluxoraLanding";
import StorePage from "./pages/public/StorePage";

// Fluxora Master Control Panel — standalone, separate credential system
import MasterLogin from "./pages/master/MasterLogin";
import MasterPanel from "./pages/master/MasterPanel";

// Fluxora Organization ERP — Fluxora's own internal staff/HR/finance,
// separate from any tenant's data (see backend/routes/organization.js)
import OrgDashboard from "./pages/org/OrgDashboard";
import OrgEmployees from "./pages/org/Employees";
import OrgAttendance from "./pages/org/Attendance";
import OrgPayroll from "./pages/org/Payroll";
import OrgLeaves from "./pages/org/Leaves";
import OrgFinance from "./pages/org/OrgFinance";
import PlatformFinance from "./pages/master/PlatformFinance";

// Work Accountability & Strict Audit — new, additive module
// (see backend/routes/workAccountability.js). Tenant-scoped, reuses the
// existing users/companies/branches/RBAC — no new auth or tenant concept.
import WorkDashboard from "./pages/work/WorkDashboard";
import WorkJobs from "./pages/work/Jobs";
import WorkJobDetail from "./pages/work/JobDetail";
import WorkAuditTimeline from "./pages/work/AuditTimeline";

// Finance Module
import BankReconciliation from "./pages/finance/BankReconciliation";
import CashReceipts from "./pages/finance/CashReceipts";
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import FinancialReports from "./pages/finance/FinancialReports";
import LoanManagement from "./pages/finance/LoanManagement";
import ChitManagement from "./pages/finance/ChitManagement";
import BrokerManagement from "./pages/brokers/BrokerManagement";
import BrokerLedger from "./pages/brokers/BrokerLedger";
import LenderManagement from "./pages/finance/LenderManagement";
import ProprietorAccount from "./pages/finance/ProprietorAccount";
import CashTransfers from "./pages/finance/CashTransfers";
import PersonalAccountsAdmin from "./pages/PersonalAccountsAdmin";

// New Reports Module
import ReportsDashboard from "./pages/reports/ReportsDashboard";
import ReportViewer from "./pages/reports/ReportViewer";

// Enterprise Reports Module
import ReportsHome from "./pages/reports/ReportsHome";
import SalesReports from "./pages/reports/SalesReports";
import PurchaseReports from "./pages/reports/PurchaseReports";
import InventoryReports from "./pages/reports/InventoryReports";
import FinanceReports from "./pages/reports/FinanceReports";
import ExpenseReports from "./pages/reports/ExpenseReports";
import ExpenseList from "./pages/expenses/ExpenseList";
import GSTReports from "./pages/reports/GSTReports";
import HRReports from "./pages/reports/HRReports";
import ExecutiveDashboard from "./pages/reports/ExecutiveDashboard";
import DiscountReport from "./pages/reports/DiscountReport";
import ProductMovement from "./pages/reports/ProductMovement";
import ConsolidatedInventory from "./pages/ConsolidatedInventory";
import StockTransfer from "./pages/StockTransfer";
import StockRequestsInbox from "./pages/StockRequestsInbox";
import BranchBilling from "./pages/BranchBilling";
import GlobalInventory from "./pages/GlobalInventory";
import BillFormatSettings from "./pages/BillFormatSettings";
import PaymentMethodsAdmin from "./pages/PaymentMethodsAdmin";
import SystemTester from "./pages/SystemTester";
import DeliveryOrders from "./pages/DeliveryOrders";
import CreateDeliveryOrder from "./pages/CreateDeliveryOrder";
import DeliveryOrderDetail from "./pages/DeliveryOrderDetail";
import EditDeliveryOrder from "./pages/EditDeliveryOrder";
import LedgerViewer from "./pages/LedgerViewer";



// --- 🌐 GLOBAL PAGE TRANSITION ---
const PageTransition: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="canvas-area">{children}</div>;

// --- 🏗️ ENTERPRISE LAYOUT WRAPPER ---
const EnterpriseLayout: React.FC<{
  user: any;
  mode: "HOST" | "ADMIN" | "USER";
}> = ({ user, mode }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isBranchUser = user?.role !== 'admin' && user?.branch_id;
  const hideSidebar = isBranchUser;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="enterprise-shell">
      {!hideSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          isMobile={isMobile}
          mode={mode}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
      )}

      <div
        className={`shell-main ${sidebarOpen ? "blur-content" : ""}`}
        style={{
          marginLeft: (isMobile || hideSidebar) ? "0" : (sidebarCollapsed ? "60px" : "220px"),
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          background: "var(--erp-bg, #f8fafc)",
          padding: 0,
        }}
      >
        {isMobile && !hideSidebar && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "fixed", top: "12px", left: "12px",
              background: "white", border: "1px solid #e8e8e5",
              width: "42px", height: "42px", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 400,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <FaBars size={17} />
          </button>
        )}

        {user?.is_impersonated && (
          <div style={{ background: "#dc2626", color: "#fff", padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600 }}>
            <span>⚠️ Master Session: You are viewing this ERP as {user.impersonated_by} (Master Admin)</span>
            <button
              onClick={() => { localStorage.removeItem("erp-token"); window.close(); }}
              style={{ padding: "4px 12px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12 }}
            >
              End Session
            </button>
          </div>
        )}

        {!hideSidebar && <Topbar mode={mode} />}

        <main style={{ flex: 1 }}>
          <PageTransition>
            <PermissionsProvider>
              <Outlet />
            </PermissionsProvider>
          </PageTransition>
        </main>
        <Toaster position="top-right" />
      </div>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)", /* Darker overlay */
            backdropFilter: "blur(4px)",
            zIndex: 950, /* Below sidebar (1000) */
          }}
        />
      )}

      <KeyboardShortcuts />
    </div>
  );
};

// --- 🛡️ GUARDS ---
const HostRoute = () => {
  const { user, loading } = useAuthUser();
  if (loading) return <div className="full-screen-loader">Loading...</div>;
  return user?.role?.toLowerCase() === "superadmin" ? (
    <EnterpriseLayout user={user} mode="HOST" />
  ) : (
    <Navigate to="/company-login" />
  );
};

const AdminRoute = () => {
  const { user, loading } = useAuthUser();
  if (loading) return <div className="full-screen-loader">Loading...</div>;
  return user?.role?.toLowerCase() === "admin" ? (
    <EnterpriseLayout user={user} mode="ADMIN" />
  ) : (
    <Navigate to="/dashboard" />
  );
};

const WorkspaceRoute = () => {
  const { user, loading } = useAuthUser();
  if (loading) return <div className="full-screen-loader">Loading...</div>;
  return user ? (
    <EnterpriseLayout user={user} mode="USER" />
  ) : (
    <Navigate to="/company-login" />
  );
};

const CustomerRoute = () => {
  const { user, loading } = useAuthUser();
  if (loading) return <div className="full-screen-loader">Loading...</div>;
  return user?.role?.toLowerCase() === "customer" || user?.role?.toLowerCase() === "user" ? (
    <CustomerLayout />
  ) : (
    <Navigate to="/company-login" />
  );
};

// "/" shows the public Fluxora marketing site for logged-out visitors, and
// sends already-logged-in users straight to their dashboard.
const Home = () => {
  const { user, loading } = useAuthUser();
  if (loading) return <div className="full-screen-loader">Loading...</div>;
  return user ? <Navigate to="/dashboard" replace /> : <FluxoraLanding />;
};

const App: React.FC = () => {
  // App initializing
  return (
    <TenantProvider>
      <Router>
        <Routes>
          <Route path="/company-login" element={<Login />} />
          <Route path="/branch-login" element={<BranchLogin />} />
          <Route path="/employee-login" element={<EmployeeLogin />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/customer-login" element={<CustomerLogin />} />
          <Route path="/host-login" element={<HostLogin />} />
          <Route path="/mark-attendance/:token" element={<MobileAttendance />} />
          <Route path="/mark-attendance" element={<MobileAttendance />} />
          <Route path="/store/:slug" element={<StorePage />} />

          {/* Fluxora Master — completely standalone, its own master_token auth,
              never nested under HostRoute/AdminRoute/WorkspaceRoute */}
          <Route path="/fluxora-master" element={<MasterLogin />} />
          <Route path="/master" element={<MasterPanel />} />
          <Route path="/master/platform-finance" element={<PlatformFinance />} />

          <Route element={<HostRoute />}>
            <Route
              path="/platform-admin"
              element={<PlatformAdmin tab="hub" />}
            />
            <Route
              path="/platform-admin/tenants"
              element={<PlatformAdmin tab="tenants" />}
            />
            <Route
              path="/platform-admin/config"
              element={<PlatformAdmin tab="config" />}
            />
            <Route
              path="/superadmin"
              element={<PlatformAdmin tab="hub" />}
            />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin/users/:id/permissions" element={<UserPermissionsEditor />} />
            <Route path="/admin/roundoff-requests" element={<RoundOffRequests />} />
            <Route path="/admin/setup" element={<AdminSetup />} />
            <Route path="/admin/branches" element={<Branches />} />
            <Route path="/admin/subscriptions" element={<Subscriptions />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/bill-format" element={<BillFormatSettings />} />
            <Route path="/admin/payment-methods" element={<PaymentMethodsAdmin />} />
            <Route path="/admin/system-test" element={<SystemTester />} />
            <Route path="/admin/reset" element={<ERPReset />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/employees" element={<Employees />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/branches/:id" element={<BranchDetail />} />
            <Route path="/admin/audit-log" element={<AuditLog />} />
            <Route path="/admin/storefront" element={<StorefrontSettings />} />
            <Route path="/settlements" element={<Settlements />} />
            <Route path="/settlements/new" element={<NewSettlement />} />
            <Route path="/settlements/:id" element={<SettlementDetail />} />

            {/* Fluxora Organization ERP — Fluxora's own internal staff only,
                gated server-side by requireFluxoraStaff (company_code=FLUXORA) */}
            <Route path="/org/dashboard" element={<OrgDashboard />} />
            <Route path="/org/employees" element={<OrgEmployees />} />
            <Route path="/org/attendance" element={<OrgAttendance />} />
            <Route path="/org/payroll" element={<OrgPayroll />} />
            <Route path="/org/leaves" element={<OrgLeaves />} />
            <Route path="/org/finance" element={<OrgFinance />} />
          </Route>

          <Route element={<WorkspaceRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/sales/customer-notifications" element={<CustomerNotifications />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<CreateInvoice />} />
            <Route path="/invoices/:id" element={<InvoiceDetails />} />
            <Route path="/invoices/edit/:id" element={<EditInvoice />} />
            <Route path="/delivery-orders" element={<DeliveryOrders />} />
            <Route path="/delivery-orders/new" element={<CreateDeliveryOrder />} />
            <Route path="/delivery-orders/:id/edit" element={<EditDeliveryOrder />} />
            <Route path="/delivery-orders/:id" element={<DeliveryOrderDetail />} />
            <Route path="/sales/returns" element={<SalesReturns />} />
            <Route path="/sales/retail" element={<RetailRevenue />} />
            <Route path="/stock-lots" element={<StockLots />} />
            <Route path="/stock-lots/:id" element={<StockLotDetail />} />
            <Route path="/stock-inventory" element={<StockInventory />} />
            <Route path="/production/lots" element={<ProductionLots />} />
            <Route path="/production/lots/:id" element={<ProductionLotDetail />} />
            <Route path="/production/inventory" element={<ProductionInventory />} />
            <Route path="/products" element={<Inventory />} />
            <Route path="/documents" element={<DocumentManager />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/ledgers" element={<Ledgers />} />
            <Route path="/expenses" element={<ExpenseList />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-bills" element={<PurchaseBills />} />
            <Route path="/purchase-bills/new" element={<SimplifiedPurchaseBill />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/daybook" element={<DayBook />} />
            <Route path="/inventory/consolidated" element={<GlobalInventory />} />
            <Route path="/inventory/transfer" element={<StockTransfer />} />
            <Route path="/inventory/requests" element={<StockRequestsInbox />} />
            <Route path="/branch/billing" element={<BranchBilling />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/hr/weekly-salary" element={<WeeklySalary />} />
            <Route path="/hr/daily-salary" element={<DailySalary />} />
            
            <Route path="/suppliers/:id/ledger" element={<LedgerViewer type="supplier" />} />
            <Route path="/customers/:id/ledger" element={<LedgerViewer type="customer" />} />
            <Route path="/lenders/:id/ledger" element={<LedgerViewer type="lender" />} />
            <Route path="/employees/:id/ledger" element={<LedgerViewer type="employee" />} />

            <Route path="/finance/dashboard" element={<FinanceDashboard />} />
            <Route path="/finance/loans" element={<LoanManagement />} />
            <Route path="/finance/lenders" element={<LenderManagement />} />
            <Route path="/finance/receipts" element={<CashReceipts />} />
            <Route path="/finance/reports" element={<FinancialReports />} />
            <Route
              path="/finance/reconciliation"
              element={<BankReconciliation />}
            />
            <Route path="/finance/chits" element={<ChitManagement />} />
            <Route path="/finance/brokers" element={<BrokerManagement />} />
            <Route path="/finance/brokers/ledger/:id" element={<BrokerLedger />} />
            <Route path="/finance/proprietor" element={<ProprietorAccount />} />
            <Route path="/finance/cash-transfers" element={<CashTransfers />} />
            <Route path="/settings/personal-accounts" element={<PersonalAccountsAdmin />} />
            <Route path="/reports/world-class" element={<AdvancedReports />} />
            
            {/* New Comprehensive Reports Module */}
            <Route path="/reports" element={<ReportsHome />} />
            <Route path="/reports/sales" element={<SalesReports />} />
            <Route path="/reports/purchase" element={<PurchaseReports />} />
            <Route path="/reports/inventory" element={<InventoryReports />} />
            <Route path="/reports/finance" element={<FinanceReports />} />
            <Route path="/reports/expense" element={<ExpenseReports />} />
            <Route path="/reports/gst" element={<GSTReports />} />
            <Route path="/reports/hr" element={<HRReports />} />
            <Route path="/reports/executive" element={<ExecutiveDashboard />} />
            <Route path="/reports/product-movement" element={<ProductMovement />} />
            <Route path="/reports/discounts" element={<DiscountReport />} />
            <Route path="/reports/classic" element={<ReportsDashboard />} />
            <Route path="/reports/:reportId" element={<ReportViewer />} />

            {/* Work Accountability & Strict Audit — accessible to any logged-in
                staff member; verify/approve actions are permission-gated
                server-side, not by this route guard. */}
            <Route path="/work" element={<WorkDashboard />} />
            <Route path="/work/jobs" element={<WorkJobs />} />
            <Route path="/work/jobs/:id" element={<WorkJobDetail />} />
            <Route path="/work/audit" element={<WorkAuditTimeline />} />
          </Route>

          {/* Legacy Customer Portal */}
          <Route element={<CustomerRoute />}>
            <Route path="/shop" element={<CustomerShop />} />
            <Route path="/my-ledger" element={<CustomerLedger />} />
          </Route>

          {/* New Customer Portal */}
          <Route path="/portal" element={<CustomerPortalLayout />}>
            <Route path="home" element={<CustomerHome />} />
            <Route path="products" element={<CustomerProducts />} />
            <Route path="orders" element={<CustomerOrders />} />
            <Route path="ledger" element={<CustomerLedgerPage />} />
            <Route path="contact" element={<CustomerContact />} />
          </Route>


          {/* Dedicated V2 Synthesis Path - Standalone Layout */}
          <Route path="/synthesis" element={<SynthesisDashboard />} />
          {/* Clean Simple Dashboard */}
          <Route path="/simple" element={<SimpleDashboard />} />

          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/company-login" replace />} />
        </Routes>
      </Router>
    </TenantProvider>
  );
};

export default App;
