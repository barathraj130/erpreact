import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FaBoxOpen } from "react-icons/fa";

const CustomerHome: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [ledger, setLedger] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        const u = localStorage.getItem("user");
        if (u) setUser(JSON.parse(u));

        const fetchData = async () => {
            try {
                const [ledgerRes, prodRes] = await Promise.all([
                    apiFetch("/portal/my-ledger"),
                    apiFetch("/portal/catalog")
                ]);
                if (ledgerRes.ok) {
                    const data = await ledgerRes.json();
                    setLedger(data);
                }
                if (prodRes.ok) {
                    const data = await prodRes.json();
                    setProducts(data.slice(0, 4)); // Show top 4
                }
            } catch (err) {
                console.error("Failed to load home data", err);
            }
        };
        fetchData();
    }, []);

    if (!user) return null;

    return (
        <div>
            {/* Welcome Banner */}
            <div style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", padding: "40px", borderRadius: "20px", color: "white", marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800 }}>Welcome back, {user.name}! 👋</h1>
                    <p style={{ opacity: 0.8, fontSize: "1.1rem", marginTop: "10px" }}>Here's an overview of your account.</p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", padding: "20px", borderRadius: "16px", backdropFilter: "blur(10px)", textAlign: "right" }}>
                    <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.8 }}>Outstanding Balance</div>
                    <div style={{ fontSize: "2.5rem", fontWeight: 900, color: ledger?.summary?.balance_pending > 0 ? "#fca5a5" : "#86efac" }}>
                        ₹{ledger?.summary?.balance_pending ? ledger.summary.balance_pending.toLocaleString() : "0"}
                    </div>
                </div>
            </div>

            {/* Products Preview */}
            <div style={{ marginBottom: "40px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>Our Products</h2>
                    <button onClick={() => navigate("/portal/products")} style={{ background: "none", border: "none", color: "#4f46e5", fontWeight: 700, cursor: "pointer" }}>View All Products →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
                    {products.map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} style={{ background: "white", borderRadius: "16px", overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                            <div style={{ height: "180px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {p.image_url ? <img src={p.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaBoxOpen size={48} color="#cbd5e1" />}
                            </div>
                            <div style={{ padding: "20px" }}>
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>{p.name}</h3>
                                <button onClick={() => navigate("/portal/products")} style={{ width: "100%", marginTop: "15px", padding: "10px", background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>Enquire</button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Recent Bills */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>Recent Bills</h2>
                    <button onClick={() => navigate("/portal/orders")} style={{ background: "none", border: "none", color: "#4f46e5", fontWeight: 700, cursor: "pointer" }}>View All Orders →</button>
                </div>
                <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    {ledger?.transactions?.slice(0, 5).map((t: any, i: number) => {
                        const isPaid = Number(t.paid_amount) >= Number(t.total_amount);
                        return (
                            <div key={t.id} style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < 4 ? "1px solid #f1f5f9" : "none" }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: "#1e293b" }}>{t.invoice_number}</div>
                                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>{new Date(t.invoice_date).toLocaleDateString()}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontWeight: 800, color: "#0f172a" }}>₹{Number(t.total_amount).toLocaleString()}</div>
                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: isPaid ? "#16a34a" : "#ef4444", marginTop: "4px" }}>
                                        {isPaid ? "✅ Paid" : "🔴 Balance Pending"}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {!ledger?.transactions?.length && <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>No recent bills found.</div>}
                </div>
            </div>
        </div>
    );
};

export default CustomerHome;
