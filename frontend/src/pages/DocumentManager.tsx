/* DocumentManager.tsx - macOS Finder-inspired Documents Module */

import React, { useState, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { useAuthUser } from "../hooks/useAuthUser";
import { 
  FaFolder, 
  FaFilePdf, 
  FaFileImage, 
  FaPlus, 
  FaUpload, 
  FaSearch, 
  FaThLarge, 
  FaList, 
  FaChevronRight,
  FaFileInvoice,
  FaReceipt,
  FaShippingFast,
  FaFileContract,
  FaChartBar,
  FaArchive,
  FaInfoCircle,
  FaTag,
  FaMoneyBillWave,
  FaCog,
  FaEllipsisH,
  FaTimes
} from 'react-icons/fa';
import GSTReport from '../components/GSTReport';
import './DocumentManager.css';
import './Dashboard.css';
import './PageShared.css';

interface DocItem {
  id: string;
  name: string;
  type: 'folder' | 'pdf' | 'image';
  category: string;
  date: string;
  amount?: number;
  gstNumber?: string;
  invoiceNumber?: string;
  status: 'paid' | 'pending' | 'overdue' | 'verified' | 'gst_filed';
  tags: string[];
}

const DocumentManager: React.FC = () => {
  const { user } = useAuthUser();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState('Documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<DocItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [customFolders, setCustomFolders] = useState<{name: string, parent: string}[]>([]);
  const [customFiles, setCustomFiles] = useState<DocItem[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null);

  // Responsive listener
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    const normalizeStatus = (status: string): DocItem["status"] => {
      const normalized = String(status || "pending").toLowerCase();
      if (normalized === "paid" || normalized === "pending" || normalized === "overdue" || normalized === "verified" || normalized === "gst_filed") {
        return normalized as DocItem["status"];
      }
      if (normalized === "partial") return "pending";
      return "pending";
    };

    const fileTypeFromUrl = (url: string): "pdf" | "image" => {
      const lower = String(url || "").toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        return "image";
      }
      return "pdf";
    };

    const flattenDocs = (tree: any[], branchLabel: "Sales" | "Purchase") =>
      (tree || []).flatMap((monthGroup) => {
        const toItem = (file: any, taxLabel: "Tax Invoices" | "Non-Tax Invoices") => ({
          id: `${branchLabel}-${taxLabel}-${file.id}`,
          name: (file.file_url || "").split("/").pop() || `${file.number || "document"}.pdf`,
          type: fileTypeFromUrl(file.file_url),
          category: `${taxLabel}/${branchLabel}`,
          date: file.date,
          amount: Number(file.amount || 0),
          invoiceNumber: file.number,
          status: normalizeStatus(file.status),
          tags: ["Live"],
        });

        return [
          ...(monthGroup.tax_files || []).map((file: any) => toItem(file, "Tax Invoices")),
          ...(monthGroup.non_tax_files || []).map((file: any) => toItem(file, "Non-Tax Invoices")),
        ];
      });

    const loadDocuments = async () => {
      try {
        const [salesRes, purchaseRes] = await Promise.all([
          apiFetch("/documents/sales"),
          apiFetch("/documents/purchases"),
        ]);
        const sales = salesRes.ok ? await salesRes.json() : [];
        const purchases = purchaseRes.ok ? await purchaseRes.json() : [];
        setDocuments([
          ...flattenDocs(sales, "Sales"),
          ...flattenDocs(purchases, "Purchase"),
        ]);
      } catch (error) {
        console.error("Failed to load live documents", error);
        setDocuments([]);
      }
    };

    loadDocuments();
  }, []);

  const breadcrumbs = useMemo(() => {
    return activeCategory.split('/');
  }, [activeCategory]);

  // Navigation Structure Logic
  const getCurrentChildren = () => {
    // If we're at 'Documents', show the main categories
    if (activeCategory === 'Documents') {
      return [
        { name: 'Tax Invoices', type: 'folder' },
        { name: 'Non-Tax Invoices', type: 'folder' },
        { name: 'Receipts', type: 'folder' },
        { name: 'Delivery Bills', type: 'folder' },
        { name: 'Expense Bills', type: 'folder' },
        { name: 'Reports', type: 'folder' },
        { name: 'Archived', type: 'folder' },
      ].concat(customFolders.filter(f => f.parent === 'Documents').map(f => ({ name: f.name, type: 'folder' } as any)));
    }
    
    // Check if current category is a custom folder
    const customMatch = customFolders.find(f => (f.parent === 'Documents' ? f.name : `${f.parent}/${f.name}`) === activeCategory);
    if (customMatch) {
       return customFolders.filter(f => f.parent === activeCategory).map(f => ({ name: f.name, type: 'folder' } as any));
    }

    // Sub-folders logic
    if (activeCategory === 'Tax Invoices') {
      return [
        { name: 'Sales', type: 'folder' },
        { name: 'Purchase', type: 'folder' },
      ];
    }
    if (activeCategory === 'Non-Tax Invoices') {
      return [
        { name: 'Sales', type: 'folder' },
        { name: 'Purchase', type: 'folder' },
      ];
    }
    if (activeCategory === 'Receipts') {
      return [
        { name: 'Payment Received', type: 'folder' },
        { name: 'Payment Given', type: 'folder' },
      ];
    }
    
    // Add custom subfolders for nested structures
    const subCustoms = customFolders.filter(f => f.parent === activeCategory);
    return subCustoms.map(f => ({ name: f.name, type: 'folder' } as any));
  };

  const currentFolders = useMemo(() => getCurrentChildren(), [activeCategory]);
  
  const currentFiles = useMemo(() => {
    const allDocs = [...documents, ...customFiles];
    return allDocs.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      // For files, we match the category exactly OR if it's a search show everything in that branch
      const matchesCategory = searchQuery ? item.category.startsWith(activeCategory) : item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, documents, customFiles]);

  const handleFolderClick = (folderName: string) => {
    const newPath = activeCategory === 'Documents' ? folderName : `${activeCategory}/${folderName}`;
    setActiveCategory(newPath);
    setSelectedItem(null);
  };

  const handleFileClick = (file: DocItem) => {
    setSelectedItem(file);
  };

  const openViewer = async (file: DocItem) => {
    setSelectedItem(file);
    setIsViewerOpen(true);
    setViewerBlobUrl(null);
    if (!file.id.startsWith('custom-')) {
      try {
        // file.id format: "Sales-Tax Invoices-{id}" or "Purchase-...-{id}"
        const parts = file.id.split('-');
        const rawId = parts[parts.length - 1];
        const branch = parts[0]; // "Sales" or "Purchase"
        const endpoint = branch === 'Sales'
          ? `/invoice/${rawId}/pdf`
          : `/purchase-pdf/${rawId}`;
        const res = await apiFetch(endpoint);
        if (res.ok) {
          const blob = await res.blob();
          setViewerBlobUrl(URL.createObjectURL(blob));
        } else {
          console.error('Document fetch failed:', res.status);
        }
      } catch (e) {
        console.error('Failed to load document preview', e);
      }
    }
  };

  const handleFileDoubleClick = (file: DocItem) => {
    openViewer(file);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'paid': return { background: '#dcfce7', color: '#166534' };
      case 'pending': return { background: '#fef9c3', color: '#854d0e' };
      case 'overdue': return { background: '#fee2e2', color: '#991b1b' };
      case 'verified': return { background: '#e0f2fe', color: '#0369a1' };
      default: return { background: '#f1f5f9', color: '#64748b' };
    }
  };

  const handleNewFolder = () => {
    const name = prompt("Enter folder name:");
    if (name) {
      setCustomFolders([...customFolders, { name, parent: activeCategory }]);
    }
  };

  const handleNewFile = () => {
    const name = prompt("What file would you like to create? (e.g. 'Project Proposal.pdf')");
    if (name) {
      const newFile: DocItem = {
        id: `custom-${Date.now()}`,
        name: name.includes('.') ? name : `${name}.pdf`,
        type: name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpg') ? 'image' : 'pdf',
        category: activeCategory,
        date: new Date().toISOString().split('T')[0],
        status: 'verified',
        tags: ['User Created']
      };
      setCustomFiles([...customFiles, newFile]);
    }
  };

  const renderIcon = (type: string, name: string) => {
    if (type === 'folder') return <FaFolder color="#f59e0b" />;
    if (type === 'pdf') return <FaFilePdf color="#ef4444" />;
    if (type === 'image') return <FaFileImage color="#3b82f6" />;
    return <FaFileInvoice color="#94a3b8" />;
  };

  return (
    <div className="db-page fade-in-up">
      {/* ── Sticky Topbar ── */}
      <header className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-topbar-title">{user?.company || "Documents"}</span>
          <span className="db-topbar-sep">/</span>
          <span className="db-topbar-sub">Documents</span>
        </div>
        <div className="db-topbar-right">
          <div style={{ display: "flex", gap: "24px", marginRight: '24px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#9b9b96" }}>Analyzed Files</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#111110" }}>128</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#9b9b96" }}>Storage Used</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#111110" }}>4.2 GB</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="db-btn db-btn-ghost" onClick={() => setPreviewOpen(!previewOpen)} title="Toggle Preview">
              <FaInfoCircle size={14} /> Preview
            </button>
            <button 
              className="db-btn" 
              style={{ borderRadius: '100px', background: '#3b82f6', color: 'white' }}
              onClick={handleNewFolder}
            >
              <FaPlus size={11} /> New Folder
            </button>
            <button 
              className="db-btn db-btn-primary" 
              style={{ borderRadius: '100px' }}
              onClick={handleNewFile}
            >
              <FaUpload size={11} /> New File
            </button>
          </div>
        </div>
      </header>

      {/* ── Page Body ── */}
      <div className="db-content" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div className="db-page-header" style={{ padding: '24px 24px 0 24px' }}>
          <div>
            <h1 className="db-page-title">Document <strong>Repository</strong></h1>
            <p className="db-page-sub">Manage and analyze your enterprise intelligence documents.</p>
          </div>
        </div>

      {/* 🗂️ Finder Interior */}
      <div className="doc-finder-hub">
        {/* 🧭 Sidebar */}
        <aside className="doc-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Favorites</div>
            <div className={`sidebar-item ${activeCategory === 'Documents' ? 'active' : ''}`} onClick={() => setActiveCategory('Documents')}>
              <FaFolder size={16} /> Documents
            </div>
            <div className={`sidebar-item ${activeCategory === 'Reports' ? 'active' : ''}`} onClick={() => setActiveCategory('Reports')}>
              <FaChartBar size={16} /> Reports
            </div>
            <div className={`sidebar-item ${activeCategory === 'Archived' ? 'active' : ''}`} onClick={() => setActiveCategory('Archived')}>
              <FaArchive size={16} /> Archived
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Classification</div>
            
            <div className="sidebar-item" onClick={() => setActiveCategory('Tax Invoices')}>
              <FaFileInvoice size={16} /> Tax Invoices
            </div>
            <div className="sidebar-item sidebar-item-sub" onClick={() => setActiveCategory('Tax Invoices/Sales')}>Sales</div>
            <div className="sidebar-item sidebar-item-sub" onClick={() => setActiveCategory('Tax Invoices/Purchase')}>Purchase</div>

            <div className="sidebar-item" style={{ marginTop: '12px' }} onClick={() => setActiveCategory('Non-Tax Invoices')}>
              <FaFileContract size={16} /> Non-Tax
            </div>
            <div className="sidebar-item sidebar-item-sub" onClick={() => setActiveCategory('Non-Tax Invoices/Sales')}>Sales</div>
            <div className="sidebar-item sidebar-item-sub" onClick={() => setActiveCategory('Non-Tax Invoices/Purchase')}>Purchase</div>
          </div>
        </aside>

        {/* 📄 Explorer Area */}
        <main className="doc-explorer">
          {/* Toolbar */}
          <header className="explorer-toolbar">
            <div className="toolbar-left">
              <div className="doc-search-box">
                <FaSearch className="doc-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search filename, invoice #, customer..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="doc-toolbar-btns">
                <button className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                  <FaThLarge />
                </button>
                <button className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                  <FaList />
                </button>
              </div>
            </div>

            <div className="toolbar-right">
               {/* Actions moved to Topbar */}
            </div>
          </header>

          {/* Breadcrumbs */}
          <div className="explorer-breadcrumbs">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <span className="breadcrumb-item" onClick={() => setActiveCategory(breadcrumbs.slice(0, idx + 1).join('/'))}>
                  {crumb}
                </span>
                {idx < breadcrumbs.length - 1 && <FaChevronRight size={8} />}
              </React.Fragment>
            ))}
          </div>

          {/* Main Explorer Content */}
          <div className="explorer-content" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {activeCategory === 'Reports' ? (
              <GSTReport />
            ) : viewMode === 'grid' ? (
              <div className="file-grid">
                {/* 📂 Render Folders first */}
                {currentFolders.map(folder => (
                  <div 
                    key={folder.name} 
                    className="stylized-folder"
                    onClick={() => handleFolderClick(folder.name)}
                  >
                    <div className="folder-tab"></div>
                    <div className="folder-body-back"></div>
                    <div className="folder-contents-card" style={{ background: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                       <FaFolder size={32} color="#f59e0b" opacity="0.3" />
                    </div>
                    <div className="folder-body-front">
                      <h3 className="folder-title">{folder.name}</h3>
                      <div className="folder-subtitle">Section Category</div>
                    </div>
                  </div>
                ))}

                {/* 📄 Render Files next */}
                {currentFiles.map(file => (
                  <div 
                    key={file.id} 
                    className={`stylized-file ${selectedItem?.id === file.id ? 'selected-file' : ''}`}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                  >
                    <div className="file-preview-area">
                      <div className={`file-type-badge ${file.type}`}>
                        {file.type}
                      </div>
                      <div style={{ transform: 'scale(1.5)', opacity: 0.1 }}>
                        {renderIcon(file.type, file.name)}
                      </div>
                    </div>

                    <div className="file-meta-footer">
                      <div className="file-title-text" title={file.name}>{file.name}</div>
                      <div className="file-subtitle-text">
                        {file.amount ? `₹${file.amount.toLocaleString()}` : (file.invoiceNumber || 'No Ref')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFiles.map(item => (
                    <tr 
                      key={item.id} 
                      className={selectedItem?.id === item.id ? 'selected' : ''}
                      onClick={() => handleFileClick(item)}
                      onDoubleClick={() => handleFileDoubleClick(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderIcon(item.type, item.name)}
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                        </div>
                      </td>
                      <td><span style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{item.type}</span></td>
                      <td>{item.invoiceNumber || '--'}</td>
                      <td>{new Date(item.date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 700 }}>{item.amount ? `₹${item.amount.toLocaleString()}` : '--'}</td>
                      <td>
                        <span 
                          className="status-indicator"
                          style={getStatusStyle(item.status)}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* 👁️ Preview Panel */}
        <aside className={`doc-preview-panel ${!previewOpen ? 'collapsed' : ''}`}>
          {selectedItem ? (
            <>
              <div className="preview-header">
                <div className="preview-thumb">
                  {renderIcon(selectedItem.type, selectedItem.name)}
                </div>
                <h2 className="preview-title">{selectedItem.name}</h2>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                  Added on {new Date(selectedItem.date).toLocaleDateString()}
                </div>
              </div>

              <div className="preview-meta-group">
                <div className="meta-label">Classification</div>
                <div className="meta-value">{selectedItem.category}</div>

                {selectedItem.invoiceNumber && (
                  <>
                    <div className="meta-label">Invoice Number</div>
                    <div className="meta-value">{selectedItem.invoiceNumber}</div>
                  </>
                )}

                {selectedItem.gstNumber && (
                  <>
                    <div className="meta-label">GST Number</div>
                    <div className="meta-value">{selectedItem.gstNumber}</div>
                  </>
                )}

                {selectedItem.amount && (
                  <>
                    <div className="meta-label">Total Amount</div>
                    <div className="meta-value" style={{ color: '#166534', fontSize: '1.25rem' }}>
                      ₹{selectedItem.amount.toLocaleString()}
                    </div>
                  </>
                )}

                <div className="meta-label">Status</div>
                <div style={{ marginBottom: '16px' }}>
                  <span className="status-indicator" style={getStatusStyle(selectedItem.status)}>
                    {selectedItem.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="meta-label">Tags</div>
                <div className="tag-cloud">
                  {selectedItem.tags.map((tag, idx) => (
                    <span key={idx} className="doc-tag">
                      <FaTag size={8} /> {tag}
                    </span>
                  ))}
                  <span className="doc-tag" style={{ border: '1px dashed #cbd5e1', background: 'none', cursor: 'pointer' }}>+ Add Tag</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', padding: '24px', borderTop: '1px solid #f1f5f9' }}>
                <button 
                  className="btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => selectedItem && openViewer(selectedItem)}
                >
                  Open Integrated Viewer
                </button>
              </div>
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <FaInfoCircle size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>Select a file to view detailed metadata and smart insights.</p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Integrated Document Viewer Modal ── */}
      {isViewerOpen && selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {renderIcon(selectedItem.type, selectedItem.name)}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedItem.name}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{selectedItem.category}</div>
              </div>
            </div>
            <button 
              onClick={() => { setIsViewerOpen(false); if (viewerBlobUrl) { URL.revokeObjectURL(viewerBlobUrl); setViewerBlobUrl(null); } }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '100px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FaTimes /> Close Viewer
            </button>
          </div>

          <div style={{
            flex: 1,
            backgroundColor: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {selectedItem.type === 'pdf' ? (
              viewerBlobUrl || selectedItem.id.startsWith('custom-') ? (
                <iframe
                  src={selectedItem.id.startsWith('custom-') ? 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' : viewerBlobUrl!}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="PDF Content"
                />
              ) : (
                <div style={{ color: '#64748b', fontSize: '14px' }}>Loading document...</div>
              )
            ) : (
                <div style={{ textAlign: 'center' }}>
                   <img
                      src={selectedItem.id.startsWith('custom-') ? 'https://images.unsplash.com/photo-1586282391129-59a998fd4441?q=80&w=2070&auto=format&fit=crop' : (viewerBlobUrl || '')}
                      alt="Content"
                      style={{ maxWidth: '90%', maxHeight: '80vh', borderRadius: '8px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}
                   />
                   <div style={{ marginTop: '20px', color: '#64748b' }}>
                      <FaInfoCircle /> Image content loaded successfully.
                   </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default DocumentManager;
