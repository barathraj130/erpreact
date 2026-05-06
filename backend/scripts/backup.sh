#!/bin/bash
# backend/scripts/backup.sh
# Production Local Backup Script

STORAGE_BASE="/mnt/erp-storage"
RETENTION_DAYS=30
DB_NAME="erpdb"
DB_USER="erpuser"
GPG_RECIPIENT="erp-admin"

# Fetch all company IDs from DB
COMPANIES=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT id FROM companies WHERE is_deleted = false")

for CID in $COMPANIES; do
    BACKUP_DIR="$STORAGE_BASE/company_$CID/backups"
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    FILENAME="backup_${CID}_${TIMESTAMP}.sql"
    
    # 1. pg_dump (schema + data for this company)
    # Note: Using schema-level filtering if possible, or just dumping full DB for simplicity
    pg_dump -U $DB_USER -d $DB_NAME -t "*_${CID}" > "$BACKUP_DIR/$FILENAME"
    
    if [ $? -eq 0 ]; then
        # 2. Compress
        gzip "$BACKUP_DIR/$FILENAME"
        
        # 3. Encrypt (Optional - requires GPG setup)
        # gpg --encrypt --recipient "$GPG_RECIPIENT" "$BACKUP_DIR/$FILENAME.gz"
        
        # 4. Cleanup old backups
        find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
        
        # 5. Log success to notifications table
        psql -U $DB_USER -d $DB_NAME -c "INSERT INTO notifications (company_id, title, message, type) VALUES ($CID, 'Backup Success', 'System backup completed successfully', 'system')"
        echo "✅ Backup successful for Company $CID"
    else
        # Log failure
        psql -U $DB_USER -d $DB_NAME -c "INSERT INTO notifications (company_id, title, message, type) VALUES ($CID, 'Backup Failed', 'Automated backup failed. Check server logs.', 'error')"
        echo "❌ Backup failed for Company $CID"
    fi
done
