import React from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/aurora.css";

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
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#fff", minHeight: "100vh", color: "#111827" }}>
      {/* NAVBAR */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "0.5px solid rgba(91,75,255,0.10)", padding: "0 5%", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 68,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #5B4BFF, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 900, boxShadow: "0 4px 14px rgba(91,75,255,0.40)" }}>F</div>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Fluxora</span>
          <span style={{ fontSize: 10, background: "rgba(91,75,255,0.10)", color: "#5B4BFF", padding: "2px 8px", borderRadius: 20, fontWeight: 700, letterSpacing: "0.06em" }}>ERP</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 14, color: "#64748b" }}>
          {["Features", "Pricing", "Industries"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ color: "#64748b", textDecoration: "none", fontWeight: 500, transition: "color 150ms" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >{item}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/company-login")} style={{ padding: "9px 22px", border: "1.5px solid rgba(91,75,255,0.20)", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827" }}>
            Login
          </button>
          <button onClick={() => scrollTo("contact")} style={{ padding: "9px 22px", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #5B4BFF, #7C6CFF)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 4px 14px rgba(91,75,255,0.30)" }}>
            Get Demo →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", padding: "clamp(80px, 10vw, 130px) 5% clamp(80px, 10vw, 110px)", textAlign: "center", overflow: "hidden", background: "#FAFBFF" }}>
        {/* AURORA BLOBS */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "55%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle, rgba(91,75,255,0.10) 0%, transparent 65%)", filter: "blur(70px)", animation: "aurora-slow 22s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", top: "-5%", right: "-5%", width: "45%", height: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)", filter: "blur(80px)", animation: "aurora-slow-reverse 28s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", bottom: "-15%", left: "25%", width: "50%", height: "50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,108,255,0.06) 0%, transparent 60%)", filter: "blur(90px)" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(91,75,255,0.08)", border: "0.5px solid rgba(91,75,255,0.25)", borderRadius: 20, padding: "7px 18px", marginBottom: 32, fontSize: 13, color: "#5B4BFF", fontWeight: 600 }}>
            🏭 Built for the Garment &amp; Textile Industry
          </div>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 900, color: "#111827", margin: "0 auto 24px", lineHeight: 1.08, maxWidth: 800, letterSpacing: "-0.02em" }}>
            Run Your Entire Business
            <br />
            <span style={{ background: "linear-gradient(135deg, #5B4BFF 0%, #8B5CF6 50%, #7C6CFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block" }}>
              From One Place.
            </span>
          </h1>
          <p style={{ fontSize: 18, color: "#64748b", maxWidth: 600, margin: "0 auto 44px", lineHeight: 1.75 }}>
            Fluxora ERP manages invoices, inventory, purchases, expenses, employees, branches and GST — all in one platform built for garment and textile MSMEs.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => scrollTo("contact")} style={{ padding: "15px 36px", background: "linear-gradient(135deg, #5B4BFF, #7C6CFF)", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 24px rgba(91,75,255,0.40)", transition: "all 150ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(91,75,255,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(91,75,255,0.40)"; e.currentTarget.style.transform = "none"; }}
            >
              Request Free Demo →
            </button>
            <button onClick={() => navigate("/company-login")} style={{ padding: "15px 36px", background: "#fff", color: "#111827", border: "1.5px solid rgba(91,75,255,0.25)", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(91,75,255,0.08)", transition: "all 150ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(91,75,255,0.5)"; e.currentTarget.style.color = "#5B4BFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(91,75,255,0.25)"; e.currentTarget.style.color = "#111827"; }}
            >
              Login to ERP
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "80px 5%" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>Everything your business needs</h2>
          <p style={{ fontSize: 18, color: "#64748b" }}>Built specifically for garment and textile trade</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {FEATURES.map((feat, i) => (
            <div key={i} style={{ padding: 24, borderRadius: 16, border: "0.5px solid rgba(91,75,255,0.08)", background: "#fafbff", boxShadow: "0 2px 10px rgba(15,23,42,0.03)", transition: "all 200ms ease", cursor: "default" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(91,75,255,0.12)"; e.currentTarget.style.borderColor = "rgba(91,75,255,0.20)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(15,23,42,0.03)"; e.currentTarget.style.borderColor = "rgba(91,75,255,0.08)"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{feat.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{feat.title}</h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INDUSTRIES */}
      <section id="industries" style={{ padding: "80px 5%", background: "#F4F7FB" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>Who is Fluxora for?</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          {INDUSTRIES.map((ind, i) => (
            <div key={i} style={{ padding: 20, textAlign: "center", borderRadius: 14, background: "#fff", border: "0.5px solid rgba(91,75,255,0.08)", boxShadow: "0 2px 10px rgba(15,23,42,0.03)", transition: "all 200ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(91,75,255,0.10)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(15,23,42,0.03)"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{ind.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{ind.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 5%" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 18, color: "#64748b" }}>No hidden charges. Cancel anytime.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, maxWidth: 960, margin: "0 auto" }}>
          {PLANS.map((plan, i) => (
            <div key={i} style={{
              borderRadius: 20, padding: "32px 28px", border: plan.recommended ? "1.5px solid rgba(91,75,255,0.45)" : "0.5px solid rgba(15,23,42,0.08)",
              background: plan.recommended ? "linear-gradient(180deg, rgba(91,75,255,0.05), #fff 60%)" : "#fff", position: "relative",
              boxShadow: plan.recommended ? "0 16px 40px rgba(91,75,255,0.14)" : "0 2px 10px rgba(15,23,42,0.03)",
            }}>
              {plan.recommended && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #5B4BFF, #8B5CF6)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 16px", borderRadius: 20, letterSpacing: "0.04em" }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: plan.color, marginBottom: 6 }}>{plan.name}</div>
              <div style={{ fontSize: 38, fontWeight: 900, marginBottom: 4, letterSpacing: "-0.02em" }}>{plan.price}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{plan.period} — {plan.desc}</div>
              <div style={{ borderTop: "0.5px solid rgba(15,23,42,0.08)", paddingTop: 20 }}>
                {plan.features.map((f, fi) => (
                  <div key={fi} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginBottom: 10, color: "#334155" }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(16,185,129,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button onClick={() => scrollTo("contact")} style={{
                width: "100%", marginTop: 22, padding: 13,
                background: plan.recommended ? "linear-gradient(135deg, #5B4BFF, #7C6CFF)" : "#fff", color: plan.recommended ? "#fff" : "#5B4BFF",
                border: "1.5px solid rgba(91,75,255,0.35)", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: plan.recommended ? "0 6px 20px rgba(91,75,255,0.35)" : "none", transition: "all 150ms ease",
              }}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ position: "relative", padding: "80px 5%", background: "#070B16", color: "#fff", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-20%", left: "20%", width: "50%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(91,75,255,0.14) 0%, transparent 65%)", filter: "blur(80px)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>Get a Free Demo</h2>
          <p style={{ fontSize: 18, color: "#94a3b8", marginBottom: 40 }}>
            We'll set up the system for your business and train your team — usually ready in 24 hours.
          </p>
          <button
            onClick={() => {
              const msg = encodeURIComponent("Hi Fluxora, I want to request a demo for my business.");
              window.open(`https://wa.me/${CONTACT_PHONE_WA}?text=${msg}`, "_blank");
            }}
            style={{ width: "100%", padding: 16, background: "#25D366", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12, boxShadow: "0 8px 24px rgba(37,211,102,0.30)" }}
          >
            💬 Request Demo on WhatsApp
          </button>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Or call directly: <a href={`tel:${CONTACT_PHONE_WA}`} style={{ color: "#7C6CFF", textDecoration: "none", fontWeight: 600 }}>{CONTACT_PHONE_DISPLAY}</a>
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
