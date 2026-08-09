import React, { useEffect, useState } from "react";
import { FaStore, FaBoxOpen, FaEnvelopeOpenText, FaPlus, FaTrash, FaExternalLinkAlt } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface Settings {
  storefront_enabled?: boolean;
  storefront_tagline?: string;
  storefront_description?: string;
  storefront_primary_color?: string;
  storefront_whatsapp?: string;
  storefront_phone?: string;
  storefront_email?: string;
  storefront_address?: string;
  storefront_city?: string;
  storefront_state?: string;
  storefront_pincode?: string;
  storefront_gstin?: string;
  storefront_business_type?: string;
  storefront_established_year?: number;
  storefront_min_order_qty?: number;
  storefront_delivery_info?: string;
  storefront_return_policy?: string;
  company_code?: string;
}

interface Product {
  id: number;
  product_name: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  is_price_visible: boolean;
  is_featured: boolean;
  is_active: boolean;
  moq: number;
  enquiry_count: number;
  view_count: number;
  live_stock: number;
}

interface Enquiry {
  id: number;
  enquirer_name: string;
  enquirer_phone: string;
  enquirer_city?: string;
  message?: string;
  quantity_needed?: number;
  product_name?: string;
  is_read: boolean;
  created_at: string;
}

const label: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", marginBottom: 5, letterSpacing: 0.3 };
const input: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-soft)", fontSize: 13, boxSizing: "border-box" };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 20, marginBottom: 16 };

const emptyProductForm = { product_name: "", category: "", description: "", min_price: "", max_price: "", is_price_visible: true, is_featured: false, sizes: "", colors: "", moq: "1" };

