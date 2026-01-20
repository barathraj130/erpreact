import React, { useState } from "react";
import { FaEdit, FaEye, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuthUser } from "../hooks/useAuthUser"; // Needed for permission check
import { useInvoices } from "../hooks/useInvoices";
import { apiFetch } from "../utils/api";

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const { invoices, loading, refresh } = useInvoices(); 
  const { user } = useAuthUser(); // Get logged in user
  const [searchTerm, setSearchTerm] = useState('');

  // --- HELPER: CHECK DELETE PERMISSION ---
  const canDelete = user?.role === 'admin' || user?.permissions?.some((p: any) => p.action === 'delete_invoices');

  const handleDelete = async (id: number) => {
    if(!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
        await apiFetch(`/invoice/${id}`, { method: 'DELETE' });
        refresh();
    } catch (err) {
        alert("Failed to delete invoice (Access Denied or Server Error)");
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '24px' }}>
          <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Invoices</h1>
              <p style={{ color: '#64748b' }}>Manage your sales.</p>
          </div>
          {/* Create Button - Protected by Route/Sidebar usually, but good to check here too */}
          <button className="btn-primary" onClick={() => navigate('/invoices/new')}>
              <FaPlus /> Create Invoice
          </button>
      </div>

      <div className="card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', gap: '15px' }}>
          <FaSearch style={{ color: '#94a3b8' }} />
          <input 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', width: '100%', outline: 'none' }} 
          />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '16px', textAlign: 'left' }}>Invoice #</th>
              <th style={{ padding: '16px', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '16px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontWeight: 500, color: '#3b82f6' }}>{inv.invoice_number}</td>
                <td style={{ padding: '16px' }}>{inv.customer_name}</td>
                <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>₹{Number(inv.total_amount).toLocaleString()}</td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button onClick={() => navigate(`/invoices/${inv.id}`)} style={{ color: '#64748b', marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer' }} title="View">
                        <FaEye />
                    </button>
                    <button onClick={() => navigate(`/invoices/edit/${inv.id}`)} style={{ color: '#3b82f6', marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">
                        <FaEdit />
                    </button>
                    
                    {/* --- CONDITIONAL DELETE BUTTON --- */}
                    {canDelete && (
                        <button onClick={() => handleDelete(inv.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete">
                            <FaTrash />
                        </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Invoices;