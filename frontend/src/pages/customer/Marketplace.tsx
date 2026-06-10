import React, { useEffect, useState } from "react";
import { FaBox, FaShoppingCart, FaTag } from "react-icons/fa";
import { apiFetch } from "../../utils/api";

const Marketplace: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch catalog specifically designed for customers (no cost price)
        const res = await apiFetch("/portal/catalog");
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Catalog Load Error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>
        Loading Catalog...
      </div>
    );

  return (
    <div>
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "#1e293b",
            marginBottom: "10px",
          }}
        >
          Product Catalog
        </h1>
        <p style={{ color: "#64748b" }}>
          Browse our latest inventory and place orders directly.
        </p>
      </div>

      {products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            background: "white",
            borderRadius: "12px",
            border: "1px dashed #e2e8f0",
          }}
        >
          <FaBox size={40} style={{ marginBottom: "15px", color: "#cbd5e1" }} />
          <p style={{ color: "#94a3b8" }}>
            No active products available at the moment.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "25px",
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                background: "white",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s",
                cursor: "default",
              }}
            >
              {/* Product Image */}
              <div
                style={{
                  height: "200px",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#cbd5e1",
                  position: "relative",
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    alt={product.name}
                  />
                ) : (
                  <FaBox size={48} />
                )}
                {/* Stock Tag */}
                {product.current_stock > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontWeight: 600,
                    }}
                  >
                    In Stock
                  </span>
                ) : (
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "#fee2e2",
                      color: "#991b1b",
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Out of Stock
                  </span>
                )}
              </div>

              {/* Details */}
              <div
                style={{
                  padding: "20px",
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    marginBottom: "8px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "#1e293b",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {product.name}
                  </h3>
                </div>

                {product.sku && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.8rem",
                      color: "#64748b",
                      marginBottom: "12px",
                    }}
                  >
                    <FaTag size={10} /> SKU: {product.sku}
                  </div>
                )}

                <p
                  style={{
                    color: "#64748b",
                    fontSize: "0.9rem",
                    marginBottom: "20px",
                    flexGrow: 1,
                    lineHeight: 1.5,
                  }}
                >
                  {product.description || "No detailed description available."}
                </p>

                {/* Footer: Price & Action */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "15px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                      Price
                    </div>
                    <div
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      ₹{Number(product.selling_price).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      alert(
                        "Order placement will be enabled soon. Please contact admin for manual orders.",
                      )
                    }
                    style={{
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "background 0.2s",
                      opacity: product.current_stock > 0 ? 1 : 0.5,
                    }}
                    disabled={product.current_stock <= 0}
                  >
                    <FaShoppingCart /> Order
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
