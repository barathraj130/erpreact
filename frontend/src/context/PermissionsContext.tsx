import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface PermissionsState {
  is_admin: boolean;
  has_custom_permissions: boolean;
  permissions: Record<string, ModulePermission>;
  loaded: boolean;
}

interface PermissionsContextValue extends PermissionsState {
  canView:   (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canEdit:   (module: string) => boolean;
  canDelete: (module: string) => boolean;
  reload:    () => void;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  is_admin: false,
  has_custom_permissions: false,
  permissions: {},
  loaded: false,
  canView:   () => true,
  canCreate: () => true,
  canEdit:   () => true,
  canDelete: () => true,
  reload: () => {},
});

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PermissionsState>({
    is_admin: false,
    has_custom_permissions: false,
    permissions: {},
    loaded: false,
  });

  const fetchPermissions = async () => {
    try {
      const res = await apiFetch("/auth/my-permissions");
      if (res.ok) {
        const data = await res.json();
        setState({ ...data, loaded: true });
      } else {
        setState(s => ({ ...s, loaded: true }));
      }
    } catch {
      setState(s => ({ ...s, loaded: true }));
    }
  };

  useEffect(() => { fetchPermissions(); }, []);

  const check = (module: string, action: keyof ModulePermission): boolean => {
    // Admin or no custom permissions configured → allow everything (safe rollout default)
    if (state.is_admin || !state.has_custom_permissions) return true;
    const mod = state.permissions[module];
    if (!mod) return false;
    return mod[action] === true;
  };

  return (
    <PermissionsContext.Provider value={{
      ...state,
      canView:   (m) => check(m, "can_view"),
      canCreate: (m) => check(m, "can_create"),
      canEdit:   (m) => check(m, "can_edit"),
      canDelete: (m) => check(m, "can_delete"),
      reload: fetchPermissions,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionsContext);
