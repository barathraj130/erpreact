import React from "react";
import { usePermissions } from "../context/PermissionsContext";

type Action = "view" | "create" | "edit" | "delete";

interface Props {
  module: string;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only when the current user has the required permission.
 * Renders fallback (default: nothing) when permission is denied.
 */
const ProtectedAction: React.FC<Props> = ({ module, action, children, fallback = null }) => {
  const perms = usePermissions();

  const allowed =
    action === "view"   ? perms.canView(module)   :
    action === "create" ? perms.canCreate(module)  :
    action === "edit"   ? perms.canEdit(module)    :
    action === "delete" ? perms.canDelete(module)  : false;

  return <>{allowed ? children : fallback}</>;
};

export default ProtectedAction;
