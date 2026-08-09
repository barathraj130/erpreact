import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../utils/api";

interface StoreInfo {
  id: number;
  company_name: string;
  company_code: string;
  storefront_enabled: boolean;
  storefront_tagline?: string;
  storefront_description?: string;
  storefront_logo_url?: string;
  storefront_banner_url?: string;
  storefront_primary_color?: string;
  storefront_whatsapp?: string;
  storefront_phone?: string;
  storefront_email?: string;
  storefront_address?: string;
  storefront_city?: string;
  storefront_pincode?: string;
  storefront_gstin?: string;
  storefront_business_type?: string;
  storefront_established_year?: number;
  storefront_min_order_qty?: number;
}

interface Product {
  id: number;
  product_name: string;
  description?: string;
  category?: string;
  images?: string[];
  min_price?: number;
  max_price?: number;
  is_price_visible: boolean;
  is_featured: boolean;
  moq: number;
  sizes?: string;
  live_stock: number;
}

interface Category { category: string; product_count: number; }

const fmtPrice = (p: Product) => {
  const min = Number(p.min_price) || 0;
  const max = Number(p.max_price) || 0;
  if (min && max && min !== max) return `₹${min} – ₹${max}`;
  return `₹${min || max}`;
};

const waLink = (phone?: string) => phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "";

