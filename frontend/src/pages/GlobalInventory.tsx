
import React, { useState, useEffect } from "react";
import { FaBox, FaSearch, FaArrowRight, FaExclamationTriangle, FaCheckCircle, FaMapMarkerAlt } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { motion } from "framer-motion";

const GlobalInventory: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/products/breakdown");
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `Server error ${res.status}`);
        setProducts([]);
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = products.filter(p =>
    (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="db-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Inventory Breakdown</h1>
          <p className="page-subtitle">Consolidated stock view across Main Hub and all branches</p>
        </div>
        <div className="search-container" style={{ width: "350px" }}>
          <FaSearch className="search-icon" />
          <input 
            className="search-input" 
            placeholder="Search products or SKU..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "12px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "0.875rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
          ⚠️ {error}
          <button onClick={fetchData} style={{ marginLeft: "auto", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "6px", padding: "2px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Retry</button>
        </div>
      )}

      <div className="grid-container" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "25px" }}>
        {loading ? (
          <div className="loading-state">Loading inventory data...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {products.length === 0 ? "No products yet. Save a Purchase Bill with items to populate inventory." : "No products found matching your search."}
          </div>
        ) : (
          filtered.map(p => {
            const totalStock = parseFloat(p.main_stock) + parseFloat(p.branches_total_stock);
            const isLow = totalStock < 20;

            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={p.product_id}
                className="glass-card" 
                style={{ padding: "0", overflow: "hidden", border: isLow ? "1px solid #fee2e2" : "1px solid #e2e8f0" }}
              >
                <div style={{ padding: "20px 25px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: isLow ? "#fffafb" : "#fff" }}>
                   <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <div style={{ width: "50px", height: "50px", borderRadius: "12px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}>
                         <FaBox color="#6366f1" size={24} />
                      </div>
                      <div>
                         <h3 style={{ margin: 0, fontWeight: 900, fontSize: "1.1rem" }}>{p.name}</h3>
                         <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700 }}>SKU: {p.sku} | Unit: {p.unit}</span>
                      </div>
                   </div>
                   <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: isLow ? "#ef4444" : "#0f172a" }}>
                         {totalStock} <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Total Units</span>
                      </div>
                      {isLow && <span style={{ color: "#ef4444", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase" }}><FaExclamationTriangle /> Critical Low Stock</span>}
                   </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "120px" }}>
                   {/* Main Branch Stock */}
                   <div style={{ padding: "20px 25px", borderRight: "1px solid #f1f5f9", background: "#fcfdfe" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "15px", color: "#64748b", fontWeight: 700, fontSize: "0.85rem" }}>
                         <FaMapMarkerAlt /> MAIN HUB
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                         <div>
                            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#1e293b" }}>{p.main_stock}</div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700 }}>AVAILABLE AT MAIN</div>
                         </div>
                         {p.main_stock < p.main_min_stock && <FaExclamationTriangle color="#f59e0b" />}
                      </div>
                   </div>

                   {/* Branches Stock Breakdown */}
                   <div style={{ padding: "20px 25px", display: "flex", gap: "20px", overflowX: "auto", alignItems: "center" }}>
                      {p.branch_details && p.branch_details.length > 0 ? (
                        p.branch_details.map((b: any) => (
                           <div key={b.branch_id} style={{ minWidth: "140px", padding: "12px", borderRadius: "12px", background: "#fff", border: "1px solid #f1f5f9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                              <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 800, marginBottom: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.branch_name}</div>
                              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#4f46e5" }}>{b.stock || 0}</div>
                           </div>
                        ))
                      ) : (
                        <div style={{ color: "#cbd5e1", fontSize: "0.85rem", fontStyle: "italic" }}>No satellite branch stock allocated yet.</div>
                      )}
                   </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GlobalInventory;
