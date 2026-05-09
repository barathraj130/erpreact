// frontend/src/types/index.ts

export type UserRole = 'admin' | 'staff' | 'customer' | 'superadmin' | 'branch_manager';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  company_id: number;
  branch_id: number;
  active_company_id?: number;
  company?: string;
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
