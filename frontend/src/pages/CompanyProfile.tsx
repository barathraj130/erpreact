// frontend/src/pages/CompanyProfile.tsx

import React, { useCallback, useEffect, useState } from 'react';
// NOTE: You would need to create companyApi.ts later
// import { fetchProfile, updateProfile, fetchBankAccounts, createBankAccount, deleteBankAccount } from '../api/companyApi';

const CompanyProfile: React.FC = () => {
    const [profile, setProfile] = useState<any>({});
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Mock fetch functions until companyApi.ts is implemented
    const mockFetchProfile = async () => ({ id: 1, company_name: "JBS KNITWEAR", gstin: "33CKAPJ7513F1ZK", phone: "9791902205", email: "contact@jbsknitwear.com", address_line1: "3/2B, Nesavalar Colony", bank_name: "ICICI", bank_account_no: "123456" });
    const mockFetchBankAccounts = async () => ([
        { id: 1, bank_name: "ICICI Bank", account_number: "106105501618", ifsc_code: "ICIC0001061", account_type: "Savings", is_default: 1 },
        { id: 2, bank_name: "HDFC Bank", account_number: "9876543210", ifsc_code: "HDFC0000020", account_type: "Current", is_default: 0 },
    ]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [profileData, bankData] = await Promise.all([
                mockFetchProfile(), 
                mockFetchBankAccounts()
            ]);
            setProfile(profileData);
            setBankAccounts(bankData);
        } catch (err) {
            setError('Failed to load company data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Profile saved! (Implementation needed in companyApi.ts)');
        // Implement API call: updateProfile(profile.id, formData)
    };
    
    const handleDeleteBank = (id: number) => {
        if (window.confirm(`Are you sure you want to delete bank account #${id}?`)) {
            // Implement API call: deleteBankAccount(id).then(loadData)
            alert(`Bank account ${id} deleted (Mock).`);
            loadData();
        }
    };
    
    if (loading) return <section className="app-section"><p>Loading company configuration...</p></section>;
    if (error) return <section className="app-section"><p className="text-danger">{error}</p></section>;

    return (
        <section id="companySection" className="app-section">
            <div className="section-header">
                <h2>Company Operations</h2>
                <div>
                    <button className="btn btn-primary" onClick={() => {/* openExpenseModal() */}}><i className="fas fa-plus"></i> New Expense</button>
                </div>
            </div>

            <h3 className="section-subheader">Company Profile for Printing</h3>
            <div className="form-container" style={{padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: 'var(--box-shadow)'}}>
                <form onSubmit={handleProfileSubmit}>
                    <fieldset>
                        <legend>Company Information</legend>
                        <div className="form-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
                            <div className="form-group grid-col-span-2">
                                <label>Company Name*</label>
                                <input type="text" value={profile.company_name || ''} onChange={(e) => setProfile({...profile, company_name: e.target.value})} required className="form-control" />
                            </div>
                            <div className="form-group">
                                <label>GSTIN</label>
                                <input type="text" value={profile.gstin || ''} onChange={(e) => setProfile({...profile, gstin: e.target.value})} className="form-control" />
                            </div>
                            {/* ... other contact and address fields using input elements and state management ... */}
                        </div>
                    </fieldset>
                    <button type="submit" className="btn btn-primary">Save Company Profile</button>
                </form>
            </div>

            <h3 className="section-subheader">Bank Accounts</h3>
            <div className="section-header" style={{borderBottom: 'none', paddingBottom: '0'}}>
               <div></div>
               <button className="btn btn-secondary" onClick={() => {/* openBankAccountModal() */}}><i className="fas fa-plus"></i> Add Bank Account</button>
            </div>
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Bank Name</th>
                            <th>Account Number</th>
                            <th>IFSC</th>
                            <th>Type</th>
                            <th>Default</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bankAccounts.map(account => (
                            <tr key={account.id}>
                                <td>{account.bank_name}</td>
                                <td>{account.account_number}</td>
                                <td>{account.ifsc_code || '-'}</td>
                                <td>{account.account_type}</td>
                                <td>{account.is_default ? 'Yes' : 'No'}</td>
                                <td className="actions-cell">
                                    <button className="btn btn-primary btn-sm" onClick={() => {/* openBankAccountModal(account) */}}>Edit</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBank(account.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default CompanyProfile;