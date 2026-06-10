// backend/routes/fileRoutes.js
import express from "express";
import multer from "multer";
import * as storageManager from "../utils/storageManager.js";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import fs from "fs";

const router = express.Router();

// Memory storage to handle buffer manually via storageManager
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

/**
 * SQL for table creation (Reference)
 * CREATE TABLE IF NOT EXISTS files (
 *   id SERIAL PRIMARY KEY,
 *   company_id INTEGER NOT NULL,
 *   original_name TEXT,
 *   stored_path TEXT,
 *   category TEXT,
 *   size_bytes BIGINT,
 *   mime_type TEXT,
 *   uploaded_by INTEGER,
 *   is_deleted BOOLEAN DEFAULT false,
 *   deleted_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

// POST /api/files/upload
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
    const companyId = req.user.active_company_id;
    const userId = req.user.id;
    const { category } = req.body; // 'documents' | 'uploads' | 'exports'

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        const saved = await storageManager.saveFile(
            companyId,
            category || 'uploads',
            req.file.originalname,
            req.file.buffer
        );

        const result = await db.pgGet(`
            INSERT INTO files (company_id, original_name, stored_path, category, size_bytes, mime_type, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            companyId,
            req.file.originalname,
            saved.relativePath,
            category || 'uploads',
            req.file.size,
            req.file.mimetype,
            userId
        ]);

        res.json(result);
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "File upload failed" });
    }
});

// GET /api/files/:id
router.get("/:id", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { id } = req.params;

    try {
        const fileRecord = await db.pgGet(
            "SELECT * FROM files WHERE id = $1 AND company_id = $2 AND is_deleted = false",
            [id, companyId]
        );

        if (!fileRecord) return res.status(404).json({ error: "File not found" });

        const absolutePath = storageManager.getFilePath(companyId, fileRecord.stored_path);
        
        res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${fileRecord.original_name}"`);
        
        const stream = fs.createReadStream(absolutePath);
        stream.pipe(res);
    } catch (err) {
        console.error("File retrieval error:", err);
        res.status(404).json({ error: "File not found or access denied" });
    }
});

// POST /api/files/:id/archive
router.post("/:id/archive", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { id } = req.params;

    try {
        const fileRecord = await db.pgGet(
            "SELECT * FROM files WHERE id = $1 AND company_id = $2 AND is_deleted = false",
            [id, companyId]
        );

        if (!fileRecord) return res.status(404).json({ error: "File not found" });

        const newPath = await storageManager.archiveFile(companyId, fileRecord.stored_path);

        res.json({ message: "File archived successfully", newPath });
    } catch (err) {
        console.error("Archive error:", err);
        res.status(500).json({ error: "Failed to archive file" });
    }
});

export default router;
