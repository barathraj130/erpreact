// backend/routes/signatureRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import db from "../database/pg.js";

// ✅ FIXED: Correct auth middleware folder + file
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
    destination: "uploads/signatures/",
    filename: (req, file, cb) => {
        cb(null, `user_${req.user.id}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Upload signature
router.post("/upload-signature",
    authMiddleware,
    upload.single("signature"),
    async (req, res) => {
        try {
            const filePath = `/uploads/signatures/${req.file.filename}`;

            await db.query(
                "UPDATE users SET signature_url = $1 WHERE id = $2",
                [filePath, req.user.id]
            );

            res.json({ success: true, url: filePath });
        } catch (err) {
            console.error("Signature upload error:", err);
            res.status(500).json({ error: "Upload failed" });
        }
    }
);

export default router;
