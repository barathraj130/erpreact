import { AnimatePresence, motion } from 'framer-motion';
import React, { JSX, useEffect, useState } from 'react';
import {
    FaBox,
    FaBrain,
    FaBuilding,
    FaChartPie,
    FaChevronRight,
    FaCog,
    FaIndent,
    FaLandmark,
    FaOutdent,
    FaShoppingCart,
    FaSignOutAlt,
    FaTachometerAlt,
    FaTruck,
    FaUsers
} from "react-icons/fa";
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthUser } from '../../hooks/useAuthUser';
import "./Sidebar.css";

// --- Types ---
interface MenuItem {
    name: string;
    path?: string;
    icon?: React.ReactNode;
    module?: string; 
    permission?: string; 
    subItems?: MenuItem[];
}

interface SidebarProps {
    isOpen: boolean; // Mobile toggle
    setIsOpen: (isOpen: boolean) => void;
    isMobile: boolean;
    mode: 'HOST' | 'ADMIN' | 'USER';
}

const getMenuItems = (mode: string, user: any): MenuItem[] => {
    if (mode === 'HOST') return [
        { name: "Platform Hub", path: "/platform-admin", icon: <FaTachometerAlt /> },
        { name: "Tenants", path: "/platform-admin", icon: <FaBuilding /> },
        { name: "Global Config", path: "/platform-admin", icon: <FaCog /> },
    ];
    if (mode === 'ADMIN') return [
        { name: "Admin Dashboard", path: "/dashboard", icon: <FaTachometerAlt /> },
        { name: "Employees", path: "/admin/employees", icon: <FaUsers /> },
        { name: "Branch Assets", path: "/admin/branches", icon: <FaBuilding /> },
        { name: "Analytics", path: "/admin/reports", icon: <FaChartPie /> },
    ];

    const enabledModules = user?.enabled_modules ? String(user.enabled_modules).toLowerCase() : "";
    // If no modules info available (e.g. token doesn't carry it yet), show everything
    const modulesKnown = enabledModules.length > 0;
    const hasModule = (modName: string) => !modulesKnown || enabledModules.includes(modName);

    const baseItems: MenuItem[] = [
        { name: "Command Center", path: "/dashboard", icon: <FaTachometerAlt /> }
    ];

    if (hasModule("sales")) {
        baseItems.push({ 
            name: "Revenue Stream", 
            icon: <FaShoppingCart />, 
            module: "sales", 
            subItems: [
                { name: "Sales Orders", path: "/invoices" }, 
                { name: "Stakeholders", path: "/customers" }
            ] 
        });
    }

    if (hasModule("procurement") || hasModule("inventory")) {
        baseItems.push({ 
            name: "Procurement", 
            icon: <FaTruck />, 
            module: "procurement", 
            subItems: [
                { name: "Suppliers", path: "/suppliers" }, 
                { name: "Purchase Bills", path: "/purchase-bills" }
            ] 
        });
    }

    if (hasModule("inventory")) {
        baseItems.push({ name: "Inventory Matrix", path: "/products", icon: <FaBox />, module: "inventory" });
    }

    if (hasModule("finance") || hasModule("accounting")) {
        baseItems.push({ 
            name: "Fiscal Logic", 
            icon: <FaLandmark />, 
            module: "finance", 
            subItems: [
                { name: "Finance Hub", path: "/finance/dashboard" },
                { name: "Loan Portfolio", path: "/finance/loans" },
                { name: "Cash Receipts", path: "/finance/receipts" },
                { name: "Auto Reconcile", path: "/finance/reconciliation" },
                { name: "Financial Intel", path: "/finance/reports" },
                { name: "Global Ledgers", path: "/ledgers" }, 
                { name: "Automated Log", path: "/transactions" },
            ] 
        });
    }

    if (hasModule("hr")) {
        baseItems.push({ 
            name: "Workforce", 
            icon: <FaUsers />, 
            module: "hr", 
            subItems: [
                { name: "Staff Registry", path: "/employees" },
                { name: "Presence Portal", path: "/attendance" }
            ] 
        });
    }

    if (hasModule("ai")) {
        baseItems.push({ name: "Cognitive AI", path: "/ai-insights", icon: <FaBrain />, module: "ai" });
    }

    if (user?.role === 'admin') {
        baseItems.push({ name: "Admin Setup", path: "/admin/branches", icon: <FaCog /> });
    }

    return baseItems;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isMobile, mode }): JSX.Element => {
    const { user } = useAuthUser();
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    const location = useLocation();
    const navigate = useNavigate();

    const MENU_ITEMS = getMenuItems(mode, user);

    const [openMenu, setOpenMenu] = useState<string | null>(null);

    // Auto-open menu on mount/location change
    useEffect(() => {
        let currentMenuName = null;
        for (const item of MENU_ITEMS) {
            if (item.subItems) {
                if (item.subItems.some(sub => location.pathname.startsWith(sub.path!))) {
                    currentMenuName = item.name;
                    break;
                }
            }
        }
        if (currentMenuName && openMenu !== currentMenuName) {
            setOpenMenu(currentMenuName);
        }
    }, [location.pathname, MENU_ITEMS]);

    const handleLogout = () => {
        if (window.confirm("Terminate secure session?")) {
            localStorage.removeItem('erp-token');
            navigate(mode === 'HOST' ? '/host-login' : '/company-login');
        }
    };

    return (
        <aside className={`sidebar-container ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} ${isOpen ? 'sidebar-open' : ''}`}>
            <div className="sidebar-header">
                <div className="logo-icon">
                    <motion.div initial={{ rotate: -10 }} animate={{ rotate: 0 }} transition={{ type: 'spring' }}>
                        {mode === 'HOST' ? 'Ω' : 'Σ'}
                    </motion.div>
                </div>
                {!isCollapsed && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="logo-content">
                        <span className="logo-text">{mode === 'HOST' ? 'QUANTUM' : 'ENTERPRISE'}</span>
                        <span className="logo-sub">{mode === 'HOST' ? 'OS CORE' : 'SYNTHESIS ERP'}</span>
                    </motion.div>
                )}
            </div>

            <div className="sidebar-nav">
                <div className="nav-scroll">
                    {MENU_ITEMS.map((item) => {
                        const hasActiveSub = item.subItems?.some(sub => location.pathname.startsWith(sub.path!));
                        const isActive = item.path === location.pathname || hasActiveSub;
                        return (
                            <div key={item.name} className="menu-group">
                                <NavLink 
                                    to={item.path || '#'} 
                                    onClick={(e) => {
                                        if (item.subItems) {
                                            e.preventDefault();
                                            setOpenMenu(openMenu === item.name ? null : item.name);
                                        }
                                    }}
                                    className={typeof isActive === 'boolean' && isActive ? 'menu-item menu-item-active' : 'menu-item'}
                                >
                                    <span className="menu-icon">{item.icon}</span>
                                    {!isCollapsed && (
                                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="menu-item-text">
                                            {item.name}
                                        </motion.span>
                                    )}
                                    {!isCollapsed && item.subItems && (
                                        <FaChevronRight size={10} style={{ marginLeft: 'auto', transform: openMenu === item.name ? 'rotate(90deg)' : 'none', transition: '0.4s cubic-bezier(0.16, 1, 0.3, 1)', opacity: 0.4 }} />
                                    )}
                                </NavLink>

                                <AnimatePresence>
                                    {!isCollapsed && item.subItems && openMenu === item.name && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }} 
                                            animate={{ height: 'auto', opacity: 1 }} 
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                            className="sub-menu"
                                            style={{ overflow: 'hidden' }}
                                        >
                                            {item.subItems.map(sub => (
                                                <NavLink key={sub.name} to={sub.path!} className={({isActive: isSubActive}) => `sub-menu-item ${isSubActive ? 'active' : ''}`}>
                                                    <div className="dot" />
                                                    {sub.name}
                                                </NavLink>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="sidebar-footer">
                <motion.button 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsCollapsed(!isCollapsed)} 
                    className="footer-btn action-toggle"
                >
                    {isCollapsed ? <FaOutdent /> : <FaIndent />}
                </motion.button>
                <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} 
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout} 
                    className="footer-btn logout-btn"
                >
                    <FaSignOutAlt />
                    {!isCollapsed && <span className="btn-text">TERMINATE</span>}
                </motion.button>
            </div>
        </aside>
    );
};

export default Sidebar;
