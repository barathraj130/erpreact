// frontend/src/App.tsx
import React, { useState } from 'react';
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import { TenantProvider, useTenant } from './context/TenantContext';
import { useAuthUser } from './hooks/useAuthUser';

// Pages
import AIInsights from './pages/AIInsights';
import Branches from './pages/Branches';
import CreateInvoice from './pages/CreateInvoice';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import DayBook from './pages/DayBook';
import Employees from './pages/Employees';
import FileManager from './pages/FileManager';
import HostLogin from './pages/HostLogin';
import Attendance from './pages/hr/Attendance';
import MobileAttendance from './pages/hr/MobileAttendance';
import Inventory from './pages/Inventory';
import Invoices from './pages/Invoices';
import Ledgers from './pages/Ledgers';
import Login from './pages/Login';
import PlatformAdmin from './pages/PlatformAdmin';
import PurchaseBills from './pages/PurchaseBills';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Subscriptions from './pages/Subscriptions';
import Suppliers from './pages/Suppliers';
import Transactions from './pages/Transactions';
import SimpleDashboard from './SimpleDashboard';
import SynthesisDashboard from './SynthesisDashboard';

// Finance Module
import BankReconciliation from './pages/finance/BankReconciliation';
import CashReceipts from './pages/finance/CashReceipts';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import FinancialReports from './pages/finance/FinancialReports';
import LoanManagement from './pages/finance/LoanManagement';

import './components/Layout/Layout.css';

// --- 🌐 GLOBAL PAGE TRANSITION ---
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="canvas-area">
        {children}
    </div>
);

// --- 🏗️ ENTERPRISE LAYOUT WRAPPER ---
const EnterpriseLayout: React.FC<{ user: any; mode: 'HOST' | 'ADMIN' | 'USER' }> = ({ user, mode }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { activeBranch, branches, setActiveBranch } = useTenant();

    return (
        <div className="enterprise-shell">
            <Sidebar 
                isOpen={true} 
                setIsOpen={() => {}} 
                isMobile={false} 
                mode={mode} 
            />
            
            <div className="shell-main" style={{ paddingLeft: sidebarCollapsed ? '80px' : '280px' }}>
                <header className="shell-header">
                    <div className="header-context">
                        {mode === 'USER' && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Branch Context</span>
                                <select 
                                    className="branch-select-modern"
                                    value={activeBranch?.id || ''}
                                    onChange={(e) => {
                                        const found = branches.find(b => b.id.toString() === e.target.value);
                                        if (found) setActiveBranch(found);
                                    }}
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                                </select>
                            </div>
                        )}
                        {mode === 'HOST' && <span className="badge badge-host">Platform Governance v4.0</span>}
                        {mode === 'ADMIN' && <span className="badge badge-admin">Tenant Administration | {user?.company_name}</span>}
                    </div>

                    <div className="user-profile-block">
                        <span className="user-label-text">{user?.username}</span>
                        <div className="user-avatar-circle">{user?.username?.charAt(0)}</div>
                    </div>
                </header>

                <main style={{ flex: 1 }}>
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </main>
            </div>
        </div>
    );
};

// --- 🛡️ GUARDS ---
const HostRoute = () => {
    const { user, loading } = useAuthUser();
    if (loading) return <div className="full-screen-loader">Syncing Nexus...</div>;
    return user?.role?.toLowerCase() === 'superadmin' ? <EnterpriseLayout user={user} mode="HOST" /> : <Navigate to="/company-login" />;
};

const AdminRoute = () => {
    const { user, loading } = useAuthUser();
    if (loading) return <div className="full-screen-loader">Loading Registry...</div>;
    return user?.role?.toLowerCase() === 'admin' ? <EnterpriseLayout user={user} mode="ADMIN" /> : <Navigate to="/dashboard" />;
};

const WorkspaceRoute = () => {
    const { user, loading } = useAuthUser();
    if (loading) return <div className="full-screen-loader">Connecting Workspace...</div>;
    return user ? <EnterpriseLayout user={user} mode="USER" /> : <Navigate to="/company-login" />;
};

const App: React.FC = () => {
    console.log("🚀 Quantum Nexus App initializing...");
    return (
        <TenantProvider>
            <Router>
                <Routes>
                    <Route path="/company-login" element={<Login />} />
                    <Route path="/host-login" element={<HostLogin />} />
                    <Route path="/mark-attendance" element={<MobileAttendance />} />

                    <Route element={<HostRoute />}>
                        <Route path="/platform-admin" element={<PlatformAdmin tab="hub" />} />
                        <Route path="/platform-admin/tenants" element={<PlatformAdmin tab="tenants" />} />
                        <Route path="/platform-admin/config" element={<PlatformAdmin tab="config" />} />
                    </Route>

                    <Route element={<AdminRoute />}>
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
                        <Route path="/products" element={<Inventory />} />
                        <Route path="/documents" element={<FileManager />} />
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
                        <Route path="/finance/reconciliation" element={<BankReconciliation />} />
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