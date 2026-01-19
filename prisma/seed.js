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
      isActive: true,
      businessType: 'OTHER'
    }
  });

  // Create super admin user
  const superAdminPassword = await bcrypt.hash('Admin@123', 10);
  const superAdmin = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'superadmin',
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
      username: 'superadmin',
      password: superAdminPassword,
      fullName: 'Super Administrator',
      role: 'ADMIN',
      isSuperAdmin: true,
      tenantId: superAdminTenant.id
    }
  });

  console.log('Created super admin:', superAdmin.username);

  // Create sample tenants with business types
  const tenant1 = await prisma.tenant.upsert({
    where: { businessName: 'Trim N Fade Salon' },
    update: { businessType: 'SALON' },
    create: {
      businessName: 'Trim N Fade Salon',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isActive: true,
      businessType: 'SALON',
      currency: 'GHS',
      currencySymbol: 'GH₵'
    }
  });

  const tenant2 = await prisma.tenant.upsert({
    where: { businessName: 'Eddiko Electronics' },
    update: { businessType: 'ELECTRONICS' },
    create: {
      businessName: 'Eddiko Electronics',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      businessType: 'ELECTRONICS',
      currency: 'USD',
      currencySymbol: '$'
    }
  });

  const tenant3 = await prisma.tenant.upsert({
    where: { businessName: 'QuickMart Grocery' },
    update: { businessType: 'GROCERY' },
    create: {
      businessName: 'QuickMart Grocery',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      businessType: 'GROCERY',
      currency: 'NGN',
      currencySymbol: '₦'
    }
  });

  console.log('Created tenants:', tenant1.businessName, tenant2.businessName, tenant3.businessName);

  // Hash passwords
  const ownerPassword = await bcrypt.hash('Owner@123', 10);
  const managerPassword = await bcrypt.hash('Manager@123', 10);
  const cashierPassword = await bcrypt.hash('Cashier@123', 10);

  // ========== TENANT 1: Trim N Fade Salon ==========

  // Owner for Tenant 1
  const owner1 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'salonowner',
        tenantId: tenant1.id
      }
    },
    update: { password: ownerPassword, role: 'OWNER' },
    create: {
      username: 'salonowner',
      password: ownerPassword,
      fullName: 'Sarah Johnson',
      role: 'OWNER',
      tenantId: tenant1.id
    }
  });

  // Manager for Tenant 1
  const manager1 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'salonmanager',
        tenantId: tenant1.id
      }
    },
    update: { password: managerPassword, role: 'MANAGER' },
    create: {
      username: 'salonmanager',
      password: managerPassword,
      fullName: 'Mike Williams',
      role: 'MANAGER',
      tenantId: tenant1.id
    }
  });

  // Cashier for Tenant 1
  const cashier1 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'saloncashier',
        tenantId: tenant1.id
      }
    },
    update: { password: cashierPassword },
    create: {
      username: 'saloncashier',
      password: cashierPassword,
      fullName: 'John Cashier',
      role: 'CASHIER',
      tenantId: tenant1.id
    }
  });

  // ========== TENANT 2: Eddiko Electronics ==========

  // Owner for Tenant 2
  const owner2 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'elecowner',
        tenantId: tenant2.id
      }
    },
    update: { password: ownerPassword, role: 'OWNER' },
    create: {
      username: 'elecowner',
      password: ownerPassword,
      fullName: 'David Chen',
      role: 'OWNER',
      tenantId: tenant2.id
    }
  });

  // Manager for Tenant 2
  const manager2 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'elecmanager',
        tenantId: tenant2.id
      }
    },
    update: { password: managerPassword, role: 'MANAGER' },
    create: {
      username: 'elecmanager',
      password: managerPassword,
      fullName: 'Lisa Park',
      role: 'MANAGER',
      tenantId: tenant2.id
    }
  });

  // Cashier for Tenant 2
  const cashier2 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'eleccashier',
        tenantId: tenant2.id
      }
    },
    update: { password: cashierPassword },
    create: {
      username: 'eleccashier',
      password: cashierPassword,
      fullName: 'Tom Anderson',
      role: 'CASHIER',
      tenantId: tenant2.id
    }
  });

  // ========== TENANT 3: QuickMart Grocery ==========

  // Owner for Tenant 3
  const owner3 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'groceryowner',
        tenantId: tenant3.id
      }
    },
    update: { password: ownerPassword, role: 'OWNER' },
    create: {
      username: 'groceryowner',
      password: ownerPassword,
      fullName: 'Amina Okonkwo',
      role: 'OWNER',
      tenantId: tenant3.id
    }
  });

  // Manager for Tenant 3
  const manager3 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'grocerymanager',
        tenantId: tenant3.id
      }
    },
    update: { password: managerPassword, role: 'MANAGER' },
    create: {
      username: 'grocerymanager',
      password: managerPassword,
      fullName: 'Chidi Nwachukwu',
      role: 'MANAGER',
      tenantId: tenant3.id
    }
  });

  // Cashier for Tenant 3
  const cashier3 = await prisma.user.upsert({
    where: {
      username_tenantId: {
        username: 'grocerycashier',
        tenantId: tenant3.id
      }
    },
    update: { password: cashierPassword },
    create: {
      username: 'grocerycashier',
      password: cashierPassword,
      fullName: 'Fatima Ibrahim',
      role: 'CASHIER',
      tenantId: tenant3.id
    }
  });

  // ========== SAMPLE PRODUCTS ==========

  // Products for Tenant 1 (Salon) - Services and Products
  await prisma.product.createMany({
    data: [
      {
        name: 'Standard Haircut',
        description: 'Regular haircut service',
        category: 'SERVICE',
        costPrice: 0,
        sellingPrice: 5000,
        stockQuantity: 0,
        tenantId: tenant1.id
      },
      {
        name: 'Premium Haircut',
        description: 'Premium haircut with styling',
        category: 'SERVICE',
        costPrice: 0,
        sellingPrice: 8000,
        stockQuantity: 0,
        tenantId: tenant1.id
      },
      {
        name: 'Beard Trim',
        description: 'Professional beard trimming',
        category: 'SERVICE',
        costPrice: 0,
        sellingPrice: 3000,
        stockQuantity: 0,
        tenantId: tenant1.id
      },
      {
        name: 'Hot Towel Shave',
        description: 'Traditional hot towel shave',
        category: 'SERVICE',
        costPrice: 0,
        sellingPrice: 4500,
        stockQuantity: 0,
        tenantId: tenant1.id
      },
      {
        name: 'Hair Shampoo',
        description: 'Professional hair shampoo',
        category: 'PRODUCT',
        costPrice: 3000,
        sellingPrice: 5000,
        stockQuantity: 20,
        tenantId: tenant1.id
      },
      {
        name: 'Hair Gel',
        description: 'Styling hair gel',
        category: 'PRODUCT',
        costPrice: 1500,
        sellingPrice: 2500,
        stockQuantity: 30,
        tenantId: tenant1.id
      }
    ],
    skipDuplicates: true
  });

  // Products for Tenant 2 (Electronics)
  await prisma.product.createMany({
    data: [
      {
        name: 'Laptop Charger',
        description: 'Universal laptop charger',
        category: 'PRODUCT',
        costPrice: 15000,
        sellingPrice: 25000,
        stockQuantity: 15,
        barcode: 'CHG001',
        tenantId: tenant2.id
      },
      {
        name: 'USB-C Cable',
        description: 'USB-C charging cable',
        category: 'PRODUCT',
        costPrice: 2000,
        sellingPrice: 5000,
        stockQuantity: 50,
        barcode: 'USB001',
        tenantId: tenant2.id
      },
      {
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse',
        category: 'PRODUCT',
        costPrice: 8000,
        sellingPrice: 15000,
        stockQuantity: 25,
        barcode: 'MOU001',
        tenantId: tenant2.id
      },
      {
        name: 'Bluetooth Speaker',
        description: 'Portable Bluetooth speaker',
        category: 'PRODUCT',
        costPrice: 12000,
        sellingPrice: 22000,
        stockQuantity: 18,
        barcode: 'SPK001',
        tenantId: tenant2.id
      },
      {
        name: 'Phone Screen Protector',
        description: 'Tempered glass screen protector',
        category: 'PRODUCT',
        costPrice: 500,
        sellingPrice: 1500,
        stockQuantity: 100,
        barcode: 'SCR001',
        tenantId: tenant2.id
      },
      {
        name: 'Phone Repair Service',
        description: 'Screen replacement service',
        category: 'SERVICE',
        costPrice: 0,
        sellingPrice: 35000,
        stockQuantity: 0,
        tenantId: tenant2.id
      }
    ],
    skipDuplicates: true
  });

  // Products for Tenant 3 (Grocery)
  await prisma.product.createMany({
    data: [
      {
        name: 'Bread Loaf',
        description: 'Fresh baked bread',
        category: 'PRODUCT',
        costPrice: 300,
        sellingPrice: 500,
        stockQuantity: 50,
        barcode: 'BRD001',
        tenantId: tenant3.id
      },
      {
        name: 'Milk 1L',
        description: 'Fresh whole milk',
        category: 'PRODUCT',
        costPrice: 800,
        sellingPrice: 1200,
        stockQuantity: 40,
        barcode: 'MLK001',
        tenantId: tenant3.id
      },
      {
        name: 'Rice 5kg',
        description: 'Premium quality rice',
        category: 'PRODUCT',
        costPrice: 4000,
        sellingPrice: 6000,
        stockQuantity: 30,
        barcode: 'RCE001',
        tenantId: tenant3.id
      },
      {
        name: 'Cooking Oil 1L',
        description: 'Vegetable cooking oil',
        category: 'PRODUCT',
        costPrice: 1500,
        sellingPrice: 2200,
        stockQuantity: 35,
        barcode: 'OIL001',
        tenantId: tenant3.id
      },
      {
        name: 'Sugar 1kg',
        description: 'Refined white sugar',
        category: 'PRODUCT',
        costPrice: 600,
        sellingPrice: 900,
        stockQuantity: 45,
        barcode: 'SGR001',
        tenantId: tenant3.id
      }
    ],
    skipDuplicates: true
  });

  console.log('Created sample products');

  // ========== PRINT TEST CREDENTIALS ==========
  console.log('\n' + '='.repeat(60));
  console.log('               TEST CREDENTIALS');
  console.log('='.repeat(60));

  console.log('\n--- SUPER ADMIN (Full Platform Access) ---');
  console.log('  Username: superadmin');
  console.log('  Password: Admin@123');

  console.log('\n--- TENANT 1: Trim N Fade Salon (GH₵) ---');
  console.log('  OWNER:');
  console.log('    Username: salonowner');
  console.log('    Password: Owner@123');
  console.log('  MANAGER:');
  console.log('    Username: salonmanager');
  console.log('    Password: Manager@123');
  console.log('  CASHIER:');
  console.log('    Username: saloncashier');
  console.log('    Password: Cashier@123');

  console.log('\n--- TENANT 2: Eddiko Electronics ($) ---');
  console.log('  OWNER:');
  console.log('    Username: elecowner');
  console.log('    Password: Owner@123');
  console.log('  MANAGER:');
  console.log('    Username: elecmanager');
  console.log('    Password: Manager@123');
  console.log('  CASHIER:');
  console.log('    Username: eleccashier');
  console.log('    Password: Cashier@123');

  console.log('\n--- TENANT 3: QuickMart Grocery (₦) ---');
  console.log('  OWNER:');
  console.log('    Username: groceryowner');
  console.log('    Password: Owner@123');
  console.log('  MANAGER:');
  console.log('    Username: grocerymanager');
  console.log('    Password: Manager@123');
  console.log('  CASHIER:');
  console.log('    Username: grocerycashier');
  console.log('    Password: Cashier@123');

  console.log('\n' + '='.repeat(60));
  console.log('              SEED COMPLETE!');
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