const ProductCard: React.FC<{ product: Product; primaryColor: string; onEnquire: () => void; onClick: () => void }> = ({ product, primaryColor, onEnquire, onClick }) => (
  <div
    style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #f1f5f9", cursor: "pointer" }}
    onClick={onClick}
  >
    <div style={{ height: 180, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, position: "relative" }}>
      {product.images && product.images[0] ? (
        <img src={product.images[0]} alt={product.product_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : "👕"}
      {product.is_featured && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>FEATURED</div>
      )}
      {product.live_stock > 0 ? (
        <div style={{ position: "absolute", top: 8, left: 8, background: "#dcfce7", color: "#166534", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>IN STOCK</div>
      ) : (
        <div style={{ position: "absolute", top: 8, left: 8, background: "#fef2f2", color: "#dc2626", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>ENQUIRE</div>
      )}
    </div>
    <div style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{product.product_name}</div>
      {product.category && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{product.category}</div>}
      {product.sizes && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Sizes: {product.sizes}</div>}
      {product.is_price_visible && (product.min_price || product.max_price) && (
        <div style={{ fontSize: 16, fontWeight: 800, color: primaryColor, marginBottom: 8 }}>
          {fmtPrice(product)}
          {product.moq > 1 && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}> / min {product.moq}pc</span>}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onEnquire(); }}
        style={{ width: "100%", padding: 10, background: primaryColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        Enquire Now
      </button>
    </div>
  </div>
);

const EnquiryModal: React.FC<{
  product: Product | null; storeInfo: StoreInfo; primaryColor: string; slug: string; onClose: () => void;
}> = ({ product, storeInfo, primaryColor, slug, onClose }) => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", message: "", quantity_needed: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!form.name || !form.phone) { setErr("Name and phone are required"); return; }
    setErr("");
    setSending(true);
    try {
      const res = await apiFetch(`/storefront/${slug}/enquiry`, {
        method: "POST",
        body: { ...form, quantity_needed: form.quantity_needed ? Number(form.quantity_needed) : undefined, product_id: product?.id },
      });
      const data = await res.json();
      if (data.success) setSent(true);
      else setErr(data.error || "Failed to send enquiry");
    } catch {
      setErr("Network error — please try again");
    } finally {
      setSending(false);
    }
  };

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 };
  const input: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Enquiry Sent!</h3>
            <p style={{ color: "#64748b", marginBottom: 24 }}>{storeInfo.company_name} will contact you soon on {form.phone}.</p>
            {storeInfo.storefront_whatsapp && (
              <a
                href={`${waLink(storeInfo.storefront_whatsapp)}?text=${encodeURIComponent(`Hi, I enquired about ${product?.product_name || "your products"}`)}`}
                target="_blank" rel="noreferrer"
                style={{ display: "inline-block", padding: "12px 24px", background: "#25D366", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 700, marginBottom: 12 }}
              >
                💬 Chat on WhatsApp
              </a>
            )}
            <br />
            <button onClick={onClose} style={{ padding: "10px 24px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Enquire Now</h3>
                {product && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>About: {product.product_name}</div>}
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#64748b" }}>×</button>
            </div>
            {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={label}>Your Name *</label><input style={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
              <div><label style={label}>Phone Number *</label><input style={input} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" /></div>
              <div><label style={label}>Email</label><input style={input} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="optional" /></div>
              <div><label style={label}>City</label><input style={input} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Where are you from" /></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Quantity Needed</label>
              <input type="number" style={input} value={form.quantity_needed} onChange={(e) => setForm((p) => ({ ...p, quantity_needed: e.target.value }))} placeholder="How many pieces?" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Message</label>
              <textarea rows={3} style={{ ...input, resize: "none" }} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Any specific requirements, sizes, colors..." />
            </div>
            <button
              onClick={handleSubmit} disabled={sending}
              style={{ width: "100%", padding: 14, background: sending ? "#94a3b8" : primaryColor, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer" }}
            >
              {sending ? "Sending..." : "Send Enquiry →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const StorePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [enquiryProduct, setEnquiryProduct] = useState<Product | null | "general">(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [storeRes, productsRes, catsRes] = await Promise.all([
          apiFetch(`/storefront/${slug}`),
          apiFetch(`/storefront/${slug}/products`),
          apiFetch(`/storefront/${slug}/categories`),
        ]);
        if (cancelled) return;
        if (!storeRes.ok) { setNotFound(true); return; }
        setStore(await storeRes.json());
        setProducts(await productsRes.json());
        setCategories(await catsRes.json());
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontSize: 16, color: "#64748b" }}>Loading store…</div>;

  if (notFound || !store) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏪</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Store not found</h2>
      <p style={{ color: "#64748b" }}>This storefront doesn't exist or isn't active right now.</p>
    </div>
  );

  const primaryColor = store.storefront_primary_color || "#4f46e5";
  const featured = products.filter((p) => p.is_featured);
  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch = !search || p.product_name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <header style={{ background: primaryColor, color: "#fff", padding: "0 5%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 70 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {store.storefront_logo_url ? (
              <img src={store.storefront_logo_url} alt={store.company_name} style={{ height: 44, borderRadius: 8 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>
                {store.company_name.charAt(0)}
              </div>
            )}
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{store.company_name}</div>
              {store.storefront_tagline && <div style={{ fontSize: 13, opacity: 0.85 }}>{store.storefront_tagline}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {store.storefront_whatsapp && (
              <a href={waLink(store.storefront_whatsapp)} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#25D366", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>💬 WhatsApp</a>
            )}
            {store.storefront_phone && (
              <a href={`tel:${store.storefront_phone}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>📞 Call</a>
            )}
          </div>
        </div>
      </header>

      {store.storefront_banner_url ? (
        <div style={{ height: 260, overflow: "hidden" }}><img src={store.storefront_banner_url} alt="banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
      ) : (
        <div style={{ padding: "40px 5%", background: `${primaryColor}15`, borderBottom: `1px solid ${primaryColor}30` }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 8px" }}>{store.company_name}</h1>
          {store.storefront_description && <p style={{ fontSize: 16, color: "#64748b", margin: "0 0 16px", maxWidth: 600 }}>{store.storefront_description}</p>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#64748b" }}>
            {store.storefront_city && <span>📍 {store.storefront_city}</span>}
            {store.storefront_business_type && <span>🏭 {store.storefront_business_type}</span>}
            {store.storefront_established_year && <span>📅 Est. {store.storefront_established_year}</span>}
            {(store.storefront_min_order_qty || 0) > 1 && <span>📦 Min order: {store.storefront_min_order_qty} pcs</span>}
          </div>
        </div>
      )}

      {featured.length > 0 && (
        <div style={{ padding: "32px 5% 0" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>⭐ Featured Products</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 32 }}>
            {featured.map((p) => <ProductCard key={p.id} product={p} primaryColor={primaryColor} onEnquire={() => setEnquiryProduct(p)} onClick={() => setEnquiryProduct(p)} />)}
          </div>
        </div>
      )}

      <div style={{ padding: "24px 5% 0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "10px 16px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, background: "#fff" }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedCategory("all")} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1.5px solid ${selectedCategory === "all" ? primaryColor : "#e2e8f0"}`, background: selectedCategory === "all" ? primaryColor : "#fff", color: selectedCategory === "all" ? "#fff" : "#64748b", cursor: "pointer" }}>
            All ({products.length})
          </button>
          {categories.map((cat) => (
            <button key={cat.category} onClick={() => setSelectedCategory(cat.category)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1.5px solid ${selectedCategory === cat.category ? primaryColor : "#e2e8f0"}`, background: selectedCategory === cat.category ? primaryColor : "#fff", color: selectedCategory === cat.category ? "#fff" : "#64748b", cursor: "pointer" }}>
              {cat.category} ({cat.product_count})
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 5% 60px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16 }}>No products found</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
            {filtered.map((p) => <ProductCard key={p.id} product={p} primaryColor={primaryColor} onEnquire={() => setEnquiryProduct(p)} onClick={() => setEnquiryProduct(p)} />)}
          </div>
        )}
      </div>

      <footer style={{ background: "#0f172a", color: "#94a3b8", padding: "32px 5%", fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>{store.company_name}</div>
            {store.storefront_address && <div>{store.storefront_address}</div>}
            {store.storefront_city && <div>{store.storefront_city} {store.storefront_pincode}</div>}
            {store.storefront_gstin && <div>GSTIN: {store.storefront_gstin}</div>}
          </div>
          <div>
            {store.storefront_phone && <div>📞 {store.storefront_phone}</div>}
            {store.storefront_email && <div>✉️ {store.storefront_email}</div>}
            {store.storefront_whatsapp && (
              <a href={waLink(store.storefront_whatsapp)} target="_blank" rel="noreferrer" style={{ color: "#25D366", textDecoration: "none" }}>💬 Chat on WhatsApp</a>
            )}
          </div>
        </div>
        <div style={{ borderTop: "1px solid #1e293b", marginTop: 24, paddingTop: 16, textAlign: "center", fontSize: 12, color: "#475569" }}>
          Powered by <a href="/" style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>Fluxora ERP</a>
        </div>
      </footer>

      {enquiryProduct && slug && (
        <EnquiryModal
          product={enquiryProduct === "general" ? null : enquiryProduct}
          storeInfo={store}
          primaryColor={primaryColor}
          slug={slug}
          onClose={() => setEnquiryProduct(null)}
        />
      )}
    </div>
  );
};

export default StorePage;
