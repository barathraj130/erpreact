// frontend/src/components/Layout/Sidebar.tsx
import React, { JSX, useState } from 'react';
import {
    FaBox,
    FaChartPie,
    FaChevronDown,
    FaChevronRight,
    FaCog,
    FaFolder,
    FaLandmark,
    FaShoppingBag,
    FaShoppingCart,
    FaSignOutAlt,
    FaTachometerAlt,
    FaUsers
} from "react-icons/fa";
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthUser } from '../../hooks/useAuthUser';

// --- 1. Define Types ---
interface SubMenuItem {
    name: string;
    path: string;
    permission?: string; 
}

interface MenuItem {
    name: string;
    path?: string;
    icon: React.ReactNode;
    permission?: string; 
    subItems?: SubMenuItem[];
}

interface Permission {
    module?: string;
    action?: string;
}

const Sidebar: React.FC = (): JSX.Element => {
    const { user } = useAuthUser();
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Check if user has permission
    const hasAccess = (requiredAction?: string): boolean => {
        if (!requiredAction) return true; 
        if (user?.role === 'admin') return true; 
        return user?.permissions?.some((p: Permission) => p.action === requiredAction) ?? false;
    };

    // --- 2. Typed Menu Items ---
    const MENU_ITEMS: MenuItem[] = [
        { 
            name: "Dashboard", 
            path: "/dashboard", 
            icon: <FaTachometerAlt />
        },
        {
            name: "Sales",
            icon: <FaShoppingCart />,
            permission: "view_invoices",
            subItems: [
                { name: "Customers", path: "/customers", permission: "view_customers" }, 
                { name: "Invoices", path: "/invoices", permission: "view_invoices" },
            ]
        },
        {
            name: "Purchases",
            icon: <FaShoppingBag />,
            permission: "view_bills",
            subItems: [
                { name: "Suppliers", path: "/suppliers" },
                { name: "Purchase Bills", path: "/bills" },
            ]
        },
        {
            name: "Inventory",
            icon: <FaBox />,
            permission: "view_products",
            subItems: [
                { name: "Products", path: "/products" },
            ]
        },
        {
            name: "Finance",
            icon: <FaLandmark />,
            permission: "view_ledger",
            subItems: [
                { name: "Transactions", path: "/transactions" },
            ]
        },
        { 
            name: "File Manager", 
            path: "/documents", 
            icon: <FaFolder />,
            permission: "view_invoices"
        }, 
        {
            name: "HR",
            icon: <FaUsers />,
            permission: "view_employees",
            subItems: [
                { name: "Employees", path: "/employees" },
                { name: "Attendance", path: "/attendance" },
                { name: "Payroll Run", path: "/payroll" },
            ]
        },
        { 
            name: "Reports", 
            path: "/reports", 
            icon: <FaChartPie />,
            permission: "view_ledger" 
        }
    ];

    const toggleMenu = (name: string): void => {
        setOpenMenu(openMenu === name ? null : name);
    };

    const handleLogout = (): void => {
        localStorage.removeItem('erp-token');
        navigate('/login');
    };

    // --- Styles ---
    const sidebarStyle: React.CSSProperties = {
        width: '260px',
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1e293b',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 50
    };

    const headerStyle: React.CSSProperties = {
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        color: 'white'
    };

    const logoStyle: React.CSSProperties = {
        width: '28px',
        height: '28px',
        background: '#3b82f6',
        borderRadius: '6px',
        marginRight: '12px'
    };

    const navContainerStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '20px 12px'
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        marginBottom: '10px',
        paddingLeft: '12px',
        opacity: 0.5
    };

    const footerStyle: React.CSSProperties = {
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.05)'
    };

    const logoutButtonStyle: React.CSSProperties = {
        marginTop: '8px',
        width: '100%',
        padding: '10px 12px',
        background: 'transparent',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#ef4444',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const getMenuItemStyle = (isActive: boolean, isOpen?: boolean): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        color: isActive || isOpen ? '#ffffff' : '#94a3b8',
        backgroundColor: isActive ? '#3b82f6' : (isOpen ? 'rgba(255,255,255,0.05)' : 'transparent'),
        textDecoration: 'none',
        marginBottom: '4px',
        fontWeight: isActive ? 600 : 500
    });

    const getSubMenuStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '8px 12px 8px 24px',
        fontSize: '0.85rem',
        textDecoration: 'none',
        color: isActive ? '#60a5fa' : '#94a3b8',
        fontWeight: isActive ? 500 : 400,
        display: 'block'
    });

    return (
        <aside style={sidebarStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div style={logoStyle}></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>ERP System</h2>
            </div>

            {/* Navigation */}
            <div style={navContainerStyle} className="custom-scrollbar">
                <p style={sectionTitleStyle}>Main Menu</p>
                
                {MENU_ITEMS.map((item: MenuItem): JSX.Element | null => {
                    // Check Parent Permission
                    if (item.permission && !hasAccess(item.permission)) return null;

                    const isActiveParent = item.subItems?.some(
                        (sub: SubMenuItem) => location.pathname.startsWith(sub.path)
                    ) ?? false;
                    const isOpen = openMenu === item.name || isActiveParent;

                    const visibleSubItems = item.subItems?.filter(
                        (sub: SubMenuItem) => !sub.permission || hasAccess(sub.permission)
                    );

                    if (item.subItems && (!visibleSubItems || visibleSubItems.length === 0)) return null;

                    // Menu with Sub Items
                    if (item.subItems) {
                        return (
                            <div key={item.name} style={{ marginBottom: '4px' }}>
                                <div 
                                    onClick={() => toggleMenu(item.name)}
                                    style={getMenuItemStyle(false, isOpen)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {item.icon}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.name}</span>
                                    </div>
                                    {isOpen ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                                </div>
                                {isOpen && (
                                    <div style={{ marginTop: '4px', marginLeft: '14px', borderLeft: '1px solid #334155' }}>
                                        {visibleSubItems?.map((sub: SubMenuItem): JSX.Element => (
                                            <NavLink 
                                                key={sub.name} 
                                                to={sub.path} 
                                                style={({ isActive }: { isActive: boolean }) => getSubMenuStyle(isActive)}
                                            >
                                                {sub.name}
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    } else {
                        // Single Menu Item (no sub items)
                        return (
                            <NavLink 
                                key={item.name} 
                                to={item.path!} 
                                style={({ isActive }: { isActive: boolean }) => ({
                                    ...getMenuItemStyle(isActive),
                                    gap: '12px'
                                })}
                            >
                                {item.icon}
                                <span style={{ fontSize: '0.9rem', flex: 1 }}>{item.name}</span>
                            </NavLink>
                        );
                    }
                })}
            </div>

            {/* Footer */}
            <div style={footerStyle}>
                {hasAccess('access_settings') && (
                    <NavLink 
                        to="/settings" 
                        style={({ isActive }: { isActive: boolean }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            marginBottom: '4px',
                            textDecoration: 'none',
                            color: isActive ? '#ffffff' : '#94a3b8',
                            backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent'
                        })}
                    >
                        <FaCog />
                        <span style={{ fontSize: '0.9rem' }}>Settings</span>
                    </NavLink>
                )}
                <button onClick={handleLogout} style={logoutButtonStyle}>
                    <FaSignOutAlt /> Sign Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;