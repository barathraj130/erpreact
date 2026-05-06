import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { FaBell, FaBoxOpen, FaCommentDots, FaSignInAlt, FaWalking, FaCheck, FaPhone, FaWhatsapp, FaFileInvoiceDollar, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const CustomerNotifications: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        const sampleMsg = {
            id: 99999,
            type: 'MESSAGE',
            customer_name: 'Alex Mercer (Sample Client)',
            message: 'Hello, I just wanted to reach out regarding the recent service update. Can someone contact me back?',
            created_at: new Date().toISOString(),
            is_read: false,
            is_handled: false,
            details: "{}"
        };

        try {
            const res = await apiFetch("/customer-notifications");
            if (res.ok) {
                const data = await res.json();
                if (data.length === 0) {
                    setNotifications([sampleMsg]);
                } else {
                    setNotifications(data);
                }
            } else {
                setNotifications([sampleMsg]);
            }
        } catch (err) {
            console.error("Failed to fetch notifications");
            setNotifications([sampleMsg]);
        } finally {
            setLoading(false);
        }
    };

    const markAsHandled = async (id: number) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_handled: true } : n));
        try {
            await apiFetch(`/customer-notifications/${id}/handle`, { method: "PUT" });
        } catch (err) {
            console.error("Failed to handle notification");
        }
    };

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        try {
            await apiFetch("/customer-notifications/read-all", { method: "PUT" });
        } catch (err) {
            console.error("Failed to mark read");
        }
    };

    const dismissNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const renderIcon = (type: string) => {
        switch (type) {
            case "ENQUIRY": return <div style={{ background: "var(--accent-bg)", color: "var(--accent)", padding: "12px", borderRadius: "12px" }}><FaBoxOpen size={20} /></div>;
            case "MESSAGE": return <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "12px", borderRadius: "12px" }}><FaCommentDots size={20} /></div>;
            case "LOGIN": return <div style={{ background: "var(--green-bg)", color: "var(--green)", padding: "12px", borderRadius: "12px" }}><FaSignInAlt size={20} /></div>;
            case "ACTIVITY": return <div style={{ background: "var(--surface-2)", color: "var(--text-2)", padding: "12px", borderRadius: "12px" }}><FaWalking size={20} /></div>;
            default: return <div style={{ background: "var(--surface-2)", color: "var(--text-2)", padding: "12px", borderRadius: "12px" }}><FaBell size={20} /></div>;
        }
    };

    if (loading) return (
        <div className="full-screen-loader">
            <div className="spinner-innovative"></div>
            <div>Loading Portal Alerts...</div>
        </div>
    );

    return (
        <div className="db-page">
            <header className="db-topbar">
                <div className="db-topbar-left">
                    <span className="db-topbar-title">Sales</span>
                    <span className="db-topbar-sep">/</span>
                    <span className="db-topbar-sub">Portal Alerts</span>
                </div>
                <div className="db-topbar-right">
                    <button onClick={markAllRead} className="btn-secondary">
                        <FaCheck /> Mark All Read
                    </button>
                </div>
            </header>

            <div className="db-content" style={{ maxWidth: "1000px", margin: "0 auto", width: "100%", padding: "40px 0" }}>
                <div className="db-page-header" style={{ marginBottom: '32px' }}>
                    <h1 className="page-title" style={{ fontSize: '28px', marginBottom: '8px' }}>Customer Notifications</h1>
                    <p className="db-page-sub">Live feed of customer portal activity.</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {notifications.map(n => {
                        const details = typeof n.details === "string" ? JSON.parse(n.details) : n.details;
                        
                        return (
                            <div key={n.id} className="enterprise-card" style={{ 
                                padding: "24px", 
                                display: "flex", 
                                gap: "20px", 
                                background: n.is_read ? "var(--surface)" : "var(--accent-bg)",
                                borderColor: n.is_read ? "var(--border)" : "var(--accent)"
                            }}>
                                <div>{renderIcon(n.type)}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                        <div style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "16px" }}>{n.customer_name}</div>
                                        <div style={{ fontSize: "12px", color: "var(--text-3)", fontWeight: 600 }}>{new Date(n.created_at).toLocaleString()}</div>
                                    </div>
                                    <div style={{ color: "var(--text-2)", marginBottom: "16px", fontSize: "14px", lineHeight: 1.6 }}>{n.message}</div>
                                    
                                    {n.type === "ENQUIRY" && !n.is_handled && (
                                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
                                            <button className="btn-secondary" style={{ padding: '8px 16px' }}>
                                                <FaPhone color="var(--accent)" /> Call Customer
                                            </button>
                                            <button onClick={() => navigate("/invoices/new")} className="btn-secondary" style={{ padding: '8px 16px' }}>
                                                <FaFileInvoiceDollar color="var(--accent)" /> Create Invoice
                                            </button>
                                            <button onClick={() => window.open(`https://wa.me/${n.customer_phone?.replace(/\D/g,'')}`, "_blank")} className="btn-secondary" style={{ padding: '8px 16px' }}>
                                                <FaWhatsapp color="var(--green)" /> WhatsApp
                                            </button>
                                            <button onClick={() => markAsHandled(n.id)} className="btn-primary" style={{ padding: '8px 16px' }}>
                                                <FaCheck /> Mark as Handled
                                            </button>
                                            <button onClick={() => dismissNotification(n.id)} className="btn-secondary" style={{ padding: '8px 16px', color: 'var(--red)', borderColor: 'var(--red-bg)' }}>
                                                <FaTimes /> Dismiss
                                            </button>
                                        </div>
                                    )}
                                    {n.type === "MESSAGE" && !n.is_handled && (
                                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
                                            <button onClick={() => markAsHandled(n.id)} className="btn-primary" style={{ padding: '8px 16px' }}>
                                                <FaCheck /> Mark as Handled
                                            </button>
                                            <button onClick={() => dismissNotification(n.id)} className="btn-secondary" style={{ padding: '8px 16px', color: 'var(--red)', borderColor: 'var(--red-bg)' }}>
                                                <FaTimes /> Dismiss
                                            </button>
                                        </div>
                                    )}
                                    {n.is_handled && (
                                        <div style={{ color: "var(--green)", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", marginTop: "12px" }}>
                                            <FaCheck /> Handled
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {notifications.length === 0 && (
                        <div className="enterprise-card" style={{ padding: "48px", textAlign: "center", color: "var(--text-3)" }}>
                            <FaBell size={32} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <p>No notifications yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerNotifications;
