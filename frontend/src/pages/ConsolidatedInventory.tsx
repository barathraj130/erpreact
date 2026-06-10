
import React, { useEffect, useState } from "react";
import { FaBox, FaBuilding, FaExchangeAlt, FaHistory, FaSearch, FaSync, FaExclamationTriangle } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

const ConsolidatedInventory: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);

  const fetchConsolidated = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/branch-inventory/consolidated");
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

  const fetchBreakdown = async (productId: number) => {
    try {
      const res = await apiFetch(`/branch-inventory/breakdown/${productId}`);
      if (res.ok) setBreakdown(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConsolidated();
  }, []);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="db-page" style={{ padding: "30px", background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Consolidated Inventory</h1>
          <p style={{ color: "#64748b", marginTop: "5px" }}>Stock levels across Main Branch and all locations</p>
        </div>
        <button onClick={fetchConsolidated} className="page-btn-round-ghost" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaSync className={loading ? "fa-spin" : ""} /> Refresh Data
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "12px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "0.875rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
          ⚠️ {error}
          <button onClick={fetchConsolidated} style={{ marginLeft: "auto", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "6px", padding: "2px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Retry</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedProduct ? "1fr 400px" : "1fr", gap: "30px", transition: "all 0.3s ease" }}>
        {/* Main List */}
        <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div className="search-container" style={{ marginBottom: "25px", maxWidth: "400px" }}>
            <FaSearch className="search-icon" />
            <input 
              className="search-input" 
              placeholder="Search by name or SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: "20px" }}>Product</th>
                <th style={{ textAlign: "right" }}>Main Stock</th>
                <th style={{ textAlign: "right" }}>Branch Total</th>
                <th style={{ textAlign: "right" }}>Grand Total</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => { setSelectedProduct(p); fetchBreakdown(p.id); }} style={{ cursor: "pointer", background: selectedProduct?.id === p.id ? "#f0f7ff" : "transparent" }}>
                  <td style={{ paddingLeft: "20px" }}>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>{p.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>SKU: {p.sku || "N/A"}</div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{(parseFloat(p.main_stock) || 0).toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: "#3b82f6", fontWeight: 700 }}>{(parseFloat(p.total_branch_stock) || 0).toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontWeight: 900, color: "#0f172a" }}>{(parseFloat(p.total_stock) || 0).toLocaleString()} {p.unit}</td>
                  <td style={{ textAlign: "center" }}>
                    {(parseFloat(p.total_stock) || 0) <= 5 ? (
                      <span style={{ padding: "4px 10px", borderRadius: "100px", background: "#fef2f2", color: "#ef4444", fontSize: "0.75rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <FaExclamationTriangle /> LOW
                      </span>
                    ) : (
                      <span style={{ padding: "4px 10px", borderRadius: "100px", background: "#f0fdf4", color: "#16a34a", fontSize: "0.75rem", fontWeight: 800 }}>IN STOCK</span>
                    )}
                  </td>
                  <td>
                    <button className="page-btn-round-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }}>View Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Breakdown Sidebar */}
        <AnimatePresence>
          {selectedProduct && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", height: "fit-content" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>Stock Breakdown</h3>
                <button onClick={() => setSelectedProduct(null)} style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer" }}>Close</button>
              </div>
              
              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "12px", marginBottom: "20px" }}>
                <div style={{ fontWeight: 800, color: "#1e293b" }}>{selectedProduct.name}</div>
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Current Value: ₹{((parseFloat(selectedProduct.main_stock) || 0) * (parseFloat(selectedProduct.selling_price) || 0)).toLocaleString()}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#f1f5f9", borderRadius: "8px", fontWeight: 700 }}>
                  <span>Main Branch</span>
                  <span>{(parseFloat(selectedProduct.main_stock) || 0).toLocaleString()}</span>
                </div>
                {breakdown.map(b => (
                  <div key={b.branch_name} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #f1f5f9", fontSize: "0.95rem" }}>
                    <span style={{ color: "#64748b" }}>{b.branch_name}</span>
                    <span style={{ fontWeight: 700, color: b.stock > 0 ? "#1e293b" : "#94a3b8" }}>{parseFloat(b.stock).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <button className="page-btn-round" style={{ width: "100%" }}>
                  <FaExchangeAlt /> Transfer Stock
                </button>
                <button className="page-btn-round-ghost" style={{ width: "100%" }}>
                  <FaHistory /> Transfer History
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ConsolidatedInventory;
