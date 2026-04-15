// backend/services/backupService.js
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "../database/pg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create automatic daily backup
 */
export const createDailyBackup = async (companyId) => {
    try {
        const timestamp = new Date().toISOString().split("T")[0];
        const backupDir = path.join(__dirname, "../backups");
        
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const backupFile = path.join(backupDir, `backup_${companyId}_${timestamp}.sql`);

        // Dump database
        await new Promise((resolve, reject) => {
            const pgDumpCmd = `pg_dump ${process.env.DATABASE_URL || "postgresql://localhost/erp"} > "${backupFile}"`;
            
            exec(pgDumpCmd, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Store backup metadata
        const size = fs.statSync(backupFile).size;
        await db.pgRun(
            `INSERT INTO backups (company_id, backup_file, backup_size, backup_type, status)
             VALUES ($1, $2, $3, 'FULL', 'COMPLETED')`,
            [companyId, backupFile, size]
        );

        console.log(`✅ Backup created for company ${companyId}: ${backupFile}`);
        return { backup_file: backupFile, size };
    } catch (err) {
        console.error("❌ Backup error:", err);
        throw err;
    }
};

/**
 * List backups for company
 */
export const listBackups = async (companyId) => {
    try {
        const backups = await db.pgAll(
            `SELECT id, backup_file, backup_size, backup_type, status, created_at
             FROM backups
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT 30`,
            [companyId]
        );

        return backups;
    } catch (err) {
        console.error("❌ List backups error:", err);
        return [];
    }
};

/**
 * Restore from backup
 */
export const restoreFromBackup = async (backupId, companyId, userId) => {
    try {
        // Get backup file
        const backup = await db.pgGet(
            `SELECT backup_file FROM backups WHERE id = $1 AND company_id = $2`,
            [backupId, companyId]
        );

        if (!backup) throw new Error("Backup not found");

        if (!fs.existsSync(backup.backup_file)) {
            throw new Error("Backup file not found on disk");
        }

        // Create a restore point before restoring
        await createDailyBackup(companyId); // Create backup of current state

        // Restore database
        await new Promise((resolve, reject) => {
            const psqlCmd = `psql ${process.env.DATABASE_URL || "postgresql://localhost/erp"} < "${backup.backup_file}"`;
            
            exec(psqlCmd, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Log restore action
        await db.pgRun(
            `INSERT INTO audit_logs 
             (user_id, company_id, module, action, resource_type, resource_id, status)
             VALUES ($1, $2, 'SYSTEM', 'RESTORE_BACKUP', 'backup', $3, 'success')`,
            [userId, companyId, backupId]
        );

        console.log(`✅ Database restored from backup ${backupId} for company ${companyId}`);
        return { restored: true, backup_id: backupId };
    } catch (err) {
        console.error("❌ Restore error:", err);
        throw err;
    }
};

/**
 * Delete old backups (keep only last N backups)
 */
export const cleanupOldBackups = async (companyId, keepCount = 10) => {
    try {
        const backups = await db.pgAll(
            `SELECT id, backup_file FROM backups
             WHERE company_id = $1 AND status = 'COMPLETED'
             ORDER BY created_at DESC
             OFFSET $2`,
            [companyId, keepCount]
        );

        for (const backup of backups) {
            // Delete file
            if (fs.existsSync(backup.backup_file)) {
                fs.unlinkSync(backup.backup_file);
            }

            // Mark as deleted in database
            await db.pgRun("UPDATE backups SET status = 'DELETED' WHERE id = $1", [backup.id]);
        }

        return { deleted_count: backups.length };
    } catch (err) {
        console.error("❌ Cleanup backups error:", err);
        throw err;
    }
};

/**
 * Export company data as JSON
 */
export const exportCompanyData = async (companyId) => {
    try {
        const companies = await db.pgAll("SELECT * FROM companies WHERE id = $1", [companyId]);
        const users = await db.pgAll("SELECT id, username, email, role FROM users WHERE company_id = $1", [companyId]);
        const employees = await db.pgAll("SELECT * FROM employees WHERE company_id = $1", [companyId]);
        const products = await db.pgAll("SELECT * FROM products WHERE company_id = $1", [companyId]);
        const invoices = await db.pgAll("SELECT * FROM invoices WHERE company_id = $1", [companyId]);
        const loans = await db.pgAll("SELECT * FROM loans WHERE company_id = $1", [companyId]);

        const exportData = {
            export_date: new Date(),
            company: companies[0],
            summary: {
                total_users: users.length,
                total_employees: employees.length,
                total_products: products.length,
                total_invoices: invoices.length,
                total_loans: loans.length
            },
            data: {
                users,
                employees,
                products,
                invoices,
                loans
            }
        };

        return exportData;
    } catch (err) {
        console.error("❌ Export data error:", err);
        throw err;
    }
};

/**
 * Get backup statistics
 */
export const getBackupStats = async (companyId) => {
    try {
        const stats = await db.pgGet(
            `SELECT 
                COUNT(*) as total_backups,
                SUM(backup_size) as total_size_bytes,
                MAX(created_at) as last_backup,
                AVG(backup_size) as avg_size
             FROM backups
             WHERE company_id = $1 AND status = 'COMPLETED'`,
            [companyId]
        );

        return {
            total_backups: stats.total_backups || 0,
            total_size_gb: (stats.total_size_bytes || 0) / (1024 * 1024 * 1024),
            last_backup: stats.last_backup,
            avg_size_mb: (stats.avg_size || 0) / (1024 * 1024)
        };
    } catch (err) {
        console.error("❌ Get backup stats error:", err);
        return {};
    }
};

export default {
    createDailyBackup,
    listBackups,
    restoreFromBackup,
    cleanupOldBackups,
    exportCompanyData,
    getBackupStats
};
