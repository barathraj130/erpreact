import { motion } from 'framer-motion';
import React, { useState } from 'react';
import {
    FaBell,
    FaBox,
    FaChartLine,
    FaChevronDown,
    FaChevronRight,
    FaClipboardList,
    FaCloudDownloadAlt,
    FaCog,
    FaExchangeAlt,
    FaFileInvoiceDollar,
    FaHistory,
    FaHome,
    FaLayerGroup as FaLayer,
    FaMoneyBillWave,
    FaSearch,
    FaUsers,
    FaWallet
} from 'react-icons/fa';
import './SynthesisLayout.css';

interface LayoutProps {
  children: React.ReactNode;
  activeItem?: string;
}

const SynthesisLayout: React.FC<LayoutProps> = ({ children, activeItem = 'Command Center' }) => {
  const [fiscalOpen, setFiscalOpen] = useState(true);

  const sidebarItems = [
    { label: 'Command Center', icon: <FaHome />, section: 'MAIN' },
    { label: 'Revenue Stream', icon: <FaMoneyBillWave />, section: 'OPERATIONS' },
    { label: 'Procurement', icon: <FaWallet />, section: 'OPERATIONS' },
    { label: 'Inventory Matrix', icon: <FaBox />, section: 'OPERATIONS' },
    { 
      label: 'Fiscal Logic', 
      icon: <FaLayer />, 
      section: 'SYSTEM',
      isExpandable: true,
      subItems: [
        { label: 'Finance Hub', icon: <FaFileInvoiceDollar /> },
        { label: 'Loan Portfolio', icon: <FaWallet /> },
        { label: 'Cash Receipts', icon: <FaMoneyBillWave /> },
        { label: 'Auto Reconcile', icon: <FaExchangeAlt /> },
        { label: 'Financial Intel', icon: <FaChartLine /> },
        { label: 'Global Ledgers', icon: <FaClipboardList /> },
        { label: 'Automated Log', icon: <FaHistory /> },
      ]
    },
    { label: 'Workforce', icon: <FaUsers />, section: 'SYSTEM' },
  ];



  return (
    <div className="synthesis-layout">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        className="synthesis-sidebar"
      >
        <div className="sidebar-brand">
          <div className="sidebar-avatar" style={{ background: '#3B82F6', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>S</div>
          <h2>ENTP SYNTHESIS</h2>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">COMMAND</div>
          <a className={`nav-item ${activeItem === 'Command Center' ? 'active' : ''}`}>
             <FaHome className="nav-item-icon" /> Command Center
          </a>

          <div className="nav-section-label">OPERATIONS</div>
          <a className="nav-item">
             <FaMoneyBillWave className="nav-item-icon" /> Revenue Stream
          </a>
          <a className="nav-item">
             <FaWallet className="nav-item-icon" /> Procurement
          </a>
          <a className="nav-item">
             <FaBox className="nav-item-icon" /> Inventory Matrix
          </a>

          <div className="nav-section-label">SYSTEM ARCHITECTURE</div>
          <div className="expandable-nav">
            <div className="nav-item" onClick={() => setFiscalOpen(!fiscalOpen)}>
              <FaLayer className="nav-item-icon" /> Fiscal Logic
              {fiscalOpen ? <FaChevronDown className="nav-item-chevron" /> : <FaChevronRight className="nav-item-chevron" />}
            </div>
            {fiscalOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="sub-nav"
                style={{ marginLeft: '1.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
              >
                {[
                  'Finance Hub', 'Loan Portfolio', 'Cash Receipts', 
                  'Auto Reconcile', 'Financial Intel', 'Global Ledgers', 'Automated Log'
                ].map(sub => (
                  <a key={sub} className="nav-item" style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>
                    {sub}
                  </a>
                ))}
              </motion.div>
            )}
          </div>
          <a className="nav-item">
             <FaUsers className="nav-item-icon" /> Workforce
          </a>
        </nav>

        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="nav-item">
                <FaCog /> Settings
            </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="synthesis-main">
        {/* Topbar */}
        <header className="synthesis-topbar">
          <div className="topbar-left">
            <div className="branch-selector">
                <div style={{ width: 10, height: 10, background: '#10B981', borderRadius: '50%' }}></div>
                DEMO BRANCH 01
                <FaChevronDown style={{ fontSize: '0.7rem' }} />
            </div>
            <div className="topbar-search">
              <FaSearch className="search-icon" />
              <input type="text" placeholder="Search Fiscal Logic, Revenue, Workforce..." />
            </div>
          </div>

          <div className="topbar-right">
            <div className="icon-btn">
                <FaBell />
                <span className="notification-badge"></span>
            </div>
            <div className="icon-btn">
                <FaCloudDownloadAlt />
            </div>
            <div className="profile-trigger">
                <div className="profile-avatar">AD</div>
                <div className="profile-info" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Admin User</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>System Administrator</span>
                </div>
                <FaChevronDown style={{ fontSize: '0.7rem', color: '#94a3b8' }} />
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="content-scrollable">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SynthesisLayout;
