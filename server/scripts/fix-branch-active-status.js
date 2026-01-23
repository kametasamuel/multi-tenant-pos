/**
 * Script to fix branches that have isActive set to false
 * Run with: node server/scripts/fix-branch-active-status.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBranchActiveStatus() {
  try {
    // Find all branches with isActive = false
    const inactiveBranches = await prisma.branch.findMany({
      where: {
        isActive: false
      },
      include: {
        tenant: {
          select: { businessName: true }
        }
      }
    });

    console.log(`Found ${inactiveBranches.length} inactive branch(es)`);

    if (inactiveBranches.length === 0) {
      console.log('All branches are already active.');
      return;
    }

    // Show what will be fixed
    console.log('\nBranches to be activated:');
    inactiveBranches.forEach(branch => {
      console.log(`  - ${branch.name} (Tenant: ${branch.tenant.businessName})`);
    });

    // Update all inactive branches to active
    const result = await prisma.branch.updateMany({
      where: {
        isActive: false
      },
      data: {
        isActive: true
      }
    });

    console.log(`\nSuccessfully activated ${result.count} branch(es)`);
  } catch (error) {
    console.error('Error fixing branch status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBranchActiveStatus();
