
import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  FaSearch, FaShoppingCart, FaTrash, FaPlus, FaCheck, FaTimes, 
  FaBox, FaRegClock, FaUserAlt, FaFileUpload, FaPrint, FaWhatsapp,
  FaInbox, FaExclamationTriangle, FaBolt, FaUserEdit
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { useTenant } from "../context/TenantContext";
import CustomSelect from "../components/CustomSelect";
import { useNavigate } from "react-router-dom";

const BranchBilling: React.FC = () => {
  const navigate = useNavigate();
  const { activeBranch } = useTenant();
  
  // Data State
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bill State
  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [discount, setDiscount] = useState<number>(0);

  // UI State
  const [showRequestModal, setShowRequestModal] = useState<any>(null);
  const [requestQty, setRequestQty] = useState("50");
  const [requestUrgency, setRequestUrgency] = useState("Normal");
  const [requestNote, setRequestNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch Data
  const fetchData = async () => {
    try {
      const [pRes, cRes, rRes] = await Promise.all([
        apiFetch("/branch-inventory/inventory"),
        apiFetch("/customers"),
        apiFetch("/branch-inventory/my-requests")
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (rRes.ok) setRequests(await rRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for requests status updates every 30s
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === "F8") { e.preventDefault(); document.getElementById("paid-input")?.focus(); }
      if (e.key === "F10") { e.preventDefault(); handleSaveBill(); }
      if (e.key === "Escape") { if (window.confirm("Clear current bill?")) handleClear(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, paidAmount, selectedCustomerId]);

  // Cart Handlers
  const addToCart = (product: any) => {
    if (product.current_stock <= 0) return;
    const existing = cart.find(item => item.product_id === product.product_id);
    if (existing) {
      if (existing.qty >= product.current_stock) return;
      setCart(cart.map(item => item.product_id === product.product_id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { 
        product_id: product.product_id, 
        name: product.name, 
        qty: 1, 
        rate: product.selling_price,
        gstRate: product.gst_percent || 18,
        hsnCode: product.hsn_code
      }]);
    }
    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const updateQty = (productId: number, newQty: number) => {
    const product = products.find(p => p.product_id === productId);
    if (!product || newQty > product.current_stock || newQty < 1) return;
    setCart(cart.map(item => item.product_id === productId ? { ...item, qty: newQty } : item));
  };

  // Calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    cart.forEach(item => {
      const lineTotal = item.qty * item.rate;
      subtotal += lineTotal;
      cgst += (lineTotal * (item.gstRate / 2)) / 100;
      sgst += (lineTotal * (item.gstRate / 2)) / 100;
    });
    const netTotal = subtotal + cgst + sgst - discount;
    const balance = Math.max(0, netTotal - (parseFloat(paidAmount) || 0));
    return { subtotal, cgst, sgst, netTotal, balance };
  }, [cart, discount, paidAmount]);

  // Save Bill
  const handleSaveBill = async () => {
    if (cart.length === 0) return;
    if (parseFloat(paidAmount) < totals.netTotal && !selectedCustomerId) {
      return alert("Customer selection required for partial payments/credit.");
    }

    setIsSaving(true);
    try {
      const res = await apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({
          customer_id: selectedCustomerId || null,
          branch_id: activeBranch?.id,
          items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.qty,
            unit_price: item.rate,
            tax_percent: item.gstRate
          })),
          discount_amount: discount,
          paid_amount: parseFloat(paidAmount) || 0,
          payment_mode: paymentMode,
          source: "BRANCH_BILLING"
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(`✅ Bill #${data.bill_number} Saved!`);
        setTimeout(() => setSuccessMessage(null), 5000);
        handleClear();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save bill.");
      }
    } catch (err) {
      alert("System error saving bill.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setCart([]);
    setSelectedCustomerId("");
    setPaidAmount("");
    setDiscount(0);
    setSearchTerm("");
  };

  // Stock Request
  const handleSendRequest = async () => {
    if (!showRequestModal || !requestQty) return;
    try {
      const res = await apiFetch("/branch-inventory/requests", {
        method: "POST",
        body: JSON.stringify({
          product_id: showRequestModal.product_id,
          requested_qty: requestQty,
          urgency: requestUrgency,
          note: requestNote
        })
      });
      if (res.ok) {
        alert("Request sent successfully!");
        setShowRequestModal(null);
        fetchData();
      }
    } catch (err) {
      alert("Failed to send request.");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="db-page" style={{ height: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top Bar */}
      <header style={{ height: "70px", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 30px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ padding: "8px 15px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
            <FaBuilding color="#4f46e5" />
            <span style={{ fontWeight: 800, color: "#1e293b" }}>{activeBranch?.branch_name || "Branch Terminal"}</span>
          </div>
          <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: 600 }}><FaRegClock /> {new Date().toLocaleDateString()}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => navigate('/inventory/requests')} style={{ padding: "8px 16px", borderRadius: "10px", background: pendingRequestsCount > 0 ? "#fee2e2" : "#f1f5f9", color: pendingRequestsCount > 0 ? "#ef4444" : "#64748b", border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
             <FaInbox /> Requests {pendingRequestsCount > 0 && <span style={{ background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: "50%", fontSize: "10px" }}>{pendingRequestsCount}</span>}
          </button>
          <div style={{ height: "30px", width: "1px", background: "#e2e8f0" }}></div>
          <button onClick={() => navigate('/dashboard')} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>Exit Mode</button>
        </div>
      </header>

      {/* Main Billing Area */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 450px", overflow: "hidden" }}>
        
        {/* Left: Product Selection */}
        <div style={{ padding: "30px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: "30px", display: "flex", gap: "20px" }}>
            <div className="search-container" style={{ flex: 1, background: "#fff", border: "2px solid #3b82f6", height: "60px" }}>
              <FaSearch className="search-icon" style={{ fontSize: "20px" }} />
              <input 
                ref={searchInputRef}
                className="search-input" 
                placeholder="Search Product (F2) or Scan Barcode..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ fontSize: "1.1rem" }}
              />
            </div>
            <button onClick={() => handleClear()} className="page-btn-round-ghost" style={{ height: "60px", padding: "0 25px" }}>
              <FaTrash /> Clear Bill
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
            {filteredProducts.map(p => {
              const stock = parseFloat(p.current_stock);
              const color = stock > 10 ? "#22c55e" : stock > 0 ? "#f59e0b" : "#94a3b8";
              const isOut = stock <= 0;
              
              return (
                <motion.div 
                  key={p.product_id}
                  whileHover={!isOut ? { y: -5 } : {}}
                  onClick={() => addToCart(p)}
                  style={{ 
                    background: "#fff", 
                    borderRadius: "16px", 
                    padding: "20px", 
                    border: `2px solid ${isOut ? "#e2e8f0" : color}`,
                    cursor: isOut ? "not-allowed" : "pointer",
                    position: "relative",
                    opacity: isOut ? 0.6 : 1,
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
                  }}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `${color}15`, color: color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "15px" }}>
                    <FaBox />
                  </div>
                  <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "0.95rem", marginBottom: "5px", height: "40px", overflow: "hidden" }}>{p.name}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a" }}>₹{parseFloat(p.selling_price).toLocaleString()}</div>
                  
                  <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: color }}>{isOut ? "OUT OF STOCK" : `${stock} ${p.unit}`}</span>
                    {stock < 5 && !isOut && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowRequestModal(p); }}
                        style={{ background: "#ef4444", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: 900, cursor: "pointer" }}
                      >
                        REQ
                      </button>
                    )}
                  </div>
                  {isOut && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowRequestModal(p); }}
                      style={{ marginTop: "10px", width: "100%", background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", padding: "6px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer" }}
                    >
                      Request Stock
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right: Current Bill Sidebar */}
        <div style={{ background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", boxShadow: "-10px 0 25px -5px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "25px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "10px" }}>
              <FaShoppingCart color="#4f46e5" /> Current Bill
            </h2>
            <span style={{ background: "#eff6ff", color: "#3b82f6", padding: "5px 12px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 800 }}>{cart.length} Items</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", borderBottom: "1px solid #f1f5f9" }}>
                  <th style={{ padding: "10px 0" }}>Product</th>
                  <th style={{ padding: "10px 0", textAlign: "center" }}>Qty</th>
                  <th style={{ padding: "10px 0", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "10px 0", width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.product_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "15px 0" }}>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>₹{item.rate} / unit</div>
                    </td>
                    <td style={{ padding: "15px 0", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "#f8fafc", padding: "5px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <button onClick={() => updateQty(item.product_id, item.qty - 1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>-</button>
                        <span style={{ fontWeight: 800, fontSize: "0.9rem", minWidth: "20px" }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.product_id, item.qty + 1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: "15px 0", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                      ₹{(item.qty * item.rate).toLocaleString()}
                    </td>
                    <td style={{ padding: "15px 0", textAlign: "right" }}>
                      <button onClick={() => removeFromCart(item.product_id)} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}><FaTrash size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "25px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
            {/* Bill Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "25px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "0.95rem" }}>
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "0.95rem" }}>
                <span>Taxes (GST)</span>
                <span>₹{(totals.cgst + totals.sgst).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", marginTop: "10px", borderTop: "2px dashed #e2e8f0", paddingTop: "15px" }}>
                <span>NET TOTAL</span>
                <span style={{ color: "#4f46e5" }}>₹{totals.netTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Section */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #e2e8f0", marginBottom: "25px" }}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Payment Details (F8)</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input 
                    id="paid-input"
                    type="number" 
                    placeholder="Amt Paid" 
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #10b981", fontSize: "1.25rem", fontWeight: 800, outline: "none" }}
                  />
                  <select 
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    style={{ width: "120px", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none", fontWeight: 700 }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="WALLET">Wallet</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Balance Change</span>
                <span style={{ fontWeight: 800, color: totals.balance > 0 ? "#ef4444" : "#10b981" }}>₹{totals.balance.toLocaleString()}</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
               <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", display: "block", marginBottom: "8px" }}>Link Customer</label>
               <CustomSelect value={selectedCustomerId} onChange={(e: any) => setSelectedCustomerId(e.target.value)}>
                  <option value="">Guest Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
               </CustomSelect>
            </div>

            <button 
              onClick={handleSaveBill}
              disabled={isSaving || cart.length === 0}
              style={{ width: "100%", background: "#10b981", color: "#fff", border: "none", borderRadius: "15px", padding: "20px", fontSize: "1.25rem", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.4)" }}
            >
              {isSaving ? "Saving..." : <><FaPrint /> Print & Save (F10)</>}
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", padding: "15px 30px", borderRadius: "12px", fontWeight: 800, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "10px", zIndex: 10000 }}
          >
            <FaCheckCircle /> {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Request Modal */}
      {showRequestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 11000 }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: "#fff", width: "400px", borderRadius: "20px", padding: "30px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900 }}>📦 Request Stock</h3>
              <button onClick={() => setShowRequestModal(null)} style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>

            <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700 }}>Product</div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1e293b" }}>{showRequestModal.name}</div>
              <div style={{ fontSize: "0.85rem", color: "#f59e0b", fontWeight: 700, marginTop: "5px" }}>Current Stock: {showRequestModal.current_stock} {showRequestModal.unit}</div>
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
               <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#475569" }}>Qty Needed</label>
               <input type="number" value={requestQty} onChange={e => setRequestQty(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontWeight: 700 }} />
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
               <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#475569" }}>Urgency</label>
               <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setRequestUrgency("Normal")} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "2px solid", borderColor: requestUrgency === "Normal" ? "#3b82f6" : "#e2e8f0", background: requestUrgency === "Normal" ? "#eff6ff" : "#fff", color: requestUrgency === "Normal" ? "#3b82f6" : "#64748b", fontWeight: 700, cursor: "pointer" }}>Normal</button>
                  <button onClick={() => setRequestUrgency("Urgent")} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "2px solid", borderColor: requestUrgency === "Urgent" ? "#ef4444" : "#e2e8f0", background: requestUrgency === "Urgent" ? "#fef2f2" : "#fff", color: requestUrgency === "Urgent" ? "#ef4444" : "#64748b", fontWeight: 700, cursor: "pointer" }}>🔴 Urgent</button>
               </div>
            </div>

            <div className="form-group" style={{ marginBottom: "30px" }}>
               <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#475569" }}>Note (optional)</label>
               <textarea value={requestNote} onChange={e => setRequestNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", minHeight: "80px" }} />
            </div>

            <div style={{ display: "flex", gap: "15px" }}>
              <button onClick={() => setShowRequestModal(null)} style={{ flex: 1, padding: "15px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSendRequest} style={{ flex: 1, padding: "15px", borderRadius: "12px", border: "none", background: "#4f46e5", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Send Request</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BranchBilling;
