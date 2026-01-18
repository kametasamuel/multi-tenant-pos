# Super Admin Setup

## What's Been Changed

1. **Database Schema** - Added `isSuperAdmin` boolean field to User model
2. **Authentication** - Updated to bypass tenant subscription checks for super admin
3. **Authorization** - Added `requireSuperAdmin` middleware for super admin-only routes
4. **Seed Script** - Creates super admin user with credentials:
   - Username: `admin`
   - Password: `admin`

## Next Steps

1. **Run Database Migration:**
   ```bash
   npm run db:migrate
   ```

2. **Seed the Database:**
   ```bash
   npm run db:seed
   ```

3. **Login with Super Admin:**
   - Username: `admin`
   - Password: `admin`

## Super Admin Features

- ✅ Bypasses tenant subscription expiry checks
- ✅ Can access all admin features
- ✅ Full access across all tenants (in the current implementation)
- ✅ Marked with `isSuperAdmin: true` flag

## Notes

The super admin is created in a special tenant called "System Admin" with a 100-year subscription to ensure it never expires. The super admin can log in regardless of any tenant restrictions.
