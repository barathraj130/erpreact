console.log("--> Loading authMiddleware.js");
// backend/middlewares/jwtAuthMiddleware.js
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/jwtConfig.js";

// Main JWT authentication middleware
export const authMiddleware = (req, res, next) => {
    if (req.path === "/jwt-auth/login" || req.path === "/jwt-auth/signup") {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication token required." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, jwtSecret);
        
        // Ensure tenant context is present
        if (!decoded.user || !decoded.user.company_id) {
            console.error("❌ Malformed token: Missing tenant context");
            return res.status(401).json({ error: "Invalid session context." });
        }

        // 🏢 DYNAMIC BRANCH OVERRIDE & ISOLATION (Stage 8)
        const userRole = decoded.user.role?.toLowerCase();
        const headerBranchId = req.headers['x-branch-id'];
        
        let activeBranchId = decoded.user.branch_id;

        if (userRole === 'admin' || userRole === 'superadmin') {
            // Admins can switch branches via header
            if (headerBranchId) activeBranchId = parseInt(headerBranchId);
        } else if (userRole === 'branch_manager') {
            // Branch managers are LOCKED to their assigned branch
            activeBranchId = decoded.user.branch_id;
        } else {
            // Staff/Other users use their default assigned branch
            activeBranchId = decoded.user.branch_id;
        }
        
        req.user = {
            ...decoded.user,
            active_company_id: decoded.user.company_id,
            branch_id: activeBranchId
        };

        next();
    } catch (err) {
        console.warn(`⚠️ JWT Auth Failed [${req.path}]: ${err.message}`);
        return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
};

// Route-level auth checker
export const checkAuth = (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required to access this resource." });
    }
    next();
};

// ⭐ REQUIRED: Default export for ESM imports
export default authMiddleware;
