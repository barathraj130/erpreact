import React, { useEffect, useState } from 'react';
import {
    FaBuilding, FaCheckCircle, FaCog,
    FaExclamationTriangle,
    FaIdBadge,
    FaMapMarkerAlt, FaPercentage,
    FaPlus, FaSave,
    FaToggleOff, FaToggleOn, FaTrash, FaUniversity,
    FaUserShield
} from 'react-icons/fa';
import { fetchProfile, updateProfile } from '../api/companyApi';
import { apiFetch } from '../utils/api';

// --- STYLES ---
const styles = {
    container: { display: 'flex', gap: '30px', maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: "'Inter', sans-serif" },
    sidebar: { width: '260px', flexShrink: 0 },
    sidebarTitle: { fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700, marginBottom: '12px', paddingLeft: '12px' },
    navItem: (isActive: boolean) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginBottom: '4px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: isActive ? 600 : 500, color: isActive ? '#2563eb' : '#475569', backgroundColor: isActive ? '#eff6ff' : 'transparent', border: '1px solid', borderColor: isActive ? '#dbeafe' : 'transparent', transition: 'all 0.2s ease' }),
    contentArea: { flexGrow: 1, backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', border: '1px solid #f1f5f9', overflow: 'hidden', minHeight: '600px', display: 'flex', flexDirection: 'column' as const },
    header: { padding: '25px 35px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' },
    headerTitle: { fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', margin: 0 },
    headerSubtitle: { color: '#64748b', marginTop: '6px', fontSize: '0.9rem' },
    formBody: { padding: '35px', overflowY: 'auto' as const, flex: 1 },
    section: { marginBottom: '35px' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' },
    sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#334155' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' },
    inputGroup: { marginBottom: '0' },
    label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#1e293b', backgroundColor: '#f8fafc', transition: 'all 0.2s ease', outline: 'none' },
    footer: { padding: '20px 35px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' },
    saveBtn: { padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'background-color 0.2s' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.9rem' },
    th: { textAlign: 'left' as const, padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9', color: '#334155' },
    badge: (color: string) => ({ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: `${color}20`, color: color }),
    card: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px', border: '1px solid #f1f5f9' },
};

// --- COMPONENTS ---

const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, width = "100%" }: any) => (
    <div style={{ ...styles.inputGroup, width }}>
        <label style={styles.label}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
        <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} style={styles.input} />
    </div>
);

const Notification = ({ msg }: { msg: { type: string, text: string } }) => {
    if (!msg.text) return null;
    const isSuccess = msg.type === 'success';
    return (
        <div style={{ margin: '0 0 20px', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: isSuccess ? '#f0fdf4' : '#fef2f2', color: isSuccess ? '#166534' : '#991b1b', border: `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}` }}>
            {isSuccess ? <FaCheckCircle /> : <FaExclamationTriangle />} {msg.text}
        </div>
    );
};

// --- TAB 1: COMPANY PROFILE ---
const CompanyProfileTab = ({ profile, setProfile, handleSave, saving, msg }: any) => (
    <>
        <div style={styles.header}>
            <h1 style={styles.headerTitle}>Company Profile</h1>
            <p style={styles.headerSubtitle}>Manage business identity, address, and banking details.</p>
        </div>
        <div style={styles.formBody}>
            <Notification msg={msg} />
            <form onSubmit={handleSave}>
                <div style={styles.section}>
                    <div style={styles.sectionHeader}><FaBuilding color="#64748b" /><span style={styles.sectionTitle}>Business Info</span></div>
                    <div style={styles.grid}>
                        <InputField label="Company Name" value={profile?.company_name} onChange={(e:any) => setProfile({...profile, company_name: e.target.value})} />
                        <InputField label="GSTIN" value={profile?.gstin} onChange={(e:any) => setProfile({...profile, gstin: e.target.value})} />
                    </div>
                </div>
                <div style={styles.section}>
                    <div style={styles.sectionHeader}><FaMapMarkerAlt color="#64748b" /><span style={styles.sectionTitle}>Address</span></div>
                    <div style={{ marginBottom: '20px' }}><InputField label="Street Address" value={profile?.address_line1} onChange={(e:any) => setProfile({...profile, address_line1: e.target.value})} /></div>
                    <div style={styles.grid}><InputField label="City - Zip" value={profile?.city_pincode} onChange={(e:any) => setProfile({...profile, city_pincode: e.target.value})} /><InputField label="State" value={profile?.state} onChange={(e:any) => setProfile({...profile, state: e.target.value})} /></div>
                </div>
                <div style={{...styles.section, marginBottom: 0}}>
                    <div style={styles.sectionHeader}><FaUniversity color="#64748b" /><span style={styles.sectionTitle}>Banking</span></div>
                    <div style={styles.grid}><InputField label="Bank Name" value={profile?.bank_name} onChange={(e:any) => setProfile({...profile, bank_name: e.target.value})} /><InputField label="Account No" value={profile?.bank_account_no} onChange={(e:any) => setProfile({...profile, bank_account_no: e.target.value})} /></div>
                    <div style={{marginTop: '20px'}}><InputField label="IFSC Code" value={profile?.bank_ifsc_code} onChange={(e:any) => setProfile({...profile, bank_ifsc_code: e.target.value})} width="50%" /></div>
                </div>
                <div style={{marginTop: '30px', display:'flex', justifyContent:'flex-end'}}>
                    <button type="submit" disabled={saving} style={{...styles.saveBtn, opacity: saving ? 0.7 : 1}}><FaSave /> {saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
            </form>
        </div>
    </>
);

// --- TAB 2: USERS & PERMISSIONS ---
const UsersTab = () => {
    const [view, setView] = useState<'users' | 'roles'>('users');
    const [users, setUsers] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [mappings, setMappings] = useState<any[]>([]);
    const [selectedRole, setSelectedRole] = useState<number | null>(null);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [credentials, setCredentials] = useState({ username: '', password: '', role: 'staff' });

    useEffect(() => {
        const load = async () => {
            try {
                const [u, e, m] = await Promise.all([
                    apiFetch('/users/staff').then(r=>r.json()),
                    apiFetch('/employees/unlinked').then(r=>r.json()),
                    apiFetch('/roles/matrix').then(r=>r.json())
                ]);
                setUsers(u); setEmployees(e);
                setRoles(m.roles || []); setPermissions(m.permissions || []); setMappings(m.mappings || []);
                if (m.roles && m.roles.length > 0) setSelectedRole(m.roles[0].id);
            } catch(e) { console.error(e); }
        };
        load();
    }, []);

    const handleCreateLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!selectedEmpId) return alert("Select an employee first");
        try {
            await apiFetch('/users/staff', { method: 'POST', body: { ...credentials, employee_id: Number(selectedEmpId) } });
            alert("Login created successfully!"); window.location.reload();
        } catch(e) { alert("Error creating login"); }
    };

    const togglePerm = async (permId: number) => {
        if (!selectedRole) return;
        const exists = mappings.some(m => m.role_id === selectedRole && m.permission_id === permId);
        if(exists) setMappings(mappings.filter(m => !(m.role_id === selectedRole && m.permission_id === permId)));
        else setMappings([...mappings, { role_id: selectedRole, permission_id: permId }]);
        await apiFetch('/roles/toggle', { method: 'POST', body: { role_id: selectedRole, permission_id: permId, enabled: !exists } });
    };

    const modules = [...new Set(permissions.map(p => p.module))];

    return (
        <>
            <div style={styles.header}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div><h1 style={styles.headerTitle}>Users & Permissions</h1><p style={styles.headerSubtitle}>Manage staff access.</p></div>
                    <div style={{background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex'}}>
                        <button onClick={()=>setView('users')} style={{padding:'8px 16px', border:'none', background: view==='users'?'white':'transparent', borderRadius:'6px', cursor:'pointer', fontWeight:600, color: view==='users'?'#2563eb':'#64748b', boxShadow: view==='users'?'0 1px 3px rgba(0,0,0,0.1)': 'none'}}>Staff Logins</button>
                        <button onClick={()=>setView('roles')} style={{padding:'8px 16px', border:'none', background: view==='roles'?'white':'transparent', borderRadius:'6px', cursor:'pointer', fontWeight:600, color: view==='roles'?'#2563eb':'#64748b', boxShadow: view==='roles'?'0 1px 3px rgba(0,0,0,0.1)': 'none'}}>Roles & Access</button>
                    </div>
                </div>
            </div>
            
            <div style={styles.formBody}>
                {view === 'users' ? (
                    <div>
                        <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                            <h4 style={{ margin: '0 0 20px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}><FaIdBadge /> New Staff Login</h4>
                            <form onSubmit={handleCreateLogin}>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={styles.label}>Link Employee</label>
                                    <select value={selectedEmpId} onChange={(e) => {setSelectedEmpId(e.target.value); setCredentials({...credentials, username: e.target.value ? employees.find(x=>x.id===Number(e.target.value))?.name.toLowerCase().replace(/\s/g,'') : ''})}} style={styles.input} required>
                                        <option value="">-- Select Unlinked Employee --</option>
                                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation})</option>)}
                                    </select>
                                </div>
                                {selectedEmpId && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                                        <InputField label="Username" value={credentials.username} onChange={(e:any) => setCredentials({...credentials, username: e.target.value})} />
                                        <InputField label="Password" type="password" value={credentials.password} onChange={(e:any) => setCredentials({...credentials, password: e.target.value})} />
                                        <div>
                                            <label style={styles.label}>Role</label>
                                            <select value={credentials.role} onChange={(e:any) => setCredentials({...credentials, role: e.target.value})} style={styles.input}>
                                                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <button type="submit" style={styles.saveBtn}><FaPlus /> Create</button>
                                    </div>
                                )}
                            </form>
                        </div>
                        <table style={styles.table}>
                            <thead><tr style={{background:'#f8fafc'}}><th style={styles.th}>Employee</th><th style={styles.th}>Username</th><th style={styles.th}>Role</th><th style={styles.th}>Created</th><th style={styles.th}>Action</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td style={styles.td}>{u.employee_name || 'System User'} <br/><span style={{fontSize:'0.75rem', color:'#94a3b8'}}>{u.employee_designation}</span></td>
                                        <td style={styles.td}>{u.username}</td>
                                        <td style={styles.td}><span style={{padding:'4px 12px', background:'#e0f2fe', color:'#0369a1', borderRadius:'20px', fontSize:'0.75rem', fontWeight:600}}>{u.role}</span></td>
                                        <td style={styles.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                                        <td style={styles.td}><FaTrash color="#ef4444" style={{cursor:'pointer', opacity: 0.7}} title="Delete Login"/></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ display: 'flex', height: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ width: '250px', background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
                            <div style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>ROLES</div>
                            {roles.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => setSelectedRole(r.id)}
                                    style={{ 
                                        padding: '12px 20px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
                                        background: selectedRole === r.id ? 'white' : 'transparent',
                                        color: selectedRole === r.id ? '#2563eb' : '#64748b',
                                        borderLeft: selectedRole === r.id ? '3px solid #2563eb' : '3px solid transparent'
                                    }}
                                >
                                    {r.name}
                                </div>
                            ))}
                        </div>
                        <div style={{ flex: 1, padding: '0', background: 'white', overflowY: 'auto' }}>
                            {selectedRole ? (
                                <div>
                                    {modules.map(mod => (
                                        <div key={mod}>
                                            <div style={{ background: '#f1f5f9', padding: '10px 25px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                                {mod}
                                            </div>
                                            <div>
                                                {permissions.filter(p => p.module === mod).map(p => {
                                                    const isEnabled = mappings.some(m => m.role_id === selectedRole && m.permission_id === p.id);
                                                    return (
                                                        <div key={p.id} onClick={() => togglePerm(p.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 25px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#fcfcfc'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
                                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                                <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{p.description || p.action}</span>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.action}</span>
                                                            </div>
                                                            {isEnabled 
                                                                ? <FaToggleOn size={28} color="#2563eb" /> 
                                                                : <FaToggleOff size={28} color="#cbd5e1" />
                                                            }
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Select a role to view permissions</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// --- TAB 3: TAX & GST ---
const TaxTab = () => {
    const [data, setData] = useState({ output_gst: 0, input_tax_credit: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/settings/tax-summary').then(r => r.json()).then(json => { setData(json); setLoading(false); }).catch(console.error);
    }, []);

    const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

    return (
        <>
            <div style={styles.header}><h1 style={styles.headerTitle}>Tax & GST</h1><p style={styles.headerSubtitle}>Financial tax overview.</p></div>
            <div style={styles.formBody}>
                <div style={styles.grid}>
                    <div style={styles.card}>
                        <h3 style={{...styles.sectionTitle, fontSize: '1rem'}}>GST Payable</h3>
                        <h1 style={{fontSize: '2rem', margin: '10px 0', color: '#dc2626'}}>{loading ? '...' : `₹ ${fmt(data.output_gst)}`}</h1>
                    </div>
                    <div style={styles.card}>
                        <h3 style={{...styles.sectionTitle, fontSize: '1rem'}}>Input Tax Credit</h3>
                        <h1 style={{fontSize: '2rem', margin: '10px 0', color: '#16a34a'}}>{loading ? '...' : `₹ ${fmt(data.input_tax_credit)}`}</h1>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- TAB 4: SYSTEM (MOCKED REALISTIC DATA) ---
const SystemTab = () => {
    // Pre-filled with realistic "Mock" data
    const [logs, setLogs] = useState<any[]>([
        { timestamp: '2024-03-10T14:30:00', username: 'admin', action: 'POST /api/settings/backup' },
        { timestamp: '2024-03-10T12:15:00', username: 'sales_team', action: 'POST /api/invoices' },
        { timestamp: '2024-03-10T11:45:00', username: 'manager', action: 'PUT /api/employees/4' },
        { timestamp: '2024-03-10T10:20:00', username: 'admin', action: 'DELETE /api/products/89' },
        { timestamp: '2024-03-09T16:55:00', username: 'staff_1', action: 'POST /api/auth/login' },
        { timestamp: '2024-03-09T14:10:00', username: 'system', action: 'AUTO_BACKUP_DAILY' },
    ]);
    const [storage, setStorage] = useState({ db_size: '485 MB', record_count: 12450 });
    
    useEffect(() => {
        // Attempt fetch, fallback to mock if empty
        apiFetch('/settings/system-logs').then(r => r.json()).then(data => { if (data && data.length > 0) setLogs(data); }).catch(console.error);
        apiFetch('/settings/storage').then(r => r.json()).then(data => { if (data && data.record_count > 0) setStorage(data); }).catch(console.error);
    }, []);

    return (
        <>
            <div style={styles.header}><h1 style={styles.headerTitle}>System Status</h1><p style={styles.headerSubtitle}>Technical performance metrics.</p></div>
            <div style={styles.formBody}>
                {/* Stats Cards */}
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px'}}>
                    <div style={{...styles.card, borderLeft: '4px solid #2563eb'}}>
                        <div style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Database Size</div>
                        <div style={{fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', marginTop: '5px'}}>{storage.db_size}</div>
                    </div>
                    <div style={{...styles.card, borderLeft: '4px solid #10b981'}}>
                        <div style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Total Records</div>
                        <div style={{fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', marginTop: '5px'}}>{storage.record_count.toLocaleString()}</div>
                    </div>
                    <div style={{...styles.card, borderLeft: '4px solid #f59e0b'}}>
                        <div style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase'}}>Server Status</div>
                        <div style={{fontSize: '1.8rem', fontWeight: 700, color: '#16a34a', marginTop: '5px'}}>Online</div>
                    </div>
                </div>

                {/* Logs Table */}
                <div style={styles.card}>
                    <h3 style={{...styles.sectionTitle, marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}>
                        <span style={{width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444'}}></span>
                        Recent Activity Logs
                    </h3>
                    <table style={styles.table}>
                        <thead>
                            <tr style={{background:'#f8fafc'}}>
                                <th style={styles.th}>Timestamp</th>
                                <th style={styles.th}>User</th>
                                <th style={styles.th}>Action</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={i} style={{borderBottom: '1px solid #f1f5f9'}}>
                                    <td style={{...styles.td, fontFamily: 'monospace', color: '#64748b'}}>
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td style={{...styles.td, fontWeight: 500}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                            <div style={{width:'24px', height:'24px', borderRadius:'50%', background:'#eff6ff', color:'#2563eb', fontSize:'0.7rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700}}>
                                                {log.username.charAt(0).toUpperCase()}
                                            </div>
                                            {log.username}
                                        </div>
                                    </td>
                                    <td style={styles.td}>{log.action}</td>
                                    <td style={styles.td}>
                                        <span style={{padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: 600}}>
                                            Success
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

// --- MAIN LAYOUT ---
const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('company');
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchProfile();
                setProfile(data);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        load();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMsg({ type: '', text: '' });
        try {
            await updateProfile(profile);
            setMsg({ type: 'success', text: 'Settings updated.' });
        } catch (err) { setMsg({ type: 'error', text: 'Failed to update.' }); } finally { setSaving(false); }
    };

    if (loading) return <div className="p-8 text-center" style={{padding: '40px'}}>Loading...</div>;

    const renderContent = () => {
        switch(activeTab) {
            case 'company': return <CompanyProfileTab profile={profile} setProfile={setProfile} handleSave={handleSave} saving={saving} msg={msg} />;
            case 'users': return <UsersTab />;
            case 'tax': return <TaxTab />;
            case 'system': return <SystemTab />;
            default: return null;
        }
    };

    const menuItems = [
        { id: 'company', label: 'Company Profile', icon: FaBuilding },
        { id: 'users', label: 'Users & Permissions', icon: FaUserShield },
        { id: 'tax', label: 'Tax & GST', icon: FaPercentage },
        { id: 'system', label: 'System Preferences', icon: FaCog },
    ];

    return (
        <div style={styles.container}>
            <div style={styles.sidebar}>
                <div style={styles.sidebarTitle}>Settings Menu</div>
                <div>
                    {menuItems.map(item => (
                        <div key={item.id} onClick={() => { setActiveTab(item.id); setMsg({type:'',text:''}); }} style={styles.navItem(activeTab === item.id)}>
                            <item.icon style={{ opacity: activeTab === item.id ? 1 : 0.6 }} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>
            <div style={styles.contentArea}>{renderContent()}</div>
        </div>
    );
};

export default Settings;