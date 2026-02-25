#!/bin/bash

# Configuration
DB_PATH="./school.db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="cortex_db_$TIMESTAMP.sqlite"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform SQLite backup using the .backup command for consistency
# Requires sqlite3 to be installed on the host/container
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 $DB_PATH ".backup '$BACKUP_DIR/$BACKUP_NAME'"
else
    # Fallback to simple copy if sqlite3 is not available (less safe if DB is active)
    cp $DB_PATH "$BACKUP_DIR/$BACKUP_NAME"
fi

# Keep only the last 30 days of backups
find $BACKUP_DIR -name "cortex_db_*.sqlite" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/$BACKUP_NAME"
