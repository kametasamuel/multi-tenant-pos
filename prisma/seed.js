const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create super admin tenant (special tenant for super admin user)
  const superAdminTenant = await prisma.tenant.upsert({
    where: { businessName: 'System Admin' },
    update: {},
    create: {
      businessName: 'System Admin',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years from now
      isActive: true
    }
  });

  // Create super admin user
  const superAdminPassword = await bcrypt.hash('admin', 10);
  const superAdmin = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'admin',
        tenantId: superAdminTenant.id
      }
    },
    update: {
      password: superAdminPassword,
      isSuperAdmin: true,
      role: 'ADMIN',
      isActive: true
    },
    create: {
      username: 'admin',
      password: superAdminPassword,
      fullName: 'Super Administrator',
      role: 'ADMIN',
      isSuperAdmin: true,
      tenantId: superAdminTenant.id
    }
  });

  console.log('Created super admin:', superAdmin.username);

  // Create sample tenants
  const tenant1 = await prisma.tenant.upsert({
    where: { businessName: 'Trim N Fade Salon' },
    update: {},
    create: {
      businessName: 'Trim N Fade Salon',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isActive: true
    }
  });

  const tenant2 = await prisma.tenant.upsert({
    where: { businessName: 'Eddiko Systems' },
    update: {},
    create: {
      businessName: 'Eddiko Systems',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true
    }
  });

  console.log('Created tenants:', tenant1.businessName, tenant2.businessName);

  // Create admin users
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  const admin1 = await prisma.user.upsert({
    where: { 
      username_tenantId: {
        username: 'admin',
        tenantId: tenant1.id
      }
    },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      fullName: 'Salon Admin',
      role: 'ADMIN',
      tenantId: tenant1.id
    }
  });

  const admin2 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'admin',
        tenantId: tenant2.id
      }
    },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      fullName: 'Electronics Admin',
      role: 'ADMIN',
      tenantId: tenant2.id
    }
  });

  // Create cashier users
  const cashierPassword = await bcrypt.hash('cashier123', 10);
  
  const cashier1 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'cashier1',
        tenantId: tenant1.id
      }
    },
    update: {},
    create: {
      username: 'cashier1',
      password: cashierPassword,
      fullName: 'John Cashier',
      role: 'CASHIER',
      tenantId: tenant1.id
    }
  });

  // Create sample products for Tenant 1 (Salon)
  const product1 = await prisma.product.create({
    data: {
      name: 'Standard Haircut',
      description: 'Regular haircut service',
      category: 'SERVICE',
      costPrice: 0,
      sellingPrice: 5000,
      stockQuantity: 0,
      tenantId: tenant1.id
    }
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Premium Haircut',
      description: 'Premium haircut with styling',
      category: 'SERVICE',
      costPrice: 0,
      sellingPrice: 8000,
      stockQuantity: 0,
      tenantId: tenant1.id
    }
  });

  const product3 = await prisma.product.create({
    data: {
      name: 'Hair Shampoo',
      description: 'Professional hair shampoo',
      category: 'PRODUCT',
      costPrice: 3000,
      sellingPrice: 5000,
      stockQuantity: 20,
      tenantId: tenant1.id
    }
  });

  // Create sample products for Tenant 2 (Electronics)
  const product4 = await prisma.product.create({
    data: {
      name: 'Laptop Charger',
      description: 'Universal laptop charger',
      category: 'PRODUCT',
      costPrice: 15000,
      sellingPrice: 25000,
      stockQuantity: 15,
      barcode: 'CHG001',
      tenantId: tenant2.id
    }
  });

  const product5 = await prisma.product.create({
    data: {
      name: 'USB Cable',
      description: 'USB-C charging cable',
      category: 'PRODUCT',
      costPrice: 2000,
      sellingPrice: 5000,
      stockQuantity: 50,
      barcode: 'USB001',
      tenantId: tenant2.id
    }
  });

  console.log('Created sample products');
  console.log('\n=== Seed Complete ===');
  console.log('\nLogin Credentials:');
  console.log('SUPER ADMIN (All Access):');
  console.log('  Username: admin');
  console.log('  Password: admin');
  console.log('\nTenant 1 (Salon):');
  console.log('  Admin: username="admin", password="admin123"');
  console.log('  Cashier: username="cashier1", password="cashier123"');
  console.log('\nTenant 2 (Electronics):');
  console.log('  Admin: username="admin", password="admin123"');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
