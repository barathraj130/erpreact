import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaSave, FaTrash } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";

const EditInvoice: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    
    // Form State
    const [invoiceNo, setInvoiceNo] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [invoiceDate, setInvoiceDate] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [notes, setNotes] = useState("");

    // Load Invoice Data
    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiFetch(`/invoice/${id}`);
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();

                setInvoiceNo(json.invoice_number);
                setCustomerName(json.customer_name);
                setInvoiceDate(json.invoice_date.substring(0, 10)); // YYYY-MM-DD
                setNotes(json.notes || "");

                // Map items to form format
                const mappedItems = (json.items || []).map((i: any) => ({
                    description: i.description,
                    hsn: i.hsn_acs_code,
                    qty: i.quantity,
                    rate: i.unit_price,
                    gst_rate: i.gst_rate
                }));
                setItems(mappedItems);
            } catch (err) {
                alert("Could not load invoice.");
                navigate("/invoices");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate]);

    // Handle Calculations
    const calculateTotal = () => {
        return items.reduce((acc, item) => {
            const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
            const tax = amount * ((Number(item.gst_rate) || 0) / 100);
            return acc + amount + tax;
        }, 0);
    };

    // Handle Save
    const handleUpdate = async () => {
        try {
            const res = await apiFetch(`/invoice/${id}`, {
                method: "PUT",
                // ✅ This now works perfectly with the updated api.ts
                body: { items, notes } 
            });
            
            if (res.ok) {
                alert("Invoice Updated!");
                navigate(`/invoices/${id}`);
            } else {
                alert("Failed to update");
            }
        } catch (err) {
            console.error(err);
            alert("Error updating invoice");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div style={{ display: "flex", height: "100vh", background: "#f3f4f6" }}>
            <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto", background: "white", padding: "20px", overflowY: "auto" }}>
                
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px", paddingBottom: "15px", borderBottom: "1px solid #eee" }}>
                    <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer" }}><FaArrowLeft /></button>
                    <h2 style={{ margin: 0 }}>Edit Invoice: {invoiceNo}</h2>
                </div>

                {/* Read-Only Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px", background: "#f9fafb", padding: "15px", borderRadius: "8px" }}>
                    <div>
                        <label style={{ fontSize: "12px", color: "#666", display: "block" }}>Customer</label>
                        <strong>{customerName}</strong>
                    </div>
                    <div>
                        <label style={{ fontSize: "12px", color: "#666", display: "block" }}>Date</label>
                        <strong>{invoiceDate}</strong>
                    </div>
                </div>

                {/* Items Table */}
                <h3 style={{ fontSize: "1rem", marginBottom: "10px" }}>Items</h3>
                {items.map((item, index) => (
                    <div key={index} style={{ display: "flex", gap: "10px", marginBottom: "10px", padding: "10px", border: "1px solid #eee", borderRadius: "6px" }}>
                        <div style={{ flex: 2 }}>
                            <input 
                                placeholder="Description" 
                                value={item.description} 
                                onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[index].description = e.target.value;
                                    setItems(newItems);
                                }}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <input 
                                type="number" placeholder="Qty" 
                                value={item.qty} 
                                onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[index].qty = e.target.value;
                                    setItems(newItems);
                                }}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <input 
                                type="number" placeholder="Rate" 
                                value={item.rate} 
                                onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[index].rate = e.target.value;
                                    setItems(newItems);
                                }}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ width: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <button onClick={() => {
                                const newItems = [...items];
                                newItems.splice(index, 1);
                                setItems(newItems);
                            }} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ))}

                <button 
                    onClick={() => setItems([...items, { description: "", qty: 1, rate: 0, gst_rate: 0 }])}
                    style={{ width: "100%", padding: "10px", background: "#eff6ff", color: "#2563eb", border: "1px dashed #2563eb", borderRadius: "6px", cursor: "pointer", fontWeight: 600, marginBottom: "20px" }}
                >
                    + Add Item
                </button>

                <div style={{ textAlign: "right", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "20px" }}>
                    Total: ₹{calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>

                <button 
                    onClick={handleUpdate}
                    style={{ width: "100%", padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", fontSize: "1rem", fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", gap: "10px", alignItems: "center" }}
                >
                    <FaSave /> Update Invoice
                </button>

            </div>
        </div>
    );
};

const inputStyle = {
    width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px"
};

export default EditInvoice;