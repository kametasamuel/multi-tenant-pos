const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Creating hospitality tenant for testing...\n');

  // Find or create a tier
  let tier = await prisma.subscriptionTier.findFirst();
  if (!tier) {
    tier = await prisma.subscriptionTier.create({
      data: {
        name: 'Hospitality Standard',
        description: 'Standard tier for hospitality businesses',
        monthlyPrice: 0,
        annualPrice: 0,
        maxBranches: 5,
        maxUsers: 50,
        maxProducts: 1000
      }
    });
    console.log('Created subscription tier:', tier.name);
  }

  // Create hospitality tenant
  const subscriptionEnd = new Date();
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1); // 1 year subscription

  const tenant = await prisma.tenant.create({
    data: {
      businessName: 'Grand Plaza Hotel',
      slug: 'grandplaza',
      businessType: 'HOSPITALITY',
      country: 'Ghana',
      currency: 'GHS',
      currencySymbol: 'GH₵',
      tierId: tier.id,
      isActive: true,
      subscriptionStart: new Date(),
      subscriptionEnd: subscriptionEnd,
      enableHousekeeping: true,
      enableRoomService: true,
      enableFolios: true,
      enableRatePlans: true
    }
  });
  console.log('Created tenant:', tenant.businessName, '(' + tenant.slug + ')');

  // Create main branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Main Building',
      tenantId: tenant.id,
      isMain: true,
      isActive: true
    }
  });
  console.log('Created branch:', branch.name);

  // Create owner user
  const hashedPassword = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.create({
    data: {
      username: 'hotelowner',
      password: hashedPassword,
      fullName: 'Hotel Owner',
      role: 'OWNER',
      tenantId: tenant.id,
      branchId: branch.id
    }
  });
  console.log('Created owner:', owner.username, '(password: owner123)');

  // Create front desk staff
  const frontDeskPassword = await bcrypt.hash('frontdesk123', 10);
  const frontDesk = await prisma.user.create({
    data: {
      username: 'frontdesk',
      password: frontDeskPassword,
      fullName: 'Front Desk Staff',
      role: 'CASHIER',
      tenantId: tenant.id,
      branchId: branch.id
    }
  });
  console.log('Created front desk user:', frontDesk.username, '(password: frontdesk123)');

  // Create housekeeper
  const housekeeperPassword = await bcrypt.hash('housekeeper123', 10);
  const housekeeper = await prisma.user.create({
    data: {
      username: 'housekeeper',
      password: housekeeperPassword,
      fullName: 'Housekeeping Staff',
      role: 'CASHIER',
      tenantId: tenant.id,
      branchId: branch.id
    }
  });
  console.log('Created housekeeper:', housekeeper.username, '(password: housekeeper123)');

  // Create room types
  const roomTypes = await Promise.all([
    prisma.roomType.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        code: 'STD',
        name: 'Standard Room',
        description: 'Comfortable room with basic amenities',
        basePrice: 150.00,
        maxOccupancy: 2,
        bedType: 'Double',
        amenities: JSON.stringify(['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge'])
      }
    }),
    prisma.roomType.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        code: 'DLX',
        name: 'Deluxe Room',
        description: 'Spacious room with premium amenities',
        basePrice: 250.00,
        maxOccupancy: 3,
        bedType: 'Queen',
        amenities: JSON.stringify(['WiFi', 'Smart TV', 'Air Conditioning', 'Mini Bar', 'Coffee Maker', 'Balcony'])
      }
    }),
    prisma.roomType.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        code: 'STE',
        name: 'Suite',
        description: 'Luxury suite with separate living area',
        basePrice: 450.00,
        maxOccupancy: 4,
        bedType: 'King',
        amenities: JSON.stringify(['WiFi', 'Smart TV', 'Air Conditioning', 'Full Bar', 'Kitchen', 'Jacuzzi', 'Balcony', 'Living Room'])
      }
    })
  ]);
  console.log('Created room types:', roomTypes.map(r => r.name).join(', '));

  // Create rooms
  const rooms = [];
  // Floor 1: Standard rooms (101-105)
  for (let i = 1; i <= 5; i++) {
    const room = await prisma.room.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roomTypeId: roomTypes[0].id,
        roomNumber: `10${i}`,
        floor: '1',
        status: i === 1 ? 'cleaning' : i === 2 ? 'occupied' : 'available'
      }
    });
    rooms.push(room);
  }
  // Floor 2: Deluxe rooms (201-205)
  for (let i = 1; i <= 5; i++) {
    const room = await prisma.room.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roomTypeId: roomTypes[1].id,
        roomNumber: `20${i}`,
        floor: '2',
        status: i === 1 ? 'reserved' : i === 3 ? 'maintenance' : 'available'
      }
    });
    rooms.push(room);
  }
  // Floor 3: Suites (301-303)
  for (let i = 1; i <= 3; i++) {
    const room = await prisma.room.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roomTypeId: roomTypes[2].id,
        roomNumber: `30${i}`,
        floor: '3',
        status: 'available'
      }
    });
    rooms.push(room);
  }
  console.log('Created', rooms.length, 'rooms across 3 floors');

  // Create sample guests
  const guests = await Promise.all([
    prisma.guest.create({
      data: {
        tenantId: tenant.id,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phone: '+233201234567',
        idType: 'passport',
        idNumber: 'AB123456',
        nationality: 'USA',
        country: 'USA',
        vipStatus: 'regular'
      }
    }),
    prisma.guest.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Akosua',
        lastName: 'Mensah',
        email: 'akosua.mensah@email.com',
        phone: '+233551234567',
        idType: 'national_id',
        idNumber: 'GHA-123456789',
        nationality: 'Ghana',
        country: 'Ghana',
        vipStatus: 'gold',
        notes: 'Frequent guest, prefers room with view'
      }
    }),
    prisma.guest.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Kwame',
        lastName: 'Asante',
        email: 'kwame.asante@email.com',
        phone: '+233241234567',
        idType: 'drivers_license',
        idNumber: 'DL-987654',
        nationality: 'Ghana',
        country: 'Ghana',
        vipStatus: 'regular'
      }
    })
  ]);
  console.log('Created', guests.length, 'sample guests');

  // Create sample bookings
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Booking 1: Currently checked in (room 102)
  const booking1 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      bookingNumber: 'BK-2024-0001',
      guestId: guests[1].id,
      checkInDate: twoDaysAgo,
      checkOutDate: tomorrow,
      status: 'checked_in',
      totalAmount: 500.00,
      paidAmount: 200.00,
      source: 'walk_in',
      adultsCount: 2,
      childrenCount: 0,
      checkedInAt: twoDaysAgo,
      checkedInBy: frontDesk.id,
      createdBy: owner.id,
      rooms: {
        create: {
          roomId: rooms[1].id, // Room 102
          ratePerNight: 150.00,
          checkInDate: twoDaysAgo,
          checkOutDate: tomorrow,
          status: 'checked_in'
        }
      }
    }
  });

  // Booking 2: Arriving today (reserved room 201)
  const booking2 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      bookingNumber: 'BK-2024-0002',
      guestId: guests[0].id,
      checkInDate: today,
      checkOutDate: in3Days,
      status: 'confirmed',
      totalAmount: 750.00,
      source: 'website',
      adultsCount: 2,
      childrenCount: 1,
      expectedArrival: '14:00',
      createdBy: owner.id,
      rooms: {
        create: {
          roomId: rooms[5].id, // Room 201
          ratePerNight: 250.00,
          checkInDate: today,
          checkOutDate: in3Days,
          status: 'reserved'
        }
      }
    }
  });

  // Booking 3: Future booking
  const futureCheckout = new Date(nextWeek);
  futureCheckout.setDate(futureCheckout.getDate() + 4);

  const booking3 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      bookingNumber: 'BK-2024-0003',
      guestId: guests[2].id,
      checkInDate: nextWeek,
      checkOutDate: futureCheckout,
      status: 'confirmed',
      totalAmount: 1800.00,
      source: 'phone',
      adultsCount: 2,
      childrenCount: 0,
      specialRequests: 'Late check-in around 10pm',
      expectedArrival: '22:00',
      createdBy: owner.id,
      rooms: {
        create: {
          roomId: rooms[10].id, // Room 301 (Suite)
          ratePerNight: 450.00,
          checkInDate: nextWeek,
          checkOutDate: futureCheckout,
          status: 'reserved'
        }
      }
    }
  });
  console.log('Created 3 sample bookings (1 checked-in, 1 arriving today, 1 future)');

  // Create housekeeping tasks
  await Promise.all([
    prisma.housekeepingTask.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roomId: rooms[0].id, // Room 101 (cleaning)
        taskType: 'checkout_clean',
        priority: 'high',
        status: 'in_progress',
        assignedTo: housekeeper.id,
        startedAt: new Date(),
        notes: 'Guest checked out, deep clean required',
        createdBy: owner.id
      }
    }),
    prisma.housekeepingTask.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roomId: rooms[2].id, // Room 103
        taskType: 'stayover_clean',
        priority: 'normal',
        status: 'pending',
        notes: 'Standard daily cleaning',
        createdBy: owner.id
      }
    }),
    prisma.housekeepingTask.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roomId: rooms[7].id, // Room 203 (maintenance)
        taskType: 'maintenance',
        priority: 'urgent',
        status: 'pending',
        notes: 'AC not working properly',
        createdBy: owner.id
      }
    })
  ]);
  console.log('Created 3 housekeeping tasks');

  // Create a folio for the checked-in booking
  const folio = await prisma.folio.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking1.id,
      folioNumber: 'F-2024-0001',
      guestName: `${guests[1].firstName} ${guests[1].lastName}`,
      roomNumber: '102',
      status: 'open',
      subtotal: 370.00,
      totalAmount: 370.00,
      paidAmount: 200.00,
      balance: 170.00,
      charges: {
        create: [
          {
            description: 'Room Charge - Standard Room (2 nights)',
            chargeType: 'room',
            quantity: 2,
            unitPrice: 150.00,
            amount: 300.00,
            chargeDate: new Date(),
            roomNumber: '102',
            postedBy: frontDesk.id
          },
          {
            description: 'Room Service - Breakfast',
            chargeType: 'room_service',
            quantity: 1,
            unitPrice: 45.00,
            amount: 45.00,
            chargeDate: new Date(),
            roomNumber: '102',
            postedBy: frontDesk.id
          },
          {
            description: 'Mini Bar - Beverages',
            chargeType: 'minibar',
            quantity: 1,
            unitPrice: 25.00,
            amount: 25.00,
            chargeDate: new Date(),
            roomNumber: '102',
            postedBy: frontDesk.id
          }
        ]
      },
      payments: {
        create: {
          amount: 200.00,
          paymentMethod: 'cash',
          reference: 'Advance payment at check-in',
          receivedBy: frontDesk.id
        }
      }
    }
  });
  console.log('Created folio with charges and payment');

  console.log('\n========================================');
  console.log('HOSPITALITY TENANT CREATED SUCCESSFULLY');
  console.log('========================================');
  console.log('\nLogin URL: http://localhost:3000/grandplaza/login');
  console.log('\nCredentials:');
  console.log('  Owner: hotelowner / owner123');
  console.log('  Front Desk: frontdesk / frontdesk123');
  console.log('  Housekeeper: housekeeper / housekeeper123');
  console.log('\nTest Data Created:');
  console.log('  - 3 Room Types (Standard, Deluxe, Suite)');
  console.log('  - 13 Rooms across 3 floors');
  console.log('  - 3 Sample Guests (1 VIP)');
  console.log('  - 3 Bookings (1 checked-in, 1 arriving today, 1 future)');
  console.log('  - 3 Housekeeping Tasks');
  console.log('  - 1 Folio with charges and payment');
  console.log('\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
