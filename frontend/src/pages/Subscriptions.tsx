// frontend/src/pages/Subscriptions.tsx
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaCrown,
  FaGem,
  FaLayerGroup,
  FaRocket,
  FaShieldAlt,
} from "react-icons/fa";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiFetch } from "../utils/api";

interface Plan {
  id: number;
  plan_name: string;
  enabled_modules: string;
  max_branches: number;
  max_users: number;
  ai_enabled: boolean;
  analytics_enabled: boolean;
  storage_limit_gb: number;
  expiry_date: string;
  status: string;
}

const Subscriptions: React.FC = () => {
  const { user } = useAuthUser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [myPlan, setMyPlan] = useState<Plan | null>(null);
  const [upgradingId, setUpgradingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const plansRes = await apiFetch("/subscriptions/plans");
        let plansData = [];
        if (plansRes.ok) {
          plansData = await plansRes.json();
        }
        
        // Fallback plans if backend returns empty or fails
        if (!Array.isArray(plansData) || plansData.length === 0) {
          plansData = [
            { id: 1, plan_name: "Starter Edition", max_branches: 1, max_users: 5, storage_limit_gb: 10, ai_enabled: false, analytics_enabled: false, enabled_modules: "basic", expiry_date: "2027-12-31", status: "Active", price: "₹2,999/mo" },
            { id: 2, plan_name: "Professional Plan", max_branches: 5, max_users: 25, storage_limit_gb: 50, ai_enabled: true, analytics_enabled: true, enabled_modules: "all", expiry_date: "2027-12-31", status: "Active", price: "₹8,999/mo" },
            { id: 3, plan_name: "Enterprise Global", max_branches: 999, max_users: 999, storage_limit_gb: 500, ai_enabled: true, analytics_enabled: true, enabled_modules: "all", expiry_date: "2027-12-31", status: "Active", price: "Custom" }
          ];
        }
        
        setPlans(plansData);

        const cachedPlan = localStorage.getItem('erp_user_plan');
        if (cachedPlan) {
          setMyPlan(JSON.parse(cachedPlan));
        } else {
          // For now, let's assume we have a way to get current company's plan
          const companyId = user?.active_company_id;
          if (companyId) {
            try {
              const companyRes = await apiFetch("/company/profile");
              if (companyRes.ok) {
                const companyData = await companyRes.json();
                if (companyData.subscription_id) {
                  const plan = plansData.find((p: Plan) => p.id === companyData.subscription_id);
                  setMyPlan(plan || plansData[1]); // fallback to Professional
                } else {
                  setMyPlan(plansData[1]); // Default to Professional if none
                }
              } else {
                setMyPlan(plansData[1]);
              }
            } catch(e) {
              setMyPlan(plansData[1]);
            }
          } else {
            setMyPlan(plansData[1]);
          }
        }
      } catch (error) {
        console.error("Error fetching subscription data:", error);
        // Fallback on total failure
        const fallbackPlans = [
          { id: 1, plan_name: "Starter Edition", max_branches: 1, max_users: 5, storage_limit_gb: 10, ai_enabled: false, analytics_enabled: false, enabled_modules: "basic", expiry_date: "2027-12-31", status: "Active", price: "₹2,999/mo" },
          { id: 2, plan_name: "Professional Plan", max_branches: 5, max_users: 25, storage_limit_gb: 50, ai_enabled: true, analytics_enabled: true, enabled_modules: "all", expiry_date: "2027-12-31", status: "Active", price: "₹8,999/mo" },
          { id: 3, plan_name: "Enterprise Global", max_branches: 999, max_users: 999, storage_limit_gb: 500, ai_enabled: true, analytics_enabled: true, enabled_modules: "all", expiry_date: "2027-12-31", status: "Active", price: "Custom" }
        ];
        setPlans(fallbackPlans);
        
        const cachedPlan = localStorage.getItem('erp_user_plan');
        setMyPlan(cachedPlan ? JSON.parse(cachedPlan) : fallbackPlans[1]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleUpgrade = (plan: any) => {
    if (plan.id === myPlan?.id) return;
    setUpgradingId(plan.id);
    
    // Simulate real-time backend API upgrade process
    setTimeout(() => {
      localStorage.setItem('erp_user_plan', JSON.stringify(plan));
      setMyPlan(plan);
      setUpgradingId(null);
      
      alert(`🎉 Successfully upgraded your enterprise to the ${plan.plan_name}!`);
    }, 1500);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="page-container" style={{ padding: "40px 40px 120px 40px", width: "100%", margin: "0 auto", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto 48px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a", marginBottom: "16px", letterSpacing: "-0.5px" }}>
          Subscription & Licensing
        </h1>
        <p style={{ color: "#64748b", fontSize: "18px", lineHeight: "1.6" }}>
          Scale your enterprise with precision-engineered modules and flexible resource limits.
        </p>
      </div>

      {/* Current Plan Summary (for Tenants) */}
      {myPlan && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)", padding: "4px", borderRadius: "24px", marginBottom: "48px", boxShadow: "0 20px 40px rgba(37, 99, 235, 0.2)" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "32px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "6px 16px", borderRadius: "100px", fontSize: "12px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
                  Your Current Plan
                </span>
                <span style={{ background: "#d1fae5", color: "#047857", padding: "6px 16px", borderRadius: "100px", fontSize: "12px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
                  {myPlan.status}
                </span>
              </div>
              <h2 style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a", margin: "0 0 24px 0" }}>
                {myPlan.plan_name}
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "center", color: "#64748b", fontWeight: 600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaLayerGroup /> {myPlan.max_branches} Branches</span>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaCheckCircle /> {myPlan.max_users} Users</span>
                <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: 700 }}>Expires: {new Date(myPlan.expiry_date || "2027-12-31").toLocaleDateString()}</span>
              </div>
            </div>
            <button style={{ background: "#0f172a", color: "white", padding: "16px 32px", borderRadius: "16px", fontWeight: 800, fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", border: "none", cursor: "pointer", boxShadow: "0 10px 20px rgba(15, 23, 42, 0.2)" }}>
              Manage Subscription
            </button>
          </div>
        </motion.div>
      )}

      {/* Global Admin: Plan Management / Upgrade Options */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "64px", overflowX: "auto", paddingBottom: "16px" }}
      >
        {plans.length > 0
          ? plans.map((plan: any, idx) => (
              <motion.div
                key={plan.id}
                variants={cardVariants}
                className="enterprise-card"
                style={{ 
                  padding: "24px", 
                  border: plan.id === myPlan?.id ? "2px solid #3b82f6" : "1px solid #e2e8f0", 
                  background: plan.id === myPlan?.id ? "#eff6ff" : "white",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: plan.id === myPlan?.id ? "0 20px 40px rgba(59, 130, 246, 0.15)" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  minWidth: "260px"
                }}
              >
                {/* Header Section */}
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <div style={{ display: "inline-flex", padding: "12px", borderRadius: "16px", marginBottom: "16px", background: idx === 0 ? "#f1f5f9" : idx === 1 ? "#eff6ff" : "#fef3c7", color: idx === 0 ? "#94a3b8" : idx === 1 ? "#3b82f6" : "#d97706" }}>
                    {idx === 0 ? <FaRocket size={24} /> : idx === 1 ? <FaGem size={24} /> : <FaCrown size={24} />}
                  </div>
                  
                  {plan.id === myPlan?.id && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ display: "inline-block", background: "#2563eb", color: "white", padding: "4px 16px", borderRadius: "100px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>
                        Current Plan
                      </span>
                    </div>
                  )}

                  <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a", marginBottom: "4px", letterSpacing: "-0.5px" }}>{plan.plan_name}</h3>
                  <div style={{ fontSize: "24px", fontWeight: 900, color: plan.id === myPlan?.id ? "#2563eb" : "#0f172a", marginBottom: "8px", letterSpacing: "-0.5px" }}>{plan.price}</div>
                  <p style={{ color: "#64748b", fontSize: "12px", fontWeight: 500, margin: 0, lineHeight: "1.5" }}>
                    Best for {plan.max_branches === 1 ? "small businesses" : plan.max_branches < 10 ? "growing companies" : "large enterprises"}.
                  </p>
                </div>

                <div style={{ height: "1px", background: "#e2e8f0", margin: "0 0 20px 0", width: "100%" }} />

                {/* Features Section */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", flexGrow: 1, marginBottom: "24px", fontSize: "13px" }}>
                  <FeatureItem icon={<FaCheckCircle size={14} color="#10b981" />} text={<><strong>{plan.max_branches}</strong> Physical Branches</>} />
                  <FeatureItem icon={<FaCheckCircle size={14} color="#10b981" />} text={<><strong>{plan.max_users}</strong> Total Users</>} />
                  <FeatureItem icon={<FaCheckCircle size={14} color="#10b981" />} text={<><strong>{plan.storage_limit_gb}GB</strong> Enterprise Storage</>} />
                  <FeatureItem icon={<FaGem size={14} color={plan.ai_enabled ? "#3b82f6" : "#cbd5e1"} />} text={<span style={{ color: plan.ai_enabled ? "#334155" : "#94a3b8" }}>AI Prediction Engine</span>} />
                  <FeatureItem icon={<FaLayerGroup size={14} color={plan.analytics_enabled ? "#6366f1" : "#cbd5e1"} />} text={<span style={{ color: plan.analytics_enabled ? "#334155" : "#94a3b8" }}>Advanced Analytics</span>} />
                  <FeatureItem icon={<FaShieldAlt size={14} color="#0f172a" />} text={<>Multi-tenant Isolation</>} />
                </div>

                {/* Action Section */}
                <button 
                  onClick={() => handleUpgrade(plan)}
                  disabled={plan.id === myPlan?.id || upgradingId === plan.id}
                  style={{ 
                    width: "100%", padding: "12px", borderRadius: "12px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", border: "none", cursor: plan.id === myPlan?.id ? "default" : "pointer", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: plan.id === myPlan?.id ? "#e2e8f0" : upgradingId === plan.id ? "#93c5fd" : "#0f172a",
                    color: plan.id === myPlan?.id ? "#64748b" : "white",
                    boxShadow: plan.id === myPlan?.id ? "none" : "0 10px 25px rgba(15, 23, 42, 0.3)"
                  }}
                  onMouseOver={(e) => { if (plan.id !== myPlan?.id && upgradingId !== plan.id) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseOut={(e) => { if (plan.id !== myPlan?.id && upgradingId !== plan.id) e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {upgradingId === plan.id ? "Processing..." : plan.id === myPlan?.id ? "Current Plan" : "Upgrade to " + plan.plan_name.split(' ')[0]}
                </button>
              </motion.div>
            ))
          : [1, 2, 3].map((i) => (
              <div key={i} style={{ height: "450px", background: "#f8fafc", borderRadius: "24px", animation: "pulse 2s infinite" }} />
            ))}
      </motion.div>

      {/* Footer Prompt */}
      <div style={{ background: "#0f172a", color: "white", padding: "64px 40px", borderRadius: "32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "24px" }}>
        <h3 style={{ color: "white", fontSize: "28px", fontWeight: 800, fontStyle: "italic", letterSpacing: "-0.5px", margin: 0 }}>
          Need a custom solution for your enterprise?
        </h3>
        <p style={{ color: "#94a3b8", maxWidth: "500px", fontSize: "16px", lineHeight: "1.6", margin: 0 }}>
          Our global account managers can design a personalized blueprint for your multi-country branch operations.
        </p>
        <button style={{ background: "white", color: "#0f172a", padding: "14px 32px", borderRadius: "100px", fontWeight: 800, border: "none", cursor: "pointer", marginTop: "8px" }}>
          Contact Enterprise Sales
        </button>
      </div>
    </div>
  );
};

const FeatureItem: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#334155", fontWeight: 600 }}>
    <span style={{ display: "flex" }}>{icon}</span>
    <span style={{ fontSize: "14px" }}>{text}</span>
  </div>
);

export default Subscriptions;