const StorefrontSettings: React.FC = () => {
  const [tab, setTab] = useState<"settings" | "products" | "enquiries">("settings");
  const [settings, setSettings] = useState<Settings>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productForm, setProductForm] = useState(emptyProductForm);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, eRes] = await Promise.all([
        apiFetch("/manage/storefront/settings"),
        apiFetch("/manage/storefront/products"),
        apiFetch("/manage/storefront/enquiries"),
      ]);
      setSettings(await sRes.json());
      setProducts(await pRes.json());
      setEnquiries(await eRes.json());
    } catch {
      setMsg("Failed to load storefront data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await apiFetch("/manage/storefront/settings", { method: "PUT", body: settings });
      const data = await res.json();
      setMsg(data.success ? "Settings saved." : data.error || "Failed to save.");
    } catch {
      setMsg("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const addProduct = async () => {
    if (!productForm.product_name.trim()) { setMsg("Product name is required."); return; }
    try {
      const res = await apiFetch("/manage/storefront/products", {
        method: "POST",
        body: {
          ...productForm,
          min_price: productForm.min_price ? Number(productForm.min_price) : null,
          max_price: productForm.max_price ? Number(productForm.max_price) : null,
          moq: Number(productForm.moq) || 1,
        },
      });
      const data = await res.json();
      if (data.success) {
        setShowAddProduct(false);
        setProductForm(emptyProductForm);
        loadAll();
      } else {
        setMsg(data.error || "Failed to add product.");
      }
    } catch {
      setMsg("Network error while adding product.");
    }
  };

  const toggleProductField = async (p: Product, field: "is_featured" | "is_active") => {
    await apiFetch(`/manage/storefront/products/${p.id}`, {
      method: "PUT",
      body: { product_name: p.product_name, category: p.category, min_price: p.min_price, max_price: p.max_price, is_price_visible: p.is_price_visible, is_featured: p.is_featured, is_active: p.is_active, moq: p.moq, [field]: !p[field] },
    });
    loadAll();
  };

  const deleteProduct = async (id: number) => {
    if (!window.confirm("Remove this product from the storefront?")) return;
    await apiFetch(`/manage/storefront/products/${id}`, { method: "DELETE" });
    loadAll();
  };

  const markRead = async (id: number) => {
    await apiFetch(`/manage/storefront/enquiries/${id}/read`, { method: "PUT" });
    setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
  };

  const unreadCount = enquiries.filter((e) => !e.is_read).length;
  const storeUrl = settings.company_code ? `${window.location.origin}/store/${settings.company_code.toLowerCase()}` : "";

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>Loading storefront settings…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1><FaStore style={{ marginRight: 10, opacity: 0.7 }} />My Storefront</h1>
          <p>Manage your public product catalog customers can browse and enquire from.</p>
        </div>
        {settings.storefront_enabled && storeUrl && (
          <a href={storeUrl} target="_blank" rel="noreferrer" className="page-btn-round" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <FaExternalLinkAlt size={12} /> View Live Store
          </a>
        )}
      </div>

      {msg && <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{msg}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "settings" as const, label: "⚙️ Settings", icon: <FaStore /> },
          { key: "products" as const, label: `📦 Products (${products.length})`, icon: <FaBoxOpen /> },
          { key: "enquiries" as const, label: `✉️ Enquiries${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`, icon: <FaEnvelopeOpenText /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1.5px solid ${tab === t.key ? "#4f46e5" : "var(--border-soft)"}`,
              background: tab === t.key ? "#4f46e5" : "transparent",
              color: tab === t.key ? "#fff" : "var(--text-2)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Storefront Status</div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {settings.storefront_enabled ? "Live — customers can browse your store." : "Off — the storefront page is hidden."}
                </div>
              </div>
              <button
                onClick={() => setSettings((s) => ({ ...s, storefront_enabled: !s.storefront_enabled }))}
                style={{
                  width: 52, height: 28, borderRadius: 20, border: "none", cursor: "pointer",
                  background: settings.storefront_enabled ? "#16a34a" : "#cbd5e1", position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: settings.storefront_enabled ? 27 : 3, transition: "left 0.2s" }} />
              </button>
            </div>
            {storeUrl && <div style={{ fontSize: 12, color: "var(--text-2)" }}>Your store URL: <span style={{ fontFamily: "monospace", color: "#4f46e5" }}>{storeUrl}</span></div>}
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Store Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Tagline</label>
                <input style={input} value={settings.storefront_tagline || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_tagline: e.target.value }))} placeholder="e.g. Quality garments, direct from factory" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Description</label>
                <textarea rows={3} style={{ ...input, resize: "none" }} value={settings.storefront_description || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_description: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Business Type</label>
                <input style={input} value={settings.storefront_business_type || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_business_type: e.target.value }))} placeholder="e.g. T-Shirt Manufacturer" />
              </div>
              <div>
                <label style={label}>Established Year</label>
                <input type="number" style={input} value={settings.storefront_established_year || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_established_year: Number(e.target.value) || undefined }))} />
              </div>
              <div>
                <label style={label}>Primary Color</label>
                <input type="color" style={{ ...input, padding: 4, height: 38 }} value={settings.storefront_primary_color || "#4f46e5"} onChange={(e) => setSettings((s) => ({ ...s, storefront_primary_color: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Min Order Quantity</label>
                <input type="number" style={input} value={settings.storefront_min_order_qty || 1} onChange={(e) => setSettings((s) => ({ ...s, storefront_min_order_qty: Number(e.target.value) || 1 }))} />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Contact</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={label}>WhatsApp Number</label><input style={input} value={settings.storefront_whatsapp || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_whatsapp: e.target.value }))} placeholder="91XXXXXXXXXX" /></div>
              <div><label style={label}>Phone</label><input style={input} value={settings.storefront_phone || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_phone: e.target.value }))} /></div>
              <div><label style={label}>Email</label><input style={input} value={settings.storefront_email || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_email: e.target.value }))} /></div>
              <div><label style={label}>GSTIN</label><input style={input} value={settings.storefront_gstin || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_gstin: e.target.value }))} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={label}>Address</label><input style={input} value={settings.storefront_address || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_address: e.target.value }))} /></div>
              <div><label style={label}>City</label><input style={input} value={settings.storefront_city || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_city: e.target.value }))} /></div>
              <div><label style={label}>State</label><input style={input} value={settings.storefront_state || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_state: e.target.value }))} /></div>
              <div><label style={label}>Pincode</label><input style={input} value={settings.storefront_pincode || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_pincode: e.target.value }))} /></div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Delivery &amp; Returns</div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Delivery Info</label>
              <textarea rows={2} style={{ ...input, resize: "none" }} value={settings.storefront_delivery_info || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_delivery_info: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Return Policy</label>
              <textarea rows={2} style={{ ...input, resize: "none" }} value={settings.storefront_return_policy || ""} onChange={(e) => setSettings((s) => ({ ...s, storefront_return_policy: e.target.value }))} />
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="page-btn-round-primary" style={{ padding: "12px 28px" }}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      )}

      {tab === "products" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => setShowAddProduct(true)} className="page-btn-round-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FaPlus size={11} /> Add Product
            </button>
          </div>

          {showAddProduct && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>New Storefront Product</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}><label style={label}>Product Name *</label><input style={input} value={productForm.product_name} onChange={(e) => setProductForm((p) => ({ ...p, product_name: e.target.value }))} /></div>
                <div><label style={label}>Category</label><input style={input} value={productForm.category} onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))} /></div>
                <div><label style={label}>MOQ (pieces)</label><input type="number" style={input} value={productForm.moq} onChange={(e) => setProductForm((p) => ({ ...p, moq: e.target.value }))} /></div>
                <div><label style={label}>Min Price (₹)</label><input type="number" style={input} value={productForm.min_price} onChange={(e) => setProductForm((p) => ({ ...p, min_price: e.target.value }))} /></div>
                <div><label style={label}>Max Price (₹)</label><input type="number" style={input} value={productForm.max_price} onChange={(e) => setProductForm((p) => ({ ...p, max_price: e.target.value }))} /></div>
                <div><label style={label}>Sizes</label><input style={input} value={productForm.sizes} onChange={(e) => setProductForm((p) => ({ ...p, sizes: e.target.value }))} placeholder="S, M, L, XL" /></div>
                <div><label style={label}>Colors</label><input style={input} value={productForm.colors} onChange={(e) => setProductForm((p) => ({ ...p, colors: e.target.value }))} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={label}>Description</label><textarea rows={2} style={{ ...input, resize: "none" }} value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} /></div>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={productForm.is_price_visible} onChange={(e) => setProductForm((p) => ({ ...p, is_price_visible: e.target.checked }))} /> Show price publicly</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={productForm.is_featured} onChange={(e) => setProductForm((p) => ({ ...p, is_featured: e.target.checked }))} /> Featured</label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={addProduct} className="page-btn-round-primary">Add Product</button>
                <button onClick={() => { setShowAddProduct(false); setProductForm(emptyProductForm); }} className="page-btn-round">Cancel</button>
              </div>
            </div>
          )}

          <div className="page-table-wrapper">
            <table className="page-table">
              <thead>
                <tr><th>Product</th><th>Category</th><th className="text-right">Price</th><th className="text-center">Featured</th><th className="text-center">Active</th><th className="text-right">Enquiries</th><th className="text-center">Actions</th></tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-3)" }}>No products yet — add your first one above.</td></tr>
                ) : products.map((p) => (
                  <tr key={p.id}>
                    <td className="font-bold">{p.product_name}</td>
                    <td>{p.category || "—"}</td>
                    <td className="text-right">{p.is_price_visible ? `₹${p.min_price || 0}${p.max_price && p.max_price !== p.min_price ? ` – ₹${p.max_price}` : ""}` : "Hidden"}</td>
                    <td className="text-center"><input type="checkbox" checked={p.is_featured} onChange={() => toggleProductField(p, "is_featured")} /></td>
                    <td className="text-center"><input type="checkbox" checked={p.is_active} onChange={() => toggleProductField(p, "is_active")} /></td>
                    <td className="text-right">{p.enquiry_count}</td>
                    <td className="text-center">
                      <button onClick={() => deleteProduct(p.id)} className="page-btn-round-danger" style={{ padding: "6px 10px" }}><FaTrash size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "enquiries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {enquiries.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>No enquiries yet.</div>
          ) : enquiries.map((e) => (
            <div key={e.id} style={{ ...card, marginBottom: 0, background: e.is_read ? "var(--surface)" : "#eff6ff", cursor: e.is_read ? "default" : "pointer" }} onClick={() => !e.is_read && markRead(e.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.enquirer_name} {!e.is_read && <span style={{ fontSize: 10, background: "#4f46e5", color: "#fff", padding: "2px 8px", borderRadius: 20, marginLeft: 8 }}>NEW</span>}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{e.enquirer_phone} {e.enquirer_city ? `· ${e.enquirer_city}` : ""}</div>
                  {e.product_name && <div style={{ fontSize: 12, color: "#4f46e5", marginTop: 4 }}>About: {e.product_name}</div>}
                  {e.quantity_needed && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>Qty needed: {e.quantity_needed}</div>}
                  {e.message && <div style={{ fontSize: 13, marginTop: 6 }}>{e.message}</div>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(e.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StorefrontSettings;
