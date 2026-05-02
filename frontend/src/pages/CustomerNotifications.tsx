import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { FaBell, FaBoxOpen, FaCommentDots, FaSignInAlt, FaWalking, FaCheck, FaPhone, FaWhatsapp, FaFileInvoiceDollar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const CustomerNotifications: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await apiFetch("/customer-notifications");
            if (res.ok) {
                setNotifications(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch notifications");
        } finally {
            setLoading(false);
        }
    };

    const markAsHandled = async (id: number) => {
        try {
            await apiFetch(`/customer-notifications/${id}/handle`, { method: "PUT" });
            fetchNotifications();
        } catch (err) {
            console.error("Failed to handle notification");
        }
    };

    const markAllRead = async () => {
        try {
            await apiFetch("/customer-notifications/read-all", { method: "PUT" });
            fetchNotifications();
        } catch (err) {
            console.error("Failed to mark read");
        }
    };

    const renderIcon = (type: string) => {
        switch (type) {
            case "ENQUIRY": return <div style={{ background: "#eff6ff", color: "#3b82f6", padding: "12px", borderRadius: "12px" }}><FaBoxOpen size={20} /></div>;
            case "MESSAGE": return <div style={{ background: "#fef2f2", color: "#ef4444", padding: "12px", borderRadius: "12px" }}><FaCommentDots size={20} /></div>;
            case "LOGIN": return <div style={{ background: "#f0fdf4", color: "#22c55e", padding: "12px", borderRadius: "12px" }}><FaSignInAlt size={20} /></div>;
            case "ACTIVITY": return <div style={{ background: "#f8fafc", color: "#64748b", padding: "12px", borderRadius: "12px" }}><FaWalking size={20} /></div>;
            default: return <FaBell />;
        }
    };

    if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading notifications...</div>;

    return (
        <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#1e293b" }}>Customer Notifications</h1>
                    <p style={{ color: "#64748b", margin: "5px 0 0" }}>Live feed of customer portal activity.</p>
                </div>
                <button onClick={markAllRead} style={{ background: "white", border: "1px solid #e2e8f0", padding: "10px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", color: "#475569" }}>
                    Mark All Read
                </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {notifications.map(n => {
                    const details = typeof n.details === "string" ? JSON.parse(n.details) : n.details;
                    
                    return (
                        <div key={n.id} style={{ background: n.is_read ? "white" : "#f0f9ff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", display: "flex", gap: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
                            <div>{renderIcon(n.type)}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                                    <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "1.1rem" }}>{n.customer_name}</div>
                                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>{new Date(n.created_at).toLocaleString()}</div>
                                </div>
                                <div style={{ color: "#475569", marginBottom: "15px", fontSize: "0.95rem" }}>{n.message}</div>
                                
                                {n.type === "ENQUIRY" && !n.is_handled && (
                                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                        <button style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#1e293b" }}>
                                            <FaPhone color="#3b82f6" /> Call Customer
                                        </button>
                                        <button onClick={() => navigate("/invoices/new")} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#1e293b" }}>
                                            <FaFileInvoiceDollar color="#8b5cf6" /> Create Invoice
                                        </button>
                                        <button onClick={() => window.open(`https://wa.me/${n.customer_phone?.replace(/\D/g,'')}`, "_blank")} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#1e293b" }}>
                                            <FaWhatsapp color="#22c55e" /> WhatsApp
                                        </button>
                                        <button onClick={() => markAsHandled(n.id)} style={{ background: "#4f46e5", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "white" }}>
                                            <FaCheck /> Mark as Handled
                                        </button>
                                    </div>
                                )}
                                {n.type === "MESSAGE" && !n.is_handled && (
                                    <button onClick={() => markAsHandled(n.id)} style={{ background: "#4f46e5", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "white", marginTop: "10px" }}>
                                        <FaCheck /> Mark as Handled
                                    </button>
                                )}
                                {n.is_handled && (
                                    <div style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <FaCheck /> Handled
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {notifications.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No notifications yet.</div>}
            </div>
        </div>
    );
};

export default CustomerNotifications;
