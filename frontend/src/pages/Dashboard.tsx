import React, { useMemo } from 'react';
import { FaArrowUp, FaBox, FaFileInvoice, FaUsers, FaWallet } from 'react-icons/fa';
import { useAuthUser } from '../hooks/useAuthUser';
import { useInvoices } from '../hooks/useInvoices';
import { useProducts } from '../hooks/useProducts';
import { useUsers } from '../hooks/useUsers';

// --- STAT CARD COMPONENT ---
const StatCard = ({ title, value, icon, color, trend }: any) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
    <div className="flex-between" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
      <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>{title}</span>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
        {icon}
      </div>
    </div>
    <div>
      <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>{value}</h3>
      {trend && <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
        <FaArrowUp /> {trend} vs last month
      </span>}
    </div>
  </div>
);

const EmptyChartState = ({ message }: { message: string }) => (
    <div style={{ 
        height: '250px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'
    }}>
        <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.5 }}>📊</div>
        <p>{message}</p>
    </div>
);

const Dashboard: React.FC = () => {
  const { user } = useAuthUser();
  const { customers = [] } = useUsers();     // Default to empty array safety
  const { invoices = [] } = useInvoices();   // Default to empty array safety
  const { products = [] } = useProducts();   // Default to empty array safety

  // --- SAFE CALCULATIONS ---
  const stats = useMemo(() => {
    try {
        // Safe Filtering
        const actualCustomers = Array.isArray(customers) ? customers.filter(c => 
            c?.username?.toLowerCase() !== 'admin' && c.id !== user?.id
        ) : [];

        // Safe Revenue Calculation
        const totalRevenue = Array.isArray(invoices) ? invoices.reduce((sum, inv) => {
            const amount = Number(inv.total_amount);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0) : 0;

        return {
            totalRevenue,
            customers: actualCustomers.length,
            orders: Array.isArray(invoices) ? invoices.length : 0,
            products: Array.isArray(products) ? products.length : 0
        };
    } catch (err) {
        console.error("Dashboard Calculation Error:", err);
        return { totalRevenue: 0, customers: 0, orders: 0, products: 0 };
    }
  }, [invoices, products, customers, user]);

  return (
    <div>
      {/* Page Title */}
      <div className="flex-between" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b' }}>Overview</h1>
            <p style={{ color: '#64748b' }}>Here is what's happening with your business today.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '30px' }}>
        <StatCard 
            title="Total Revenue" 
            value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`} 
            icon={<FaWallet />} 
            color="#22c55e" 
            trend="12%" 
        />
        <StatCard 
            title="Total Customers" 
            value={stats.customers} 
            icon={<FaUsers />} 
            color="#3b82f6" 
            trend="4%" 
        />
        <StatCard 
            title="Active Invoices" 
            value={stats.orders} 
            icon={<FaFileInvoice />} 
            color="#f59e0b" 
        />
        <StatCard 
            title="Products" 
            value={stats.products} 
            icon={<FaBox />} 
            color="#8b5cf6" 
        />
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Revenue Chart Placeholder */}
        <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div className="flex-between" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, color: '#1e293b' }}>Revenue Analytics</h3>
            <select style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.85rem' }}>
                <option>This Year</option>
            </select>
          </div>
          <EmptyChartState message="Not enough data to display revenue graph" />
        </div>

        {/* Top Products */}
        <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginBottom: '20px', margin: '0 0 20px 0', color: '#1e293b' }}>Top Products</h3>
          {stats.products > 0 ? (
             <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                 {products.slice(0, 5).map((p, i) => (
                     <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ width: '32px', height: '32px', background: '#e2e8f0', borderRadius: '4px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <FaBox color="#94a3b8" size={14}/>
                            </div>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{p.product_name}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>₹{p.sale_price}</span>
                     </li>
                 ))}
             </ul>
          ) : (
            <EmptyChartState message="No products found" />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;