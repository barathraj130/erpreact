import { motion } from "framer-motion";
import React, { useState } from "react";
import {
  FaBox,
  FaBoxOpen,
  FaEdit,
  FaFilter,
  FaPlus,
  FaSearch,
  FaSync,
  FaTrash,
} from "react-icons/fa";
import { deleteProduct } from "../api/productApi";
import { useProducts } from "../hooks/useProducts";
import AddProductModal from "./AddProductModal";
import "./finance/Finance.css";
import CustomSelect from "../components/CustomSelect";

const Inventory: React.FC = () => {
  const { products, loading, error, refresh } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStock = true;
    if (stockFilter === "low")
      matchesStock = p.current_stock <= (p.min_stock || 5);
    if (stockFilter === "out") matchesStock = p.current_stock === 0;

    return matchesSearch && matchesStock;
  });

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this product? This action cannot be undone.")) {
      await deleteProduct(id);
      refresh();
    }
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  return (
    <div className="finance-container">
      {isModalOpen && (
        <AddProductModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            refresh();
            setIsModalOpen(false);
          }}
          productToEdit={selectedProduct}
        />
      )}

      {/* Header */}
      <div className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Inventory Management</h1>
          <p className="text-muted">Track products, stock levels, and catalog data</p>
        </div>
        <div 
          className="finance-actions"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => refresh()}
            style={{ width: "42px", height: "42px", padding: 0 }}
          >
            <FaSync className={loading ? "fa-spin" : ""} />
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            style={{ height: "42px", padding: "0 24px" }}
          >
            <FaPlus /> Add New Product
          </button>
        </div>
      </div>

      <div 
        className="inventory-controls" 
        style={{ 
          display: "flex", 
          gap: "16px", 
          marginBottom: "24px", 
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center"
        }}
      >
        <div className="search-container" style={{ flex: 1 }}>
          <FaSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ width: isMobile ? "100%" : "220px" }}>
          <CustomSelect
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            style={{ height: "42px" }}
            disableSearch
          >
            <option value="all">View All Products</option>
            <option value="low">Low Stock Alerts</option>
            <option value="out">Out of Stock</option>
          </CustomSelect>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div className="skeleton" style={{ height: "80px", borderRadius: "16px", marginBottom: "16px" }}></div>
            <div className="skeleton" style={{ height: "80px", borderRadius: "16px", marginBottom: "16px" }}></div>
            <div className="skeleton" style={{ height: "80px", borderRadius: "16px" }}></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state" style={{ padding: "100px 20px", textAlign: "center" }}>
            <FaBoxOpen size={56} style={{ color: "#cbd5e1", marginBottom: "20px" }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: "var(--erp-text-main)", fontSize: "1.25rem" }}>No products found</h3>
            <p style={{ color: "var(--erp-text-secondary)", marginTop: "8px" }}>Try adjusting your filters or add a new product.</p>
          </div>
        ) : isMobile ? (
          <div className="inventory-cards-list" style={{ padding: "0 0 20px" }}>
            {filteredProducts.map((p, idx) => {
              const isLow = p.current_stock <= (p.min_stock || 5);
              const isOut = p.current_stock === 0;
              return (
                <motion.div
                  key={p.id}
                  className="card"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{ marginBottom: "16px" }}
                >
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "12px", overflow: "hidden", background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                      {p.image_url ? (
                        <img 
                          src={p.image_url.startsWith('http') ? p.image_url : `http://${window.location.hostname}:3000${p.image_url}`} 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                          <FaBox size={24} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{p.name}</h3>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--erp-text-muted)" }}>SKU: {p.sku || `#${p.id}`}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                    <div>
                       <span className={`status-badge ${isOut ? "status-error" : isLow ? "status-warning" : "status-success"}`}>
                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                      </span>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "4px" }}>{p.current_stock} Items</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--erp-text-muted)" }}>Selling Price</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--erp-primary)" }}>₹{p.selling_price.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                    <button className="btn btn-secondary" onClick={() => handleEdit(p)} style={{ flex: 1 }}>
                      <FaEdit /> Edit
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleDelete(p.id)} style={{ color: "var(--erp-error)", borderColor: "rgba(244,63,94,0.2)" }}>
                      <FaTrash />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: "24px" }}>Product Detail</th>
                <th>SKU Code</th>
                <th style={{ textAlign: "right" }}>Price</th>
                <th style={{ textAlign: "center" }}>Stock Level</th>
                <th style={{ textAlign: "center", paddingRight: "24px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => {
                  const isLow = p.current_stock <= (p.min_stock || 5);
                  const isOut = p.current_stock === 0;

                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td style={{ paddingLeft: "24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            {p.image_url ? (
                              <img 
                                src={p.image_url.startsWith('http') ? p.image_url : `http://${window.location.hostname}:3000${p.image_url}`} 
                                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                              />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                                <FaBox size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--erp-text-main)", fontSize: "0.95rem" }}>{p.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--erp-text-muted)" }}>{p.description || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "0.85rem", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px", fontWeight: 600 }}>
                          {p.sku || `#${p.id}`}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "var(--erp-primary)" }}>₹{p.selling_price.toLocaleString()}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--erp-text-muted)" }}>Unit Price</div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`status-badge ${isOut ? "status-error" : isLow ? "status-warning" : "status-success"}`}>
                          {isOut ? "Empty" : isLow ? "Low" : "Full"}
                        </span>
                        <div style={{ fontWeight: 700, marginTop: "4px", fontSize: "0.9rem" }}>{p.current_stock} <span style={{ fontSize: "0.7rem", color: "var(--erp-text-muted)" }}>{p.unit}</span></div>
                      </td>
                      <td style={{ textAlign: "center", paddingRight: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                          <button className="btn btn-secondary" onClick={() => handleEdit(p)} style={{ padding: "6px" }} title="Edit">
                            <FaEdit size={14} />
                          </button>
                          <button className="btn btn-secondary" onClick={() => handleDelete(p.id)} style={{ padding: "6px", color: "var(--erp-error)" }} title="Delete">
                            <FaTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Inventory;
