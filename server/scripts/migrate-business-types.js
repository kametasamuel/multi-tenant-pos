/**
 * Migration script to update existing tenants from legacy business types
 * to the new 4-category system (RETAIL, FOOD_AND_BEVERAGE, HOSPITALITY, SERVICES)
 *
 * Run with: node server/scripts/migrate-business-types.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapping from legacy types to new main categories + subtypes
const LEGACY_TYPE_MAPPING = {
  // Already main categories - just need subtypes
  RETAIL: { mainType: 'RETAIL', subtype: 'general' },
  FOOD_AND_BEVERAGE: { mainType: 'FOOD_AND_BEVERAGE', subtype: 'restaurant' },
  HOSPITALITY: { mainType: 'HOSPITALITY', subtype: 'hotel' },
  SERVICES: { mainType: 'SERVICES', subtype: 'other_services' },

  // Legacy types that need migration
  RESTAURANT: { mainType: 'FOOD_AND_BEVERAGE', subtype: 'restaurant' },
  SALON: { mainType: 'SERVICES', subtype: 'salon' },
  PHARMACY: { mainType: 'RETAIL', subtype: 'pharmacy' },
  GROCERY: { mainType: 'RETAIL', subtype: 'grocery' },
  ELECTRONICS: { mainType: 'RETAIL', subtype: 'electronics' },
  CLOTHING: { mainType: 'RETAIL', subtype: 'clothing' },
  OTHER: { mainType: 'RETAIL', subtype: 'other_retail' }
};

async function migrateTenants() {
  console.log('Starting business type migration...\n');

  // Get all tenants
  const tenants = await prisma.tenant.findMany({
    where: {
      businessName: { not: 'System Admin' }
    },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      businessSubtype: true
    }
  });

  console.log(`Found ${tenants.length} tenants to check\n`);

  let updated = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const mapping = LEGACY_TYPE_MAPPING[tenant.businessType];

    if (!mapping) {
      console.log(`⚠️  Unknown type for "${tenant.businessName}": ${tenant.businessType}`);
      skipped++;
      continue;
    }

    // Check if migration is needed
    const needsTypeUpdate = tenant.businessType !== mapping.mainType;
    const needsSubtypeUpdate = !tenant.businessSubtype;

    if (needsTypeUpdate || needsSubtypeUpdate) {
      console.log(`📝 Migrating "${tenant.businessName}":`);
      console.log(`   Old: ${tenant.businessType} / ${tenant.businessSubtype || 'null'}`);
      console.log(`   New: ${mapping.mainType} / ${mapping.subtype}`);

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          businessType: mapping.mainType,
          businessSubtype: tenant.businessSubtype || mapping.subtype
        }
      });

      updated++;
    } else {
      console.log(`✓  "${tenant.businessName}" already migrated (${tenant.businessType}/${tenant.businessSubtype})`);
      skipped++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Migration complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`========================================\n`);
}

async function migrateApplications() {
  console.log('Checking pending applications...\n');

  const applications = await prisma.tenantApplication.findMany({
    where: { status: 'PENDING' },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      businessSubtype: true
    }
  });

  console.log(`Found ${applications.length} pending applications\n`);

  let updated = 0;

  for (const app of applications) {
    const mapping = LEGACY_TYPE_MAPPING[app.businessType];

    if (mapping && (app.businessType !== mapping.mainType || !app.businessSubtype)) {
      console.log(`📝 Migrating application "${app.businessName}"`);

      await prisma.tenantApplication.update({
        where: { id: app.id },
        data: {
          businessType: mapping.mainType,
          businessSubtype: app.businessSubtype || mapping.subtype
        }
      });

      updated++;
    }
  }

  console.log(`\nApplications updated: ${updated}\n`);
}

async function main() {
  try {
    await migrateTenants();
    await migrateApplications();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
