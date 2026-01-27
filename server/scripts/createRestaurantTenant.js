const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createRestaurantTenant() {
  console.log('Creating restaurant tenant...\n');

  try {
    // Check if tenant already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: 'bigtaste' }
    });

    if (existingTenant) {
      console.log('Tenant "bigtaste" already exists. Updating to restaurant type...');
      await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: {
          businessType: 'FOOD_AND_BEVERAGE',
          enableTables: true,
          enableKDS: true,
          enableModifiers: true,
          enableRunningTabs: true
        }
      });
      console.log('✓ Updated existing tenant to FOOD_AND_BEVERAGE\n');
      return existingTenant;
    }

    // Create new tenant
    const tenant = await prisma.tenant.create({
      data: {
        businessName: 'Big Taste Restaurant',
        slug: 'bigtaste',
        businessType: 'FOOD_AND_BEVERAGE',
        country: 'Ghana',
        currency: 'GHS',
        currencySymbol: 'GH₵',
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        enableTables: true,
        enableKDS: true,
        enableModifiers: true,
        enableRunningTabs: true
      }
    });
    console.log('✓ Created tenant: Big Taste Restaurant (slug: bigtaste)\n');

    // Create main branch
    const branch = await prisma.branch.create({
      data: {
        name: 'Big Taste Main',
        isMain: true,
        isActive: true,
        tenantId: tenant.id
      }
    });
    console.log('✓ Created main branch\n');

    // Create owner user
    const hashedPassword = await bcrypt.hash('Owner@123', 10);
    const owner = await prisma.user.create({
      data: {
        username: 'restaurantowner',
        password: hashedPassword,
        fullName: 'Restaurant Owner',
        email: 'owner@bigtaste.com',
        role: 'OWNER',
        isActive: true,
        tenantId: tenant.id,
        branchId: branch.id
      }
    });
    console.log('✓ Created owner: restaurantowner / Owner@123\n');

    // Create cashier user
    const cashierPassword = await bcrypt.hash('Cashier@123', 10);
    const cashier = await prisma.user.create({
      data: {
        username: 'restaurantcashier',
        password: cashierPassword,
        fullName: 'Restaurant Cashier',
        email: 'cashier@bigtaste.com',
        role: 'CASHIER',
        isActive: true,
        tenantId: tenant.id,
        branchId: branch.id
      }
    });
    console.log('✓ Created cashier: restaurantcashier / Cashier@123\n');

    // Create kitchen user
    const kitchenPassword = await bcrypt.hash('Kitchen@123', 10);
    const kitchen = await prisma.user.create({
      data: {
        username: 'kitchenstaff',
        password: kitchenPassword,
        fullName: 'Kitchen Staff',
        email: 'kitchen@bigtaste.com',
        role: 'CASHIER', // Using cashier role for kitchen access
        isActive: true,
        tenantId: tenant.id,
        branchId: branch.id
      }
    });
    console.log('✓ Created kitchen staff: kitchenstaff / Kitchen@123\n');

    // Create tables
    const tables = [];
    for (let i = 1; i <= 10; i++) {
      const table = await prisma.restaurantTable.create({
        data: {
          tableNumber: `T${i}`,
          capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
          section: i <= 5 ? 'Main Floor' : 'Patio',
          status: 'available',
          positionX: (i - 1) % 5 * 100,
          positionY: Math.floor((i - 1) / 5) * 100,
          tenantId: tenant.id,
          branchId: branch.id
        }
      });
      tables.push(table);
    }
    console.log('✓ Created 10 tables (T1-T10)\n');

    // Create food products
    const products = [
      // Appetizers
      { name: 'Spring Rolls', category: 'SERVICE', kitchenCategory: 'Appetizers', price: 15.00, prepTime: 10 },
      { name: 'Chicken Wings', category: 'SERVICE', kitchenCategory: 'Appetizers', price: 25.00, prepTime: 15 },
      { name: 'Garlic Bread', category: 'SERVICE', kitchenCategory: 'Appetizers', price: 10.00, prepTime: 8 },

      // Mains
      { name: 'Grilled Chicken', category: 'SERVICE', kitchenCategory: 'Mains', price: 45.00, prepTime: 25 },
      { name: 'Beef Burger', category: 'SERVICE', kitchenCategory: 'Mains', price: 35.00, prepTime: 20 },
      { name: 'Fish & Chips', category: 'SERVICE', kitchenCategory: 'Mains', price: 40.00, prepTime: 20 },
      { name: 'Jollof Rice with Chicken', category: 'SERVICE', kitchenCategory: 'Mains', price: 50.00, prepTime: 30 },
      { name: 'Fried Rice Special', category: 'SERVICE', kitchenCategory: 'Mains', price: 45.00, prepTime: 25 },

      // Desserts
      { name: 'Ice Cream Sundae', category: 'SERVICE', kitchenCategory: 'Desserts', price: 20.00, prepTime: 5 },
      { name: 'Chocolate Cake', category: 'SERVICE', kitchenCategory: 'Desserts', price: 25.00, prepTime: 5 },

      // Drinks (no kitchen)
      { name: 'Coca Cola', category: 'SERVICE', kitchenCategory: 'Drinks', price: 5.00, prepTime: 1 },
      { name: 'Fresh Orange Juice', category: 'SERVICE', kitchenCategory: 'Drinks', price: 12.00, prepTime: 5 },
      { name: 'Water Bottle', category: 'SERVICE', kitchenCategory: 'Drinks', price: 3.00, prepTime: 1 },
      { name: 'Beer (Local)', category: 'SERVICE', kitchenCategory: 'Drinks', price: 15.00, prepTime: 1 },
      { name: 'Smoothie', category: 'SERVICE', kitchenCategory: 'Drinks', price: 18.00, prepTime: 8 }
    ];

    for (const p of products) {
      await prisma.product.create({
        data: {
          name: p.name,
          type: p.category,
          sellingPrice: p.price,
          costPrice: p.price * 0.4,
          kitchenCategory: p.kitchenCategory,
          prepTime: p.prepTime,
          stockQuantity: 999,
          lowStockThreshold: 10,
          isActive: true,
          tenantId: tenant.id,
          branchId: branch.id
        }
      });
    }
    console.log(`✓ Created ${products.length} menu items\n`);

    // Create modifiers for some products
    const burger = await prisma.product.findFirst({
      where: { name: 'Beef Burger', tenantId: tenant.id }
    });

    if (burger) {
      // Size modifier
      await prisma.productModifier.create({
        data: {
          name: 'Size',
          type: 'radio',
          isRequired: true,
          sortOrder: 0,
          options: JSON.stringify([
            { label: 'Regular', price: 0 },
            { label: 'Large (+5)', price: 5 },
            { label: 'XL (+10)', price: 10 }
          ]),
          productId: burger.id,
          tenantId: tenant.id
        }
      });

      // Add-ons modifier
      await prisma.productModifier.create({
        data: {
          name: 'Add-ons',
          type: 'checkbox',
          isRequired: false,
          sortOrder: 1,
          options: JSON.stringify([
            { label: 'Extra Cheese', price: 3 },
            { label: 'Bacon', price: 5 },
            { label: 'Avocado', price: 4 },
            { label: 'Egg', price: 2 }
          ]),
          productId: burger.id,
          tenantId: tenant.id
        }
      });
      console.log('✓ Created modifiers for Beef Burger\n');
    }

    // Create modifiers for drinks
    const smoothie = await prisma.product.findFirst({
      where: { name: 'Smoothie', tenantId: tenant.id }
    });

    if (smoothie) {
      await prisma.productModifier.create({
        data: {
          name: 'Flavor',
          type: 'radio',
          isRequired: true,
          sortOrder: 0,
          options: JSON.stringify([
            { label: 'Mango', price: 0 },
            { label: 'Strawberry', price: 0 },
            { label: 'Mixed Berry', price: 2 },
            { label: 'Tropical', price: 2 }
          ]),
          productId: smoothie.id,
          tenantId: tenant.id
        }
      });
      console.log('✓ Created modifiers for Smoothie\n');
    }

    console.log('========================================');
    console.log('Restaurant tenant created successfully!');
    console.log('========================================\n');
    console.log('Login URL: http://localhost:3000/bigtaste/login');
    console.log('\nCredentials:');
    console.log('  Owner:   restaurantowner / Owner@123');
    console.log('  Cashier: restaurantcashier / Cashier@123');
    console.log('  Kitchen: kitchenstaff / Kitchen@123');
    console.log('\nKitchen Display: http://localhost:3000/bigtaste/kitchen');
    console.log('');

    return tenant;
  } catch (error) {
    console.error('Error creating restaurant tenant:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createRestaurantTenant();
