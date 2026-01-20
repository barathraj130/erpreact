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
        req.user = decoded.user;  // attach to request
        next();
    } catch (err) {
        console.warn(`JWT verification failed for ${req.path}: ${err.message}`);
        return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
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
