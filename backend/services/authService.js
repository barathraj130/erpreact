// backend/services/authService.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/jwtConfig.js";
import * as db from "../database/pg.js";

/**
 * Hash password for storage
 */
export const hashPassword = async (password) => {
    return bcrypt.hash(password, 10);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

/**
 * Generate JWT token with refresh token support
 */
export const generateTokens = (user) => {
    const accessToken = jwt.sign(
        {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                company_id: user.company_id,
                branch_id: user.branch_id || 1,
                subscription_status: user.subscription_status,
                enabled_modules: user.enabled_modules,
                permissions: user.permissions || []
            }
        },
        jwtSecret,
        { expiresIn: "1h" } // Short-lived access token
    );

    const refreshToken = jwt.sign(
        {
            user: {
                id: user.id,
                email: user.email,
                company_id: user.company_id
            }
        },
        jwtSecret,
        { expiresIn: "7d" } // Longer-lived refresh token
    );

    return { accessToken, refreshToken };
};

/**
 * Verify and refresh token
 */
export const refreshAccessToken = (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, jwtSecret);
        const newAccessToken = jwt.sign(
            {
                user: {
                    id: decoded.user.id,
                    email: decoded.user.email,
                    company_id: decoded.user.company_id
                }
            },
            jwtSecret,
            { expiresIn: "1h" }
        );
        return newAccessToken;
    } catch (err) {
        throw new Error("Invalid refresh token");
    }
};

/**
 * Validate user credentials and load full user data
 */
export const authenticateUser = async (company_code, email, password) => {
    // 1. Find Company
    const company = await db.pgGet(
        `SELECT c.*, s.status as sub_status, s.expiry_date as sub_expiry, s.enabled_modules
         FROM companies c
         LEFT JOIN subscriptions s ON c.subscription_id = s.id
         WHERE LOWER(c.company_code) = LOWER($1) AND c.is_active = TRUE`,
        [company_code]
    );

    if (!company) {
        throw new Error("Invalid company code or inactive company");
    }

    // 2. Check Subscription
    if (company.sub_status !== "ACTIVE" || (company.sub_expiry && new Date(company.sub_expiry) < new Date())) {
        const error = new Error("Subscription expired or inactive");
        error.code = "SUBSCRIPTION_EXPIRED";
        throw error;
    }

    // 3. Find User
    const user = await db.pgGet(
        `SELECT * FROM users 
         WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)) 
         AND company_id = $2 AND is_active = TRUE`,
        [email, company.id]
    );

    if (!user) {
        throw new Error("User not found in this company");
    }

    // 4. Check Account Lockout
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
        const error = new Error(`Account locked. Try again in ${minutesLeft} minutes`);
        error.code = "ACCOUNT_LOCKED";
        error.minutesLeft = minutesLeft;
        throw error;
    }

    // 5. Validate Password
    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
        const newAttempts = (user.failed_attempts || 0) + 1;
        let lockUntil = null;

        if (newAttempts >= 5) {
            lockUntil = new Date(Date.now() + 30 * 60000); // Lock for 30 mins
        }

        await db.pgRun(
            "UPDATE users SET failed_attempts = $1, lock_until = $2 WHERE id = $3",
            [newAttempts, lockUntil, user.id]
        );

        const error = new Error("Invalid password");
        error.attemptsLeft = Math.max(0, 5 - newAttempts);
        throw error;
    }

    // 6. Load Permissions
    const permissions = await db.pgAll(
        `SELECT p.module, p.action 
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN roles r ON rp.role_id = r.id
         WHERE LOWER(r.name) = LOWER($1)`,
        [user.role || "user"]
    );

    // 7. Update login info
    await db.pgRun(
        "UPDATE users SET failed_attempts = 0, lock_until = NULL, last_login = NOW() WHERE id = $1",
        [user.id]
    );

    return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        company_id: company.id,
        company_name: company.company_name,
        branch_id: user.branch_id || 1,
        subscription_status: company.sub_status,
        enabled_modules: company.enabled_modules,
        permissions: permissions
    };
};

/**
 * Create new user
 */
export const createUser = async (companyId, userData) => {
    const { username, email, password, role, branch_id } = userData;

    // Check if user exists
    const exists = await db.pgGet(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        [email, username]
    );

    if (exists) {
        throw new Error("User with this email or username already exists");
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.pgRun(
        `INSERT INTO users (company_id, branch_id, username, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, username, email, role`,
        [companyId, branch_id || 1, username, email, hashedPassword, role || "staff"]
    );

    return result;
};

/**
 * Update user password
 */
export const updateUserPassword = async (userId, currentPassword, newPassword) => {
    const user = await db.pgGet("SELECT password_hash FROM users WHERE id = $1", [userId]);

    if (!user) {
        throw new Error("User not found");
    }

    // Verify current password
    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
        throw new Error("Current password is incorrect");
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.pgRun("UPDATE users SET password_hash = $1 WHERE id = $2", [hashedPassword, userId]);

    return { success: true };
};

export default {
    hashPassword,
    comparePassword,
    generateTokens,
    refreshAccessToken,
    authenticateUser,
    createUser,
    updateUserPassword
};
