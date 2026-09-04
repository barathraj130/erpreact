
import React, { useState, useEffect } from "react";
import { FaExchangeAlt, FaArrowRight, FaBox, FaBuilding, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import { useNavigate } from "react-router-dom";

const StockTransfer: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [productId, setProductId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [stockType, setStockType] = useState<"fresh" | "mistake">("fresh");
  const [typeBreakdown, setTypeBreakdown] = useState<{ fresh: number; mistake: number } | null>(null);

  const [selectedProductData, setSelectedProductData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [pRes, bRes] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/branches")
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (bRes.ok) setBranches(await bRes.json());
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (productId) {
      const p = products.find(prod => String(prod.id) === productId);
      setSelectedProductData(p || null);
      apiFetch(`/branch-inventory/type-breakdown/${productId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setTypeBreakdown(d))
        .catch(() => setTypeBreakdown(null));
    } else {
      setSelectedProductData(null);
      setTypeBreakdown(null);
    }
  }, [productId, products]);

  const handleTransfer = async () => {
    if (!productId || !toBranchId || !qty) return alert("Please fill all required fields.");
    if (parseFloat(qty) <= 0) return alert("Quantity must be greater than zero.");
    if (typeBreakdown && parseFloat(qty) > typeBreakdown[stockType]) {
      return alert(`Transfer quantity exceeds available ${stockType} stock at Main branch (${typeBreakdown[stockType]} available).`);
    }

    setLoading(true);
    try {
      const res = await apiFetch("/branch-inventory/requests/manual-transfer", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          to_branch_id: toBranchId,
          qty,
          notes,
          stock_type: stockType
        })
      });

      // TEMPORARY DIAGNOSTIC — shows exactly what the server returned, since
      // multiple transfers reported success with zero effect in the DB.
      const rawText = await res.text();
      alert(`DIAGNOSTIC\nHTTP status: ${res.status}\nURL: ${res.url}\nBody: ${rawText}`);

      if (res.ok) {
        navigate("/inventory/consolidated");
      }
    } catch (err: any) {
      alert(`DIAGNOSTIC — request threw: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="db-page" style={{ padding: "30px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>Stock Transfer</h1>
        <p style={{ color: "#64748b", marginBottom: "40px" }}>Move inventory from Main Branch to another location atomically.</p>

        <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "30px" }}>
            <div className="form-group">
              <label style={{ display: "block", marginBottom: "10px", fontWeight: 700, color: "#475569" }}>Source</label>
              <div style={{ padding: "15px", background: "#f1f5f9", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px", color: "#1e293b", fontWeight: 600 }}>
                <FaBuilding color="#94a3b8" /> Main Branch (Store)
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: "block", marginBottom: "10px", fontWeight: 700, color: "#475569" }}>Destination Branch <span style={{ color: "#ef4444" }}>*</span></label>
              <select 
                value={toBranchId} 
                onChange={e => setToBranchId(e.target.value)}
                style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem" }}
              >
                <option value="">-- Select Destination --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: "2px dashed #f1f5f9", margin: "30px 0" }}></div>

          <div className="form-group" style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: 700, color: "#475569" }}>Select Product <span style={{ color: "#ef4444" }}>*</span></label>
            <select 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem" }}
            >
              <option value="">-- Select Product to Transfer --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'N/A'})</option>)}
            </select>
            {typeBreakdown && (
              <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                <span style={{ fontSize: "0.85rem", padding: "5px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: "8px", fontWeight: 700 }}>
                  Fresh in Main: {typeBreakdown.fresh} {selectedProductData?.unit}
                </span>
                <span style={{ fontSize: "0.85rem", padding: "5px 12px", background: "#fff7ed", color: "#c2410c", borderRadius: "8px", fontWeight: 700 }}>
                  Mistake in Main: {typeBreakdown.mistake} {selectedProductData?.unit}
                </span>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: 700, color: "#475569" }}>Stock Quality <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setStockType("fresh")}
                style={{
                  flex: 1, padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: 700,
                  border: stockType === "fresh" ? "2px solid #16a34a" : "2px solid #e2e8f0",
                  background: stockType === "fresh" ? "#f0fdf4" : "#fff",
                  color: stockType === "fresh" ? "#16a34a" : "#64748b",
                }}
              >
                Fresh
              </button>
              <button
                type="button"
                onClick={() => setStockType("mistake")}
                style={{
                  flex: 1, padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: 700,
                  border: stockType === "mistake" ? "2px solid #c2410c" : "2px solid #e2e8f0",
                  background: stockType === "mistake" ? "#fff7ed" : "#fff",
                  color: stockType === "mistake" ? "#c2410c" : "#64748b",
                }}
              >
                Mistake
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: 700, color: "#475569" }}>Transfer Quantity <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ position: "relative" }}>
              <input 
                type="number" 
                value={qty} 
                onChange={e => setQty(e.target.value)} 
                placeholder="0.00" 
                style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "2px solid #3b82f6", fontSize: "1.25rem", fontWeight: 800, outline: "none" }}
              />
              {selectedProductData && (
                <span style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontWeight: 700 }}>
                  {selectedProductData.unit}
                </span>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "40px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: 700, color: "#475569" }}>Transfer Notes</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Reason for transfer, bill reference, etc." 
              style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "2px solid #e2e8f0", minHeight: "100px", resize: "vertical", outline: "none" }}
            />
          </div>

          <button 
            onClick={handleTransfer} 
            disabled={loading}
            style={{ width: "100%", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "12px", padding: "18px", fontSize: "1.1rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.4)" }}
          >
            {loading ? "Processing..." : <><FaExchangeAlt /> Confirm & Transfer Stock</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockTransfer;
