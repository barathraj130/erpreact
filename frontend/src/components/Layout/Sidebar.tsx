import React, { useEffect, useMemo, useState } from "react";
import {
  FaBox,
  FaBrain,
  FaBuilding,
  FaCog,
  FaLandmark,
  FaShoppingCart,
  FaSignOutAlt,
  FaTachometerAlt,
  FaTruck,
  FaUsers,
  FaHistory,
  FaChevronDown,
  FaFolder
} from "react-icons/fa";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useTenant } from "../../context/TenantContext";
import { apiFetch } from "../../utils/api";
import { closeDayLedger } from "../../api/ledgerApi";
import "./Sidebar.css";

interface MenuItem {
  name: string;
  path?: string;
  icon?: React.ReactNode;
  module?: string;
  section?: string;
  subItems?: { name: string; path: string }[];
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isMobile: boolean;
  mode: "HOST" | "ADMIN" | "USER";
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

const getMenuItems = (mode: string, user: any): MenuItem[] => {
  if (mode === "HOST")
    return [
      { name: "Dashboard", path: "/platform-admin", icon: <FaTachometerAlt />, section: "Overview" },
      { name: "Tenants", path: "/platform-admin/tenants", icon: <FaBuilding />, section: "Management" },
      { name: "Global Config", path: "/platform-admin/config", icon: <FaCog />, section: "System" },
      { name: "Audit Logs", path: "/platform-admin/logs", icon: <FaHistory />, section: "System" },
    ];
  
  const hasModule = (modName: string) => !user?.enabled_modules || user.enabled_modules.toLowerCase().includes(modName);

  const baseItems: MenuItem[] = [
    { name: "Dashboard", path: "/dashboard", icon: <FaTachometerAlt />, section: "Overview" },
    { name: "Intelligence", path: "/reports/world-class", icon: <FaBrain />, section: "Analytics" },
  ];

  if (hasModule("sales")) {
      baseItems.push({ 
          name: "Sales", 
          icon: <FaShoppingCart />, 
          section: "Operations",
          subItems: [
              { name: "Orders", path: "/invoices" },
              { name: "Customers", path: "/customers" }
          ] 
      });
  }

  if (hasModule("inventory")) {
      baseItems.push({ 
          name: "Inventory", 
          path: "/products", 
          icon: <FaBox />, 
          section: "Operations" 
      });
      baseItems.push({ 
          name: "Documents", 
          path: "/documents", 
          icon: <FaFolder />, 
          section: "Operations" 
      });
  }

  if (hasModule("procurement")) {
    baseItems.push({ 
        name: "Purchases", 
        icon: <FaTruck />, 
        section: "Operations",
        subItems: [
            { name: "Suppliers", path: "/suppliers" },
            { name: "Purchase Bills", path: "/purchase-bills" }
        ] 
    });
  }

  if (hasModule("finance")) {
      baseItems.push({ 
          name: "Finance", 
          icon: <FaLandmark />, 
          section: "Accounting",
          subItems: [
              { name: "Finance Health", path: "/finance/dashboard" },
              { name: "Loans", path: "/finance/loans" },
              { name: "Chits", path: "/finance/chits" },
              { name: "Receipts", path: "/finance/receipts" },
              { name: "Reconciliation", path: "/finance/reconciliation" },
              { name: "Ledgers", path: "/ledgers" },
              { name: "Transactions", path: "/transactions" }
          ] 
      });
  }

  if (hasModule("hr")) {
      baseItems.push({ 
          name: "Employees", 
          icon: <FaUsers />, 
          section: "Human Resources",
          subItems: [
              { name: "Employee List", path: "/employees" },
              { name: "Attendance", path: "/attendance" }
          ] 
      });
  }

  if (hasModule("ai")) {
      baseItems.push({ name: "AI Insights", path: "/ai-insights", icon: <FaBrain />, section: "Intelligence" });
  }

  if (mode === "ADMIN" || user?.role === "admin") {
      baseItems.push({ 
        name: "Admin Setup", 
        path: "/admin/setup", 
        icon: <FaCog />, 
        section: "System" 
      });
  }

  return baseItems;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isMobile, mode, isCollapsed, setIsCollapsed }) => {
  const { user } = useAuthUser();
  const { activeBranch } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const MENU_ITEMS = useMemo(() => getMenuItems(mode, user), [mode, user]);

  // Close sidebar on route change in mobile
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [location.pathname, isMobile, setIsOpen]);

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    for (const item of MENU_ITEMS) {
      if (item.subItems?.some(sub => location.pathname.startsWith(sub.path))) {
        setOpenMenu(item.name);
        break;
      }
    }
  }, [location.pathname, MENU_ITEMS]);

  const handleLogout = async (force = false) => {
    if (!window.confirm(force ? "Force log out?" : "Sign out from the platform?")) return;

    try {
      const res = await apiFetch("/auth/logout", {
        method: "POST",
        body: { force }
      });
      const data = await res.json();

      if (data.needs_closure) {
        if (window.confirm(data.message)) {
          // Attempt to close ledger
          const today = new Date().toISOString().split('T')[0];
          const closeRes = await closeDayLedger(today, "Auto-closed during logout");
          if (closeRes.success) {
            alert("Daily ledger closed successfully. Logging out...");
            localStorage.removeItem("erp-token");
            navigate(mode === "HOST" ? "/host-login" : "/company-login");
          } else {
            alert("Failed to close ledger: " + closeRes.error);
          }
        } else {
          // User declined to close but maybe wants to logout anyway? 
          // The backend supports 'force' if they really want to leave.
          if (window.confirm("Do you want to force logout without closing the ledger? (Not recommended)")) {
             handleLogout(true);
          }
        }
        return;
      }

      localStorage.removeItem("erp-token");
      navigate(mode === "HOST" ? "/host-login" : "/company-login");
    } catch (err) {
      console.error("Logout error", err);
      localStorage.removeItem("erp-token");
      navigate(mode === "HOST" ? "/host-login" : "/company-login");
    }
  };

  const sections = Array.from(new Set(MENU_ITEMS.map(i => i.section)));

  return (
    <>
      {isMobile && isOpen && (
        <div 
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998 }} 
          onClick={() => setIsOpen(false)} 
        />
      )}
      <aside 
        className={`sidebar-container ${isCollapsed && !isMobile ? "sidebar-collapsed" : ""}`}
        style={{
          transform: isMobile ? (isOpen ? "translateX(0)" : "translateX(-100%)") : "translateX(0)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 9999
        }}
      >
      {/* ── Logo ── */}
      <div className="sidebar-logo-v2">
        <div className="logo-mark-v2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1.2" fill="currentColor"/>
            <rect x="9" y="2" width="5" height="5" rx="1.2" fill="currentColor" opacity=".55"/>
            <rect x="2" y="9" width="5" height="5" rx="1.2" fill="currentColor" opacity=".55"/>
            <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" opacity=".25"/>
          </svg>
        </div>
        {!isCollapsed && <span className="logo-name-v2">Platform Hub</span>}
      </div>

      {/* ── Branch Selector (Non-Host Mode) ── */}
      {!isCollapsed && mode !== "HOST" && (
        <div className="sb-branch-container">
          <div className="branch-label-v2">Active Branch</div>
          <button className="branch-btn-v2" onClick={() => navigate('/admin/branches')}>
            <span>
              <FaBuilding style={{ opacity: 0.6 }} />
              {activeBranch?.branch_name || "Select branch…"}
            </span>
            <FaChevronDown style={{ fontSize: "10px", opacity: 0.5 }} />
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="sidebar-nav-v2">
        {sections.map(sectionName => (
          <React.Fragment key={sectionName}>
            {!isCollapsed && <span className="nav-label-v2">{sectionName}</span>}
            {MENU_ITEMS.filter(i => i.section === sectionName).map(item => {
              const hasActiveSub = item.subItems?.some(s => location.pathname === s.path || location.pathname.startsWith(s.path + '/'));
              const isPathMatch = item.path && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
              const isActive = isPathMatch || hasActiveSub;
              const isOpen = openMenu === item.name;

              return (
                <div key={item.name} className="nav-group-v2">
                  <NavLink 
                    to={item.path || "#"} 
                    className={`nav-item-v2 ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                        if (item.subItems) {
                            e.preventDefault();
                            setOpenMenu(isOpen ? null : item.name);
                        }
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                       {item.icon}
                       {!isCollapsed && <span className="nav-item-text">{item.name}</span>}
                    </span>
                    {!isCollapsed && item.subItems && (
                      <FaChevronDown 
                        style={{ 
                          marginLeft: "auto", 
                          fontSize: "10px", 
                          transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                          transition: "0.2s",
                          opacity: 0.5
                        }} 
                      />
                    )}
                  </NavLink>
                  
                  {!isCollapsed && item.subItems && isOpen && (
                    <div className="pa-sub-menu">
                        {item.subItems.map(sub => (
                          <NavLink 
                            key={sub.name} 
                            to={sub.path} 
                            className={({ isActive: subActive }) => `pa-sub-item ${subActive ? 'active' : ''}`}
                          >
                            {sub.name}
                          </NavLink>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* ── User Chip ── */}
      <div className="sidebar-footer-v2">
        <div className="user-chip-v2" onClick={() => handleLogout()} title="Sign Out">
          <div className="admin-avatar-v2">
            {user?.username?.charAt(0).toUpperCase() || "S"}
          </div>
          {!isCollapsed && (
            <div className="admin-info-v2" style={{ flex: 1, minWidth: 0 }}>
              <div className="admin-name-v2">{user?.username || "demo_user"}</div>
              <div className="admin-role-v2">{user?.role || "Admin"}</div>
            </div>
          )}
          {!isCollapsed && (
            <div className="logout-icon-v2">
              <FaSignOutAlt style={{ fontSize: "14px", opacity: 0.6 }} />
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
