#!/usr/bin/env node
/**
 * Safe Migration Script
 *
 * This script ensures you never accidentally reset your production database.
 * It backs up the database before applying migrations.
 *
 * Usage:
 *   node scripts/safe-migrate.js [--force]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const forceFlag = process.argv.includes('--force');

console.log('╔════════════════════════════════════════════╗');
console.log('║         SAFE DATABASE MIGRATION            ║');
console.log('╚════════════════════════════════════════════╝\n');

console.log(`Environment: ${isProduction ? '🔴 PRODUCTION' : '🟢 DEVELOPMENT'}`);
console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost'}\n`);

async function run() {
  try {
    // Step 1: Create backup
    console.log('📦 Step 1: Creating database backup...');
    try {
      execSync('node scripts/backup-database.js', { stdio: 'inherit' });
      console.log('✅ Backup created successfully\n');
    } catch (backupError) {
      if (isProduction && !forceFlag) {
        console.error('❌ Backup failed! Aborting migration.');
        console.error('   Run with --force to skip backup (NOT RECOMMENDED)');
        process.exit(1);
      }
      console.warn('⚠️  Backup failed, but continuing (development mode)\n');
    }

    // Step 2: Check for pending migrations
    console.log('🔍 Step 2: Checking migration status...');
    execSync('npx prisma migrate status', { stdio: 'inherit' });
    console.log('');

    // Step 3: Apply migrations (NEVER use migrate dev in production)
    console.log('🚀 Step 3: Applying migrations...');

    if (isProduction) {
      // Production: Use migrate deploy (safe, never resets)
      console.log('   Using: prisma migrate deploy (production-safe)\n');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } else {
      // Development: Still use deploy to be safe, unless explicitly creating new migration
      console.log('   Using: prisma migrate deploy (safe mode)\n');
      console.log('   💡 To create a NEW migration, run:');
      console.log('      npx prisma migrate dev --name your_migration_name\n');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    }

    // Step 4: Generate Prisma client
    console.log('\n📚 Step 4: Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║       ✅ MIGRATION COMPLETED SAFELY        ║');
    console.log('╚════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 If you have a backup, you can restore it with:');
    console.log('   pg_restore -d your_database backups/your_backup_file.dump\n');
    process.exit(1);
  }
}

run();
