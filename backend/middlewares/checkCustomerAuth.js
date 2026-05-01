// backend/middlewares/checkCustomerAuth.js
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/jwtConfig.js";
import * as db from "../database/pg.js";

export const checkCustomerAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, jwtSecret);
        
        // 1. Fetch User
        const user = await db.pgGet("SELECT * FROM users WHERE id = $1", [decoded.user.id]);
        
        if (!user) return res.status(401).json({ error: "User not found" });

        // 2. Strict Customer Check
        if (user.role !== 'user' && user.role !== 'customer') { // Assuming 'user' is the DB role name for customers
            return res.status(403).json({ error: "Access Denied: Customer Portal Only" });
        }

        // 3. Portal Enabled Check (Optional: Add this column to DB via script first)
        // if (!user.is_portal_enabled) {
        //    return res.status(403).json({ error: "Your portal access is disabled." });
        // }

        req.user = user;
        next();

    } catch (err) {
        return res.status(401).json({ error: "Invalid Token" });
    }
};