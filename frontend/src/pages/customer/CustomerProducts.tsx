import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSearch, FaBoxOpen, FaTimes } from "react-icons/fa";
import { apiFetch } from "../../utils/api";

const CustomerProducts: React.FC = () => {
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [enquireProduct, setEnquireProduct] = useState<any>(null);
    const [enquiryForm, setEnquiryForm] = useState({ qty: "", unit: "pcs", message: "" });
    const [enquiryLoading, setEnquiryLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await apiFetch("/portal/catalog");
                if (res.ok) setProducts(await res.json());
            } catch (err) {
                console.error(err);
            }
        };
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSendEnquiry = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnquiryLoading(true);
        try {
            const res = await apiFetch("/portal/enquiry", {
                method: "POST",
                body: JSON.stringify({
                    product_id: enquireProduct.id,
                    product_name: enquireProduct.name,
                    qty: enquiryForm.qty,
                    unit: enquiryForm.unit,
                    message: enquiryForm.message
                })
            });
            if (res.ok) {
                setSuccessMsg("✅ Enquiry sent! We will contact you shortly.");
                setEnquireProduct(null);
                setEnquiryForm({ qty: "", unit: "pcs", message: "" });
                setTimeout(() => setSuccessMsg(""), 5000);
            } else {
                alert("Failed to send enquiry");
            }
        } catch (err) {
            alert("Error sending enquiry");
        } finally {
            setEnquiryLoading(false);
        }
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#1e293b" }}>Product Catalog</h1>
                    <p style={{ color: "#64748b", margin: "5px 0 0" }}>Browse our products and send enquiries directly.</p>
                </div>
                {successMsg && <div style={{ background: "#dcfce7", color: "#166534", padding: "10px 20px", borderRadius: "10px", fontWeight: 700 }}>{successMsg}</div>}
            </div>

            <div style={{ position: "relative", marginBottom: "30px", maxWidth: "400px" }}>
                <FaSearch style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input 
                    type="text" 
                    placeholder="Search products..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: "100%", padding: "14px 14px 14px 45px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "1rem" }}
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "25px" }}>
                {filteredProducts.map(p => (
                    <div key={p.id} style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <div style={{ height: "200px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {p.image_url ? <img src={p.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaBoxOpen size={48} color="#cbd5e1" />}
                        </div>
                        <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: "0.75rem", color: "#4f46e5", fontWeight: 800, marginBottom: "5px" }}>{p.sku}</div>
                            <h3 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>{p.name}</h3>
                            <p style={{ margin: "0 0 15px", color: "#64748b", fontSize: "0.9rem", flex: 1 }}>{p.description || "No description available"}</p>
                            
                            {p.current_stock > 0 ? (
                                <button onClick={() => setEnquireProduct(p)} style={{ width: "100%", padding: "12px", background: "#4f46e5", color: "white", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}>
                                    Enquire Now
                                </button>
                            ) : (
                                <div style={{ width: "100%", padding: "12px", background: "#f1f5f9", color: "#94a3b8", textAlign: "center", borderRadius: "10px", fontWeight: 700 }}>
                                    Currently Unavailable
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Enquiry Modal */}
            <AnimatePresence>
                {enquireProduct && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: "white", width: "100%", maxWidth: "500px", borderRadius: "24px", overflow: "hidden" }}>
                            <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>Enquire: {enquireProduct.name}</h3>
                                <button onClick={() => setEnquireProduct(null)} style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}><FaTimes /></button>
                            </div>
                            <form onSubmit={handleSendEnquiry} style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "0.85rem", color: "#475569" }}>Qty Needed</label>
                                        <input type="number" required min="1" value={enquiryForm.qty} onChange={e => setEnquiryForm({...enquiryForm, qty: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "0.85rem", color: "#475569" }}>Unit</label>
                                        <select value={enquiryForm.unit} onChange={e => setEnquiryForm({...enquiryForm, unit: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white" }}>
                                            <option value="pcs">pcs</option>
                                            <option value="kg">kg</option>
                                            <option value="box">box</option>
                                            <option value="meters">meters</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "0.85rem", color: "#475569" }}>Message (Optional)</label>
                                    <textarea value={enquiryForm.message} onChange={e => setEnquiryForm({...enquiryForm, message: e.target.value})} placeholder="Any specific requirements?" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", minHeight: "100px" }} />
                                </div>
                                <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                                    <button type="button" onClick={() => setEnquireProduct(null)} style={{ flex: 1, padding: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 700, color: "#64748b", cursor: "pointer" }}>Cancel</button>
                                    <button type="submit" disabled={enquiryLoading} style={{ flex: 1, padding: "14px", background: "#4f46e5", border: "none", borderRadius: "10px", fontWeight: 700, color: "white", cursor: "pointer" }}>{enquiryLoading ? "Sending..." : "Send Enquiry →"}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerProducts;
