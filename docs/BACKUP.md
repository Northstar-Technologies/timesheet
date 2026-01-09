# Backup & Restore Guide

This document provides procedures for backing up and restoring the Northstar Timesheet application data.

## Overview

The application stores data in two locations:

1. **PostgreSQL Database** - User accounts, timesheets, entries, notifications
2. **File System** - Uploaded attachments (receipts, documents)

Both must be backed up to ensure complete data recovery.

---

## Prerequisites

- Docker and Docker Compose installed
- Access to the production server
- Sufficient disk space for backup files
- (Optional) AWS CLI for S3 backups

---

## Database Backup

### Manual Backup (Docker)

Run from the project directory:

```bash
# Navigate to docker directory
cd docker

# Create backup with timestamp
docker compose exec -T db pg_dump -U timesheet timesheet_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup (recommended for production)
docker compose exec -T db pg_dump -U timesheet timesheet_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Manual Backup (Direct PostgreSQL)

If connecting directly to PostgreSQL:

```bash
# Full backup
pg_dump -h localhost -U timesheet -d timesheet_db > backup.sql

# Compressed backup
pg_dump -h localhost -U timesheet -d timesheet_db | gzip > backup.sql.gz

# Custom format (best for large databases)
pg_dump -h localhost -U timesheet -Fc timesheet_db > backup.dump
```

### Backup Options Explained

| Option         | Description                              |
| -------------- | ---------------------------------------- |
| `-Fc`          | Custom format, allows selective restore  |
| `-Z9`          | Maximum compression (with custom format) |
| `--no-owner`   | Don't include ownership info             |
| `--clean`      | Include DROP statements before CREATE    |
| `-t tablename` | Backup specific table only               |

---

## Database Restore

### Restore from SQL file (Docker)

```bash
# Stop the web container to prevent writes during restore
docker compose stop web

# Restore database
docker compose exec -T db psql -U timesheet timesheet_db < backup.sql

# For compressed backups
gunzip -c backup.sql.gz | docker compose exec -T db psql -U timesheet timesheet_db

# Restart web container
docker compose start web
```

### Restore from Custom Format

```bash
# Restore with pg_restore (custom format .dump files)
docker compose exec -T db pg_restore -U timesheet -d timesheet_db --clean backup.dump
```

### Restore from SQL file (Direct PostgreSQL)

```bash
# Drop and recreate database (if needed)
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS timesheet_db;"
psql -h localhost -U postgres -c "CREATE DATABASE timesheet_db OWNER timesheet;"

# Restore
psql -h localhost -U timesheet -d timesheet_db < backup.sql
```

---

## Attachment Backup

Attachments are stored in the `uploads/` directory.

### Manual Backup

```bash
# Create tarball of uploads
tar -czvf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/

# Copy from Docker volume (if using named volume)
docker cp $(docker compose ps -q web):/app/uploads ./uploads_backup/
```

### Restore Attachments

```bash
# Extract tarball
tar -xzvf uploads_backup_20240115_120000.tar.gz -C .

# Copy to Docker container
docker cp ./uploads_backup/. $(docker compose ps -q web):/app/uploads/
```

---

## Automated Backups

### Cron Job Setup

Add to crontab (`crontab -e`):

```bash
# Daily database backup at 2 AM
0 2 * * * cd /path/to/timesheet/docker && docker compose exec -T db pg_dump -U timesheet timesheet_db | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Weekly attachment backup on Sunday at 3 AM
0 3 * * 0 cd /path/to/timesheet && tar -czvf /backups/uploads_$(date +\%Y\%m\%d).tar.gz uploads/

# Clean up backups older than 30 days
0 4 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
0 4 * * * find /backups -name "*.tar.gz" -mtime +30 -delete
```

### Backup Script

Create `/opt/scripts/backup-timesheet.sh`:

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/backups/timesheet"
APP_DIR="/opt/timesheet"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Navigate to app directory
cd "$APP_DIR/docker"

# Database backup
echo "Backing up database..."
docker compose exec -T db pg_dump -U timesheet timesheet_db | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Attachment backup
echo "Backing up attachments..."
cd "$APP_DIR"
tar -czvf "$BACKUP_DIR/uploads_$DATE.tar.gz" uploads/ 2>/dev/null || echo "No uploads to backup"

# Cleanup old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete: $DATE"
```

