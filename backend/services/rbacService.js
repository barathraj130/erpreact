// backend/services/rbacService.js
import * as db from "../database/pg.js";

/**
 * Check if user has permission for a module:action
 */
export const checkPermission = async (userId, module, action) => {
    try {
        const result = await db.pgGet(
            `SELECT COUNT(*) as count
             FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             JOIN roles r ON rp.role_id = r.id
             JOIN users u ON u.role_id = r.id
             WHERE u.id = $1 AND LOWER(p.module) = LOWER($2) AND LOWER(p.action) = LOWER($3)`,
            [userId, module, action]
        );
        return result.count > 0;
    } catch (err) {
        console.error("Permission check error:", err);
        return false;
    }
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = async (roleId) => {
    try {
        const permissions = await db.pgAll(
            `SELECT p.module, p.action, p.description
             FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             WHERE rp.role_id = $1`,
            [roleId]
        );
        return permissions;
    } catch (err) {
        console.error("Get role permissions error:", err);
        return [];
    }
};

/**
 * Get all roles
 */
export const getAllRoles = async (companyId) => {
    try {
        const roles = await db.pgAll(
            `SELECT * FROM roles WHERE company_id = $1 ORDER BY created_at DESC`,
            [companyId]
        );
        return roles;
    } catch (err) {
        console.error("Get all roles error:", err);
        return [];
    }
};

/**
 * Create a new role
 */
export const createRole = async (companyId, roleName, permissions) => {
    try {
        // Check if role exists
        const exists = await db.pgGet(
            `SELECT id FROM roles WHERE company_id = $1 AND name = $2`,
            [companyId, roleName]
        );

        if (exists) {
            throw new Error("Role already exists");
        }

        // Create role
        const role = await db.pgRun(
            `INSERT INTO roles (company_id, name, description)
             VALUES ($1, $2, $3) RETURNING id`,
            [companyId, roleName, `Role: ${roleName}`]
        );

        // Assign permissions if provided
        if (permissions && permissions.length > 0) {
            for (const permId of permissions) {
                await db.pgRun(
                    `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
                    [role.id, permId]
                );
            }
        }

        return role;
    } catch (err) {
        console.error("Create role error:", err);
        throw err;
    }
};

/**
 * Update role permissions
 */
export const updateRolePermissions = async (roleId, permissionIds) => {
    try {
        // Delete existing permissions
        await db.pgRun("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

        // Add new permissions
        if (permissionIds && permissionIds.length > 0) {
            for (const permId of permissionIds) {
                await db.pgRun(
                    `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
                    [roleId, permId]
                );
            }
        }

        return { success: true };
    } catch (err) {
        console.error("Update role permissions error:", err);
        throw err;
    }
};

/**
 * Get all available permissions (system-wide)
 */
export const getAllPermissions = async () => {
    try {
        const permissions = await db.pgAll(
            `SELECT * FROM permissions ORDER BY module, action`,
            []
        );
        return permissions;
    } catch (err) {
        console.error("Get all permissions error:", err);
        return [];
    }
};

/**
 * Create default permissions for a module
 */
export const seedModulePermissions = async (module) => {
    const actions = ["create", "read", "update", "delete", "export"];
    
    try {
        for (const action of actions) {
            const exists = await db.pgGet(
                `SELECT id FROM permissions WHERE module = $1 AND action = $2`,
                [module, action]
            );

            if (!exists) {
                await db.pgRun(
                    `INSERT INTO permissions (module, action, description) 
                     VALUES ($1, $2, $3)`,
                    [module, action, `${action.toUpperCase()} ${module}`]
                );
            }
        }
        return { success: true };
    } catch (err) {
        console.error("Seed permissions error:", err);
        throw err;
    }
};

export default {
    checkPermission,
    getRolePermissions,
    getAllRoles,
    createRole,
    updateRolePermissions,
    getAllPermissions,
    seedModulePermissions
};
