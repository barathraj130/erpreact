// frontend/src/pages/Subscriptions.tsx
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaCrown, FaGem, FaLayerGroup, FaRocket, FaShieldAlt } from 'react-icons/fa';
import { useAuthUser } from '../hooks/useAuthUser';

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('erp-token');
                // Fetch all plans (if superadmin) or just available plans
                const plansRes = await fetch(`${import.meta.env.VITE_API_URL}/api/subscriptions/plans`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const plansData = await plansRes.json();
                if (plansRes.ok) setPlans(plansData);

                // For now, let's assume we have a way to get current company's plan
                const companyId = user?.active_company_id;
                if (companyId) {
                   const companyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/company/profile`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const companyData = await companyRes.json();
                    if (companyRes.ok && companyData.subscription_id) {
                         const plan = plansData.find((p: Plan) => p.id === companyData.subscription_id);
                         setMyPlan(plan);
                    }
                }
            } catch (error) {
                console.error("Error fetching subscription data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const cardVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto space-y-4">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Subscription & Licensing</h1>
                <p className="text-slate-500 text-lg">Scale your enterprise with precision-engineered modules and flexible resource limits.</p>
            </div>

            {/* Current Plan Summary (for Tenants) */}
            {myPlan && (
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gradient-to-br from-indigo-600 to-blue-700 p-1 rounded-3xl shadow-2xl overflow-hidden"
                >
                    <div className="bg-white rounded-[22px] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-4">
                             <div className="flex items-center gap-3">
                                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Your Current Plan</span>
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">{myPlan.status}</span>
                             </div>
                             <h2 className="text-4xl font-black text-slate-900">{myPlan.plan_name}</h2>
                             <div className="flex gap-6 items-center text-slate-500 font-medium">
                                <span className="flex items-center gap-2"><FaLayerGroup /> {myPlan.max_branches} Branches</span>
                                <span className="flex items-center gap-2"><FaCheckCircle /> {myPlan.max_users} Users</span>
                                <span className="flex items-center gap-2 font-bold text-slate-900">Expires: {new Date(myPlan.expiry_date || '').toLocaleDateString()}</span>
                             </div>
                        </div>
                        <button className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 hover:scale-105 transition-all text-sm uppercase tracking-widest">
                            Manager Subscription
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Global Admin: Plan Management / Upgrade Options */}
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
                {plans.length > 0 ? plans.map((plan, idx) => (
                    <motion.div 
                        key={plan.id}
                        variants={cardVariants}
                        whileHover={{ y: -10 }}
                        className={`glass-panel p-8 rounded-3xl border-2 transition-all ${plan.id === myPlan?.id ? 'border-blue-500 shadow-2xl bg-blue-50/10' : 'border-slate-100'}`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-4 rounded-2xl ${idx === 0 ? 'bg-slate-50 text-slate-400' : idx === 1 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {idx === 0 ? <FaRocket size={24} /> : idx === 1 ? <FaGem size={24} /> : <FaCrown size={24} />}
                            </div>
                            {plan.id === myPlan?.id && <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter">Current Plan</span>}
                        </div>

                        <h3 className="text-2xl font-black text-slate-900 mb-2">{plan.plan_name}</h3>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">Best for {plan.max_branches === 1 ? 'small businesses' : plan.max_branches < 10 ? 'growing companies' : 'large enterprises'}.</p>

                        <div className="space-y-4 mb-10">
                            <FeatureItem icon={<FaCheckCircle className="text-emerald-500" />} text={`${plan.max_branches} Physical Branches`} />
                            <FeatureItem icon={<FaCheckCircle className="text-emerald-500" />} text={`${plan.max_users} Total Users`} />
                            <FeatureItem icon={<FaCheckCircle className="text-emerald-500" />} text={`${plan.storage_limit_gb}GB Enterprise Storage`} />
                            
                            {plan.ai_enabled && <FeatureItem icon={<FaGem className="text-blue-500" />} text="AI Prediction Engine" />}
                            {plan.analytics_enabled && <FeatureItem icon={<FaLayerGroup className="text-indigo-500" />} text="Advanced Analytics" />}
                            <FeatureItem icon={<FaShieldAlt className="text-slate-400" />} text="Multi-tenant Isolation" />
                        </div>

                        <button className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${plan.id === myPlan?.id ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}>
                            {plan.id === myPlan?.id ? 'Currently Using' : 'Upgrade Now'}
                        </button>
                    </motion.div>
                )) : (
                    [1,2,3].map(i => <div key={i} className="h-[500px] bg-slate-50 animate-pulse rounded-3xl" />)
                )}
            </motion.div>

            {/* Footer Prompt */}
            <div className="bg-slate-900 text-white p-12 rounded-[40px] flex flex-col items-center text-center gap-6">
                <h3 className="text-2xl font-bold italic tracking-tighter">Need a custom solution for your enterprise?</h3>
                <p className="text-slate-400 max-w-md">Our global account managers can design a personalized blueprint for your multi-country branch operations.</p>
                <button className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:scale-110 transition-all">Contact Enterprise Sales</button>
            </div>
        </div>
    );
};

const FeatureItem: React.FC<{ icon: React.ReactNode, text: string }> = ({ icon, text }) => (
    <div className="flex items-center gap-4 text-slate-700 font-medium">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm">{text}</span>
    </div>
);

export default Subscriptions;
