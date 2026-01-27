#!/usr/bin/env node
/**
 * Database Backup Script
 *
 * Usage:
 *   node scripts/backup-database.js
 *
 * Environment variables required:
 *   DATABASE_URL - PostgreSQL connection string
 *
 * Optional:
 *   BACKUP_DIR - Directory to store backups (default: ./backups)
 *   BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)
 *
 * Cron setup (daily at 2 AM):
 *   0 2 * * * cd /path/to/MgtSys && node scripts/backup-database.js >> logs/backup.log 2>&1
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;

// Parse DATABASE_URL
function parseDatabaseUrl(url) {
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Format: postgresql://user:password@host:port/database
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?.*)?$/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5].split('?')[0] // Remove query params
  };
}

// Generate backup filename
function getBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T');
  return `backup-${timestamp[0]}-${timestamp[1].substring(0, 8)}.sql`;
}

// Create backup directory if it doesn't exist
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
  }
}

// Delete old backups
function cleanOldBackups() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const files = fs.readdirSync(BACKUP_DIR);
  let deletedCount = 0;

  files.forEach(file => {
    if (!file.startsWith('backup-') || !file.endsWith('.sql')) return;

    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`Deleted old backup: ${file}`);
    }
  });

  if (deletedCount > 0) {
    console.log(`Cleaned up ${deletedCount} old backup(s)`);
  }
}

// Perform backup
function performBackup() {
  const db = parseDatabaseUrl(process.env.DATABASE_URL);
  const filename = getBackupFilename();
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`Starting backup at ${new Date().toISOString()}`);
  console.log(`Database: ${db.database} on ${db.host}:${db.port}`);

  // Set PGPASSWORD environment variable for pg_dump
  const env = { ...process.env, PGPASSWORD: db.password };

  // Build pg_dump command
  const command = [
    'pg_dump',
    `-h ${db.host}`,
    `-p ${db.port}`,
    `-U ${db.user}`,
    `-d ${db.database}`,
    '--format=plain',
    '--no-owner',
    '--no-acl',
    `--file="${filepath}"`
  ].join(' ');

  try {
    execSync(command, { env, stdio: 'pipe' });

    // Get file size
    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`Backup completed: ${filename} (${sizeMB} MB)`);

    // Compress the backup
    try {
      execSync(`gzip "${filepath}"`, { stdio: 'pipe' });
      const compressedStats = fs.statSync(`${filepath}.gz`);
      const compressedSizeMB = (compressedStats.size / (1024 * 1024)).toFixed(2);
      console.log(`Compressed: ${filename}.gz (${compressedSizeMB} MB)`);
    } catch (gzipError) {
      console.log('Note: gzip not available, backup saved uncompressed');
    }

    return true;
  } catch (error) {
    console.error('Backup failed:', error.message);

    // Clean up failed backup file if it exists
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    return false;
  }
}

// Main execution
function main() {
  console.log('='.repeat(50));
  console.log('POS System Database Backup');
  console.log('='.repeat(50));

  try {
    ensureBackupDir();
    const success = performBackup();

    if (success) {
      cleanOldBackups();
      console.log('Backup process completed successfully');
      process.exit(0);
    } else {
      console.error('Backup process failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
