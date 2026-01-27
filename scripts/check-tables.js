const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tables = await prisma.restaurantTable.findMany({
    include: {
      tenant: { select: { businessName: true, slug: true } },
      branch: { select: { name: true } }
    }
  });
  console.log('Tables found:', tables.length);
  tables.forEach(t => console.log('  -', t.tableNumber, '| tenant:', t.tenant.slug, '| branch:', t.branch.name, '| status:', t.status));

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'bigtaste' } });
  console.log('\nBigTaste tenant:', tenant ? 'Found (id: ' + tenant.id + ')' : 'NOT FOUND');
  console.log('enableTables:', tenant?.enableTables);
  console.log('enableKDS:', tenant?.enableKDS);

  // Check branch
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant?.id } });
  console.log('\nBranch:', branch ? branch.name + ' (id: ' + branch.id + ')' : 'NOT FOUND');

  await prisma.$disconnect();
}
check();
