import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiFetch } from "../utils/api";

interface Branch {
  id: number;
  branch_name: string;
  branch_code: string;
}

interface TenantContextType {
  activeBranch: Branch | null;
  branches: Branch[];
  setActiveBranch: (branch: Branch) => void;
  refreshBranches: () => Promise<void>;
  isLoadingBranches: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuthUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const refreshBranches = async () => {
    if (!user) return;
    setIsLoadingBranches(true);
    try {
      // Use apiFetch so the base URL is always correct (no double /api in production)
      const res = await apiFetch("/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);

        // Set default branch if none selected
        const savedBranchId = localStorage.getItem("active-branch-id");
        if (savedBranchId === 'all' && user?.role === 'admin') {
          // @ts-ignore
          setActiveBranchState({ id: 'all', branch_name: 'All Branches', branch_code: 'ALL' });
        } else if (savedBranchId) {
          const found = data.find(
            (b: Branch) => b.id.toString() === savedBranchId,
          );
          if (found) {
            setActiveBranchState(found);
          } else if (data.length > 0) {
             if (user?.role === 'admin') {
                // @ts-ignore
                setActiveBranch({ id: 'all', branch_name: 'All Branches', branch_code: 'ALL' });
             } else {
                setActiveBranch(data[0]);
             }
          }
        } else if (data.length > 0) {
          if (user?.role === 'admin') {
            // @ts-ignore
            setActiveBranch({ id: 'all', branch_name: 'All Branches', branch_code: 'ALL' });
          } else {
            setActiveBranch(data[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setIsLoadingBranches(false);
    }

  };

  const setActiveBranch = (branch: Branch) => {
    setActiveBranchState(branch);
    localStorage.setItem("active-branch-id", branch.id.toString());
    // Trigger a custom event so apiFetch can update its headers if needed
    window.dispatchEvent(new Event("branchChanged"));
  };

  useEffect(() => {
    if (user) {
      refreshBranches();
    } else {
      setBranches([]);
      setActiveBranchState(null);
    }
  }, [user]);

  return (
    <TenantContext.Provider
      value={{
        activeBranch,
        branches,
        setActiveBranch,
        refreshBranches,
        isLoadingBranches,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context)
    throw new Error("useTenant must be used within a TenantProvider");
  return context;
};
