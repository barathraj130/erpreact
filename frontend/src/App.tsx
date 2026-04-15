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
import "./components/Layout/Layout.css";
import { TenantProvider, useTenant } from "./context/TenantContext";
import { useAuthUser } from "./hooks/useAuthUser";
import AdvancedReports from "./pages/AdvancedReports"; // Added here

// Pages
import AIInsights from "./pages/AIInsights";
import AdminSetup from "./pages/AdminSetup";
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
import Inventory from "./pages/Inventory";
import Invoices from "./pages/Invoices";
import InvoiceDetails from "./pages/InvoiceDetails";
import Ledgers from "./pages/Ledgers";
import Login from "./pages/Login";
import PlatformAdmin from "./pages/PlatformAdmin";
import PurchaseBills from "./pages/PurchaseBills";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Subscriptions from "./pages/Subscriptions";
import Suppliers from "./pages/Suppliers";
import Transactions from "./pages/Transactions";
import SimpleDashboard from "./SimpleDashboard";
import SynthesisDashboard from "./SynthesisDashboard";
import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import CustomerShop from "./pages/customer/CustomerShop";
import CustomerLedger from "./pages/customer/CustomerLedger";
import CustomerLayout from "./components/Layout/CustomerLayout";

// Finance Module
import BankReconciliation from "./pages/finance/BankReconciliation";
import CashReceipts from "./pages/finance/CashReceipts";
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import FinancialReports from "./pages/finance/FinancialReports";
import LoanManagement from "./pages/finance/LoanManagement";
import ChitManagement from "./pages/finance/ChitManagement";



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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  // useTenant kept for context; branch selection handled inside Sidebar
  useTenant();

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
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isMobile={isMobile}
        mode={mode}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
      />

      <div
        className={`shell-main ${sidebarOpen ? "blur-content" : ""}`}
        style={{
          marginLeft: isMobile ? "0" : (sidebarCollapsed ? "80px" : "260px"),
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          background: "var(--erp-bg, #f8fafc)",
          padding: 0,
        }}
      >
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "fixed", top: "16px", left: "16px",
              background: "white", border: "1px solid #e8e8e5",
              width: "36px", height: "36px", borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 300,
            }}
          >
            <FaBars size={16} />
          </button>
        )}

        <main style={{ flex: 1 }}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
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

const App: React.FC = () => {
  // App initializing
  return (
    <TenantProvider>
      <Router>
        <Routes>
          <Route path="/company-login" element={<Login />} />
          <Route path="/employee-login" element={<EmployeeLogin />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/host-login" element={<HostLogin />} />
          <Route path="/mark-attendance" element={<MobileAttendance />} />

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
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin/setup" element={<AdminSetup />} />
            <Route path="/admin/branches" element={<Branches />} />
            <Route path="/admin/subscriptions" element={<Subscriptions />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/employees" element={<Employees />} />
          </Route>

          <Route element={<WorkspaceRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<CreateInvoice />} />
            <Route path="/invoices/:id" element={<InvoiceDetails />} />
            <Route path="/invoices/edit/:id" element={<EditInvoice />} />
            <Route path="/products" element={<Inventory />} />
            <Route path="/documents" element={<DocumentManager />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/ledgers" element={<Ledgers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-bills" element={<PurchaseBills />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/daybook" element={<DayBook />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/employees" element={<Employees />} />

            <Route path="/finance/dashboard" element={<FinanceDashboard />} />
            <Route path="/finance/loans" element={<LoanManagement />} />
            <Route path="/finance/receipts" element={<CashReceipts />} />
            <Route path="/finance/reports" element={<FinancialReports />} />
            <Route
              path="/finance/reconciliation"
              element={<BankReconciliation />}
            />
            <Route path="/finance/chits" element={<ChitManagement />} />
            <Route path="/reports/world-class" element={<AdvancedReports />} />
          </Route>

          {/* Customer Portal */}
          <Route element={<CustomerRoute />}>
            <Route path="/shop" element={<CustomerShop />} />
            <Route path="/my-ledger" element={<CustomerLedger />} />
          </Route>


          {/* Dedicated V2 Synthesis Path - Standalone Layout */}
          <Route path="/synthesis" element={<SynthesisDashboard />} />
          {/* Clean Simple Dashboard */}
          <Route path="/simple" element={<SimpleDashboard />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/company-login" replace />} />
        </Routes>
      </Router>
    </TenantProvider>
  );
};

export default App;
