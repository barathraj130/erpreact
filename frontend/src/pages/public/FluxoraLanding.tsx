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
  const styles: Record<string, React.CSSProperties> = {
    page: { fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", background: "#0A0A0F", color: "#F5F0E8", minHeight: "100vh", overflowX: "hidden" },
    nav: { position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", height: 68, background: "rgba(10,10,15,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "2px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 0 rgba(91,75,255,0.15)" },
    logoWrap: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
    logoIcon: { width: 40, height: 40, background: "#5B4BFF", border: "2px solid #000", boxShadow: "3px 3px 0px #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff", flexShrink: 0, transition: "transform 150ms", cursor: "pointer" },
    logoName: { fontSize: 20, fontWeight: 800, color: "#F5F0E8", letterSpacing: "-0.02em" },
    logoBadge: { fontSize: 9, fontWeight: 900, background: "#5B4BFF", color: "#fff", padding: "2px 7px", border: "1.5px solid #000", letterSpacing: "0.10em", textTransform: "uppercase" },
    navLinks: { display: "flex", gap: 32, fontSize: 14, color: "rgba(245,240,232,0.65)", fontWeight: 500 },
    navLink: { color: "rgba(245,240,232,0.65)", textDecoration: "none", fontWeight: 500, transition: "color 150ms", cursor: "pointer" },
    navActions: { display: "flex", gap: 10, alignItems: "center" },
    btnLogin: { padding: "9px 20px", background: "transparent", color: "#F5F0E8", border: "2px solid rgba(255,255,255,0.18)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.02em", transition: "all 150ms", boxShadow: "2px 2px 0px rgba(255,255,255,0.08)" },
    btnDemo: { padding: "9px 22px", background: "#5B4BFF", color: "#fff", border: "2px solid #000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.02em", boxShadow: "4px 4px 0px #000", transition: "all 150ms" },
    hero: { position: "relative", padding: "clamp(80px,10vw,130px) 6% clamp(80px,10vw,120px)", textAlign: "center", overflow: "hidden", minHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 },
    heroGrid: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(91,75,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(91,75,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none", zIndex: 0 },
    heroGlow1: { position: "absolute", top: "-15%", left: "-5%", width: "55%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle, rgba(91,75,255,0.18) 0%, transparent 65%)", filter: "blur(80px)", pointerEvents: "none", animation: "heroGlow 20s ease-in-out infinite alternate" },
    heroGlow2: { position: "absolute", bottom: "-10%", right: "-5%", width: "45%", height: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)", filter: "blur(90px)", pointerEvents: "none", animation: "heroGlow 25s ease-in-out infinite alternate-reverse" },
    heroBadge: { display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(91,75,255,0.12)", border: "2px solid rgba(91,75,255,0.35)", padding: "7px 18px", fontSize: 12, fontWeight: 800, color: "#A78BFA", marginBottom: 32, letterSpacing: "0.06em", textTransform: "uppercase", position: "relative", zIndex: 1, boxShadow: "3px 3px 0px rgba(91,75,255,0.25)", animation: "fadeUp 500ms both" },
    heroHeadline: { fontSize: "clamp(44px, 7vw, 88px)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", margin: "0 0 16px", position: "relative", zIndex: 1, color: "#F5F0E8", animation: "fadeUp 500ms 80ms both", maxWidth: 900 },
    heroHighlight: { color: "#5B4BFF", position: "relative", display: "inline-block", WebkitTextStroke: "1px rgba(91,75,255,0.3)" },
    heroUnderline: { position: "absolute", bottom: -4, left: 0, right: 0, height: 6, background: "#5B4BFF", boxShadow: "3px 3px 0px #000" },
    heroSub: { fontSize: "clamp(16px, 2vw, 20px)", color: "rgba(245,240,232,0.60)", maxWidth: 580, lineHeight: 1.7, margin: "0 0 48px", position: "relative", zIndex: 1, animation: "fadeUp 500ms 160ms both" },
    heroActions: { display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1, animation: "fadeUp 500ms 240ms both" },
    heroBtnPrimary: { padding: "16px 36px", background: "#5B4BFF", color: "#fff", border: "2px solid #000", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.02em", boxShadow: "5px 5px 0px #000", transition: "all 150ms", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 },
    heroBtnSecondary: { padding: "15px 34px", background: "transparent", color: "#F5F0E8", border: "2px solid rgba(255,255,255,0.25)", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.02em", boxShadow: "3px 3px 0px rgba(255,255,255,0.08)", transition: "all 150ms", display: "inline-flex", alignItems: "center", gap: 8 },
    heroStats: { display: "flex", gap: 48, justifyContent: "center", marginTop: 64, flexWrap: "wrap", position: "relative", zIndex: 1, animation: "fadeUp 500ms 320ms both", paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.06)" },
    statItem: { textAlign: "center" },
    statValue: { fontSize: 36, fontWeight: 900, color: "#5B4BFF", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" },
    statLabel: { fontSize: 12, color: "rgba(245,240,232,0.45)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" },
    featuresSection: { padding: "100px 6%", background: "#0D1117", borderTop: "2px solid rgba(255,255,255,0.06)" },
    sectionEyebrow: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 800, color: "#5B4BFF", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12, display: "block" },
    sectionTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 900, color: "#F5F0E8", letterSpacing: "-0.03em", margin: "0 0 16px", lineHeight: 1.05 },
    sectionSub: { fontSize: 17, color: "rgba(245,240,232,0.55)", maxWidth: 560, lineHeight: 1.7, margin: "0 auto 60px" },
    featureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, maxWidth: 1200, margin: "0 auto" },
    featureCard: { background: "#111827", border: "2px solid rgba(255,255,255,0.10)", borderLeft: "4px solid #5B4BFF", padding: 24, boxShadow: "4px 4px 0px rgba(0,0,0,0.5)", transition: "all 200ms", cursor: "default", position: "relative", overflow: "hidden" },
    featureIcon: { fontSize: 32, marginBottom: 14, display: "block", transition: "transform 200ms" },
    featureTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 800, color: "#F5F0E8", margin: "0 0 8px", letterSpacing: "-0.01em" },
    featureDesc: { fontSize: 13, color: "rgba(245,240,232,0.55)", lineHeight: 1.65, margin: 0 },
    pricingSection: { padding: "100px 6%", background: "#0A0A0F", borderTop: "2px solid rgba(255,255,255,0.06)", textAlign: "center" },
    pricingGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto" },
    pricingCard: { background: "#111827", border: "2px solid rgba(255,255,255,0.10)", padding: "32px 28px", boxShadow: "4px 4px 0px rgba(0,0,0,0.6)", transition: "all 200ms", textAlign: "left", position: "relative" },
    pricingCardRecommended: { background: "#111827", border: "2px solid #5B4BFF", borderTop: "4px solid #5B4BFF", padding: "32px 28px", boxShadow: "6px 6px 0px rgba(91,75,255,0.35)", textAlign: "left", position: "relative" },
    pricingBadge: { position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#5B4BFF", color: "#fff", fontSize: 10, fontWeight: 900, padding: "4px 16px", border: "2px solid #000", letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" },
    pricingPlan: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 800, color: "#5B4BFF", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 },
    pricingPrice: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 900, color: "#F5F0E8", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 },
    pricingPeriod: { fontSize: 13, color: "rgba(245,240,232,0.45)", marginBottom: 20 },
    pricingDivider: { height: 1, background: "rgba(255,255,255,0.08)", margin: "20px 0" },
    pricingFeature: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(245,240,232,0.75)", marginBottom: 10, fontWeight: 500 },
    pricingCheck: { width: 18, height: 18, background: "rgba(0,230,118,0.15)", border: "1.5px solid #00E676", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#00E676", fontWeight: 900, flexShrink: 0 },
    pricingBtn: { width: "100%", marginTop: 24, padding: 13, background: "#5B4BFF", color: "#fff", border: "2px solid #000", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "3px 3px 0px #000", transition: "all 150ms", letterSpacing: "0.04em" },
    pricingBtnOutline: { width: "100%", marginTop: 24, padding: 12, background: "transparent", color: "#F5F0E8", border: "2px solid rgba(255,255,255,0.18)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "2px 2px 0px rgba(255,255,255,0.08)", transition: "all 150ms" },
    ctaSection: { padding: "100px 6%", background: "#0D1117", borderTop: "2px solid rgba(255,255,255,0.06)", textAlign: "center", position: "relative", overflow: "hidden" },
    footer: { background: "#050508", borderTop: "2px solid rgba(255,255,255,0.08)", padding: "48px 6% 32px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 32, fontSize: 13 },
    footerNote: { marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(245,240,232,0.30)", textAlign: "center", width: "100%" },
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heroGlow { 0% { transform: translate(0,0) scale(1); opacity:0.8; } 50% { transform: translate(30px,20px) scale(1.06); opacity:1; } 100% { transform: translate(-15px,35px) scale(0.95); opacity:0.75; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .neo-feature-card:hover { transform: translate(-3px,-3px); box-shadow: 7px 7px 0px rgba(0,0,0,0.7) !important; border-left-color: #7C6CFF !important; }
        .neo-feature-card:hover .feature-icon { transform: scale(1.15) rotate(-6deg); }
        .neo-pricing-card:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0px rgba(0,0,0,0.7) !important; }
        .neo-btn-hero-primary:hover { transform: translate(-3px,-3px); box-shadow: 8px 8px 0px #000 !important; }
        .neo-btn-hero-primary:active { transform: translate(3px,3px); box-shadow: 2px 2px 0px #000 !important; }
        .neo-btn-hero-secondary:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0px rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.40) !important; }
        .neo-nav-login:hover { border-color: rgba(255,255,255,0.35) !important; color: #fff !important; }
        .neo-nav-demo:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0px #000 !important; }
        @media (max-width: 768px) {
          .hero-actions-wrap { flex-direction: column; align-items: stretch; }
          .hero-stats-wrap { gap: 28px !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none; }
          .footer-inner { flex-direction: column; }
        }
      `}</style>

      <nav style={styles.nav}>
        <a href="/" style={styles.logoWrap}>
          <div
            style={styles.logoIcon}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "rotate(-6deg) scale(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
          >
            F
          </div>
          <span style={styles.logoName}>Fluxora</span>
          <span style={styles.logoBadge}>ERP</span>
        </a>

        <div style={styles.navLinks} className="nav-links">
          {["Features", "Pricing", "Industries"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              style={styles.navLink}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F5F0E8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.65)")}
            >
              {item}
            </a>
          ))}
        </div>

        <div style={styles.navActions}>
          <button className="neo-nav-login" onClick={() => navigate("/company-login")} style={styles.btnLogin}>
            Login
          </button>
          <button className="neo-nav-demo" onClick={() => scrollTo("demo")} style={styles.btnDemo}>
            Get Demo →
          </button>
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroGrid} />
        <div style={styles.heroGlow1} />
        <div style={styles.heroGlow2} />

        <div style={styles.heroBadge}>🏭 Built for the Garment &amp; Textile Industry</div>

        <h1 style={styles.heroHeadline}>
          Run Your Entire Business{" "}
          <span style={styles.heroHighlight}>
            From One Place.
            <span style={styles.heroUnderline} />
          </span>
        </h1>

        <p style={styles.heroSub}>
          Fluxora brings finance, inventory, purchases, sales, employees, branches and GST into one connected ERP
          platform built for garment and textile MSMEs.
        </p>

        <div style={styles.heroActions} className="hero-actions-wrap">
          <button className="neo-btn-hero-primary" style={styles.heroBtnPrimary} onClick={() => scrollTo("demo")}>
            Request Free Demo →
          </button>
          <button className="neo-btn-hero-secondary" style={styles.heroBtnSecondary} onClick={() => navigate("/company-login")}>
            Login to ERP
          </button>
        </div>

        <div style={styles.heroStats} className="hero-stats-wrap">
          {[
            { value: "25+", label: "Active Businesses" },
            { value: "50K+", label: "Invoices Generated" },
            { value: "8+", label: "Cities" },
            { value: "99.9%", label: "Uptime" },
          ].map((stat, i) => (
            <div key={i} style={styles.statItem}>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" style={styles.featuresSection}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <span style={styles.sectionEyebrow}>What you get</span>
          <h2 style={styles.sectionTitle}>Everything Your Business Needs</h2>
          <p style={styles.sectionSub}>One platform. Every operation. One source of truth.</p>
        </div>

        <div style={styles.featureGrid} className="features-grid">
          {[
            { icon: "🧾", title: "Sales & Invoicing", desc: "TAX, NON-TAX, NSB, RETAIL, GIFT bills. GST auto-calculated. WhatsApp delivery." },
            { icon: "📦", title: "Inventory Management", desc: "Fresh and mistake stock tracking. Lot-wise purchases. Real-time levels." },
            { icon: "🛒", title: "Purchase Management", desc: "Supplier bills, lot purchases, payment tracking per supplier." },
            { icon: "🇮🇳", title: "GST & Tax Reports", desc: "GSTR-1, GSTR-3B. CGST, SGST, IGST. One-click export." },
            { icon: "👤", title: "Employee Management", desc: "Records, roles, departments, documents, full history." },
            { icon: "💰", title: "Payroll & Salary", desc: "Weekly salary processing with advance deduction tracking." },
            { icon: "🏬", title: "Branch Management", desc: "Multi-branch POS billing. Per-branch cash and bank tracking." },
            { icon: "💸", title: "Expense Tracking", desc: "Strict recording with category and approval workflow." },
            { icon: "📊", title: "Finance Reports", desc: "P&L, Cash Flow, Balance Sheet, Product Movement reports." },
            { icon: "🤝", title: "Debt Settlements", desc: "Settle outstanding via goods, assets, cheques, or mixed." },
            { icon: "💬", title: "WhatsApp Automation", desc: "Invoices, reminders, and alerts via WhatsApp automatically." },
            { icon: "🔐", title: "User Permissions", desc: "Granular per-module, per-action role-based access control." },
          ].map((feat, i) => (
            <div key={i} className="neo-feature-card" style={styles.featureCard}>
              <span className="feature-icon" style={styles.featureIcon}>{feat.icon}</span>
              <h3 style={styles.featureTitle}>{feat.title}</h3>
              <p style={styles.featureDesc}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="industries" style={{ ...styles.pricingSection, background: "#0D1117", borderTop: "2px solid rgba(255,255,255,0.06)" }}>
        <span style={styles.sectionEyebrow}>Who it's for</span>
        <h2 style={styles.sectionTitle}>Built for Your Industry</h2>
        <div style={{ ...styles.featureGrid, marginTop: 48 }} className="features-grid">
          {[
            { icon: "👕", name: "Garment & Textile", desc: "Wholesale and retail garment trading with multi-branch billing." },
            { icon: "📦", name: "Surplus Trading", desc: "Bulk surplus stock, lot purchases, and resale management." },
            { icon: "🏭", name: "Manufacturing", desc: "Production lots, fresh/mistake tracking, conversion cycle." },
            { icon: "🚢", name: "Export Houses", desc: "GST invoicing, IGST, customer ledgers, delivery orders." },
            { icon: "🚚", name: "Wholesale Distribution", desc: "Multi-branch distribution with customer credit management." },
            { icon: "🏪", name: "Retail Chains", desc: "POS billing, daily sales, branch-wise performance reports." },
          ].map((ind, i) => (
            <div key={i} className="neo-feature-card" style={{ ...styles.featureCard, borderLeft: "4px solid rgba(91,75,255,0.5)" }}>
              <span className="feature-icon" style={{ ...styles.featureIcon, fontSize: 36 }}>{ind.icon}</span>
              <h3 style={styles.featureTitle}>{ind.name}</h3>
              <p style={styles.featureDesc}>{ind.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" style={styles.pricingSection}>
        <span style={styles.sectionEyebrow}>Pricing</span>
        <h2 style={styles.sectionTitle}>Simple Transparent Pricing</h2>
        <p style={styles.sectionSub}>No hidden charges. Cancel anytime.</p>

        <div style={styles.pricingGrid} className="pricing-grid">
          {[
            { name: "Starter", price: "₹999", period: "per month", recommended: false, features: ["Invoicing & Sales", "Basic Inventory", "Customer Management", "Cash & Bank Ledger", "Basic Reports", "Up to 3 Users"] },
            { name: "Growth", price: "₹2,499", period: "per month", recommended: true, features: ["Everything in Starter", "Multi-Branch POS", "GST Reports", "Employee & Payroll", "Expense Tracking", "WhatsApp Automation", "Up to 10 Users"] },
            { name: "Enterprise", price: "₹4,999", period: "per month", recommended: false, features: ["Everything in Growth", "Production Lots", "Debt Settlements", "AI Business Insights", "Custom Reports", "API Access", "Unlimited Users"] },
          ].map((plan, i) => (
            <div key={i} className="neo-pricing-card" style={plan.recommended ? styles.pricingCardRecommended : styles.pricingCard}>
              {plan.recommended && <div style={styles.pricingBadge}>★ Most Popular</div>}
              <div style={styles.pricingPlan}>{plan.name}</div>
              <div style={styles.pricingPrice}>{plan.price}</div>
              <div style={styles.pricingPeriod}>{plan.period}</div>
              <div style={styles.pricingDivider} />
              {plan.features.map((f, fi) => (
                <div key={fi} style={styles.pricingFeature}>
                  <div style={styles.pricingCheck}>✓</div>
                  {f}
                </div>
              ))}
              <button className="neo-nav-demo" style={plan.recommended ? styles.pricingBtn : styles.pricingBtnOutline} onClick={() => scrollTo("demo")}>
                {plan.recommended ? "Get Started →" : "Start Free Trial"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" style={styles.ctaSection}>
        <div style={{ ...styles.heroGlow1, position: "absolute", opacity: 0.6 }} />
        <span style={styles.sectionEyebrow}>Get Started</span>
        <h2 style={{ ...styles.sectionTitle, maxWidth: 700, margin: "0 auto 16px" }}>
          Ready to Run Your Business<br />the Fluxora Way?
        </h2>
        <p style={{ ...styles.sectionSub, marginBottom: 40 }}>
          Everything connected. Everything visible. Everything under control.
        </p>

        <div style={{ maxWidth: 480, margin: "0 auto", background: "#111827", border: "2px solid rgba(255,255,255,0.10)", boxShadow: "6px 6px 0px rgba(91,75,255,0.25)", padding: 32 }}>
          {[
            { placeholder: "Your Name *", type: "text", key: "name" },
            { placeholder: "Company Name", type: "text", key: "company" },
            { placeholder: "Phone Number *", type: "tel", key: "phone" },
            { placeholder: "Email Address *", type: "email", key: "email" },
          ].map((field) => (
            <input
              key={field.key}
              type={field.type}
              placeholder={field.placeholder}
              style={{
                width: "100%",
                padding: "12px 16px",
                marginBottom: 12,
                background: "#0A0A0F",
                border: "1.5px solid rgba(255,255,255,0.12)",
                color: "#F5F0E8",
                fontSize: 13,
                fontFamily: "'Space Grotesk',sans-serif",
                outline: "none",
                boxSizing: "border-box",
                boxShadow: "inset 3px 3px 8px rgba(0,0,0,0.4)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(91,75,255,0.6)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          ))}

          <button
            className="neo-nav-demo"
            style={{ ...styles.pricingBtn, fontSize: 15, padding: 14, letterSpacing: "0.02em" }}
            onClick={() => {
              const msg = encodeURIComponent("Hi Fluxora, I want to request a demo for my business.");
              window.open(`https://wa.me/${CONTACT_PHONE_WA}?text=${msg}`, "_blank");
            }}
          >
            💬 Request Demo on WhatsApp
          </button>

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "rgba(245,240,232,0.35)" }}>
            Or call directly:{" "}
            <a href={`tel:${CONTACT_PHONE_WA}`} style={{ color: "#7C6CFF", textDecoration: "none", fontWeight: 700 }}>
              {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      <footer style={styles.footer} className="footer-inner">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ ...styles.logoIcon, width: 32, height: 32, fontSize: 16 }}>F</div>
            <span style={{ ...styles.logoName, fontSize: 16 }}>Fluxora ERP</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(245,240,232,0.40)", maxWidth: 240, lineHeight: 1.7, margin: 0 }}>
            Built for garment and textile MSMEs across India.
          </p>
        </div>
        {[
          { title: "Product", links: ["Features", "Pricing", "Industries", "Login"] },
          { title: "Company", links: ["About", "Contact", "MSME: UDYAM-TN-28-0190560"] },
          { title: "Support", links: ["Help Center", "WhatsApp Support", "Documentation"] },
        ].map((col, i) => (
          <div key={i}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 900, color: "rgba(245,240,232,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
              {col.title}
            </div>
            {col.links.map((link, li) => (
              <div
                key={li}
                style={{ fontSize: 13, color: "rgba(245,240,232,0.55)", marginBottom: 8, cursor: "pointer", transition: "color 150ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F5F0E8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.55)")}
              >
                {link}
              </div>
            ))}
          </div>
        ))}
        <div style={styles.footerNote}>
          © 2026 Fluxora Technology, Tiruppur, Tamil Nadu. GSTIN: 33CKAPJ7513F1ZK — Powered by Fluxora ERP
        </div>
      </footer>
    </div>
  );
};

export default FluxoraLanding;
