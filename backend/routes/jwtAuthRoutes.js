// backend/routes/jwtAuthRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import * as db from "../database/pg.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwtRS256.js";

const router = express.Router();

/**
 * SQL Schema:
 * CREATE TABLE IF NOT EXISTS refresh_tokens (
 *   id SERIAL PRIMARY KEY,
 *   user_id INTEGER NOT NULL,
 *   token TEXT NOT NULL,
 *   expires_at TIMESTAMPTZ NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   revoked BOOLEAN DEFAULT false
 * );
 */

router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.pgGet(
            "SELECT id, username, password_hash, email, role, active_company_id, branch_id FROM users WHERE username = $1 OR email = $1",
            [username]
        );

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                company_id: user.active_company_id,
                branch_id: user.branch_id
            }
        };

        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken({ userId: user.id });

        // Store refresh token in DB
        await db.pgRun(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')",
            [user.id, refreshToken]
        );

        // Set Refresh Token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ accessToken, user: payload.user });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/refresh", async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token missing" });

    try {
        // Verify in DB
        const storedToken = await db.pgGet(
            "SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()",
            [refreshToken]
        );

        if (!storedToken) return res.status(401).json({ error: "Invalid or expired refresh token" });

        // Token Rotation: Revoke old one, issue new ones
        await db.pgRun("UPDATE refresh_tokens SET revoked = true WHERE id = $1", [storedToken.id]);

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) return res.status(401).json({ error: "Invalid token" });

        const user = await db.pgGet(
            "SELECT id, username, email, role, active_company_id, branch_id FROM users WHERE id = $1",
            [storedToken.user_id]
        );

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                company_id: user.active_company_id,
                branch_id: user.branch_id
            }
        };

        const newAccessToken = signAccessToken(payload);
        const newRefreshToken = signRefreshToken({ userId: user.id });

        await db.pgRun(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')",
            [user.id, newRefreshToken]
        );

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(401).json({ error: "Refresh failed" });
    }
});

router.post("/logout", async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        await db.pgRun("UPDATE refresh_tokens SET revoked = true WHERE token = $1", [refreshToken]);
    }
    res.clearCookie('refreshToken');
    res.json({ message: "Logged out" });
});

export default router;
