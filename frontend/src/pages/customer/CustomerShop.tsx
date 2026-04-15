import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaShoppingCart, FaSearch, FaTag, FaBoxOpen, FaInfoCircle } from "react-icons/fa";
import { apiFetch } from "../../utils/api";

interface Product {
  id: number;
  name: string;
  description: string;
  selling_price: number;
  image_url: string;
  sku: string;
  current_stock: number;
}

const CustomerShop: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await apiFetch("/portal/catalog");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div style={{ padding: "100px", textAlign: "center" }}>
      <div className="fa-spin" style={{ fontSize: "2rem", color: "#2563eb" }}><FaShoppingCart /></div>
      <p style={{ marginTop: "20px", fontWeight: 600, color: "#64748b" }}>Opening the store...</p>
    </div>
  );

  return (
    <div>
      {/* Hero Section */}
      <div style={{ 
        background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", 
        padding: "60px 40px", 
        borderRadius: "24px", 
        color: "white",
        marginBottom: "40px",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0 }}>Product Catalog</h1>
          <p style={{ fontSize: "1.1rem", opacity: 0.9, marginTop: "10px", maxWidth: "600px" }}>
            Explore our latest inventory and stock. Seamlessly track your orders and ledger from your dashboard.
          </p>
        </div>
        <div style={{ 
          position: "absolute", right: "-50px", bottom: "-50px", 
          fontSize: "200px", opacity: 0.1, color: "white" 
        }}>
          <FaBoxOpen />
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ 
        display: "flex", 
        gap: "20px", 
        marginBottom: "40px",
        background: "white",
        padding: "10px",
        borderRadius: "16px",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        border: "1px solid #f1f5f9"
      }}>
        <div style={{ flex: 1, position: "relative" }}>
          <FaSearch style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            type="text" 
            placeholder="Search products by name or description..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: "100%", padding: "16px 16px 16px 50px", borderRadius: "12px", 
              border: "none", outline: "none", fontSize: "1rem", color: "#1e293b"
            }}
          />
        </div>
      </div>

      {/* Product Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "30px" }}>
        {filteredProducts.map(product => (
          <motion.div 
            key={product.id}
            layoutId={`product-${product.id}`}
            whileHover={{ y: -8 }}
            style={{ 
              background: "white", borderRadius: "20px", overflow: "hidden", 
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9",
              cursor: "pointer"
            }}
            onClick={() => setSelectedProduct(product)}
          >
            <div style={{ height: "200px", background: "#f8fafc", position: "relative" }}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1" }}>
                  <FaBoxOpen size={64} />
                </div>
              )}
              <div style={{ position: "absolute", top: "15px", right: "15px", background: "white", padding: "6px 12px", borderRadius: "8px", fontWeight: 700, fontSize: "0.85rem", color: "#2563eb", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
                ₹{Number(product.selling_price).toLocaleString()}
              </div>
            </div>
            <div style={{ padding: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>{product.name}</h3>
              <p style={{ margin: "8px 0", fontSize: "0.9rem", color: "#64748b", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: "40px" }}>
                {product.description || "No description available."}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>SKU: {product.sku || "N/A"}</span>
                <span style={{ 
                  fontSize: "0.75rem", fontWeight: 700, 
                  color: product.current_stock > 10 ? "#059669" : "#d97706",
                  background: product.current_stock > 10 ? "#ecfdf5" : "#fffbeb",
                  padding: "4px 8px", borderRadius: "6px"
                }}>
                  {product.current_stock > 0 ? `${product.current_stock} In Stock` : "Out of Stock"}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div style={{ 
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", 
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" 
          }} onClick={() => setSelectedProduct(null)}>
            <motion.div 
              layoutId={`product-${selectedProduct.id}`}
              style={{ background: "white", maxWidth: "800px", width: "100%", borderRadius: "24px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ background: "#f8fafc" }}>
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1" }}>
                    <FaBoxOpen size={120} />
                  </div>
                )}
              </div>
              <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                   <span style={{ background: "#eff6ff", color: "#2563eb", padding: "4px 12px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 700 }}>{selectedProduct.sku}</span>
                   <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "#1e293b", margin: "10px 0" }}>{selectedProduct.name}</h2>
                   <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>₹{Number(selectedProduct.selling_price).toLocaleString()}</div>
                </div>
                
                <p style={{ color: "#64748b", lineHeight: 1.6 }}>{selectedProduct.description}</p>
                
                <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                   <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#1e293b", fontWeight: 600 }}>
                      <FaInfoCircle color="#2563eb" /> Stock Information
                   </div>
                   <div style={{ marginTop: "10px", fontSize: "0.9rem", color: "#64748b" }}>
                      Current availability: <span style={{ fontWeight: 700, color: "#1e293b" }}>{selectedProduct.current_stock} units</span>
                   </div>
                </div>

                <div style={{ marginTop: "auto" }}>
                  <button 
                    onClick={() => setSelectedProduct(null)}
                    style={{ 
                      width: "100%", padding: "16px", background: "#1e293b", color: "white", 
                      border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer"
                    }}>
                    Close Preview
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerShop;
