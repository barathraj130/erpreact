import React from "react";
import { useNavigate } from "react-router-dom";

// Public marketing page for the Fluxora ERP product itself — not tied to any
// single company/tenant. Contact number below is a placeholder; replace with
// the real business WhatsApp/phone before going live.
const CONTACT_PHONE_DISPLAY = "+91 00000 00000";
const CONTACT_PHONE_WA = "910000000000";

const FEATURES = [
  { icon: "🧾", title: "Smart Invoicing", desc: "TAX, NON-TAX, NSB, RETAIL and GIFT bills. GST auto-calculated. WhatsApp delivery instant." },
  { icon: "📦", title: "Fresh & Mistake Inventory", desc: "Track fresh and mistake stock separately, with lot-wise purchase tracking and a production conversion cycle." },
  { icon: "🏬", title: "Multi-Branch POS", desc: "Each branch gets its own billing interface, day close, and cash/bank tracked per branch." },
  { icon: "👥", title: "Customer Ledger", desc: "Every customer gets a complete ledger — outstanding tracking, payment history, credit notes." },
  { icon: "💸", title: "Expense Management", desc: "Strict expense recording with approval workflow, category-wise reports, full audit trail." },
  { icon: "📊", title: "Finance Reports", desc: "P&L, cash flow, receivables aging and GST reports — real-time data, exportable." },
  { icon: "👤", title: "Employee & Payroll", desc: "Daily attendance, weekly salary with advance deduction, and a full employee ledger." },
  { icon: "🤖", title: "AI Business Insights", desc: "AI analyses your data and surfaces practical suggestions to grow profit." },
  { icon: "💬", title: "WhatsApp Automation", desc: "Invoices, payment reminders and updates sent automatically via WhatsApp." },
];

const INDUSTRIES = [
  { icon: "👕", label: "T-Shirt & Knitwear Manufacturers" },
  { icon: "🧵", label: "Surplus & Wholesale Traders" },
  { icon: "🏭", label: "Garment Export Houses" },
  { icon: "🧥", label: "Readymade Garment Shops" },
  { icon: "🪡", label: "Fabric & Yarn Dealers" },
  { icon: "📦", label: "Multi-Branch Textile Businesses" },
];

const PLANS = [
  {
    name: "Starter", price: "₹999", period: "/month", color: "#64748b",
    desc: "For small single-branch shops",
    features: ["Invoicing & Sales", "Basic Inventory", "Customer Management", "Cash & Bank Ledger", "Basic Reports", "3 Users"],
  },
  {
    name: "Growth", price: "₹2,499", period: "/month", color: "#4f46e5", recommended: true,
    desc: "For growing multi-branch businesses",
    features: ["Everything in Starter", "Multi-Branch POS", "GST Reports", "Employee & Payroll", "Expense Tracking", "WhatsApp Automation", "10 Users"],
  },
  {
    name: "Enterprise", price: "₹4,999", period: "/month", color: "#dc2626",
    desc: "For large manufacturers",
    features: ["Everything in Growth", "Production Lots", "AI Business Insights", "Custom Reports", "API Access", "Unlimited Users", "Priority Support"],
  },
];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

const FluxoraLanding: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#fff", minHeight: "100vh", color: "#0f172a" }}>
      {/* NAVBAR */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "0.5px solid #e2e8f0", padding: "0 5%", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 800 }}>F</div>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Fluxora</span>
          <span style={{ fontSize: 11, background: "#eef2ff", color: "#4f46e5", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>ERP</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 14, color: "#64748b" }}>
          {["Features", "Pricing", "Industries"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}>{item}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/company-login")} style={{ padding: "8px 20px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            Login
          </button>
          <button onClick={() => scrollTo("contact")} style={{ padding: "8px 20px", border: "none", borderRadius: 8, background: "#4f46e5", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>
            Get Demo
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "100px 5% 80px", background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%)", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "6px 16px", marginBottom: 24, fontSize: 13, color: "#4f46e5", fontWeight: 600 }}>
          🏭 Built for the Garment &amp; Textile Industry
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.1, maxWidth: 800, margin: "0 auto 20px" }}>
          Run Your Entire Business<span style={{ color: "#4f46e5" }}> From One Place</span>
        </h1>
        <p style={{ fontSize: 20, color: "#64748b", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Fluxora ERP manages invoices, inventory, purchases, expenses, employees, branches and GST — all in one platform built for garment and textile MSMEs.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => scrollTo("contact")} style={{ padding: "16px 32px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Request Free Demo →
          </button>
          <button onClick={() => navigate("/company-login")} style={{ padding: "16px 32px", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Login to ERP
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "80px 5%" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px" }}>Everything your business needs</h2>
          <p style={{ fontSize: 18, color: "#64748b" }}>Built specifically for garment and textile trade</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {FEATURES.map((feat, i) => (
            <div key={i} style={{ padding: 24, borderRadius: 16, border: "1px solid #f1f5f9", background: "#fafafa" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{feat.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{feat.title}</h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INDUSTRIES */}
      <section id="industries" style={{ padding: "80px 5%", background: "#f8fafc" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 12px" }}>Who is Fluxora for?</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          {INDUSTRIES.map((ind, i) => (
            <div key={i} style={{ padding: 20, textAlign: "center", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{ind.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{ind.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 5%" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px" }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 18, color: "#64748b" }}>No hidden charges. Cancel anytime.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, maxWidth: 900, margin: "0 auto" }}>
          {PLANS.map((plan, i) => (
            <div key={i} style={{
              borderRadius: 16, padding: "28px 24px", border: `2px solid ${plan.recommended ? "#4f46e5" : "#e2e8f0"}`,
              background: plan.recommended ? "#eef2ff" : "#fff", position: "relative",
            }}>
              {plan.recommended && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#4f46e5", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 16px", borderRadius: 20 }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: plan.color, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 4 }}>{plan.price}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{plan.period} — {plan.desc}</div>
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                {plan.features.map((f, fi) => (
                  <div key={fi} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button onClick={() => scrollTo("contact")} style={{
                width: "100%", marginTop: 20, padding: 12,
                background: plan.recommended ? "#4f46e5" : "#fff", color: plan.recommended ? "#fff" : "#4f46e5",
                border: "2px solid #4f46e5", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "80px 5%", background: "#0f172a", color: "#fff" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px" }}>Get a Free Demo</h2>
          <p style={{ fontSize: 18, color: "#94a3b8", marginBottom: 40 }}>
            We'll set up the system for your business and train your team — usually ready in 24 hours.
          </p>
          <button
            onClick={() => {
              const msg = encodeURIComponent("Hi Fluxora, I want to request a demo for my business.");
              window.open(`https://wa.me/${CONTACT_PHONE_WA}?text=${msg}`, "_blank");
            }}
            style={{ width: "100%", padding: 16, background: "#25D366", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            💬 Request Demo on WhatsApp
          </button>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Or call directly: <a href={`tel:${CONTACT_PHONE_WA}`} style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>{CONTACT_PHONE_DISPLAY}</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 5%", background: "#020617", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#475569", fontSize: 13, flexWrap: "wrap", gap: 12 }}>
        <div>© {new Date().getFullYear()} Fluxora Technology. All rights reserved.</div>
        <div style={{ display: "flex", gap: 20 }}>
          <a onClick={() => navigate("/company-login")} style={{ color: "#475569", textDecoration: "none", cursor: "pointer" }}>ERP Login</a>
        </div>
      </footer>
    </div>
  );
};

export default FluxoraLanding;
