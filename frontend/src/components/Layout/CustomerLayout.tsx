import React from 'react';
import { FaBox, FaFileInvoiceDollar, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthUser } from '../../hooks/useAuthUser';

const CustomerLayout: React.FC = () => {
    const { user } = useAuthUser();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('erp-token');
        window.location.href = '/login';
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            {/* Top Navigation Bar */}
            <header style={{ 
                background: 'white', 
                height: '70px', 
                borderBottom: '1px solid #e2e8f0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0 40px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#2563eb', borderRadius: '8px' }}></div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        My Portal
                    </h2>
                </div>

                {/* Navigation Links */}
                <nav style={{ display: 'flex', gap: '30px' }}>
                    <NavLink to="/shop" style={({ isActive }) => ({ 
                        textDecoration: 'none', 
                        color: isActive ? '#2563eb' : '#64748b', 
                        fontWeight: isActive ? 600 : 500,
                        display: 'flex', alignItems: 'center', gap: '8px'
                    })}>
                        <FaBox /> Products
                    </NavLink>
                    <NavLink to="/my-ledger" style={({ isActive }) => ({ 
                        textDecoration: 'none', 
                        color: isActive ? '#2563eb' : '#64748b', 
                        fontWeight: isActive ? 600 : 500,
                        display: 'flex', alignItems: 'center', gap: '8px'
                    })}>
                        <FaFileInvoiceDollar /> My Ledger & Orders
                    </NavLink>
                </nav>

                {/* User Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{user?.username}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Valued Customer</div>
                    </div>
                    <FaUserCircle size={36} color="#cbd5e1" />
                    <button 
                        onClick={handleLogout}
                        style={{ 
                            background: '#fee2e2', color: '#ef4444', border: 'none', 
                            padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem'
                        }}
                    >
                        <FaSignOutAlt /> Logout
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default CustomerLayout;