import React, { useEffect, useState } from "react";
import {
  FaCheck,
  FaAlignLeft,
  FaArrowDown,
  FaArrowUp,
  FaBarcode,
  FaBox,
  FaCamera,
  FaImage,
  FaFileInvoice,
  FaMoneyBillWave,
  FaPlus,
  FaSave,
  FaSearch,
  FaTag,
  FaTimes,
  FaUpload,
} from "react-icons/fa";
import { apiFetch } from "../utils/api";
import {
  createProduct,
  updateProduct,
} from "../api/productApi";
import CustomSelect from "../components/CustomSelect";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: any;
}

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(8px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: "650px",
    borderRadius: "20px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    maxHeight: "90vh",
    fontFamily: "Inter, sans-serif",
  },
  header: {
    padding: "20px 28px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    flexShrink: 0,
  },
  body: {
    padding: "28px",
    overflowY: "auto" as const,
    flexGrow: 1,
    background: "linear-gradient(to bottom, #ffffff, #f8fafc)",
  },
  footer: {
    padding: "20px 28px",
    borderTop: "1px solid #f1f5f9",
    backgroundColor: "#ffffff",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexShrink: 0,
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    letterSpacing: "-0.5px",
  },
  closeBtn: {
    background: "#f1f5f9",
    border: "none",
    cursor: "pointer",
    color: "#64748b",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#334155",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    marginBottom: "16px",
    marginTop: "24px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  inputGroup: { marginBottom: "20px" },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#475569",
    letterSpacing: "-0.2px",
  },
  inputWrapper: { position: "relative" as const },
  icon: {
    position: "absolute" as const,
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    pointerEvents: "none" as const,
    fontSize: "16px",
  },
  input: {
    width: "100%",
    padding: "12px 14px 12px 42px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    fontSize: "0.95rem",
    color: "#1e293b",
    backgroundColor: "#fff",
    outline: "none",
    transition: "all 0.2s",
    boxSizing: "border-box" as const,
    fontWeight: 500,
  },
  textarea: {
    width: "100%",
    padding: "12px 14px 12px 42px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    fontSize: "0.95rem",
    color: "#1e293b",
    backgroundColor: "#fff",
    outline: "none",
    transition: "all 0.2s",
    boxSizing: "border-box" as const,
    fontWeight: 500,
    minHeight: "80px",
    resize: "vertical" as const,
  },
  row: (isMobile: boolean) => ({ 
    display: "grid", 
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", 
    gap: isMobile ? "12px" : "20px" 
  }),

  btnSecondary: {
    padding: "12px 24px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#fff",
    color: "#475569",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnPrimary: {
    padding: "12px 28px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#4f46e5",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
    transition: "all 0.2s",
  },
  helperText: {
    fontSize: "0.82rem",
    color: "#64748b",
    lineHeight: 1.5,
  },
};

