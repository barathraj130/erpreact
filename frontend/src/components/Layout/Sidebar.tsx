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
import { apiFetch } from "../../utils/api";
import { closeDayLedger } from "../../api/ledgerApi";
import { FaBell } from "react-icons/fa";
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

const getMenuItems = (mode: string, user: any, roundoffPendingCount: number = 0): MenuItem[] => {
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
    {
      name: "Reports",
      icon: <FaBrain />,
      section: "Analytics",
      subItems: [
        { name: "All Reports", path: "/reports" },
        { name: "Executive Dashboard", path: "/reports/executive" },
        { name: "Sales Reports", path: "/reports/sales" },
        { name: "Purchase Reports", path: "/reports/purchase" },
        { name: "Inventory Reports", path: "/reports/inventory" },
        { name: "Finance Reports", path: "/reports/finance" },
        { name: "Expense Reports", path: "/reports/expense" },
        { name: "GST Reports", path: "/reports/gst" },
        { name: "HR Reports", path: "/reports/hr" },
        { name: "Discounts & Waivers", path: "/reports/discounts" },
        { name: "Intelligence", path: "/reports/world-class" },
      ]
    },
  ];

  if (hasModule("sales")) {
      baseItems.push({
          name: "Sales",
          icon: <FaShoppingCart />,
          section: "Operations",
          subItems: [
              { name: "Orders", path: "/invoices" },
              { name: "Delivery Orders", path: "/delivery-orders" },
              { name: "Sales Returns", path: "/sales/returns" },
              { name: "🛍️ Retail Revenue", path: "/sales/retail" },
              { name: "Customers", path: "/customers" },
              { name: "Portal Alerts", path: "/sales/customer-notifications" }
          ]
      });
  }

  if (hasModule("inventory")) {
      baseItems.push({ 
          name: "Inventory", 
          icon: <FaBox />, 
          section: "Operations",
          subItems: [
              { name: "Global Stock", path: "/inventory/consolidated" },
              { name: "Stock Transfer", path: "/inventory/transfer" },
              { name: "Stock Requests", path: "/inventory/requests" },
              { name: "Product List", path: "/products" }
          ]
      });
      baseItems.push({ 
          name: "Documents", 
          path: "/documents", 
          icon: <FaFolder />, 
          section: "Operations" 
      });
  }

  if (hasModule("procurement") || hasModule("purchases")) {
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

  // Stock Management (always visible — JBS Knit Wear surplus module)
  baseItems.push({
      name: "Stock Mgmt",
      icon: <FaBox />,
      section: "Stock Management",
      subItems: [
          { name: "Stock Lots", path: "/stock-lots" },
          { name: "Stock Inventory", path: "/stock-inventory" },
      ]
  });

  // Production Inventory — JBS Knit Wear production house flow
  baseItems.push({
      name: "Production",
      icon: <FaBox />,
      section: "Stock Management",
      subItems: [
          { name: "Production Lots", path: "/production/lots" },
          { name: "Production Inventory", path: "/production/inventory" },
      ]
  });

  if (hasModule("finance")) {
      baseItems.push({ 
          name: "Finance", 
          icon: <FaLandmark />, 
          section: "Accounting",
          subItems: [
              { name: "Finance Health", path: "/finance/dashboard" },
              { name: 'Loans', path: '/finance/loans' },
              { name: 'Lenders', path: '/finance/lenders' },
              { name: 'Chits', path: '/finance/chits' },
              { name: "Brokers", path: "/finance/brokers" },
              { name: "Receipts", path: "/finance/receipts" },
              { name: "Reconciliation", path: "/finance/reconciliation" },
              { name: "Proprietor Account", path: "/finance/proprietor" },
              { name: "Personal Accounts", path: "/settings/personal-accounts" },
              { name: "Cash Transfers", path: "/finance/cash-transfers" },
              { name: "Ledgers", path: "/ledgers" },
              { name: "Expense List", path: "/expenses" },
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
              { name: "Attendance", path: "/attendance" },
              { name: "Daily Wage", path: "/hr/daily-salary" },
              { name: "Weekly Salary", path: "/hr/weekly-salary" }
          ] 
      });
  }

  if (hasModule("ai")) {
      baseItems.push({ name: "AI Insights", path: "/ai-insights", icon: <FaBrain />, section: "Intelligence" });
  }

  if (mode === "ADMIN" || user?.role === "admin") {
      baseItems.push({ 
        name: "Admin Setup", 
        icon: <FaCog />, 
        section: "System",
        subItems: [
            { name: "Global Settings", path: "/admin/setup" },
            { name: "Bill Format", path: "/admin/bill-format" },
            { name: "Payment Methods", path: "/admin/payment-methods" },
            { name: "Branches", path: "/admin/branches" },
            { name: "User Management", path: "/admin/users" },
            { name: roundoffPendingCount > 0 ? `Round Off Requests (${roundoffPendingCount})` : "Round Off Requests", path: "/admin/roundoff-requests" },
            { name: "Subscriptions", path: "/admin/subscriptions" },
            { name: "🧪 System Test", path: "/admin/system-test" },
        ]
      });
  }

  return baseItems;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isMobile, mode, isCollapsed, setIsCollapsed }) => {
  const { user } = useAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [roundoffPendingCount, setRoundoffPendingCount] = useState(0);
  const MENU_ITEMS = useMemo(() => getMenuItems(mode, user, roundoffPendingCount), [mode, user, roundoffPendingCount]);

  // Close sidebar on route change in mobile
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [location.pathname, isMobile, setIsOpen]);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    // Load company name from billing config (reflects Bill Format Settings)
    apiFetch("/billing-config/format")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.business_name) setCompanyName(d.business_name); })
      .catch(() => {});
  }, []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (mode === "USER" || mode === "ADMIN") {
      const fetchCount = async () => {
        try {
          const res = await apiFetch("/customer-notifications");
          if (res.ok) {
            const data = await res.json();
            setUnreadCount(data.filter((n: any) => !n.is_read).length);
          }
        } catch (e) {}
      };
      fetchCount();
      // Poll every 30s
      const interval = setInterval(fetchCount, 30000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  useEffect(() => {
    if (user?.role === 'admin' || mode === 'ADMIN') {
        const fetchRequests = async () => {
            try {
                const res = await apiFetch("/dashboard/branch-overview");
                if (res.ok) {
                    const { data } = await res.json();
                    setPendingRequestsCount(data.pending_requests_count || 0);
                }
            } catch (e) {}
        };
        fetchRequests();
        const interval = setInterval(fetchRequests, 30000);
        return () => clearInterval(interval);
    }
  }, [user, mode]);

  useEffect(() => {
    if (user?.role === 'admin' || mode === 'ADMIN') {
        const fetchRoundoffCount = async () => {
            try {
                const res = await apiFetch("/roundoff/pending");
                if (res.ok) {
                    const data = await res.json();
                    setRoundoffPendingCount(Array.isArray(data) ? data.length : 0);
                }
            } catch (e) {}
        };
        fetchRoundoffCount();
        const interval = setInterval(fetchRoundoffCount, 30000);
        return () => clearInterval(interval);
    }
  }, [user, mode]);

  useEffect(() => {
    for (const item of MENU_ITEMS) {
      if (item.subItems?.some(sub => location.pathname.startsWith(sub.path))) {
        setOpenMenu(item.name);
        break;
      }
    }
  }, [location.pathname, MENU_ITEMS]);

  const handleLogout = async (force = false) => {
    if (!window.confirm(force ? "Force log out without closing ledger?" : "Sign out from the platform?")) return;

    try {
      const res = await apiFetch("/auth/logout", {
        method: "POST",
        body: { force, refreshToken: localStorage.getItem("erp-refresh-token") }
      });
      const data = await res.json();

      if (data.needs_closure) {
        if (window.confirm(data.message)) {
          // Attempt to close ledger
          try {
            const today = new Date().toISOString().split('T')[0];
            const closeRes = await closeDayLedger(today, "Auto-closed during logout");
            
            if (closeRes.success) {
              alert("Daily ledger closed successfully. Logging out...");
              localStorage.removeItem("erp-token");
              localStorage.removeItem("erp-refresh-token");
              navigate(mode === "HOST" ? "/host-login" : "/company-login");
            } else {
              if (window.confirm("Failed to close ledger: " + (closeRes.error || "Internal error") + ". Force logout anyway?")) {
                handleLogout(true);
              }
            }
          } catch (closeErr) {
            if (window.confirm("Network error while closing ledger. Force logout anyway?")) {
              handleLogout(true);
            }
          }
        } else {
          // User declined to close. Since it's after 6pm, we ask if they want to force leave.
          if (window.confirm("You haven't closed the ledger for today. Force logout without closing? (Not recommended)")) {
             handleLogout(true);
          }
        }
        return;
      }

      // Successful logout
      localStorage.removeItem("erp-token");
      localStorage.removeItem("erp-refresh-token");
      navigate(mode === "HOST" ? "/host-login" : "/company-login");
    } catch (err) {
      console.error("Logout error", err);
      // Even on network error, clear local tokens to allow user to try logging in again
      localStorage.removeItem("erp-token");
      localStorage.removeItem("erp-refresh-token");
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
        {!isCollapsed && (
          <span className="logo-name-v2">
            {mode === "HOST" ? "Platform Admin" : (companyName || "Enterprise ERP")}
          </span>
        )}
      </div>


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
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
                       {item.icon}
                       {!isCollapsed && <span className="nav-item-text">{item.name}</span>}
                       {!isCollapsed && item.name === "Inventory" && pendingRequestsCount > 0 && (
                         <span style={{ 
                            background: "#ef4444", 
                            color: "white", 
                            fontSize: "0.65rem", 
                            padding: "2px 6px", 
                            borderRadius: "10px",
                            fontWeight: 900,
                            marginLeft: "4px"
                         }}>
                            {pendingRequestsCount}
                         </span>
                       )}
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

      {/* ── User Chip & Notifications ── */}
      <div className="sidebar-footer-v2">
        {(mode === "USER" || mode === "ADMIN") && !isCollapsed && (
          <div 
            onClick={() => navigate("/sales/customer-notifications")}
            style={{ 
              display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", 
              cursor: "pointer", color: "#64748b", fontWeight: 700, fontSize: "0.85rem",
              borderBottom: "1px solid #f1f5f9"
            }}
          >
            <div style={{ position: "relative" }}>
              <FaBell size={16} />
              {unreadCount > 0 && (
                <div style={{ 
                  position: "absolute", top: "-5px", right: "-5px", background: "#ef4444", 
                  color: "white", fontSize: "0.6rem", width: "16px", height: "16px", 
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" 
                }}>
                  {unreadCount}
                </div>
              )}
            </div>
            <span>Notifications</span>
          </div>
        )}

        <div className="user-chip-v2" onClick={() => handleLogout()} title="Sign Out">
          <div className="admin-avatar-v2">
            {user?.name?.charAt(0).toUpperCase() || "S"}
          </div>
          {!isCollapsed && (
            <div className="admin-info-v2" style={{ flex: 1, minWidth: 0 }}>
              <div className="admin-name-v2">{user?.name || "demo_user"}</div>
              <div className="admin-role-v2">{user?.role || "Admin"}</div>
              <div style={{ fontSize: "9px", opacity: 0.5, marginTop: "2px" }}>v2.4.1-PROD-STABLE</div>
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
