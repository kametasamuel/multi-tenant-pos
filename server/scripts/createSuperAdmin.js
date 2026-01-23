const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  const username = process.argv[2] || 'superadmin';
  const password = process.argv[3] || 'Admin@123';
  const fullName = process.argv[4] || 'Super Administrator';

  console.log('Creating/updating super admin user...');
  console.log(`Username: ${username}`);

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or find the System Admin tenant (required for super admin users)
    const systemTenant = await prisma.tenant.upsert({
      where: { businessName: 'System Admin' },
      update: {},
      create: {
        businessName: 'System Admin',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
        isActive: true,
        businessType: 'OTHER'
      }
    });

    // Check if user exists in System Admin tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        },
        tenantId: systemTenant.id
      }
    });

    if (existingUser) {
      // Update existing user to be super admin
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          isSuperAdmin: true,
          isActive: true,
          fullName: fullName
        }
      });
      console.log(`Updated existing user "${username}" as super admin`);
      console.log(`User ID: ${updated.id}`);
    } else {
      // Create new super admin user
      const newUser = await prisma.user.create({
        data: {
          username: username,
          password: hashedPassword,
          fullName: fullName,
          role: 'ADMIN',
          isSuperAdmin: true,
          isActive: true,
          tenantId: systemTenant.id
        }
      });
      console.log(`Created new super admin user "${username}"`);
      console.log(`User ID: ${newUser.id}`);
    }

    console.log('\nSuper admin setup complete!');
    console.log(`You can now login at /admin/login with:`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);

  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
