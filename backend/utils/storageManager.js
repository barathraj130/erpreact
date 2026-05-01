// backend/utils/storageManager.js
import fs from 'fs';
import path from 'path';
import * as db from '../database/pg.js';

const BASE_PATH = process.env.STORAGE_BASE_PATH || '/mnt/erp-storage';

/**
 * initCompanyStorage(company_id)
 * - Creates /mnt/erp-storage/company_{id}/ folder structure
 */
export const initCompanyStorage = (company_id) => {
    const companyRoot = path.join(BASE_PATH, `company_${company_id}`);
    const subfolders = ['documents', 'uploads', 'exports', 'archive', 'backups'];

    subfolders.forEach(folder => {
        const fullPath = path.join(companyRoot, folder);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
    return companyRoot;
};

/**
 * saveFile(company_id, category, filename, buffer)
 * - Saves file to correct subfolder
 */
export const saveFile = async (company_id, category, filename, buffer) => {
    const categories = ['documents', 'uploads', 'exports'];
    if (!categories.includes(category)) throw new Error("Invalid category");

    const companyRoot = path.join(BASE_PATH, `company_${company_id}`);
    const categoryPath = path.join(companyRoot, category);
    
    // Ensure dir exists
    if (!fs.existsSync(categoryPath)) initCompanyStorage(company_id);

    const safeFilename = `${Date.now()}_${filename.replace(/[^a-z0-9.]/gi, '_')}`;
    const absolutePath = path.join(categoryPath, safeFilename);
    const relativePath = path.relative(BASE_PATH, absolutePath);

    fs.writeFileSync(absolutePath, buffer);

    return {
        absolutePath,
        relativePath,
        filename: safeFilename
    };
};

/**
 * archiveFile(company_id, relativePath)
 * - Moves file to archive/ subfolder
 * - Updates the file path record in PostgreSQL
 */
export const archiveFile = async (company_id, relativePath) => {
    const sourcePath = path.join(BASE_PATH, relativePath);
    
    // Security check: ensure path is within company folder
    const companyPrefix = `company_${company_id}`;
    if (!relativePath.startsWith(companyPrefix)) {
        throw new Error("Access Denied: Path escape detected");
    }

    const filename = path.basename(sourcePath);
    const archivePath = path.join(BASE_PATH, companyPrefix, 'archive', filename);
    const newRelativePath = path.relative(BASE_PATH, archivePath);

    if (!fs.existsSync(sourcePath)) throw new Error("File not found");

    // Move file
    fs.renameSync(sourcePath, archivePath);

    // Update DB
    await db.pgRun(
        'UPDATE files SET stored_path = $1, is_deleted = true, deleted_at = NOW() WHERE stored_path = $2 AND company_id = $3',
        [newRelativePath, relativePath, company_id]
    );

    return newRelativePath;
};

/**
 * getFilePath(company_id, relativePath)
 * - Resolves relative path to absolute path
 * - Validates path stays within company_{id}/
 */
export const getFilePath = (company_id, relativePath) => {
    const absolutePath = path.resolve(BASE_PATH, relativePath);
    const companyRoot = path.resolve(BASE_PATH, `company_${company_id}`);

    if (!absolutePath.startsWith(companyRoot)) {
        throw new Error("Access Denied: Path traversal detected");
    }

    if (!fs.existsSync(absolutePath)) throw new Error("File not found");

    return absolutePath;
};

/**
 * listFiles(company_id, category)
 */
export const listFiles = (company_id, category) => {
    const categoryPath = path.join(BASE_PATH, `company_${company_id}`, category);
    if (!fs.existsSync(categoryPath)) return [];
    
    return fs.readdirSync(categoryPath).map(name => ({
        name,
        path: path.relative(BASE_PATH, path.join(categoryPath, name))
    }));
};
