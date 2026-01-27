#!/usr/bin/env node
/**
 * Seed Test Data Script
 *
 * Creates test businesses with sample data:
 * - bigtaste (Restaurant)
 * - trimnfade (Salon)
 * - eddiko (Retail)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Default password for all test accounts
const DEFAULT_PASSWORD = 'Test@123';

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function createTenant(data) {
  const existing = await prisma.tenant.findUnique({
    where: { businessName: data.businessName }
  });

  if (existing) {
    console.log(`  ⏭️  ${data.businessName} already exists, skipping...`);
    return existing;
  }

  const tenant = await prisma.tenant.create({ data });
  console.log(`  ✅ Created tenant: ${data.businessName}`);
  return tenant;
}

async function createUser(data) {
  const existing = await prisma.user.findFirst({
    where: {
      username: data.username,
      tenantId: data.tenantId
    }
  });

  if (existing) {
    console.log(`    ⏭️  User ${data.username} already exists`);
    return existing;
  }

  const user = await prisma.user.create({ data });
  console.log(`    ✅ Created user: ${data.username} (${data.role})`);
  return user;
}

async function createBranch(data) {
  const existing = await prisma.branch.findFirst({
    where: {
      name: data.name,
      tenantId: data.tenantId
    }
  });

  if (existing) {
    console.log(`    ⏭️  Branch ${data.name} already exists`);
    return existing;
  }

  const branch = await prisma.branch.create({ data });
  console.log(`    ✅ Created branch: ${data.name}`);
  return branch;
}

async function createProduct(data) {
  const existing = await prisma.product.findFirst({
    where: {
      name: data.name,
      tenantId: data.tenantId,
      branchId: data.branchId
    }
  });

  if (existing) return existing;

  const product = await prisma.product.create({ data });
  return product;
}

async function createModifier(data) {
  return prisma.productModifier.create({ data });
}

async function createTable(data) {
  const existing = await prisma.restaurantTable.findFirst({
    where: {
      tableNumber: data.tableNumber,
      tenantId: data.tenantId,
      branchId: data.branchId
    }
  });

  if (existing) return existing;
  // Ensure status is lowercase to match API expectations
  if (data.status) {
    data.status = data.status.toLowerCase();
  }
  return prisma.restaurantTable.create({ data });
}

async function seedBigTaste() {
  console.log('\n🍔 Creating BigTaste (Restaurant)...');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  const subscriptionEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // Create tenant
  const tenant = await createTenant({
    businessName: 'BigTaste Restaurant',
    slug: 'bigtaste',
    businessType: 'FOOD_AND_BEVERAGE',
    businessSubtype: 'restaurant',
    country: 'GH',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    taxRate: 0.125,
    enableTables: true,
    enableKDS: true,
    enableModifiers: true,
    subscriptionStart: new Date(),
    subscriptionEnd,
    isActive: true
  });

  // Create main branch
  const branch = await createBranch({
    name: 'BigTaste Main',
    address: 'Accra Mall, Accra',
    phone: '+233 20 123 4567',
    isMain: true,
    isActive: true,
    tenantId: tenant.id
  });

  // Create owner
  const owner = await createUser({
    username: 'bigtaste_owner',
    password: hashedPassword,
    fullName: 'Kofi Mensah',
    role: 'ADMIN',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create cashier
  await createUser({
    username: 'bigtaste_cashier',
    password: hashedPassword,
    fullName: 'Ama Serwaa',
    role: 'CASHIER',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create kitchen staff
  await createUser({
    username: 'bigtaste_kitchen',
    password: hashedPassword,
    fullName: 'Kwame Asante',
    role: 'KITCHEN',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create menu items
  console.log('    📋 Creating menu items...');

  const menuItems = [
    // Main Dishes
    { name: 'Jollof Rice', price: 45, category: 'SERVICE', customCategory: 'Main Dishes', kitchen: 'HOT' },
    { name: 'Fried Rice', price: 50, category: 'SERVICE', customCategory: 'Main Dishes', kitchen: 'HOT' },
    { name: 'Waakye', price: 35, category: 'SERVICE', customCategory: 'Main Dishes', kitchen: 'HOT' },
    { name: 'Banku & Tilapia', price: 80, category: 'SERVICE', customCategory: 'Main Dishes', kitchen: 'HOT' },
    { name: 'Fufu & Light Soup', price: 65, category: 'SERVICE', customCategory: 'Main Dishes', kitchen: 'HOT' },
    // Proteins
    { name: 'Grilled Chicken', price: 55, category: 'SERVICE', customCategory: 'Proteins', kitchen: 'GRILL' },
    { name: 'Fried Fish', price: 40, category: 'SERVICE', customCategory: 'Proteins', kitchen: 'HOT' },
    { name: 'Beef Kebab', price: 35, category: 'SERVICE', customCategory: 'Proteins', kitchen: 'GRILL' },
    // Drinks
    { name: 'Coca Cola', price: 10, category: 'PRODUCT', customCategory: 'Drinks', stock: 100 },
    { name: 'Fanta', price: 10, category: 'PRODUCT', customCategory: 'Drinks', stock: 100 },
    { name: 'Malt', price: 12, category: 'PRODUCT', customCategory: 'Drinks', stock: 80 },
    { name: 'Fresh Juice', price: 20, category: 'SERVICE', customCategory: 'Drinks', kitchen: 'BAR' },
    // Sides
    { name: 'Kelewele', price: 15, category: 'SERVICE', customCategory: 'Sides', kitchen: 'HOT' },
    { name: 'Fried Plantain', price: 12, category: 'SERVICE', customCategory: 'Sides', kitchen: 'HOT' },
    { name: 'Coleslaw', price: 10, category: 'SERVICE', customCategory: 'Sides', kitchen: 'COLD' },
  ];

  const createdProducts = [];
  for (const item of menuItems) {
    const product = await createProduct({
      name: item.name,
      type: item.category,
      customCategory: item.customCategory,
      sellingPrice: item.price,
      costPrice: item.price * 0.4,
      stockQuantity: item.stock || 0,
      kitchenCategory: item.kitchen || null,
      isActive: true,
      tenantId: tenant.id,
      branchId: branch.id
    });
    createdProducts.push(product);
  }
  console.log(`    ✅ Created ${menuItems.length} menu items`);

  // Create modifiers for Jollof Rice
  const jollof = createdProducts.find(p => p.name === 'Jollof Rice');
  if (jollof) {
    await createModifier({
      name: 'Protein',
      type: 'checkbox',
      isRequired: false,
      options: JSON.stringify([
        { label: 'Chicken', price: 20 },
        { label: 'Fish', price: 15 },
        { label: 'Beef', price: 18 },
        { label: 'Egg', price: 5 }
      ]),
      productId: jollof.id,
      tenantId: tenant.id
    });

    await createModifier({
      name: 'Spice Level',
      type: 'radio',
      isRequired: false,
      options: JSON.stringify([
        { label: 'Mild', price: 0 },
        { label: 'Medium', price: 0 },
        { label: 'Hot', price: 0 },
        { label: 'Extra Hot', price: 2 }
      ]),
      productId: jollof.id,
      tenantId: tenant.id
    });
    console.log('    ✅ Created modifiers for Jollof Rice');
  }

  // Create tables
  console.log('    🪑 Creating tables...');
  for (let i = 1; i <= 10; i++) {
    await createTable({
      tableNumber: `T${i}`,
      capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      status: 'available',
      tenantId: tenant.id,
      branchId: branch.id
    });
  }
  console.log('    ✅ Created 10 tables');

  return tenant;
}

async function seedTrimNFade() {
  console.log('\n💇 Creating Trim N Fade (Salon)...');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  const subscriptionEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // Create tenant
  const tenant = await createTenant({
    businessName: 'Trim N Fade Barbershop',
    slug: 'trimnfade',
    businessType: 'SERVICES',
    businessSubtype: 'barbershop',
    country: 'GH',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    taxRate: 0,
    subscriptionStart: new Date(),
    subscriptionEnd,
    isActive: true
  });

  // Create main branch
  const branch = await createBranch({
    name: 'Trim N Fade Osu',
    address: 'Oxford Street, Osu, Accra',
    phone: '+233 24 555 1234',
    isMain: true,
    isActive: true,
    tenantId: tenant.id
  });

  // Create owner
  await createUser({
    username: 'trim_owner',
    password: hashedPassword,
    fullName: 'Kwesi Boateng',
    role: 'ADMIN',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create cashier
  await createUser({
    username: 'trim_cashier',
    password: hashedPassword,
    fullName: 'Efua Darko',
    role: 'CASHIER',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create attendants (barbers)
  const barbers = [
    { name: 'Prince Mensah', specialty: 'Fades & Designs', commission: 40 },
    { name: 'Emmanuel Tetteh', specialty: 'Beards & Lineups', commission: 35 },
    { name: 'Daniel Adjei', specialty: 'Kids Cuts', commission: 30 }
  ];

  for (const barber of barbers) {
    await prisma.attendant.create({
      data: {
        fullName: barber.name,
        phone: '+233 20 000 0000',
        specialty: barber.specialty,
        commissionRate: barber.commission,
        isActive: true,
        tenantId: tenant.id,
        branchId: branch.id
      }
    }).catch(() => {}); // Skip if exists
  }
  console.log(`    ✅ Created ${barbers.length} barbers`);

  // Create services
  console.log('    ✂️ Creating services...');
  const services = [
    { name: 'Basic Haircut', price: 30, customCategory: 'Haircuts' },
    { name: 'Skin Fade', price: 50, customCategory: 'Haircuts' },
    { name: 'Low Fade', price: 45, customCategory: 'Haircuts' },
    { name: 'High Fade', price: 45, customCategory: 'Haircuts' },
    { name: 'Beard Trim', price: 20, customCategory: 'Beard' },
    { name: 'Beard Shape-Up', price: 35, customCategory: 'Beard' },
    { name: 'Hot Towel Shave', price: 40, customCategory: 'Beard' },
    { name: 'Hair Design', price: 25, customCategory: 'Extras' },
    { name: 'Hair Coloring', price: 80, customCategory: 'Extras' },
    { name: 'Kids Cut (Under 12)', price: 25, customCategory: 'Kids' },
  ];

  for (const service of services) {
    await createProduct({
      name: service.name,
      type: 'SERVICE',
      customCategory: service.customCategory,
      sellingPrice: service.price,
      costPrice: 0,
      stockQuantity: 0,
      isActive: true,
      tenantId: tenant.id,
      branchId: branch.id
    });
  }
  console.log(`    ✅ Created ${services.length} services`);

  // Create some products (hair products for sale)
  const products = [
    { name: 'Hair Pomade', price: 45, cost: 25, stock: 20 },
    { name: 'Beard Oil', price: 60, cost: 30, stock: 15 },
    { name: 'Hair Gel', price: 25, cost: 12, stock: 30 },
    { name: 'Aftershave Balm', price: 35, cost: 18, stock: 25 },
  ];

  for (const product of products) {
    await createProduct({
      name: product.name,
      type: 'PRODUCT',
      customCategory: 'Hair Products',
      sellingPrice: product.price,
      costPrice: product.cost,
      stockQuantity: product.stock,
      lowStockThreshold: 5,
      isActive: true,
      tenantId: tenant.id,
      branchId: branch.id
    });
  }
  console.log(`    ✅ Created ${products.length} products`);

  return tenant;
}

async function seedEddiko() {
  console.log('\n🛒 Creating Eddiko (Retail)...');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  const subscriptionEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // Create tenant
  const tenant = await createTenant({
    businessName: 'Eddiko Supermarket',
    slug: 'eddiko',
    businessType: 'RETAIL',
    businessSubtype: 'supermarket',
    country: 'NG',
    currency: 'NGN',
    currencySymbol: '₦',
    taxRate: 0.075,
    subscriptionStart: new Date(),
    subscriptionEnd,
    isActive: true
  });

  // Create main branch
  const branch = await createBranch({
    name: 'Eddiko Victoria Island',
    address: 'Victoria Island, Lagos',
    phone: '+234 801 234 5678',
    isMain: true,
    isActive: true,
    tenantId: tenant.id
  });

  // Create owner
  await createUser({
    username: 'eddiko_owner',
    password: hashedPassword,
    fullName: 'Chidi Okonkwo',
    role: 'ADMIN',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create manager
  await createUser({
    username: 'eddiko_manager',
    password: hashedPassword,
    fullName: 'Ngozi Eze',
    role: 'MANAGER',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create cashiers
  await createUser({
    username: 'eddiko_cashier1',
    password: hashedPassword,
    fullName: 'Tunde Bakare',
    role: 'CASHIER',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  await createUser({
    username: 'eddiko_cashier2',
    password: hashedPassword,
    fullName: 'Amina Yusuf',
    role: 'CASHIER',
    isActive: true,
    tenantId: tenant.id,
    branchId: branch.id
  });

  // Create products
  console.log('    📦 Creating products...');
  const products = [
    // Groceries
    { name: 'Rice (5kg)', price: 8500, cost: 7000, stock: 50, category: 'Groceries' },
    { name: 'Spaghetti Pack', price: 1200, cost: 900, stock: 100, category: 'Groceries' },
    { name: 'Vegetable Oil (3L)', price: 6500, cost: 5500, stock: 40, category: 'Groceries' },
    { name: 'Tomato Paste (Tin)', price: 800, cost: 600, stock: 80, category: 'Groceries' },
    { name: 'Sugar (1kg)', price: 1500, cost: 1200, stock: 60, category: 'Groceries' },
    // Beverages
    { name: 'Coca Cola (50cl)', price: 350, cost: 250, stock: 200, category: 'Beverages' },
    { name: 'Pepsi (50cl)', price: 350, cost: 250, stock: 180, category: 'Beverages' },
    { name: 'Hollandia Yogurt', price: 500, cost: 380, stock: 50, category: 'Beverages' },
    { name: 'Peak Milk (Tin)', price: 1800, cost: 1400, stock: 70, category: 'Beverages' },
    { name: 'Milo (400g)', price: 3200, cost: 2600, stock: 45, category: 'Beverages' },
    // Snacks
    { name: 'Gala Sausage Roll', price: 300, cost: 220, stock: 100, category: 'Snacks' },
    { name: 'Digestive Biscuits', price: 850, cost: 650, stock: 60, category: 'Snacks' },
    { name: 'Pringles (Small)', price: 1500, cost: 1100, stock: 40, category: 'Snacks' },
    { name: 'Chin Chin Pack', price: 500, cost: 350, stock: 80, category: 'Snacks' },
    // Personal Care
    { name: 'Dettol Soap', price: 450, cost: 320, stock: 100, category: 'Personal Care' },
    { name: 'Close Up Toothpaste', price: 600, cost: 450, stock: 80, category: 'Personal Care' },
    { name: 'Nivea Body Lotion', price: 2500, cost: 1900, stock: 35, category: 'Personal Care' },
    { name: 'Always Pads', price: 1200, cost: 900, stock: 50, category: 'Personal Care' },
    // Household
    { name: 'Harpic Toilet Cleaner', price: 950, cost: 700, stock: 40, category: 'Household' },
    { name: 'Morning Fresh (500ml)', price: 1100, cost: 800, stock: 55, category: 'Household' },
  ];

  for (const product of products) {
    await createProduct({
      name: product.name,
      type: 'PRODUCT',
      customCategory: product.category,
      sellingPrice: product.price,
      costPrice: product.cost,
      stockQuantity: product.stock,
      lowStockThreshold: 10,
      isActive: true,
      tenantId: tenant.id,
      branchId: branch.id
    });
  }
  console.log(`    ✅ Created ${products.length} products`);

  return tenant;
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║        SEEDING TEST DATA                   ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await seedBigTaste();
    await seedTrimNFade();
    await seedEddiko();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║        ✅ SEED COMPLETE!                   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n📋 Test Accounts Created:\n');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│ BIGTASTE RESTAURANT (Restaurant)                    │');
    console.log('│   URL: /bigtaste/login                              │');
    console.log('│   Owner: bigtaste_owner / Test@123                  │');
    console.log('│   Cashier: bigtaste_cashier / Test@123              │');
    console.log('│   Kitchen: bigtaste_kitchen / Test@123              │');
    console.log('├─────────────────────────────────────────────────────┤');
    console.log('│ TRIM N FADE (Salon)                                 │');
    console.log('│   URL: /trimnfade/login                             │');
    console.log('│   Owner: trim_owner / Test@123                      │');
    console.log('│   Cashier: trim_cashier / Test@123                  │');
    console.log('├─────────────────────────────────────────────────────┤');
    console.log('│ EDDIKO SUPERMARKET (Retail)                         │');
    console.log('│   URL: /eddiko/login                                │');
    console.log('│   Owner: eddiko_owner / Test@123                    │');
    console.log('│   Manager: eddiko_manager / Test@123                │');
    console.log('│   Cashiers: eddiko_cashier1, eddiko_cashier2        │');
    console.log('└─────────────────────────────────────────────────────┘');
    console.log('\n🔑 All passwords: Test@123\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
