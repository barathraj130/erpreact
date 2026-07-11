// frontend/src/types/index.ts

export type UserRole = 'admin' | 'staff' | 'customer' | 'superadmin' | 'branch_manager' | 'billing_staff';

export interface User {
  id: number;
  email: string;
  name: string;
  username?: string;
  role: UserRole;
  company_id: number;
  branch_id: number;
  active_company_id?: number;
  company?: string;
  signature_url?: string;
  permissions?: Array<{ action: string; resource?: string }>;
  iat?: number;
  exp?: number;
}

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  loading: boolean;
  error: string | null;
}