const InputField = ({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  disabled = false,
  isTextArea = false,
}: any) => (
  <div style={styles.inputGroup}>
    <label style={styles.label}>
      {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
    </label>
    <div style={styles.inputWrapper}>
      <div style={{ ...styles.icon, top: isTextArea ? "24px" : "50%" }}>
        <Icon />
      </div>
      {isTextArea ? (
        <textarea
          required={required}
          disabled={disabled}
          style={{
            ...styles.textarea,
            ...(disabled ? { opacity: 0.7, backgroundColor: "#f1f5f9" } : {}),
          }}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      ) : (
        <input
          type={type}
          required={required}
          disabled={disabled}
          style={{
            ...styles.input,
            ...(disabled ? { opacity: 0.7, backgroundColor: "#f1f5f9" } : {}),
          }}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  </div>
);

const AddProductModal: React.FC<Props> = ({
  onClose,
  onSuccess,
  productToEdit,
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    cost_price: 0,
    selling_price: 0,
    opening_stock: 0,
    current_stock: 0,
    min_stock: 5,
    hsn_code: "",
    gst_percent: 0,
    supplier_name: "",
    barcode: "",
    unit: "pcs",
  });
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        name: productToEdit.name || "",
        sku: productToEdit.sku || "",
        description: productToEdit.description || "",
        cost_price: productToEdit.cost_price || 0,
        selling_price: productToEdit.selling_price || 0,
        opening_stock: productToEdit.opening_stock || 0,
        current_stock: productToEdit.current_stock || 0,
        min_stock: productToEdit.min_stock || 5,
        hsn_code: productToEdit.hsn_code || "",
        gst_percent: productToEdit.gst_percent || 0,
        supplier_name: productToEdit.supplier_name || "",
        barcode: productToEdit.barcode || "",
        unit: productToEdit.unit || "pcs",
      });
      if (productToEdit.image_url) {
        setImagePreview(productToEdit.image_url.startsWith('http') ? productToEdit.image_url : `http://${window.location.hostname}:3000${productToEdit.image_url}`);
      }
    }
  }, [productToEdit]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (productToEdit) {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          fd.append(key, String(value));
        });
        if (imageFile) fd.append("image", imageFile);

        const res = await apiFetch(`/products/${productToEdit.id}`, {
          method: "PUT",
          body: fd,
        }, false);
        if (!res.ok) throw new Error("Update failed");
      } else {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          fd.append(key, String(value));
        });
        if (imageFile) fd.append("image", imageFile);

        const res = await apiFetch("/products", {
          method: "POST",
          body: fd,
        }, false);
        
        if (!res.ok) throw new Error("Product creation failed");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="page-transition">
        <div style={styles.header}>
          <h2 style={styles.title}>
            <div
              style={{
                background: "rgba(79, 70, 229, 0.08)",
                padding: "10px",
                borderRadius: "12px",
                color: "#4f46e5",
                display: "flex",
              }}
            >
              <FaBox size={20} />
            </div>
            {productToEdit ? "Update Product" : "Add New Product"}
          </h2>
          <button
            onClick={onClose}
            style={styles.closeBtn}
            onMouseOver={(e) => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          >
            <FaTimes />
          </button>
        </div>

        <div style={{ ...styles.body, padding: "24px 32px" }}>
          <form id="product-form" onSubmit={handleSubmit}>
            <div style={styles.sectionTitle}>
              <FaTag /> Basic Information
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 1fr", gap: "24px", marginBottom: "24px", alignItems: "start" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: "140px",
                  height: "140px",
                  borderRadius: "20px",
                  border: "2px dashed #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative",
                  transition: "all 0.2s"
                }} onClick={() => document.getElementById('image-upload')?.click()}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <>
                      <FaImage size={24} color="#94a3b8" />
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, marginTop: "8px" }}>UPLOAD</span>
                    </>
                  )}
                  <input id="image-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                </div>
                <button type="button" onClick={() => document.getElementById('image-upload')?.click()} style={{
                  marginTop: "12px",
                  background: "none",
                  border: "none",
                  color: "#4f46e5",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}>Change Photo</button>
              </div>

              <div>
                <InputField
                  label="Product Name"
                  icon={FaBox}
                  required
                  placeholder="e.g. Wireless Mouse"
                  value={formData.name}
                  onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div style={styles.row(isMobile)}>
              <InputField
                label="SKU / Item ID"
                icon={FaBarcode}
                placeholder="PROD-123"
                value={formData.sku}
                onChange={(e: any) => setFormData({ ...formData, sku: e.target.value })}
              />
              <InputField
                label="HSN / SAC Code"
                icon={FaTag}
                placeholder="8471"
                value={formData.hsn_code}
                onChange={(e: any) => setFormData({ ...formData, hsn_code: e.target.value })}
              />
            </div>

            <div style={styles.row(isMobile)}>
              <InputField
                label="Supplier Name"
                icon={FaTag}
                placeholder="Supplier or vendor"
                value={formData.supplier_name}
                onChange={(e: any) => setFormData({ ...formData, supplier_name: e.target.value })}
              />
              <div style={styles.inputGroup}>
                <label style={styles.label}>Unit</label>
                <div style={styles.inputWrapper}>
                  <div style={styles.icon}><FaBox /></div>
                  <CustomSelect
                    value={formData.unit}
                    onChange={(e: any) => setFormData({ ...formData, unit: e.target.value })}
                    style={styles.input}
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="mtr">mtr</option>
                    <option value="box">box</option>
                    <option value="set">set</option>
                  </CustomSelect>
                </div>
              </div>
            </div>

            <div style={styles.sectionTitle}>
              <FaMoneyBillWave /> Pricing & Stock
            </div>
            
            <div style={styles.row(isMobile)}>
              <InputField
                label="Cost Price (₹)"
                icon={FaArrowUp}
                type="number"
                placeholder="0.00"
                value={formData.cost_price}
                onChange={(e: any) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
              />
              <InputField
                label="Selling Price (₹)"
                icon={FaArrowDown}
                type="number"
                placeholder="0.00"
                value={formData.selling_price}
                onChange={(e: any) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div style={styles.row(isMobile)}>
              <InputField
                label="Opening Stock"
                icon={FaCheck}
                type="number"
                placeholder="0"
                value={formData.opening_stock}
                onChange={(e: any) => setFormData({ ...formData, opening_stock: parseFloat(e.target.value) || 0 })}
                disabled={!!productToEdit}
              />
              <InputField
                label="Min Stock Level"
                icon={FaCheck}
                type="number"
                placeholder="5"
                value={formData.min_stock}
                onChange={(e: any) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div style={styles.row(isMobile)}>
              <InputField
                label="GST (%)"
                icon={FaTag}
                type="number"
                placeholder="18"
                value={formData.gst_percent}
                onChange={(e: any) => setFormData({ ...formData, gst_percent: parseFloat(e.target.value) || 0 })}
              />
              <InputField
                label="Barcode (Optional)"
                icon={FaBarcode}
                placeholder="Scan or enter barcode"
                value={formData.barcode}
                onChange={(e: any) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>

            <InputField
              label="Description"
              icon={FaAlignLeft}
              isTextArea
              placeholder="Add product details..."
              value={formData.description}
              onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
            />
          </form>
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            style={styles.btnSecondary}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            style={styles.btnPrimary}
            disabled={loading}
          >
            {loading ? (
              "Saving..."
            ) : (
              <>
                <FaSave />
                {productToEdit ? "Update Product" : "Create Product"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