Make executable and add to cron:

```bash
chmod +x /opt/scripts/backup-timesheet.sh
# Add to crontab
0 2 * * * /opt/scripts/backup-timesheet.sh >> /var/log/timesheet-backup.log 2>&1
```

---

## Cloud Backup (AWS S3)

### Upload to S3

```bash
# Install AWS CLI if needed
pip install awscli

# Configure AWS credentials
aws configure

# Upload backup to S3
aws s3 cp backup_20240115.sql.gz s3://your-bucket/timesheet-backups/

# Sync entire backup directory
aws s3 sync /backups/timesheet s3://your-bucket/timesheet-backups/
```

### Automated S3 Backup Script

```bash
#!/bin/bash
# backup-to-s3.sh

BACKUP_DIR="/backups/timesheet"
S3_BUCKET="s3://your-bucket/timesheet-backups"

# Run local backup first
/opt/scripts/backup-timesheet.sh

# Sync to S3
aws s3 sync "$BACKUP_DIR" "$S3_BUCKET" --delete

echo "S3 sync complete"
```

---

## Disaster Recovery

### Full Recovery Procedure

1. **Provision new server** with Docker and Docker Compose

2. **Clone the repository**

   ```bash
   git clone https://github.com/Northstar-Technologies/timesheet.git
   cd timesheet
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with production settings
   ```

4. **Start containers**

   ```bash
   cd docker
   docker compose up -d
   ```

5. **Run database migrations**

   ```bash
   docker compose exec web flask db upgrade
   ```

6. **Restore database from backup**

   ```bash
   docker compose stop web
   gunzip -c /backups/db_latest.sql.gz | docker compose exec -T db psql -U timesheet timesheet_db
   docker compose start web
   ```

7. **Restore attachments**

   ```bash
   tar -xzvf /backups/uploads_latest.tar.gz -C .
   docker cp ./uploads/. $(docker compose ps -q web):/app/uploads/
   ```

8. **Verify application**
   ```bash
   curl http://localhost/health
   ```

---

## Backup Verification

### Test Restore Procedure

Periodically test your backups by restoring to a test environment:

```bash
# Create test database
docker compose exec -T db psql -U postgres -c "CREATE DATABASE timesheet_test;"

# Restore to test database
gunzip -c backup.sql.gz | docker compose exec -T db psql -U timesheet timesheet_test

# Verify data
docker compose exec -T db psql -U timesheet timesheet_test -c "SELECT COUNT(*) FROM timesheets;"

# Cleanup
docker compose exec -T db psql -U postgres -c "DROP DATABASE timesheet_test;"
```

### Backup Checklist

- [ ] Daily database backups running
- [ ] Weekly attachment backups running
- [ ] Backup files are encrypted (if required)
- [ ] Backups are stored off-site (S3, etc.)
- [ ] Restore procedure tested monthly
- [ ] Backup logs monitored for failures
- [ ] Retention policy enforced automatically

---

## Troubleshooting

### Common Issues

**"database does not exist" error:**

```bash
docker compose exec -T db psql -U postgres -c "CREATE DATABASE timesheet_db OWNER timesheet;"
```

**Permission denied on restore:**

```bash
# Ensure correct ownership
docker compose exec db chown -R postgres:postgres /var/lib/postgresql/data
```

**Backup file too large:**

```bash
# Use parallel dump for large databases
pg_dump -j4 -Fd -f backup_dir timesheet_db
```

**Container not running:**

```bash
# Check container status
docker compose ps

# Start containers
docker compose up -d
```

---

## Related Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [README.md](../README.md) - General project documentation

---

_Document created January 9, 2026_
