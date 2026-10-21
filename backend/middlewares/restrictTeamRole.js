// backend/middlewares/restrictTeamRole.js
// Walls off the three narrow pipeline roles (purchase_team, segregation_team,
// sales_team) from each other's actions. Deliberately additive and separate
// from the two existing, mostly-unwired permission systems (role_permissions/
// checkAccess and user_permissions/checkPermission) — every pre-existing role
// (admin, staff, manager, ...) passes through unaffected; this only ever
// restricts the three new narrow roles to the specific routes they're
// allowed to use.
const NARROW_ROLES = ["purchase_team", "segregation_team", "sales_team"];

export const restrictTeamRole = (allowedRoles) => (req, res, next) => {
    const role = req.user?.role;
    if (!NARROW_ROLES.includes(role)) return next();
    if (allowedRoles.includes(role)) return next();
    return res.status(403).json({ error: "Not permitted for your role." });
};

export default restrictTeamRole;
