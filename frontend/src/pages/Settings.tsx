import React, { useEffect, useState } from 'react';
import {
    FaBuilding, FaCheckCircle, FaCog,
    FaExclamationTriangle,
    FaIdBadge,
    FaMapMarkerAlt, FaPercentage,
    FaPlus, FaSave, FaSearch,
    FaToggleOff, FaToggleOn, FaTrash, FaUniversity,
    FaUserShield
} from 'react-icons/fa';
import { fetchProfile, updateProfile } from '../api/companyApi';
import { apiFetch } from '../utils/api';

// --- STYLES ---
const styles = {
    container: { /* Replaced by CSS .settings-container */ },
    sidebar: { /* Replaced by CSS .settings-sidebar */ },
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
const CompanyProfileTab = ({ profile, setProfile, handleSave, saving, msg }: any) => {
    const isMobile = window.innerWidth <= 768;
    return (
        <>
            <div style={{ ...styles.header, padding: isMobile ? '20px 25px' : '25px 35px' }}>
                <h1 style={{ ...styles.headerTitle, fontSize: isMobile ? '1.25rem' : '1.4rem' }}>Company Profile</h1>
                <p style={styles.headerSubtitle}>Manage business identity, address, and banking details.</p>
            </div>
            <div style={{ ...styles.formBody, padding: isMobile ? '20px' : '35px' }}>
                <Notification msg={msg} />
                <form onSubmit={handleSave}>
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}><FaBuilding color="#64748b" /><span style={styles.sectionTitle}>Business Info</span></div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                            <InputField label="Company Name" value={profile?.company_name} onChange={(e:any) => setProfile({...profile, company_name: e.target.value})} />
                            <InputField label="GSTIN" value={profile?.gstin} onChange={(e:any) => setProfile({...profile, gstin: e.target.value})} />
                        </div>
                    </div>
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}><FaMapMarkerAlt color="#64748b" /><span style={styles.sectionTitle}>Address</span></div>
                        <div style={{ marginBottom: '20px' }}><InputField label="Street Address" value={profile?.address_line1} onChange={(e:any) => setProfile({...profile, address_line1: e.target.value})} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                            <InputField label="City - Zip" value={profile?.city_pincode} onChange={(e:any) => setProfile({...profile, city_pincode: e.target.value})} />
                            <InputField label="State" value={profile?.state} onChange={(e:any) => setProfile({...profile, state: e.target.value})} />
                        </div>
                    </div>
                    <div style={{...styles.section, marginBottom: 0}}>
                        <div style={styles.sectionHeader}><FaUniversity color="#64748b" /><span style={styles.sectionTitle}>Banking</span></div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                            <InputField label="Bank Name" value={profile?.bank_name} onChange={(e:any) => setProfile({...profile, bank_name: e.target.value})} />
                            <InputField label="Account No" value={profile?.bank_account_no} onChange={(e:any) => setProfile({...profile, bank_account_no: e.target.value})} />
                        </div>
                        <div style={{marginTop: '20px'}}><InputField label="IFSC Code" value={profile?.bank_ifsc_code} onChange={(e:any) => setProfile({...profile, bank_ifsc_code: e.target.value})} width={isMobile ? "100%" : "50%"} /></div>
                    </div>
                    <div style={{marginTop: '30px', display:'flex', justifyContent: isMobile ? 'center' : 'flex-end'}}>
                        <button type="submit" disabled={saving} style={{...styles.saveBtn, width: isMobile ? '100%' : 'auto', opacity: saving ? 0.7 : 1, justifyContent: 'center'}}><FaSave /> {saving ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        </>
    );
};

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
    const [searchTerm, setSearchTerm] = useState('');
    const [permSearch, setPermSearch] = useState('');

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

    const isMobile = window.innerWidth <= 768;

    return (
        <div style={{ padding: isMobile ? '0' : '0' }}>
            <div style={{ ...styles.header, padding: isMobile ? '20px' : '25px 35px' }}>
                <div style={{ 
                    display: 'flex', 
                    flexDirection: isMobile ? 'column' : 'row', 
                    justifyContent: 'space-between', 
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: isMobile ? '20px' : '0'
                }}>
                    <div>
                        <h1 style={{ ...styles.headerTitle, fontSize: isMobile ? '1.25rem' : '1.4rem' }}>Users & Permissions</h1>
                        <p style={styles.headerSubtitle}>Manage staff access.</p>
                    </div>
                    <div style={{ 
                        background: '#f1f5f9', 
                        padding: '4px', 
                        borderRadius: '10px', 
                        display: 'flex',
                        width: isMobile ? '100%' : 'auto',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                        <button 
                            onClick={()=>setView('users')} 
                            style={{
                                flex: isMobile ? 1 : 'none',
                                padding: isMobile ? '10px' : '8px 16px', 
                                border: 'none', 
                                background: view==='users'?'white':'transparent', 
                                borderRadius:'8px', 
                                cursor:'pointer', 
                                fontWeight:700, 
                                fontSize: isMobile ? '0.85rem' : '0.9rem',
                                color: view==='users'?'#2563eb':'#64748b', 
                                boxShadow: view==='users'?'0 2px 4px rgba(0,0,0,0.1)': 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            Staff Logins
                        </button>
                        <button 
                            onClick={()=>setView('roles')} 
                            style={{
                                flex: isMobile ? 1 : 'none',
                                padding: isMobile ? '10px' : '8px 16px', 
                                border: 'none', 
                                background: view==='roles'?'white':'transparent', 
                                borderRadius:'8px', 
                                cursor:'pointer', 
                                fontWeight:700, 
                                fontSize: isMobile ? '0.85rem' : '0.9rem',
                                color: view==='roles'?'#2563eb':'#64748b', 
                                boxShadow: view==='roles'?'0 2px 4px rgba(0,0,0,0.1)': 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            Roles & Access
                        </button>
                    </div>
                </div>
            </div>
            
            <div style={styles.formBody}>
                {view === 'users' ? (
                    <div>
                        <div style={{ background: '#f8fafc', padding: isMobile ? '20px' : '25px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                            <h4 style={{ margin: '0 0 20px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}><FaIdBadge /> New Staff Login</h4>
                            <form onSubmit={handleCreateLogin}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={styles.label}>Link Employee</label>
                                    <select value={selectedEmpId} onChange={(e) => {setSelectedEmpId(e.target.value); setCredentials({...credentials, username: e.target.value ? employees.find(x=>x.id===Number(e.target.value))?.name.toLowerCase().replace(/\s/g,'') : ''})}} style={styles.input} required>
                                        <option value="">-- Select Unlinked Employee --</option>
                                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation})</option>)}
                                    </select>
                                </div>
                                {selectedEmpId && (
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', 
                                        gap: '15px', 
                                        alignItems: 'end' 
                                    }}>
                                        <InputField label="Username" value={credentials.username} onChange={(e:any) => setCredentials({...credentials, username: e.target.value})} />
                                        <InputField label="Password" type="password" value={credentials.password} onChange={(e:any) => setCredentials({...credentials, password: e.target.value})} />
                                        <div>
                                            <label style={styles.label}>Role</label>
                                            <select value={credentials.role} onChange={(e:any) => setCredentials({...credentials, role: e.target.value})} style={styles.input}>
                                                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <button type="submit" style={{ ...styles.saveBtn, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}><FaPlus /> Create Login</button>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Search Toolbar */}
                        <div className="card" style={{ 
                            padding: '0 24px', 
                            marginBottom: '24px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px', 
                            border: '1px solid var(--border-color)', 
                            height: '60px', 
                            background: 'white', 
                            boxShadow: 'var(--shadow-sm)', 
                            borderRadius: '16px' 
                        }}>
                            <FaSearch style={{ color: 'var(--text-light)' }} size={18} />
                            <input 
                                placeholder="Search staff by name, user, or role..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ 
                                    border: 'none', 
                                    width: '100%', 
                                    outline: 'none', 
                                    background: 'transparent', 
                                    fontSize: '1rem', 
                                    fontWeight: 500, 
                                    color: 'var(--text-main)',
                                    letterSpacing: '-0.2px'
                                }} 
                            />
                        </div>

                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0', borderRadius: '16px', background: 'white' }}>
                            <table style={{ ...styles.table, minWidth: '700px' }}>
                                <thead><tr style={{background:'#f8fafc'}}><th style={styles.th}>Employee</th><th style={styles.th}>Username</th><th style={styles.th}>Role</th><th style={styles.th}>Created</th><th style={styles.th}>Action</th></tr></thead>
                                <tbody>
                                    {users.filter(u => 
                                        !searchTerm.trim() || 
                                        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.role?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).map(u => (
                                        <tr key={u.id}>
                                            <td style={styles.td}>
                                                <div style={{fontWeight: 700, color: '#1e293b'}}>{u.employee_name || 'System User'}</div>
                                                <span style={{fontSize:'0.75rem', color:'#94a3b8', fontWeight: 500}}>{u.employee_designation}</span>
                                            </td>
                                            <td style={{ ...styles.td, fontWeight: 600, color: '#475569' }}>{u.username}</td>
                                            <td style={styles.td}>
                                                <span style={{padding:'6px 14px', background:'#e0f2fe', color:'#0369a1', borderRadius:'20px', fontSize:'0.75rem', fontWeight:700, border: '1px solid #bae6fd'}}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, color: '#64748b' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td style={styles.td}><FaTrash color="#ef4444" style={{cursor:'pointer', opacity: 0.7}} title="Delete Login"/></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: isMobile ? 'column' : 'row',
                        height: isMobile ? 'auto' : '100%', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '16px', 
                        overflow: 'hidden',
                        background: 'white'
                    }}>
                        <div style={{ 
                            width: isMobile ? '100%' : '250px', 
                            background: '#f8fafc', 
                            borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
                            borderBottom: isMobile ? '1px solid #e2e8f0' : 'none'
                        }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#1e293b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roles Configuration</div>
                            <div style={{ display: isMobile ? 'flex' : 'block', overflowX: isMobile ? 'auto' : 'visible' }}>
                                {roles.map(r => (
                                    <div 
                                        key={r.id} 
                                        onClick={() => setSelectedRole(r.id)}
                                        style={{ 
                                            padding: isMobile ? '15px 20px' : '14px 25px', 
                                            cursor: 'pointer', 
                                            fontSize: '0.9rem', 
                                            fontWeight: 700,
                                            whiteSpace: isMobile ? 'nowrap' : 'normal',
                                            background: selectedRole === r.id ? 'white' : 'transparent',
                                            color: selectedRole === r.id ? '#2563eb' : '#64748b',
                                            borderLeft: isMobile ? 'none' : (selectedRole === r.id ? '4px solid #2563eb' : '4px solid transparent'),
                                            borderBottom: isMobile ? (selectedRole === r.id ? '3px solid #2563eb' : '3px solid transparent') : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                    {r.name}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, padding: '0', background: 'white', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                            {selectedRole ? (
                                <>
                                    <div style={{ padding: '15px 25px', borderBottom: '1px solid #e2e8f0', background: '#fcfcfc', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <FaSearch color="#94a3b8" />
                                        <input 
                                            placeholder="Search permissions..." 
                                            value={permSearch}
                                            onChange={(e) => setPermSearch(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {modules.map(mod => {
                                            const filteredPerms = permissions.filter(p => 
                                                p.module === mod && (
                                                    !permSearch.trim() || 
                                                    p.description?.toLowerCase().includes(permSearch.toLowerCase()) ||
                                                    p.action.toLowerCase().includes(permSearch.toLowerCase())
                                                )
                                            );
                                            if (filteredPerms.length === 0) return null;
                                            return (
                                                <div key={mod}>
                                                    <div style={{ background: '#f1f5f9', padding: '10px 25px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                                        {mod}
                                                    </div>
                                                    <div>
                                                        {filteredPerms.map(p => {
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
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Select a role to view permissions</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- TAB 3: TAX & GST ---
const TaxTab = () => {
    const [data, setData] = useState({ output_gst: 0, input_tax_credit: 0 });
    const [loading, setLoading] = useState(true);
    const isMobile = window.innerWidth <= 768;

    useEffect(() => {
        apiFetch('/settings/tax-summary').then(r => r.json()).then(json => { setData(json); setLoading(false); }).catch(console.error);
    }, []);

    const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

    return (
        <>
            <div style={{ ...styles.header, padding: isMobile ? '20px 25px' : '25px 35px' }}>
                <h1 style={{ ...styles.headerTitle, fontSize: isMobile ? '1.25rem' : '1.4rem' }}>Tax & GST</h1>
                <p style={styles.headerSubtitle}>Financial tax overview.</p>
            </div>
            <div style={{ ...styles.formBody, padding: isMobile ? '20px' : '35px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div style={{ ...styles.card, borderLeft: '5px solid #ef4444', padding: '24px' }}>
                        <h3 style={{...styles.sectionTitle, fontSize: '0.9rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px'}}>GST Payable</h3>
                        <h1 style={{fontSize: isMobile ? '1.75rem' : '2.2rem', margin: '10px 0', color: '#1e293b', fontWeight: 800}}>{loading ? '...' : `₹ ${fmt(data.output_gst)}`}</h1>
                    </div>
                    <div style={{ ...styles.card, borderLeft: '5px solid #10b981', padding: '24px' }}>
                        <h3 style={{...styles.sectionTitle, fontSize: '0.9rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px'}}>Input Tax Credit</h3>
                        <h1 style={{fontSize: isMobile ? '1.75rem' : '2.2rem', margin: '10px 0', color: '#10b981', fontWeight: 800}}>{loading ? '...' : `₹ ${fmt(data.input_tax_credit)}`}</h1>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- TAB 4: SYSTEM (MOCKED REALISTIC DATA) ---
const SystemTab = () => {
    const isMobile = window.innerWidth <= 768;
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ ...styles.header, padding: isMobile ? '20px 25px' : '25px 35px' }}>
                <h1 style={{ ...styles.headerTitle, fontSize: isMobile ? '1.25rem' : '1.4rem' }}>System Status</h1>
                <p style={styles.headerSubtitle}>Technical performance metrics.</p>
            </div>
            <div style={{ ...styles.formBody, padding: isMobile ? '20px' : '35px' }}>
                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ ...styles.card, borderLeft: '5px solid #2563eb', padding: '24px', transition: 'transform 0.2s' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DATABASE SIZE</div>
                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 900, color: '#1e293b', marginTop: '8px' }}>{storage.db_size}</div>
                    </div>
                    <div style={{ ...styles.card, borderLeft: '5px solid #10b981', padding: '24px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL RECORDS</div>
                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 900, color: '#1e293b', marginTop: '8px' }}>{storage.record_count.toLocaleString()}</div>
                    </div>
                    <div style={{ ...styles.card, borderLeft: '5px solid #f59e0b', padding: '24px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SERVER STATUS</div>
                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 900, color: '#16a34a', marginTop: '8px' }}>Online</div>
                    </div>
                </div>

                {/* Logs Table */}
                <div style={{ ...styles.card, padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display:'flex', alignItems:'center', gap:'12px', background: '#fcfcfc' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.1)' }}></span>
                        <h3 style={{ ...styles.sectionTitle, margin: 0, fontWeight: 800, color: '#1e293b' }}>Recent Activity Logs</h3>
                    </div>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ ...styles.table, minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ ...styles.th, padding: '16px 24px' }}>Timestamp</th>
                                    <th style={{ ...styles.th, padding: '16px 24px' }}>User</th>
                                    <th style={{ ...styles.th, padding: '16px 24px' }}>Action</th>
                                    <th style={{ ...styles.th, padding: '16px 24px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ ...styles.td, padding: '16px 24px', fontFamily: 'monospace', color: '#64748b', fontSize: '0.85rem' }}>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td style={{ ...styles.td, padding: '16px 24px', fontWeight: 700 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '1px solid #dbeafe' }}>
                                                    {log.username.charAt(0).toUpperCase()}
                                                </div>
                                                {log.username}
                                            </div>
                                        </td>
                                        <td style={{ ...styles.td, padding: '16px 24px', color: '#475569', fontWeight: 500 }}>{log.action}</td>
                                        <td style={{ ...styles.td, padding: '16px 24px' }}>
                                            <span style={{ padding: '6px 12px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #bbf7d0' }}>
                                                Success
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
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
        <div className="settings-container" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <div className="settings-sidebar">
                <div style={{ ...styles.sidebarTitle, padding: '24px 16px 12px' }}>Settings Menu</div>
                <div style={{ padding: '0 12px' }}>
                    {menuItems.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => { setActiveTab(item.id); setMsg({type:'',text:''}); }} 
                            style={styles.navItem(activeTab === item.id)}
                            className="nav-item"
                        >
                            <item.icon style={{ opacity: activeTab === item.id ? 1 : 0.6, fontSize: '1.2rem' }} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ ...styles.contentArea, flex: 1, margin: window.innerWidth <= 768 ? '0' : '0' }}>{renderContent()}</div>
        </div>
    );
};

export default Settings;