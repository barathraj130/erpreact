import React from 'react';
import { FaBars } from 'react-icons/fa';
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { useAuthUser } from './hooks/useAuthUser';

// Layouts
import CustomerLayout from './components/Layout/CustomerLayout';
import Sidebar from './components/Layout/Sidebar';

// Admin Pages
import CreateInvoice from './pages/CreateInvoice';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import EditInvoice from './pages/EditInvoice';
import Employees from './pages/Employees';
import FileManager from './pages/FileManager';
import Inventory from './pages/Inventory';
import InvoiceDetails from './pages/InvoiceDetails';
import Invoices from './pages/Invoices';
import Login from './pages/Login';
import PurchaseBills from './pages/PurchaseBills';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Suppliers from './pages/Suppliers';

// HR Pages
import Attendance from './pages/hr/Attendance';
import MobileAttendance from './pages/hr/MobileAttendance';
import PayrollRun from './pages/hr/PayrollRun';

// Customer Pages
import Marketplace from './pages/customer/Marketplace';
import MyLedger from './pages/customer/MyLedger';

// --- ERP ADMIN LAYOUT ---
const ERPLayout: React.FC<{ user: any }> = ({ user }) => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>
            <Sidebar />
            <div style={{ marginLeft: '260px', width: 'calc(100% - 260px)', display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: '64px', background: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', position: 'sticky', top: 0, zIndex: 40 }}>
                    <FaBars style={{ color: '#64748b', cursor: 'pointer' }} />
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.username}</p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{user?.role}</p>
                    </div>
                </header>
                <main style={{ padding: '30px', flexGrow: 1 }}><Outlet /></main>
            </div>
        </div>
    );
};

// --- ROUTE GUARD: ADMIN / STAFF ---
const AdminRoute: React.FC = () => {
    const { user, loading } = useAuthUser();
    const hasToken = !!localStorage.getItem('erp-token');

    if (!hasToken) return <Navigate to="/login" replace />;
    if (loading) return <div style={{padding: 50, textAlign: 'center'}}>Loading ERP...</div>;
    
    // ⛔ REJECT Customers - send them to shop
    if (user?.role === 'user' || user?.role === 'customer') {
        return <Navigate to="/shop" replace />;
    }

    return <ERPLayout user={user} />;
};

// --- ROUTE GUARD: CUSTOMER ---
const CustomerRoute: React.FC = () => {
    const { user, loading } = useAuthUser();
    const hasToken = !!localStorage.getItem('erp-token');

    if (!hasToken) return <Navigate to="/login" replace />;
    if (loading) return <div style={{padding: 50, textAlign: 'center'}}>Loading Portal...</div>;

    // ⛔ REJECT Admin/Staff - send them to dashboard
    if (user?.role !== 'user' && user?.role !== 'customer') {
        return <Navigate to="/dashboard" replace />;
    }

    return <CustomerLayout />;
};

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                {/* ========================================== */}
                {/* PUBLIC ROUTES - No login required */}
                {/* ========================================== */}
                <Route path="/login" element={<Login />} />
                <Route path="/mark-attendance" element={<MobileAttendance />} />

                {/* ========================================== */}
                {/* CUSTOMER PORTAL - /shop, /my-ledger */}
                {/* ========================================== */}
                <Route path="/shop" element={<CustomerRoute />}>
                    <Route index element={<Marketplace />} />
                </Route>
                <Route path="/my-ledger" element={<CustomerRoute />}>
                    <Route index element={<MyLedger />} />
                </Route>

                {/* ========================================== */}
                {/* ERP ADMIN SECTION */}
                {/* ========================================== */}
                <Route element={<AdminRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    
                    {/* Sales */}
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/invoices/new" element={<CreateInvoice />} />
                    <Route path="/invoices/:id" element={<InvoiceDetails />} />
                    <Route path="/invoices/edit/:id" element={<EditInvoice />} />
                    
                    {/* Purchases */}
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/bills" element={<PurchaseBills />} />
                    
                    {/* Inventory */}
                    <Route path="/products" element={<Inventory />} />
                    
                    {/* File Manager */}
                    <Route path="/documents" element={<FileManager />} />
                    
                    {/* HR & Payroll */}
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/payroll" element={<PayrollRun />} />

                    {/* Reports & Settings */}
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>

                {/* ========================================== */}
                {/* FALLBACK / DEFAULT ROUTES */}
                {/* ========================================== */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
};

export default App;