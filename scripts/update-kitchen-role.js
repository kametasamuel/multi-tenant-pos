// Script to update kitchen staff users to KITCHEN role
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find and update users with username containing 'kitchen'
  const result = await prisma.user.updateMany({
    where: {
      username: {
        contains: 'kitchen',
        mode: 'insensitive'
      }
    },
    data: {
      role: 'KITCHEN'
    }
  });

  console.log(`Updated ${result.count} user(s) to KITCHEN role`);

  // List all kitchen users
  const kitchenUsers = await prisma.user.findMany({
    where: { role: 'KITCHEN' },
    select: { id: true, username: true, fullName: true, role: true }
  });

  console.log('Kitchen staff users:', kitchenUsers);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
