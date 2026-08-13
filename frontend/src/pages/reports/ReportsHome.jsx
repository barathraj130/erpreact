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
  {
    id: 'discounts',
    title: 'Discount & Waiver Report',
    path: '/reports/discounts',
    color: '#f59e0b',
    icon: '🎁',
    description: 'Total waivers given, per-customer breakdown, invoice-wise list',
    count: 2,
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
          <h2 style={{ fontFamily: "var(--font-display, inherit)", fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neu-text-muted, #374151)', marginBottom: '12px' }}>Pinned Reports</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {favorites.map(f => (
              <Link
                key={f.id}
                to={f.report_path}
                style={{
                  padding: '8px 16px',
                  background: 'var(--neu-bg, #f0f0ff)',
                  border: '1.5px solid var(--neu-border, #c7d2fe)',
                  borderRadius: '0',
                  color: 'var(--neo-brand, #6366f1)',
                  textDecoration: 'none',
                  fontFamily: "var(--font-display, inherit)",
                  fontSize: '13px',
                  fontWeight: 700,
                  boxShadow: 'var(--neu-raised, none)',
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
              background: 'var(--neu-surface, white)',
              borderRadius: '0',
              border: '2px solid var(--neu-border, #e5e7eb)',
              padding: '20px',
              cursor: 'pointer',
              transition: 'box-shadow 180ms cubic-bezier(0.4,0,0.2,1), transform 180ms cubic-bezier(0.4,0,0.2,1), border-color 180ms',
              borderLeft: `4px solid ${cat.color}`,
              boxShadow: 'var(--neu-card, none)',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `4px 4px 0px ${cat.color}`; e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.borderColor = cat.color; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--neu-card, none)'; e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--neu-border, #e5e7eb)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '28px' }}>{cat.icon}</span>
                <span style={{
                  background: cat.color + '20',
                  color: cat.color,
                  borderRadius: '0',
                  padding: '2px 10px',
                  fontFamily: "var(--font-display, inherit)",
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {cat.count} reports
                </span>
              </div>
              <h3 style={{ fontFamily: "var(--font-display, inherit)", fontSize: '15px', fontWeight: 700, color: 'var(--neu-text-primary, #111827)', margin: '0 0 6px 0' }}>{cat.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--neu-text-secondary, #6b7280)', margin: 0 }}>{cat.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Legacy Reports Link */}
      <div style={{ marginTop: '32px', padding: '16px', background: 'var(--neu-bg, #fafafa)', border: '1.5px solid var(--neu-border, #e5e7eb)', borderRadius: '0', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--neu-text-secondary, #6b7280)' }}>Looking for the classic reports?</p>
        <Link to="/reports/world-class" style={{ color: 'var(--neo-brand, #6366f1)', fontWeight: 700, fontFamily: "var(--font-display, inherit)", textDecoration: 'none', fontSize: '14px' }}>
          Open Advanced Reports →
        </Link>
      </div>
    </ReportShell>
  );
};

export default ReportsHome;
