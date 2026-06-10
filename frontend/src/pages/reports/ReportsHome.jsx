import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import ReportShell from '../../components/reports/ReportShell';

const CATEGORIES = [
  {
    id: 'sales',
    title: 'Sales Reports',
    path: '/reports/sales',
    color: '#6366f1',
    icon: '📊',
    description: 'Top customers, trends, aging receivables, forecasts',
    count: 7,
  },
  {
    id: 'purchase',
    title: 'Purchase Reports',
    path: '/reports/purchase',
    color: '#10b981',
    icon: '🛒',
    description: 'Vendor performance, payment aging, price variance',
    count: 4,
  },
  {
    id: 'inventory',
    title: 'Inventory Reports',
    path: '/reports/inventory',
    color: '#8b5cf6',
    icon: '📦',
    description: 'ABC analysis, fast/slow movers, reorder alerts',
    count: 6,
  },
  {
    id: 'finance',
    title: 'Finance Reports',
    path: '/reports/finance',
    color: '#3b82f6',
    icon: '💰',
    description: 'Fund flow, profitability, ratios, budget vs actual',
    count: 7,
  },
  {
    id: 'gst',
    title: 'GST Reports',
    path: '/reports/gst',
    color: '#f59e0b',
    icon: '🧾',
    description: 'GST audit, tax liability, collection trends',
    count: 3,
  },
  {
    id: 'hr',
    title: 'HR Reports',
    path: '/reports/hr',
    color: '#ef4444',
    icon: '👥',
    description: 'Productivity, attendance trends, salary cost',
    count: 4,
  },
  {
    id: 'executive',
    title: 'Executive Dashboard',
    path: '/reports/executive',
    color: '#0ea5e9',
    icon: '🏆',
    description: 'KPIs, insights, revenue forecast, risk indicators',
    count: 4,
  },
];

const ReportsHome = () => {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    apiFetch('/reports/favorites')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setFavorites(d.data || []))
      .catch(() => {});
  }, []);

  return (
    <ReportShell
      title="Reports & Analytics"
      subtitle="Comprehensive business intelligence across all modules"
      breadcrumb={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports' }]}
    >
      {/* Favorites */}
      {favorites.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Pinned Reports</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {favorites.map(f => (
              <Link
                key={f.id}
                to={f.report_path}
                style={{
                  padding: '8px 16px',
                  background: '#f0f0ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '20px',
                  color: '#6366f1',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                ★ {f.report_name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
      }}>
        {CATEGORIES.map(cat => (
          <Link
            key={cat.id}
            to={cat.path}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              background: 'white',
              borderRadius: '14px',
              border: '1px solid #e5e7eb',
              padding: '20px',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s, transform 0.2s',
              borderLeft: `4px solid ${cat.color}`,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '28px' }}>{cat.icon}</span>
                <span style={{
                  background: cat.color + '20',
                  color: cat.color,
                  borderRadius: '20px',
                  padding: '2px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {cat.count} reports
                </span>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>{cat.title}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{cat.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Legacy Reports Link */}
      <div style={{ marginTop: '32px', padding: '16px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '10px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>Looking for the classic reports?</p>
        <Link to="/reports/world-class" style={{ color: '#6366f1', fontWeight: 500, textDecoration: 'none', fontSize: '14px' }}>
          Open Advanced Reports →
        </Link>
      </div>
    </ReportShell>
  );
};

export default ReportsHome;
