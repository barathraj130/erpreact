import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaBoxOpen, FaFileInvoice, FaBook, FaPhone, FaUserCircle, FaSignOutAlt } from "react-icons/fa";

const CustomerPortalLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const u = localStorage.getItem("user");
        if (!u) {
            navigate("/customer-login");
        } else {
            setUser(JSON.parse(u));
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        navigate("/customer-login");
    };

    const navItems = [
        { path: "/portal/home", label: "Home", icon: FaHome },
        { path: "/portal/products", label: "Products", icon: FaBoxOpen },
        { path: "/portal/orders", label: "My Orders", icon: FaFileInvoice },
        { path: "/portal/ledger", label: "My Ledger", icon: FaBook },
        { path: "/portal/contact", label: "Contact Us", icon: FaPhone },
    ];

    if (!user) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
            <header style={{ background: "white", padding: "15px 30px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ background: "#4f46e5", color: "white", width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.2rem" }}>
                        E
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>Business Portal</h2>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Partner Network</span>
                    </div>
                </div>
                <nav style={{ display: "flex", gap: "20px" }}>
                    {navItems.map(item => {
                        const active = location.pathname.includes(item.path);
                        return (
                            <button 
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                style={{
                                    background: "none", border: "none", display: "flex", alignItems: "center", gap: "8px",
                                    fontSize: "0.95rem", fontWeight: 700, padding: "8px 12px", borderRadius: "8px",
                                    color: active ? "#4f46e5" : "#64748b", cursor: "pointer",
                                    backgroundColor: active ? "#eff6ff" : "transparent", transition: "all 0.2s"
                                }}
                            >
                                <item.icon /> {item.label}
                            </button>
                        );
                    })}
                </nav>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e293b", fontWeight: 700 }}>
                        <FaUserCircle size={20} color="#94a3b8" />
                        {user.name}
                    </div>
                    <button onClick={handleLogout} style={{ background: "#fef2f2", color: "#ef4444", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <FaSignOutAlt /> Logout
                    </button>
                </div>
            </header>

            <main style={{ flex: 1, padding: "40px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                <Outlet />
            </main>
            
            <footer style={{ background: "white", padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", borderTop: "1px solid #e2e8f0" }}>
                &copy; {new Date().getFullYear()} ERP Customer Portal.
            </footer>
        </div>
    );
};

export default CustomerPortalLayout;
