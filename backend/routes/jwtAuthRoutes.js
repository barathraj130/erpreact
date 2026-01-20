const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pgModule = require("../database/pg");

const router = express.Router();

// =========================
// Verify JWT Secret
// =========================
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    console.error("❌ JWT_SECRET missing in .env");
    process.exit(1);
}

/* ===================================================
   POST /login
=================================================== */
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Enter username & password." });
    }

    try {
        const user = await pgModule.pgGet(
            "SELECT id, username, password_hash, email, role, active_company_id FROM users WHERE username = $1",
            [username]
        );

        if (!user) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        // Create JWT payload
        const payload = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                active_company_id: user.active_company_id
            }
        };

        const token = jwt.sign(payload, jwtSecret, { expiresIn: "8h" });

        return res.json({ token });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ error: "Server error during login." });
    }
});

/* ===================================================
   POST /signup
=================================================== */
router.post("/signup", async (req, res) => {
    const { username, userEmail, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username & password required." });
    }

    try {
        // Check duplicate
        const existing = await pgModule.pgGet(
            "SELECT id FROM users WHERE username = $1 OR email = $2",
            [username, userEmail]
        );

        if (existing) {
            return res.status(400).json({ error: "Username or email already exists." });
        }

        const hashed = await bcrypt.hash(password, 10);

        await pgModule.pgRun(
            `INSERT INTO users (username, email, password_hash, role, active_company_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [username, userEmail, hashed, "admin", 1]
        );

        return res.json({ message: "Signup successful!" });

    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        return res.status(500).json({ error: "Error creating user." });
    }
});

/* ===================================================
   GET /me (Requires token)
=================================================== */
router.get("/me", async (req, res) => {
    try {
        const auth = req.headers["authorization"];

        if (!auth) return res.status(401).json({ error: "No token provided." });

        const token = auth.split(" ")[1];

        jwt.verify(token, jwtSecret, async (err, decoded) => {
            if (err) return res.status(403).json({ error: "Invalid or expired token." });

            const user = await pgModule.pgGet(
                "SELECT id, username, email, role, active_company_id FROM users WHERE id = $1",
                [decoded.user.id]
            );

            if (!user) return res.status(404).json({ error: "User not found." });

            return res.json(user);
        });

    } catch (err) {
        console.error("ME ERROR:", err);
        return res.status(500).json({ error: "Server error fetching user." });
    }
});

// VERY IMPORTANT
module.exports = router;
