
import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  FaSearch, FaShoppingCart, FaTrash, FaPlus, FaCheck, FaTimes, 
  FaBox, FaRegClock, FaUserAlt, FaFileUpload, FaPrint, FaWhatsapp,
  FaInbox, FaExclamationTriangle, FaBolt, FaUserEdit, FaCheckCircle, FaBuilding,
  FaWallet, FaCalendarCheck, FaChartLine, FaHistory, FaCreditCard
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { useTenant } from "../context/TenantContext";
import CustomSelect from "../components/CustomSelect";
import { useNavigate } from "react-router-dom";
import PaymentPopup from "../components/PaymentPopup";

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
  const [paymentsList, setPaymentsList] = useState<{ amount: number; method: string; reference?: string }[]>([{ amount: 0, method: "CASH", reference: "" }]);
  const [activePaymentIndex, setActivePaymentIndex] = useState<number | null>(null);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [discount, setDiscount] = useState<number>(0);

  // UI State
  const [showRequestModal, setShowRequestModal] = useState<any>(null);
  const [requestQty, setRequestQty] = useState("50");
  const [requestUrgency, setRequestUrgency] = useState("Normal");
  const [requestNote, setRequestNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"BILLING" | "INVENTORY" | "DAY_CLOSE">("BILLING");
  const [cashSummary, setCashSummary] = useState<any>(null);
  const [dayTransactions, setDayTransactions] = useState<any[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

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
    const totalPaid = paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, netTotal - totalPaid);
    return { subtotal, cgst, sgst, netTotal, balance, totalPaid };
  }, [cart, discount, paymentsList]);

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
          paid_amount: totals.totalPaid,
          payment_mode: paymentsList[0]?.method || "CASH",
          payments: paymentsList.filter(p => p.amount > 0),
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
    setPaymentsList([{ amount: 0, method: "CASH", reference: "" }]);
    setDiscount(0);
    setSearchTerm("");
  };

  const fetchCashSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiFetch(`/ledgers/cash?startDate=${today}&endDate=${today}`);
      if (res.ok) {
        const data = await res.json();
        setDayTransactions(data.entries || []);
        
        const totalIn = data.entries.filter((e:any) => e.direction === 'in').reduce((sum:number, e:any) => sum + parseFloat(e.amount), 0);
        const totalOut = data.entries.filter((e:any) => e.direction === 'out').reduce((sum:number, e:any) => sum + parseFloat(e.amount), 0);
        setCashSummary({ totalIn, totalOut, net: totalIn - totalOut });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (activeTab === "DAY_CLOSE") fetchCashSummary();
  }, [activeTab]);

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
      <header style={{ height: "80px", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 30px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
             <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #4f46e5, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>{activeBranch?.branch_name?.[0] || 'B'}</div>
             <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 900, color: "#0f172a", fontSize: "1.1rem" }}>{activeBranch?.branch_name || "Branch Terminal"}</span>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
             </div>
          </div>

          <nav style={{ display: "flex", gap: "5px", background: "#f1f5f9", padding: "5px", borderRadius: "12px" }}>
             {[
               { id: "BILLING", label: "Billing", icon: <FaBolt /> },
               { id: "INVENTORY", label: "Inventory", icon: <FaBox /> },
               { id: "DAY_CLOSE", label: "Day Close", icon: <FaCalendarCheck /> }
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 style={{ 
                   padding: "8px 16px", 
                   borderRadius: "8px", 
                   border: "none", 
                   background: activeTab === tab.id ? "#fff" : "transparent",
                   color: activeTab === tab.id ? "#4f46e5" : "#64748b",
                   fontWeight: 800,
                   fontSize: "0.85rem",
                   cursor: "pointer",
                   display: "flex",
                   alignItems: "center",
                   gap: "8px",
                   boxShadow: activeTab === tab.id ? "0 4px 6px -1px rgba(0,0,0,0.1)" : "none",
                   transition: "0.2s"
                 }}
               >
                 {tab.icon} {tab.label}
               </button>
             ))}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => navigate('/inventory/requests')} style={{ padding: "10px 18px", borderRadius: "12px", background: pendingRequestsCount > 0 ? "#fee2e2" : "#f1f5f9", color: pendingRequestsCount > 0 ? "#ef4444" : "#64748b", border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", transition: "0.2s" }}>
             <FaInbox /> {pendingRequestsCount > 0 ? `${pendingRequestsCount} Requests` : 'Stock Inbox'}
          </button>
          <div style={{ height: "30px", width: "1px", background: "#e2e8f0" }}></div>
          <button onClick={() => navigate('/dashboard')} style={{ padding: "10px", borderRadius: "10px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontWeight: 700 }}>Exit Mode</button>
        </div>
      </header>

      {/* Main Billing Area */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 450px", overflow: "hidden" }}>
        
        {/* Main Content Area */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <AnimatePresence mode="wait">
            {activeTab === "BILLING" && (
              <motion.div 
                key="billing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{ padding: "30px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}
              >
                <div style={{ marginBottom: "30px", display: "flex", gap: "20px" }}>
                  <div className="search-container" style={{ flex: 1, background: "#fff", border: "2px solid #4f46e5", height: "60px", boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.1)" }}>
                    <FaSearch className="search-icon" style={{ fontSize: "20px", color: "#4f46e5" }} />
                    <input 
                      ref={searchInputRef}
                      className="search-input" 
                      placeholder="Search Product (F2) or Scan Barcode..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ fontSize: "1.1rem" }}
                    />
                  </div>
                  <button onClick={() => handleClear()} className="page-btn-round-ghost" style={{ height: "60px", padding: "0 25px", background: "#fff" }}>
                    <FaTrash /> Clear Bill
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" }}>
                  {filteredProducts.map(p => {
                    const stock = parseFloat(p.current_stock);
                    const color = stock > 10 ? "#10b981" : stock > 0 ? "#f59e0b" : "#94a3b8";
                    const isOut = stock <= 0;
                    
                    return (
                      <motion.div 
                        key={p.product_id}
                        whileHover={!isOut ? { y: -8, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" } : {}}
                        onClick={() => addToCart(p)}
                        style={{ 
                          background: "#fff", 
                          borderRadius: "20px", 
                          padding: "15px", 
                          border: `2px solid ${isOut ? "#e2e8f0" : "transparent"}`,
                          cursor: isOut ? "not-allowed" : "pointer",
                          position: "relative",
                          opacity: isOut ? 0.6 : 1,
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                          transition: "0.2s"
                        }}
                      >
                        <div style={{ width: "100%", height: "130px", borderRadius: "15px", background: "#f8fafc", overflow: "hidden", border: "1px solid #f1f5f9", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                           {p.image_url ? (
                              <img src={p.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                           ) : (
                              <FaBox size={40} color="#e2e8f0" />
                           )}
                        </div>
                        <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "0.9rem", marginBottom: "8px", lineHeight: "1.2" }}>{p.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a" }}>₹{parseFloat(p.selling_price).toLocaleString()}</div>
                           <span style={{ fontSize: "0.7rem", fontWeight: 900, color: color, background: `${color}15`, padding: "4px 8px", borderRadius: "6px" }}>{isOut ? "OUT" : `${stock} ${p.unit}`}</span>
                        </div>
                        {stock < 5 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowRequestModal(p); }}
                            style={{ marginTop: "12px", width: "100%", background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", padding: "8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer" }}
                          >
                            Request Stock
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === "INVENTORY" && (
              <motion.div 
                key="inventory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ padding: "40px", height: "100%", overflowY: "auto" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                  <h2 style={{ margin: 0, fontWeight: 900, fontSize: "1.5rem" }}>Branch Inventory Details</h2>
                  <div className="search-container" style={{ width: "300px", background: "#fff" }}>
                    <FaSearch className="search-icon" />
                    <input className="search-input" placeholder="Search Inventory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: "30px" }}>Product</th>
                        <th style={{ textAlign: "right" }}>Selling Price</th>
                        <th style={{ textAlign: "right" }}>Current Stock</th>
                        <th style={{ textAlign: "right" }}>Value</th>
                        <th style={{ textAlign: "center" }}>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(p => (
                        <tr key={p.product_id}>
                          <td style={{ paddingLeft: "30px" }}>
                             <div style={{ fontWeight: 800 }}>{p.name}</div>
                             <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>HSN: {p.hsn_code || 'N/A'}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>₹{parseFloat(p.selling_price).toLocaleString()}</td>
                          <td style={{ textAlign: "right", fontWeight: 900, color: "#4f46e5" }}>{parseFloat(p.current_stock).toLocaleString()} {p.unit}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>₹{(p.current_stock * p.selling_price).toLocaleString()}</td>
                          <td style={{ textAlign: "center" }}>
                             {p.current_stock <= p.min_stock ? (
                               <span style={{ color: "#ef4444", background: "#fef2f2", padding: "4px 10px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 800 }}>Low Stock</span>
                             ) : (
                               <span style={{ color: "#10b981", background: "#f0fdf4", padding: "4px 10px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 800 }}>Optimal</span>
                             )}
                          </td>
                          <td>
                             <button onClick={() => setShowRequestModal(p)} className="page-btn-round-ghost" style={{ fontSize: "0.75rem", padding: "6px 12px" }}>Request More</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === "DAY_CLOSE" && (
              <motion.div 
                key="dayclose"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ padding: "40px", height: "100%", overflowY: "auto" }}
              >
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
                    <div>
                      <h2 style={{ margin: 0, fontWeight: 900, fontSize: "1.75rem" }}>Day Closing Summary</h2>
                      <p style={{ color: "#64748b", marginTop: "5px" }}>Review today's cash ledger for {activeBranch?.branch_name}</p>
                    </div>
                    <button onClick={fetchCashSummary} style={{ padding: "10px", borderRadius: "10px", background: "#f1f5f9", border: "none", cursor: "pointer" }}><FaBolt color="#4f46e5" /></button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "25px", marginBottom: "40px" }}>
                     <div style={{ background: "#fff", padding: "25px", borderRadius: "24px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 700, marginBottom: "10px" }}>Total Cash In</div>
                        <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#10b981" }}>₹{cashSummary?.totalIn?.toLocaleString() || '0'}</div>
                     </div>
                     <div style={{ background: "#fff", padding: "25px", borderRadius: "24px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 700, marginBottom: "10px" }}>Total Cash Out</div>
                        <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#ef4444" }}>₹{cashSummary?.totalOut?.toLocaleString() || '0'}</div>
                     </div>
                     <div style={{ background: "linear-gradient(135deg, #4f46e5, #818cf8)", padding: "25px", borderRadius: "24px", boxShadow: "0 10px 20px -5px rgba(79, 70, 229, 0.4)", color: "#fff" }}>
                        <div style={{ opacity: 0.8, fontSize: "0.85rem", fontWeight: 700, marginBottom: "10px" }}>Closing Balance</div>
                        <div style={{ fontSize: "1.75rem", fontWeight: 900 }}>₹{cashSummary?.net?.toLocaleString() || '0'}</div>
                     </div>
                  </div>

                  <div style={{ background: "#fff", borderRadius: "24px", padding: "30px", border: "1px solid #e2e8f0", marginBottom: "40px" }}>
                    <h3 style={{ margin: "0 0 20px 0", fontSize: "1.1rem", fontWeight: 900 }}>Today's Cash Ledger</h3>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ textAlign: "left", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", borderBottom: "1px solid #f1f5f9" }}>
                          <th style={{ padding: "10px" }}>Time</th>
                          <th style={{ padding: "10px" }}>Description</th>
                          <th style={{ padding: "10px", textAlign: "right" }}>In</th>
                          <th style={{ padding: "10px", textAlign: "right" }}>Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayTransactions.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                            <td style={{ padding: "15px 10px", fontSize: "0.85rem", color: "#64748b" }}>{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: "15px 10px", fontWeight: 600 }}>{tx.note}</td>
                            <td style={{ padding: "15px 10px", textAlign: "right", color: "#10b981", fontWeight: 800 }}>{tx.direction === 'in' ? `₹${parseFloat(tx.amount).toLocaleString()}` : '-'}</td>
                            <td style={{ padding: "15px 10px", textAlign: "right", color: "#ef4444", fontWeight: 800 }}>{tx.direction === 'out' ? `₹${parseFloat(tx.amount).toLocaleString()}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button className="page-btn-round" style={{ width: "100%", height: "70px", fontSize: "1.25rem", borderRadius: "20px" }}>
                    <FaCheckCircle /> Verify & Close Day
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Payment Details (F8)</label>
                <button
                  onClick={() => setPaymentsList([...paymentsList, { amount: 0, method: "CASH", reference: "" }])}
                  style={{ padding: "5px 12px", background: "#f1f5f9", color: "#4f46e5", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <FaPlus size={10} /> Add Split
                </button>
              </div>

              {paymentsList.map((payment, index) => (
                <div key={index} style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px", marginBottom: "10px", border: "1px solid #e2e8f0", position: "relative" }}>
                  {paymentsList.length > 1 && (
                    <button
                      onClick={() => setPaymentsList(paymentsList.filter((_, i) => i !== index))}
                      style={{ position: "absolute", right: "-8px", top: "-8px", width: "22px", height: "22px", borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}
                    >
                      <FaTimes size={9} />
                    </button>
                  )}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={payment.amount || ""}
                      onChange={e => {
                        const arr = [...paymentsList];
                        arr[index].amount = Number(e.target.value);
                        setPaymentsList(arr);
                      }}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "2px solid #10b981", fontSize: "1.1rem", fontWeight: 800, outline: "none" }}
                    />
                    <select
                      value={payment.method}
                      onChange={e => {
                        const arr = [...paymentsList];
                        arr[index].method = e.target.value;
                        setPaymentsList(arr);
                      }}
                      style={{ width: "110px", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none", fontWeight: 700 }}
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank</option>
                      <option value="WALLET">Wallet</option>
                      <option value="UPI">UPI / QR</option>
                    </select>
                  </div>
                  <button
                    onClick={() => { setActivePaymentIndex(index); setShowPaymentPopup(true); }}
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "2px dashed #4f46e5", background: "#f5f3ff", color: "#4f46e5", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.75rem" }}
                  >
                    <FaCreditCard /> {payment.method === "CASH" ? "Show Digital Options" : `Set via Digital (${payment.method})`}
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Balance Due</span>
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
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }}
            style={{ position: "fixed", bottom: "30px", right: "30px", background: "#fff", padding: "25px", borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #10b981", display: "flex", flexDirection: "column", gap: "15px", zIndex: 10000, minWidth: "300px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#10b981", fontWeight: 900 }}>
               <FaCheckCircle size={24} /> {successMessage}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
               <button 
                 onClick={() => window.print()}
                 style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#f1f5f9", border: "none", color: "#475569", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
               >
                 <FaPrint /> Print
               </button>
               <button 
                 onClick={() => {
                   const msg = `Hello! Your bill ${successMessage.split('#')[1]} from ${activeBranch?.branch_name} is ready. Total: ₹${totals.netTotal.toLocaleString()}`;
                   window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                 }}
                 style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#25d366", border: "none", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
               >
                 <FaWhatsapp /> Share
               </button>
            </div>
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
