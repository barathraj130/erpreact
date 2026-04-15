import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaEdit,
  FaEye,
  FaFileInvoice,
  FaGlobe,
  FaMagic,
  FaPlus,
  FaSearch,
  FaSync,
  FaTimes,
} from "react-icons/fa";
import { PurchaseBill, fetchPurchaseBills } from "../api/purchaseBillApi";
import { scanProductFromBill } from "../api/productApi";
import { apiFetch } from "../utils/api";
import "./PurchaseBills.css";
import CustomSelect from "../components/CustomSelect";

const PurchaseBills: React.FC = () => {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Create Bill State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [newBill, setNewBill] = useState({
    supplier_id: "",
    bill_number: "",
    bill_date: new Date().toISOString().split("T")[0],
    due_date: "",
    total_amount: "",
    status: "PENDING",
    bill_type: "GST",
    paid_amount: "0",
  });
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Scan Logic
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseBills();
      setBills(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError("Failed to load purchase bills.");
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliersList = async () => {
    try {
      const res = await apiFetch("/lenders");
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error("Failed to load suppliers", err);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadData();
    fetchSuppliersList();
  }, []);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(newBill).forEach(([k, v]) => formData.append(k, v));
      if (billFile) formData.append("bill_file", billFile);

      const res = await apiFetch(
        isEditing ? `/purchase-bills/${editId}` : "/purchase-bills",
        {
          method: isEditing ? "PUT" : "POST",
          body: formData,
        },
        false,
      );

      if (res.ok) {
        setShowCreateModal(false);
        loadData();
        resetForm();
      } else {
        alert("Failed to save purchase bill.");
      }
    } catch (err) {
      console.error(`Error ${isEditing ? "updating" : "creating"} bill:`, err);
      alert("Execution error: Ledger sync failed.");
    }
  };

  const handleEdit = (bill: any) => {
    setIsEditing(true);
    setEditId(bill.id);
    setNewBill({
      supplier_id: bill.supplier_id || "",
      bill_number: bill.bill_number || "",
      bill_date: bill.bill_date?.split("T")[0] || "",
      due_date: bill.due_date?.split("T")[0] || "",
      total_amount: bill.total_amount || "",
      status: bill.status || "PENDING",
      bill_type: bill.bill_type || "GST",
      paid_amount: bill.paid_amount || "0",
    });
    setBillFile(null);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId(null);
    setNewBill({
      supplier_id: "",
      bill_number: "",
      bill_date: new Date().toISOString().split("T")[0],
      due_date: "",
      total_amount: "",
      status: "PENDING",
      bill_type: "GST",
      paid_amount: "0",
    });
    setBillFile(null);
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanLoading(true);
    setScanError("");

    try {
      const result: any = await scanProductFromBill(file);
      setNewBill((prev) => ({
        ...prev,
        bill_number: result.bill_number || `SCAN-${Date.now()}`,
        total_amount: result.source_meta?.amount || result.amount || "",
        bill_date: result.source_meta?.date || new Date().toISOString().split("T")[0],
      }));
      setBillFile(file);
    } catch (err: any) {
      setScanError(err.message || "Scanning failed.");
    } finally {
      setScanLoading(false);
      e.target.value = "";
    }
  };

  const filteredBills = React.useMemo(() => {
    if (!Array.isArray(bills)) return [];

    return bills.filter(
      (b) =>
        (b.bill_number || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (b.supplier_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
    );
  }, [bills, searchTerm]);

  return (
    <div
      className="purchase-bills-container page-container" style={{ padding: "24px" }}
    >
      <header
        className="bills-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "0",
          padding: isMobile ? "10px 10px 20px 10px" : "10px",
          fontFamily: "'Satoshi', sans-serif"
        }}
      >
        <div className="bills-title">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.4px", lineHeight: 1.3, margin: 0, color: "#111110" }}
          >

            Purchase Bills
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}
          >
            Manage your purchase bills and supplier invoices.
          </motion.p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <button
            className="btn-secondary"
            onClick={loadData}
            style={{
              width: "44px",
              height: "44px",
              padding: 0,
              minWidth: "44px",
              borderRadius: "100px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid #E2E8F0",
            }}
          >
            <FaSync
              className={loading ? "fa-spin" : ""}
              style={{ color: "#1E293B" }}
            />
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            style={{
              height: "44px",
              padding: "0 24px",
              borderRadius: "100px",
              fontWeight: 600,
              background: "#1E293B",
              color: "#fff",
              border: "none",
              flex: isMobile ? 1 : "none",
              width: isMobile ? "100%" : "auto",
              justifyContent: "center",
            }}
          >
            <FaPlus /> Add Bill
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            background: "var(--error-glow)",
            color: "var(--error)",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "24px",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      <div className="page-search-bar" style={{ width: isMobile ? "100%" : "300px" }}>
        <FaSearch className="page-search-icon" size={14} />
        <input
          placeholder="Search bills by number or supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bills-table-wrapper" style={{ border: isMobile ? "none" : "1px solid var(--border-color)", background: isMobile ? "transparent" : "#fff", borderRadius: "24px" }}>
        {isMobile ? (
          <div className="mobile-bills-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "120px", borderRadius: "20px" }} />
              ))
            ) : filteredBills.length > 0 ? (
              filteredBills.map((bill, idx) => (
                <motion.div
                  key={bill.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{
                    background: "#fff",
                    borderRadius: "20px",
                    padding: "20px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                    border: "1px solid #f1f5f9"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>{bill.bill_number}</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>{bill.supplier_name || "Unknown"}</div>
                    </div>
                    <span className="bill-status-pill" style={{ fontSize: "0.7rem", padding: "4px 12px", background: bill.bill_type === "GST" ? "#eff6ff" : "#fef3c7", color: bill.bill_type === "GST" ? "#1e40af" : "#92400e", marginBottom: '4px' }}>
                      {bill.bill_type || "GST"}
                    </span>
                    <span className="bill-status-pill" style={{ fontSize: "0.7rem", padding: "4px 12px" }}>
                      {bill.status}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginTop: "12px" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString() : "---"}</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                        ₹{Number(bill.total_amount).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="control-btn" style={{ background: "#f8fafc" }}><FaEye /></button>
                      <button className="control-btn" style={{ background: "var(--primary-glow)", color: "var(--primary)" }} onClick={() => handleEdit(bill)}><FaEdit /></button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: "24px", color: "#64748b" }}>
                No bills found.
              </div>
            )}
          </div>
        ) : (
          <table className="bills-table">
            <thead>
              <tr>
                <th>Bill Number</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding: "30px" }}>
                      <div
                        className="skeleton"
                        style={{ height: "30px", borderRadius: "8px" }}
                      ></div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredBills.map((bill, idx) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={bill.id}
                    className="bill-row"
                  >
                    <td className="bill-identity">
                      <FaFileInvoice size={14} style={{ opacity: 0.3 }} />{" "}
                      {bill.bill_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {bill.supplier_name || "Unknown"}
                    </td>
                    <td>
                       <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: bill.bill_type === "GST" ? "#eff6ff" : "#fef3c7", color: bill.bill_type === "GST" ? "#1e40af" : "#92400e" }}>
                          {bill.bill_type || "GST"}
                       </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                      {bill.bill_date
                        ? new Date(bill.bill_date).toLocaleDateString()
                        : "---"}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        fontSize: "1rem",
                      }}
                    >
                      ₹{Number(bill.total_amount).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="bill-status-pill"
                        style={{
                          background: "var(--primary-glow)",
                          color: "var(--primary)",
                        }}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          className="control-btn"
                          style={{ background: "var(--bg-body)" }}
                          title="View"
                        >
                          <FaEye />
                        </button>
                        <button
                          className="control-btn"
                          style={{
                            background: "var(--primary-glow)",
                            color: "var(--primary)",
                          }}
                          onClick={() => handleEdit(bill)}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {!loading && !isMobile && filteredBills.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "80px 20px",
              textAlign: "center"
            }}
          >
            <FaFileInvoice size={64} style={{ color: "var(--border-color)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "1.25rem" }}>
                No bills found
              </h3>
              <p style={{ fontFamily: "'Satoshi', sans-serif", fontSize: "12.5px", color: "#9b9b96", marginTop: "3px", marginBottom: 0 }}>
                Add a purchase bill to get started.
              </p>
            </div>
          </div>
        )}
      </div>


      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="scanner-overlay"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="scanner-modal"
              style={{ maxWidth: "500px" }}
            >
              <div className="modal-header">
                <h3 style={{ margin: 0, fontWeight: 700 }}>
                  {isEditing ? "Edit Bill" : "Add Bill"}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  style={{ padding: "8px", width: "36px", height: "36px" }}
                >
                  <FaTimes />
                </button>
              </div>

              {!isEditing && (
                <div style={{ padding: "12px 32px 0 32px" }}>
                  <div style={{
                    padding: "16px",
                    background: "#f8fafc",
                    border: "1px dashed #e2e8f0",
                    borderRadius: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <FaMagic color="#4f46e5" /> Auto-Scan Bill
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Extract details automatically via OCR
                      </div>
                    </div>
                    <label style={{
                      padding: "8px 16px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <FaCamera /> {scanLoading ? "Scanning..." : "Scan & Extract"}
                      <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleScanFile} disabled={scanLoading} />
                    </label>
                  </div>
                  {scanError && <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "8px", fontWeight: 600 }}>{scanError}</div>}
                </div>
              )}

              <form onSubmit={handleCreateBill} style={{ padding: "32px" }}>
                <div className="input-group" style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    Supplier
                  </label>
                  <CustomSelect
                    value={newBill.supplier_id}
                    onChange={(e) =>
                      setNewBill({ ...newBill, supplier_id: e.target.value })
                    }
                    className="input-modern"
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.lender_name}
                      </option>
                    ))}
                  </CustomSelect>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <label style={{ fontSize: "0.7rem", fontWeight: 600 }}>
                      Bill Number
                    </label>
                    <input
                      type="text"
                      value={newBill.bill_number}
                      onChange={(e) =>
                        setNewBill({ ...newBill, bill_number: e.target.value })
                      }
                      className="input-modern"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.7rem", fontWeight: 600 }}>
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={newBill.total_amount}
                      onChange={(e) =>
                        setNewBill({ ...newBill, total_amount: e.target.value })
                      }
                      className="input-modern"
                      required
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#475569",
                        marginBottom: "5px",
                      }}
                    >
                      Bill Date
                    </label>
                    <input
                      type="date"
                      value={newBill.bill_date}
                      onChange={(e) =>
                        setNewBill({ ...newBill, bill_date: e.target.value })
                      }
                      className="input-modern"
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#475569",
                        marginBottom: "5px",
                      }}
                    >
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newBill.due_date}
                      onChange={(e) =>
                        setNewBill({ ...newBill, due_date: e.target.value })
                      }
                      className="input-modern"
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#475569",
                        marginBottom: "5px",
                      }}
                    >
                      Bill Type
                    </label>
                    <CustomSelect
                      value={newBill.bill_type}
                      onChange={(e) =>
                        setNewBill({ ...newBill, bill_type: e.target.value })
                      }
                      className="input-modern"
                    >
                      <option value="GST">GST Bill</option>
                      <option value="NON_GST">Non-GST Bill</option>
                    </CustomSelect>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#475569",
                        marginBottom: "5px",
                      }}
                    >
                      Upload Copy (Optional)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                      accept="image/*,.pdf"
                      className="input-modern"
                      style={{ padding: "7px" }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                    marginBottom: "24px",
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                      Paid Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={newBill.paid_amount}
                      onChange={(e) =>
                        setNewBill({ ...newBill, paid_amount: e.target.value })
                      }
                      className="input-modern"
                      placeholder="0"
                      style={{ background: "#fff", marginTop: "4px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                      Remaining Balance
                    </label>
                    <div style={{ 
                      marginTop: "4px",
                      padding: "12px",
                      background: "#fff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontWeight: 800,
                      color: (Number(newBill.total_amount) - Number(newBill.paid_amount)) > 0 ? "#ef4444" : "#22c55e",
                      fontSize: "1.1rem"
                    }}>
                      ₹{(Number(newBill.total_amount) - Number(newBill.paid_amount)).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                    style={{ width: "100%" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: "100%" }}
                  >
                    {isEditing ? "Update Bill" : "Save Bill"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PurchaseBills;
