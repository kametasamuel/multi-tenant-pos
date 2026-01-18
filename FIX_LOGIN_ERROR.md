# Fix Login Error - Quick Guide

The internal server error is likely because the database hasn't been migrated yet to include the new `isSuperAdmin` field.

## Quick Fix Steps:

### 1. Generate Prisma Client
```bash
npm run db:generate
```

### 2. Create and Run Migration
```bash
npm run db:migrate
```

This will prompt you to name the migration. You can use something like: `add_super_admin_field`

### 3. Re-seed the Database (to create super admin)
```bash
npm run db:seed
```

### 4. Restart the Server
Stop and restart your server:
```bash
npm run server
```

## Alternative: If Migration Fails

If you get errors during migration, you can try:

1. **Reset the database** (⚠️ WARNING: This will delete all data):
```bash
npx prisma migrate reset
```

Then:
```bash
npm run db:seed
```

## Check Your Database Connection

Make sure your `.env` file has the correct database URL:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/pos_db"
```

## After Fixing

Try logging in again with:
- Username: `admin`
- Password: `admin`

The error should be resolved after running the migration!
